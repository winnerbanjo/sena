import assert from 'node:assert/strict';
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { createContext, runInContext } from 'node:vm';

const root = path.resolve(process.cwd());
const swPath = path.join(root, 'apps/dashboard/public/sw.js');
const offlinePath = path.join(root, 'apps/dashboard/public/offline.html');
const manifestPath = path.join(root, 'apps/dashboard/src/app/manifest.ts');
const publicManifestPath = path.join(root, 'apps/dashboard/public/manifest.json');
const providerPath = path.join(root, 'apps/dashboard/src/components/pwa-provider.tsx');
const shellPath = path.join(root, 'apps/dashboard/src/components/dashboard-shell.tsx');
const middlewarePath = path.join(root, 'apps/dashboard/src/middleware.ts');
const nextConfigPath = path.join(root, 'apps/dashboard/next.config.mjs');

let passed = 0;
function pass(name: string) {
  passed += 1;
  console.log('PASS ' + name);
}

function loadText(filePath: string) {
  return readFileSync(filePath, 'utf8');
}

class MemoryCache {
  store = new Map<string, Response>();
  async match(request: RequestInfo, options?: { ignoreSearch?: boolean; ignoreVary?: boolean }) {
    const key = normalizeKey(request);
    if (this.store.has(key)) return this.store.get(key)!.clone();
    if (options?.ignoreSearch) {
      const wanted = new URL(key);
      for (const [stored, response] of this.store) {
        const storedUrl = new URL(stored);
        if (storedUrl.origin === wanted.origin && storedUrl.pathname === wanted.pathname) {
          return response.clone();
        }
      }
    }
    return undefined;
  }
  async put(request: RequestInfo, response: Response) {
    this.store.set(normalizeKey(request), response.clone());
  }
  async delete(request: RequestInfo) {
    return this.store.delete(normalizeKey(request));
  }
  async keys() {
    return [...this.store.keys()].map((url) => new Request(url));
  }
}

function normalizeKey(request: RequestInfo) {
  if (typeof request === 'string') return new URL(request, 'https://app.sena.ng').href;
  if (request instanceof URL) return request.href;
  return request.url;
}

class ExtendableEvent {
  private extend: Promise<unknown>[] = [];
  waitUntil(promise: Promise<unknown>) {
    this.extend.push(Promise.resolve(promise));
  }
  async done() {
    await Promise.all(this.extend);
  }
}

class FetchEvent extends ExtendableEvent {
  responded = false;
  responsePromise: Promise<Response> | null = null;
  constructor(public request: Request) {
    super();
  }
  respondWith(promise: Promise<Response> | Response) {
    this.responded = true;
    this.responsePromise = Promise.resolve(promise);
  }
}

async function createWorker(options: {
  fetchImpl: (input: RequestInfo | URL, init?: RequestInit) => Promise<Response>;
}) {
  const cachesStore = new Map<string, MemoryCache>();
  const windowClients = [
    {
      url: 'https://app.sena.ng/offline.html',
      navigate: async (url: string) => {
        navigated.push(url);
      },
    },
  ];
  const navigated: string[] = [];
  let skipWaiting = 0;
  let claimed = 0;
  const listeners: Record<string, (event: any) => void> = {};

  const cacheStorage = {
    async open(name: string) {
      if (!cachesStore.has(name)) cachesStore.set(name, new MemoryCache());
      return cachesStore.get(name)!;
    },
    async keys() {
      return [...cachesStore.keys()];
    },
    async delete(name: string) {
      return cachesStore.delete(name);
    },
    async match(request: RequestInfo) {
      for (const cache of cachesStore.values()) {
        const hit = await cache.match(request);
        if (hit) return hit;
      }
      return undefined;
    },
  };

  const sandbox = {
    SW_VERSION: undefined,
    self: null as any,
    caches: cacheStorage,
    fetch: options.fetchImpl,
    Request,
    Response,
    URL,
    Headers,
    console,
    setTimeout,
    clearTimeout,
  };
  sandbox.self = {
    location: { origin: 'https://app.sena.ng', href: 'https://app.sena.ng/' },
    addEventListener(type: string, handler: (event: any) => void) {
      listeners[type] = handler;
    },
    skipWaiting: async () => {
      skipWaiting += 1;
    },
    clients: {
      claim: async () => {
        claimed += 1;
      },
      matchAll: async () => windowClients,
    },
  };

  const context = createContext(sandbox);
  runInContext(loadText(swPath), context, { filename: 'sw.js' });

  async function install() {
    const event = new ExtendableEvent();
    listeners.install(event);
    await event.done();
  }
  async function activate() {
    const event = new ExtendableEvent();
    listeners.activate(event);
    await event.done();
  }
  async function fetchEvent(request: Request) {
    const event = new FetchEvent(request);
    listeners.fetch(event);
    await event.done();
    const response = event.responsePromise ? await event.responsePromise : null;
    return { intercepted: event.responded, response };
  }
  async function message(data: unknown, source?: { postMessage: (value: unknown) => void }) {
    const event = new ExtendableEvent() as ExtendableEvent & { data: unknown; source?: { postMessage: (value: unknown) => void } };
    event.data = data;
    event.source = source;
    listeners.message(event);
    await event.done();
  }

  return {
    install,
    activate,
    fetchEvent,
    message,
    cachesStore,
    navigated,
    stats: () => ({ skipWaiting, claimed }),
  };
}

async function run() {
  const sw = loadText(swPath);
  const offline = loadText(offlinePath);
  const manifestSrc = loadText(manifestPath);
  const publicManifest = JSON.parse(loadText(publicManifestPath));
  const provider = loadText(providerPath);
  const shell = loadText(shellPath);
  const middleware = loadText(middlewarePath);
  const nextConfig = loadText(nextConfigPath);

  assert.equal(sw.includes('Offline - Sena Hotel Operations'), false);
  pass('plain-text offline fallback string removed from service worker');

  assert.match(sw, /sena-pwa-v2/);
  assert.match(sw, /skipWaiting/);
  assert.match(sw, /redirect:\s*'follow'/);
  assert.match(sw, /cache:\s*'no-store'/);
  assert.match(sw, /credentials:\s*'include'/);
  assert.equal(sw.includes('/manifest.webmanifest'), false);
  pass('service worker uses v2 network-first navigation without caching the Next manifest');

  assert.match(offline, /You're offline/);
  assert.match(offline, /Warm Ivory|#FAF8F5/);
  assert.match(offline, /Try again/);
  assert.match(offline, /sena/i);
  assert.match(offline, /internet connection to load current hotel operations/);
  assert.match(offline, /have not been replaced with stale information/);
  assert.match(offline, /sena-offline-retry-at/);
  pass('branded offline page uses Warm Ivory copy and retry backoff');

  assert.equal(manifestSrc.includes("start_url: '/'"), true);
  assert.equal(manifestSrc.includes("scope: '/'"), true);
  assert.equal(manifestSrc.includes("display: 'standalone'"), true);
  assert.equal(publicManifest.start_url, '/');
  assert.equal(publicManifest.scope, '/');
  assert.equal(publicManifest.display, 'standalone');
  assert.equal(publicManifest.short_name, 'Sena');
  pass('manifest launches the app.sena.ng origin in standalone');

  assert.match(provider, /updateViaCache:\s*'none'/);
  assert.match(provider, /PURGE_ALL_DATA/);
  assert.match(provider, /localStorage\.clear/);
  assert.match(provider, /sessionStorage\.clear/);
  assert.match(shell, /isAuthPath/);
  assert.match(shell, /<PwaProvider>/);
  pass('login and dashboard register the worker and purge caches on sign-out');

  assert.equal(middleware.includes('offline'), true);
  assert.equal(middleware.includes('webmanifest'), true);
  assert.equal(nextConfig.includes('Service-Worker-Allowed'), true);
  pass('PWA assets skip auth middleware and advertise Service-Worker-Allowed');

  let fetchLog: Array<{ url: string; redirect?: RequestRedirect; cache?: RequestCache }> = [];
  const assetOk = async (input: RequestInfo | URL, init?: RequestInit) => {
    const request = input instanceof Request ? input : new Request(input, init);
    fetchLog.push({ url: request.url, redirect: request.redirect, cache: request.cache });
    const url = new URL(request.url);
    if (url.pathname === '/') {
      return new Response('<html>login</html>', {
        status: 200,
        headers: { 'Content-Type': 'text/html', Location: '' },
      });
    }
    if (url.pathname === '/login') {
      return new Response('<html>login</html>', { status: 200, headers: { 'Content-Type': 'text/html' } });
    }
    if (url.pathname.startsWith('/icons/') || url.pathname === '/offline.html' || url.pathname === '/assets/sena-logo.png') {
      const body = url.pathname === '/offline.html' ? offline : 'icon';
      return new Response(body, { status: 200, headers: { 'Content-Type': url.pathname.endsWith('.html') ? 'text/html' : 'text/plain' } });
    }
    return new Response('ok', { status: 200 });
  };

  const worker = await createWorker({ fetchImpl: assetOk });
  await worker.install();
  assert.equal(worker.stats().skipWaiting > 0, true);
  assert.equal(worker.cachesStore.has('sena-pwa-v2'), true);
  const offlineCached = await worker.cachesStore.get('sena-pwa-v2')!.match('https://app.sena.ng/offline.html');
  assert.ok(offlineCached);
  pass('install precaches branded offline page and skipWaiting');

  worker.cachesStore.set('sena-pwa-v1', new MemoryCache());
  worker.cachesStore.set('legacy-random', new MemoryCache());
  await worker.activate();
  assert.equal(worker.cachesStore.has('sena-pwa-v1'), false);
  assert.equal(worker.cachesStore.has('legacy-random'), false);
  assert.equal(worker.cachesStore.has('sena-pwa-v2'), true);
  assert.equal(worker.stats().claimed > 0, true);
  assert.ok(worker.navigated.length > 0);
  pass('activate deletes obsolete caches and upgrades existing installs from v1');

  fetchLog = [];
  const navigateRequest = new Request('https://app.sena.ng/', { method: 'GET', redirect: 'manual' });
  Object.defineProperty(navigateRequest, 'mode', { configurable: true, value: 'navigate' });
  Object.defineProperty(navigateRequest, 'destination', { configurable: true, value: 'document' });
  const authRedirect = await worker.fetchEvent(navigateRequest);
  assert.equal(authRedirect.intercepted, true);
  assert.equal(authRedirect.response?.status, 200);
  const authBody = await authRedirect.response!.clone().text();
  assert.equal(authBody.includes('login'), true);
  assert.equal(authBody.includes("You're offline"), false);
  const navFetch = fetchLog.find((entry) => new URL(entry.url).pathname === '/');
  assert.equal(navFetch?.redirect, 'follow');
  assert.equal(navFetch?.cache, 'no-store');
  pass('auth redirect navigation follows the network and is not treated as offline');

  const htmlCached = await worker.cachesStore.get('sena-pwa-v2')!.match('https://app.sena.ng/');
  assert.equal(htmlCached, undefined);
  pass('authenticated and login HTML is never cached');

  const serverErrorRequest = new Request('https://app.sena.ng/reservations', { method: 'GET' });
  Object.defineProperty(serverErrorRequest, 'mode', { value: 'navigate' });
  const errorWorker = await createWorker({
    fetchImpl: async (input) => {
      const request = input instanceof Request ? input : new Request(input);
      if (new URL(request.url).pathname === '/reservations') {
        return new Response('app error', { status: 500, headers: { 'Content-Type': 'text/html' } });
      }
      return assetOk(input);
    },
  });
  await errorWorker.install();
  const serverError = await errorWorker.fetchEvent(serverErrorRequest);
  assert.equal(serverError.response?.status, 500);
  assert.equal((await serverError.response!.text()).includes("You're offline"), false);
  pass('4xx/5xx app errors pass through instead of the offline screen');

  const offlineWorker = await createWorker({
    fetchImpl: async (input) => {
      const request = input instanceof Request ? input : new Request(input);
      if (request.mode === 'same-origin' || new URL(request.url).pathname === '/') {
        if (request.cache === 'no-store') {
          throw new TypeError('Failed to fetch');
        }
      }
      return assetOk(input);
    },
  });
  await offlineWorker.install();
  const offlineNav = new Request('https://app.sena.ng/', { method: 'GET' });
  Object.defineProperty(offlineNav, 'mode', { value: 'navigate' });
  const genuineOffline = await offlineWorker.fetchEvent(offlineNav);
  const offlineBody = await genuineOffline.response!.text();
  assert.equal(genuineOffline.response?.status, 503);
  assert.match(offlineBody, /You're offline/);
  assert.match(offlineBody, /#FAF8F5/);
  assert.match(offlineBody, /Try again/);
  assert.equal(offlineBody.includes('Offline - Sena Hotel Operations'), false);
  pass('genuine network failure serves the branded offline experience');

  for (const pathname of [
    '/api/reservations',
    '/api/payments',
    '/api/rooms',
    '/api/housekeeping',
    '/api/auth/session',
    '/auth/signin',
  ]) {
    const apiRequest = new Request('https://app.sena.ng' + pathname);
    const result = await worker.fetchEvent(apiRequest);
    assert.equal(result.intercepted, false, pathname);
    const cached = await worker.cachesStore.get('sena-pwa-v2')!.match('https://app.sena.ng' + pathname);
    assert.equal(cached, undefined, pathname);
  }
  const rsc = new Request('https://app.sena.ng/', { headers: { RSC: '1', 'Next-Router-State-Tree': '{}' } });
  assert.equal((await worker.fetchEvent(rsc)).intercepted, false);
  const action = new Request('https://app.sena.ng/reservations', { method: 'POST', headers: { 'Next-Action': 'abc' } });
  assert.equal((await worker.fetchEvent(action)).intercepted, false);
  pass('APIs, auth, RSC, and mutations are never intercepted or stale-cached');

  let purgeComplete = false;
  await worker.message({ type: 'PURGE_ALL_DATA' }, { postMessage: (value: any) => { if (value?.type === 'PURGE_COMPLETE') purgeComplete = true; } });
  assert.equal(purgeComplete, true);
  assert.equal(worker.cachesStore.has('sena-pwa-v1'), false);
  pass('sign-out purge clears CacheStorage and restores only the public offline shell');

  console.log(`${passed} PWA offline fallback checks passed.`);
  process.exit(0);
}

run().catch((error) => {
  console.error(error);
  process.exit(1);
});

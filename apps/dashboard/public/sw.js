// SENA HOSPITALITY PWA SERVICE WORKER
// Version: sena-pwa-v2.0.0
// Live hotel data is NEVER cached. Offline fallback is only for genuine network failure.

const SW_VERSION = 'sena-pwa-v2.0.0';
const CACHE_NAME = 'sena-pwa-v2';
const OFFLINE_URL = '/offline.html';
const BROKEN_CACHE_NAMES = ['sena-pwa-v1'];

const PRECACHE_ASSETS = [
  OFFLINE_URL,
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-192.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
  '/icons/favicon.svg',
  '/assets/sena-logo.png',
];

const BYPASS_PATH_PREFIXES = ['/api/', '/auth/'];
const BYPASS_PATH_INCLUDES = ['/_next/data/'];
const OPERATIONAL_API_HINTS = [
  '/api/reservations',
  '/api/payments',
  '/api/webhooks',
  '/api/rooms',
  '/api/housekeeping',
  '/api/invoices',
  '/api/front-desk',
  '/api/calendar',
  '/api/guests',
];

function originURL(pathname) {
  return new URL(pathname, self.location.origin).href;
}

function isBypassRequest(request, url) {
  if (BYPASS_PATH_PREFIXES.some((prefix) => url.pathname.startsWith(prefix))) {
    return true;
  }
  if (BYPASS_PATH_INCLUDES.some((part) => url.pathname.includes(part))) {
    return true;
  }
  if (OPERATIONAL_API_HINTS.some((part) => url.pathname.startsWith(part))) {
    return true;
  }
  const headers = request.headers;
  if (
    headers.get('RSC') === '1' ||
    headers.get('Next-Router-State-Tree') ||
    headers.get('Next-Router-Prefetch') ||
    headers.get('Next-Action') ||
    headers.get('next-action')
  ) {
    return true;
  }
  return false;
}

function isNavigationRequest(request) {
  return request.mode === 'navigate' || request.destination === 'document';
}

function isNetworkFailure(error) {
  if (!error) return false;
  if (error.name === 'TypeError') return true;
  const message = String(error.message || error);
  return (
    message.includes('Failed to fetch') ||
    message.includes('Load failed') ||
    message.includes('NetworkError') ||
    message.includes('network error')
  );
}

function brandedOfflineHTML() {
  return `<!DOCTYPE html>
<html lang="en">
<head>
  <meta charset="utf-8" />
  <meta name="viewport" content="width=device-width, initial-scale=1, viewport-fit=cover" />
  <meta name="theme-color" content="#FAF8F5" />
  <title>Sena — You're offline</title>
  <style>
    html,body{background:#FAF8F5;color:#191816;margin:0;min-height:100%;font-family:-apple-system,BlinkMacSystemFont,"Segoe UI",Roboto,"Helvetica Neue",Arial,sans-serif}
    body{display:flex;align-items:center;justify-content:center;padding:24px 16px}
    main{max-width:420px;width:100%;background:#fff;border:1px solid #E8E2DA;border-radius:16px;padding:36px 28px;text-align:center}
    .brand{letter-spacing:0.18em;text-transform:lowercase;font-size:12px;font-weight:600;color:#B85C3E;margin-bottom:16px}
    h1{font-size:22px;font-weight:600;margin:0 0 12px}
    p{font-size:14px;line-height:1.6;color:#7A7267;margin:0 0 12px}
    button{margin-top:16px;width:100%;height:44px;border:0;border-radius:8px;background:#191816;color:#fff;font-size:14px;cursor:pointer}
  </style>
</head>
<body>
  <main>
    <div class="brand">sena</div>
    <h1>You're offline</h1>
    <p>Sena needs an internet connection to load current hotel operations.</p>
    <p>Your reservations, rooms, payments and housekeeping data have not been replaced with stale information.</p>
    <button type="button" id="retry-btn">Try again</button>
  </main>
  <script>
    const KEY='sena-offline-retry-at';
    function canReload(){try{const last=Number(sessionStorage.getItem(KEY)||'0');if(Date.now()-last<4000)return false;sessionStorage.setItem(KEY,String(Date.now()));return true;}catch(e){return true;}}
    function retry(){if(!canReload())return;location.reload();}
    document.getElementById('retry-btn').addEventListener('click',retry);
    window.addEventListener('online',function(){if(navigator.onLine)retry();});
  </script>
</body>
</html>`;
}

function offlineFallbackResponse() {
  return new Response(brandedOfflineHTML(), {
    status: 503,
    statusText: 'Service Unavailable',
    headers: {
      'Content-Type': 'text/html; charset=utf-8',
      'Cache-Control': 'no-store',
      'X-Sena-Offline-Fallback': '1',
    },
  });
}

async function matchOfflinePage(cache) {
  const candidates = [
    new Request(originURL(OFFLINE_URL), { cache: 'reload' }),
    new Request(OFFLINE_URL),
    originURL(OFFLINE_URL),
    OFFLINE_URL,
  ];
  for (const candidate of candidates) {
    const matched = await cache.match(candidate, { ignoreSearch: true, ignoreVary: true });
    if (matched) return matched;
  }
  return null;
}

async function respondOffline() {
  try {
    const cache = await caches.open(CACHE_NAME);
    const cached = await matchOfflinePage(cache);
    if (cached) return cached;
  } catch (error) {
    // Cache lookup failed; use the inlined branded page.
  }
  return offlineFallbackResponse();
}

async function precacheAssets() {
  const cache = await caches.open(CACHE_NAME);
  await Promise.all(
    PRECACHE_ASSETS.map(async (asset) => {
      try {
        const request = new Request(originURL(asset), { cache: 'reload', credentials: 'same-origin' });
        const response = await fetch(request);
        if (response && response.ok) {
          await cache.put(request, response.clone());
        }
      } catch (error) {
        if (asset === OFFLINE_URL) {
          await cache.put(originURL(OFFLINE_URL), offlineFallbackResponse());
        }
      }
    })
  );
}

function navigationRequest(request) {
  return new Request(request.url, {
    method: 'GET',
    credentials: 'include',
    redirect: 'follow',
    cache: 'no-store',
  });
}

async function handleNavigation(request) {
  try {
    const response = await fetch(navigationRequest(request));
    if (response) {
      return response;
    }
    return respondOffline();
  } catch (error) {
    if (isNetworkFailure(error)) {
      return respondOffline();
    }
    throw error;
  }
}

async function handleStaticAsset(request) {
  const cached = await caches.match(request);
  if (cached) return cached;
  const response = await fetch(request);
  if (response && response.status === 200 && response.type === 'basic') {
    const cache = await caches.open(CACHE_NAME);
    cache.put(request, response.clone());
  }
  return response;
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    (async () => {
      await precacheAssets();
      await self.skipWaiting();
    })()
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      const names = await caches.keys();
      const obsolete = names.filter((name) => name !== CACHE_NAME);
      const replacedBrokenWorker = obsolete.some((name) => BROKEN_CACHE_NAMES.includes(name));
      await Promise.all(obsolete.map((name) => caches.delete(name)));
      await self.clients.claim();
      if (replacedBrokenWorker) {
        const windowClients = await self.clients.matchAll({ type: 'window', includeUncontrolled: true });
        await Promise.all(
          windowClients.map((client) => {
            if (typeof client.navigate === 'function') {
              return client.navigate(client.url);
            }
            return null;
          })
        );
      }
    })()
  );
});

self.addEventListener('fetch', (event) => {
  const request = event.request;
  if (request.method !== 'GET') {
    return;
  }

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) {
    return;
  }

  if (isBypassRequest(request, url)) {
    return;
  }

  if (isNavigationRequest(request)) {
    event.respondWith(handleNavigation(request));
    return;
  }

  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(handleStaticAsset(request));
    return;
  }

  if (PRECACHE_ASSETS.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cached) => cached || fetch(request))
    );
    return;
  }

  // All other same-origin GETs: browser default network. Never cache HTML or PMS data.
});

self.addEventListener('message', (event) => {
  if (!event.data) return;

  if (event.data.type === 'PURGE_ALL_DATA') {
    event.waitUntil(
      (async () => {
        const keys = await caches.keys();
        await Promise.all(keys.map((key) => caches.delete(key)));
        await precacheAssets();
        if (event.source) {
          event.source.postMessage({ type: 'PURGE_COMPLETE' });
        }
      })()
    );
  }

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

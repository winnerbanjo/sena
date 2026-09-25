// SENA HOSPITALITY PWA SERVICE WORKER
// Version: sena-pwa-v1.0.0
// Strict operational safety: Live hotel data is NEVER cached. Freshness is P0.

const CACHE_NAME = 'sena-pwa-v1';

const PRECACHE_ASSETS = [
  '/offline.html',
  '/manifest.webmanifest',
  '/icons/icon-192.png',
  '/icons/icon-512.png',
  '/icons/icon-maskable-192.png',
  '/icons/icon-maskable-512.png',
  '/icons/apple-touch-icon.png',
  '/icons/favicon.svg',
  '/assets/sena-logo.png'
];

// Install Event: Precache offline screen and core brand assets
self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return cache.addAll(PRECACHE_ASSETS);
    }).then(() => {
      return self.skipWaiting();
    })
  );
});

// Activate Event: Clean up legacy caches and immediately claim clients
self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames
          .filter((name) => name !== CACHE_NAME)
          .map((name) => caches.delete(name))
      );
    }).then(() => {
      return self.clients.claim();
    })
  );
});

// Fetch Event: Strict routing rules
self.addEventListener('fetch', (event) => {
  const request = event.request;
  const url = new URL(request.url);

  // 1. Only handle GET requests. All mutations (POST, PUT, DELETE, PATCH) are Network-Only.
  if (request.method !== 'GET') {
    return;
  }

  // 2. Multi-tenant operational safety:
  // NEVER cache API endpoints, Auth endpoints, or Next Server Actions.
  // Real-time PMS inventory, reservations, guests, folios, and housekeeping must NEVER be stale.
  if (
    url.pathname.startsWith('/api/') ||
    url.pathname.startsWith('/auth/') ||
    url.pathname.includes('/_next/data/')
  ) {
    return; // Let browser perform direct network fetch with no SW caching
  }

  // 3. Navigation requests (Page Loads / Tab Navigations)
  // Strategy: Network-First with fallback to calm offline screen
  if (request.mode === 'navigate') {
    event.respondWith(
      fetch(request).catch(async () => {
        const cache = await caches.open(CACHE_NAME);
        const cachedOffline = await cache.match('/offline.html');
        return cachedOffline || new Response('Offline - Sena Hotel Operations', {
          status: 503,
          headers: { 'Content-Type': 'text/plain' }
        });
      })
    );
    return;
  }

  // 4. Next.js Immutable Static Chunks & Bundles (/_next/static/*)
  // Strategy: Cache-First with Network fallback (content hashed and immutable)
  if (url.pathname.startsWith('/_next/static/')) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        if (cachedResponse) {
          return cachedResponse;
        }
        return fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // 5. Precached Brand Icons and Offline Assets
  if (PRECACHE_ASSETS.includes(url.pathname)) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        return cachedResponse || fetch(request);
      })
    );
    return;
  }

  // 6. External fonts (Inter, Google Fonts)
  if (
    url.hostname === 'rsms.me' ||
    url.hostname === 'fonts.googleapis.com' ||
    url.hostname === 'fonts.gstatic.com'
  ) {
    event.respondWith(
      caches.match(request).then((cachedResponse) => {
        return cachedResponse || fetch(request).then((networkResponse) => {
          if (networkResponse && networkResponse.status === 200) {
            const responseToCache = networkResponse.clone();
            caches.open(CACHE_NAME).then((cache) => {
              cache.put(request, responseToCache);
            });
          }
          return networkResponse;
        });
      })
    );
    return;
  }

  // Default: Network fetch with zero stale cache fallback
  event.respondWith(fetch(request));
});

// Message Listener: Tenant Purge & Lifecycle Controls
self.addEventListener('message', (event) => {
  if (!event.data) return;

  // On logout or tenant switch, purge all caches to prevent cross-property data leaks
  if (event.data.type === 'PURGE_ALL_DATA') {
    caches.keys().then((keys) => {
      return Promise.all(keys.map((k) => caches.delete(k)));
    }).then(() => {
      if (event.source) {
        event.source.postMessage({ type: 'PURGE_COMPLETE' });
      }
    });
  }

  if (event.data.type === 'SKIP_WAITING') {
    self.skipWaiting();
  }
});

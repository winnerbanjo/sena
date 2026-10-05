// SENA EMERGENCY SERVICE WORKER KILLSWITCH
// Disables service worker, purges all caches, and unregisters itself immediately.
// Zero fetch interception: all network requests pass directly to origin.

self.addEventListener('install', () => {
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    (async () => {
      // 1. Delete all Sena-owned caches
      try {
        const cacheNames = await caches.keys();
        await Promise.all(cacheNames.map((name) => caches.delete(name)));
      } catch (err) {
        // Ignore cache deletion errors
      }

      // 2. Unregister self immediately
      try {
        await self.registration.unregister();
      } catch (err) {
        // Ignore unregister errors
      }

      // 3. Claim clients to ensure active control is released
      try {
        await self.clients.claim();
      } catch (err) {
        // Ignore claim errors
      }
    })()
  );
});

// NO FETCH LISTENER: Let browser network handle all requests directly.

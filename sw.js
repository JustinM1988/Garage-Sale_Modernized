// sw.js - Service Worker for Offline Functionality
const CACHE_NAME = 'garage-sale-admin-v8.0';
const urlsToCache = [
  '/',
  '/index.html',
  '/config.js',
  '/app.js',
  '/styles.css',
  '/manifest.json',
  // Leaflet assets
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.css',
  'https://unpkg.com/leaflet@1.9.4/dist/leaflet.js',
  // Offline fallback page
  '/offline.html'
];

// Install event
self.addEventListener('install', function(event) {
  console.log('[SW] Install event');

  event.waitUntil(
    caches.open(CACHE_NAME)
      .then(function(cache) {
        console.log('[SW] Opened cache');
        return cache.addAll(urlsToCache);
      })
  );
});

// Fetch event
self.addEventListener('fetch', function(event) {
  event.respondWith(
    caches.match(event.request)
      .then(function(response) {
        // Return cached version or fetch from network
        if (response) {
          console.log('[SW] Serving from cache:', event.request.url);
          return response;
        }

        return fetch(event.request).then(function(response) {
          // Don't cache non-successful responses
          if (!response || response.status !== 200 || response.type !== 'basic') {
            return response;
          }

          // Clone response for cache
          const responseToCache = response.clone();

          caches.open(CACHE_NAME)
            .then(function(cache) {
              cache.put(event.request, responseToCache);
            });

          return response;
        }).catch(function() {
          // Return offline fallback for navigation requests
          if (event.request.mode === 'navigate') {
            return caches.match('/offline.html');
          }
        });
      })
  );
});

// Activate event
self.addEventListener('activate', function(event) {
  console.log('[SW] Activate event');

  event.waitUntil(
    caches.keys().then(function(cacheNames) {
      return Promise.all(
        cacheNames.map(function(cacheName) {
          if (cacheName !== CACHE_NAME) {
            console.log('[SW] Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    })
  );
});

// Background sync for offline data submission
self.addEventListener('sync', function(event) {
  if (event.tag === 'background-sync-garage-sales') {
    console.log('[SW] Background sync triggered');
    event.waitUntil(syncGarageSales());
  }
});

async function syncGarageSales() {
  try {
    // Get stored offline submissions
    const cache = await caches.open(CACHE_NAME);
    const offlineData = await cache.match('/offline-submissions');

    if (offlineData) {
      const submissions = await offlineData.json();

      for (const submission of submissions) {
        try {
          await fetch(submission.url, submission.options);
          console.log('[SW] Successfully synced offline submission');
        } catch (error) {
          console.log('[SW] Failed to sync submission:', error);
        }
      }

      // Clear offline submissions after sync
      await cache.delete('/offline-submissions');
    }
  } catch (error) {
    console.log('[SW] Background sync failed:', error);
  }
}
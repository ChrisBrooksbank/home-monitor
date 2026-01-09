const CACHE_NAME = 'home-monitor-v11';

// Minimal caching - only cache the shell, not JS files
const urlsToCache = [
  '/'
];

self.addEventListener('install', (event) => {
  // Skip waiting to activate immediately
  self.skipWaiting();
  event.waitUntil(
    caches.open(CACHE_NAME)
      .then((cache) => {
        console.log('Service worker installed');
        return cache.addAll(urlsToCache);
      })
  );
});

self.addEventListener('fetch', (event) => {
  const url = new URL(event.request.url);

  // Always fetch JS files from network (no caching during development)
  if (url.pathname.endsWith('.js')) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Don't cache API requests (Hue Bridge, proxies, Weather API)
  const isDynamicAPI = url.hostname.includes('192.168.') ||
                       url.hostname.includes('10.5.') ||
                       url.hostname.includes('api.weatherapi.com') ||
                       url.port === '3000' ||
                       url.port === '3001' ||
                       url.port === '8082';

  if (isDynamicAPI) {
    event.respondWith(fetch(event.request));
    return;
  }

  // Network-first for everything else
  event.respondWith(
    fetch(event.request)
      .then((response) => {
        return response;
      })
      .catch(() => {
        // Only fall back to cache if network fails
        return caches.match(event.request);
      })
  );
});

self.addEventListener('activate', (event) => {
  // Clear all old caches
  event.waitUntil(
    caches.keys().then((cacheNames) => {
      return Promise.all(
        cacheNames.map((cacheName) => {
          if (cacheName !== CACHE_NAME) {
            console.log('Deleting old cache:', cacheName);
            return caches.delete(cacheName);
          }
        })
      );
    }).then(() => {
      // Take control of all pages immediately
      return self.clients.claim();
    })
  );
});

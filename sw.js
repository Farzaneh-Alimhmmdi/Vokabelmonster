const CACHE_VERSION = '1.1.1';
const CACHE_NAME = `vokabelmonster-v${CACHE_VERSION}`;

const PRECACHE_PATHS = [
  './',
  './index.html',
  './manifest.webmanifest',
  './css/app.css',
  './js/app.js',
  './js/version.js',
  './js/db.js',
  './js/srs.js',
  './js/tts.js',
  './js/csv.js',
  './js/morphology.js',
  './js/dictionary.js',
  './js/ui/search.js',
  './js/ui/review.js',
  './js/ui/words.js',
  './js/ui/stats.js',
  './js/ui/settings.js',
  './icons/icon-192.png',
  './icons/icon-512.png',
  './icons/icon-maskable-512.png',
  './icons/apple-touch-icon-180.png',
];

function resolveAssetUrls(paths) {
  const scope = self.registration ? self.registration.scope : self.location.href;
  return paths.map((path) => new URL(path, scope).toString());
}

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => cache.addAll(resolveAssetUrls(PRECACHE_PATHS)))
  );
  self.skipWaiting();
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys
          .filter((key) => key.startsWith('vokabelmonster-') && key !== CACHE_NAME)
          .map((key) => caches.delete(key))
      )
    )
  );
  self.clients.claim();
});

self.addEventListener('fetch', (event) => {
  const { request } = event;
  if (request.method !== 'GET') return;

  const url = new URL(request.url);
  if (url.origin !== self.location.origin) return;

  if (request.mode === 'navigate') {
    event.respondWith(
      caches.match(new URL('./index.html', self.registration.scope).toString()).then(
        (cached) => cached || fetch(request)
      )
    );
    return;
  }

  event.respondWith(
    caches.match(request).then((cached) => {
      if (cached) return cached;
      return fetch(request).then((response) => {
        if (!response || response.status !== 200 || response.type !== 'basic') {
          return response;
        }
        const clone = response.clone();
        caches.open(CACHE_NAME).then((cache) => cache.put(request, clone));
        return response;
      });
    })
  );
});

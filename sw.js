// Zero-Knowledge Offline App Shell Service Worker (v3.0)
// Caches ONLY static public UI shell assets (never private API responses).
const CACHE_NAME = 'second-brain-shell-v3.0';
const SHELL_ASSETS = [
  './',
  './index.html',
  './coach-engine.js?v=3.0',
  './coach-engine.js',
  './mapa.html',
  './manifest.json',
  'https://cdn.tailwindcss.com'
];

self.addEventListener('install', (event) => {
  event.waitUntil(
    caches.open(CACHE_NAME).then((cache) => {
      return Promise.allSettled(
        SHELL_ASSETS.map((url) =>
          fetch(url, { cache: 'reload' }).then((res) => {
            if (res && (res.ok || res.type === 'opaque')) {
              return cache.put(url, res);
            }
          })
        )
      );
    }).then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', (event) => {
  event.waitUntil(
    caches.keys().then((keys) =>
      Promise.all(
        keys.filter((k) => k !== CACHE_NAME).map((k) => caches.delete(k))
      )
    ).then(() => self.clients.claim())
  );
});

self.addEventListener('fetch', (event) => {
  const req = event.request;
  if (req.method !== 'GET') return;

  const url = new URL(req.url);
  // Never intercept GitHub API, Gemini API, or local Mac API calls in Service Worker
  if (
    url.hostname.includes('api.github.com') ||
    url.hostname.includes('generativelanguage.googleapis.com') ||
    url.pathname.startsWith('/api/')
  ) {
    return;
  }

  // Network-first with instant offline cache fallback for app shell
  event.respondWith(
    fetch(req)
      .then((res) => {
        if (res && (res.ok || res.type === 'opaque')) {
          const copy = res.clone();
          caches.open(CACHE_NAME).then((cache) => cache.put(req, copy));
        }
        return res;
      })
      .catch(() =>
        caches.match(req).then((cached) => {
          if (cached) return cached;
          if (req.mode === 'navigate') {
            return caches.match('./index.html') || caches.match('./');
          }
          return new Response('Offline', { status: 503 });
        })
      )
  );
});

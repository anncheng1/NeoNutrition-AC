// NeoNutrition service worker — keeps the app usable with no network.
// Strategy: the app page itself is NETWORK-FIRST (so an installed home-screen
// app always opens the latest version when online) and falls back to the
// cached copy when offline. Icons/manifest are cache-first with background refresh.
// Bump CACHE when files change so old caches are cleared.
const CACHE = 'neonutrition-v2026-11-15-autoupdate';
const ASSETS = ['./', './index.html', './manifest.webmanifest', './icon-192.png', './icon-512.png', './apple-touch-icon.png'];
const NETWORK_TIMEOUT_MS = 4000;

self.addEventListener('install', e => {
  // cache:'reload' bypasses the browser HTTP cache so we never store a stale copy
  e.waitUntil(
    caches.open(CACHE)
      .then(c => Promise.all(ASSETS.map(u => fetch(new Request(u, { cache: 'reload' })).then(res => { if (res.ok) return c.put(u, res); }))))
      .then(() => self.skipWaiting())
  );
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys().then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim())
  );
});

function isAppPage(req, url){
  return req.mode === 'navigate' || url.pathname.endsWith('/') || url.pathname.endsWith('/index.html');
}

self.addEventListener('fetch', e => {
  const req = e.request;
  if (req.method !== 'GET') return;
  const url = new URL(req.url);
  if (url.origin !== self.location.origin) return;

  if (isAppPage(req, url)) {
    // Network-first with a timeout, then cached copy (offline)
    e.respondWith((async () => {
      const cache = await caches.open(CACHE);
      try {
        const res = await Promise.race([
          fetch(new Request(req.url, { cache: 'no-store', credentials: 'same-origin' })),
          new Promise((_, rej) => setTimeout(() => rej(new Error('timeout')), NETWORK_TIMEOUT_MS))
        ]);
        if (res && res.ok) { cache.put('./index.html', res.clone()); return res; }
        throw new Error('bad response');
      } catch (err) {
        return (await cache.match('./index.html')) || (await cache.match('./')) || Response.error();
      }
    })());
    return;
  }

  // Other same-origin files: cache-first, refresh in background
  e.respondWith(
    caches.open(CACHE).then(async cache => {
      const cached = await cache.match(req, { ignoreSearch: true });
      const network = fetch(req).then(res => {
        if (res && res.ok) cache.put(req, res.clone());
        return res;
      }).catch(() => cached);
      return cached || network;
    })
  );
});

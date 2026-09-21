// ============================================================
// sw.js - offline-first with a revalidating entry point (GDD §28.7)
// There is no network in this game, so nothing needs to be network-first
// for freshness of *data*. The one thing that does need revalidating is the
// shell itself: a pure cache-first worker serves a shipped update never,
// because nothing evicts the old copy.
//
// Navigations and the module graph are stale-while-revalidate: the cached
// copy answers instantly (so the game opens offline and on a dead connection),
// and a fresh copy is fetched in the background for the next load.
// ============================================================
const CACHE = 'lanternwake-v2';

// Only the entry points need pre-caching; every module, style and worker file
// is added to the cache the first time it is actually requested.
const SHELL = [
  './', './index.html', './manifest.webmanifest',
  './styles/base.css', './styles/hud.css', './styles/panels.css',
  './js/main.js', './js/audio.js',
];

self.addEventListener('install', e => {
  e.waitUntil(caches.open(CACHE).then(c => c.addAll(SHELL)).then(() => self.skipWaiting()));
});

self.addEventListener('activate', e => {
  e.waitUntil(
    caches.keys()
      .then(keys => Promise.all(keys.filter(k => k !== CACHE).map(k => caches.delete(k))))
      .then(() => self.clients.claim()),
  );
});

/** Put a good same-origin response in the cache. Opaque responses are skipped. */
function store(request, res) {
  if (res && res.ok && res.type === 'basic') {
    const copy = res.clone();
    caches.open(CACHE).then(c => c.put(request, copy));
  }
  return res;
}

self.addEventListener('fetch', e => {
  const { request } = e;
  if (request.method !== 'GET') return;
  if (new URL(request.url).origin !== self.location.origin) return;

  e.respondWith((async () => {
    const hit = await caches.match(request);

    // Revalidate in the background so a shipped update lands on the next load.
    const fresh = fetch(request).then(res => store(request, res)).catch(() => null);

    // Serve the cached copy at once when there is one; otherwise wait for the
    // network, and fall back to the cached shell for a navigation made offline.
    if (hit) return hit;
    const res = await fresh;
    if (res) return res;
    if (request.mode === 'navigate') {
      return (await caches.match('./index.html')) || Response.error();
    }
    return Response.error();
  })());
});

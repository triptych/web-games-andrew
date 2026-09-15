// ============================================================
// sw.js - cache-first for everything (GDD §28.7)
// There is no network in this game, so nothing is network-first.
// ============================================================
const CACHE = 'lanternwake-v1';

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

self.addEventListener('fetch', e => {
  if (e.request.method !== 'GET') return;
  e.respondWith(
    caches.match(e.request).then(hit => hit || fetch(e.request).then(res => {
      if (res && res.ok && res.type === 'basic') {
        const copy = res.clone();
        caches.open(CACHE).then(c => c.put(e.request, copy));
      }
      return res;
    }).catch(() => hit)),
  );
});

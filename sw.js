/**
 * sw.js — one shared service worker for every game.
 *
 * lib/pwa.js registers this file once per game with that game's folder as the
 * scope (a worker may take a scope narrower than its own folder), so each
 * game installs and caches on its own, and the launcher is left alone.
 *
 * Strategy: network first, cache as the fallback. A shipped update shows up on
 * the next load (no stale index.html paired with new scripts), and once a game
 * has been played online its files are in the cache, so it opens offline too.
 * Nothing is pre-cached beyond the page itself: a game's audio and models can
 * be large, and only what was actually requested is worth keeping.
 *
 * Cross-origin: only the CDNs the games import from (three.js, Kaplay data and
 * fonts), and only responses the browser let the page read (not opaque).
 */
const VERSION = 'v1';
const PREFIX = 'game-pwa-';
// The scope is the game's folder, e.g. https://host/web-games-andrew/game-001/
const CACHE = `${PREFIX}${VERSION}:${self.registration.scope}`;
const CDNS = ['unpkg.com', 'cdn.jsdelivr.net', 'cdnjs.cloudflare.com', 'fonts.googleapis.com', 'fonts.gstatic.com'];
// How long a navigation waits for the network before a cached copy is used
const NAV_TIMEOUT_MS = 6000;

self.addEventListener('install', (event) => {
    event.waitUntil((async () => {
        try {
            const cache = await caches.open(CACHE);
            await cache.add(new Request(self.registration.scope, { cache: 'reload' }));
        } catch (e) { /* offline at install time: runtime caching still works */ }
        await self.skipWaiting();
    })());
});

self.addEventListener('activate', (event) => {
    event.waitUntil((async () => {
        // drop this game's caches from an older VERSION (other games' caches carry their own scope)
        const scopeTag = `:${self.registration.scope}`;
        for (const key of await caches.keys()) {
            if (key.startsWith(PREFIX) && key.endsWith(scopeTag) && key !== CACHE) await caches.delete(key);
        }
        await self.clients.claim();
    })());
});

function cacheable(url) {
    if (url.origin === self.location.origin) return true;
    return url.protocol === 'https:' && CDNS.includes(url.hostname);
}

async function remember(request, response) {
    // only complete, readable responses: no 206 partials, no opaque, no errors
    if (!response || response.status !== 200 || response.type === 'opaque') return;
    try { await (await caches.open(CACHE)).put(request, response.clone()); } catch (e) { /* quota */ }
}

async function fromNetwork(request, timeoutMs) {
    const ctl = typeof AbortController === 'function' && timeoutMs ? new AbortController() : null;
    const timer = ctl ? setTimeout(() => ctl.abort(), timeoutMs) : 0;
    try {
        const response = await fetch(ctl ? new Request(request, { signal: ctl.signal }) : request);
        await remember(request, response);
        return response;
    } finally { clearTimeout(timer); }
}

self.addEventListener('fetch', (event) => {
    const { request } = event;
    if (request.method !== 'GET' || request.headers.has('range')) return;
    const url = new URL(request.url);
    if (!cacheable(url)) return;

    event.respondWith((async () => {
        const navigate = request.mode === 'navigate';
        try {
            // a navigation gives up on a dead connection after a few seconds if it has a copy to show
            const cached = navigate ? await caches.match(request, { ignoreSearch: true }) : null;
            return await fromNetwork(request, cached ? NAV_TIMEOUT_MS : 0);
        } catch (e) {
            const hit = (await caches.match(request)) || (navigate && (await caches.match(request, { ignoreSearch: true })));
            if (hit) return hit;
            if (navigate) {
                const shell = await caches.match(self.registration.scope);
                if (shell) return shell;
            }
            return Response.error();
        }
    })());
});

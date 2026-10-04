/**
 * smoketest.mjs — load every game in real Chromium and poke it.
 *
 * For each game: open it at a desktop size and on a touch-only phone, wait,
 * then click / tap the middle of the screen, press Enter, Space, the arrows
 * and WASD, and wait again. Fails a game on any console error, uncaught page
 * error, failed request or HTTP error. Also checks that the "← Games" link is
 * on screen and clickable, and that the phone page does not scroll sideways.
 * Screenshots go to dev/shots/<game>-<desktop|phone>-<0|1>.png.
 *
 * This is a floor, not a playtest: it catches games that crash on boot or on
 * the first input, 404 an asset, or lose their way back to the launcher. Each
 * newer game (037+) has its own dev/ harness that goes much further.
 *
 *   python3 -m http.server 8000                 # from the REPO ROOT
 *   node dev/smoketest.mjs                      # every game
 *   ONLY=game-014,game-022 node dev/smoketest.mjs
 *
 * No network to the CDNs? Point THREE_PKG (three@0.165.0) and THREE128_PKG
 * (three@0.128.0, game-014) at unpacked npm packages; CDN requests are then
 * served from disk:
 *   npm pack three@0.165.0 && tar xzf three-0.165.0.tgz   # -> ./package
 *
 * NOSTORAGE=1 makes every localStorage access throw, as it does in a browser
 * with site data blocked or in some private modes. A game should still boot
 * and play (it just can't save).
 *
 * Env: BASE (default http://127.0.0.1:8000), OUT, ONLY, FROM, TO,
 *      VIEWS=desktop,phone, NOSTORAGE=1, PW_CHROMIUM_PATH.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(HERE);
const BASE = process.env.BASE ?? 'http://127.0.0.1:8000';
const OUT = process.env.OUT ?? path.join(HERE, 'shots');
const THREE_PKG = process.env.THREE_PKG ?? path.join(HERE, 'package');
const THREE128_PKG = process.env.THREE128_PKG ?? path.join(HERE, 'package-r128');
const VIEWS = (process.env.VIEWS ?? 'desktop,phone').split(',');
const NOSTORAGE = process.env.NOSTORAGE === '1';
fs.mkdirSync(OUT, { recursive: true });

const all = fs.readdirSync(ROOT).filter((d) => /^game-\d{3}$/.test(d)).sort();
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
const from = process.env.FROM ?? 'game-000';
const to = process.env.TO ?? 'game-999';
const games = all.filter((g) => (only ? only.includes(g) : g >= from && g <= to));

const VIEWPORTS = {
    desktop: { viewport: { width: 1280, height: 760 } },
    phone: { viewport: { width: 390, height: 844 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2 },
};

// Hosts whose failures are not the game's fault in a sandbox (fonts are
// decorative and every game falls back to a system font).
const IGNORED_HOSTS = ['fonts.googleapis.com', 'fonts.gstatic.com'];

const MIME = { '.js': 'text/javascript', '.mjs': 'text/javascript', '.json': 'application/json', '.wasm': 'application/wasm' };

async function serveFromDisk(route, file) {
    if (!fs.existsSync(file)) return route.continue();
    await route.fulfill({
        status: 200,
        headers: { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream', 'access-control-allow-origin': '*' },
        body: fs.readFileSync(file),
    });
}

async function routeCdns(ctx) {
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    if (fs.existsSync(THREE_PKG)) {
        const strip = (u) => new URL(u).pathname.replace(/^\/(npm\/)?three@0\.165\.0\//, '');
        await ctx.route(/(unpkg\.com|cdn\.jsdelivr\.net\/npm)\/three@0\.165\.0\//, (r) => serveFromDisk(r, path.join(THREE_PKG, strip(r.request().url()))));
    }
    if (fs.existsSync(THREE128_PKG)) {
        await ctx.route(/cdnjs\.cloudflare\.com\/ajax\/libs\/three\.js\/r128\//, (r) => serveFromDisk(r, path.join(THREE128_PKG, 'build', path.basename(new URL(r.request().url()).pathname))));
    }
}

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function poke(page, phone) {
    const { width, height } = page.viewportSize();
    const cx = Math.round(width / 2), cy = Math.round(height / 2);
    if (phone) await page.touchscreen.tap(cx, cy).catch(() => {});
    else await page.mouse.click(cx, cy).catch(() => {});
    await sleep(400);
    for (const key of ['Enter', 'Space', 'ArrowRight', 'ArrowUp', 'KeyD', 'KeyW', 'ArrowLeft', 'KeyA', 'Space']) {
        await page.keyboard.down(key).catch(() => {});
        await sleep(120);
        await page.keyboard.up(key).catch(() => {});
    }
    if (phone) await page.touchscreen.tap(cx, Math.round(height * 0.7)).catch(() => {});
    else await page.mouse.click(cx, Math.round(height * 0.7)).catch(() => {});
}

async function checkBackLink(page) {
    return page.evaluate(() => {
        const a = [...document.querySelectorAll('a[href]')].find((el) => /(^|\/)\.\.\/index\.html$/.test(el.getAttribute('href')));
        if (!a) return 'no link to ../index.html';
        const r = a.getBoundingClientRect();
        if (r.width === 0 || r.height === 0) return 'back link has no size';
        if (r.right < 0 || r.bottom < 0 || r.left > innerWidth || r.top > innerHeight) return 'back link is off screen';
        const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        if (top !== a && !a.contains(top)) return `back link is covered by <${top?.tagName?.toLowerCase()} id="${top?.id ?? ''}" class="${top?.className ?? ''}">`;
        return null;
    });
}

async function run(game, view, browser) {
    const ctx = await browser.newContext(VIEWPORTS[view]);
    await routeCdns(ctx);
    await ctx.addInitScript((blocked) => {
        try { localStorage.clear(); } catch { /* ignore */ }
        window.confirm = () => true;
        window.alert = () => {};
        if (blocked) {
            Object.defineProperty(window, 'localStorage', {
                get() { throw new DOMException("Failed to read the 'localStorage' property from 'Window': Access is denied for this document.", 'SecurityError'); },
            });
        }
    }, NOSTORAGE);
    const page = await ctx.newPage();
    const problems = [];
    const ignored = (url) => IGNORED_HOSTS.some((h) => url.includes(h));
    page.on('console', (m) => { if (m.type() === 'error' && !ignored(m.location()?.url ?? '')) problems.push(`console: ${m.text().slice(0, 300)}`); });
    page.on('pageerror', (e) => problems.push(`pageerror: ${String(e.message).slice(0, 300)}`));
    page.on('requestfailed', (r) => { if (!ignored(r.url())) problems.push(`requestfailed: ${r.url()} (${r.failure()?.errorText})`); });
    page.on('response', (r) => { if (r.status() >= 400 && !ignored(r.url())) problems.push(`http ${r.status()}: ${r.url()}`); });

    try {
        await page.goto(`${BASE}/${game}/index.html`, { waitUntil: 'load', timeout: 30000 });
    } catch (e) {
        problems.push(`goto: ${e.message.split('\n')[0]}`);
    }
    await sleep(1500);
    const back = await checkBackLink(page).catch((e) => `back link check failed: ${e.message}`);
    if (back) problems.push(`backlink: ${back}`);
    await page.screenshot({ path: path.join(OUT, `${game}-${view}${NOSTORAGE ? '-nostorage' : ''}-0.png`) }).catch(() => {});
    await poke(page, view === 'phone');
    await sleep(1500);
    await poke(page, view === 'phone');
    await sleep(1000);
    await page.screenshot({ path: path.join(OUT, `${game}-${view}${NOSTORAGE ? '-nostorage' : ''}-1.png`) }).catch(() => {});
    if (view === 'phone') {
        const overflow = await page.evaluate(() => document.documentElement.scrollWidth - innerWidth).catch(() => 0);
        if (overflow > 1) problems.push(`layout: page is ${overflow}px wider than a 390px phone`);
        // A centred flex child wider than the screen overflows on both sides,
        // and the left half can't be scrolled to, so scrollWidth misses it.
        const clipped = await page.evaluate(() => [...document.querySelectorAll('canvas')]
            .map((c) => c.getBoundingClientRect())
            .filter((r) => r.width > 40 && r.height > 40 && (r.left < -1 || r.right > innerWidth + 1))
            .map((r) => `${Math.round(r.width)}px canvas spans ${Math.round(r.left)}..${Math.round(r.right)}`)).catch(() => []);
        for (const c of clipped) problems.push(`layout: ${c} on a ${VIEWPORTS.phone.viewport.width}px phone`);
    }
    await ctx.close();
    return [...new Set(problems)];
}

const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
});

let failed = 0;
for (const game of games) {
    for (const view of VIEWS) {
        const problems = await run(game, view, browser);
        if (problems.length) failed++;
        console.log(`${problems.length ? 'FAIL' : 'ok  '} ${game} ${view}`);
        for (const p of problems) console.log(`       ${p}`);
    }
}
await browser.close();
console.log(`\n${games.length} games, ${failed} failing runs`);
process.exit(failed ? 1 : 0);

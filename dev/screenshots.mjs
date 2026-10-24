/**
 * screenshots.mjs — take a 1200×630 share/preview picture of every game.
 *
 * Each game is opened in real Chromium, given a click and a few key presses
 * so it gets past its title screen, and photographed. The pictures land in
 * garden/img/games/<game>.jpg, where the Garden's Library shows them and the
 * og:image / twitter:image tags written by dev/add-meta.mjs point at them.
 *
 *   node dev/screenshots.mjs                       # every game
 *   ONLY=game-014,game-022 node dev/screenshots.mjs
 *   FROM=game-040 TO=game-060 node dev/screenshots.mjs
 *   SHOT=title node dev/screenshots.mjs            # before any input
 *
 * It serves the repo itself (no separate static server needed). Env: PORT
 * (default 8123), OUT, ONLY, FROM, TO, SHOT=play|title, WAIT (ms of settle
 * time, default 2500), PW_CHROMIUM_PATH. CDN copies of three.js are read from
 * dev/package and dev/package-r128 when present (see dev/README.md).
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.dirname(HERE);
const PORT = Number(process.env.PORT ?? 8123);
const OUT = process.env.OUT ?? path.join(ROOT, 'garden', 'img', 'games');
const THREE_PKG = path.join(HERE, 'package');
const THREE128_PKG = path.join(HERE, 'package-r128');
const WAIT = Number(process.env.WAIT ?? 2500);
const SHOT = process.env.SHOT ?? 'play';
fs.mkdirSync(OUT, { recursive: true });

const all = fs.readdirSync(ROOT).filter((d) => /^game-\d{3}$/.test(d)).sort();
const only = process.env.ONLY ? process.env.ONLY.split(',') : null;
const from = process.env.FROM ?? 'game-000';
const to = process.env.TO ?? 'game-999';
const games = all.filter((g) => (only ? only.includes(g) : g >= from && g <= to));

const MIME = {
    '.html': 'text/html', '.js': 'text/javascript', '.mjs': 'text/javascript', '.css': 'text/css',
    '.json': 'application/json', '.png': 'image/png', '.jpg': 'image/jpeg', '.svg': 'image/svg+xml',
    '.wasm': 'application/wasm', '.mp3': 'audio/mpeg', '.ogg': 'audio/ogg', '.wav': 'audio/wav',
};

const server = http.createServer((req, res) => {
    const rel = decodeURIComponent(new URL(req.url, 'http://x').pathname);
    let file = path.join(ROOT, rel);
    if (!file.startsWith(ROOT)) { res.writeHead(403).end(); return; }
    if (fs.existsSync(file) && fs.statSync(file).isDirectory()) file = path.join(file, 'index.html');
    if (!fs.existsSync(file)) { res.writeHead(404).end(); return; }
    res.writeHead(200, { 'content-type': MIME[path.extname(file)] ?? 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
}).listen(PORT, '127.0.0.1');

const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

async function serveFromDisk(route, file) {
    if (!fs.existsSync(file)) return route.continue();
    await route.fulfill({
        status: 200,
        headers: { 'content-type': 'text/javascript', 'access-control-allow-origin': '*' },
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

async function poke(page) {
    const { width, height } = page.viewportSize();
    await page.mouse.click(Math.round(width / 2), Math.round(height / 2)).catch(() => {});
    await sleep(400);
    for (const key of ['Enter', 'Space', 'ArrowRight', 'KeyD', 'ArrowUp']) {
        await page.keyboard.down(key).catch(() => {});
        await sleep(120);
        await page.keyboard.up(key).catch(() => {});
    }
}

const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
});

let failed = 0;
for (const game of games) {
    const ctx = await browser.newContext({ viewport: { width: 1200, height: 630 } });
    await routeCdns(ctx);
    await ctx.addInitScript(() => {
        try { localStorage.clear(); } catch { /* ignore */ }
        window.confirm = () => true;
        window.alert = () => {};
    });
    const page = await ctx.newPage();
    try {
        await page.goto(`http://127.0.0.1:${PORT}/${game}/index.html`, { waitUntil: 'load', timeout: 30000 });
        await sleep(WAIT);
        if (SHOT === 'play') {
            await poke(page);
            await sleep(WAIT);
            await poke(page);
            await sleep(1000);
        }
        // the "← Games" launcher link is page chrome, not part of the game's picture
        await page.addStyleTag({ content: 'a[href$="../index.html"]{visibility:hidden!important}' }).catch(() => {});
        await page.screenshot({ path: path.join(OUT, `${game}.jpg`), type: 'jpeg', quality: 80 });
        console.log(`ok   ${game}`);
    } catch (e) {
        failed++;
        console.log(`FAIL ${game}: ${e.message.split('\n')[0]}`);
    }
    await ctx.close();
}
await browser.close();
server.close();
console.log(`\n${games.length} games, ${failed} failed`);
process.exit(failed ? 1 : 0);

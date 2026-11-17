/**
 * preview.mjs — the 1200×630 picture for the Garden's library and share cards: a diorama of a hand-picked dungeon
 * with the UI hidden. Writes garden/img/games/game-138.jpg (and dev/shots/preview.png).
 *
 *   python3 -m http.server 8138 &      # repo root
 *   node game-138/dev/preview.mjs
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '../..');
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(ROOT, 'dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8138';
const HASH = process.env.H ?? '#s=amber-hearth-12&z=s&n=2&m=6683&e=777566&t=cw';

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })).newPage();
if (PKG) {
    await page.route('https://unpkg.com/**', (route) => {
        const file = path.join(PKG, new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, ''));
        if (!fs.existsSync(file)) return route.abort();
        route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
    });
}
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await page.goto(`${BASE}/game-138/index.html?debug=1${HASH}`, { waitUntil: 'domcontentloaded' });
await page.waitForFunction(() => window.__lh && document.getElementById('loading').classList.contains('done'), null, { timeout: 120000 });
await page.waitForFunction(async () => (await import('./js/view/models.js')).modelState.ready, null, { timeout: 90000, polling: 500 });
await page.evaluate(async (R) => {
    __lh.ui.closeScreen('title');
    for (const id of ['top', 'bench', 'depth', 'info', 'back-link', 'toasts']) document.getElementById(id).style.display = 'none';
    __lh.view.setInset(0, 0);
    // the busiest chamber, from a low three-quarter angle
    const L = __lh.G.d.levels[0];
    const big = L.rooms.reduce((a, b) => (b.cells.length > a.cells.length ? b : a));
    let sx = 0, sz = 0;
    for (const c of big.cells) { sx += (c % L.w) * 3 + 1.5; sz += Math.floor(c / L.w) * 3 + 1.5; }
    const o = __lh.view.orbit;
    o.goal.target.set((sx / big.cells.length) * 2, 0, (sz / big.cells.length) * 2);
    o.goal.r = R; o.goal.phi = 0.9; o.goal.theta = 0.7;
    Object.assign(o, { r: o.goal.r, phi: 0.9, theta: 0.7 }); o.target.copy(o.goal.target);
}, +(process.env.R || 18));
await page.waitForTimeout(6000);
fs.mkdirSync(path.join(HERE, 'shots'), { recursive: true });
await page.screenshot({ path: path.join(HERE, 'shots', 'preview.png'), timeout: 120000 });
await page.screenshot({ path: path.join(ROOT, 'garden/img/games/game-138.jpg'), type: 'jpeg', quality: 86, timeout: 120000 });
console.log('wrote garden/img/games/game-138.jpg');
await browser.close();

/**
 * preview.mjs — the 1200×630 picture for the Garden's Library and share links: the Hayate in the air over the
 * sakura gorge, the twin-hull fortress SOUEN firing a sweep at it.
 *
 *   python3 -m http.server 8152     # repo root
 *   node game-152/dev/preview.mjs   # writes garden/img/games/game-152.jpg
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8152';
const OUT = path.join(HERE, '../../garden/img/games/game-152.jpg');

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })).newPage();
if (PKG) await page.route('https://unpkg.com/**', (route) => {
    const file = path.join(PKG, new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, ''));
    if (!fs.existsSync(file)) return route.abort();
    route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
});
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await page.goto(`${BASE}/game-152/index.html?debug=1&fast=2`);
await page.waitForFunction(() => window.__hrs, null, { timeout: 60000 });
await page.addStyleTag({ content: '#comms, #banner, #hud-gauges, #hud-buttons, #back-link, #popups, #toasts { display: none !important; }' });
await page.evaluate(async () => {
    __hrs.start(11, 0, { hull: 3, rounds: 2, racks: 1, barrels: 2 });
    __hrs.autoplay(true);
    for (let i = 0; i < 400 && !(__hrs.G.boss && !__hrs.G.boss.mini); i++) { __hrs.G.boat.hull = __hrs.G.stats.maxHull; __hrs.ff(1); }
    __hrs.ff(3.5);
    __hrs.autoplay(false);
    const b = __hrs.G.boat;
    b.charge = 1; b.z = 2.6; b.vz = 0.5;
});
await page.waitForTimeout(900);
await page.screenshot({ path: OUT, type: 'jpeg', quality: 84 });
console.log('wrote', path.relative(process.cwd(), OUT));
await browser.close();

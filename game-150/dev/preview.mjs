/**
 * preview.mjs — the 1200×630 picture for the Garden's Library and share links: a well-stocked shop at mid-day,
 * with customers browsing and one waiting at the counter with a wish.
 *
 *   python3 -m http.server 8150     # repo root
 *   node game-150/dev/preview.mjs   # writes garden/img/games/game-150.jpg
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8150';
const OUT = path.join(HERE, '../../garden/img/games/game-150.jpg');

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })).newPage();
if (PKG) await page.route('https://unpkg.com/**', (route) => {
    const file = path.join(PKG, new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, ''));
    if (!fs.existsSync(file)) return route.abort();
    route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
});
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await page.goto(`${BASE}/game-150/index.html?debug=1&fast=2`);
await page.waitForFunction(() => window.__ff, null, { timeout: 60000 });
await page.evaluate(async () => {
    __ff.start(21);
    const G = __ff.G;
    G.gold = 2000;
    // a cozy, well-stocked shop
    const put = (type, row, slot) => { __ff.cmd({ t: 'buyFurniture', type }); __ff.cmd({ t: 'place', type, row, slot }); };
    put('shelf', 'wall', 2); put('painting', 'wall', 3); put('ivy', 'wall', 0); put('shelf', 'wall', 5);
    put('lamp', 'floor', 1); put('fern', 'floor', 2); put('armchair', 'floor', 3); put('cat', 'floor', 4); put('table', 'floor', 5);
    __ff.give(40, { rarity: 1 });
    __ff.give(8, { rarity: 3 });
    __ff.cmd({ t: 'autoShelve' });
    G.gold = 146;
    __ff.skipStory();
    __ff.cmd({ t: 'open' });
    document.getElementById('back-link').style.display = 'none';
});
// let customers come in, browse, and someone wait at the counter
await page.waitForFunction(() => __ff.G.customers.filter((c) => c.state !== 'in').length >= 2 || __ff.G.clock > 40, null, { timeout: 120000, polling: 200 });
await page.evaluate(() => { __ff.shop.centerOn(3.2); __ff.shop.follow = null; __ff.shop.userPanned = 99; document.getElementById('tip').hidden = true; });
await page.waitForTimeout(1200);
await page.screenshot({ path: OUT, type: 'jpeg', quality: 86 });
console.log('wrote', path.relative(process.cwd(), OUT));
await browser.close();

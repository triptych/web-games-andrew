/**
 * preview.mjs — the 1200×630 picture for the Garden's Library and share links: the Lance firing at the Throne of
 * the Choir, its barrier breaking, the board stepped aside.
 *
 *   python3 -m http.server 8151     # repo root
 *   node game-151/dev/preview.mjs   # writes garden/img/games/game-151.jpg
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8151';
const OUT = path.join(HERE, '../../garden/img/games/game-151.jpg');

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })).newPage();
if (PKG) await page.route('https://unpkg.com/**', (route) => {
    const file = path.join(PKG, new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, ''));
    if (!fs.existsSync(file)) return route.abort();
    route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
});
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await page.goto(`${BASE}/game-151/index.html?debug=1&fast=2`);
await page.waitForFunction(() => window.__os, null, { timeout: 60000 });
await page.addStyleTag({ content: '#comm, #readout, #btn-skip, #cutin, #hud-top, #hud-bars, #back-link { display: none !important; }' });
await page.evaluate(async () => {
    const G = __os.start(7, 5, true);
    await new Promise((r) => { const f = () => (__os.view.boss.model && __os.view.ship.model ? r() : setTimeout(f, 100)); f(); });
    const m = G.m;
    m.round = m.rounds - 1; m.phase = 'clear'; m.spare = 0;
    __os.act({ t: 'route', stat: 'power' });
    Object.assign(m.charge, { power: 6000, speed: 5000, thermal: 3000, cryo: 3000, volt: 5000 });
    __os.act({ t: 'fire' });
});
await page.waitForFunction(() => __os.G.m && __os.G.m.phase === 'beam' && __os.G.m.t > 3.3, null, { timeout: 120000, polling: 50 });
await page.screenshot({ path: OUT, type: 'jpeg', quality: 82 });
console.log('wrote', path.relative(process.cwd(), OUT));
await browser.close();

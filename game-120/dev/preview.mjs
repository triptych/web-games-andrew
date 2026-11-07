/**
 * preview.mjs — the 1200×630 Garden preview: the fully grown walker facing the Warlord in the Hive.
 *
 *   python3 -m http.server 8120      # repo root
 *   node game-120/dev/preview.mjs    # writes garden/img/games/game-120.jpg
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.env.OUT ?? path.join(HERE, '../../garden/img/games/game-120.jpg');
const BASE = process.env.BASE ?? 'http://127.0.0.1:8120';
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));

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
await page.goto(`${BASE}/game-120/index.html?debug=1&q=${process.env.Q || 'high'}`);
await page.waitForFunction(() => window.__hr && __hr.mode === 'title', null, { timeout: 180000 });
await page.evaluate(() => {
    const H = window.__hr;
    H.start(7, 5, { guns: 5, missiles: 5, armor: 5, fuel: 4, legs: 5 });
    H.god();
    const A = H.G.world.arena, e = H.G.enemies.find((q) => q.b);
    H.warp(A.z + 40);
    H.G.enemies = H.G.enemies.filter((q) => q.b);          // a clean arena: the walker and the Warlord
    H.G.player.missiles = 0;                               // guns only: no blasts under the camera
    for (const id of ['back-link', 'radio', 'hud', 'reticle']) { const el = document.getElementById(id); if (el) el.style.display = 'none'; }
    H.autoplay(true);
    window.__stopBot = () => { H.autoplay(false); H.G.waves.length = 0; H.G.marks.length = 0; H.G.player.missiles = 0; H.G.enemies.forEach((q) => { q.flash = 0; }); };
});
await page.waitForTimeout(4000);
await page.evaluate(() => window.__stopBot());
await page.waitForTimeout(+(process.env.WAIT ?? 9000));
await page.screenshot({ path: OUT, type: 'jpeg', quality: 88, timeout: 120000 });
console.log('wrote', path.relative(process.cwd(), OUT));
await browser.close();

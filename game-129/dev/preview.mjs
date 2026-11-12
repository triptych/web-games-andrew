/**
 * preview.mjs — the 1200×630 Garden preview for game-129: the party facing a guardian in the Glimmer Grotto.
 *
 *   python3 -m http.server 8129          # repo root
 *   node game-129/dev/preview.mjs         # writes garden/img/games/game-129.jpg
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8129';
const OUT = path.join(HERE, '../../garden/img/games/game-129.jpg');

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })).newPage();
if (PKG) {
    await page.route('https://unpkg.com/**', (route) => {
        const file = path.join(PKG, new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, ''));
        if (!fs.existsSync(file)) return route.abort();
        route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
    });
}
await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await page.goto(`${BASE}/game-129/index.html?debug=1`);
await page.waitForFunction(() => window.__hd, null, { timeout: 60000 });
await page.evaluate(() => {
    __hd.start(4);
    __hd.G.gold = 9000;
    for (let i = 0; i < 2; i++) __hd.send({ t: 'hire', i: 0 });
    __hd.G.warps.push(6);
    __hd.send({ t: 'enter', floor: 6 });
    __hd.G.floor = 10; __hd.G.deepest = 10;
    __hd.view.floorKey = null;
    __hd.faceOpen();
    __hd.fight('boss');
});
await page.waitForFunction(() => !document.getElementById('battle-menu').hidden && [...document.querySelectorAll('#foes img')].every((i) => i.complete), null, { timeout: 60000 });
await page.evaluate(() => { document.getElementById('dialogue').hidden = true; document.getElementById('back-link').style.display = 'none'; });
await page.waitForTimeout(1500);
await page.screenshot({ path: OUT, type: 'jpeg', quality: 86 });
console.log('wrote', path.relative(process.cwd(), OUT));
await browser.close();

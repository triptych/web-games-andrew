/**
 * preview.mjs — the 1200×630 Garden preview: a laid table at the Dining Table, top-tier dishes glowing,
 * three guests with their orders ready, one dish picked up.
 *
 *   python3 -m http.server 8118      # repo root
 *   node game-118/dev/preview.mjs    # writes garden/img/games/game-118.jpg
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.env.OUT ?? path.join(HERE, '../../garden/img/games/game-118.jpg');
const BASE = process.env.BASE ?? 'http://127.0.0.1:8118';
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
await page.goto(`${BASE}/game-118/index.html?debug=1`);
await page.waitForFunction(() => window.__kt, null, { timeout: 90000 });
await page.evaluate(() => {
    const K = window.__kt;
    K.start(12);
    K.set({ table: 2, coins: 142, stars: 2, chapter: 3 });
    K.G.cells.fill(null);
    const c = (col, row) => row * 6 + col;
    const items = [
        [1, 1, 'craft', 6], [3, 1, 'pumpkin', 6], [5, 1, 'grain', 6],
        [0, 2, 'turkey', 4], [2, 2, 'craft', 5], [4, 2, 'turkey', 5],
        [1, 3, 'pumpkin', 4], [3, 3, 'grain', 5], [5, 3, 'turkey', 3],
        [0, 4, 'craft', 3], [2, 4, 'pumpkin', 3], [4, 4, 'grain', 4], [3, 4, 'pumpkin', 5],
        [1, 5, 'pumpkin', 'gen'], [2, 5, 'craft', 'gen'], [3, 5, 'turkey', 'gen'], [4, 5, 'grain', 'gen'],
    ];
    for (const [x, y, ch, t] of items) K.place(c(x, y), ch, t);
    const [g0, g1, g2] = K.G.guests;
    g0.wants = [{ c: 'turkey', t: 4, n: 1 }]; g0.coins = 17; g0.stars = 1;
    g1.wants = [{ c: 'pumpkin', t: 5, n: 1 }, { c: 'grain', t: 4, n: 1 }]; g1.coins = 27; g1.stars = 1;
    g2.wants = [{ c: 'craft', t: 5, n: 1 }]; g2.coins = 12; g2.stars = 1;
    K.board.selected = c(0, 2);
    document.getElementById('back-link').style.display = 'none';
});
await page.waitForTimeout(+(process.env.WAIT ?? 8000));
await page.screenshot({ path: OUT, type: 'jpeg', quality: 88, timeout: 120000 });
console.log('wrote', path.relative(process.cwd(), OUT));
await browser.close();

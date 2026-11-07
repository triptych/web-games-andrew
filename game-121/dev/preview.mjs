/**
 * preview.mjs — the 1200×630 Garden preview: the Hooded Stranger across the table, the three cards turned over,
 * the crystal ball glowing. UI hidden, graphics on high.
 *
 *   python3 -m http.server 8121        # repo root
 *   node game-121/dev/preview.mjs      # writes garden/img/games/game-121.jpg
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.env.OUT ?? path.join(HERE, '../../garden/img/games/game-121.jpg');
const BASE = process.env.BASE ?? 'http://127.0.0.1:8121';
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
await page.goto(`${BASE}/game-121/index.html?debug=1&q=high`);
await page.waitForFunction(() => window.__aw && __aw.mode === 'title', null, { timeout: 240000 });
await page.evaluate(() => {
    const A = window.__aw;
    A.start(11);
    // the Hooded Stranger (day 2, third guest), the cards laid and turned
    A.playTo((G) => G.phase === 'deal' && G.day === 2 && G.idx === 2, { mode: 'perfect', romance: 'mirabel' });
});
// lay the best spread by the sim's own truth, then let it settle on the "react" frame
await page.evaluate(async () => {
    const { cardPoints } = await import('./js/sim/reading.js');
    const A = window.__aw, R = A.G.reading, n = R.hand.length;
    let best = null;
    for (let a = 0; a < n && !best; a++) for (let b = 0; b < n && !best; b++) for (let c = 0; c < n && !best; c++) {
        if (a === b || b === c || a === c) continue;
        if ([a, b, c].every((k, i) => cardPoints(R.beats[i], R.hand[k].c, R.hand[k].r) === 2)) best = [a, b, c];
    }
    best.forEach((h, s) => A.act({ t: 'place', h, s }));
    A.act({ t: 'lay' });
    A.act({ t: 'next' });
    A.act({ t: 'say', style: 'truth' });
    for (const id of ['back-link', 'hud', 'dock', 'visions', 'result', 'tip', 'toasts']) { const e = document.getElementById(id); if (e) e.style.display = 'none'; }
});
await page.waitForTimeout(+(process.env.WAIT ?? 12000));
await page.screenshot({ path: OUT, type: 'jpeg', quality: 88, timeout: 120000 });
console.log('wrote', path.relative(process.cwd(), OUT));
await browser.close();

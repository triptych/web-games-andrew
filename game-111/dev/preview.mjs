/**
 * preview.mjs — the launcher picture: a mid-game moment with a line clearing, at 1200×630.
 *
 *   node game-111/dev/preview.mjs        # writes garden/img/games/game-111.jpg
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '../..');
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(ROOT, 'dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8111';

const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await (await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })).newPage();
if (PKG) {
    await page.route('https://unpkg.com/**', (route) => {
        const file = path.join(PKG, new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, ''));
        if (!fs.existsSync(file)) return route.abort();
        route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
    });
}
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await page.goto(`${BASE}/game-111/index.html?debug=1`);
await page.waitForFunction(() => window.__na && __na.mode === 'title');
await page.evaluate(() => {
    // seven arcana already back in the sky, a busy lattice, a row and a column about to go
    __na.setMeta({ restored: [0, 1, 2, 3, 4, 5, 6] });
    __na.start(2024, { mode: 'quest' });
    const G = __na.G;
    const pat = [
        '4441.155',
        '4..1.155',
        '33.21222',
        '.3.2..8.',
        '666.6666',
        '..77.5..',
        '2.77.5.1',
        '2..75..1',
    ];
    G.cells = pat.join('').split('').map((c) => (c === '.' ? 0 : +c));
    G.hp = G.cells.map((c) => (c === 8 ? 2 : 0));
    G.sigils.fill(0);
    G.sigils[5 * 8 + 1] = 1; G.sigils[1 * 8 + 2] = 1;
    G.light = Math.round(G.goal * 0.3);
    G.resonance = 2;
    G.events.length = 0;
});
await page.waitForTimeout(1500);
await page.evaluate(() => {
    document.getElementById('omen').hidden = true;
    const G = __na.G;
    G.hand[0] = { id: 'x', cells: [[0, 0]], color: 3, uid: 991 };
    __na.act({ t: 'place', i: 0, x: 3, y: 4 });       // completes row 4 and column 3
});
await page.waitForTimeout(1300);
const out = path.join(ROOT, 'garden/img/games/game-111.jpg');
await page.screenshot({ path: out, type: 'jpeg', quality: 86 });
console.log('wrote', path.relative(process.cwd(), out));
await browser.close();

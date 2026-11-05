/**
 * preview.mjs — the 1200×630 Garden preview: Stonebridge's street at golden hour, with a hero at the inn.
 *
 *   python3 -m http.server 8119      # repo root
 *   node game-119/dev/preview.mjs    # writes garden/img/games/game-119.jpg
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.env.OUT ?? path.join(HERE, '../../garden/img/games/game-119.jpg');
const BASE = process.env.BASE ?? 'http://127.0.0.1:8119';
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
await page.goto(`${BASE}/game-119/index.html?debug=1`);
await page.waitForFunction(() => window.__thm && __thm.mode === 'title', null, { timeout: 180000 });
await page.evaluate(() => {
    const H = window.__thm;
    H.start(5);
    H.skip();
    const G = H.G;
    G.loc = 'stonebridge'; G.lv = 9; G.gold = 2840; G.day = 74; G.hour = 17.4; G.xp = 3000;
    G.towns.stonebridge.visited = true;
    H.give('sword', 3, 1); H.give('shield', 4, 1); H.give('iron_ingot', 0, 8); H.give('leather', 0, 6); H.give('sapphire', 0, 3); H.give('potion', 2, 3);
    document.getElementById('back-link').style.display = 'none';
});
await page.waitForTimeout(+(process.env.WAIT ?? 12000));   // textures and shaders under SwiftShader
await page.screenshot({ path: OUT, type: 'jpeg', quality: 88, timeout: 120000 });
console.log('wrote', path.relative(process.cwd(), OUT));
await browser.close();

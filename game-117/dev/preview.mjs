/**
 * preview.mjs — the 1200×630 Garden preview: the bot in a firefight by a beacon on asteroid IV.
 *
 *   python3 -m http.server 8117      # repo root
 *   node game-117/dev/preview.mjs    # writes garden/img/games/game-117.jpg
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.env.OUT ?? path.join(HERE, '../../garden/img/games/game-117.jpg');
const BASE = process.env.BASE ?? 'http://127.0.0.1:8117';
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
await page.goto(`${BASE}/game-117/index.html?debug=1&q=2`);
await page.waitForFunction(() => window.__ph, null, { timeout: 90000 });
const level = +(process.env.LEVEL ?? 3), seed = +(process.env.SEED ?? 41), secs = +(process.env.SECS ?? 14);
await page.evaluate(([lv, sd, s]) => {
    const H = window.__ph;
    H.start(sd, lv);
    H.skipIntro();
    H.G.player.power = 3;
    H.ff(s);
    H.G.player.inv = 0;
    document.getElementById('back-link').style.display = 'none';
    document.getElementById('comms').style.display = 'none';
    // freeze the moment: the sim stops, the renderer keeps drawing it
    H.ui.openScreen('pause');
    document.getElementById('pause').style.display = 'none';
}, [level, seed, secs]);
await page.waitForTimeout(+(process.env.WAIT ?? 30000));   // shader compiles and the regolith bake under SwiftShader
await page.screenshot({ path: OUT, type: 'jpeg', quality: 86, timeout: 120000 });
console.log('wrote', path.relative(process.cwd(), OUT));
await browser.close();

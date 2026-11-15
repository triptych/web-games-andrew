/**
 * preview.mjs — the Garden's 1200×630 preview of SHARDFRAME: a hive sortie twenty seconds in,
 * the bot flying, voxels everywhere, the HUD up, no comms or banners in the way.
 *
 *   node game-137/dev/preview.mjs [mission] [seconds]     # writes garden/img/games/game-137.jpg
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8137';
const [mission = '2', secs = '22'] = process.argv.slice(2);
const OUT = path.join(HERE, '../../garden/img/games/game-137.jpg');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 1200, height: 630 } })).newPage();
if (PKG) {
    await page.route('https://unpkg.com/**', (route) => {
        const file = path.join(PKG, new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, ''));
        if (!fs.existsSync(file)) return route.abort();
        route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
    });
}
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`${BASE}/game-137/index.html?debug=1`);
await page.waitForFunction(() => window.__sf && __sf.mode === 'title', null, { timeout: 90000 });
await page.evaluate(([m, s]) => {
    __sf.newGame(11);
    Object.assign(__sf.G.hangar.parts, { scatter: 2, laser: 1 });
    __sf.G.hangar.loadout.armR = 'scatter';
    __sf.launch(+m);
    __sf.ff(+s);
    __sf.autoplay(true);
}, [mission, secs]);
await page.waitForTimeout(2500);
await page.evaluate(() => { for (const id of ['comm', 'banner', 'toasts', 'back-link']) document.getElementById(id).style.visibility = 'hidden'; });
await page.waitForTimeout(400);
await page.screenshot({ path: OUT, type: 'jpeg', quality: 86 });
console.log('wrote', path.relative(process.cwd(), OUT));
await browser.close();

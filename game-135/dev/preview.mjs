/**
 * preview.mjs — the 1200×630 Garden/share preview: the bulldozer clearing the rockslide by the town hall.
 *   python3 -m http.server 8135   (repo root)   then   node game-135/dev/preview.mjs
 * Writes garden/img/games/game-135.jpg (via a PNG screenshot and Pillow).
 */
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const OUT = path.join(HERE, '../../garden/img/games/game-135.jpg');
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })).newPage();
if (PKG) await page.route('https://unpkg.com/**', (route) => {
    const file = path.join(PKG, new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, ''));
    return fs.existsSync(file) ? route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) }) : route.abort();
});
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await page.goto(`${process.env.BASE ?? 'http://127.0.0.1:8135'}/game-135/index.html?debug=1&fast=4`);
await page.waitForFunction(() => window.__hh);
await page.evaluate(async () => {
    __hh.start(3);
    __hh.ff(600, (G) => G.active === 'rocks');
    __hh.autoplay(true);
    // let the bot get a boulder onto the blade, then freeze the moment
    for (let i = 0; i < 200; i++) {
        await new Promise((r) => setTimeout(r, 100));
        const G = __hh.G;
        if (G.veh === 'dozer' && G.debris.length <= 5 && G.debris.some((d) => Math.hypot(d.x - G.p.x, d.y - G.p.y) < 3.2)) break;
    }
    __hh.autoplay(false);
    document.getElementById('toasts').style.display = 'none';
});
await page.waitForFunction(() => __hh.view.info.models.loaded >= 14, null, { timeout: 60000 });
await page.waitForTimeout(2500);
const png = path.join(HERE, 'shots', 'preview.png');
fs.mkdirSync(path.dirname(png), { recursive: true });
await page.screenshot({ path: png });
await browser.close();
execFileSync('python3', ['-I', '-c', `from PIL import Image; Image.open(${JSON.stringify(png)}).convert('RGB').save(${JSON.stringify(OUT)}, quality=86)`]);
console.log('wrote', path.relative(process.cwd(), OUT), fs.statSync(OUT).size >> 10, 'KB');

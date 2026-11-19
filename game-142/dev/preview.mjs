// preview.mjs — the 1200×630 picture the Garden's Library and share links use: King Bumble's Grand
// Castle a moment after a Boom Ball goes off, set up through the debug hooks.
// Writes garden/img/games/game-142.jpg.
//   python3 -m http.server 8142   (repo root)  ·  node game-142/dev/preview.mjs
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = [path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const OUT = process.env.OUT ?? path.join(HERE, '../../garden/img/games/game-142.jpg');
const DELAY = +(process.env.DELAY ?? 350);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })).newPage();
if (PKG) await page.route('https://unpkg.com/**', (r) => { const f = path.join(PKG, new URL(r.request().url()).pathname.replace(/^\/three@0\.165\.0\//, '')); return fs.existsSync(f) ? r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(f) }) : r.abort(); });
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await page.goto('http://127.0.0.1:8142/game-142/index.html?debug=1');
await page.waitForFunction(() => window.__kk, null, { timeout: 60000 });
await page.evaluate(async () => {
    __kk.start(11, 3);
    await new Promise((r) => setTimeout(r, 2500));
    document.getElementById('hud-hint').style.display = 'none';
    __kk.G.sel = 'boom';
    __kk.aim(0, 0.24);
    __kk.input.pressA();
});
await page.waitForFunction(() => (__kk.seen.boom || 0) >= 1, null, { timeout: 60000, polling: 20 });
await page.waitForTimeout(DELAY);
await page.screenshot({ path: OUT, type: 'jpeg', quality: 86 });
console.log('wrote', OUT);
await browser.close();

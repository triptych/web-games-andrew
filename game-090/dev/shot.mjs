/**
 * shot.mjs — screenshot a dev page.
 *
 *   node game-090/dev/shot.mjs "gallery.html?only=daemons" name [waitMs]
 *   node game-090/dev/shot.mjs "gallery.html?only=daemons&rig=quad&rot=0.9" quads 1500
 * VIEW=1600x900 resizes. Output: game-090/dev/shots/<name>.png
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8090';
const [url = 'gallery.html', name = 'gallery', wait = '1500'] = process.argv.slice(2);
const [w, h] = (process.env.VIEW || '1600x900').split('x').map(Number);
fs.mkdirSync(path.join(HERE, 'shots'), { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 })).newPage();
if (PKG) await page.route('https://unpkg.com/**', (route) => {
    const file = path.join(PKG, new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, ''));
    if (!fs.existsSync(file)) return route.abort();
    route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
});
page.on('console', (m) => { if (m.type() === 'error') console.log('[error]', m.text()); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`${BASE}/game-090/dev/${url}`);
await page.waitForFunction(() => window.__ready, null, { timeout: 90000 });
await page.waitForTimeout(+wait);
await page.screenshot({ path: path.join(HERE, 'shots', `${name}.png`) });
console.log('shot', path.join('dev/shots', `${name}.png`));
await browser.close();

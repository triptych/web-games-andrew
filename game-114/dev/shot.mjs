/**
 * shot.mjs — screenshot a dev page (the sprite gallery by default).
 *
 *   node game-114/dev/shot.mjs [page=gallery.html] [name=gallery] [w=1400] [h=1400]
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8114';
const [pg = 'gallery.html', name = 'gallery', w = '1400', h = '1400'] = process.argv.slice(2);
fs.mkdirSync(path.join(HERE, 'shots'), { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
if (PKG) await page.route('https://unpkg.com/**', (route) => {
    const file = path.join(PKG, new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, ''));
    if (!fs.existsSync(file)) return route.abort();
    route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
});
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`${BASE}/game-114/dev/${pg}`);
await page.waitForFunction(() => window.ready, null, { timeout: 60000 });
await page.screenshot({ path: path.join(HERE, 'shots', `${name}.png`), fullPage: true });
console.log('shot', `dev/shots/${name}.png`);
await browser.close();

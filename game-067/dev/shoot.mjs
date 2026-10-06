/**
 * shoot.mjs — screenshot any page of the game folder (e.g. the model gallery).
 *
 *   node game-067/dev/shoot.mjs "dev/gallery.html" name [width height]
 *
 * Waits for window.__done (or two seconds) and takes a full-page screenshot to dev/shots/<name>.png.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8067';
const [, , url = 'dev/gallery.html', name = 'gallery', w = '1280', h = '800'] = process.argv;
fs.mkdirSync(path.join(HERE, 'shots'), { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: Number(w), height: Number(h) } });
if (PKG) await page.route('https://unpkg.com/**', (route) => {
    const file = path.join(PKG, new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, ''));
    if (!fs.existsSync(file)) return route.abort();
    route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
});
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('[console]', m.text()); });
await page.goto(`${BASE}/game-067/${url}`);
await page.waitForFunction(() => window.__done, null, { timeout: 120000 }).catch(() => page.waitForTimeout(2000));
await page.screenshot({ path: path.join(HERE, 'shots', `${name}.png`), fullPage: true });
await browser.close();

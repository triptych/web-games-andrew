/**
 * shoot.mjs — screenshot any page of the game folder with three.js served from disk.
 *   node game-065/dev/shoot.mjs "dev/gallery.html?from=1&n=30" out-name [w h] [waitFrames]
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8065';
const [page0 = 'index.html', name = 'shot', w = '1400', h = '900', frames = '3'] = process.argv.slice(2);
fs.mkdirSync(path.join(HERE, 'shots'), { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: +w, height: +h } });
await page.route('https://unpkg.com/**', (route) => {
    const rel = new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, '');
    const file = path.join(PKG, rel);
    if (!fs.existsSync(file)) return route.abort();
    route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
});
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log(m.type(), m.text().slice(0, 300)); });
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto(`${BASE}/game-065/${page0}`);
await page.waitForFunction(`(window.__frames || 0) >= ${+frames}`, null, { timeout: 120000 });
await page.screenshot({ path: path.join(HERE, 'shots', `${name}.png`) });
await browser.close();
console.log('saved', name);

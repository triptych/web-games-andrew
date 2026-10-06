/**
 * shot.mjs — screenshot any page of the game for visual iteration.
 *   node game-065/dev/shot.mjs "dev/view.html?g=50" name [WxH] [frames]
 * Needs a static server at BASE (default http://127.0.0.1:8065) from the repo root.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? path.join(HERE, 'package');
const BASE = process.env.BASE ?? 'http://127.0.0.1:8065';
const [rel = 'index.html', name = 'shot', size = '1280x800', wantFrames = '40'] = process.argv.slice(2);
const [w, h] = size.split('x').map(Number);
const OUT = path.join(HERE, 'shots'); fs.mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: w, height: h } });
if (process.env.PRE) await page.addInitScript(process.env.PRE);
await page.route('https://unpkg.com/**', (route) => {
    const rel = new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, '');
    const file = path.join(PKG, rel);
    if (!fs.existsSync(file)) return route.abort();
    route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
});
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('console.' + m.type(), m.text()); });
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto(`${BASE}/game-065/${rel}`);
if (process.env.EVAL) await page.evaluate(process.env.EVAL);
await page.waitForFunction((n) => (window.__frames || 0) >= n || (window.__wr && window.__wr.state().frames >= n), Number(wantFrames), { timeout: 180000 });
await page.screenshot({ path: path.join(OUT, `${name}.png`) });
console.log('saved', name, await page.evaluate(() => JSON.stringify(window.__size || (window.__wr && window.__wr.debugCam && window.__wr.debugCam()) || null)));
await browser.close();

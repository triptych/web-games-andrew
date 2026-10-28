/**
 * preview.mjs — the 1200×630 picture the Garden's Library and share links use.
 * Sets up a real moment through the debug hooks (a cybernetic arm half taken apart, a cover on the
 * bench, screws in the dish) and writes garden/img/games/game-105.jpg.
 *
 *   python3 -m http.server 8105          # repo root
 *   node game-105/dev/preview.mjs
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..', '..');
const PKG = process.env.THREE_PKG ?? path.join(ROOT, 'dev', 'package');
const BASE = process.env.BASE ?? 'http://127.0.0.1:8105';
const OUT = path.join(ROOT, 'garden', 'img', 'games', 'game-105.jpg');

const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'],
});
const page = await (await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })).newPage();
await page.route('https://unpkg.com/**', (route) => {
    const file = path.join(PKG, new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, ''));
    if (!fs.existsSync(file)) return route.abort();
    route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
});
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`${BASE}/game-105/index.html?debug=1&q=med`);
await page.waitForFunction(() => window.__sr, null, { timeout: 90000 });
await page.evaluate(() => { __sr.free('cyberarm', 4, 3); __sr.goals(9); });
await page.waitForFunction(() => __sr.view.dev && __sr.view.parts.size > 8, null, { timeout: 60000 });
await page.evaluate(() => {
    document.getElementById('tip').hidden = true;
    document.getElementById('status').style.display = 'none';
    __sr.view.goal.az = -0.32; __sr.view.goal.el = 0.9;
});
await page.waitForTimeout(4000);
await page.evaluate(() => { document.getElementById('tip').hidden = true; });
fs.mkdirSync(path.dirname(OUT), { recursive: true });
await page.screenshot({ path: OUT, type: 'jpeg', quality: 88 });
console.log('wrote', path.relative(ROOT, OUT));
await browser.close();

/**
 * shots.mjs — quick screenshots of any page in the game folder (dev aid).
 *   node game-051/dev/shots.mjs "dev/viewer.html?mode=heroes" out.png [w] [h]
 * Serves three.js from dev/package when present (no CDN access needed).
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = path.join(HERE, 'package');
const BASE = process.env.BASE ?? 'http://127.0.0.1:8050';
const [, , page0 = 'index.html', out = 'shot.png', w = 1200, h = 800] = process.argv;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: +(process.env.DPR || 1), hasTouch: !!process.env.TOUCH, isMobile: !!process.env.TOUCH });
const page = await ctx.newPage();
await page.route('https://unpkg.com/**', (route) => {
    const rel = new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, '');
    const file = path.join(PKG, rel);
    if (!fs.existsSync(file)) return route.abort();
    route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
});
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await page.route('https://fonts.gstatic.com/**', (r) => r.abort());
page.on('console', (m) => { if (m.type() === 'error' || process.env.VERBOSE) console.log('console.' + m.type(), m.text()); });
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto(`${BASE}/game-051/${page0}`);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 }).catch((e) => console.log('timeout waiting for __ready'));
if (process.env.EVAL) await page.evaluate(process.env.EVAL);
await page.waitForTimeout(+(process.env.WAIT || 300));
await page.screenshot({ path: out });
await browser.close();
console.log('saved', out);

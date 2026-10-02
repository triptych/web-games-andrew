/**
 * shots.mjs — one screenshot of the game, for eyeballing.
 *   node game-053/dev/shots.mjs out.png [width] [height]
 * Env: BASE (default http://127.0.0.1:8053), START=0 stays on the title,
 * EVAL='js' runs in the page after starting, WAIT=ms, Q=high|low|off.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? path.join(HERE, 'package');
const BASE = process.env.BASE ?? 'http://127.0.0.1:8053';
const [out = 'shot.png', w = '1280', h = '800'] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1, hasTouch: +w < 760, isMobile: +w < 760 });
await ctx.addInitScript((q) => { try { localStorage.clear(); if (q) localStorage.setItem('jadewyrm.prefs', JSON.stringify({ quality: q })); } catch { /* */ } }, process.env.Q || 'high');
const page = await ctx.newPage();
if (fs.existsSync(PKG)) await page.route('https://unpkg.com/**', (route) => {
    const rel = new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, '');
    const file = path.join(PKG, rel);
    if (!fs.existsSync(file)) return route.abort();
    route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
});
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log('console.' + m.type() + ':', m.text()); });
page.on('pageerror', (e) => console.log('pageerror:', e.message, e.stack));
await page.goto(`${BASE}/game-053/index.html?debug=1&seed=shots`);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
if (process.env.START !== '0') {
    await page.evaluate(() => __jw.quickStart({ name: 'Rowan' }));
    await page.waitForTimeout(300);
    if (process.env.EVAL) await page.evaluate(process.env.EVAL);
}
await page.waitForTimeout(+(process.env.WAIT || 2500));
await page.screenshot({ path: out });
if (process.env.INFO) console.log(await page.evaluate(process.env.INFO));
await browser.close();

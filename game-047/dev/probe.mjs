// dev/probe.mjs — ad-hoc: run a JS snippet in the game (debug mode) and screenshot.
//   node game-047/dev/probe.mjs <out.png> <w> <h> "<setup js>" "<wait-for expr>" [extra ms]
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const [, , out, W, H, setup, waitExpr = 'true', extra = '600'] = process.argv;
const PKG = process.env.THREE_PKG;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: +W, height: +H }, ...(process.env.TOUCH ? { hasTouch: true, isMobile: true } : {}) });
await ctx.addInitScript(() => { try { localStorage.clear(); localStorage.setItem('ashes-aces-settings', JSON.stringify({ quality: '1', speed: '2.2' })); } catch {} });
const page = await ctx.newPage();
if (PKG) await page.route('https://unpkg.com/**', (route) => {
    const f = path.join(PKG, new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, ''));
    if (!fs.existsSync(f)) return route.abort();
    route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(f) });
});
page.on('console', (m) => { if (m.type() === 'error' || process.env.VERBOSE) console.log('console.' + m.type(), m.text()); });
page.on('pageerror', (e) => console.log('PAGEERROR', e.message, e.stack?.split('\n').slice(0, 3).join(' | ')));
await page.goto('http://127.0.0.1:8047/game-047/index.html?debug=1');
await page.waitForFunction('window.__aa', null, { timeout: 60000 });
if (setup) await page.evaluate(setup);
await page.waitForFunction(waitExpr, null, { timeout: 120000 }).catch(() => console.log('wait timed out'));
await page.waitForTimeout(+extra);
await page.screenshot({ path: out });
if (process.env.EVAL) console.log(await page.evaluate(process.env.EVAL));
await browser.close();

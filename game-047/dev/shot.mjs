// dev/shot.mjs — screenshot a dev page (or the game) with three.js served from a local npm pack.
//   node game-047/dev/shot.mjs <path-under-repo> <out.png> [w] [h] [waitExpr]
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
const [, , rel, out, W = 1400, H = 900, waitExpr = 'window.__done'] = process.argv;
const PKG = process.env.THREE_PKG;
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: +W, height: +H } });
if (PKG) await page.route('https://unpkg.com/**', (route) => {
    const f = path.join(PKG, new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, ''));
    if (!fs.existsSync(f)) return route.abort();
    route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(f) });
});
page.on('console', (m) => console.log('console.' + m.type(), m.text()));
page.on('pageerror', (e) => console.log('PAGEERROR', e.message));
await page.goto(`http://127.0.0.1:8047/${rel}`);
await page.waitForFunction(waitExpr, null, { timeout: 120000 }).catch(() => console.log('wait timed out'));
await page.waitForTimeout(+(process.env.EXTRA ?? 300));
await page.screenshot({ path: out });
await browser.close();

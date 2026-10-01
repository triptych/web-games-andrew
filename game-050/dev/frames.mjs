/** frames.mjs — a burst of screenshots from one page state (dev aid). EVAL runs first. */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = path.join(HERE, 'package');
const [, , out = 'f', w = 1100, hh = 650, n = 8, gap = 500] = process.argv;
const b = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await b.newPage({ viewport: { width: +w, height: +hh } });
await page.route('https://unpkg.com/**', (route) => { const rel = new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, ''); route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(PKG, rel)) }); });
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
page.on('pageerror', (e) => console.log('pageerror', e.message));
await page.goto('http://127.0.0.1:8050/game-050/index.html?debug=1');
await page.waitForFunction(() => window.__ready === true, null, { timeout: 60000 });
if (process.env.EVAL) await page.evaluate(process.env.EVAL);
await page.waitForTimeout(+(process.env.WAIT || 1500));
const files = [];
for (let i = 0; i < +n; i++) { const f = `${out}-${i}.png`; await page.screenshot({ path: f }); files.push(f); await page.waitForTimeout(+gap); }
await b.close();
console.log(files.join(' '));

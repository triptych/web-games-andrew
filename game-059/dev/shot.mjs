/** shot.mjs — screenshot dev/viewtest.html: node shot.mjs "stage=0&t=20" name [w h] */
import { chromium } from 'playwright';
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = path.join(HERE, '../../dev/package');
const [qs = 'stage=0', name = 'view', W = 1280, H = 720] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: +W, height: +H } });
await page.route('https://unpkg.com/**', (route) => { const rel = new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, ''); route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(PKG, rel)) }); });
const errs = [];
page.on('console', (m) => { if (m.type() === 'error') errs.push(m.text()); });
page.on('pageerror', (e) => errs.push(e.message));
await page.goto(`http://127.0.0.1:8059/game-059/dev/viewtest.html?${qs}`);
await page.waitForFunction(() => window.__ready, null, { timeout: 60000 }).catch(() => {});
await page.waitForTimeout(+(process.env.WAIT || 1500));
fs.mkdirSync(path.join(HERE, 'shots'), { recursive: true });
await page.screenshot({ path: path.join(HERE, 'shots', name + '.png') });
if (errs.length) console.log('ERRORS:\n' + errs.join('\n'));
await browser.close();

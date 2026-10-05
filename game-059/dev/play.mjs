/** play.mjs — open the real game (?debug=1), run a script of steps, screenshot. node play.mjs name "js expression run after boot" [wait] [w h] [touch] */
import { chromium } from 'playwright';
import fs from 'node:fs'; import path from 'node:path'; import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = path.join(HERE, '../../dev/package');
const [name = 'game', script = '', wait = 1500, W = 1280, H = 720, touch = ''] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: +W, height: +H }, hasTouch: !!touch, isMobile: !!touch });
const page = await ctx.newPage();
await page.route('https://unpkg.com/**', (route) => { const rel = new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, ''); route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(path.join(PKG, rel)) }); });
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
const errs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(m.type() + ': ' + m.text()); });
page.on('pageerror', (e) => errs.push('pageerror: ' + e.message + '\n' + e.stack));
await page.goto(`http://127.0.0.1:8059/game-059/index.html?debug=1`);
await page.waitForFunction(() => window.__sc && __sc.mode === 'title', null, { timeout: 90000 }).catch(() => errs.push('timeout waiting for title'));
if (script) { try { await page.evaluate('(async () => {' + script + '})()'); } catch (e) { errs.push('script: ' + e.message); } }
await page.waitForTimeout(+wait);
await page.screenshot({ path: path.join(HERE, 'shots', name + '.png') });
const info = await page.evaluate(() => window.__sc ? { mode: __sc.mode, hp: __sc.world && __sc.world.player.hp } : null).catch(() => null);
console.log(JSON.stringify(info));
if (errs.length) console.log(errs.slice(0, 15).join('\n'));
await browser.close();

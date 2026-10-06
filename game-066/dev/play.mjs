/**
 * play.mjs — drive the game in headless Chromium for quick looks and debugging.
 *   node game-066/dev/play.mjs "index.html?debug=1&quick=1" script.js [w h]
 * script.js is the body of an async function (page, shot, wait, key, rt) run after boot:
 *   await key('ArrowRight', 400); await shot('walk'); const s = await rt('app.mode');
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8066';
const [page0 = 'index.html?debug=1', script = '', w = '1280', h = '800'] = process.argv.slice(2);
fs.mkdirSync(path.join(HERE, 'shots'), { recursive: true });
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const touch = process.env.TOUCH === '1';
const page = await browser.newPage({ viewport: { width: +w, height: +h }, hasTouch: touch, isMobile: touch, deviceScaleFactor: +(process.env.DPR || 1) });
await page.route('https://unpkg.com/**', (route) => {
    const rel = new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, '');
    const file = path.join(PKG, rel);
    if (!fs.existsSync(file)) return route.abort();
    route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
});
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning' || process.env.LOG) console.log(m.type(), m.text().slice(0, 400)); });
page.on('pageerror', (e) => console.log('pageerror', e.message, e.stack?.split('\n').slice(0, 3).join(' | ')));
await page.goto(`${BASE}/game-066/${page0}`);
await page.waitForFunction('(window.__frames || 0) >= 3', null, { timeout: 120000 });
const wait = (ms) => page.waitForTimeout(ms);
const shot = async (n) => { await page.screenshot({ path: path.join(HERE, 'shots', `${n}.png`) }); console.log('shot', n); };
const key = async (k, hold = 60) => { await page.keyboard.down(k); await wait(hold); await page.keyboard.up(k); };
const rt = (expr) => page.evaluate(`(() => { const rt = window.__rt; const app = rt.app; const g = app.game; return ${expr}; })()`);
const body = script && fs.existsSync(script) ? fs.readFileSync(script, 'utf8') : script;
const AsyncFn = Object.getPrototypeOf(async () => {}).constructor;
try { await new AsyncFn('page', 'shot', 'wait', 'key', 'rt', body)(page, shot, wait, key, rt); }
catch (e) { console.log('script error', e.message); }
await browser.close();

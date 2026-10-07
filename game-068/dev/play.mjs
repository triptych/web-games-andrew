/**
 * play.mjs — open the real game and run a snippet against it, for poking at things and screenshots.
 *
 *   node game-068/dev/play.mjs "index.html?debug=1" script.js [width height]
 *
 * script.js is the body of an async function given (page, shot, wait, tt): `tt('expr')` evaluates
 * with `tt` bound to window.__hr. TOUCH=1 for a touch phone, LOG=1 echoes the console.
 * Needs a static server on BASE (default http://127.0.0.1:8068) from the repo root.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8068';
const [, , url = 'index.html?debug=1', scriptFile, w = '1280', hgt = '760'] = process.argv;
const OUT = path.join(HERE, 'shots');
fs.mkdirSync(OUT, { recursive: true });
const touch = !!process.env.TOUCH;

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: Number(w), height: Number(hgt) }, deviceScaleFactor: touch ? 2 : 1, hasTouch: touch, isMobile: touch });
const page = await ctx.newPage();
if (PKG) await page.route('https://unpkg.com/**', (route) => {
    const rel = new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, '');
    const file = path.join(PKG, rel);
    if (!fs.existsSync(file)) return route.abort();
    route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
});
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
page.on('console', (m) => { if (process.env.LOG || m.type() === 'error') console.log(`[${m.type()}] ${m.text()}`); });
page.on('pageerror', (e) => console.log(`[pageerror] ${e.message}\n${e.stack}`));
await page.goto(`${BASE}/game-068/${url}`);
await page.waitForFunction(() => window.__hr && window.__hr.app.frameNo > 2, null, { timeout: 120000 });
const shot = (name) => page.screenshot({ path: path.join(OUT, `${name}.png`) });
const wait = (ms) => page.waitForTimeout(ms);
const tt = (expr) => page.evaluate(`(() => { const tt = window.__hr; return (${expr}); })()`);
if (scriptFile) {
    const body = fs.readFileSync(scriptFile, 'utf8');
    const fn = new Function('page', 'shot', 'wait', 'tt', `return (async () => { ${body} })();`);
    await fn(page, shot, wait, tt);
} else {
    await wait(1500);
    await shot('play');
}
await browser.close();

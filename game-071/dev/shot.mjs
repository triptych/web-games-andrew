/**
 * shot.mjs — open the real game in Chromium and take screenshots.
 *
 *   node game-071/dev/shot.mjs name "js;;WAIT:ms;;SHOT:x;;KEY:Down:KeyW;;UNTIL:expr" [w h] [touch] [query]
 *
 * Snippets run with `F` = window.__fm (the app). Screenshots go to game-071/dev/shots/.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8071';
const OUT = path.join(HERE, 'shots');
fs.mkdirSync(OUT, { recursive: true });
const [name = 'shot', script = '', w = '1280', h = '720', touch = '', query = ''] = process.argv.slice(2);

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const isTouch = touch === 'touch';
const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1, hasTouch: isTouch, isMobile: isTouch });
const page = await ctx.newPage();
if (PKG) await page.route('https://unpkg.com/**', (route) => {
    const rel = new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, '');
    const file = path.join(PKG, rel);
    if (!fs.existsSync(file)) return route.abort();
    route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
});
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
const errs = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errs.push(`${m.type()}: ${m.text().slice(0, 3000)}`); });
page.on('pageerror', (e) => errs.push(`pageerror: ${e.message}\n${e.stack}`));
const t0 = Date.now();
await page.goto(`${BASE}/game-071/index.html?debug=1${query ? '&' + query : ''}`);
await page.waitForFunction('window.__fm && window.__fm.mode !== "loading"', null, { timeout: 180000 }).catch(() => errs.push('timeout waiting for boot'));
console.log('booted in', ((Date.now() - t0) / 1000).toFixed(1), 's');
let n = 0;
for (const part of script.split(';;').map((s) => s.trim()).filter(Boolean)) {
    if (part.startsWith('WAIT:')) await page.waitForTimeout(+part.slice(5));
    else if (part.startsWith('SHOT:')) { await page.screenshot({ path: path.join(OUT, `${name}-${part.slice(5)}.png`), timeout: 240000 }); n++; }
    else if (part.startsWith('KEY:')) { const [, act, key] = part.split(':'); if (act === 'Down') await page.keyboard.down(key); else if (act === 'Up') await page.keyboard.up(key); else await page.keyboard.press(key); }
    else if (part.startsWith('CLICK:')) await page.click(part.slice(6));
    else if (part.startsWith('UNTIL:')) await page.waitForFunction(`(() => { const F = window.__fm; return ${part.slice(6)}; })()`, null, { timeout: 120000, polling: 200 });
    else { const r = await page.evaluate(`(() => { const F = window.__fm; ${part} })()`); if (r !== undefined) console.log('=>', typeof r === 'string' ? r : JSON.stringify(r)); }
}
if (!n) await page.screenshot({ path: path.join(OUT, `${name}.png`), timeout: 240000 });
const dbg = await page.evaluate(() => document.getElementById('debug-info')?.textContent || '');
console.log(dbg);
if (errs.length) { const uniq = [...new Set(errs)]; console.log('ERRORS (' + errs.length + '):\n' + uniq.slice(0, 12).join('\n')); }
await browser.close();

/**
 * shot.mjs — open the game in real Chromium with ?debug=1, run snippets, take screenshots.
 *   node game-069/dev/shot.mjs name "js;;WAIT:ms;;SHOT:x;;KEY:Down:KeyW;;KEY:Up:KeyW;;CLICK:#sel" [w h] [touch] [query]
 * `S` inside snippets is window.__dc. Prints console errors.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8069';
const OUT = path.join(HERE, 'shots');
fs.mkdirSync(OUT, { recursive: true });
const [name = 'shot', script = '', w = '1280', h = '760', touch = '', query = ''] = process.argv.slice(2);
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: touch ? 2 : 1, hasTouch: !!touch, isMobile: !!touch });
const page = await ctx.newPage();
if (PKG) await page.route('https://unpkg.com/**', (route) => {
    const rel = new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, '');
    const file = path.join(PKG, rel);
    if (!fs.existsSync(file)) return route.abort();
    route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
});
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message} ${(e.stack || '').split('\n').slice(1, 3).join(' ')}`));
await page.goto(`${BASE}/game-069/index.html?debug=1&${query}`);
await page.waitForFunction('window.__dc && window.__dcApp.mode !== "loading"', null, { timeout: 120000 });
let n = 0;
for (const part of script.split(';;').map((s) => s.trim()).filter(Boolean)) {
    if (part.startsWith('WAIT:')) await page.waitForTimeout(+part.slice(5));
    else if (part.startsWith('SHOT:')) { await page.screenshot({ path: path.join(OUT, `${name}-${part.slice(5)}.png`) }); n++; }
    else if (part.startsWith('KEY:')) { const [, dir, code] = part.split(':'); if (dir === 'Down') await page.keyboard.down(code); else if (dir === 'Up') await page.keyboard.up(code); else await page.keyboard.press(code); }
    else if (part.startsWith('CLICK:')) await page.click(part.slice(6));
    else if (part.startsWith('TAP:')) await page.tap(part.slice(4));
    else if (part.startsWith('UNTIL:')) await page.waitForFunction(`(() => { const S = window.__dc; return ${part.slice(6)}; })()`, null, { timeout: 120000, polling: 200 });
    else { const r = await page.evaluate(`(() => { const S = window.__dc; ${part} })()`); if (r !== undefined) console.log('=>', JSON.stringify(r)); }
}
if (!n) await page.screenshot({ path: path.join(OUT, `${name}.png`) });
console.log(errors.length ? errors.join('\n') : 'no errors');
await browser.close();

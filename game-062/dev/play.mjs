/**
 * play.mjs — open the real game with ?debug=1, run JS snippets (S = window.__rt) with a pause
 * between them, take SHOT:name screenshots along the way and a final one.
 *
 *   node game-062/dev/play.mjs name "js;;js;;SHOT:x;;js" [waitMs] [w h] [touch] [query]
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8062';
const OUT = path.join(HERE, 'shots');
fs.mkdirSync(OUT, { recursive: true });
const [name = 'play', script = '', wait = '1500', w = '1280', h = '760', touch = '', query = ''] = process.argv.slice(2);

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const isTouch = touch === 'touch';
const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1, hasTouch: isTouch, isMobile: isTouch });
await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('rt-init')) { sessionStorage.setItem('rt-init', '1'); localStorage.clear(); localStorage.setItem('rttc.v1.settings', JSON.stringify({ muted: true, quality: '1' })); } } catch { /* blocked */ } });
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
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}\n${e.stack}`));
page.on('requestfailed', (r) => errors.push(`requestfailed: ${r.url()}`));
await page.goto(`${BASE}/game-062/index.html?debug=1${query ? '&' + query : ''}`);
await page.waitForTimeout(+wait);
for (const part of script.split(';;').map((s) => s.trim()).filter(Boolean)) {
    if (part.startsWith('SHOT:')) { await page.screenshot({ path: path.join(OUT, `${name}-${part.slice(5)}.png`) }); continue; }
    if (part.startsWith('WAIT:')) { await page.waitForTimeout(+part.slice(5)); continue; }
    if (part.startsWith('CLICK:')) { await page.click(part.slice(6)); await page.waitForTimeout(300); continue; }
    if (part.startsWith('MCLICK:')) { const [x, y] = part.slice(7).split(',').map(Number); await page.mouse.move(x, y); await page.mouse.down(); await page.waitForTimeout(80); await page.mouse.up(); await page.waitForTimeout(+wait); continue; }
    if (part.startsWith('KEY:')) { await page.keyboard.press(part.slice(4)); await page.waitForTimeout(200); continue; }
    try {
        const r = await page.evaluate(`(async () => { const S = window.__rt; ${part} })()`);
        if (r !== undefined) console.log('>', JSON.stringify(r).slice(0, 2000));
    } catch (e) { console.log('! eval error:', e.message.slice(0, 500)); }
    await page.waitForTimeout(+wait);
}
await page.screenshot({ path: path.join(OUT, `${name}.png`) });
if (errors.length) console.log(errors.slice(0, 20).join('\n'));
await browser.close();

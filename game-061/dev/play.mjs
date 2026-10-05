/**
 * play.mjs — open the real game with ?debug=1, run a snippet, screenshot.
 *
 *   node game-061/dev/play.mjs name "js after boot" [waitMs] [w h] [touch] [query]
 *
 * The snippet runs in the page with `S` = window.__sw. Steps separated by ';;' run with
 * `waitMs` between them. Screenshot goes to game-061/dev/shots/<name>.png.
 * Needs a static server on BASE (default http://127.0.0.1:8061) from the repo root.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8061';
const OUT = path.join(HERE, 'shots');
fs.mkdirSync(OUT, { recursive: true });
const [name = 'shot', code = '', waitMs = '1500', w = '1280', hh = '760', touch = '', query = ''] = process.argv.slice(2);

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: +w, height: +hh }, deviceScaleFactor: 1, hasTouch: !!touch, isMobile: !!touch });
await ctx.addInitScript(() => { try { localStorage.setItem('starwright.v1.settings', JSON.stringify({ muted: true, quality: '2', tips: true })); } catch { /* */ } });
const page = await ctx.newPage();
if (PKG) {
    await page.route('https://unpkg.com/**', (route) => {
        const rel = new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, '');
        const file = path.join(PKG, rel);
        if (!fs.existsSync(file)) return route.abort();
        route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
    });
}
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
const errors = [];
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`${m.type()}: ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}\n${e.stack}`));
await page.goto(`${BASE}/game-061/index.html?debug=1${query ? '&' + query : ''}`);
await page.waitForFunction(() => window.__sw && window.__sw.world, null, { timeout: 30000 });
await page.waitForTimeout(800);
for (const step of code.split(';;').filter((s) => s.trim())) {
    const r = await page.evaluate(`(async () => { const S = window.__sw; ${step} })()`).catch((e) => `ERR ${e.message}`);
    if (r !== undefined) console.log('→', typeof r === 'string' ? r : JSON.stringify(r));
    await page.waitForTimeout(+waitMs);
}
await page.screenshot({ path: path.join(OUT, `${name}.png`) });
console.log(errors.length ? errors.join('\n') : 'no errors');
await browser.close();

/**
 * play.mjs — open the real game with ?debug=1, run a snippet, screenshot.
 *
 *   node game-069/dev/play.mjs <name> "<js run after boot>" [waitMs] [w h] [touch]
 *
 * The snippet runs in the page; window.__pp is the debug hook (see js/main.js).
 * Screenshots go to game-069/dev/shots/<name>.png. Console errors are printed.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8069';
const OUT = path.join(HERE, 'shots');
fs.mkdirSync(OUT, { recursive: true });
const [name = 'shot', code = '', wait = '1500', w = '1280', h = '800', touch = ''] = process.argv.slice(2);

const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1, hasTouch: !!touch, isMobile: !!touch });
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
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log(`[${m.type()}]`, m.text()); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`${BASE}/game-069/index.html?debug=1`);
await page.waitForFunction(() => window.__pp, null, { timeout: 30000 });
if (code) { const r = await page.evaluate(code); if (r !== undefined) console.log('result:', JSON.stringify(r)); }
await page.waitForTimeout(+wait);
await page.screenshot({ path: path.join(OUT, `${name}.png`) });
console.log('saved', path.join(OUT, `${name}.png`));
await browser.close();

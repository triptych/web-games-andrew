/**
 * cindertest.mjs — drives Cinderpeak in real Chromium: link to the cove, board the
 * cart, jump the ride along (setting mine.s) through the cut into the mine, to the
 * cliff, step out, board again, ride out to the station, and take the dais home.
 * Fails on any console error or page error. Needs ?debug (the harness handle).
 *
 *   python3 -m http.server 8077            # from the REPO ROOT
 *   node garden/dev/cindertest.mjs
 *
 * Env: BASE, THREE_PKG (see browsertest.mjs).
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? path.join(HERE, 'package');
const BASE = process.env.BASE ?? 'http://127.0.0.1:8077';
const errors = [];
const check = (cond, msg) => {
    if (!cond) throw new Error('FAILED: ' + msg);
    console.log('  ok  ' + msg);
};
const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
});
const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
await ctx.addInitScript(() => localStorage.clear());
const page = await ctx.newPage();
if (fs.existsSync(PKG)) {
    await ctx.route('https://unpkg.com/**', (route) => {
        const rel = new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, '');
        const file = path.join(PKG, rel);
        if (!fs.existsSync(file)) return route.abort();
        route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
    });
}
await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.fulfill({ status: 200, contentType: 'text/css', body: '' }));
page.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text()));
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message));

const G = (expr) => page.evaluate(`(() => { const g = window.__garden; return ${expr}; })()`);
const until = (expr, timeout = 240000) => page.waitForFunction(`(() => { const g = window.__garden; return ${expr}; })()`, null, { timeout });

await page.goto(`${BASE}/index.html?debug&enter&bigdt&pr=0.4&q=low&t=0.4`);
await until('g?.entered', 180000);
check(await G('g.place') === 'garden', 'starts in the garden');
await G('g.travelToCove()');
await until("g.place === 'cove'");
check(await G('!!g.mine'), 'the mine is built on arrival');
await G('g.boardCart(1)');
await until("g.mine.state === 'riding'");
await G('g.mine.s = 30');
await until("g.place === 'mine' && g.below");
check(true, 'the cart carries you into the mountain');
await G('g.mine.s = 1235');
await until("g.mine.state === 'free'");
check(await G('!g.controls.seated'), 'you can walk on the cliff');
await G('g.boardCart(-1)');
await until("g.mine.state === 'riding'");
await G('g.mine.s = 45');
await until("g.place === 'cove' && !g.below");
await G('g.mine.s = 12');
await until("g.mine.state === 'free'");
check(await G('g.place') === 'cove' && await G('!g.controls.seated'), 'back at the station');
await G('g.travelToGarden()');
await until("g.place === 'garden'");
check(true, 'the dais leads home');
check(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
await browser.close();

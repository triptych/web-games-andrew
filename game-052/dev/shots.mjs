/**
 * shots.mjs — one screenshot (or a few) of Nightline in real Chromium.
 *
 *   python3 -m http.server 8050                      # from the repo root
 *   node game-052/dev/shots.mjs out.png [width] [height]
 *
 * EVAL='…' runs code in the page first (with ?debug=1, `__nl` holds the hooks),
 * WAIT=ms waits after it, START=0 stays on the title screen, Q=lofi|mid|hi sets
 * the resolution preset. Fails on any console or page error.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? path.join(HERE, 'package');
const BASE = process.env.BASE ?? 'http://127.0.0.1:8050';
const out = process.argv[2] ?? path.join(HERE, 'shots', 'shot.png');
const w = +(process.argv[3] ?? 1280), h = +(process.argv[4] ?? 720);
fs.mkdirSync(path.dirname(out), { recursive: true });

const errors = [];
const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
});
const ctx = await browser.newContext({ viewport: { width: w, height: h }, deviceScaleFactor: 1 });
const page = await ctx.newPage();
if (fs.existsSync(PKG)) {
    await page.route('https://unpkg.com/**', (route) => {
        const rel = new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, '');
        const file = path.join(PKG, rel);
        if (!fs.existsSync(file)) return route.abort();
        route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
    });
}
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`console.${m.type()}: ${m.text()}`); else if (process.env.VERBOSE) console.log('  ', m.text()); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}\n${e.stack}`));
await page.addInitScript((q) => { try { localStorage.setItem('nightline-settings', JSON.stringify({ res: q })); } catch { /* */ } }, process.env.Q || 'lofi');
await page.goto(`${BASE}/game-052/index.html?debug=1&seed=${process.env.SEED || 'demo'}`);
await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
if (process.env.START !== '0') {
    await page.keyboard.press('KeyX');
    await page.waitForTimeout(400);
}
if (process.env.EVAL) await page.evaluate(process.env.EVAL);
await page.waitForTimeout(+(process.env.WAIT || 2500));
await page.screenshot({ path: out });
console.log('wrote', out);
if (process.env.INFO) console.log(await page.evaluate(process.env.INFO));
await browser.close();
if (errors.length) { console.log(errors.join('\n')); process.exit(1); }

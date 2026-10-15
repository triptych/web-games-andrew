/**
 * play.mjs — open the real game, run a snippet, take a screenshot. For iterating on visuals.
 *
 *   node game-080/dev/play.mjs <name> "<js run after boot>" [waitMs] [w h] [touch]
 *   node game-080/dev/play.mjs start "__el.start(3); __el.ff(30); return __el.G.lvl" 800
 *   node game-080/dev/play.mjs phone "__el.start(3)" 800 390 844 touch
 *
 * The snippet runs with ?debug=1, so window.__el is there (see dev/README.md). It is the body of
 * an async function: `return` a value to print it. Q='&fast=4' adds URL parameters.
 * Screenshot: game-080/dev/shots/<name>.png.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8080';
const [name = 'shot', code = '', wait = '1000', w = '1280', h = '760', touch = ''] = process.argv.slice(2);
fs.mkdirSync(path.join(HERE, 'shots'), { recursive: true });

const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
});
const isTouch = touch === 'touch';
const page = await (await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1, hasTouch: isTouch, isMobile: isTouch })).newPage();
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await page.route('https://fonts.gstatic.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log(`[${m.type()}]`, m.text()); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`${BASE}/game-080/index.html?debug=1${process.env.Q || ''}`);
await page.waitForFunction(() => window.__el, null, { timeout: 60000 });
if (code) {
    const out = await page.evaluate(`(async () => { ${code} })()`);
    if (out !== undefined) console.log(JSON.stringify(out, null, 1));
}
await page.waitForTimeout(+wait);
await page.screenshot({ path: path.join(HERE, 'shots', `${name}.png`) });
console.log('shot', path.join('dev/shots', `${name}.png`));
await browser.close();

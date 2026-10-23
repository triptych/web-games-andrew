/**
 * play.mjs — open the real game, run a snippet, take a screenshot. For iterating on visuals.
 *
 *   node game-094/dev/play.mjs <name> "<js run after boot>" [waitMs] [w h] [touch]
 *   node game-094/dev/play.mjs start "__lh.start(3); __lh.ff(12); return __lh.G.node" 300
 *   node game-094/dev/play.mjs phone "__lh.start(3); __lh.ff(6)" 300 390 844 touch
 *
 * The snippet runs with ?debug=1, so window.__lh is there (see dev/README.md). It is the body of an
 * async function: `return` a value to print it. Q='&fast=20' adds URL parameters.
 * Screenshot: game-094/dev/shots/<name>.png.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8094';
const [name = 'shot', code = '', wait = '500', w = '1280', h = '760', touch = ''] = process.argv.slice(2);
fs.mkdirSync(path.join(HERE, 'shots'), { recursive: true });

const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
});
const isTouch = touch === 'touch';
const page = await (await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1, hasTouch: isTouch, isMobile: isTouch })).newPage();
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log(`[${m.type()}]`, m.text()); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`${BASE}/game-094/index.html?debug=1${process.env.Q || ''}`);
await page.waitForFunction(() => window.__lh, null, { timeout: 30000 });
if (code) {
    const out = await page.evaluate(`(async () => { ${code} })()`);
    if (out !== undefined) console.log(JSON.stringify(out, null, 1));
}
await page.waitForTimeout(+wait);
await page.screenshot({ path: path.join(HERE, 'shots', `${name}.png`) });
console.log('shot', path.join('game-094/dev/shots', `${name}.png`));
await browser.close();

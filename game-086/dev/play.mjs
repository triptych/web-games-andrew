/**
 * play.mjs — open the game with ?debug=1&fasttext, run a snippet, screenshot dev/shots/<name>.png.
 *
 *   node game-086/dev/play.mjs name "js" [waitMs] [w h] [touch]
 *   node game-086/dev/play.mjs paint "__cv.finish('wick'); __cv.startPage('comet')" 800 390 844 touch
 *
 * The snippet runs in the page; `return x` prints x. Fails on any page or console error.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8086';
const [name = 'play', code = '', wait = '600', w = '1280', h = '760', touch = ''] = process.argv.slice(2);
fs.mkdirSync(path.join(HERE, 'shots'), { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, hasTouch: !!touch, isMobile: !!touch, deviceScaleFactor: touch ? 2 : 1 });
const page = await ctx.newPage();
await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
let bad = 0;
page.on('pageerror', (e) => { bad++; console.log('[pageerror]', e.message, process.env.STACK ? e.stack : ''); });
page.on('console', (m) => { if (m.type() === 'error') { bad++; console.log('[error]', m.text()); } else if (process.env.LOG) console.log('[log]', m.text()); });
await page.goto(`${BASE}/game-086/index.html?debug=1&fasttext`);
await page.waitForFunction(() => window.__cv);
if (code) {
    const out = await page.evaluate(`(async () => { ${code} })()`);
    if (out !== undefined) console.log(JSON.stringify(out, null, 1));
}
await page.waitForTimeout(+wait);
await page.screenshot({ path: path.join(HERE, 'shots', `${name}.png`) });
console.log('shot', `dev/shots/${name}.png`);
await browser.close();
process.exit(bad ? 1 : 0);

/**
 * play.mjs — open the real game, run a snippet, take a screenshot. For iterating on a room.
 *
 *   node game-087/dev/play.mjs <name> "<js run after boot>" [waitMs] [w h] [touch]
 *   node game-087/dev/play.mjs hall "__qs.quickStart('Wren')" 500
 *   node game-087/dev/play.mjs loft "__qs.quickStart(); __qs.A.setFreePen(__qs.S, true, __qs.app.ctx()); __qs.go('loft')" 800 390 844 touch
 *
 * The snippet runs with ?debug=1&fasttext, so window.__qs is there (see dev/README.md). It is the body of
 * an async function: `return` a value to print it. Screenshot: game-087/dev/shots/<name>.png.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8087';
const [name = 'shot', code = '', wait = '600', w = '1280', h = '800', touch = ''] = process.argv.slice(2);
fs.mkdirSync(path.join(HERE, 'shots'), { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined });
const isTouch = touch === 'touch';
const page = await (await browser.newContext({ viewport: { width: +w, height: +h }, hasTouch: isTouch, isMobile: isTouch })).newPage();
await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log(`[${m.type()}]`, m.text()); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`${BASE}/game-087/index.html?debug=1&fasttext`);
await page.waitForFunction(() => window.__qs, null, { timeout: 20000 });
if (code) {
    const out = await page.evaluate(`(async () => { ${code} })()`);
    if (out !== undefined) console.log(JSON.stringify(out, null, 1));
}
await page.waitForTimeout(+wait);
await page.screenshot({ path: path.join(HERE, 'shots', `${name}.png`) });
console.log('shot', path.join('dev/shots', `${name}.png`));
await browser.close();

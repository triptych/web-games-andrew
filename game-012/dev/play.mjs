/**
 * play.mjs — open Arcana Pull with ?debug=1, run a snippet, take a screenshot. For looking, not testing.
 *
 *   node game-012/dev/play.mjs name "js" [waitMs] [w h] [touch]
 *
 * The snippet runs in the page (window.__ap is the debug hook); `return x` prints x. Screenshot: dev/shots/<name>.png.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, serve, BASE } from './serve.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const [name = 'play', js = '', wait = '600', w = '1280', h = '760', touch] = process.argv.slice(2);
fs.mkdirSync(path.join(HERE, 'shots'), { recursive: true });
const browser = await launch();
const ctx = await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1, hasTouch: !!touch, isMobile: !!touch });
const page = await ctx.newPage();
await serve(page);
page.on('console', (m) => { if (m.type() === 'error') console.log('console:', m.text()); });
page.on('pageerror', (e) => console.log('pageerror:', e.message));
page.on('response', (r) => { if (r.status() >= 400) console.log(r.status(), r.url()); });
await page.goto(`${BASE}/game-012/index.html?debug=1`);
await page.waitForFunction(() => window.__ap && window.__ap.frames > 2);
if (js) {
    const out = await page.evaluate(`(async () => { ${js} })()`);
    if (out !== undefined) console.log(JSON.stringify(out, null, 1));
}
await page.waitForTimeout(+wait);
await page.screenshot({ path: path.join(HERE, 'shots', name + '.png') });
await browser.close();

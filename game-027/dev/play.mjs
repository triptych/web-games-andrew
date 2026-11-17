/**
 * play.mjs — open the real game, run a snippet, take a screenshot. For iterating on visuals.
 *
 *   node game-027/dev/play.mjs <name> "<js run after boot>" [waitMs] [w h] [touch]
 *   node game-027/dev/play.mjs map "__al.start(3); __al.skipScenes()" 1500
 *   node game-027/dev/play.mjs level "__al.start(3); __al.skipScenes(); __al.go('n0_0'); __al.skipScenes()" 2000
 *   node game-027/dev/play.mjs phone "__al.start(3)" 1500 390 844 touch
 *
 * The snippet runs with ?debug=1, so window.__al is there (see dev/README.md). It is the body of an
 * async function: `return` a value to print it. Q='&fast=4' adds URL parameters.
 * Screenshot: game-027/dev/shots/<name>.png. The repo is served from disk (serve.mjs).
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, serve, BASE } from './serve.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const [name = 'shot', code = '', wait = '1000', w = '1280', h = '760', touch = ''] = process.argv.slice(2);
fs.mkdirSync(path.join(HERE, 'shots'), { recursive: true });

const browser = await launch();
const isTouch = touch === 'touch';
const page = await (await browser.newContext({ viewport: { width: +w, height: +h }, deviceScaleFactor: 1, hasTouch: isTouch, isMobile: isTouch })).newPage();
await serve(page);
page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') console.log(`[${m.type()}]`, m.text()); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('requestfailed', (r) => console.log('[requestfailed]', r.url()));
await page.goto(`${BASE}/game-027/index.html?debug=1${process.env.Q || ''}`);
await page.waitForFunction(() => window.__al && window.__al.frames > 2, null, { timeout: 60000 });
if (code) {
    const out = await page.evaluate(`(async () => { ${code} })()`);
    if (out !== undefined) console.log(JSON.stringify(out, null, 1));
}
await page.waitForTimeout(+wait);
await page.screenshot({ path: path.join(HERE, 'shots', `${name}.png`) });
console.log('shot', path.join('dev/shots', `${name}.png`));
await browser.close();

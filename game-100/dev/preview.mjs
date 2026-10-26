/**
 * preview.mjs — the 1200×630 share and Garden Library picture: a board in Disco Fever, mid-combo.
 *
 * The generic dev/screenshots.mjs photographs whatever a game shows after a few key presses, which
 * for this game is the power screen. This one sets the picture up through the debug hooks: a
 * game in Dance-Off, the groove meter filled, the bot playing quickly, and a frame every 0.7 s.
 * It writes them to dev/shots/preview-<n>.jpg; copy the best to garden/img/games/game-100.jpg.
 *
 *   python3 -m http.server 8100          # from the REPO ROOT
 *   node game-100/dev/preview.mjs
 *   cp game-100/dev/shots/preview-4.jpg garden/img/games/game-100.jpg
 *
 * Env: BASE (default http://127.0.0.1:8100), FRAMES (default 8), THREE_PKG, PW_CHROMIUM_PATH.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8100';
const FRAMES = +(process.env.FRAMES || 8);
const OUT = path.join(HERE, 'shots');
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
});
const page = await (await browser.newContext({ viewport: { width: 1200, height: 630 } })).newPage();
if (PKG) {
    await page.route('https://unpkg.com/**', (r) => {
        const f = path.join(PKG, new URL(r.request().url()).pathname.replace(/^\/three@0\.165\.0\//, ''));
        return fs.existsSync(f) ? r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(f) }) : r.abort();
    });
}
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`${BASE}/game-100/index.html?debug=1&fast=3`);
await page.waitForFunction(() => window.__gg, null, { timeout: 60000 });
// the "← Games" link is page chrome, not part of the picture
await page.addStyleTag({ content: '#back-link{visibility:hidden!important}' });
await page.evaluate(() => { __gg.start('dance', 11); __gg.G.meter = 99; __gg.autoplay(true, 0.9); });
for (let i = 0; i < FRAMES; i++) {
    await page.waitForTimeout(700);
    await page.screenshot({ path: path.join(OUT, `preview-${i}.jpg`), type: 'jpeg', quality: 88 });
    console.log('frame', i);
}
await browser.close();

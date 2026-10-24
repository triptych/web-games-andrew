/**
 * shots.mjs — one browser, many screenshots: a gallery of the game in its states.
 *
 *   node game-096/dev/shots.mjs                      # every level, run ahead by the bot to a few moments
 *   LEVELS=l1_1,l4_1 SECS=6,14 node game-096/dev/shots.mjs
 *   W=390 H=844 TOUCH=1 node game-096/dev/shots.mjs
 *
 * Writes game-096/dev/shots/gal-<level>-<n>.png.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8096';
const W = +(process.env.W || 1280), H = +(process.env.H || 760), TOUCH = !!process.env.TOUCH;
const LEVELS = (process.env.LEVELS || 'l1_1,l1_2,l2_1,l2_2,l2_3,l3_1,l3_2,l4_1,l4_2,l4_3,l5_1,l5_2,l5_3,l5_4').split(',');
const SECS = (process.env.SECS || '4,12').split(',').map(Number);
fs.mkdirSync(path.join(HERE, 'shots'), { recursive: true });

const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
});
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, hasTouch: TOUCH, isMobile: TOUCH });
const page = await ctx.newPage();
if (PKG) {
    await page.route('https://unpkg.com/**', (route) => {
        const file = path.join(PKG, new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, ''));
        if (!fs.existsSync(file)) return route.abort();
        route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
    });
}
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
page.on('console', (m) => { if (m.type() === 'error') console.log(`[error]`, m.text()); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
await page.goto(`${BASE}/game-096/index.html?debug=1`);
await page.waitForFunction(() => window.__hh, null, { timeout: 60000 });

for (const id of LEVELS) {
    let t = 0;
    let n = 0;
    await page.evaluate((id) => { __hh.clearAll(); __hh.start(id); __hh.ui.closeAll(); document.getElementById('hud-banner').hidden = true; document.getElementById('hud-hint').hidden = true; if (__hh.ui.dlg) __hh.ui.dlgSkip(); }, id);
    for (const s of SECS) {
        await page.evaluate((d) => { __hh.ff(d); }, s - t); t = s;
        await page.waitForTimeout(700);
        await page.screenshot({ path: path.join(HERE, 'shots', `gal-${id}-${n++}.png`) });
    }
    console.log('shot', id);
}
await browser.close();

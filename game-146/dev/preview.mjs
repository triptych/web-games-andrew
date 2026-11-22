/**
 * preview.mjs — the 1200×630 picture the Garden's Library and share links use (garden/img/games/game-146.jpg).
 * Sets up a moment through the debug hooks: Reindeer Ridge, a few shots in, a power-up loaded, the guide showing.
 *
 *   python3 -m http.server 8146    # repo root
 *   node game-146/dev/preview.mjs
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '../..');
const BASE = process.env.BASE ?? 'http://127.0.0.1:8146';
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })).newPage();
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await page.goto(`${BASE}/game-146/index.html?debug=1`);
await page.waitForFunction(() => window.__jp, null, { timeout: 60000 });
await page.evaluate(() => {
    __jp.unlockAll();
    __jp.start(26, 11);
    __jp.ff(2.2);
    const G = __jp.G;
    if (G.shot) G.shot.s = G.shot.len - 0.01;      // land the bot's last shot on the next frame
    G.sack = ['bell', 'north', 'cocoa'];
    G.aim = 1.18;
    document.getElementById('toasts').innerHTML = '';
});
await page.waitForTimeout(2500);
await page.evaluate(() => { document.getElementById('toasts').innerHTML = ''; });
const out = path.join(ROOT, 'garden/img/games/game-146.jpg');
await page.screenshot({ path: out, type: 'jpeg', quality: 86 });
console.log('wrote', path.relative(process.cwd(), out));
await browser.close();

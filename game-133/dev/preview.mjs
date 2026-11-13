/**
 * preview.mjs — the 1200×630 picture the Garden's Library and share links use: the morning the dragon lands in
 * the yard, with Vesperax and Kael on stage and a line of hers in the box.
 *
 *   python3 -m http.server 8133          # repo root
 *   node game-133/dev/preview.mjs        # writes garden/img/games/game-133.jpg
 */
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8133';
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })).newPage();
await page.route('https://fonts.googleapis.com/**', (r) => r.continue().catch(() => r.fulfill({ status: 200, contentType: 'text/css', body: '' })));
await page.goto(`${BASE}/game-133/index.html?debug=1&fast=8`);
await page.waitForFunction(() => window.__lh);
await page.evaluate(() => {
    __lh.start(7, { name: 'Wren', gender: 'f' });
    __lh.skip();
    __lh.ff(21);
    for (let i = 0; i < 40 && !(__lh.G.scene?.id === 'dragon' && /Peace, little sword/.test(__lh.G.scene.cur.text || '')); i++) __lh.send({ t: 'next' });
    __lh.vn.complete();
    document.getElementById('toasts').innerHTML = ''; document.getElementById('floats').innerHTML = '';
});
await page.waitForTimeout(1500);
await page.evaluate(() => { document.getElementById('toasts').innerHTML = ''; document.getElementById('scene-title').hidden = true; __lh.vn.complete(); });
const out = path.join(HERE, '../../garden/img/games/game-133.jpg');
await page.screenshot({ path: out, type: 'jpeg', quality: 86 });
console.log('wrote', path.relative(process.cwd(), out));
await browser.close();

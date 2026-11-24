/**
 * preview.mjs — the 1200×630 picture the Garden's Library and share links use: a level part-way through, with
 * creatures already perched on their bloomed flowers and a few wisps in the air.
 *
 *   python3 -m http.server 8148 &      # repo root
 *   node game-148/dev/preview.mjs      # writes garden/img/games/game-148.jpg
 */
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8148';
const OUT = path.join(HERE, '../../garden/img/games/game-148.jpg');
const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })).newPage();
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await page.goto(`${BASE}/game-148/index.html?debug=1`);
await page.waitForFunction(() => window.__gg);
await page.evaluate(async () => {
    __gg.start(44);
    await new Promise((r) => setTimeout(r, 400));
    __gg.autoplay(true, true);
    await new Promise((r) => { const t = setInterval(() => { if (__gg.G.blooms >= 5) { clearInterval(t); r(); } }, 30); });
    __gg.autoplay(false);
    await new Promise((r) => setTimeout(r, 1600));
    const L = __gg.legal().find(([f, t]) => __gg.G.tubes[t].s.length);
    if (L) { __gg.tap(L[0]); __gg.tap(L[1]); }
});
await page.waitForTimeout(250);
await page.evaluate(() => { document.getElementById('toasts').textContent = ''; document.getElementById('caption').hidden = true; });
await page.screenshot({ path: OUT, type: 'jpeg', quality: 86 });
console.log('wrote', path.relative(process.cwd(), OUT));
await browser.close();

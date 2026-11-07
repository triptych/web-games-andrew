/**
 * preview.mjs — the Garden's 1200×630 preview of Atlas of Ink: the adventurer's road to a ruin, charted
 * and walked, with the route traced on the parchment. Writes garden/img/games/game-123.jpg.
 *
 *   python3 -m http.server 8123          # repo root
 *   node game-123/dev/preview.mjs
 */
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, '../../garden/img/games/game-123.jpg');
const BASE = process.env.BASE ?? 'http://127.0.0.1:8123';
const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await page.goto(`${BASE}/game-123/index.html?debug=1`);
await page.waitForFunction(() => window.__ai);
await page.evaluate(() => {
    __ai.start(23);
    __ai.jump(2);                      // Sir Kael's road
    __ai.finish();                     // the bot charts it and hands it over
    document.getElementById('result').hidden = true;
    document.getElementById('back-link').style.display = 'none';
});
await page.waitForTimeout(4500);       // the journey walks itself out on the map
await page.screenshot({ path: OUT, type: 'jpeg', quality: 86 });
console.log('wrote', path.relative(process.cwd(), OUT));
await browser.close();

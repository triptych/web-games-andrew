/**
 * preview.mjs — the Garden's 1200×630 preview of Rainglass: Lantern Quay with the window half
 * wiped, the drop mid-stroke, the mug steaming on the sill. Writes garden/img/games/game-122.jpg.
 *
 *   python3 -m http.server 8122          # repo root
 *   node game-122/dev/preview.mjs
 */
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, '../../garden/img/games/game-122.jpg');
const BASE = process.env.BASE ?? 'http://127.0.0.1:8122';
const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await page.goto(`${BASE}/game-122/index.html?debug=1`);
await page.waitForFunction(() => window.__rg);
await page.evaluate(() => {
    const G = __rg.start(21);
    // skip to the second station, then wipe about half of it
    __rg.ff(600); __rg.next();
    __rg.ff(52);
    document.getElementById('hud').hidden = true;
    document.getElementById('back-link').style.display = 'none';
    for (const t of document.querySelectorAll('.toast')) t.remove();
    return G.station;
});
await page.waitForTimeout(1200);
await page.screenshot({ path: OUT, type: 'jpeg', quality: 86 });
console.log('wrote', path.relative(process.cwd(), OUT));
await browser.close();

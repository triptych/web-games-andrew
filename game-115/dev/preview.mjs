/**
 * preview.mjs — the 1200×630 launcher picture: a mid-game town in the afternoon, zoomed out so the
 * buildings, fields, river, roads and townsfolk all show, with the HUD and the journal card.
 *
 *   python3 -m http.server 8115     # repo root
 *   node game-115/dev/preview.mjs   # → garden/img/games/game-115.jpg (and dev/shots/preview.png)
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '../..');
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(ROOT, 'dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8115';
fs.mkdirSync(path.join(HERE, 'shots'), { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })).newPage();
if (PKG) await page.route('https://unpkg.com/**', (r) => { const f = path.join(PKG, new URL(r.request().url()).pathname.replace(/^\/three@0\.165\.0\//, '')); return fs.existsSync(f) ? r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(f) }) : r.abort(); });
await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await page.goto(`${BASE}/game-115/index.html?debug=1&q=2&demo=0`);
await page.waitForFunction(() => window.__hw && __hw.mode === 'title', null, { timeout: 120000 });
await page.evaluate(async () => {
    __hw.start(11);
    __hw.ff(6200);                                  // about 26 days: a lived-in town
    const G = __hw.G;
    // a golden afternoon in spring-ish light, no raid banner, a tidy camera
    G.t = Math.floor(G.t / 240) * 240 + 240 * 0.3;
    G.hour = 13.2;
    G.weather = 'clear';
    document.getElementById('back-link').style.display = 'none';
    document.getElementById('banner').hidden = true;
    __hw.view.focus(17.2, 13.4, 0.78);
    __hw.ui.updateTracker(G);
});
await page.waitForTimeout(6000);
await page.evaluate(() => { document.getElementById('banner').hidden = true; document.getElementById('toasts').innerHTML = ''; });
const png = path.join(HERE, 'shots', 'preview.png');
await page.screenshot({ path: png, timeout: 120000 });
const jpg = path.join(ROOT, 'garden/img/games/game-115.jpg');
await page.screenshot({ path: jpg, type: 'jpeg', quality: 86, timeout: 120000 });
console.log('wrote', path.relative(ROOT, jpg));
await browser.close();

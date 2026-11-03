/**
 * preview.mjs — the 1200×630 launcher picture: the WARDEN-9 fight on the Command Spine, mid-burst,
 * with the HUD and boss bar showing.
 *
 *   python3 -m http.server 8114     # repo root
 *   node game-114/dev/preview.mjs   # → garden/img/games/game-114.jpg (and dev/shots/preview.png)
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '../..');
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(ROOT, 'dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8114';
fs.mkdirSync(path.join(HERE, 'shots'), { recursive: true });

const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })).newPage();
if (PKG) await page.route('https://unpkg.com/**', (r) => { const f = path.join(PKG, new URL(r.request().url()).pathname.replace(/^\/three@0\.165\.0\//, '')); return fs.existsSync(f) ? r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(f) }) : r.abort(); });
await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await page.goto(`${BASE}/game-114/index.html?debug=1`);
await page.waitForFunction(() => window.__lc && __lc.mode === 'title', null, { timeout: 90000 });
await page.evaluate(() => {
    __lc.start(4, 3);
    const G = __lc.G;
    G.spawns.length = 0;
    G.player.x = G.level.arena.x0 + 6;
    G.player.weapon = 'spread';
    G.god = true;
    __lc.autoplay(true);
    document.getElementById('back-link').style.display = 'none';
});
// into the fight: the Warden firing a burst and the spread gun answering
await page.waitForFunction(() => { const B = __lc.G.boss; return B && B.t > 5 && B.state === 'burst' && B.n >= 2 && __lc.G.pbul.length > 4 && __lc.G.player.inv <= 0 && __lc.view.fx.rings.length === 0 && !__lc.G.enemies.some((e) => e.k === 'missile') && document.getElementById('banner').hidden; }, null, { timeout: 600000, polling: 50 });
const png = path.join(HERE, 'shots', 'preview.png');
await page.screenshot({ path: png, timeout: 120000 });
const jpg = path.join(ROOT, 'garden/img/games/game-114.jpg');
await page.screenshot({ path: jpg, type: 'jpeg', quality: 86, timeout: 120000 });
console.log('wrote', path.relative(ROOT, jpg));
await browser.close();

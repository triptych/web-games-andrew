/**
 * preview.mjs — the Garden's 1200×630 preview of UFOops!: Zib's saucer beaming a cow up off the farm under
 * the Mother Ship. Writes garden/img/games/game-134.jpg.
 *
 *   python3 -m http.server 8134          # repo root
 *   node game-134/dev/preview.mjs
 */
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, '../../garden/img/games/game-134.jpg');
const BASE = process.env.BASE ?? 'http://127.0.0.1:8134';
const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 });
await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await page.goto(`${BASE}/game-134/index.html?debug=1`);
await page.waitForFunction(() => window.__uo && __uo.art().ok === __uo.art().total && __uo.art().total > 30);
await page.evaluate(() => {
    __uo.start(11, 0, true);
    document.getElementById('back-link').style.display = 'none';
    document.getElementById('hud').style.visibility = 'hidden';
    document.getElementById('touch').hidden = true;
});
await page.waitForFunction(() => __uo.G.phase === 'play');
// set the shot up: the saucer right of Mother, a cow halfway up the beam
await page.evaluate(() => {
    const G = __uo.G, u = G.ufo;
    u.x = G.W / 2 + 7; u.y = 9; u.vx = 0; u.vy = 0;
    G.enemies.forEach((e) => { e.x = u.x - 10; e.cd = 99; });
    const cow = G.specs.find((s) => s.kind === 'cow') || G.specs[0];
    cow.x = u.x; cow.y = 14.5; cow.state = 'lift';
    G.specs.filter((s) => s !== cow).forEach((s, i) => { s.x = u.x - 12 + i * 3.1; });
    __uo.cmd(null);
});
await page.keyboard.down('Space');
await page.waitForTimeout(350);
await page.screenshot({ path: OUT, type: 'jpeg', quality: 86 });
await page.keyboard.up('Space');
console.log('wrote', path.relative(process.cwd(), OUT));
await browser.close();

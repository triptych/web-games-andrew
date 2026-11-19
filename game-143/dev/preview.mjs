// preview.mjs — the 1200×630 picture the Garden's Library and share links use: the King's siege in full swing,
// the Mayor throwing from the wall, Sir Tobias holding the line and King Crumbleton looming. Set up through the debug hooks.
// Writes garden/img/games/game-143.jpg.
//   python3 -m http.server 8143   (repo root)  ·  node game-143/dev/preview.mjs
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = process.env.OUT ?? path.join(HERE, '../../garden/img/games/game-143.jpg');
const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })).newPage();
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await page.goto('http://127.0.0.1:8143/game-143/index.html?debug=1&fast=4');
await page.waitForFunction(() => window.__ds && document.body.classList.contains('art-ready'), null, { timeout: 60000 });
await page.evaluate(() => {
    __ds.quiet = true;
    const G = __ds.start(21);
    G.phase = 3; G.wall.lvl = 4; G.advs.tobias.hired = true; G.advs.moss.hired = true; G.advs.ottilie.hired = true; G.advs.lark.hired = true;
    for (const id of ['silk', 'wick', 'gerald', 'pip']) G.staff[id].joined = true;
    G.plots[1].b = { kind: 'tower', lvl: 2, build: 0, up: false }; G.plots[2].b = { kind: 'tower', lvl: 2, build: 0, up: false };
    G.daysLeft = 1; G.dayT = __ds.DAY_LEN - 0.3;
});
await page.waitForFunction(() => __ds.G.mode === 'battle', null, { timeout: 30000 });
await page.evaluate(() => { const B = __ds.G.battle; B.wall.hp = B.wall.max = 1e6; B.kingAt = 4; __ds.autoplay(true, 0.8); document.getElementById('b-hint').style.display = 'none'; });
await page.waitForFunction(() => { const k = __ds.G.battle.enemies.find((e) => e.kind === 'king'); return k && k.x < 72 && __ds.G.battle.enemies.filter((e) => e.nap <= 0 && !e.sit).length >= 10; }, null, { timeout: 120000, polling: 50 });
await page.evaluate(() => { const B = __ds.G.battle; B.wall.max = 1300; B.wall.hp = 1040; });
await page.waitForFunction(() => (__ds.seen.throw || 0) > 0 && __ds.G.battle.shots.some((s) => s.kind === 'doily' && s.t > 0.12), null, { timeout: 30000, polling: 10 });
await page.screenshot({ path: OUT, type: 'jpeg', quality: 86 });
console.log('wrote', OUT);
await browser.close();

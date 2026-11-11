/**
 * preview.mjs — the 1200x630 Garden/share preview: Kael against Old Tusk mid-fight, gems cascading.
 *   python3 -m http.server 8128   (repo root)   then   node game-128/dev/preview.mjs
 * Writes garden/img/games/game-128.jpg (via a PNG screenshot and ImageMagick).
 */
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, '../../garden/img/games/game-128.jpg');
fs.mkdirSync(path.join(HERE, 'shots'), { recursive: true });
const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })).newPage();
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await page.goto(`${process.env.BASE ?? 'http://127.0.0.1:8128'}/game-128/index.html?debug=1`);
await page.waitForFunction(() => window.__gs);
await page.evaluate(async () => {
    const G = __gs.start(21, 'kael');
    G.hero.lv = 4;
    G.hero.ranks.k_aegis = 1;
    __gs.cmd({ t: 'story' });
    __gs.skipScene();
    // jump to the chapter's boss
    const Bt = await import('./js/sim/battle.js');
    Bt.startBattle(G, 'tusk', 4);
    G.battle.phase = 'fight';
    __gs.ff(9);
    G.battle.hero.mana.r = 12; G.battle.hero.mana.s = 7;
    __gs.autoplay(true, 1);
});
await page.waitForTimeout(2200);
await page.evaluate(() => __gs.autoplay(false));
const png = path.join(HERE, 'shots', 'preview.png');
await page.screenshot({ path: png });
await browser.close();
execFileSync('convert', [png, '-quality', '86', OUT]);
console.log('wrote', OUT);

/**
 * preview.mjs — the 1200x630 Garden/share preview: a boss fight with a full, evolved party.
 *   python3 -m http.server 8126   (repo root)   then   node game-126/dev/preview.mjs
 * Writes garden/img/games/game-126.jpg (via a PNG screenshot and ImageMagick).
 */
import { chromium } from 'playwright';
import { execFileSync } from 'node:child_process';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, '../../garden/img/games/game-126.jpg');
const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })).newPage();
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await page.goto(`${process.env.BASE ?? 'http://127.0.0.1:8126'}/game-126/index.html?debug=1`);
await page.waitForFunction(() => window.__es);
await page.evaluate(() => {
    __es.start(9);
    document.querySelector('#popup .btn')?.click();
    const G = __es.G;
    const evo = { arin: 'paladin', brakka: 'bloodreaver', lyra: 'sniper', nyx: 'hexblade' };
    for (const [id, cls] of Object.entries(evo)) Object.assign(G.heroes[id], { joined: true, cls, tier: 2, lv: 34 });
    G.heroes.arin.tier = 3;
    G.party = ['arin', 'brakka', 'lyra', 'nyx'];
    G.gold = 48210;
    __es.fight(90);
});
await page.waitForFunction(() => __es.G.battle.phase === 'input' || __es.G.battle.phase === 'ai', null, { timeout: 30000 });
await page.waitForTimeout(2600);
const png = path.join(HERE, 'shots', 'preview.png');
await page.screenshot({ path: png });
await browser.close();
execFileSync('convert', [png, '-quality', '86', OUT]);
console.log('wrote', OUT);

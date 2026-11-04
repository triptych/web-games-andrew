/**
 * preview.mjs — the 1200×630 Garden preview: a fight against the Brain from Planet X, mid-chain.
 *
 *   python3 -m http.server 8116      # repo root
 *   node game-116/dev/preview.mjs    # writes garden/img/games/game-116.jpg
 */
import { chromium } from 'playwright';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, '../../garden/img/games/game-116.jpg');
const BASE = process.env.BASE ?? 'http://127.0.0.1:8116';

const browser = await chromium.launch({ args: ['--no-sandbox'] });
const page = await (await browser.newContext({ viewport: { width: 1200, height: 630 }, deviceScaleFactor: 1 })).newPage();
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await page.goto(`${BASE}/game-116/index.html?debug=1`);
await page.waitForFunction(() => window.__sfos);
await page.evaluate(() => {
    const S = window.__sfos;
    S.start(1959);
    const G = S.G;
    S.cmd({ t: 'done' });
    G.act = 1;
    G.relics.push('ray_lens', 'moon_rock');
    G.gadgets.push('freeze_ray');
    const b = G.map.nodes.find((n) => n.type === 'boss');
    G.pos = G.map.nodes.find((n) => n.next.includes(b.id)).id;
    S.cmd({ t: 'go', id: b.id });
    G.battle.charge = 6;
    // play a few cards that fit, so the table is opened up and a chain is running
    for (let i = 0; i < 12; i++) {
        const B = G.battle;
        const c = B.tab.find((x) => x.up && !x.frozen && (Math.abs(x.r - B.beam.r) === 1 || Math.abs(x.r - B.beam.r) === 12));
        if (c) S.cmd({ t: 'play', id: c.id });
        else if (B.draws > 0) S.cmd({ t: 'draw' });
        else break;
    }
    G.battle.enemy.hp = Math.max(G.battle.enemy.hp, 120);
    S.finish();
    document.getElementById('back-link').style.display = 'none';
});
await page.waitForTimeout(3500);   // let the floating numbers fade
await page.screenshot({ path: OUT, type: 'jpeg', quality: 86 });
console.log('wrote', path.relative(process.cwd(), OUT));
await browser.close();

/**
 * tour.mjs — photograph every stage and boss in one browser session (for judging the look).
 *
 *   node game-144/dev/tour.mjs                  # all scenarios → dev/shots/tour-*.png
 *   ONLY=boss3,boss6 node game-144/dev/tour.mjs
 *   W=390 H=844 TOUCH=1 node game-144/dev/tour.mjs     # on a portrait phone
 *
 * Each scenario starts a run with the debug hooks, fast-forwards the sim with the bot (god mode on) and waits a
 * moment of real frames so particles and bloom settle. Needs the static server on 8144 (see README.md).
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8144';
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const W = +(process.env.W || 1280), H = +(process.env.H || 720), TOUCH = !!process.env.TOUCH;
fs.mkdirSync(path.join(HERE, 'shots'), { recursive: true });

const boss = (stage, pilot, secs, extra = '') => `__nr.start(${stage + 7},{pilot:'${pilot}',stage:${stage}}); __nr.G.god=true; __nr.G._script={script:[],end:0}; __nr.G.scriptI=0; const p=__nr.G.player; p.power=6; p.options=2; p.rockets=1; ${extra} __nr.ff(${secs});`;
const SCEN = {
    stage1: `__nr.start(3,{pilot:'sora'}); __nr.G.god=true; __nr.ff(48);`,
    stage2: `__nr.start(4,{pilot:'kaito',stage:1}); __nr.G.god=true; __nr.ff(26);`,
    stage3: `__nr.start(5,{pilot:'lyra',stage:2}); __nr.G.god=true; __nr.ff(30);`,
    stage4: `__nr.start(6,{pilot:'sora',stage:3}); __nr.G.god=true; __nr.ff(30);`,
    stage5: `__nr.start(7,{pilot:'kaito',stage:4}); __nr.G.god=true; __nr.ff(18);`,
    stage6: `__nr.start(8,{pilot:'lyra',stage:5}); __nr.G.god=true; __nr.ff(14);`,
    boss2: boss(1, 'sora', 20),
    boss3: boss(2, 'kaito', 16, 'p.halo=2;'),
    boss4: boss(3, 'lyra', 18, 'p.shield=2;'),
    boss5: boss(4, 'sora', 22, 'p.halo=1; p.options=4;'),
    boss6: boss(5, 'kaito', 30, 'p.options=4; p.rockets=4;'),
    endless: `__nr.start(9,{mode:'endless',pilot:'sora'}); __nr.G.god=true; __nr.ff(60);`,
    burst: `__nr.start(10,{pilot:'kaito',stage:3}); __nr.G.god=true; __nr.ff(20); __nr.G.burst=100; __nr.input.press('burst');`,
};
const browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
const ctx = await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, hasTouch: TOUCH, isMobile: TOUCH });
const page = await ctx.newPage();
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
page.on('console', (m) => { if (m.type() === 'error') console.log('[console]', m.text()); });
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
await page.goto(`${BASE}/game-144/index.html?debug=1${process.env.Q || ''}`);
await page.waitForFunction(() => window.__nr, null, { timeout: 60000 });
for (const [name, code] of Object.entries(SCEN)) {
    if (ONLY.length && !ONLY.includes(name)) continue;
    const t0 = Date.now();
    await page.evaluate(`(async () => { ${code} })()`);
    await page.waitForTimeout(+(process.env.WAIT || 1800));
    const tag = TOUCH ? `-${W}x${H}` : '';
    await page.screenshot({ path: path.join(HERE, 'shots', `tour-${name}${tag}.png`) });
    const info = await page.evaluate(() => ({ stage: __nr.G.stage + 1, boss: __nr.G.boss?.key || '', phase: __nr.G.boss?.phase, bullets: __nr.G.bullets.length, enemies: __nr.G.enemies.length }));
    console.log(name, JSON.stringify(info), `${Date.now() - t0} ms`);
}
await browser.close();

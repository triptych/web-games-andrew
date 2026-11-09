/**
 * shots.mjs — one browser, many moments: every room of the station, every zone, the dialogue, the terminals.
 *
 *   node game-125/dev/shots.mjs              # all
 *   ONLY=station,meadow node game-125/dev/shots.mjs
 *   W=390 H=844 TOUCH=1 node game-125/dev/shots.mjs
 *
 * Writes game-125/dev/shots/s-<name>.png. Q='&q=low' to skip the post chain.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8125';
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const W = +(process.env.W || 1280), H = +(process.env.H || 760), TOUCH = !!process.env.TOUCH;
fs.mkdirSync(path.join(HERE, 'shots'), { recursive: true });

// [name, snippet run in the page, settle ms]
const at = (x, z, yaw, pitch = 0) => `__sf.G.me.x=${x}; __sf.G.me.z=${z}; __sf.G.me.yaw=${yaw}; __sf.G.me.pitch=${pitch}; __sf.view.station.tillyPos.set(${x}+Math.sin(${yaw})*1.3+Math.cos(${yaw})*0.85, 1.3, ${z}-Math.cos(${yaw})*1.3+Math.sin(${yaw})*0.85);`;
const drop = (zone, extra = '') => `__sf.start(11); __sf.skipTalk(); const G = __sf.G; for (const k in G.res) G.res[k] = 5000; G.bot.gen = 5; G.zones[${zone}].visited = true; ${extra} __sf.act({ t: 'deploy', zone: ${zone} }); __sf.skipTalk(); const M = __sf.G.mission; M.p.y = 12; M.p.x = 2; M.p.yaw = 0.1;`;
const SHOTS = [
    ['station', `__sf.start(3); __sf.skipTalk(); ${at(0, 1, 0, 0.05)}`, 1800],
    ['stasis', `__sf.start(3); __sf.skipTalk(); ${at(3.5, -6.5, 1.75, -0.25)}`, 1800],
    ['lab', `__sf.start(3); __sf.skipTalk(); __sf.G.vats.push({strain:{name:'x'},left:1}); ${at(-4, -7, -1.4, 0.05)}`, 1800],
    ['research', `__sf.start(3); __sf.skipTalk(); __sf.G.research.done = {m1:1,m2:1,a1:1,b1:1}; ${at(-4, -21.5, -1.5, 0)}`, 1800],
    ['hangar', `__sf.start(3); __sf.skipTalk(); __sf.G.bot.gen = 2; ${at(4, -23, 1.75, 0.05)}`, 1800],
    ['command', `__sf.start(3); __sf.skipTalk(); ${at(0, -38, 0, 0)}`, 1800],
    ['talk', `__sf.start(3);`, 2500],
    ['term-lab', `__sf.start(3); __sf.skipTalk(); const G=__sf.G; G.samples={sunbloom:2,skitterling:2,whisperreed:3,thornback:1}; for (const k in G.res) G.res[k]=60; G.zones[0].visited=true; G.flags.lab=true; G.said.lab=true; __sf.ui.openPanel('lab', G);`, 1200],
    ['term-command', `__sf.start(3); __sf.skipTalk(); const G=__sf.G; G.zones[0].visited=true; G.zones[1].visited=true; G.said.command=true; __sf.ui.openPanel('command', G);`, 1200],
    ['term-research', `__sf.start(3); __sf.skipTalk(); const G=__sf.G; for (const k in G.res) G.res[k]=60; __sf.ui.openPanel('research', G);`, 1200],
    ['term-hangar', `__sf.start(3); __sf.skipTalk(); const G=__sf.G; for (const k in G.res) G.res[k]=60; G.zones[0].visited=true; __sf.ui.openPanel('hangar', G);`, 1200],
    ['meadow', drop(0), 2500],
    ['meadow-healed', drop(0, 'G.zones[0].toxic=5; G.zones[0].hostile=10; G.zones[0].barren=5; G.zones[0].harv.metal=2; G.zones[0].colony=2;'), 2500],
    ['rustwood', drop(1), 2500],
    ['marsh', drop(2), 2500],
    ['mesa', drop(3), 2500],
    ['hollow', drop(4), 2500],
    ['heartroot', drop(5, '') + ' M.p.y = 2; M.p.x = 0;', 3000],
];

const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
});
const page = await (await browser.newContext({ viewport: { width: W, height: H }, deviceScaleFactor: 1, hasTouch: TOUCH, isMobile: TOUCH })).newPage();
if (PKG) await page.route('https://unpkg.com/**', (route) => {
    const file = path.join(PKG, new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, ''));
    if (!fs.existsSync(file)) return route.abort();
    route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
});
await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
page.on('console', (m) => { if (m.type() === 'error') console.log('[error]', m.text()); });
page.on('pageerror', (e) => console.log('[pageerror]', e.message));
for (const [name, code, wait] of SHOTS) {
    if (ONLY.length && !ONLY.includes(name)) continue;
    await page.goto(`${BASE}/game-125/index.html?debug=1${process.env.Q || ''}`);
    await page.waitForFunction(() => window.__sf, null, { timeout: 60000 });
    try { await page.evaluate(`(async () => { ${code} })()`); } catch (e) { console.log(name, 'threw', e.message); }
    await page.waitForTimeout(wait);
    await page.screenshot({ path: path.join(HERE, 'shots', `s-${name}.png`) });
    console.log('shot', name);
}
await browser.close();

/**
 * tour.mjs — screenshots of states that take hours to reach by hand: every biome, the seasons,
 * weather, a grown village, shop/station/board/animal panels, a boss battle and the festival.
 *   node dev/tour.mjs [WxH]      → dev/shots/tour-*.png (fails on console errors)
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';

const BASE = process.env.BASE ?? 'http://127.0.0.1:8043';
const [w, hgt] = (process.argv[2] ?? '390x844').split('x').map(Number);
mkdirSync(new URL('./shots/', import.meta.url), { recursive: true });
const out = n => new URL(`./shots/tour-${w}x${hgt}-${n}.png`, import.meta.url).pathname;
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH, args: ['--no-sandbox'] });
const mobile = w < 900;
const ctx = await browser.newContext({ viewport: { width: w, height: hgt }, deviceScaleFactor: mobile ? 3 : 1, isMobile: mobile, hasTouch: mobile });
const page = await ctx.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(String(e.stack || e)));
await page.addInitScript(() => { try { localStorage.clear(); } catch {} });
await page.goto(`${BASE}/game-043/index.html`);
await page.waitForTimeout(800);
await page.click('text=New Game'); await page.waitForTimeout(200);
await page.click('text=Begin your story'); await page.waitForTimeout(200);
await page.click('text=Travel to'); await page.waitForTimeout(600);
const ev = (fn, arg) => page.evaluate(fn, arg);
const shot = async (n, ms = 400) => { await page.waitForTimeout(ms); await page.screenshot({ path: out(n) }); };
const closeAll = () => ev(() => { const u = window.__glim.ui; u.dlgQueue = []; if (u.dlg) u.closeDialog(); u.panels.close(); });
await closeAll();

// a grown village: level 5, every villager, animals, decorations
await ev(() => {
    const g = window.__glim.game, w = g.world;
    g.s.quests.flags.met_mayor = g.s.quests.flags.met_glim = true;
    g.s.village.board = true; g.s.village.level = 5; g.s.village.xp = 1500;
    const types = ['workshop', 'farmhouse', 'forge', 'ranch', 'cafe', 'coop', 'apothecary', 'store', 'loft', 'barn', 'lodge', 'tower', 'library', 'greenhouse', 'tavern'];
    types.forEach((t, k) => {
        const L = w.lots[k];
        for (let y = L.y; y < L.y + 5; y++) for (let x = L.x; x < L.x + 6; x++) { const i = y * w.W + x; if (w.obj[i]) g.removeObj(i, false); }
        g.s.world.lots[k] = { b: t, day: 1 };
        const job = { workshop: 'carpenter', farmhouse: 'farmer', forge: 'blacksmith', ranch: 'rancher', cafe: 'cook', apothecary: 'herbalist', store: 'merchant', loft: 'tailor', lodge: 'miner', tower: 'guard', library: 'scholar', tavern: 'bard' }[t];
        if (job) Object.assign(g.vstate(job), { joined: 1, lot: k, friendship: 300 + k * 40, happiness: 70 });
    });
    g.buildBuildingMap();
    g.p.gold = 20000;
    for (const k of ['chicken', 'chicken', 'duck', 'cow', 'sheep', 'goat']) g.buyAnimal(k);
    g.s.heartwood = 3;
    g.s.time.day = 3; g.s.time.min = 11 * 60;
    // decorate and farm
    const f = w.glen.farm;
    for (let y = f.y; y < f.y + f.h; y++) for (let x = f.x; x < f.x + f.w; x++) { const i = y * w.W + x; if (w.obj[i]) g.removeObj(i, false); if ((x + y) % 5 !== 0) { g.s.world.tilled[i] = { w: (x % 3) ? 1 : 0 }; g.s.world.crops[i] = { id: ['turnip', 'potato', 'strawberry', 'cauliflower', 'wheat'][x % 5], age: (x * 3 + y) % 11, done: 0 }; } }
    const H = w.glen.heart;
    for (const [dx, dy, id] of [[-3, 6, 'lamp'], [4, 6, 'lamp'], [-4, 1, 'planter'], [5, 1, 'bench'], [6, -3, 'statue']]) { const i = (H.y + dy) * w.W + H.x + dx; if (!w.obj[i] && !g.bmap.has(i)) g.placeObj(i, id); }
    for (const j of ['carpenter', 'farmer']) g.s.applicants = [];
    g.p.x = w.cx + 0.5; g.p.y = w.cy + 5.9;
    for (let k = 0; k < 40; k++) g.update(0.05, {});
});
await shot('01-village-day', 900);
await ev(() => { const g = window.__glim.game; g.s.time.min = 20 * 60 + 30; g.p.x = g.world.cx - 8; g.p.y = g.world.cy + 12; for (let k = 0; k < 10; k++) g.update(0.05, {}); });
await shot('02-village-night', 600);
await ev(() => { const g = window.__glim.game; g.s.time.min = 10 * 60; g.p.x = g.world.cx + 0.5; g.p.y = g.world.cy + 5.9; g.s.time.day = 40; g.s.weather = 'snow'; for (let k = 0; k < 10; k++) g.update(0.05, {}); window.__glim.renderer.chunks.clear(); });
await shot('03-village-winter-snow', 600);
await ev(() => { const g = window.__glim.game; g.s.time.day = 28; g.s.weather = 'rain'; window.__glim.renderer.chunks.clear(); for (let k = 0; k < 10; k++) g.update(0.05, {}); });
await shot('04-village-fall-rain', 600);
await ev(() => { const g = window.__glim.game; g.s.time.day = 3; g.s.weather = 'sun'; window.__glim.renderer.chunks.clear(); });

// biomes
for (let k = 1; k <= 5; k++) {
    await ev(k => { const g = window.__glim.game, R = g.world.regions[k - 1]; g.p.relics = ['thornbreaker', 'stonebreaker', 'lilypad', 'lantern']; g.p.x = R.hub.x + 0.5; g.p.y = R.hub.y + 0.9; g.rt.monsters = []; g.s.time.min = 13 * 60; for (let j = 0; j < 30; j++) g.update(0.1, {}); g.rt.monsters.forEach(m => m.fade = 1); }, k);
    await shot(`05-biome-${k}`, 500);
}
// a dungeon entrance and a secret pocket
await ev(() => { const g = window.__glim.game, s = g.world.sites.find(s => s.kind === 'dungeon' && s.region === 2); g.p.x = s.x + 0.5; g.p.y = s.y + 2.9; g.rt.monsters = []; });
await shot('06-dungeon-door', 300);
await ev(() => { const g = window.__glim.game, gl = g.world.glimmers.find(x => x.pocket === 'boulder'); g.s.heartwood = 5; g.p.x = gl.x + 0.5; g.p.y = gl.y + 3.9; g.rt.monsters = []; });
await shot('07-pocket', 300);
await ev(() => { const g = window.__glim.game; g.s.heartwood = 3; const f = g.world.sites.find(s => s.kind === 'cave' && s.region === 4); g.gotoFloor(f.id, 3); });
await shot('08-cave', 500);
await ev(() => { const g = window.__glim.game; g.gotoFloor('d3', 5); g.p.y -= 8; });
await shot('09-boss-floor', 500);
await ev(() => { const g = window.__glim.game; g.p.level = 12; g.refreshStats(); g.startBattle([{ sp: 'r3boss' }, { sp: g.byRegion[3][0], depth: 1 }], { boss: true, region: 3, bg: 'dungeon' }); });
await shot('10-boss-battle', 800);
await ev(() => { const g = window.__glim.game; g.rt.battle = null; window.__glim.ui.endBattle(); g.exitSite(); g.p.x = g.world.cx + 0.5; g.p.y = g.world.cy + 5.9; });
await closeAll();
// panels
const open = (kind, data) => ev(([k, d]) => window.__glim.ui.panels.open(k, d), [kind, data]);
await ev(() => { const g = window.__glim.game; for (const [id, n] of [['iron_bar', 6], ['copper_ore', 12], ['coal', 4], ['egg', 3], ['milk', 2], ['flour', 3], ['pumpkin', 1], ['ruby', 1], ['tonic', 3]]) g.give(id, n, true); g.s.time.min = 11 * 60; });
await open('shopfront', { job: 'blacksmith', building: 'forge' }); await shot('11-forge-talk', 200);
await ev(() => { const p = window.__glim.ui.panels; p.tab = 'upgrade'; p.render(); }); await shot('12-forge-upgrade', 200);
await ev(() => { const p = window.__glim.ui.panels; p.tab = 'station'; p.render(); }); await shot('13-forge-station', 200);
await open('home', {}); await shot('14-cook', 200);
await ev(() => { const p = window.__glim.ui.panels; p.tab = 'craft'; p.render(); }); await shot('15-craft', 200);
await ev(() => window.__glim.game.refreshBoard(true));
await open('board', {}); await shot('16-board', 200);
await open('animals', { home: 'barn' }); await shot('17-barn', 200);
await open('build', { lot: 16 }); await shot('18-build', 200);
await open('menu', { tab: 'village' }); await shot('19-village-tab', 200);
await open('map', {}); await shot('20-map', 300);
await ev(() => window.__glim.ui.panels.close());
await ev(() => window.__glim.game.talkTo('cook'));
await page.waitForTimeout(900);
await ev(() => { const u = window.__glim.ui; if (u.dlg?.typing) u.advanceDialog(); });
await shot('21-villager-dialog', 300);
await closeAll();
await ev(() => { const u = window.__glim.ui; u.cutscene(['The Heartwood blooms.', 'Blossoms drift down over the plaza like warm snow.', 'Everyone is here.']); });
await shot('22-festival', 3000);
await browser.close();
if (errors.length) { console.log('ERRORS:\n' + errors.join('\n')); process.exit(1); }
console.log('tour ok');

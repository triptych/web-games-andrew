/**
 * flowtest.mjs — the screen state machine in Chromium (mouse/keyboard, desktop size):
 * sleep from the cabin → morning report; applicants → build → move-in; the Mayor's village
 * celebration; a dungeon trip with a boss → shard → Heartwood; the festival cutscene; the
 * keyboard shortcuts; music moods follow the map. Fails on any console/page error.
 *   node dev/flowtest.mjs   (needs `python3 -m http.server 8043` from the repo root)
 */
import { chromium } from 'playwright';
const BASE = process.env.BASE ?? 'http://127.0.0.1:8043';
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH, args: ['--no-sandbox'] });
const page = await browser.newPage({ viewport: { width: 1280, height: 800 } });
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(String(e.stack || e)));
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL', m); } };
const wait = ms => page.waitForTimeout(ms);
const ev = (fn, a) => page.evaluate(fn, a);
const dlg = () => ev(() => !!window.__glim.ui.dlg);
const finishDialogs = async () => { for (let k = 0; k < 40 && await dlg(); k++) { const ch = await ev(() => [...document.querySelectorAll('#dlg-choices button')].map(b => b.textContent)); if (ch.length) await page.click(`#dlg-choices button >> nth=${ch.length - 1}`); else await page.keyboard.press('Space'); await wait(60); } };
await page.addInitScript(() => { try { localStorage.clear(); } catch {} });
await page.goto(`${BASE}/game-043/index.html`); await wait(900);
await page.click('text=New Game'); await page.fill('.field input[aria-label="Name"]', 'Juniper'); await page.fill('.field input[aria-label="World seed"]', 'cozy'); await wait(200);
ok(await ev(() => document.querySelector('.field small').textContent.includes('This seed')), 'creator previews the seed\'s glen name');
await page.click('text=Begin your story'); await page.click('text=Travel to'); await wait(700);
await finishDialogs();
ok(await ev(() => window.__glim.game.p.name === 'Juniper'), 'name from the creator');
const seed = await ev(() => window.__glim.game.s.seed);
ok(seed === await ev(async () => (await import('./js/core/rng.js')).seedFromText('cozy')), 'seed from text');
ok(await ev(() => window.__glim.audio.mood) === 'glen', 'glen music playing');
// keyboard: walk, hotbar, menu
const x0 = await ev(() => window.__glim.game.p.x);
await page.keyboard.down('d'); await wait(400); await page.keyboard.up('d');
ok(await ev(() => window.__glim.game.p.x) > x0 + 0.5, 'D walks right');
await page.keyboard.press('3'); ok(await ev(() => window.__glim.game.s.sel) === 2, '3 selects hotbar slot 3');
await page.keyboard.press('i'); ok(await ev(() => window.__glim.ui.panels.kind) === 'menu', 'I opens the menu');
await page.keyboard.press('Escape'); ok(!(await ev(() => window.__glim.ui.panels.isOpen())), 'Esc closes it');
await page.keyboard.press('m'); ok(await ev(() => window.__glim.ui.panels.kind) === 'map', 'M opens the map');
await page.keyboard.press('m');
// prologue quickly, then sleep via the cabin door
await ev(() => { const g = window.__glim.game; g.talkTo('mayor'); g.talkTo('glim'); g.s.stats.farmCleared = 10; g.s.stats.planted = 5; g.give('wood', 15); g.buildJobBoard(); g.checkStory(); });
await finishDialogs();
await ev(() => { const g = window.__glim.game, c = g.world.glen.cabin; g.p.x = c.x + 2.5; g.p.y = c.y + 3.9; g.p.dir = 1; });
await page.keyboard.press('Space'); await wait(200);
ok(await ev(() => window.__glim.ui.panels.kind) === 'home', 'A at the cabin door opens home');
await page.click('#panel-tabs >> text=Sleep'); await page.click('text=Sleep until morning'); await wait(1200);
ok(await ev(() => window.__glim.game.day) === 2, 'slept to day 2');
ok(await dlg() && await ev(() => document.querySelector('#dlg-name').textContent.includes('morning')), 'morning report shows');
await finishDialogs();
ok(await ev(() => window.__glim.game.s.quests.main.ch) === 1 && await ev(() => document.querySelector('#objective').textContent.includes('newcomers')), 'chapter 1 objective shown');
ok(await ev(() => !!localStorage.getItem('glimmerglen.v1.auto')), 'autosaved on sleep');
// build for the carpenter through the lot sign
await ev(() => { const g = window.__glim.game, w = g.world, L = w.lots[0]; for (let y = L.y; y < L.y + 5; y++) for (let x = L.x; x < L.x + 6; x++) { const i = y * w.W + x; if (w.obj[i] && w.obj[i] !== 29) g.removeObj(i, false); } g.give('wood', 60); g.give('stone', 30); g.p.gold += 500; g.p.x = L.sign.x + 0.5; g.p.y = L.sign.y + 1.9; g.p.dir = 1; });
await page.keyboard.press('Space'); await wait(200);
ok(await ev(() => window.__glim.ui.panels.kind) === 'build', 'lot sign opens the build menu');
await page.click('#panel-body .row.ok >> nth=0 >> button'); await wait(200);
ok(await ev(() => window.__glim.game.buildings.length) === 3, 'building placed');
await ev(() => window.__glim.game.sleep()); await wait(300); await finishDialogs();
ok(await ev(() => window.__glim.game.residents().length) === 1, 'a villager moved in');
// the celebration
await ev(() => window.__glim.game.addCoziness(500, 'test'));
await finishDialogs();
await ev(() => window.__glim.game.talkTo('mayor')); await wait(100);
for (let k = 0; k < 10 && !(await ev(() => document.querySelectorAll('#dlg-choices button').length)); k++) { await page.keyboard.press('Space'); await wait(80); }
await page.click('#dlg-choices >> text=celebration'); await wait(200);
ok(await ev(() => window.__glim.game.s.village.level) === 2, 'the Mayor levels up the village');
await finishDialogs();
// dungeon with boss
await ev(() => { const g = window.__glim.game; g.p.level = 9; g.p.equip.weapon = 'iron_sword'; g.p.equip.armor = 'iron_mail'; g.refreshStats(); g.p.hp = g.p.maxHp; g.gotoFloor('d1', 5); });
await wait(300);
ok(await ev(() => window.__glim.audio.mood) === 'dungeon', 'dungeon music');
await ev(() => { const g = window.__glim.game, b = g.rt.monsters.find(m => m.boss); g.engage(b, false); });
await wait(300);
ok(await ev(() => window.__glim.audio.mood) === 'boss', 'boss music');
for (let k = 0; k < 40; k++) {
    const st = await ev(() => ({ over: window.__glim.game.rt.battle?.over, busy: window.__glim.ui.battle.busy, b: !!window.__glim.game.rt.battle, dlg: !!window.__glim.ui.dlg, cmds: document.querySelector('#battle-cmds').textContent.slice(0, 40), hid: document.querySelector('#battle-ui').hidden }));
    if (st.over && !st.busy) break;
    if (!st.busy) { const has = await ev(() => document.querySelector('#battle-cmds').textContent); if (!has.includes('Attack')) { console.log('cmds:', has, errors); break; } await page.click('#battle-cmds >> text=Attack'); await wait(60); if (await ev(() => document.querySelector('#battle-cmds').textContent.includes('Back'))) await page.click('#battle-cmds button >> nth=0'); }
    await wait(700);
}
await page.click('#battle-cmds >> text=Continue'); await wait(300);
ok(await ev(() => window.__glim.game.p.shards) === 1, 'boss dropped a Heart Shard');
await finishDialogs();
await ev(() => { const g = window.__glim.game; g.exitSite(); });
ok(await ev(() => window.__glim.game.inWorld), 'back outside');
await ev(() => { const g = window.__glim.game, H = g.world.glen.heart; g.p.x = H.x + 1.5; g.p.y = H.y + 4.9; g.p.dir = 1; });
await wait(1000);
await page.keyboard.press('Space'); await wait(300);
ok(await ev(() => window.__glim.game.s.heartwood) === 1, 'shard returned at the Heartwood');
await finishDialogs();
// festival
await ev(() => { const g = window.__glim.game; g.s.heartwood = 5; g.s.quests.main.ch = 6; g.s.quests.main.step = 0; g.s.time.min = 19 * 60; g.talkTo('glim'); });
await wait(500);
ok(await ev(() => !document.querySelector('#screen-layer').hidden && !!document.querySelector('.cutscene')), 'festival cutscene');
for (let k = 0; k < 14; k++) { await page.click('#screen-layer'); await wait(80); }
await page.click('text=The End'); await wait(300);
ok(await ev(() => document.querySelector('#screen-layer').hidden) && await dlg(), 'cutscene ends into Glim\'s thanks');
await finishDialogs();
ok(await ev(() => window.__glim.game.currentStep().final), 'post-game');
await browser.close();
if (errors.length) { console.log('errors:\n' + errors.join('\n')); fail += errors.length; }
console.log(`${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

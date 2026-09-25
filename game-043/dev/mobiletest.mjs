/**
 * mobiletest.mjs — the game as a phone sees it, driven ONLY by touch (CDP Input.dispatchTouchEvent).
 * Title → New Game → creator → letter → the Glen; control sizes/overlap; the joystick walks;
 * A talks to the Mayor and the dialog advances by tapping; choices are tappable; the hotbar
 * selects; A chops a weed; the menu, map and job-board panels open and close; a battle is won
 * with the Attack button; saving to a slot and Continue after a reload restore the game.
 *   node dev/mobiletest.mjs              (portrait 390x844)
 *   LANDSCAPE=1 node dev/mobiletest.mjs  (landscape 844x390)
 * Needs `python3 -m http.server 8043` from the repo root.
 */
import { chromium, devices } from 'playwright';

const BASE = process.env.BASE ?? 'http://127.0.0.1:8043';
const LAND = process.env.LANDSCAPE === '1';
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: LAND ? { width: 844, height: 390 } : { width: 390, height: 844 }, deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: devices['iPhone 13'].userAgent });
const page = await ctx.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(String(e.stack || e)));
const cdp = await ctx.newCDPSession(page);
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL', m); } };
const wait = ms => page.waitForTimeout(ms);
const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
const tapXY = async (x, y) => { await touch('touchStart', [{ x, y, id: 1 }]); await wait(50); await touch('touchEnd', []); await wait(160); };
const rect = sel => page.evaluate(s => { const e = document.querySelector(s); if (!e) return null; const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, vis: getComputedStyle(e).display !== 'none' && !e.closest('[hidden]') && r.width > 0 }; }, sel);
const tap = async sel => { const r = await rect(sel); if (!r || !r.vis) { ok(false, `${sel} visible to tap`); return false; } await tapXY(r.x + r.w / 2, r.y + r.h / 2); return true; };
const tapText = async (text, scope = 'body') => {
    const r = await page.evaluate(([t, sc]) => { const els = [...document.querySelectorAll(sc + ' button')].filter(b => b.offsetParent && b.textContent.includes(t)); if (!els.length) return null; const e = els[0]; e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; }, [text, scope]);
    if (!r) { ok(false, `button "${text}" present`); return false; }
    await tapXY(r.x, r.y); return true;
};
const st = () => page.evaluate(() => { const G = window.__glim, g = G.game; return { mode: G.ui.mode, dlg: !!G.ui.dlg, panel: G.ui.panels.isOpen() ? G.ui.panels.kind : null, battle: !!g?.rt.battle, x: g?.p.x, y: g?.p.y, day: g?.day, name: g?.p.name, sel: g?.s.sel, step: g?.s.quests.main.step }; });
const choiceCount = () => page.evaluate(() => document.querySelectorAll('#dlg-choices button').length);
const toChoices = async () => { for (let k = 0; k < 20 && (await st()).dlg && !(await choiceCount()); k++) { await tap('#dlg-box'); await wait(120); } };
const clearDialogs = async () => {
    for (let k = 0; k < 30 && (await st()).dlg; k++) {
        if (await choiceCount()) { const labels = await page.evaluate(() => [...document.querySelectorAll('#dlg-choices button')].map(b => b.textContent)); const pick = labels.find(l => /Bye|Not yet|Welcome/.test(l)) ?? labels[labels.length - 1]; await tapText(pick, '#dlg-choices'); }
        else await tap('#dlg-box');
        await wait(120);
    }
};

await page.addInitScript(() => { try { if (!sessionStorage.getItem('keep')) localStorage.clear(); } catch {} });
await page.goto(`${BASE}/game-043/index.html`);
await wait(1200);
ok((await st()).mode === 'title', 'boots to the title');
await tapText('New Game');
await wait(300);
ok(await page.evaluate(() => !!document.querySelector('.creator')), 'character creator opens');
await tapText('Begin your story');
await wait(300);
ok(await page.evaluate(() => !!document.querySelector('.letter')), 'the letter from your great-aunt');
await tapText('Travel to');
await wait(1000);
let s = await st();
ok(s.mode === 'play' && s.dlg, 'arrive in the Glen with an intro dialog');
await clearDialogs();
ok(!(await st()).dlg, 'tapping the dialog box advances and closes it');

// controls
const ids = ['#b-a', '#b-b', '#b-menu', '#b-map', '#hotbar'];
const R = {};
for (const id of ids) R[id] = await rect(id);
const vp = page.viewportSize();
for (const id of ids) {
    const r = R[id];
    ok(r && r.vis, `${id} visible`);
    ok(r.h >= 44 && (r.w >= 44), `${id} ≥44px (${r.w.toFixed(0)}×${r.h.toFixed(0)})`);
    ok(r.x >= 0 && r.y >= 0 && r.x + r.w <= vp.width + 0.5 && r.y + r.h <= vp.height + 0.5, `${id} on screen`);
}
const over = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) ok(!over(R[ids[i]], R[ids[j]]), `${ids[i]} and ${ids[j]} don't overlap`);
const slotR = await page.evaluate(() => [...document.querySelectorAll('#hotbar .slot')].map(e => { const r = e.getBoundingClientRect(); return r.width; }));
ok(slotR.length === 8 && slotR.every(w => w >= 38), `8 hotbar slots, each tappable (${slotR.map(w => w.toFixed(0)).join(',')})`);
const cv = await rect('#screen');
const scale = await page.evaluate(() => window.__glim.ui.view.scale);
ok(Math.abs(cv.w * 3 / (cv.w * 3 / scale) - scale) < 0.01 && Number.isInteger(scale), `canvas scales by a whole number (${scale}× device px)`);

// joystick walk: drag from the left zone to the right
s = await st();
const z = await rect('#stick-zone');
const sx = z.x + z.w * 0.4, sy = z.y + z.h * 0.6;
await touch('touchStart', [{ x: sx, y: sy, id: 2 }]);
for (let k = 1; k <= 6; k++) { await touch('touchMove', [{ x: sx + k * 10, y: sy, id: 2 }]); await wait(30); }
await wait(600);
await touch('touchEnd', []);
const s2 = await st();
ok(s2.x > s.x + 1, `joystick walks right (${s.x.toFixed(2)} → ${s2.x.toFixed(2)})`);
await touch('touchStart', [{ x: sx, y: sy, id: 3 }]);
for (let k = 1; k <= 6; k++) { await touch('touchMove', [{ x: sx, y: sy - k * 10, id: 3 }]); await wait(30); }
await wait(400);
await touch('touchEnd', []);
ok((await st()).y < s2.y - 0.5, 'joystick walks up');

// talk to the Mayor: stand below them and tap A
await page.evaluate(() => { const g = window.__glim.game; const w = g.world; g.p.x = w.cx - 2.5 + 0.0; g.p.y = w.cy + 5.1; g.p.dir = 1; g.updateNpcs(0.1); });
await wait(200);
await tap('#b-a');
await wait(300);
s = await st();
ok(s.dlg, 'A talks to the Mayor');
await clearDialogs();
ok(await page.evaluate(() => window.__glim.game.s.quests.flags.met_mayor), 'met the Mayor');

// hotbar
await page.evaluate(() => { document.querySelectorAll('#hotbar .slot')[3].scrollIntoView(); });
const slot3 = await page.evaluate(() => { const r = document.querySelectorAll('#hotbar .slot')[3].getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
await tapXY(slot3.x, slot3.y);
ok((await st()).sel === 3, 'tapping a hotbar slot selects it');

// A chops/pulls a weed in the field
const cleared = await page.evaluate(() => {
    const g = window.__glim.game, w = g.world, f = w.glen.farm;
    for (let y = f.y; y < f.y + f.h; y++) for (let x = f.x; x < f.x + f.w; x++) if (w.obj[y * w.W + x] === 5) { g.p.x = x + 0.5; g.p.y = y + 1.9; g.p.dir = 1; return y * w.W + x; }
    return -1;
});
await tap('#b-a'); await wait(250);
ok(cleared >= 0 && await page.evaluate(i => window.__glim.game.world.obj[i] === 0, cleared), 'A pulls a weed');

// panels
await tap('#b-menu'); await wait(300);
ok((await st()).panel === 'menu', 'menu opens');
for (const t of ['Journal', 'Village', 'You', 'Recipes', 'Save']) { await tapText(t, '#panel-tabs'); await wait(150); }
ok(await page.evaluate(() => document.querySelector('#panel-body').textContent.includes('Autosave')), 'save tab shows the slots');
await tapText('Save', '#panel-body'); await wait(200);
await tap('#panel-close'); await wait(200);
ok(!(await st()).panel, 'menu closes');
await tap('#b-map'); await wait(300);
ok((await st()).panel === 'map' && await page.evaluate(() => !!document.querySelector('.map-wrap canvas')), 'map opens with a drawn map');
await tap('#panel-close'); await wait(200);
// the job board site
await page.evaluate(() => { const g = window.__glim.game, b = g.world.glen.board; g.give('wood', 15); g.p.x = b.x + 0.5; g.p.y = b.y + 1.9; g.p.dir = 1; });
await tap('#b-a'); await wait(300);
ok((await st()).dlg, 'the old board offers a rebuild');
await toChoices();
await tapText('Rebuild', '#dlg-choices'); await wait(300);
ok(await page.evaluate(() => window.__glim.game.s.village.board), 'rebuilt the Job Board by touch');
await clearDialogs();
await tap('#b-a'); await wait(300);
ok((await st()).panel === 'board', 'the Job Board panel opens');
await tap('#panel-close'); await wait(200);

// a battle, by touch
await page.evaluate(() => { const g = window.__glim.game; g.p.level = 5; g.refreshStats(); g.p.hp = g.p.maxHp; g.startBattle([{ sp: 'r1s0' }], { region: 1, bg: 'forest' }); });
await wait(500);
ok((await st()).battle && await page.evaluate(() => !document.querySelector('#battle-ui').hidden), 'battle UI shows');
for (let k = 0; k < 20; k++) {
    const over = await page.evaluate(() => window.__glim.game.rt.battle?.over);
    const busy = await page.evaluate(() => window.__glim.ui.battle.busy);
    if (over && !busy) break;
    if (!busy) await tapText('Attack', '#battle-cmds');
    await wait(900);
}
ok(await page.evaluate(() => window.__glim.game.rt.battle?.over === 'win'), 'won the battle with the Attack button');
await tapText('Continue', '#battle-cmds'); await wait(400);
ok(!(await st()).battle && await page.evaluate(() => !document.querySelector('#hud').hidden), 'back to the Glen after the battle');

// save to slot 1, reload, continue
await tap('#b-menu'); await wait(200);
await tapText('Save', '#panel-tabs'); await wait(150);
page.once('dialog', d => d.accept());
const slotBtn = await page.evaluate(() => { const rows = [...document.querySelectorAll('#panel-body .row')]; const r = rows.find(r => r.textContent.includes('Slot 1')); const b = r?.querySelector('button'); if (!b) return null; b.scrollIntoView({ block: 'center' }); const q = b.getBoundingClientRect(); return { x: q.left + q.width / 2, y: q.top + q.height / 2 }; });
if (slotBtn) await tapXY(slotBtn.x, slotBtn.y);
await wait(300);
ok(await page.evaluate(() => !!localStorage.getItem('glimmerglen.v1.1')), 'saved to slot 1');
const name = (await st()).name;
await page.evaluate(() => sessionStorage.setItem('keep', '1'));
await page.reload();
await wait(1200);
ok((await st()).mode === 'title' && await page.evaluate(() => document.body.textContent.includes('Continue')), 'title offers Continue after reload');
await tapText('Continue'); await wait(800);
s = await st();
ok(s.mode === 'play' && s.name === name && await page.evaluate(() => window.__glim.game.s.village.board), `continued as ${name} with the board still built`);

await browser.close();
if (errors.length) { console.log('console/page errors:\n' + errors.join('\n')); fail += errors.length; }
console.log(`${LAND ? 'landscape' : 'portrait'}: ${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

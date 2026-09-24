/**
 * flowtest.mjs — the screen state machine in a real browser (keyboard-driven):
 * clear a level -> map advances; a vault item -> gadget panel -> resume; a boss -> gadget ->
 * next world unlocked; losing every life -> game over -> map with progress kept; save survives
 * a reload. Screenshots of the overlays land in dev/shots/.
 *
 *   node dev/flowtest.mjs     (needs python3 -m http.server 8042 at the repo root)
 */
import { chromium } from 'playwright';
import { mkdirSync } from 'fs';
const BASE = process.env.BASE ?? 'http://127.0.0.1:8042';
const OUT = new URL('./shots/', import.meta.url).pathname;
mkdirSync(OUT, { recursive: true });
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH, args: ['--no-sandbox'] });
const ctx = await browser.newContext({ viewport: { width: 960, height: 600 } });
const page = await ctx.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(String(e)));
let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL', m); } };
const st = () => page.evaluate(() => { const P = window.__pip; return { screen: P.view.screen, overlay: P.view.overlay, save: JSON.parse(JSON.stringify(P.save)), mapWorld: P.view.mapWorld, mapSel: P.view.mapSel, hp: P.game && P.game.player.hp }; });
const wait = ms => page.waitForTimeout(ms);

await page.addInitScript(() => { if (!sessionStorage.getItem('kept')) { localStorage.clear(); sessionStorage.setItem('kept', '1'); } });
await page.goto(`${BASE}/game-042/index.html`);
await wait(600);
await page.keyboard.press('Enter');   // NEW GAME
await wait(400);
await page.keyboard.press('KeyZ');    // enter 1-1
await wait(2400);
ok((await st()).screen === 'play', 'map -> card -> play');

// clear 1-1: put Pip just before the flag
await page.evaluate(() => { const g = window.__pip.game; g.player.x = (g.goal.x - 3) * 16; g.player.y = (g.goal.y - 6) * 16; });
await page.keyboard.down('ArrowRight');
for (let i = 0; i < 40 && (await st()).screen === 'play'; i++) await wait(250);
await page.keyboard.up('ArrowRight');
let s = await st();
ok(s.screen === 'map' && s.save.cleared.includes('1-1'), 'flag -> tally -> back on the map with 1-1 cleared');
await wait(500);
s = await st();
ok(s.mapSel === 1, 'the map walks Pip on to 1-2');

// a vault item mid-level
await page.keyboard.press('KeyZ');
await wait(2400);
await page.evaluate(() => { const g = window.__pip.game; const v = g.pickups.find(k => k.t === 'vault'); if (v) { g.player.x = v.x; g.player.y = v.y; } });
await wait(300);
s = await st();
ok(s.overlay === 'gadget', 'touching a vault item opens the gadget panel');
await page.screenshot({ path: `${OUT}flow-vault.png` });
await wait(900);
await page.keyboard.press('KeyZ');
await wait(200);
s = await st();
ok(s.overlay === null && s.screen === 'play' && s.save.maxHearts === 4 && s.hp === 4, 'heart container: 4 max hearts, healed, back to play');

// jump straight to the castle: beat Chompo
await page.evaluate(() => { const s = window.__pip.save; for (const k of ['1-2', '1-3', '1-4']) if (!s.cleared.includes(k)) s.cleared.push(k); window.__pip.enterLevel(1, 5); });
await wait(2400);
await page.evaluate(() => { const g = window.__pip.game; g.player.x = g.arenaPx.x0 + 80; g.player.y = g.arenaPx.floor - 20; });
await wait(600);
await page.screenshot({ path: `${OUT}flow-boss.png` });
await page.evaluate(() => { const g = window.__pip.game; g.damageBoss(999, 0, 0); });
await wait(2600);
await page.evaluate(() => { const g = window.__pip.game; const k = g.pickups.find(k => k.t === 'gadget'); g.player.x = k.x; g.player.y = k.y; });
await wait(300);
s = await st();
ok(s.overlay === 'gadget' && s.save.gadgets.includes('boots'), 'Chompo drops the Spring Boots');
await page.screenshot({ path: `${OUT}flow-gadget.png` });
await wait(900);
await page.keyboard.press('KeyZ');
await wait(400);
s = await st();
ok(s.screen === 'map' && s.mapWorld === 2 && s.save.cleared.includes('1-5'), 'after the gadget: World 2 map');
await page.screenshot({ path: `${OUT}flow-map2.png` });

// lose every life
await page.keyboard.press('KeyZ');
await wait(2400);
for (let life = 0; life < 6 && (await st()).screen !== 'gameover'; life++) {
    await page.evaluate(() => { const g = window.__pip.game; if (g) { g.player.hp = 1; g.player.invuln = 0; g.hurt(); } });
    await wait(3200);
    if ((await st()).screen === 'card') await wait(2200);
}
s = await st();
ok(s.screen === 'gameover', 'running out of lives -> GAME OVER');
await page.screenshot({ path: `${OUT}flow-gameover.png` });
await wait(1400);
await page.keyboard.press('KeyZ');
await wait(400);
s = await st();
ok(s.screen === 'map' && s.save.lives === 5 && s.save.gadgets.includes('boots'), 'CONTINUE -> map, 5 lives, gadgets kept');

// reload keeps the save
await page.reload();
await wait(700);
s = await st();
ok(s.save && s.save.cleared.includes('1-5'), 'the save survives a reload');
await page.screenshot({ path: `${OUT}flow-title-continue.png` });
ok(errors.length === 0, 'no console errors: ' + errors.join(' | '));
console.log(`\n${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);

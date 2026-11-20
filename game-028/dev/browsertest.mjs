// Echoes of Aethermoor — the browser test. Real keys, clicks and taps in Chromium: the title, the prologue, walking,
// talking and choosing, the menu, the hint, a battle by the menus, a shop and equipping, save and continue; two
// touch-only phones; blocked storage. Screenshots land in game-028/dev/shots/.   node game-028/dev/browsertest.mjs
import { launch, serve, BASE } from './serve.mjs';

const URL = `${BASE}/game-028/index.html?debug=1&fast=3`;
let pass = 0, fail = 0;
const ok = (c, msg) => { if (c) { pass++; console.log('  ok', msg); } else { fail++; console.log('  FAIL', msg); } };
const browser = await launch();
const errors = [];

async function open(opts = {}, init) {
    const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, ...opts });
    if (init) await ctx.addInitScript(init);
    const page = await ctx.newPage();
    await serve(page);
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('console', (m) => { if (m.type() === 'error' && !/Failed to load resource|fonts/.test(m.text())) errors.push(m.text()); });
    await page.goto(URL);
    await page.waitForFunction(() => window.__ea && !document.getElementById('title').hidden, null, { timeout: 60000 });
    return { ctx, page };
}
const ea = (page, js) => page.evaluate(`(() => { const __ = window.__ea; return (${js}); })()`);
const idle = (page) => page.waitForFunction(() => !window.__ea.busy(), null, { timeout: 20000 });
const shot = (page, name) => page.screenshot({ path: `game-028/dev/shots/test-${name}.png` });

async function finishAnims(page) {
    await page.evaluate(() => { for (const el of document.querySelectorAll('*')) for (const a of el.getAnimations?.() || []) a.finish(); });
}

/** Walk with real arrow keys along the sim's path. */
async function walkTo(page, x, y, adj = false) {
    const dirs = await ea(page, `__.path(${x}, ${y}, ${adj})`);
    if (!dirs) return false;
    const KEY = { up: 'ArrowUp', down: 'ArrowDown', left: 'ArrowLeft', right: 'ArrowRight' };
    for (const d of dirs) {
        await idle(page);
        if (await ea(page, '__.mode()') !== 'explore') return false;
        await page.keyboard.down(KEY[d]); await page.waitForTimeout(30); await page.keyboard.up(KEY[d]);
        await page.waitForFunction(() => !window.__ea.mapView.busy, null, { timeout: 5000 });
    }
    await idle(page);
    return true;
}

/** Press Space (or a digit) through dialogue until it closes. */
async function talkThrough(page, picks = []) {
    for (let n = 0; n < 200 && await ea(page, '__.mode()') === 'dialog'; n++) {
        const choosing = await page.evaluate(() => document.getElementById('dlg-choices').children.length > 0);
        if (choosing) await page.keyboard.press('Digit' + (picks.shift() || 1));
        else await page.keyboard.press('Space');
        await page.waitForTimeout(40);
    }
}

// ------------------------------------------------------------------ desktop
console.log('\n# desktop');
{
    const { ctx, page } = await open();
    ok(await page.evaluate(() => document.getElementById('btn-continue').hidden), 'no save: no Continue');
    await page.click('#btn-new');
    await page.waitForFunction(() => window.__ea.mode() === 'dialog');
    await page.waitForTimeout(500);
    ok(await page.evaluate(() => !!document.getElementById('dlg-text').textContent), 'the prologue types out');
    ok(await ea(page, `__.audio.voiceEl?.src.includes('audio/vo/')`), 'the narrator speaks a recorded line');
    await shot(page, 'prologue');
    await talkThrough(page);
    ok(await ea(page, '__.mode()') === 'explore', 'Space through the prologue reaches the village');
    ok(await ea(page, `__.G.quests.lyras_past?.s === 'active'`), 'Lyra\'s Past is in the journal');
    ok(await ea(page, `Object.values(__.audio.tracks).some((t) => !t.paused)`), 'the village theme is playing');
    ok(await ea(page, `Object.values(__.audio.buffers).filter(Boolean).length >= 15`), 'the effects decoded');
    // walk to Varec and take his quest
    ok(await walkTo(page, 3, 4, true), 'walked to Elder Varec by arrow keys');
    const steps = await ea(page, '__.G.stats.steps');
    ok(steps > 3, `the party walked (${steps} steps)`);
    // face Varec by walking into him: that talks
    const toward = await ea(page, `(() => { const dx = 3 - __.G.x, dy = 4 - __.G.y; return dx > 0 ? 'ArrowRight' : dx < 0 ? 'ArrowLeft' : dy > 0 ? 'ArrowDown' : 'ArrowUp'; })()`);
    await page.keyboard.press(toward); await page.waitForTimeout(150);
    await page.waitForFunction(() => window.__ea.mode() === 'dialog', null, { timeout: 5000 }).catch(() => {});
    ok(await ea(page, `__.G.dialog?.tree === 'varec'`), 'talking to Varec');
    await page.waitForTimeout(300);
    await shot(page, 'varec');
    await talkThrough(page, [1, 1]);
    ok(await ea(page, `__.G.quests.the_missing_merchant?.s === 'active'`), 'choices by number keys took the quest');
    // the hint and the menu
    await page.waitForTimeout(400);
    await page.keyboard.press('KeyH');
    await page.waitForTimeout(200);
    ok(await page.evaluate(() => !document.getElementById('hint').hidden && /bandits/.test(document.getElementById('hint-text').textContent)), 'H says where to go next');
    await page.keyboard.press('KeyM');
    await page.waitForTimeout(300);
    ok(await page.evaluate(() => !document.getElementById('menu').hidden), 'M opens the menu');
    await page.click('#menu-tabs [data-tab=journal]');
    ok(await page.evaluate(() => document.getElementById('menu-body').textContent.includes('The Missing Merchant')), 'the journal lists the quest');
    await page.click('#menu-tabs [data-tab=party]');
    await page.click('[data-slot=weapon][data-who=lyra]');
    ok(await page.evaluate(() => !document.getElementById('picker').hidden), 'a weapon slot opens the picker');
    await page.keyboard.press('Escape'); await page.waitForTimeout(100);
    await page.keyboard.press('Escape'); await page.waitForTimeout(100);
    ok(await page.evaluate(() => document.getElementById('menu').hidden && document.getElementById('picker').hidden), 'Escape closes the picker, then the menu');
    // a battle, by clicks
    await ea(page, `__.G.level = 4, __.fight('slimes2')`);
    for (let n = 0; n < 80 && await ea(page, `__.mode() === 'battle' && !__.G.battle.over`); n++) {
        await page.waitForFunction(() => document.querySelector('#b-menu [data-b=attack]') || window.__ea.G.battle?.over, null, { timeout: 20000 });
        if (await ea(page, '__.G.battle.over')) break;
        await page.click('#b-menu [data-b=attack]');
        await page.waitForTimeout(80);
        const tgt = await page.$('#b-targets .tgt');
        if (tgt) { if (n === 0) await shot(page, 'targets'); await tgt.click(); }
    }
    await page.waitForFunction(() => !document.getElementById('b-result').hidden, null, { timeout: 20000 });
    await finishAnims(page);
    await shot(page, 'victory');
    ok(await page.evaluate(() => document.getElementById('b-result-title').textContent === 'Victory'), 'the battle is won by clicking Attack');
    await page.click('#b-result-foot .gold');
    await idle(page);
    ok(await ea(page, `__.mode() === 'explore' && document.getElementById('battle').hidden`), 'Continue returns to the map');
    ok(await page.evaluate(() => { try { return !!localStorage.getItem('echoes-of-aethermoor.v2'); } catch { return false; } }), 'the game saved');
    // Auto carries on into the next battle, and a bar hands control back
    await ea(page, `__.fight('slimes2')`);
    await page.waitForSelector('#b-menu [data-b=auto]', { timeout: 20000 });
    await page.click('#b-menu [data-b=auto]');
    ok(await page.waitForSelector('#b-menu [data-b=manual]', { timeout: 5000 }).then(() => true, () => false), 'Auto shows a Take control bar');
    await page.waitForFunction(() => !document.getElementById('b-result').hidden, null, { timeout: 60000 });
    await page.click('#b-result-foot .gold');
    await idle(page);
    await ea(page, `__.fight('slimes2')`);
    ok(await page.waitForSelector('#b-menu [data-b=manual]', { timeout: 5000 }).then(() => true, () => false), 'the next battle starts on Auto, with the bar showing');
    await shot(page, 'autobar');
    await page.click('#b-menu [data-b=manual]');
    ok(await page.waitForSelector('#b-menu [data-b=attack]', { timeout: 20000 }).then(() => true, () => false) || await ea(page, '__.G.battle?.over'), 'Take control brings the commands back');
    await ea(page, `__.G.battle.over || (__.G.battle.units.filter((u) => u.side === 'e').forEach((u) => u.hp = 1), true)`);
    for (let n = 0; n < 40 && await ea(page, `__.mode() === 'battle' && !__.G.battle.over`); n++) {
        await page.waitForFunction(() => document.querySelector('#b-menu [data-b=attack]') || window.__ea.G.battle?.over, null, { timeout: 20000 });
        if (await ea(page, '__.G.battle.over')) break;
        await page.click('#b-menu [data-b=attack]'); await page.waitForTimeout(80);
        const tgt = await page.$('#b-targets .tgt'); if (tgt) await tgt.click();
    }
    await page.waitForFunction(() => !document.getElementById('b-result').hidden, null, { timeout: 20000 });
    await page.click('#b-result-foot .gold');
    await idle(page);
    // the forge: buy and equip
    await ea(page, `(__.G.gold = 500, __.warp('forge', 3, 3), __.G.face = 'up')`);
    await page.keyboard.press('Space');
    await talkThrough(page, [1]);
    await page.waitForFunction(() => !document.getElementById('shop').hidden, null, { timeout: 5000 });
    await page.click('[data-buy=mage_staff]');
    await page.waitForTimeout(200);
    ok(await page.evaluate(() => !document.getElementById('picker').hidden), 'buying a staff offers to equip it');
    await page.click('#picker-body [data-who=lyra]');
    ok(await ea(page, `__.G.equip.lyra.weapon === 'mage_staff' && __.G.gold === 380`), 'bought for 120 and equipped on Lyra');
    await page.click('#shop-tabs [data-tab=sell]');
    await shot(page, 'shop');
    await page.click('#shop-close');
    await idle(page);
    ok(await ea(page, `__.mode() === 'explore'`), 'Leave closes the shop');
    // continue after a reload
    await ea(page, `__.warp('thornhaven', 9, 7)`);
    await page.reload();
    await page.waitForFunction(() => window.__ea && !document.getElementById('title').hidden, null, { timeout: 60000 });
    ok(await page.evaluate(() => !document.getElementById('btn-continue').hidden), 'a save shows Continue');
    await page.click('#btn-continue');
    await page.waitForTimeout(500);
    ok(await ea(page, `__.G.equip.lyra.weapon === 'mage_staff' && __.G.quests.the_missing_merchant?.s === 'active'`), 'Continue restores the game');
    await shot(page, 'continued');
    await ctx.close();
}

// ------------------------------------------------------------------ phones
for (const [name, vp] of [['phone', { width: 390, height: 844 }], ['landscape', { width: 844, height: 390 }]]) {
    console.log(`\n# ${name} (touch only)`);
    const { ctx, page } = await open({ viewport: vp, hasTouch: true, isMobile: true, deviceScaleFactor: 2 });
    await page.tap('#btn-new');
    await page.waitForFunction(() => window.__ea.mode() === 'dialog');
    for (let n = 0; n < 60 && await ea(page, '__.mode()') === 'dialog'; n++) { await page.tap('#dlg .box'); await page.waitForTimeout(30); }
    ok(await ea(page, '__.mode()') === 'explore', 'taps carry the prologue');
    ok(await page.evaluate(() => !document.getElementById('touch').hidden), 'the touch pad is on');
    const box = await page.evaluate(() => { const r = document.getElementById('dlg').getBoundingClientRect(); return r.bottom <= innerHeight + 1; });
    ok(box, 'the dialogue box fits the screen');
    // tap a tile three steps up: the party walks there
    const before = await ea(page, '[__.G.x, __.G.y]');
    const pt = await ea(page, `(() => { const m = __.mapView, T = m.T / m.dpr; return [(__.G.x + 0.5) * T - m.cam.x / m.dpr, (__.G.y - 2.5) * T - m.cam.y / m.dpr]; })()`);
    await page.touchscreen.tap(pt[0], pt[1]);
    await page.waitForTimeout(1500);
    const after = await ea(page, '[__.G.x, __.G.y]');
    ok(after[1] < before[1], `a tap on the map walks there (${before} → ${after})`);
    // the pad
    const pad = await page.$('#dpad [data-dir=down]');
    const r = await pad.boundingBox();
    await page.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2);
    await page.waitForTimeout(400);
    ok((await ea(page, '__.G.stats.steps')) > 0, 'the pad walks');
    // a battle by taps
    await ea(page, `__.G.level = 5, __.fight('slimes1')`);
    for (let n = 0; n < 40 && await ea(page, `__.mode() === 'battle' && !__.G.battle.over`); n++) {
        await page.waitForFunction(() => document.querySelector('#b-menu [data-b=attack]') || window.__ea.G.battle?.over, null, { timeout: 20000 });
        if (await ea(page, '__.G.battle.over')) break;
        await page.tap('#b-menu [data-b=attack]');
        await page.waitForTimeout(80);
    }
    await page.waitForFunction(() => !document.getElementById('b-result').hidden, null, { timeout: 20000 });
    await finishAnims(page);
    await shot(page, name + '-victory');
    await page.tap('#b-result-foot .gold');
    await idle(page);
    ok(await ea(page, `__.mode() === 'explore'`), 'a battle won by taps');
    await page.tap('#btn-menu');
    await page.waitForTimeout(300);
    await finishAnims(page);
    const menuOk = await page.evaluate(() => { const r = document.querySelector('#menu .sheet').getBoundingClientRect(); const f = document.querySelector('#menu .sheet-foot .btn').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && f.bottom <= innerHeight; });
    ok(menuOk, 'the menu fits and its Done button is on screen');
    await shot(page, name + '-menu');
    await page.tap('#menu .sheet-foot .btn');
    await shot(page, name + '-map');
    await ctx.close();
}

// ------------------------------------------------------------------ blocked storage
console.log('\n# blocked storage');
{
    const { ctx, page } = await open({}, () => { Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } }); });
    await page.click('#btn-new');
    await page.waitForFunction(() => window.__ea.mode() === 'dialog');
    await talkThrough(page);
    ok(await ea(page, '__.mode()') === 'explore', 'plays with storage blocked');
    await ctx.close();
}

// ------------------------------------------------------------------ autoplay, sped up, through to the ending
console.log('\n# autoplay to the ending');
{
    const { ctx, page } = await open();
    await ea(page, `(__.start(5), __.autoplay(true), true)`);
    await page.waitForFunction(() => window.__ea.G?.stats.battles >= 3 && window.__ea.G.quests.the_missing_merchant, null, { timeout: 180000 }).catch(() => {});
    ok(await ea(page, '__.G.stats.battles >= 3 && !!__.G.quests.the_missing_merchant'), `autoplay in the browser talks, walks and fights (${await ea(page, '__.G.stats.battles')} battles, chapter ${await ea(page, '__.G.chapter')})`);
    await shot(page, 'autoplay');
    await ctx.close();
}

ok(errors.length === 0, `no page errors${errors.length ? ': ' + errors.slice(0, 5).join(' | ') : ''}`);
await browser.close();
console.log(`\n${pass} passed, ${fail} failed`);
process.exit(fail ? 1 : 0);

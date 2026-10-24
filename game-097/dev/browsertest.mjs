/**
 * browsertest.mjs — the real game in real Chromium (SwiftShader WebGL).
 *
 * desktop (1280×760): boot to the title with no errors, the ← Games link on top, Space presses the
 *   focused button → New Game → summon ×10 (cards, shards) → roster party toggle → the campaign
 *   (chapter 2 locked) → March → a real mouse click selects a piece and shows its squares → a click
 *   moves it → keys (Tab, arrows, Esc, T) → a capture shows the duel forecast → Strike plays the
 *   cut-in arena → pause freezes the sim → Save & Quit → Continue restores the battle → the bot
 *   wins (fast-forward) → the result screen → back to the sanctum with the next chapter open.
 * phones (touch only, real touches) at 390×844 and 844×390: taps through every menu, every control
 *   ≥ 44 px and on screen, no sideways scroll, the canvas matches the visible viewport, the whole
 *   board sits in the space the HUD leaves, a tap on each of the 64 squares picks that square, a
 *   piece is selected and moved by touch, the pause screen stays open after the finger lifts, and
 *   the duel arena frames both fighters.
 * nostorage: localStorage throws; the game still boots and plays.
 * Fails on any console error, page error or failed request.
 *
 *   python3 -m http.server 8097          # from the REPO ROOT
 *   node game-097/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8097), ONLY=desktop,phones,nostorage, THREE_PKG.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8097';
const OUT = path.join(HERE, 'shots');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const want = (name) => !ONLY.length || ONLY.includes(name);
fs.mkdirSync(OUT, { recursive: true });

let fails = 0;
let errors = [];
let browser = null;

async function open(viewport, { touch = false, nostorage = false } = {}) {
    if (browser) await browser.close();
    browser = await chromium.launch({
        executablePath: process.env.PW_CHROMIUM_PATH || undefined,
        args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
    });
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch });
    await ctx.addInitScript((ns) => {
        if (ns) Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } });
        else try { localStorage.clear(); } catch { /* */ }
    }, nostorage);
    const page = await ctx.newPage();
    if (PKG) {
        // No network to the CDN? Serve the genuine three.js package from disk.
        await page.route('https://unpkg.com/**', (route) => {
            const rel = new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, '');
            const file = path.join(PKG, rel);
            if (!fs.existsSync(file)) return route.abort();
            route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
        });
    }
    await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('requestfailed', (r) => { if (!r.url().includes('favicon')) errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`); });
    await page.goto(`${BASE}/game-097/index.html?debug=1&fast=4`);
    await page.waitForFunction(() => window.__hg && __hg.mode === 'title', null, { timeout: 60000 });
    return page;
}

const check = (cond, msg) => { if (!cond) { fails++; console.log('  FAIL', msg); } else console.log('  ok', msg); return cond; };
const Q = (page, fn, arg) => page.evaluate(fn, arg);
const shot = async (page, name) => { await page.screenshot({ path: path.join(OUT, `bt-${name}.png`) }); };
// SwiftShader draws a few frames a second: wait on state, never on the clock.
const until = (page, fn, msg, timeout = 40000, arg = null) =>
    page.waitForFunction(fn, arg, { timeout, polling: 100 }).then(() => check(true, msg), () => check(false, msg));
// Playwright's click() waits for animation frames to settle, which SwiftShader never does; click from inside.
const click = (page, sel) => Q(page, (s) => { const e = document.querySelector(s); if (!e) return false; e.click(); return true; }, sel);
const idle = (page, msg, n = 1) => until(page, (k) => (__hg.seen.phase || 0) >= k && !__hg.view.busy && __hg.G.events.length === 0 && !__hg.view.stage.arenaOn, msg, 60000, n);
const backLinkOk = (page) => Q(page, () => {
    const a = document.getElementById('back-link');
    if (!a || a.getAttribute('href') !== '../index.html') return false;
    const r = a.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return r.width > 0 && r.top >= 0 && (top === a || a.contains(top));
});
const layout = (page) => Q(page, () => {
    const vv = window.visualViewport;
    const c = document.getElementById('view').getBoundingClientRect();
    return {
        noHScroll: document.documentElement.scrollWidth <= innerWidth + 1,
        canvas: Math.abs(c.width - (vv?.width ?? innerWidth)) < 2 && Math.abs(c.height - (vv?.height ?? innerHeight)) < 2 && c.left === 0 && c.top === 0,
    };
});
const reportErrors = (label) => { check(errors.length === 0, `${label}: no console errors, page errors or failed requests`); for (const e of errors.slice(0, 8)) console.log('    ', e); };

/** Every visible control on the page, with its box. */
const controls = (page) => Q(page, () => [...document.querySelectorAll('button, .ibtn, a#back-link, select, input[type=checkbox], input[type=range]')]
    .filter((e) => e.getClientRects().length && getComputedStyle(e).visibility !== 'hidden' && !e.closest('[hidden]'))
    .map((e) => { const r = e.getBoundingClientRect(); const row = e.closest('.row'); const rr = row ? row.getBoundingClientRect() : r; const sh = e.closest('.sheet'); return { id: e.id || e.className || e.textContent.trim().slice(0, 20), w: r.width, h: r.height, rw: rr.width, rh: rr.height, l: r.left, t: r.top, r: r.right, b: r.bottom, back: e.id === 'back-link', scroll: !!sh && sh.scrollHeight > sh.clientHeight + 1 }; }));
// a row of label + control is one tap target; a sheet that scrolls may keep controls below the fold
const bigEnough = (list) => list.filter((c) => !c.back && (Math.max(c.h, c.rh) < 44 || Math.max(c.w, c.rw) < 44) && !/ucard|chapter/.test(c.id));
const onScreen = (list, w, h) => list.filter((c) => c.l < -1 || c.r > w + 1 || (!c.scroll && (c.t < -1 || c.b > h + 1)));

/** Board square → client px, and the other way round, through the real camera. */
const squarePx = (page, x, y) => Q(page, ([x, y]) => __hg.screenOf(x, y), [x, y]);

/** A scenario: Gideon on (2,5) with a clear rook line to a Bone Thrall on (2,2) (chapter 1). */
const setupDuel = (page) => Q(page, () => {
    const B = __hg.G.battle;
    const g = B.units.find((u) => u.key === 'gideon'), t = B.units.find((u) => u.key === 'thrall');
    g.x = 2; g.y = 5; t.x = 2; t.y = 2;
    for (const u of B.units) if (u !== g && u !== t && u.x === 2 && (u.y === 3 || u.y === 4)) u.y = 7;
    return { g: g.id, t: t.id };
});

// ======================================================================
async function desktop() {
    console.log('\n== desktop 1280×760');
    const page = await open({ width: 1280, height: 760 });
    check(await backLinkOk(page), '← Games link is on top and points at ../index.html');
    check(await Q(page, () => !document.getElementById('title').hidden), 'title screen is up');
    check(await Q(page, () => document.getElementById('btn-continue').hidden), 'no Continue without a save');
    const L = await layout(page);
    check(L.noHScroll && L.canvas, 'no sideways scroll; the canvas fills the window');
    await shot(page, 'desktop-title');

    // Space must press the focused button (a handler that cancels Space also cancels the click)
    check(await Q(page, () => document.activeElement?.dataset?.act === 'new'), 'New Game has the focus');
    await page.keyboard.press('Space');
    await until(page, () => __hg.mode === 'hub' && !document.getElementById('hub').hidden, 'Space on the focused button starts the game (the sanctum)');
    check(await Q(page, () => document.getElementById('hub-shards').textContent === '1000'), 'the sanctum shows 1000 shards');
    await shot(page, 'desktop-hub');

    // summon ten
    await click(page, '#hub-menu [data-act="summon"]');
    await until(page, () => !document.getElementById('summon').hidden, 'the summoning screen opens');
    await click(page, '#btn-sum10');
    await until(page, () => !document.getElementById('summon-result').hidden && document.querySelectorAll('#pulls .pull').length === 10, 'Summon ×10 shows ten cards');
    check(await Q(page, () => __hg.G.meta.shards === 100 && __hg.G.meta.pulls === 10), 'it cost 900 shards');
    await page.waitForTimeout(1500);
    await shot(page, 'desktop-summon');
    await click(page, '#btn-pulls-skip');
    await click(page, '#btn-pulls-done');
    await until(page, () => document.getElementById('summon-result').hidden && !document.getElementById('summon').hidden, 'Accept returns to the summoning screen');
    check(await Q(page, () => document.getElementById('btn-sum10').disabled === true && document.getElementById('btn-sum1').disabled === false), 'with 100 shards: ×10 is off, ×1 is on');
    await click(page, '#summon [data-close]');

    // roster and party
    await click(page, '#hub-menu [data-act="roster"]');
    await until(page, () => !document.getElementById('roster').hidden && document.querySelectorAll('.ucard').length >= 4, 'the roster lists the new pieces');
    const before = await Q(page, () => __hg.G.meta.party.length);
    await Q(page, () => { const c = [...document.querySelectorAll('.ucard')].find((e) => !e.querySelector('.slot')); c?.click(); });
    await Q(page, () => document.querySelector('#roster-detail [data-party]').click());
    check(await Q(page, (b) => __hg.G.meta.party.length === Math.min(5, b + 1), before), 'adding a piece to the party works');
    check(await Q(page, () => document.querySelectorAll('.diagram.big .dg').length === 81), 'the detail shows a 9×9 movement diagram');
    await shot(page, 'desktop-roster');
    await Q(page, () => document.querySelector('#roster-detail [data-party]').click());
    check(await Q(page, (b) => __hg.G.meta.party.length === b, before), 'and removing it again');
    await click(page, '#roster [data-close]');

    // the campaign
    await click(page, '#hub-menu [data-act="campaign"]');
    await until(page, () => !document.getElementById('campaign').hidden, 'the campaign opens');
    check(await Q(page, () => document.querySelectorAll('.chapter.locked').length === 5), 'only chapter 1 is open');
    await Q(page, () => document.querySelectorAll('.chapter')[1].click());
    check(await Q(page, () => __hg.ui.chSel === 0), 'a locked chapter cannot be selected');
    await shot(page, 'desktop-campaign');
    await click(page, '#btn-march');
    await until(page, () => __hg.mode === 'battle' && document.getElementById('campaign').hidden, 'March starts the battle');
    await idle(page, 'the opening phase banner is over');
    check(await Q(page, () => !document.getElementById('bhud').hidden), 'the battle HUD is up');
    const lay = await layout(page);
    check(lay.noHScroll && lay.canvas, 'no sideways scroll in battle; the canvas fills the window');
    await shot(page, 'desktop-battle');

    // select with a real mouse click on the canvas
    const maren = await Q(page, () => { const u = __hg.G.battle.units.find((x) => x.key === 'maren'); return { id: u.id, x: u.x, y: u.y }; });
    let p = await squarePx(page, maren.x, maren.y);
    await page.mouse.click(p.x, p.y);
    await until(page, (id) => __hg.play.sel === id && __hg.play.mode === 'move', 'a click on a piece selects it', 20000, maren.id);
    check(await Q(page, () => __hg.view.hl.filter((h) => h.visible).length > 0), 'its squares are highlighted');
    check(await Q(page, () => document.getElementById('uc-name').textContent.startsWith('Maren')), 'and its card is shown');
    await shot(page, 'desktop-select');
    // click a square she can reach
    const dest = await Q(page, () => {
        const B = __hg.G.battle, u = B.units.find((x) => x.key === 'maren');
        return { x: u.x, y: u.y - 1 };
    });
    p = await squarePx(page, dest.x, dest.y);
    await page.mouse.click(p.x, p.y);
    await until(page, ([id, x, y]) => { const u = __hg.G.battle.units.find((o) => o.id === id); return u.x === x && u.y === y && u.acted; }, 'a click on a blue square moves her', 20000, [maren.id, dest.x, dest.y]);
    await idle(page, 'the move finishes playing');
    check(await Q(page, () => __hg.play.sel === null), 'and the selection clears');

    // keys: Tab picks the next piece, arrows move the cursor, Esc cancels
    await page.keyboard.press('Tab');
    await until(page, () => __hg.play.sel !== null, 'Tab selects the next piece');
    const sel0 = await Q(page, () => __hg.play.sel);
    await page.keyboard.press('Tab');
    await until(page, (s) => __hg.play.sel !== null && __hg.play.sel !== s, 'Tab again cycles to another', 20000, sel0);
    await page.keyboard.press('ArrowLeft');
    await until(page, () => __hg.view.curBox.visible, 'arrow keys show the cursor');
    await page.keyboard.press('Escape');
    await until(page, () => __hg.play.sel === null, 'Escape deselects');

    // a capture: the forecast comes first, then the duel
    const { g, t } = await setupDuel(page);
    p = await squarePx(page, 2, 5);
    await page.mouse.click(p.x, p.y);
    await until(page, (id) => __hg.play.sel === id, 'select Gideon on his new square', 20000, g);
    p = await squarePx(page, 2, 2);
    await page.mouse.click(p.x, p.y);
    await until(page, () => !document.getElementById('forecast').hidden && __hg.play.mode === 'confirm', 'tapping an enemy shows the duel forecast, it does not strike');
    check(await Q(page, ([g, t]) => __hg.G.battle.units.find((u) => u.id === t)?.hp === __hg.G.battle.units.find((u) => u.id === t)?.hpMax && __hg.G.battle.units.find((u) => u.id === g)?.y === 5, [g, t]), 'nothing has happened yet');
    check(await Q(page, () => /DMG/.test(document.getElementById('fc-a').textContent) && /HIT/.test(document.getElementById('fc-d').textContent)), 'the forecast shows damage and hit chances for both');
    await shot(page, 'desktop-forecast');
    await click(page, '#btn-fc-no');
    await until(page, () => document.getElementById('forecast').hidden && __hg.play.mode === 'move', 'Cancel goes back to choosing a square');
    p = await squarePx(page, 2, 2);
    await page.mouse.click(p.x, p.y);
    await until(page, () => !document.getElementById('forecast').hidden, 'the forecast is up again');
    await page.mouse.click(p.x, p.y);
    await until(page, () => __hg.view.stage.arenaOn && !document.getElementById('cut').hidden, 'a second tap on the target strikes: the view cuts to the duel arena', 40000);
    await until(page, () => document.querySelectorAll('.float').length > 0, 'damage numbers float over the fighters');
    const frame = await Q(page, () => { const s = __hg.view.stage, cut = document.getElementById('cut').getBoundingClientRect().bottom; return ['a', 'd'].map((k) => s.project(s.arenaPos(k).setY(1.2))).map((q) => q.x >= 0 && q.x <= innerWidth && q.y >= cut && q.y <= innerHeight); });
    check(frame[0] && frame[1], 'both fighters are in frame');
    await shot(page, 'desktop-duel');
    await idle(page, 'the duel plays out and the camera returns to the board');
    check(await Q(page, () => (__hg.seen.battle || 0) >= 1), 'a battle event was seen');

    // end the turn by key: the enemy plays, it is our turn again
    await page.keyboard.press('KeyT');
    await until(page, () => __hg.G.battle.phase === 'e' || __hg.G.battle.turn >= 2, 'T ends the phase');
    await until(page, () => __hg.view.busy, 'the enemy phase is playing');
    await page.mouse.click(640, 400);
    check(await Q(page, () => __hg.view.boost === true), 'a tap while it plays hurries it along');
    await until(page, () => __hg.G.battle.phase === 'p' && __hg.G.battle.turn >= 2 && !__hg.view.busy, 'the enemy takes its turn and hands it back', 120000);
    check(await Q(page, () => __hg.G.battle.units.filter((u) => u.team === 'p').every((u) => !u.acted)), 'and your pieces are ready again');
    check(await Q(page, () => __hg.view.boost === false), 'and the hurry ended with the queue');

    // pause stops the game
    await page.keyboard.press('Escape');
    await until(page, () => !document.getElementById('pause').hidden, 'Escape pauses');
    const t0 = await Q(page, () => __hg.G.t);
    await page.waitForTimeout(500);
    check(await Q(page, (t) => __hg.G.t === t, t0), 'the sim stops while paused');
    await click(page, '#pause-menu [data-act="resume"]');
    await until(page, () => document.getElementById('pause').hidden, 'Resume closes the pause screen');

    // save and quit, then continue
    const snap = await Q(page, () => ({ turn: __hg.G.battle.turn, n: __hg.G.battle.units.length, hp: __hg.G.battle.units.map((u) => u.hp).join() }));
    await page.keyboard.press('Escape');
    await until(page, () => !document.getElementById('pause').hidden, 'pause again');
    await click(page, '#pause-menu [data-act="title"]');
    await until(page, () => __hg.mode === 'title' && !document.getElementById('btn-continue').hidden, 'Save & Quit returns to the title with Continue');
    await click(page, '#title-menu [data-act="continue"]');
    await until(page, () => __hg.mode === 'battle', 'Continue goes straight back into the battle');
    check(await Q(page, (s) => __hg.G.battle.turn === s.turn && __hg.G.battle.units.length === s.n && __hg.G.battle.units.map((u) => u.hp).join() === s.hp, snap), 'with the same turn, pieces and health');
    await idle(page, 'the board is redrawn', 1);

    // finish it
    await Q(page, () => __hg.ff());
    await until(page, () => !document.getElementById('result').hidden, 'winning shows the result screen', 60000);
    check(await Q(page, () => /Victory/.test(document.getElementById('res-title').textContent) && /◆/.test(document.getElementById('res-body').textContent)), 'with the reward');
    await shot(page, 'desktop-result');
    await click(page, '#btn-res-hub');
    await until(page, () => __hg.mode === 'hub' && __hg.G.battle === null, 'Sanctum goes back');
    check(await Q(page, () => __hg.G.meta.cleared.c1 === true && __hg.G.meta.shards >= 300), 'chapter 1 is cleared and the shards are paid');
    await click(page, '#hub-menu [data-act="campaign"]');
    check(await Q(page, () => document.querySelectorAll('.chapter.locked').length === 4), 'chapter 2 is open now');
    reportErrors('desktop');
}

// ======================================================================
async function phone(w, h) {
    console.log(`\n== phone ${w}×${h} (touch only)`);
    const page = await open({ width: w, height: h }, { touch: true });
    const tapSel = async (sel) => {
        const r = await Q(page, (s) => { const e = document.querySelector(s); e?.scrollIntoView({ block: 'center' }); const b = e?.getBoundingClientRect(); return b && { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, sel);
        if (!r) return false;
        await page.touchscreen.tap(r.x, r.y);
        return true;
    };
    const tapSquare = async (x, y) => { const p = await squarePx(page, x, y); await page.touchscreen.tap(p.x, p.y); };

    check(await backLinkOk(page), '← Games link is on top');
    let c = await controls(page);
    check(bigEnough(c).length === 0 && onScreen(c, w, h).length === 0, `title: every control is ≥ 44 px and on screen ${JSON.stringify(bigEnough(c)).slice(0, 120)}`);
    await tapSel('#title-menu [data-act="howto"]');
    await until(page, () => !document.getElementById('howto').hidden, 'a tap on How to Play opens it');
    c = await controls(page);
    check(bigEnough(c).length === 0, 'how to play: controls ≥ 44 px');
    check(await Q(page, () => document.querySelector('#howto .sheet').getBoundingClientRect().top >= 40), 'the sheet clears the ← Games link');
    await tapSel('#howto [data-close]');
    await until(page, () => document.getElementById('howto').hidden, 'a tap on Got it closes it');
    await tapSel('#title-menu [data-act="settings"]');
    await until(page, () => !document.getElementById('settings').hidden, 'Settings opens');
    c = await controls(page);
    check(bigEnough(c).length === 0 && onScreen(c, w, h).length === 0, 'settings: controls ≥ 44 px and on screen');
    await tapSel('#settings [data-close]');

    await tapSel('#title-menu [data-act="new"]');
    await until(page, () => __hg.mode === 'hub', 'a tap on New Game opens the sanctum');
    await page.waitForTimeout(300);
    check(await Q(page, () => !document.getElementById('hub').hidden), 'the sheet stays open after the finger lifts');
    c = await controls(page);
    check(bigEnough(c).length === 0 && onScreen(c, w, h).length === 0, 'sanctum: controls ≥ 44 px and on screen');
    await shot(page, `phone-${w}x${h}-hub`);

    await tapSel('#hub-menu [data-act="summon"]');
    await until(page, () => !document.getElementById('summon').hidden, 'summoning opens by touch');
    c = await controls(page);
    check(bigEnough(c).length === 0 && onScreen(c, w, h).length === 0, 'summon: controls ≥ 44 px and on screen');
    await tapSel('#btn-sum10');
    await until(page, () => !document.getElementById('summon-result').hidden, 'a tap on ×10 shows the cards');
    await tapSel('#btn-pulls-skip');
    await shot(page, `phone-${w}x${h}-summon`);
    c = await controls(page);
    check(bigEnough(c).length === 0 && onScreen(c, w, h).length === 0, 'results: controls ≥ 44 px and on screen');
    await tapSel('#btn-pulls-done');
    await tapSel('#summon [data-close]');

    await tapSel('#hub-menu [data-act="roster"]');
    await until(page, () => !document.getElementById('roster').hidden, 'the roster opens by touch');
    await tapSel('.ucard:nth-child(2)');
    await shot(page, `phone-${w}x${h}-roster`);
    c = await controls(page);
    check(bigEnough(c).length === 0, 'roster: controls ≥ 44 px');
    await tapSel('#roster [data-close]');

    await tapSel('#hub-menu [data-act="campaign"]');
    await until(page, () => !document.getElementById('campaign').hidden, 'the campaign opens by touch');
    c = await controls(page);
    check(bigEnough(c).length === 0 && onScreen(c, w, h).length === 0, 'campaign: controls ≥ 44 px and on screen');
    await shot(page, `phone-${w}x${h}-campaign`);
    await tapSel('#btn-march');
    await until(page, () => __hg.mode === 'battle', 'a tap on March starts the battle');
    await idle(page, 'the opening banner is over');

    const L = await layout(page);
    check(L.noHScroll, 'no sideways scroll');
    check(L.canvas, 'the canvas matches the visible viewport');
    c = await controls(page);
    check(bigEnough(c).length === 0 && onScreen(c, w, h).length === 0, `battle HUD: every control ≥ 44 px and on screen ${JSON.stringify(bigEnough(c)).slice(0, 160)}`);
    check(await Q(page, () => { const b = document.getElementById('bh-top').getBoundingClientRect(), a = document.getElementById('back-link').getBoundingClientRect(); return b.left >= a.right - 1 || b.top >= a.bottom; }), 'the top bar does not cover the ← Games link');

    // the board sits in the space the HUD leaves
    const fit = await Q(page, () => {
        const s = __hg.view.stage, B = __hg.G.battle, pad = __hg.ui.pads();
        const pts = [];
        for (const sx of [-1, 1]) for (const sz of [-1, 1]) pts.push(s.project(new (s.camera.position.constructor)(sx * B.w / 2, 0, sz * B.h / 2)));
        const x0 = Math.min(...pts.map((p) => p.x)), x1 = Math.max(...pts.map((p) => p.x)), y0 = Math.min(...pts.map((p) => p.y)), y1 = Math.max(...pts.map((p) => p.y));
        return { x0, x1, y0, y1, pad, w: innerWidth, h: innerHeight };
    });
    check(fit.x0 >= fit.pad.left - 2 && fit.x1 <= fit.w - fit.pad.right + 2 && fit.y0 >= fit.pad.top - 2 && fit.y1 <= fit.h - fit.pad.bottom + 2, `the whole board is inside the free area (${Math.round(fit.x0)}..${Math.round(fit.x1)} × ${Math.round(fit.y0)}..${Math.round(fit.y1)})`);
    check((fit.x1 - fit.x0) / 8 >= 30, `a square is at least 30 px wide even at the far edge (board ${Math.round(fit.x1 - fit.x0)} px wide)`);
    // taps land under the finger: every square picks itself
    const wrong = await Q(page, () => { const bad = []; const B = __hg.G.battle; for (let y = 0; y < B.h; y++) for (let x = 0; x < B.w; x++) { const p = __hg.view.screenOf(x, y, 0); const q = __hg.view.pick(p.x, p.y); if (!q || q.x !== x || q.y !== y) bad.push([x, y, q]); } return bad; });
    check(wrong.length === 0, `a tap on the centre of each of the 64 squares picks that square (${wrong.length} wrong)`);
    await shot(page, `phone-${w}x${h}-battle`);

    // select and move by touch
    const m = await Q(page, () => { const u = __hg.G.battle.units.find((x) => x.key === 'ilse'); return { id: u.id, x: u.x, y: u.y }; });
    await tapSquare(m.x, m.y);
    await until(page, (id) => __hg.play.sel === id, 'a tap on a piece selects it', 20000, m.id);
    const target = await Q(page, () => { const B = __hg.G.battle; const hl = __hg.view.hl.filter((h) => h.visible); const h = hl[0]; return { x: Math.round(h.position.x + B.w / 2 - 0.5), y: Math.round(h.position.z + B.h / 2 - 0.5) }; });
    await tapSquare(target.x, target.y);
    await until(page, ([id, x, y]) => { const u = __hg.G.battle.units.find((o) => o.id === id); return u.x === x && u.y === y; }, 'a tap on a highlighted square moves it', 20000, [m.id, target.x, target.y]);
    await idle(page, 'the move finishes');

    // a duel by touch, and the arena frames both fighters
    const { g } = await setupDuel(page);
    await tapSquare(2, 5);
    await until(page, (id) => __hg.play.sel === id, 'select Gideon by touch', 20000, g);
    await tapSquare(2, 2);
    await until(page, () => !document.getElementById('forecast').hidden, 'a tap on an enemy shows the forecast');
    c = await controls(page);
    check(bigEnough(c).length === 0 && onScreen(c, w, h).length === 0, 'forecast: controls ≥ 44 px and on screen');
    await shot(page, `phone-${w}x${h}-forecast`);
    await tapSel('#btn-fc-yes');
    await until(page, () => __hg.view.stage.arenaOn && !document.getElementById('cut').hidden, 'Strike cuts to the duel arena', 40000);
    const frame = await Q(page, () => { const s = __hg.view.stage, cut = document.getElementById('cut').getBoundingClientRect().bottom; return ['a', 'd'].map((k) => { const lo = s.project(s.arenaPos(k).setY(0.1)), hi = s.project(s.arenaPos(k).setY(2.4)); return lo.x > 40 && lo.x < innerWidth - 40 && hi.y > cut && lo.y < innerHeight; }); });
    check(frame[0] && frame[1], 'both fighters are in frame, below the cut-in panels');
    check(await Q(page, () => { const r = document.getElementById('cut').getBoundingClientRect(); return r.right <= innerWidth + 1 && r.left >= -1; }), 'the cut-in panels fit the screen');
    await shot(page, `phone-${w}x${h}-duel`);
    await idle(page, 'the duel ends');

    // pause: a menu opened by a finger-down button must not close when the finger lifts
    await tapSel('#btn-pause');
    await until(page, () => !document.getElementById('pause').hidden, 'tapping ❚❚ pauses');
    await page.waitForTimeout(300);
    check(await Q(page, () => !document.getElementById('pause').hidden), 'the pause screen stays open after the finger lifts');
    c = await controls(page);
    check(bigEnough(c).length === 0 && onScreen(c, w, h).length === 0, 'pause: controls ≥ 44 px and on screen');
    await tapSel('#pause-menu [data-act="resume"]');
    await until(page, () => document.getElementById('pause').hidden, 'a tap on Resume closes it');
    await tapSel('#btn-danger');
    await until(page, () => __hg.play.danger, 'the ☠ button shows the threat map');
    check(await Q(page, () => __hg.view.hl.filter((h) => h.visible).length > 4), 'with squares marked');
    await tapSel('#btn-end');
    await until(page, () => __hg.G.battle.phase === 'e' || __hg.G.battle.turn >= 2, 'End Turn by touch');
    await until(page, () => __hg.G.battle.phase === 'p' && !__hg.view.busy, 'and the enemy answers', 120000);
    reportErrors(`phone ${w}×${h}`);
}

// ======================================================================
async function nostorage() {
    console.log('\n== blocked storage');
    const page = await open({ width: 1280, height: 760 }, { nostorage: true });
    await click(page, '#title-menu [data-act="new"]');
    await until(page, () => __hg.mode === 'hub', 'boots and starts a game with localStorage throwing');
    check(await Q(page, () => __hg.save() === false), 'saving fails quietly');
    check(await Q(page, () => { const c = document.getElementById('set-quick'); const s0 = __hg.view.speed; c.checked = true; c.dispatchEvent(new Event('change')); return __hg.view.speed === s0 * 2; }), 'Quick duels doubles the animation speed');
    await Q(page, () => { __hg.battle(0); });
    await idle(page, 'a battle starts');
    await Q(page, () => __hg.ff());
    await until(page, () => !document.getElementById('result').hidden, 'and can be won', 60000);
    check(await Q(page, () => __hg.hasSave() === false), 'there is nothing to Continue');
    reportErrors('nostorage');
}

try {
    if (want('desktop')) await desktop();
    if (want('phones')) { await phone(390, 844); await phone(844, 390); }
    if (want('nostorage')) await nostorage();
} catch (err) {
    fails++;
    console.log('  FAIL threw:', err.message);
} finally {
    if (browser) await browser.close();
}
console.log(`\n${fails ? `${fails} FAILED` : 'all passed'} · screenshots in ${path.relative(process.cwd(), OUT)}`);
process.exit(fails ? 1 : 0);

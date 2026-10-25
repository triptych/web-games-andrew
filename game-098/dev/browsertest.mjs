/**
 * browsertest.mjs — the real game in real Chromium (SwiftShader WebGL).
 *
 * desktop (1280×760): boot to the title with no errors, the ← Games link on top → New Game →
 *   the prologue advanced with real Space and Enter presses, then skipped → a starter picked by
 *   click → chapter 1's scene → the battle: a real click selects a dragon, a click on a blue tile
 *   opens the action menu, Wait spends it; Tab selects the next unit and Escape backs out; End
 *   Turn hands over to the Chain and back; Escape pauses and Resume returns; the bot finishes the
 *   battle → results → the closing scene → the roost on the Hatchery tab: an egg is placed, tapped
 *   warmer, hatched; the Stable, a dragon's sheet, feeding; the Market; Save & Quit → Continue
 *   restores the roost. The board fits the space the HUD leaves. No sideways scroll.
 * phones (touch only, real CDP touches) at 390×844 and 844×390: taps through the Journey and the
 *   party picker, the scene advanced by touch, a touch selects a dragon and a touch on a blue tile
 *   opens the menu, Wait; a drag pans the zoomed map without acting; End Turn; the pause screen
 *   stays open after the finger lifts; every control ≥ 44 px and on screen; the roost panel and
 *   tabs on screen; no sideways scroll; the canvas matches the visible viewport.
 * nostorage: localStorage throws; the game still boots, starts and plays, and saving fails quietly.
 * Fails on any console error, page error or failed request.
 *
 *   python3 -m http.server 8098          # from the REPO ROOT
 *   node game-098/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8098), ONLY=desktop,phones,nostorage, THREE_PKG, FONTS=1 (load the real
 * Google Fonts instead of stubbing them: Cinzel Decorative is much wider than its fallback).
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8098';
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
    page.on('dialog', (d) => d.dismiss());
    if (PKG) {
        await page.route('https://unpkg.com/**', (route) => {
            const rel = new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, '');
            const file = path.join(PKG, rel);
            if (!fs.existsSync(file)) return route.abort();
            route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
        });
    }
    // FONTS=1 loads the real web fonts; the default stubs them (offline-safe), so text uses the narrower fallback
    if (process.env.FONTS !== '1') await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('requestfailed', (r) => { if (!r.url().includes('favicon')) errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`); });
    await page.goto(`${BASE}/game-098/index.html?debug=1&fast=6`);
    await page.waitForFunction(() => window.__wb && __wb.mode === 'title', null, { timeout: 60000 });
    return page;
}

const check = (cond, msg) => { if (!cond) { fails++; console.log('  FAIL', msg); } else console.log('  ok', msg); return cond; };
const Q = (page, fn, arg) => page.evaluate(fn, arg);
const shot = async (page, name) => { await page.screenshot({ path: path.join(OUT, `bt-${name}.png`) }); };
// SwiftShader draws a few frames a second: wait on state, never on the clock.
const until = (page, fn, msg, timeout = 45000, arg = null) =>
    page.waitForFunction(fn, arg, { timeout, polling: 100 }).then(() => check(true, msg), () => check(false, msg));
// Playwright's click() waits for animation frames to settle, which SwiftShader never does; click from inside.
const click = (page, sel) => Q(page, (s) => { const e = document.querySelector(s); if (!e) return false; e.click(); return true; }, sel);
const visible = (page, id) => Q(page, (i) => { const e = document.getElementById(i); return !!e && !e.hidden && e.getClientRects().length > 0; }, id);
// a mid-battle scene counts as busy: dismiss any that turn up while waiting
const idle = (page) => page.waitForFunction(() => { if (__wb.ui.talking) __wb.skipTalk(); return __wb.G.battle && !__wb.play.busy && __wb.G.events.length === 0 && __wb.G.battle.phase === 'p' && performance.now() - (__wb.ui.talkEndAt || -1e9) > 300; }, null, { timeout: 60000, polling: 100 });
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
/** Does the whole board project inside the space the HUD leaves (at overview zoom)? */
const boardFits = (page) => Q(page, () => {
    const B = __wb.G.battle, v = __wb.view;
    const pads = __wb.ui.pads();
    const pts = [[0, 0], [B.w - 1, 0], [0, B.h - 1], [B.w - 1, B.h - 1]].map(([x, y]) => v.screenOf(x, y, 0));
    return pts.every((p) => p.x >= pads.left - 30 && p.x <= innerWidth - pads.right + 30 && p.y >= pads.top - 30 && p.y <= innerHeight - pads.bottom + 30);
});
const sizes = (page, sels) => Q(page, (list) => list.map((s) => {
    const e = document.querySelector(s);
    if (!e) return { s, ok: false, why: 'missing' };
    const r = e.getBoundingClientRect();
    return { s, ok: r.width >= 44 && r.height >= 44 && r.left >= -1 && r.top >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1, why: `${Math.round(r.width)}×${Math.round(r.height)} at ${Math.round(r.left)},${Math.round(r.top)}` };
}), sels);
const reportErrors = (label) => { check(errors.length === 0, `${label}: no console errors, page errors or failed requests`); for (const e of errors.slice(0, 8)) console.log('    ', e); };
/** A ready dragon of the player's and a blue tile it could walk to. */
const pickMove = (page) => Q(page, async () => {
    const B = __wb.G.battle;
    const { reachOf } = await import('./js/sim/battle.js');
    const { destinations } = await import('./js/sim/map.js');
    const u = B.units.find((v) => v.team === 'p' && v.hp > 0 && !v.acted && v.kind === 'dragon') || B.units.find((v) => v.team === 'p' && v.hp > 0 && !v.acted);
    const d = destinations(B, u, reachOf(B, u)).find(([x, y]) => x !== u.x || y !== u.y);
    return { id: u.id, from: [u.x, u.y], to: [d[0], d[1]], a: __wb.view.screenOf(u.x, u.y), b: __wb.view.screenOf(d[0], d[1]) };
});

// ======================================================================
async function desktop() {
    console.log('\n== desktop 1280×760');
    const page = await open({ width: 1280, height: 760 });
    check(await backLinkOk(page), '← Games link is on top and points at ../index.html');
    check(await visible(page, 'title'), 'title screen is up');
    await Q(page, () => document.fonts.ready);
    check(await Q(page, () => { const l = document.querySelector('.logo'), b = l.parentElement; const cs = getComputedStyle(b); return l.scrollWidth <= b.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) + 1 && b.scrollWidth <= b.clientWidth; }), 'the whole title fits its sheet');
    check(await Q(page, () => document.getElementById('btn-continue').hidden), 'no Continue without a save');
    const L = await layout(page);
    check(L.noHScroll && L.canvas, 'no sideways scroll; the canvas fills the window');
    await shot(page, 'desktop-title');

    await click(page, '#title-menu [data-act="new"]');
    await until(page, () => !!__wb.ui.talking && __wb.ui.talking.i === 0, 'New Game opens the prologue');
    await page.keyboard.press('Space');       // finish typing
    await page.keyboard.press('Space');       // next line
    await until(page, () => __wb.ui.talking && __wb.ui.talking.i >= 1, 'Space advances the story');
    await page.keyboard.press('Enter'); await page.keyboard.press('Enter');
    await until(page, () => __wb.ui.talking && __wb.ui.talking.i >= 2, 'Enter advances it too');
    await shot(page, 'desktop-dialogue');
    await click(page, '#btn-dlg-skip');
    await until(page, () => !__wb.ui.talking && !document.getElementById('starter').hidden, 'Skip leads to the starter eggs');
    await shot(page, 'desktop-starter');
    await click(page, '#starter-list [data-sp="mossling"]');
    await until(page, () => __wb.mode === 'battle' && !!__wb.ui.talking, 'choosing an egg starts chapter 1 with its scene');
    check(await Q(page, () => __wb.G.meta.dragons[0].sp === 'mossling'), 'the starter is the one chosen');
    await click(page, '#btn-dlg-skip');
    await idle(page);
    check(await boardFits(page), 'the whole board fits between the HUD bars');

    // select with a real mouse click, move with another
    const mv = await pickMove(page);
    await page.mouse.click(mv.a.x, mv.a.y);
    await until(page, (id) => __wb.play.sel === id && __wb.play.mode === 'move', 'a click on a dragon selects it', 20000, mv.id);
    await page.mouse.move(mv.b.x, mv.b.y);
    await page.mouse.click(mv.b.x, mv.b.y);
    await until(page, () => __wb.play.mode === 'menu' && !document.getElementById('actmenu').hidden, 'a click on a blue tile opens the action menu');
    check(await Q(page, () => !!__wb.view.previewed), 'the dragon is shown at its new tile before acting');
    check(await Q(page, (id) => { const u = __wb.G.battle.units.find((v) => v.id === id); return !u.acted; }, mv.id), 'nothing is sent to the sim yet');
    await shot(page, 'desktop-menu');
    await page.keyboard.press('Escape');
    await until(page, () => __wb.play.mode === 'move' && document.getElementById('actmenu').hidden, 'Escape backs out of the menu');
    await page.mouse.click(mv.b.x, mv.b.y);
    await until(page, () => __wb.play.mode === 'menu', 'the menu opens again');
    await click(page, '#actmenu [data-act="wait"]');
    await until(page, (a) => { const u = __wb.G.battle.units.find((v) => v.id === a.id); return u.acted && u.x === a.to[0] && u.y === a.to[1]; }, 'Wait moves and spends the dragon', 20000, mv);
    await idle(page);
    await page.keyboard.press('Tab');
    await until(page, () => __wb.play.sel != null, 'Tab selects the next ready unit');
    await page.keyboard.press('Escape');
    await until(page, () => __wb.play.sel == null, 'Escape deselects');

    // end the turn, the Chain plays, back to us
    const turn = await Q(page, () => __wb.G.battle.turn);
    await click(page, '#btn-end');
    await until(page, () => __wb.G.battle.phase === 'e', 'End Turn hands over to the Chain');
    await until(page, (t) => __wb.G.battle.phase === 'p' && __wb.G.battle.turn === t + 1, 'the Chain plays and the turn comes back', 90000, turn);
    await idle(page);

    // pause stops the Chain
    await page.keyboard.press('Escape');
    await until(page, () => !document.getElementById('pause').hidden, 'Escape pauses');
    await click(page, '#pause-menu [data-act="resume"]');
    await until(page, () => document.getElementById('pause').hidden, 'Resume closes the pause screen');

    // let the bot finish, read the results
    await Q(page, () => __wb.ff());
    await until(page, () => !document.getElementById('result').hidden, 'the battle ends with the results screen', 60000);
    const win = await Q(page, () => __wb.G.battle.result.win);
    check(win, 'the bot wins chapter 1');
    await shot(page, 'desktop-result');
    await click(page, '#btn-res-ok');
    await until(page, () => !!__wb.ui.talking, 'the closing scene plays');
    await click(page, '#btn-dlg-skip');
    await until(page, () => __wb.mode === 'hub' && !document.getElementById('hub').hidden && __wb.roostUi.tab === 'hatchery', 'back at the roost on the Hatchery tab (a new egg)');
    check(await Q(page, () => __wb.G.meta.cleared.ch1 && __wb.G.meta.ch === 1), 'chapter 1 is cleared and chapter 2 is open');

    // hatch an egg
    await click(page, '#hub-panel [data-place]');
    await until(page, () => __wb.G.meta.incub.some((x) => x != null), 'tapping a basket egg puts it in an incubator');
    const prog0 = await Q(page, () => { const M = __wb.G.meta; return M.eggs.find((e) => e.eid === M.incub.find((x) => x != null)).prog; });
    await click(page, '#hub-panel [data-warm]');
    check(await Q(page, (p) => { const M = __wb.G.meta; return M.eggs.find((e) => e.eid === M.incub.find((x) => x != null)).prog > p; }, prog0), 'tapping the egg warms it');
    await shot(page, 'desktop-hatchery');
    await Q(page, () => __wb.idle(3600));
    await until(page, () => !!document.querySelector('#hub-panel [data-hatch]'), 'time passes and it is ready to hatch');
    const n0 = await Q(page, () => __wb.G.meta.dragons.length);
    await click(page, '#hub-panel [data-hatch]');
    await until(page, (n) => __wb.G.meta.dragons.length === n + 1, 'Hatch! adds a dragon', 20000, n0);

    // the stable and a dragon's sheet
    await click(page, '#hub-tabs [data-tab="stable"]');
    await until(page, () => __wb.roostUi.tab === 'stable' && !!document.querySelector('#hub-panel [data-rid]'), 'the Stable lists the flock');
    await click(page, '#hub-panel [data-rid]');
    await until(page, () => !document.getElementById('dragon').hidden, 'tapping a dragon opens its sheet');
    const xp0 = await Q(page, () => { const d = __wb.G.meta.dragons.find((x) => x.rid === __wb.roostUi.dragonRid); return d.xp + d.lv * 1000; });
    await click(page, '#dragon-sheet [data-feed="meat"]');
    check(await Q(page, (x) => { const d = __wb.G.meta.dragons.find((r) => r.rid === __wb.roostUi.dragonRid); return d.xp + d.lv * 1000 > x; }, xp0), 'feeding gives experience');
    await shot(page, 'desktop-sheet');
    await click(page, '#dragon-sheet [data-closed]');
    await until(page, () => document.getElementById('dragon').hidden, 'Done closes the sheet');
    await click(page, '#hub-tabs [data-tab="market"]');
    const g0 = await Q(page, () => __wb.G.meta.gold);
    await click(page, '#hub-panel [data-buy="meat"]');
    check(await Q(page, (g) => __wb.G.meta.gold < g, g0), 'the Market sells');

    // save and come back
    await click(page, '#btn-hub-menu');
    await until(page, () => !document.getElementById('hubmenu').hidden, 'the roost menu opens');
    await click(page, '#hubmenu-menu [data-act="quit"]');
    await until(page, () => __wb.mode === 'title' && !document.getElementById('btn-continue').hidden, 'Save & Quit returns to the title with Continue');
    await click(page, '#title-menu [data-act="continue"]');
    await until(page, () => __wb.mode === 'hub' && __wb.G.meta.cleared.ch1 && __wb.G.meta.dragons.length >= 2, 'Continue restores the roost');
    const L2 = await layout(page);
    check(L2.noHScroll, 'no sideways scroll at the roost');
    await shot(page, 'desktop-roost');
    reportErrors('desktop');
}

// ======================================================================
async function phone(w, h) {
    console.log(`\n== phone ${w}×${h} (touch only)`);
    const page = await open({ width: w, height: h }, { touch: true });
    const cdp = await page.context().newCDPSession(page);
    const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
    const tapAt = async (x, y) => { await touch('touchStart', x, y); await touch('touchEnd', 0, 0); };
    const tapSel = async (sel) => {
        const r = await Q(page, (s) => { const e = document.querySelector(s); if (!e) return null; e.scrollIntoView({ block: 'center' }); const b = e.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, sel);
        if (!r) return false;
        await tapAt(r.x, r.y);
        return true;
    };

    check(await backLinkOk(page), '← Games link is on top');
    await Q(page, () => document.fonts.ready);
    check(await Q(page, () => { const l = document.querySelector('.logo'), b = l.parentElement; const cs = getComputedStyle(b); return l.scrollWidth <= b.clientWidth - parseFloat(cs.paddingLeft) - parseFloat(cs.paddingRight) + 1 && b.scrollWidth <= b.clientWidth; }), 'the whole title fits its sheet');
    await Q(page, () => __wb.start(5, 'ripplefin'));
    await until(page, () => __wb.mode === 'hub' && !document.getElementById('hub').hidden, 'the roost is up');
    const hubSizes = await sizes(page, ['#hub-tabs [data-tab="map"]', '#hub-tabs [data-tab="market"]', '#btn-hub-menu', '#btn-hoard']);
    for (const z of hubSizes) check(z.ok, `${z.s} is at least 44 px and on screen (${z.why})`);
    check(await Q(page, () => { const r = document.getElementById('hub-panel').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight && r.height > 120; }), 'the roost panel is on screen');
    await shot(page, `phone-roost-${w}x${h}`);
    await tapSel('#hub-panel [data-ch="0"]');
    await until(page, () => !document.getElementById('party').hidden, 'a tap on chapter 1 opens the party picker');
    await tapSel('#btn-deploy');
    await until(page, () => __wb.mode === 'battle' && !!__wb.ui.talking, 'a tap on Fly! starts the battle with its scene');
    await tapSel('.dlg-box'); await tapSel('.dlg-box');
    await until(page, () => __wb.ui.talking && __wb.ui.talking.i >= 1, 'a tap advances the scene');
    await tapSel('#btn-dlg-skip');
    await idle(page);

    const L = await layout(page);
    check(L.noHScroll, 'no sideways scroll');
    check(L.canvas, 'the canvas matches the visible viewport');
    const bs = await sizes(page, ['#btn-end', '#btn-pause', '#btn-next', '#btn-zoom', '#btn-power']);
    for (const z of bs) check(z.ok, `${z.s} is at least 44 px and on screen (${z.why})`);

    // select and move with real touches
    const mv = await pickMove(page);
    await tapAt(mv.a.x, mv.a.y);
    await until(page, (id) => __wb.play.sel === id, 'a touch selects a dragon', 20000, mv.id);
    // selecting eases the zoomed camera toward the dragon: let it settle, then measure again
    await page.waitForFunction(() => !__wb.view.stage.focusTo, null, { timeout: 20000, polling: 100 });
    const mv2 = await pickMove(page);
    await tapAt(mv2.b.x, mv2.b.y);
    await until(page, () => __wb.play.mode === 'menu' && !document.getElementById('actmenu').hidden, 'a touch on a blue tile opens the action menu');
    check(await Q(page, () => { const r = document.getElementById('actmenu').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight; }), 'the action menu is on screen');
    await shot(page, `phone-menu-${w}x${h}`);
    await tapSel('#actmenu [data-act="wait"]');
    await until(page, (id) => __wb.G.battle.units.find((v) => v.id === id).acted, 'a tap on Wait spends it', 20000, mv.id);
    await idle(page);

    // a drag pans the map and does not act
    const z0 = await Q(page, () => ({ zoom: __wb.view.stage.zoom, pan: __wb.view.stage.pan.x + __wb.view.stage.pan.y }));
    if (z0.zoom <= 1.01) await tapSel('#btn-zoom');
    const p0 = await Q(page, () => __wb.view.stage.pan.x + __wb.view.stage.pan.y);
    const cx = w / 2, cy = h / 2;
    await touch('touchStart', cx, cy);
    for (let i = 1; i <= 6; i++) await touch('touchMove', cx + i * 14, cy + i * 8);
    await touch('touchEnd', 0, 0);
    await until(page, (p) => Math.abs(__wb.view.stage.pan.x + __wb.view.stage.pan.y - p) > 0.05, 'a drag pans the zoomed map', 20000, p0);
    check(await Q(page, () => __wb.play.sel == null && __wb.play.mode === 'idle'), 'and selects nothing');

    await tapSel('#btn-pause');
    await until(page, () => !document.getElementById('pause').hidden, 'tapping ❚❚ pauses');
    await page.waitForTimeout(300);
    check(await Q(page, () => !document.getElementById('pause').hidden), 'the pause screen stays open after the finger lifts');
    await tapSel('#pause-menu [data-act="resume"]');
    await until(page, () => document.getElementById('pause').hidden, 'a tap on Resume closes it');
    await tapSel('#btn-end');
    await until(page, () => __wb.G.battle.phase === 'e', 'a tap on End Turn hands over to the Chain');
    await shot(page, `phone-${w}x${h}`);
    reportErrors(`phone ${w}×${h}`);
}

// ======================================================================
async function nostorage() {
    console.log('\n== blocked storage');
    const page = await open({ width: 1280, height: 760 }, { nostorage: true });
    await Q(page, () => __wb.start(9));
    await until(page, () => __wb.mode === 'hub', 'boots and starts a game with localStorage throwing');
    await Q(page, () => __wb.battle(0));
    await until(page, () => __wb.mode === 'battle', 'a battle starts');
    await Q(page, () => __wb.ff());
    await until(page, () => !document.getElementById('result').hidden, 'and plays to the end');
    check(await Q(page, () => __wb.save() === false), 'saving fails quietly');
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

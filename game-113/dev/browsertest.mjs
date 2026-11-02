/**
 * browsertest.mjs — Crystal Crescendo in real Chromium (SwiftShader WebGL).
 *
 * desktop (1280×760):
 *   boot to the title with no errors, the ← Games link on top, no Continue without a save → New Game → Normal →
 *   the prologue: real Space presses advance the dialogue → the beach: real arrow keys walk Lyra → real Space talks to
 *   Otto → the tutorial duel: Otto's lines advance with Space, then real lane keys (D/F/J/K) are judged against falling
 *   notes → the bot finishes the duel → results → Continue → Escape pauses and the sim stops → Resume with a 3-2-1 →
 *   M opens the band menu → Save & Quit → Continue restores the game → Otto's route map: a click on a stop travels
 *   there → a duel lost on purpose → Try again → lost again → Return to the Song Crystal → the final battle plays
 *   through the Hush and the Colossus to the credits.
 * phones (touch only, real CDP touches) at 390×844 and 844×390:
 *   taps through the menus, a tap on the dialogue box advances it, the touch deck appears in the field, the stick walks,
 *   A talks to Otto, the duel's lane pads appear under the lanes (≥ 44 px, on screen) and a tap on one is a press,
 *   ★ and ❚❚ are on screen, no sideways scroll, the canvas matches the visible viewport.
 * nostorage: localStorage throws; the game still boots and plays.
 * Fails on any console error, page error or failed request.
 *
 *   python3 -m http.server 8113          # from the REPO ROOT
 *   node game-113/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8113), ONLY=desktop,phones,nostorage,final, THREE_PKG.
 * SwiftShader draws a few frames a second, so the game opens with &fast=4&q=0 and every check waits on state.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8113';
const OUT = path.join(HERE, 'shots');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const want = (name) => !ONLY.length || ONLY.includes(name);
fs.mkdirSync(OUT, { recursive: true });

let fails = 0;
let errors = [];
let browser = null;

async function open(viewport, { touch = false, nostorage = false, fast = 4 } = {}) {
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
        await page.route('https://unpkg.com/**', (route) => {
            const rel = new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, '');
            const file = path.join(PKG, rel);
            if (!fs.existsSync(file)) return route.abort();
            route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
        });
    }
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('requestfailed', (r) => { if (!r.url().includes('favicon')) errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`); });
    await page.goto(`${BASE}/game-113/index.html?debug=1&fast=${fast}&q=0`);
    await page.waitForFunction(() => window.__ccr && __ccr.mode === 'title', null, { timeout: 90000 });
    return page;
}

const check = (cond, msg) => { if (!cond) { fails++; console.log('  FAIL', msg); } else console.log('  ok', msg); return cond; };
const Q = (page, fn, arg) => page.evaluate(fn, arg);
const shot = async (page, name) => { try { await page.screenshot({ path: path.join(OUT, `bt-${name}.png`), timeout: 120000 }); } catch (e) { console.log('    (screenshot skipped:', e.message.split('\n')[0], ')'); } };
const until = (page, fn, msg, timeout = 90000, arg = null) =>
    page.waitForFunction(fn, arg, { timeout, polling: 150 }).then(() => check(true, msg), () => check(false, msg));
const click = (page, sel) => Q(page, (s) => { const e = document.querySelector(s); if (!e) return false; e.click(); return true; }, sel);
const visible = (page, sel) => Q(page, (s) => { const e = document.querySelector(s); return !!e && !e.hidden && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden'; }, sel);
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
const settle = (page) => page.waitForFunction(() => !__ccr.view.busy, null, { timeout: 90000, polling: 150 }).catch(() => {});

/** Press a lane key when its next party note is close, a few times; return how many were judged. */
async function playNotesByKey(page, keyFor, tries = 8) {
    let judged = 0;
    for (let i = 0; i < tries; i++) {
        const target = await page.waitForFunction(() => {
            const B = __ccr.G.battle;
            if (!B || B.state !== 'run' || B.ph.kind === 'count') return null;
            const n = B.notes.find((x) => !x.j && x.side === 'party' && x.kind === 'tap' && x.t - B.t < 0.1 && x.t - B.t > -0.08);
            return n ? { id: n.id, lane: n.lane } : null;
        }, null, { timeout: 60000, polling: 16 }).then((h) => h.jsonValue()).catch(() => null);
        if (!target) break;
        await page.keyboard.press(keyFor[target.lane]);
        const j = await page.waitForFunction((id) => { const n = __ccr.G.battle?.notes.find((x) => x.id === id); return !n || !!n.j; }, target.id, { timeout: 20000, polling: 30 }).then(() => Q(page, (id) => __ccr.G.battle?.notes.find((x) => x.id === id)?.j, target.id)).catch(() => null);
        if (j && j !== 'miss') judged++;
    }
    return judged;
}

// ======================================================================
async function desktop() {
    console.log('\n== desktop 1280×760');
    const page = await open({ width: 1280, height: 760 });
    check(await backLinkOk(page), '← Games link is on top and points at ../index.html');
    check(await visible(page, '#title'), 'title screen is up');
    check(await Q(page, () => document.getElementById('btn-continue').hidden), 'no Continue without a save');
    const L = await layout(page);
    check(L.noHScroll && L.canvas, 'no sideways scroll; the canvas fills the window');
    check(await Q(page, () => document.querySelectorAll('#title-title').length <= 1 && document.querySelectorAll('#over-title').length === 0), 'no id collides with a11y.js headings');
    await shot(page, 'desktop-title');

    // ---- New Game → Normal → the prologue
    await click(page, '#title-menu [data-act="new"]');
    await until(page, () => !document.getElementById('newgame').hidden, 'New Game asks for a difficulty');
    await click(page, '#diff-menu [data-diff="normal"]');
    await until(page, () => __ccr.mode === 'play' && __ccr.G.mode === 'scene' && __ccr.G.scene.id === 'prologue', 'Normal starts the prologue');
    await until(page, () => !document.getElementById('dialogue').hidden && __ccr.G.scene.line, 'the narrator speaks', 120000);
    const i0 = await Q(page, () => __ccr.G.scene.i);
    // the first press finishes the typewriter, the next advances; presses are spaced, as one slow frame merges them
    for (let k = 0; k < 6 && await Q(page, (i) => __ccr.G.scene.i <= i, i0); k++) { await page.keyboard.press('Space'); await page.waitForTimeout(700); }
    await until(page, (i) => __ccr.G.scene.i > i, 'real Space presses advance the dialogue', 60000, i0);
    await shot(page, 'desktop-prologue');
    await Q(page, () => __ccr.skipScene(600));
    await until(page, () => __ccr.G.mode === 'field' && __ccr.G.map === 'beach' && __ccr.G.flags.awake, 'the prologue ends with Lyra awake on the beach');
    await settle(page);

    // ---- walking with real keys
    const x0 = await Q(page, () => __ccr.G.p.x);
    await page.keyboard.down('ArrowLeft');
    await until(page, (x) => __ccr.G.p.x < x - 1, 'holding ← walks Lyra left', 60000, x0);
    await page.keyboard.up('ArrowLeft');
    check(await visible(page, '#hud-goal'), 'the HUD shows what to do next');
    await shot(page, 'desktop-beach');

    // ---- talk to Otto with a real key: the tutorial duel
    await Q(page, () => __ccr.near('otto'));
    await until(page, () => !document.getElementById('hud-prompt').hidden, 'a prompt appears next to Otto');
    await page.keyboard.press('Space');
    await until(page, () => __ccr.G.mode === 'scene' && __ccr.G.scene.id === 'meetOtto', 'Space talks to Otto');
    await Q(page, () => __ccr.skipScene(600));
    await until(page, () => __ccr.G.mode === 'battle' && __ccr.G.battle.tutorial, 'Otto\'s scene leads into the tutorial duel');
    await settle(page);
    await until(page, () => __ccr.G.battle.state === 'talk' && !document.getElementById('dialogue').hidden, 'Otto explains the duel in a dialogue box');
    for (let i = 0; i < 20; i++) {
        if (await Q(page, () => __ccr.G.battle.state !== 'talk')) break;
        await page.keyboard.press('Enter');
        await page.waitForTimeout(700);
    }
    await until(page, () => __ccr.G.battle.state === 'run', 'Enter presses get through Otto\'s lines to the song');
    check(await visible(page, '#bhud') && await visible(page, '#highway'), 'the battle HUD and the highway are up');
    const judged = await playNotesByKey(page, { 0: 'd', 1: 'f', 2: 'j', 3: 'k' });
    check(judged >= 1, `real D presses land on falling notes (${judged} judged)`);
    await until(page, () => __ccr.seen.tap >= 1, 'every lane press reaches the sim');
    await shot(page, 'desktop-duel');
    await Q(page, () => __ccr.autoplay(true));
    await until(page, () => __ccr.G.mode === 'results' && !document.getElementById('results').hidden, 'the bot finishes the duel: the results screen', 180000);
    await Q(page, () => __ccr.autoplay(false));
    await shot(page, 'desktop-results');
    await click(page, '#res-ok');
    await until(page, () => __ccr.G.mode === 'scene' || __ccr.G.mode === 'field', 'Continue closes the results and the story resumes');
    await Q(page, () => __ccr.skipScene(600));
    await until(page, () => __ccr.G.mode === 'field' && __ccr.G.flags.metOtto, 'Otto joins the journey');

    // ---- pause stops the world; resume counts in
    await settle(page);
    await page.keyboard.press('Escape');
    await until(page, () => !document.getElementById('pause').hidden, 'Escape pauses');
    const t0 = await Q(page, () => __ccr.G.t);
    await page.waitForTimeout(800);
    check(await Q(page, (t) => __ccr.G.t === t, t0), 'the sim stops while paused');
    await click(page, '#pause-menu [data-act="resume"]');
    await until(page, () => document.getElementById('pause').hidden && __ccr.G.t > 0, 'Resume closes the pause screen');

    // ---- the band menu
    await page.keyboard.press('KeyM');
    await until(page, () => !document.getElementById('band').hidden && document.querySelectorAll('#band-list .card').length === 1, 'M opens the band menu with Lyra in it');
    await page.keyboard.press('Escape');
    await until(page, () => document.getElementById('band').hidden, 'Escape closes it');

    // ---- save & quit, continue
    const where = await Q(page, () => [__ccr.G.map, Math.round(__ccr.G.p.x * 10)]);
    await page.keyboard.press('Escape');
    await until(page, () => !document.getElementById('pause').hidden, 'pause again');
    await click(page, '#pause-menu [data-act="quit"]');
    await until(page, () => __ccr.mode === 'title' && !document.getElementById('btn-continue').hidden, 'Save & Quit returns to the title with Continue');
    await click(page, '#title-menu [data-act="continue"]');
    await until(page, (w) => __ccr.mode === 'play' && __ccr.G.map === w[0] && Math.abs(Math.round(__ccr.G.p.x * 10) - w[1]) <= 2, 'Continue restores the saved game', 60000, where);

    // ---- Otto's route map
    await Q(page, () => { __ccr.chapter('marisonde'); __ccr.G.flags.maelstraBeaten = true; });
    await settle(page);
    await Q(page, () => { __ccr.near('otto'); });
    await page.keyboard.press('Space');
    await until(page, () => __ccr.G.mode === 'scene' && __ccr.G.scene.id === 'otto', 'talking to the parked Otto offers a ride');
    await Q(page, () => __ccr.skipScene(60));
    await until(page, () => __ccr.G.mode === 'worldmap' && !document.getElementById('worldmap').hidden, 'the route map opens');
    check(await Q(page, () => document.querySelector('.node[data-node="frosthold"]').disabled && !document.querySelector('.node[data-node="sunreach"]').disabled), 'locked stops are disabled, open ones are not');
    await shot(page, 'desktop-worldmap');
    await click(page, '.node[data-node="sunreach"]');
    await until(page, () => __ccr.G.mode === 'travel', 'a click on Sunreach sets off');
    await until(page, () => __ccr.G.mode === 'field' && __ccr.G.map === 'sunreach' && document.getElementById('worldmap').hidden, 'the band arrives in Sunreach', 120000);
    await Q(page, () => __ccr.skipScene(60));
    await settle(page);
    await shot(page, 'desktop-sunreach');

    // ---- defeat: try again, then back to the crystal
    await Q(page, () => { for (const m of __ccr.G.party.members) __ccr.G.party.st[m].hp = 1; __ccr.battle('crowl'); });
    await until(page, () => __ccr.G.mode === 'defeat' && !document.getElementById('defeat').hidden, 'a band that never plays falls: the defeat screen', 240000);
    await click(page, '#def-retry');
    await until(page, () => __ccr.G.mode === 'battle' && document.getElementById('defeat').hidden, 'Try again restarts the duel');
    await Q(page, () => { for (const m of __ccr.G.party.members) __ccr.G.party.st[m].hp = 1; });
    await until(page, () => __ccr.G.mode === 'defeat', 'and losing again comes back here', 240000);
    await click(page, '#def-crystal');
    await until(page, () => __ccr.G.mode === 'field' && __ccr.G.party.members.every((m) => __ccr.G.party.st[m].hp > 1), 'Return to the Song Crystal heals the band in the field');
    reportErrors('desktop');
}

// ======================================================================
async function finalBattle() {
    console.log('\n== the final battle and the credits');
    const page = await open({ width: 1280, height: 760 });
    await Q(page, () => { __ccr.chapter('spire', 14); __ccr.G.flags.wardenBeaten = true; __ccr.scene('throne'); __ccr.skipScene(600); });
    await until(page, () => __ccr.G.mode === 'battle' && __ccr.G.battle.final, 'the throne scene opens the final battle');
    await Q(page, () => __ccr.autoplay(true));
    await until(page, () => __ccr.G.battle && __ccr.G.battle.stage === 'hush', 'at 45% the Hush falls', 240000);
    await until(page, () => __ccr.G.battle && __ccr.G.battle.colossus && __ccr.view.battle.colossus, 'the Colossus arrives in the view', 240000);
    await page.waitForTimeout(3000);
    await shot(page, 'final-colossus');
    await until(page, () => __ccr.seen.colossusHit >= 1, 'the Colossus\'s golden notes are played');
    await until(page, () => __ccr.G.mode === 'results', 'Vorthrax falls', 300000);
    await Q(page, () => __ccr.autoplay(false));
    await click(page, '#res-ok');
    await Q(page, () => __ccr.skipScene(600));
    await until(page, () => __ccr.mode === 'ending' && !document.getElementById('ending').hidden, 'the ending rolls the credits', 120000);
    await page.waitForTimeout(2500);
    await shot(page, 'final-credits');
    await click(page, '#end-ok');
    await until(page, () => __ccr.mode === 'title', 'Back to the Title');
    reportErrors('final');
}

// ======================================================================
async function phone(w, h) {
    console.log(`\n== phone ${w}×${h} (touch only)`);
    const page = await open({ width: w, height: h }, { touch: true });
    const cdp = await page.context().newCDPSession(page);
    const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
    const tapSel = async (sel) => {
        const r = await Q(page, (s) => { const e = document.querySelector(s); e?.scrollIntoView({ block: 'center' }); const b = e?.getBoundingClientRect(); return b && b.width && { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, sel);
        if (!r) return false;
        await page.touchscreen.tap(r.x, r.y);
        return true;
    };
    check(await backLinkOk(page), '← Games link is on top');
    await tapSel('#title-menu [data-act="new"]');
    await until(page, () => !document.getElementById('newgame').hidden, 'a tap on New Game opens the difficulty sheet');
    await page.waitForTimeout(300);
    check(await visible(page, '#newgame'), 'the sheet stays open after the finger lifts');
    await tapSel('#diff-menu [data-diff="easy"]');
    await until(page, () => __ccr.mode === 'play' && __ccr.G.difficulty === 'easy', 'a tap on Easy starts the game');
    await until(page, () => !document.getElementById('dialogue').hidden, 'the prologue speaks', 120000);
    const i0 = await Q(page, () => __ccr.G.scene.i);
    for (let k = 0; k < 6 && await Q(page, (i) => __ccr.G.scene.i <= i, i0); k++) { await tapSel('#dialogue'); await page.waitForTimeout(700); }
    await until(page, (i) => __ccr.G.scene.i > i, 'tapping the dialogue box advances it', 60000, i0);
    await Q(page, () => __ccr.skipScene(600));
    await until(page, () => __ccr.G.mode === 'field', 'the beach');
    await settle(page);
    await until(page, () => !document.getElementById('touch').hidden, 'the touch deck is shown in the field');
    let L = await layout(page);
    check(L.noHScroll, 'no sideways scroll');
    check(L.canvas, 'the canvas matches the visible viewport');

    const zone = await Q(page, () => { const r = document.getElementById('stick-zone').getBoundingClientRect(); return { x: r.left + r.width * 0.5, y: r.top + r.height * 0.5 }; });
    const x0 = await Q(page, () => __ccr.G.p.x);
    await touch('touchStart', zone.x, zone.y);
    for (let i = 1; i <= 6; i++) await touch('touchMove', zone.x - i * 12, zone.y);
    await until(page, (x) => __ccr.G.p.x < x - 0.5, 'dragging the stick walks Lyra', 60000, x0);
    await touch('touchEnd', 0, 0);
    await shot(page, `phone-${w}x${h}-field`);

    await Q(page, () => __ccr.near('otto'));
    await tapSel('#btn-a');
    await until(page, () => __ccr.G.mode === 'scene' && __ccr.G.scene.id === 'meetOtto', 'A talks to Otto');
    await Q(page, () => __ccr.skipScene(600));
    await until(page, () => __ccr.G.mode === 'battle', 'into the tutorial duel');
    await settle(page);
    for (let i = 0; i < 20 && await Q(page, () => __ccr.G.battle.state === 'talk'); i++) { await tapSel('#dialogue'); await page.waitForTimeout(700); }
    await until(page, () => __ccr.G.battle.state === 'run', 'taps get through Otto\'s lines');
    await until(page, () => document.querySelectorAll('.lane-pad').length === 1 && !document.getElementById('lane-pads').hidden, 'one lane pad for the one princess');
    const sizes = await Q(page, () => ['.lane-pad', '#btn-cres', '#btn-bpause'].map((s) => {
        const r = document.querySelector(s).getBoundingClientRect();
        return { s, ok: r.width >= 44 && r.height >= 44 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5 };
    }));
    for (const z of sizes) check(z.ok, `${z.s} is at least 44 px and on screen`);
    const taps = await Q(page, () => __ccr.seen.tap || 0);
    await tapSel('.lane-pad');
    await until(page, (n) => (__ccr.seen.tap || 0) > n, 'tapping the lane pad presses the lane', 60000, taps);
    L = await layout(page);
    check(L.noHScroll, 'no sideways scroll in the duel');
    await page.waitForTimeout(1500);
    await shot(page, `phone-${w}x${h}-duel`);
    await tapSel('#btn-bpause');
    await until(page, () => !document.getElementById('pause').hidden, 'tapping ❚❚ pauses the duel');
    await page.waitForTimeout(300);
    check(await visible(page, '#pause'), 'the pause screen stays open after the finger lifts');
    await tapSel('#pause-menu [data-act="resume"]');
    await until(page, () => document.getElementById('pause').hidden, 'a tap on Resume closes it');
    reportErrors(`phone ${w}×${h}`);
}

// ======================================================================
async function nostorage() {
    console.log('\n== blocked storage');
    const page = await open({ width: 1280, height: 760 }, { nostorage: true });
    await click(page, '#title-menu [data-act="new"]');
    await click(page, '#diff-menu [data-diff="normal"]');
    await until(page, () => __ccr.mode === 'play', 'boots and starts a game with localStorage throwing');
    await Q(page, () => __ccr.skipScene(600));
    await until(page, () => __ccr.G.mode === 'field', 'plays through the prologue');
    check(await Q(page, () => __ccr.save() === false), 'saving fails quietly');
    reportErrors('nostorage');
}

try {
    if (want('desktop')) await desktop();
    if (want('final')) await finalBattle();
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

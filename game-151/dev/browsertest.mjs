/**
 * browsertest.mjs — One Shot in real Chromium (SwiftShader WebGL).
 *
 * desktop (1280×760): boot to the title with no errors and the ← Games link on top → New Game → the hangar and its
 *   tabs → a sortie's briefing, Escape backs out → Launch → a swap by a real mouse drag → a swap by real keys (arrows
 *   and Space) → the Meshy models loaded, music playing, clips decoded → Escape pauses and the sim stops → Settings
 *   from the pause menu closes with Escape while a slider has focus → rounds played out and a route picked by click
 *   → the final window, FIRE by the F key → the shot and its readouts, Skip → the grade → the hangar shows it →
 *   Save & Quit → Continue restores the campaign.
 * phones (touch only, real CDP touches) at 390×844 and 844×390: taps through the menus, a swap by a finger swipe,
 *   the board, gauges and buttons on screen and ≥ 44 px, nothing covering the pause button, no sideways scroll, the
 *   canvas matches the visible viewport, the pause sheet stays open after the finger lifts.
 * nostorage: localStorage throws; the game still boots and plays.
 * Fails on any console error, page error or failed request.
 *
 *   python3 -m http.server 8151          # from the REPO ROOT
 *   node game-151/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8151), ONLY=desktop,phones,nostorage, THREE_PKG.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8151';
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
    await page.goto(`${BASE}/game-151/index.html?debug=1&fast=4`);
    await page.waitForFunction(() => window.__os && __os.mode === 'title', null, { timeout: 60000 });
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
const visible = (page, id) => Q(page, (i) => !document.getElementById(i).hidden, id);
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
/** A legal swap on the live board, and the client px of its two cells. */
const legalSwap = (page) => Q(page, () => {
    const cells = __os.G.m.board.cells;
    const r = document.getElementById('board').getBoundingClientRect();
    const cs = r.width / 7;
    const at = (i) => ({ x: r.left + (i % 7 + 0.5) * cs, y: r.top + (Math.floor(i / 7) + 0.5) * cs });
    // the same search the bot uses, done inline so the test doesn't import the sim into the page
    const kind = (c, i) => (c[i] && c[i].k !== 6 ? c[i].k : -1);
    const runs = (c) => {
        for (let rr = 0; rr < 7; rr++) for (let cc = 0; cc < 5; cc++) { const k = kind(c, rr * 7 + cc); if (k >= 0 && k === kind(c, rr * 7 + cc + 1) && k === kind(c, rr * 7 + cc + 2)) return true; }
        for (let cc = 0; cc < 7; cc++) for (let rr = 0; rr < 5; rr++) { const k = kind(c, rr * 7 + cc); if (k >= 0 && k === kind(c, rr * 7 + cc + 7) && k === kind(c, rr * 7 + cc + 14)) return true; }
        return false;
    };
    for (let i = 0; i < 49; i++) for (const j of [i + 1, i + 7]) {
        if (j >= 49 || (j === i + 1 && i % 7 === 6)) continue;
        if (!cells[i] || !cells[j] || cells[i].k === 6 || cells[j].k === 6) continue;
        const c2 = cells.slice(); c2[i] = cells[j]; c2[j] = cells[i];
        if (runs(c2)) return { a: i, b: j, pa: at(i), pb: at(j) };
    }
    return null;
});
const idleBoard = (page) => page.waitForFunction(() => __os.G.m && __os.G.m.board.phase === 'idle' && !__os.G.m.board.pending, null, { timeout: 30000, polling: 100 }).catch(() => {});
const reportErrors = (label) => { check(errors.length === 0, `${label}: no console errors, page errors or failed requests`); for (const e of errors.slice(0, 8)) console.log('    ', e); };

/** Play rounds with the debug fast-forward, picking a route by click each time, until the final window. */
async function toLance(page) {
    for (let k = 0; k < 8; k++) {
        const ph = await Q(page, () => __os.G.m?.phase);
        if (ph === 'lance') return true;
        if (ph === 'clear') { await click(page, '#route-opts .btn.suggest'); await page.waitForFunction(() => __os.G.m.phase !== 'clear', null, { timeout: 20000 }).catch(() => {}); continue; }
        await Q(page, () => { __os.G.m.shield = 999; __os.ff(80); });
    }
    return (await Q(page, () => __os.G.m?.phase)) === 'lance';
}

// ======================================================================
async function desktop() {
    console.log('\n== desktop 1280×760');
    const page = await open({ width: 1280, height: 760 });
    check(await backLinkOk(page), '← Games link is on top and points at ../index.html');
    check(await visible(page, 'title'), 'title screen is up');
    check(await Q(page, () => document.getElementById('btn-continue').hidden), 'no Continue without a save');
    const L = await layout(page);
    check(L.noHScroll && L.canvas, 'no sideways scroll; the canvas fills the window');
    check(await Q(page, () => document.querySelectorAll('[id$="-title"]').length === 0 || [...document.querySelectorAll('.screen')].every((s) => !document.getElementById(s.id + '-title') || document.getElementById(s.id + '-title').tagName.startsWith('H'))), 'no element squats on a screen\'s <id>-title (lib/a11y.js uses it)');
    await shot(page, 'desktop-title');

    await page.keyboard.press('Shift');          // a real gesture so the audio context may start
    await click(page, '#title-menu [data-act="new"]');
    await until(page, () => __os.mode === 'play' && !document.getElementById('hangar').hidden, 'New Game opens the hangar');
    await until(page, () => !document.getElementById('comm').hidden, 'MIRA and Juno open with the intro');
    await click(page, '#hangar .tab[data-tab="upgrades"]');
    check(await Q(page, () => !document.getElementById('tab-upgrades').hidden && document.querySelectorAll('#upgrades button[data-buy]:disabled').length === 8), 'the Hangar tab lists 8 upgrades, none affordable yet');
    await shot(page, 'desktop-hangar');
    await click(page, '#hangar .tab[data-tab="sorties"]');
    check(await Q(page, () => document.querySelectorAll('#sorties .sortie.locked').length === 5), 'five motherships are locked at the start');
    await click(page, '#sorties [data-level="0"]');
    await until(page, () => !document.getElementById('brief').hidden && __os.G.m?.phase === 'brief', 'a sortie opens its briefing');
    await page.keyboard.press('Escape');
    await until(page, () => !__os.G.m && !document.getElementById('hangar').hidden, 'Escape backs out of the briefing to the hangar');
    await click(page, '#hangar-go');
    await until(page, () => __os.G.m?.phase === 'brief', 'Next Sortie opens the first briefing');
    await shot(page, 'desktop-brief');
    await click(page, '#brief-launch');
    await until(page, () => __os.G.m?.phase === 'round' && !document.getElementById('board').hidden && !document.getElementById('hud').hidden, 'Launch starts round 1 with the board and HUD');

    // a swap by a real mouse drag
    await idleBoard(page);
    let sw = await legalSwap(page);
    let clears = await Q(page, () => __os.seen.clear || 0);
    await page.mouse.move(sw.pa.x, sw.pa.y);
    await page.mouse.down();
    await page.mouse.move((sw.pa.x + sw.pb.x) / 2, (sw.pa.y + sw.pb.y) / 2, { steps: 3 });
    await page.mouse.move(sw.pb.x, sw.pb.y, { steps: 3 });
    await page.mouse.up();
    await until(page, (n) => (__os.seen.clear || 0) > n, 'dragging a tile onto its neighbour makes a match', 30000, clears);

    // a swap by real keys: arrows move the cursor, Space picks up, an arrow swaps
    await idleBoard(page);
    sw = await legalSwap(page);
    clears = await Q(page, () => __os.seen.clear || 0);
    const cur = await Q(page, () => __os.board.cursor);
    const path1 = [];
    let r0 = Math.floor(cur / 7), c0 = cur % 7;
    const ra = Math.floor(sw.a / 7), ca = sw.a % 7;
    while (r0 < ra) { path1.push('ArrowDown'); r0++; } while (r0 > ra) { path1.push('ArrowUp'); r0--; }
    while (c0 < ca) { path1.push('ArrowRight'); c0++; } while (c0 > ca) { path1.push('ArrowLeft'); c0--; }
    for (const k of path1) await page.keyboard.press(k);
    await until(page, (a) => __os.board.cursor === a, 'arrow keys move the board cursor', 30000, sw.a);
    await page.keyboard.press('Space');
    await page.keyboard.press(sw.b === sw.a + 1 ? 'ArrowRight' : 'ArrowDown');
    await until(page, (n) => (__os.seen.clear || 0) > n, 'Space and an arrow swap by keyboard', 30000, clears);

    await until(page, () => __os.view.ship.model && __os.view.boss.model && __os.view.drone.model, 'the Meshy models (Solitaire, escort, mothership) loaded');
    await until(page, () => __os.audio.loaded >= 30, 'the ElevenLabs effects, jingles and voices decoded');
    await until(page, () => __os.audio.playing(), 'battle music is playing');
    await shot(page, 'desktop-round');

    // pause freezes the sim
    await page.keyboard.press('Escape');
    await until(page, () => !document.getElementById('pause').hidden, 'Escape pauses');
    const t0 = await Q(page, () => __os.G.t);
    await page.waitForTimeout(600);
    check(await Q(page, (t) => __os.G.t === t, t0), 'the sim stops while paused');
    await click(page, '#pause-menu [data-act="settings"]');
    await until(page, () => !document.getElementById('settings').hidden && +getComputedStyle(document.getElementById('settings')).zIndex > +getComputedStyle(document.getElementById('pause')).zIndex, 'Settings opens on top of the pause menu');
    await Q(page, () => document.getElementById('set-sfx').focus());
    await page.keyboard.press('Escape');
    await until(page, () => document.getElementById('settings').hidden && !document.getElementById('pause').hidden, 'Escape closes Settings even with a slider focused');
    await click(page, '#pause-menu [data-act="resume"]');
    await until(page, (t) => document.getElementById('pause').hidden && __os.G.t > t, 'Resume runs the sim again', 45000, t0);

    // rounds → final window
    check(await toLance(page), 'the rounds play through, a route picked by click each time, to the final window');
    await until(page, () => !document.getElementById('btn-fire').hidden, 'the FIRE button appears');
    await shot(page, 'desktop-lance');
    await idleBoard(page);
    await page.keyboard.press('KeyF');
    await until(page, () => __os.G.m?.phase === 'beam', 'F fires the Lance');
    await until(page, () => (__os.seen.stage || 0) >= 2 && document.querySelectorAll('#readout .ln').length >= 2, 'the shot reads out speed and barrier');
    await until(page, () => document.body.classList.contains('shooting'), 'the board steps aside for the shot');
    await shot(page, 'desktop-beam');
    await click(page, '#btn-skip');
    await until(page, () => __os.G.m?.phase === 'result' && !document.getElementById('result').hidden, 'Skip jumps to the grade');
    const grade = await Q(page, () => __os.G.m.result.grade);
    check(/^[SABCF]$/.test(grade), `the shot is graded (${grade})`);
    await shot(page, 'desktop-result');
    await click(page, '#result-done');
    await until(page, (g) => !__os.G.m && !document.getElementById('hangar').hidden && document.querySelector('#sorties [data-level="0"] .grade').textContent === g, 'Continue returns to the hangar, which shows the grade', 45000, grade);

    // save & quit, continue
    const scrap = await Q(page, () => __os.G.scrap);
    await click(page, '#hangar-menu');
    await until(page, () => !document.getElementById('pause').hidden, 'the hangar Menu button opens the menu');
    await click(page, '#pause-menu [data-act="quit"]');
    await until(page, () => __os.mode === 'title' && !document.getElementById('btn-continue').hidden, 'Save & Quit returns to the title with Continue');
    await click(page, '#title-menu [data-act="continue"]');
    await until(page, (s) => __os.mode === 'play' && __os.G.scrap === s && __os.G.missions === 1, 'Continue restores the campaign', 45000, scrap);
    reportErrors('desktop');
}

// ======================================================================
async function phone(w, h) {
    console.log(`\n== phone ${w}×${h} (touch only)`);
    const page = await open({ width: w, height: h }, { touch: true });
    const cdp = await page.context().newCDPSession(page);
    const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
    const tapSel = async (sel) => {
        const r = await Q(page, (s) => { const e = document.querySelector(s); e?.scrollIntoView({ block: 'center' }); const b = e?.getBoundingClientRect(); return b && { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, sel);
        if (!r) return false;
        await page.touchscreen.tap(r.x, r.y);
        return true;
    };

    check(await backLinkOk(page), '← Games link is on top');
    await tapSel('#title-menu [data-act="new"]');
    await until(page, () => !document.getElementById('hangar').hidden, 'a tap on New Game opens the hangar');
    await tapSel('#sorties [data-level="0"]');
    await until(page, () => !document.getElementById('brief').hidden, 'a tap on a sortie opens its briefing');
    await page.waitForTimeout(300);
    check(await visible(page, 'brief'), 'the briefing stays open after the finger lifts');
    await tapSel('#brief-launch');
    await until(page, () => __os.G.m?.phase === 'round', 'a tap on Launch starts the round');

    const L = await layout(page);
    check(L.noHScroll, 'no sideways scroll');
    check(L.canvas, 'the canvas matches the visible viewport');
    const geo = await Q(page, () => {
        const r = (s) => document.querySelector(s).getBoundingClientRect();
        const on = (b) => b.left >= -1 && b.top >= -1 && b.right <= innerWidth + 1 && b.bottom <= innerHeight + 1;
        const b = r('#board'), g = r('#gauges'), p = r('#btn-pause');
        const atPause = document.elementFromPoint(p.left + p.width / 2, p.top + p.height / 2);
        return {
            board: on(b) && b.width >= 7 * 40, gauges: on(g) && (g.bottom <= b.top + 1 || g.right <= b.left + 1),
            pause: on(p) && p.width >= 44 && p.height >= 44 && (atPause?.id === 'btn-pause'),
            cell: b.width / 7,
        };
    });
    check(geo.board, `the board is on screen with cells ≥ 40 px (${geo.cell.toFixed(0)} px)`);
    check(geo.gauges, 'the gauges are on screen and clear of the board');
    check(geo.pause, 'the pause button is ≥ 44 px, on screen and on top');

    // a swap by a real finger swipe
    await idleBoard(page);
    const sw = await legalSwap(page);
    const clears = await Q(page, () => __os.seen.clear || 0);
    await touch('touchStart', sw.pa.x, sw.pa.y);
    for (let i = 1; i <= 4; i++) await touch('touchMove', sw.pa.x + (sw.pb.x - sw.pa.x) * i / 4, sw.pa.y + (sw.pb.y - sw.pa.y) * i / 4);
    await touch('touchEnd', 0, 0);
    await until(page, (n) => (__os.seen.clear || 0) > n, 'a finger swipe swaps two tiles into a match', 30000, clears);
    await shot(page, `phone-${w}x${h}`);

    await tapSel('#btn-pause');
    await until(page, () => !document.getElementById('pause').hidden, 'tapping ❚❚ pauses');
    await page.waitForTimeout(300);
    check(await visible(page, 'pause'), 'the pause screen stays open after the finger lifts');
    await tapSel('#pause-menu [data-act="resume"]');
    await until(page, () => document.getElementById('pause').hidden, 'a tap on Resume closes it');

    check(await toLance(page), 'the rounds play through to the final window');
    const fire = await Q(page, () => { const b = document.getElementById('btn-fire').getBoundingClientRect(); return b.width >= 44 && b.height >= 44 && b.top >= 0 && b.bottom <= innerHeight && b.right <= innerWidth; });
    check(fire, 'the FIRE button is finger-sized and on screen');
    await idleBoard(page);
    await tapSel('#btn-fire');
    await until(page, () => __os.G.m?.phase === 'beam', 'a tap on FIRE fires the Lance');
    await shot(page, `phone-${w}x${h}-beam`);
    reportErrors(`phone ${w}×${h}`);
}

// ======================================================================
async function nostorage() {
    console.log('\n== blocked storage');
    const page = await open({ width: 1280, height: 760 }, { nostorage: true });
    await click(page, '#title-menu [data-act="new"]');
    await until(page, () => __os.mode === 'play', 'boots and starts a game with localStorage throwing');
    await Q(page, () => __os.start(2, 0, true));
    await until(page, () => __os.G.m?.phase === 'round', 'and launches a sortie');
    check(await Q(page, () => __os.save() === false), 'saving fails quietly');
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

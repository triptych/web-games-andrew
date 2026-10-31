/**
 * browsertest.mjs — NEON ARCANA in real Chromium (SwiftShader WebGL), driven by real input.
 *
 * desktop (1280×760): boot to the title with no errors, the ← Games link on top, the deck of cards
 *   → Begin the Restoration → a real mouse drag places a glyph → a tap on a glyph then a click on
 *   the lattice places it → the keyboard (digit, arrows, Space) places one → a drag that completes a
 *   row clears it → Escape pauses and the sim stops → a real Space on the focused Resume button →
 *   Transmute (T) and Tower Strike (B, arrows, Space) → light enough rekindles The Fool (the
 *   cinematic, the banner, the progress kept) → Save & Quit → Continue restores the reading →
 *   a stuck lattice with no powers ends the reading, keeps its embers → Read Again starts there →
 *   rekindling The World shows the ending → Play on. No sideways scroll; the canvas fills the window.
 * phones (touch only, real CDP touches) at 390×844 and 844×390: taps through the menus, a touch drag
 *   (the glyph floats above the finger) places a glyph, a tap then a tap places one, the powers and
 *   the pause button are at least 44 px and on screen, the pause screen stays open after the finger
 *   lifts, no sideways scroll, the canvas matches the visible viewport, the lattice is big enough.
 * nostorage: localStorage throws; the game still boots and plays.
 * Fails on any console error, page error or failed request.
 *
 *   python3 -m http.server 8111          # from the REPO ROOT
 *   node game-111/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8111), ONLY=desktop,phones,nostorage, THREE_PKG.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8111';
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
        else if (!sessionStorage.getItem('kept')) { try { localStorage.clear(); } catch { /* */ } sessionStorage.setItem('kept', '1'); }
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
    await page.goto(`${BASE}/game-111/index.html?debug=1&fast=4`);
    await page.waitForFunction(() => window.__na && __na.mode === 'title', null, { timeout: 60000 });
    return page;
}

const check = (cond, msg) => { if (!cond) { fails++; console.log('  FAIL', msg); } else console.log('  ok', msg); return cond; };
const Q = (page, fn, arg) => page.evaluate(fn, arg);
const shot = async (page, name) => { await page.screenshot({ path: path.join(OUT, `bt-${name}.png`) }); };
// SwiftShader draws a few frames a second: wait on state, never on the clock.
const until = (page, fn, msg, timeout = 30000, arg = null) =>
    page.waitForFunction(fn, arg, { timeout, polling: 100 }).then(() => check(true, msg), () => check(false, msg));
// Playwright's click() waits for animation frames to settle, which SwiftShader never does; click from inside.
const click = (page, sel) => Q(page, (s) => { const e = document.querySelector(s); if (!e) return false; e.click(); return true; }, sel);
/** Wait until the player may act: playing, nothing open, no cinematic, no undrained events, and two
 *  frames since (the frame that resumes play from a menu drops queued presses on purpose). */
const ready = async (page) => {
    await page.waitForFunction(() => __na.mode === 'play' && !__na.ui.anyScreen() && !__na.view.busy && !__na.G.events.length, null, { timeout: 30000, polling: 100 });
    const f = await Q(page, () => __na.frames);
    await page.waitForFunction((f) => __na.frames >= f + 2, f, { timeout: 30000, polling: 50 });
};
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

/** Put a known hand and lattice into the live game (the sim is plain data). */
const rig = (page, { hand, cells = null, light = null, sparks = null }) => Q(page, ({ hand, cells, light, sparks }) => {
    const G = __na.G;
    const SH = { dot: [[0, 0]], duo: [[0, 0], [1, 0]], tri: [[0, 0], [1, 0], [2, 0]], quad: [[0, 0], [1, 0], [0, 1], [1, 1]], ell: [[0, 0], [0, 1], [1, 1]], block: [[0, 0], [1, 0], [2, 0], [0, 1], [1, 1], [2, 1], [0, 2], [1, 2], [2, 2]] };
    G.hand = hand.map((h, k) => (h ? { id: h, cells: SH[h].map((c) => [...c]), color: 1 + k, uid: 900 + k + Math.floor(Math.random() * 1000) * 3 } : null));
    if (cells) { G.cells = cells.slice(); G.hp = cells.map((c) => (c === 8 ? 2 : 0)); G.sigils.fill(0); }
    if (light !== null) G.light = light;
    if (sparks !== null) G.sparks = sparks;
    G.stuck = false;
    __na.ctl.reset();
}, { hand, cells, light, sparks });

/** Screen point for cell coords (fx, fy) on the lattice, and for a hand slot's centre. */
const at = (page, fx, fy) => Q(page, ([x, y]) => __na.view.toScreen(x, y), [fx, fy]);
const slotAt = (page, k) => Q(page, (k) => { const s = __na.view.slots[k]; return __na.view.toScreen(s.x, s.y); }, k);
const size = (page, k) => Q(page, (k) => { const c = __na.G.hand[k].cells; return { w: Math.max(...c.map((p) => p[0])) + 1, h: Math.max(...c.map((p) => p[1])) + 1 }; }, k);

/** A real mouse drag of slot k so its top-left cell lands on (x, y). */
async function mouseDrag(page, k, x, y) {
    const s = await slotAt(page, k);
    const { w, h } = await size(page, k);
    const t = await at(page, x + w / 2, y + h / 2);           // under a mouse the glyph is centred on the pointer
    await page.mouse.move(s.x, s.y);
    await page.mouse.down();
    for (let i = 1; i <= 6; i++) await page.mouse.move(s.x + ((t.x - s.x) * i) / 6, s.y + ((t.y - s.y) * i) / 6);
    await page.mouse.up();
}

// ======================================================================
async function desktop() {
    console.log('\n== desktop 1280×760');
    const page = await open({ width: 1280, height: 760 });
    check(await backLinkOk(page), '← Games link is on top and points at ../index.html');
    check(await Q(page, () => !document.getElementById('title').hidden), 'title screen is up');
    check(await Q(page, () => document.getElementById('btn-continue').hidden), 'no Continue without a save');
    check(await Q(page, () => document.querySelectorAll('#over-title, #ending-title').length === 0 || [...document.querySelectorAll('#over-title, #ending-title')].every((e) => e.tagName.startsWith('H'))), 'no button id collides with a screen heading id');
    const L = await layout(page);
    check(L.noHScroll && L.canvas, 'no sideways scroll; the canvas fills the window');
    await until(page, () => __na.seen.place >= 2, 'the attract demo plays on the title screen', 40000);
    await shot(page, 'desktop-title');

    await click(page, '#title-menu [data-act="deck"]');
    await until(page, () => !document.getElementById('deck').hidden && document.querySelectorAll('#deck-grid canvas').length === 22, 'The Arcana shows all 22 cards');
    await click(page, '#deck [data-close]');

    await click(page, '#title-menu [data-act="quest"]');
    await until(page, () => __na.mode === 'play' && document.getElementById('title').hidden && __na.G.mode === 'quest' && __na.G.arc === 0, 'Begin the Restoration starts at The Fool');
    await ready(page);

    // a real mouse drag
    await rig(page, { hand: ['quad', 'tri', 'ell'], cells: new Array(64).fill(0) });
    await mouseDrag(page, 0, 2, 3);
    await until(page, () => __na.G.cells[3 * 8 + 2] && __na.G.cells[4 * 8 + 3] && __na.G.hand[0] === null, 'a mouse drag drops the glyph where it was aimed');
    await ready(page);

    // tap a glyph, then click the lattice: it is centred on the clicked cell
    const s1 = await slotAt(page, 1);
    await page.mouse.click(s1.x, s1.y);
    await until(page, () => __na.ctl.sel === 1, 'a tap on a glyph chooses it');
    const c1 = await at(page, 5.5, 6.5);
    await page.mouse.click(c1.x, c1.y);
    await until(page, () => __na.G.cells[6 * 8 + 4] && __na.G.cells[6 * 8 + 5] && __na.G.cells[6 * 8 + 6] && __na.G.hand[1] === null, 'then a click on the lattice places it there');
    await ready(page);

    // the keyboard
    await page.keyboard.press('Digit3');
    await until(page, () => __na.ctl.sel === 2, '3 chooses the third glyph');
    const cur0 = await Q(page, () => ({ ...__na.ctl.cursor }));
    await page.keyboard.press('ArrowRight');
    await until(page, (c) => __na.ctl.cursor.x === Math.min(6, c.x + 1), 'an arrow moves it', 30000, cur0);
    const moves0 = await Q(page, () => __na.G.moves);
    await Q(page, () => { const c = __na.ctl.cursor; const G = __na.G; if (G.cells[c.y * 8 + c.x] || G.cells[(c.y + 1) * 8 + c.x] || G.cells[(c.y + 1) * 8 + c.x + 1]) __na.ctl.cursor = { x: 0, y: 0 }; });
    await page.keyboard.press('Space');
    await until(page, (m) => __na.G.moves === m + 1 && __na.seen.deal >= 2, 'Space places it, and an empty hand is dealt three more', 30000, moves0);
    await shot(page, 'desktop-play');
    await ready(page);

    // a drag that completes a row
    const row = new Array(64).fill(0);
    for (let x = 0; x < 8; x++) if (x !== 3 && x !== 4) row[5 * 8 + x] = 2;
    row[0] = 1;
    await rig(page, { hand: ['duo', 'dot', 'dot'], cells: row });
    const clears = await Q(page, () => __na.seen.clear || 0);
    await mouseDrag(page, 0, 3, 5);
    await until(page, (n) => (__na.seen.clear || 0) > n && __na.G.cells.slice(40, 48).every((c) => !c), 'a drag that fills a row clears it', 30000, clears);
    await until(page, () => __na.G.resonance === 1 && !document.getElementById('resonance').hidden, 'resonance shows in the HUD');
    await page.waitForTimeout(400);
    await shot(page, 'desktop-clear');
    await ready(page);

    // pause
    await page.keyboard.press('Escape');
    await until(page, () => !document.getElementById('pause').hidden, 'Escape pauses');
    const t0 = await Q(page, () => __na.G.t);
    await page.waitForTimeout(500);
    check(await Q(page, (t) => __na.G.t === t, t0), 'the sim stops while paused');
    await until(page, () => document.activeElement?.dataset?.act === 'resume', 'Resume has the focus');
    await page.keyboard.press('Space');
    await until(page, () => document.getElementById('pause').hidden && __na.mode === 'play', 'a real Space presses the focused Resume button');

    // powers
    await ready(page);
    await Q(page, () => { __na.G.owned.push('transmute', 'strike'); __na.G.sparks = 5; });
    const uids = await Q(page, () => __na.G.hand.map((h) => h && h.uid).join());
    await page.keyboard.press('KeyT');
    await until(page, (u) => __na.G.hand.map((h) => h && h.uid).join() !== u && __na.G.sparks === 4, 'T transmutes the hand for a spark', 30000, uids);
    await ready(page);
    const full = new Array(64).fill(0);
    for (let y = 2; y <= 4; y++) for (let x = 2; x <= 4; x++) full[y * 8 + x] = 3;
    await rig(page, { hand: ['dot', 'dot', 'dot'], cells: full, sparks: 4 });
    await page.keyboard.press('KeyB');
    await until(page, () => __na.ctl.target === 'strike' && !document.getElementById('hint').hidden, 'B aims the Tower Strike');
    await Q(page, () => { __na.ctl.cursor = { x: 2, y: 3 }; });
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Space');
    await until(page, () => __na.seen.power >= 2 && __na.G.cells.every((c) => !c) && __na.G.sparks === 2, 'Space fires it: the 3×3 shatters for two sparks');
    await page.waitForTimeout(300);
    await shot(page, 'desktop-strike');
    await ready(page);

    // rekindling The Fool
    await rig(page, { hand: ['dot', 'dot', 'dot'], cells: new Array(64).fill(0), light: 499 });
    await mouseDrag(page, 0, 7, 7);
    await until(page, () => __na.seen.restore >= 1 && __na.G.arc === 1 && __na.meta.restored.includes(0), 'enough light rekindles The Fool, and the progress is kept');
    await until(page, () => !document.getElementById('rekindle').hidden && __na.view.cine, 'the rekindling plays: the card and the banner');
    await page.waitForTimeout(900);
    await shot(page, 'desktop-rekindle');
    await until(page, () => !__na.view.cine, 'and the card flies home', 60000);
    await until(page, () => document.getElementById('hud-arc-name').textContent.includes('Magician'), 'the HUD moves on to The Magician');
    check(await Q(page, () => __na.G.owned.includes('transmute') && !document.querySelector('.pwr[data-power="transmute"]').classList.contains('locked')), 'Transmute is awake');

    // save and continue
    await ready(page);
    await __naFF(page, 6);
    const snap = await Q(page, () => ({ score: __na.G.score, moves: __na.G.moves }));
    await click(page, '#btn-pause');
    await until(page, () => !document.getElementById('pause').hidden, 'the ❚❚ button pauses');
    await click(page, '#pause-menu [data-act="quit"]');
    await until(page, () => __na.mode === 'title' && !document.getElementById('btn-continue').hidden, 'Save & Quit returns to the title with Continue');
    check(await Q(page, () => document.getElementById('btn-quest').textContent.includes('Magician')), 'the title offers a new reading at The Magician');
    await click(page, '#title-menu [data-act="continue"]');
    await until(page, (s) => __na.mode === 'play' && __na.G.score === s.score && __na.G.moves === s.moves, 'Continue restores the saved reading', 30000, snap);

    // a stuck lattice with no power to call: the reading ends, its embers are kept
    await ready(page);
    const stuck = new Array(64).fill(0);
    for (let i = 0; i < 64; i++) if ((i % 8 + Math.floor(i / 8)) % 2 === 0) stuck[i] = 4;
    stuck[63] = 0; stuck[62] = 0;
    await rig(page, { hand: ['dot', 'block', 'block'], cells: stuck, light: 321, sparks: 0 });
    await Q(page, () => { __na.G.owned = []; });
    await mouseDrag(page, 0, 7, 7);
    await until(page, () => __na.mode === 'over' && !document.getElementById('over').hidden, 'a lattice where nothing fits ends the reading', 40000);
    check(await Q(page, () => __na.meta.embers === 322 && document.getElementById('over-embers').textContent.includes('322')), 'its embers are kept and shown');
    await shot(page, 'desktop-over');
    await click(page, '#over-again');
    await until(page, () => __na.mode === 'play' && __na.G.arc === 1 && __na.G.light === 322, 'Read Again starts at The Magician with the embers');

    // the ending
    await ready(page);
    await Q(page, () => { __na.setMeta({ restored: [...Array(21).keys()] }); __na.start(77, { mode: 'quest' }); });
    await ready(page);
    check(await Q(page, () => __na.G.arc === 21 && __na.G.owned.length === 5), 'a reading at The World has every power');
    await rig(page, { hand: ['dot', 'dot', 'dot'], cells: new Array(64).fill(0), light: await Q(page, () => __na.G.goal - 1) });
    await mouseDrag(page, 1, 0, 0);
    await until(page, () => __na.G.won && __na.meta.won && __na.meta.restored.length === 22, 'rekindling The World completes the Restoration');
    await until(page, () => !document.getElementById('ending').hidden, 'and the ending is shown', 60000);
    await shot(page, 'desktop-ending');
    await click(page, '#ending-on');
    await until(page, () => __na.mode === 'play' && document.getElementById('ending').hidden, 'Play on continues in the afterglow');
    reportErrors('desktop');
}

/** The bot plays n moves through the debug hook. */
async function __naFF(page, n) { await Q(page, (n) => __na.ff(n), n); }

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
    await tapSel('#title-menu [data-act="quest"]');
    await until(page, () => __na.mode === 'play' && __na.G.mode === 'quest', 'a tap on Begin the Restoration starts play');
    await ready(page);
    const L = await layout(page);
    check(L.noHScroll, 'no sideways scroll');
    check(L.canvas, 'the canvas matches the visible viewport');
    const px = await Q(page, () => __na.view.cellPx());
    check(px >= 30, `a lattice cell is a finger-sized ${px.toFixed(0)} px`);

    const sizes = await Q(page, () => ['#btn-pause', ...[...document.querySelectorAll('.pwr')].map((b) => `.pwr[data-power="${b.dataset.power}"]`)].map((s) => {
        const r = document.querySelector(s).getBoundingClientRect();
        return { s, ok: r.width >= 44 && r.height >= 44 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight };
    }));
    for (const z of sizes) check(z.ok, `${z.s} is at least 44 px and on screen`);
    check(await Q(page, () => {
        // nothing in the HUD overlaps the lattice or the hand
        const top = document.getElementById('hud').getBoundingClientRect().bottom;
        const a = __na.view.toScreen(0, 0);
        const p = document.getElementById('powers').getBoundingClientRect();
        const s = __na.view.slots.map((q) => __na.view.toScreen(q.x - q.w / 2, q.y + q.h / 2));
        const vertical = p.height > p.width;
        return a.y > top && (vertical ? __na.view.toScreen(0, 8).x > p.right : s.every((q) => q.y < p.top + 4));
    }), 'the HUD and the powers leave the lattice and the hand clear');

    // a touch drag: the glyph floats above the finger
    await rig(page, { hand: ['quad', 'tri', 'dot'], cells: new Array(64).fill(0) });
    const s0 = await slotAt(page, 0);
    const t = await at(page, 3 + 1, 4 + 1 + 1 + 1.1);          // centre (4, 5), finger 2.1 cells below it
    await touch('touchStart', s0.x, s0.y);
    for (let i = 1; i <= 8; i++) await touch('touchMove', s0.x + ((t.x - s0.x) * i) / 8, s0.y + ((t.y - s0.y) * i) / 8);
    await until(page, () => __na.ctl.drag && __na.ctl.drag.moved, 'a finger picks up the glyph');
    await shot(page, `phone-${w}x${h}-drag`);
    await touch('touchEnd', 0, 0);
    await until(page, () => __na.G.cells[4 * 8 + 3] && __na.G.cells[5 * 8 + 4] && __na.G.hand[0] === null, 'and drops it above where the finger lifted');
    await ready(page);

    // tap a glyph, then tap the lattice
    await tapSel('#view');            // (a tap on empty canvas does nothing)
    const s1 = await slotAt(page, 1);
    await page.touchscreen.tap(s1.x, s1.y);
    await until(page, () => __na.ctl.sel === 1, 'a tap chooses a glyph');
    const c = await at(page, 4.5, 1.5);
    await page.touchscreen.tap(c.x, c.y);
    await until(page, () => __na.G.cells[1 * 8 + 3] && __na.G.cells[1 * 8 + 4] && __na.G.cells[1 * 8 + 5], 'a tap on the lattice places it there');
    await page.waitForTimeout(400);
    await shot(page, `phone-${w}x${h}`);

    await tapSel('#btn-pause');
    await until(page, () => !document.getElementById('pause').hidden, 'tapping ❚❚ pauses');
    await page.waitForTimeout(300);
    check(await Q(page, () => !document.getElementById('pause').hidden), 'the pause screen stays open after the finger lifts');
    await tapSel('#pause-menu [data-act="resume"]');
    await until(page, () => document.getElementById('pause').hidden, 'a tap on Resume closes it');

    // a power by touch
    await ready(page);
    await Q(page, () => { __na.G.owned.push('transmute'); __na.G.sparks = 3; });
    const uids = await Q(page, () => __na.G.hand.map((h) => h && h.uid).join());
    await tapSel('.pwr[data-power="transmute"]');
    await until(page, (u) => __na.G.hand.map((h) => h && h.uid).join() !== u, 'a tap on Transmute redeals the hand', 30000, uids);
    reportErrors(`phone ${w}×${h}`);
}

// ======================================================================
async function nostorage() {
    console.log('\n== blocked storage');
    const page = await open({ width: 1280, height: 760 }, { nostorage: true });
    await click(page, '#title-menu [data-act="quest"]');
    await until(page, () => __na.mode === 'play', 'boots and starts a reading with localStorage throwing');
    await ready(page);
    await __naFF(page, 4);
    check(await Q(page, () => __na.G.moves >= 4), 'and plays');
    check(await Q(page, () => __na.save() === false), 'saving fails quietly');
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

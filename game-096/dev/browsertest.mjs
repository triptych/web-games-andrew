/**
 * browsertest.mjs — the real game in real Chromium (SwiftShader WebGL).
 *
 * desktop (1280×760): boot to the title with no errors, the ← Games link on top → Start the Journey by click
 *   → the story → a level → real key presses run, jump, spin and roll → Escape pauses and the sim stops →
 *   Space on the focused Resume button resumes → winning shows the results → Next starts the next level →
 *   the map and the workshop (build something, wear it) → a reload offers Continue.
 * phones (touch only, real CDP touches) at 390×844 and 844×390: taps through the menus and the story, the touch
 *   deck appears before the first stage, the stick runs, Jump / Spin / Power / swap work, every control is ≥ 44 px
 *   and on screen, no sideways scroll, the canvas matches the visible viewport, the menus fit.
 * nostorage: localStorage throws; the game still boots and plays.
 * Fails on any console error, page error or failed request.
 *
 *   python3 -m http.server 8096          # from the REPO ROOT
 *   node game-096/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8096), ONLY=desktop,phones,nostorage, THREE_PKG, PW_CHROMIUM_PATH.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8096';
const OUT = path.join(HERE, 'shots');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const want = (name) => !ONLY.length || ONLY.includes(name);
fs.mkdirSync(OUT, { recursive: true });

let fails = 0;
let errors = [];
let browser = null;

async function open(viewport, { touch = false, nostorage = false, keep = false } = {}) {
    if (browser && !keep) { await browser.close(); browser = null; }
    if (!browser) browser = await chromium.launch({
        executablePath: process.env.PW_CHROMIUM_PATH || undefined,
        args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
    });
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch });
    await ctx.addInitScript((ns) => {
        if (ns) Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } });
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
    await page.goto(`${BASE}/game-096/index.html?debug=1&fast=4`);
    await page.waitForFunction(() => window.__hh && __hh.mode === 'title', null, { timeout: 90000 });
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
const dialogueUp = (page) => Q(page, () => !document.getElementById('dialogue').hidden);
/** tell the story with the Skip button until play begins */
async function skipStory(page, tap) {
    for (let i = 0; i < 6; i++) {
        const talking = await dialogueUp(page);
        if (!talking) break;
        if (tap) await tap('#d-skip'); else await click(page, '#d-skip');
        await page.waitForTimeout(250);
    }
}
const inView = (page, sels) => Q(page, (list) => list.map((s) => {
    const e = document.querySelector(s);
    if (!e) return { s, ok: false, why: 'missing' };
    const r = e.getBoundingClientRect();
    return { s, ok: r.width >= 44 && r.height >= 44 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5, r: [Math.round(r.width), Math.round(r.height), Math.round(r.left), Math.round(r.top)] };
}), sels);

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

    await click(page, '#title-menu [data-act="new"]');
    await until(page, () => !document.getElementById('dialogue').hidden && document.getElementById('d-text').textContent.length > 0, 'Start the Journey opens the story');
    await shot(page, 'desktop-story');
    await skipStory(page);
    await until(page, () => __hh.mode === 'play' && document.getElementById('title').hidden, 'the story ends in the first level');
    check(await Q(page, () => document.querySelectorAll('#hud-hearts .heart').length === 3), 'three hearts on the HUD');
    check(await Q(page, () => __hh.G.levelId === 'l1_1'), 'it is level 1-1');

    // real keys
    const z0 = await Q(page, () => __hh.G.p.z);
    await page.keyboard.down('ArrowUp');
    await until(page, (z) => __hh.G.p.z < z - 3, 'holding ↑ runs Pinch forward', 45000, z0);
    await page.keyboard.up('ArrowUp');
    await page.keyboard.press('Space');
    await until(page, () => __hh.seen.jump >= 1, 'Space jumps (the press reaches a sim step)');
    await page.keyboard.press('KeyX');
    await until(page, () => __hh.seen.spin >= 1, 'X spins');
    await page.keyboard.press('KeyC');
    await until(page, () => __hh.seen.roll >= 1, 'C rolls with the Spiral Shell');
    await page.keyboard.press('KeyE');
    check(await Q(page, () => __hh.G.p.shell === 0), 'with one shell, E has nothing to swap to');
    await shot(page, 'desktop-play');

    // pause
    await page.keyboard.press('Escape');
    await until(page, () => !document.getElementById('pause').hidden, 'Escape pauses');
    const t0 = await Q(page, () => __hh.G.t);
    await page.waitForTimeout(600);
    check(await Q(page, (t) => __hh.G.t === t, t0), 'the sim stops while paused');
    check(await Q(page, () => document.activeElement?.dataset?.act === 'resume'), 'Resume has the focus');
    await page.keyboard.press('Space');
    await until(page, () => document.getElementById('pause').hidden, 'Space on the focused Resume button resumes (it is not eaten by the jump key)');
    await Q(page, () => document.getElementById('btn-pause').click());
    await until(page, () => !document.getElementById('pause').hidden, 'the ❚❚ button pauses');
    await page.keyboard.press('Escape');
    await until(page, () => document.getElementById('pause').hidden, 'Escape closes the pause screen');

    // win
    await Q(page, () => { __hh.G.pearls = 60; __hh.win(); });
    await until(page, () => !document.getElementById('complete').hidden, 'reaching the goal shows the results');
    check(await Q(page, () => /Level clear/.test(document.getElementById('cl-title').textContent)), 'it says Level clear');
    check(await Q(page, () => document.querySelectorAll('#cl-tally .tr').length === 4), 'four tally rows');
    check(await Q(page, () => JSON.parse(localStorage.getItem('homeward-hop.v1')).data.cleared.l1_1 != null), 'the clear is saved');
    await shot(page, 'desktop-results');
    await click(page, '#cl-next');
    await until(page, () => __hh.mode === 'play' && __hh.G.levelId === 'l1_2', 'Next starts level 1-2');

    // the map and the workshop
    await Q(page, () => __hh.pause());
    await click(page, '#pause-menu [data-act="quit"]');
    await until(page, () => !document.getElementById('map').hidden && __hh.mode === 'map', 'Back to the map opens the map');
    check(await Q(page, () => document.querySelectorAll('.lvl:not(:disabled)').length === 2), 'two levels are open');
    check(await Q(page, () => document.querySelectorAll('.lvl:disabled').length === 12), 'twelve are locked');
    await shot(page, 'desktop-map');
    await click(page, '#map-workshop');
    await until(page, () => !document.getElementById('workshop').hidden, 'the workshop opens');
    await Q(page, () => { __hh.give('cap', 1); __hh.give('string', 1); __hh.openWorkshop(); });
    await click(page, '.inv[data-inv="boater"] button');
    await until(page, () => __hh.P.built.boater === 1 && __hh.P.equipped.includes('boater'), 'building the Boater spends parts and wears it');
    check(await Q(page, () => document.querySelectorAll('#ws-slots .slot.full').length === 1), 'it shows in a slot');
    await shot(page, 'desktop-workshop');
    await Q(page, () => document.querySelector('#workshop [data-close]').click());
    await Q(page, () => document.querySelector('#map [data-close]').click());
    await until(page, () => !document.getElementById('title').hidden, 'closing the map goes back to the title');

    // a reload offers Continue; the boater gives a fourth heart
    await page.reload();
    await page.waitForFunction(() => window.__hh && __hh.mode === 'title', null, { timeout: 90000 });
    check(await Q(page, () => !document.getElementById('btn-continue').hidden), 'after a reload there is Continue');
    await click(page, '#btn-continue');
    await until(page, () => __hh.mode === 'map', 'Continue opens the map');
    await click(page, '.lvl[data-level="l1_2"]');
    await until(page, () => __hh.mode === 'play' && document.querySelectorAll('#hud-hearts .heart').length === 4, 'the Boater is worn in the next level (four hearts)');
    await shot(page, 'desktop-play2');
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
    const m = await Q(page, () => [...document.querySelectorAll('#title-menu button:not([hidden])')].map((b) => { const r = b.getBoundingClientRect(); return r.height >= 44 && r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight + 1; }));
    check(m.length > 0 && m.every(Boolean), 'the title menu fits the screen with 44 px buttons');
    await shot(page, `phone-title-${w}x${h}`);
    await tapSel('#title-menu [data-act="new"]');
    await until(page, () => !document.getElementById('dialogue').hidden, 'a tap on Start opens the story');
    await page.waitForTimeout(500);
    check(await Q(page, () => { const r = document.querySelector('#dialogue .dbox').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight + 1; }), 'the story box fits');
    await shot(page, `phone-story-${w}x${h}`);
    await skipStory(page, tapSel);
    await until(page, () => __hh.mode === 'play', 'taps through the story reach the first level');
    await until(page, () => !document.getElementById('touch').hidden, 'the touch deck is on from the first stage');

    const L = await layout(page);
    check(L.noHScroll, 'no sideways scroll');
    check(L.canvas, 'the canvas matches the visible viewport');
    const sizes = await inView(page, ['#btn-jump', '#btn-spin', '#btn-power', '#btn-swap', '#btn-pause']);
    for (const z of sizes) check(z.ok, `${z.s} is at least 44 px and on screen ${JSON.stringify(z.r)}`);
    // the HUD does not run under the back link
    check(await Q(page, () => { const a = document.getElementById('back-link').getBoundingClientRect(), hh = document.getElementById('hud-hearts').getBoundingClientRect(); return hh.left >= a.right - 1 || hh.top >= a.bottom; }), 'the hearts clear the back link');
    await shot(page, `phone-play-${w}x${h}`);

    // the stick, with a real touch
    const zone = await Q(page, () => { const r = document.getElementById('stick-zone').getBoundingClientRect(); return { x: r.left + r.width * 0.4, y: r.top + r.height * 0.6 }; });
    const z0 = await Q(page, () => __hh.G.p.z);
    await touch('touchStart', zone.x, zone.y);
    for (let i = 1; i <= 6; i++) await touch('touchMove', zone.x, zone.y - i * 12);
    await until(page, (z) => __hh.G.p.z < z - 2, 'dragging the stick up runs forward', 45000, z0);
    await touch('touchEnd', 0, 0);

    const n = async (k) => Q(page, (kk) => __hh.seen[kk] || 0, k);
    let j = await n('jump'); await tapSel('#btn-jump');
    await until(page, (j0) => (__hh.seen.jump || 0) > j0, 'tapping Jump jumps', 45000, j);
    let s = await n('spin'); await tapSel('#btn-spin');
    await until(page, (s0) => (__hh.seen.spin || 0) > s0, 'tapping Spin spins', 45000, s);
    let r = await n('roll'); await tapSel('#btn-power');
    await until(page, (r0) => (__hh.seen.roll || 0) > r0, 'tapping Power rolls', 45000, r);

    await tapSel('#btn-pause');
    await until(page, () => !document.getElementById('pause').hidden, 'tapping ❚❚ pauses');
    await page.waitForTimeout(600);
    check(await Q(page, () => !document.getElementById('pause').hidden), 'the pause screen stays open after the finger lifts');
    check(await Q(page, () => [...document.querySelectorAll('#pause-menu button')].every((b) => { const r = b.getBoundingClientRect(); return r.height >= 44 && r.bottom <= innerHeight + 1 && r.top >= 0; })), 'the pause menu fits');
    await shot(page, `phone-pause-${w}x${h}`);
    await tapSel('#pause-menu [data-act="resume"]');
    await until(page, () => document.getElementById('pause').hidden, 'a tap on Resume closes it');

    // results and the map on a phone
    await Q(page, () => { __hh.G.pearls = 40; __hh.win(); });
    await until(page, () => !document.getElementById('complete').hidden, 'the results appear');
    check(await Q(page, () => { const b = document.querySelector('#complete .sheet'); const r = b.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 0.5 && b.scrollWidth <= b.clientWidth + 1; }), 'the results fit the width');
    await shot(page, `phone-results-${w}x${h}`);
    await tapSel('#cl-map');
    await until(page, () => __hh.mode === 'map' && !document.getElementById('map').hidden, 'the map opens');
    check(await Q(page, () => { const b = document.querySelector('#map .sheet'); const r = b.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 0.5 && b.scrollWidth <= b.clientWidth + 1; }), 'the map fits the width');
    await shot(page, `phone-map-${w}x${h}`);
    await tapSel('#map-workshop');
    await until(page, () => !document.getElementById('workshop').hidden, 'the workshop opens');
    check(await Q(page, () => { const b = document.querySelector('#workshop .sheet'); const r = b.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 0.5 && b.scrollWidth <= b.clientWidth + 1; }), 'the workshop fits the width');
    await shot(page, `phone-workshop-${w}x${h}`);
    reportErrors(`phone ${w}×${h}`);
}

// ======================================================================
async function nostorage() {
    console.log('\n== blocked storage');
    const page = await open({ width: 1280, height: 760 }, { nostorage: true });
    await click(page, '#title-menu [data-act="new"]');
    await skipStory(page);
    await until(page, () => __hh.mode === 'play', 'boots and starts a game with localStorage throwing');
    await Q(page, () => __hh.ff(3));
    check(await Q(page, () => __hh.save() === false), 'saving fails quietly');
    await Q(page, () => __hh.win());
    await until(page, () => !document.getElementById('complete').hidden, 'a level can still be finished');
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

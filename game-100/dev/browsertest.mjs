/**
 * browsertest.mjs — the real game in real Chromium (SwiftShader WebGL).
 *
 * desktop (1280×760): the power screen, a key powers on, Enter skips the boot, a key leaves the
 *   attract loop, the menu by keyboard → Dance-Off → the countdown → play. Real arrow keys and
 *   Space move the cursor, grab and swap; a real mouse drag swaps; two clicks swap (the pointer
 *   is mapped back through the CRT bend, so this fails if the bend and its inverse disagree).
 *   Escape pauses and the sim stops → Resume by mouse → Save & Quit → Continue restores the
 *   game → the clock runs out → game over → a high score → initials typed on the keyboard →
 *   the table shows them. No sideways scroll; the canvas fills the window.
 * phones (touch only, real CDP touches) at 390×844 and 844×390: tap through power, boot, the
 *   menu and the mode list; tap two tokens to swap; swipe to swap; pause by tapping the button
 *   and resume; every control is at least 44 px and on screen; the board fits the viewport;
 *   no sideways scroll; the canvas matches the visible viewport.
 * nostorage: localStorage throws; the game still boots and plays.
 * Fails on any console error, page error or failed request.
 *
 *   python3 -m http.server 8100          # from the REPO ROOT
 *   node game-100/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8100), ONLY=desktop,phones,nostorage, THREE_PKG.
 * The harness runs at the Low quality tier and 20x simulation speed: SwiftShader draws a few
 * frames a second, and the tests wait on state, never on the clock.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8100';
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
        else {
            try {
                if (!sessionStorage.getItem('gg-test-init')) {
                    localStorage.clear();
                    localStorage.setItem('glitterball-groove.v1.settings', JSON.stringify({ quality: 'low', calm: true, crt: 'full', sfx: 0.5, music: 0.3, hints: true }));
                    sessionStorage.setItem('gg-test-init', '1');
                }
            } catch { /* */ }
        }
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
    await page.goto(`${BASE}/game-100/index.html?debug=1&fast=20`);
    await page.waitForFunction(() => window.__gg && __gg.screen === 'power', null, { timeout: 90000 });
    return page;
}

const check = (cond, msg) => { if (!cond) { fails++; console.log('  FAIL', msg); } else console.log('  ok', msg); return cond; };
const Q = (page, fn, arg) => page.evaluate(fn, arg);
const shot = async (page, name) => { await page.screenshot({ path: path.join(OUT, `bt-${name}.png`) }); };
// SwiftShader draws a few frames a second: wait on state, never on the clock.
const until = (page, fn, msg, timeout = 60000, arg = null) =>
    page.waitForFunction(fn, arg, { timeout, polling: 100 }).then(() => check(true, msg), () => check(false, msg));
const screenIs = (page, name, msg, timeout) => until(page, (n) => __gg.screen === n, msg, timeout, name);
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
/** Controls on this screen, in CSS px, from the UI's own hit list: each ≥ 44 px and on screen. */
const controlsOk = (page) => Q(page, () => {
    const ui = __gg.ui, bad = [];
    for (const h of ui.hits) {
        const w = h.w * ui.f, hh = h.h * ui.fy;
        if (w < 43.5 || hh < 43.5) bad.push(`${h.id} ${w.toFixed(0)}x${hh.toFixed(0)}`);
        if (h.x * ui.f < -1 || h.y * ui.fy < -1 || (h.x + h.w) * ui.f > innerWidth + 1 || (h.y + h.h) * ui.fy > innerHeight + 1) bad.push(`${h.id} off screen`);
    }
    return bad;
});
/** Pick a legal swap from the live board. */
const aMove = (page) => Q(page, () => { const m = __gg.moves()[0]; return m && { r: m.r, c: m.c, dir: m.dir }; });
const neighbour = (m) => ({ r: m.r + (m.dir === 2 ? 1 : 0), c: m.c + (m.dir === 1 ? 1 : 0) });
const swaps = (page) => Q(page, () => __gg.G.stats.swaps);
const settled = (page) => until(page, () => { const G = __gg.G; return G.state === 'play' && G.grid.every((t) => t && t.st === 0 && t.ox === 0 && t.oy === 0) && G.events.length === 0; }, 'the board settles');

// ======================================================================
async function desktop() {
    console.log('\n== desktop 1280×760');
    const page = await open({ width: 1280, height: 760 });
    check(await backLinkOk(page), '← Games link is on top and points at ../index.html');
    const L = await layout(page);
    check(L.noHScroll && L.canvas, 'no sideways scroll; the canvas fills the window');
    check(await Q(page, () => !__gg.hasSave()), 'no saved game on a fresh start');
    await shot(page, 'desktop-power');

    await page.keyboard.press('Space');
    await screenIs(page, 'boot', 'a key powers on the console and the boot pre-roll starts');
    await until(page, () => __gg.audio.running && __gg.audio.level() > 0.003, 'the band is playing: sound is coming out of the speakers', 45000);
    await shot(page, 'desktop-boot');
    await page.keyboard.press('Enter');
    await screenIs(page, 'attract', 'Enter skips the boot into the attract loop');
    await Q(page, () => { __gg.ui.attractI = 2; __gg.ui.attractT = 0; });
    await page.waitForTimeout(2500);
    await shot(page, 'desktop-scores');
    check(await Q(page, () => __gg.ui.attractPage.page === 'scores'), 'the attract loop shows the high scores');
    await page.keyboard.press('Space');
    await screenIs(page, 'menu', 'a key leaves the attract loop for the menu');
    await shot(page, 'desktop-menu');

    // keyboard through the menu: Enter on PLAY, then the mode list
    await page.keyboard.press('Enter');
    await screenIs(page, 'modes', 'PLAY opens the mode list');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowUp');
    await shot(page, 'desktop-modes');
    await page.keyboard.press('Enter');
    await screenIs(page, 'ready', 'Dance-Off starts the countdown');
    await shot(page, 'desktop-ready');
    await screenIs(page, 'hud', 'the countdown ends and play begins');
    check(await Q(page, () => __gg.G.mode === 'dance' && __gg.G.time > 55), 'Dance-Off: a minute on the clock');
    await settled(page);

    // keys: cursor, grab, swap
    let m = await aMove(page);
    const cur0 = await Q(page, () => ({ r: __gg.cursor.r, c: __gg.cursor.c }));
    await page.keyboard.press('ArrowRight');
    await until(page, (c) => __gg.cursor.c === Math.min(7, c + 1) && __gg.cursor.show, 'an arrow key moves the cursor and shows it', 30000, cur0.c);
    // walk the cursor to the move
    for (let guard = 0; guard < 16; guard++) {
        const cur = await Q(page, () => ({ r: __gg.cursor.r, c: __gg.cursor.c }));
        if (cur.r === m.r && cur.c === m.c) break;
        const key = cur.r < m.r ? 'ArrowDown' : cur.r > m.r ? 'ArrowUp' : cur.c < m.c ? 'ArrowRight' : 'ArrowLeft';
        await page.keyboard.press(key);
        await until(page, (a) => __gg.cursor.r !== a.r || __gg.cursor.c !== a.c, 'cursor stepped', 20000, cur);
    }
    const s0 = await swaps(page);
    await page.keyboard.press('Space');
    await until(page, () => __gg.cursor.grabbed, 'Space grabs the token under the cursor');
    await page.keyboard.press(m.dir === 2 ? 'ArrowDown' : 'ArrowRight');
    await until(page, (n) => __gg.G.stats.swaps > n, 'an arrow while holding a token swaps it', 30000, s0);
    await until(page, () => __gg.G.score > 0, 'the match scores');
    await settled(page);
    await shot(page, 'desktop-play');

    // mouse: drag from one token to its neighbour
    m = await aMove(page);
    let n = neighbour(m);
    let a = await Q(page, (p) => __gg.cell(p.r, p.c), m), b = await Q(page, (p) => __gg.cell(p.r, p.c), n);
    const s1 = await swaps(page);
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 3 });
    await page.mouse.move(b.x, b.y, { steps: 3 });
    await page.mouse.up();
    await until(page, (k) => __gg.G.stats.swaps > k, 'a mouse drag from a token towards its neighbour swaps them (pointer → CRT bend → board cell)', 30000, s1);
    await settled(page);

    // mouse: click a token, click its neighbour
    m = await aMove(page);
    n = neighbour(m);
    a = await Q(page, (p) => __gg.cell(p.r, p.c), m); b = await Q(page, (p) => __gg.cell(p.r, p.c), n);
    const s2 = await swaps(page);
    await page.mouse.click(a.x, a.y);
    await until(page, () => __gg.cursor.grabbed, 'a click selects a token');
    await page.mouse.click(b.x, b.y);
    await until(page, (k) => __gg.G.stats.swaps > k, 'a click on its neighbour swaps them', 30000, s2);
    await settled(page);

    // a swap that makes nothing is refused and costs nothing
    const bad = await Q(page, () => {
        const G = __gg.G, good = new Set(__gg.moves().map((x) => `${x.r},${x.c},${x.dir}`));
        for (let r = 0; r < 8; r++) for (let c = 0; c < 7; c++) if (!good.has(`${r},${c},1`)) return { r, c };
        return null;
    });
    const bad0 = await Q(page, () => __gg.G.stats.bad);
    a = await Q(page, (p) => __gg.cell(p.r, p.c), bad); b = await Q(page, (p) => __gg.cell(p.r, p.c + 1), bad);
    await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move(b.x, b.y, { steps: 4 }); await page.mouse.up();
    await until(page, (k) => __gg.G.stats.bad > k, 'a swap that makes nothing is refused', 30000, bad0);

    // pause
    await page.keyboard.press('Escape');
    await screenIs(page, 'pause', 'Escape pauses');
    await shot(page, 'desktop-pause');
    const t0 = await Q(page, () => __gg.G.t);
    await page.waitForTimeout(800);
    check(await Q(page, (t) => __gg.G.t === t, t0), 'the sim stops while paused');
    const r = await Q(page, () => __gg.hit('resume'));
    await page.mouse.click(r.x, r.y);
    await screenIs(page, 'hud', 'a click on Resume goes back to the game');
    await until(page, (t) => __gg.G.t > t, 'and the sim runs again', 30000, t0);

    // save and quit, continue
    await page.keyboard.press('Escape');
    await screenIs(page, 'pause', 'paused again');
    const score = await Q(page, () => __gg.G.score), time = await Q(page, () => __gg.G.time);
    check(await Q(page, () => __gg.hasSave()), 'pausing saves the game');
    await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown');
    await until(page, () => __gg.ui.sel === 3, 'arrow keys move down the pause menu');
    await page.keyboard.press('Enter');
    await screenIs(page, 'menu', 'Save & Quit goes to the menu');
    check(await Q(page, () => __gg.hits().includes('continue')), 'the menu now offers Continue');
    await page.keyboard.press('Enter');
    await screenIs(page, 'ready', 'Continue counts down');
    await screenIs(page, 'hud', 'and resumes');
    check(await Q(page, ([s, t]) => __gg.G.score === s && __gg.G.time <= t && __gg.G.time > t - 8, [score, time]), 'Continue restores the saved score and clock');

    let peak = 0;
    for (let i = 0; i < 12; i++) { peak = Math.max(peak, await Q(page, () => __gg.audio.level())); await page.waitForTimeout(150); }
    check(peak > 0.003 && peak < 1.0, `the mix is audible and does not clip (peak ${peak.toFixed(2)})`);

    // the end of the run: a long autoplay builds a score that makes the table
    await Q(page, () => { __gg.ff(120, 1); });
    await Q(page, () => { __gg.G.time = 0.05; });
    await screenIs(page, 'over', 'the clock runs out and the game ends', 90000);
    await until(page, () => __gg.ui.t > 1.0, 'the game over screen finishes drawing in');
    await shot(page, 'desktop-over');
    check(await Q(page, () => __gg.ui.data.rank >= 0), 'a big score makes the high-score table');
    check(await Q(page, () => __gg.hits().includes('entry')), 'the game over screen offers to take initials');
    await page.keyboard.press('Enter');
    await screenIs(page, 'entry', 'Enter opens the initials screen');
    await page.keyboard.type('xyz');
    await until(page, () => __gg.ui.entry.name.join('') === 'XYZ', 'typing sets the initials');
    await shot(page, 'desktop-entry');
    await page.keyboard.press('Enter');
    await screenIs(page, 'scores', 'confirming shows the table');
    check(await Q(page, () => JSON.stringify(localStorage.getItem('glitterball-groove.v1.scores')).includes('XYZ')), 'the new entry is saved with its initials');
    await page.waitForTimeout(2500);
    await shot(page, 'desktop-halls');
    await page.keyboard.press('Enter');
    await screenIs(page, 'menu', 'Enter leaves the table for the menu');
    reportErrors('desktop');
}

// ======================================================================
async function phone(w, h) {
    console.log(`\n== phone ${w}×${h} (touch only)`);
    const page = await open({ width: w, height: h }, { touch: true });
    const cdp = await page.context().newCDPSession(page);
    const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
    const tapId = async (id) => {
        const p = await Q(page, (i) => __gg.hit(i), id);
        if (!p) return false;
        await page.touchscreen.tap(p.x, p.y);
        return true;
    };
    const tapCell = async (r, c) => { const p = await Q(page, (q) => __gg.cell(q.r, q.c), { r, c }); await page.touchscreen.tap(p.x, p.y); };
    const swipe = async (m) => {
        const n = neighbour(m);
        const a = await Q(page, (q) => __gg.cell(q.r, q.c), m), b = await Q(page, (q) => __gg.cell(q.r, q.c), n);
        await touch('touchStart', a.x, a.y);
        for (let i = 1; i <= 5; i++) await touch('touchMove', a.x + ((b.x - a.x) * i) / 5, a.y + ((b.y - a.y) * i) / 5);
        await touch('touchEnd', 0, 0);
    };

    check(await backLinkOk(page), '← Games link is on top');
    await page.touchscreen.tap(w / 2, h / 2);
    await screenIs(page, 'boot', 'a tap powers on');
    await page.touchscreen.tap(w / 2, h / 2);
    await screenIs(page, 'attract', 'a tap skips the boot');
    await page.touchscreen.tap(w / 2, h / 2);
    await screenIs(page, 'menu', 'a tap leaves the attract loop');
    check((await controlsOk(page)).length === 0, 'menu controls are at least 44 px and on screen');
    await shot(page, `phone-${w}x${h}-menu`);
    await tapId('play');
    await screenIs(page, 'modes', 'tapping PLAY opens the mode list');
    check((await controlsOk(page)).length === 0, 'mode list controls are at least 44 px');
    await tapId('start:dance');
    await screenIs(page, 'hud', 'tapping Dance-Off counts down and starts play', 90000);
    await settled(page);

    const L = await layout(page);
    check(L.noHScroll, 'no sideways scroll');
    check(L.canvas, 'the canvas matches the visible viewport');
    check((await controlsOk(page)).length === 0, 'the pause button is at least 44 px and on screen');
    const fit = await Q(page, () => {
        // the four corners of the board, through the camera: all inside the picture with the hud's room left over
        const b = __gg.board, v = b.root.localToWorld.bind(b.root);
        const pts = [[-4.6, 4.6], [4.6, 4.6], [-4.6, -4.6], [4.6, -4.6]].map(([x, y]) => __gg.stage.project(v(new b.root.position.constructor(x, y, 0)), __gg.ui.VW, __gg.ui.VH));
        return pts.every((p) => p.x >= 0 && p.x <= __gg.ui.VW && p.y >= 0 && p.y <= __gg.ui.VH);
    });
    check(fit, 'the whole board is on screen');
    await shot(page, `phone-${w}x${h}-play`);

    let m = await aMove(page);
    let n = neighbour(m);
    const s0 = await swaps(page);
    await tapCell(m.r, m.c);
    await until(page, () => __gg.cursor.grabbed, 'a tap selects a token');
    await tapCell(n.r, n.c);
    await until(page, (k) => __gg.G.stats.swaps > k, 'a second tap on its neighbour swaps them', 30000, s0);
    await settled(page);

    m = await aMove(page);
    const s1 = await swaps(page);
    await swipe(m);
    await until(page, (k) => __gg.G.stats.swaps > k, 'a swipe towards a neighbour swaps them', 30000, s1);
    await settled(page);

    await tapId('pause');
    await screenIs(page, 'pause', 'tapping the pause button pauses');
    await page.waitForTimeout(400);
    check(await Q(page, () => __gg.screen === 'pause'), 'the pause screen stays open after the finger lifts');
    check((await controlsOk(page)).length === 0, 'pause menu controls are at least 44 px');
    await tapId('resume');
    await screenIs(page, 'hud', 'a tap on Resume goes back to the game');
    reportErrors(`phone ${w}×${h}`);
}

// ======================================================================
async function nostorage() {
    console.log('\n== blocked storage');
    const page = await open({ width: 1280, height: 760 }, { nostorage: true });
    await page.keyboard.press('Space');
    await screenIs(page, 'boot', 'boots with localStorage throwing');
    await page.keyboard.press('Enter');
    await Q(page, () => __gg.start('dance', 4));
    await screenIs(page, 'hud', 'starts a game');
    await Q(page, () => __gg.ff(4));
    check(await Q(page, () => __gg.save() === false), 'saving fails quietly');
    await Q(page, () => { __gg.ff(100); __gg.G.time = 0.05; });
    await screenIs(page, 'over', 'a run ends and shows the game over screen', 90000);
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

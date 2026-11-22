/**
 * browsertest.mjs — JINGLE POP in real Chromium (SwiftShader WebGL).
 *
 * desktop (1280×760): boot to the title with no errors and the ← Games link on top → the level map → the story by
 *   click → the mouse aims and a click shoots → keys aim and Space shoots, a press during the cool-down is kept →
 *   Escape pauses and the sim stops → Settings closes with Escape from a slider → number keys and a click swap the
 *   tray → Q and a click on the sack load a power-up → Save & Quit → Continue restores → a level is won and the
 *   result screen leads to the next one → a level is lost → the Blizzard starts → the ElevenLabs audio decodes and
 *   the music plays. No sideways scroll; the canvas fills the window.
 * phones (touch only, real CDP touches) at 390×844 and 844×390: taps through the title and story, a drag on the board
 *   and a lift shoots, a drag back below the launcher cancels, the tray and the sack answer taps, controls ≥ 44 px, on
 *   screen and on top, the pause screen stays open after the finger lifts.
 * nostorage: localStorage throws; the game still boots and plays.
 * Fails on any console error, page error or failed request.
 *
 *   python3 -m http.server 8146          # from the REPO ROOT
 *   node game-146/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8146), ONLY=desktop,phones,nostorage, THREE_PKG.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8146';
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
    page.on('requestfailed', (r) => { if (!r.url().includes('favicon') && !r.url().includes('fonts.gstatic')) errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`); });
    await page.goto(`${BASE}/game-146/index.html?debug=1&fast=4`);
    await page.waitForFunction(() => window.__jp && __jp.mode === 'title', null, { timeout: 60000 });
    return page;
}

const check = (cond, msg) => { if (!cond) { fails++; console.log('  FAIL', msg); } else console.log('  ok', msg); return cond; };
const Q = (page, fn, arg) => page.evaluate(fn, arg);
const shot = async (page, name) => { await page.screenshot({ path: path.join(OUT, `bt-${name}.png`) }); };
const until = (page, fn, msg, timeout = 30000, arg = null) =>
    page.waitForFunction(fn, arg, { timeout, polling: 100 }).then(() => check(true, msg), () => check(false, msg));
const click = (page, sel) => Q(page, (s) => { const e = document.querySelector(s); if (!e) return false; e.click(); return true; }, sel);
const center = (page, sel) => Q(page, (s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2, w: b.width, h: b.height }; }, sel);
const vis = (page, id) => Q(page, (i) => !document.getElementById(i).hidden, id);
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
/** Screen point of a sim position. */
const simToScreen = (page, x, y) => Q(page, ([a, b]) => __jp.view.toScreen(a, b), [x, y]);

// ======================================================================
async function desktop() {
    console.log('\n== desktop 1280×760');
    const page = await open({ width: 1280, height: 760 });
    check(await backLinkOk(page), '← Games link is on top and points at ../index.html');
    check(await vis(page, 'title'), 'title screen is up');
    check(await Q(page, () => document.getElementById('btn-continue').hidden), 'no Continue without a save');
    let L = await layout(page);
    check(L.noHScroll && L.canvas, 'no sideways scroll; the canvas fills the window');
    await shot(page, 'desktop-title');

    await click(page, '#title-menu [data-act="map"]');
    await until(page, () => !document.getElementById('map').hidden && document.querySelectorAll('.lvl').length === 36, 'the level map lists 36 levels');
    check(await Q(page, () => [...document.querySelectorAll('.lvl')].filter((b) => !b.disabled).length === 1), 'only level 1 is open on a fresh save');
    await shot(page, 'desktop-map');
    await page.keyboard.press('Escape');
    await until(page, () => document.getElementById('map').hidden, 'Escape closes the map');

    await click(page, '#title-menu [data-act="story"]');
    await until(page, () => !document.getElementById('story').hidden && document.getElementById('story-who').textContent === 'Mrs. Claus', 'Start the Story opens Mrs. Claus\'s scene');
    await shot(page, 'desktop-story');
    for (let i = 0; i < 6; i++) { if (await Q(page, () => __jp.mode === 'play')) break; await page.keyboard.press('Enter'); await page.waitForTimeout(150); }
    await until(page, () => __jp.mode === 'play' && __jp.G.level === 1 && document.getElementById('story').hidden, 'Enter steps through the story into level 1');

    // the mouse aims, a click shoots
    const s1 = await simToScreen(page, 1.5, 6);
    await page.mouse.move(s1.x, s1.y);
    await until(page, () => __jp.G.aim > 1.8, 'moving the mouse to the left aims left');
    const shots0 = await Q(page, () => __jp.seen.shoot || 0);
    await page.mouse.down(); await page.mouse.up();
    await until(page, (n) => (__jp.seen.shoot || 0) > n, 'a click shoots', 30000, shots0);
    await until(page, () => (__jp.seen.stick || 0) + (__jp.seen.pop || 0) >= 1 && __jp.G.phase === 'aim', 'the ornament flies and lands');
    // keys aim; Space shoots; a second Space during the cool-down is kept, not dropped
    await page.mouse.move(5, 750);
    const a0 = await Q(page, () => __jp.G.aim);
    await page.keyboard.down('ArrowRight');
    await until(page, (a) => __jp.G.aim < a - 0.2, 'holding → turns the aim right', 30000, a0);
    await page.keyboard.up('ArrowRight');
    const shots1 = await Q(page, () => __jp.seen.shoot || 0);
    await page.keyboard.press('Space');
    await until(page, (n) => (__jp.seen.shoot || 0) > n, 'Space shoots', 30000, shots1);
    await until(page, () => __jp.G.phase === 'aim', 'and it lands');
    await Q(page, () => { __jp.G.cool = 0.1; });
    await page.keyboard.press('Space');
    await until(page, (n) => (__jp.seen.shoot || 0) > n + 1, 'a Space pressed during the cool-down still fires once it ends', 30000, shots1);
    await shot(page, 'desktop-play');

    await page.keyboard.press('Escape');
    await until(page, () => !document.getElementById('pause').hidden, 'Escape pauses');
    const t0 = await Q(page, () => __jp.G.t);
    await page.waitForTimeout(500);
    check(await Q(page, (t) => __jp.G.t === t, t0), 'the sim stops while paused');
    await click(page, '#pause-menu [data-act="settings"]');
    await until(page, () => !document.getElementById('settings').hidden, 'Settings opens over the pause screen');
    check(await Q(page, () => +getComputedStyle(document.getElementById('settings')).zIndex > +getComputedStyle(document.getElementById('pause')).zIndex), 'and sits on top of it');
    await page.focus('#set-music');
    await page.keyboard.press('Escape');
    await until(page, () => document.getElementById('settings').hidden && !document.getElementById('pause').hidden, 'Escape closes Settings even with a slider focused');
    await page.keyboard.press('Escape');
    await until(page, (t) => document.getElementById('pause').hidden && __jp.G.t > t, 'Escape again resumes and the sim runs', 30000, t0);

    // the tray (level 20 has three) and the sack
    await Q(page, () => __jp.start(20, 4));
    await until(page, () => __jp.G.level === 20 && __jp.G.tray.length === 3, 'level 20 has three ornaments in the tray');
    let tray = await Q(page, () => __jp.G.tray.slice());
    await page.keyboard.press('Digit3');
    await until(page, (t) => __jp.G.tray[0] === t[2] && __jp.G.tray[2] === t[0], 'the 3 key swaps the third ornament into the launcher', 30000, tray);
    tray = await Q(page, () => __jp.G.tray.slice());
    const tb = await center(page, '#tray-hit button[data-slot="1"]');
    check(tb && tb.w >= 44, 'the tray buttons are at least 44 px');
    await page.mouse.click(tb.x, tb.y);
    await until(page, (t) => __jp.G.tray[0] === t[1], 'clicking a tray ornament loads it', 30000, tray);
    await Q(page, () => { __jp.G.sack = ['bomb', 'north']; });
    await page.keyboard.press('KeyQ');
    await until(page, () => __jp.G.loaded === 'bomb', 'Q loads the first power-up');
    const sb = await center(page, '#sack .slot[data-use="0"]');
    await page.mouse.click(sb.x, sb.y);
    await until(page, () => __jp.G.guide === 8, 'clicking the North Star in the sack lights the full guide');
    await shot(page, 'desktop-power');
    const s2 = await simToScreen(page, 5.5, 3);
    await page.mouse.move(s2.x, s2.y); await page.mouse.down(); await page.mouse.up();
    await until(page, () => (__jp.seen.blast || 0) >= 1, 'the pudding bomb fires and bursts');

    // save and continue
    await Q(page, () => { __jp.ff(3); });
    const score = await Q(page, () => __jp.G.score);
    await Q(page, () => document.querySelector('#btn-pause').click());
    await until(page, () => !document.getElementById('pause').hidden, 'the ❚❚ button pauses');
    await click(page, '#pause-menu [data-act="quit"]');
    await until(page, () => __jp.mode === 'title' && !document.getElementById('btn-continue').hidden, 'Save & Quit returns to the title with Continue');
    await click(page, '#title-menu [data-act="continue"]');
    await until(page, (s) => __jp.mode === 'play' && __jp.G.level === 20 && __jp.G.score === s, 'Continue restores the level', 30000, score);

    // win level 1, see the result, go on
    await Q(page, () => { __jp.start(1, 2); __jp.ff(300); });
    await until(page, () => __jp.G.result === 'won' && !document.getElementById('result').hidden, 'the bot clears level 1 and the result screen shows', 30000);
    check(await Q(page, () => document.querySelectorAll('#result-stars .on').length === __jp.G.stars && __jp.progress.unlocked >= 2), 'stars are shown and level 2 unlocks');
    await shot(page, 'desktop-won');
    await click(page, '#result-next');
    await until(page, () => __jp.mode === 'play' && __jp.G.level === 2, 'Next Level starts level 2');

    // lose
    await Q(page, () => { __jp.G.ceil = 10; __jp.G.dropEvery = 1; __jp.G.cool = 0; });
    await page.keyboard.press('Space');
    await until(page, () => __jp.G.result === 'lost' && !document.getElementById('result').hidden, 'an ornament past the line loses, and says so');
    check(await Q(page, () => document.getElementById('result-next').hidden), 'no Next Level after a loss');
    await shot(page, 'desktop-lost');
    await click(page, '#result-again');
    await until(page, () => __jp.mode === 'play' && __jp.G.level === 2 && __jp.G.shots === 0, 'Try Again restarts it');

    // the blizzard
    await Q(page, () => document.querySelector('#btn-pause').click());
    await click(page, '#pause-menu [data-act="quit"]');
    await until(page, () => __jp.mode === 'title', 'back at the title');
    await click(page, '#title-menu [data-act="endless"]');
    await until(page, () => !document.getElementById('story').hidden && document.getElementById('story-who').textContent === 'Grimwick', 'Blizzard opens with Grimwick');
    await click(page, '#story-next');
    await until(page, () => __jp.mode === 'play' && __jp.G.mode === 'endless', 'and starts the endless blizzard');
    await Q(page, () => __jp.ff(20));
    await until(page, () => __jp.G.pushed >= 1, 'rows push in from the top');
    await shot(page, 'desktop-endless');

    // audio: the ElevenLabs files decode and a theme plays
    await until(page, () => Object.keys(__jp.audio.buffers).length >= 35, 'the ElevenLabs effects and voices decode', 30000);
    await until(page, () => __jp.audio.playing(), 'a music theme is playing');
    L = await layout(page);
    check(L.noHScroll && L.canvas, 'still no sideways scroll; the canvas fills the window');
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
    await tapSel('#title-menu [data-act="story"]');
    await until(page, () => !document.getElementById('story').hidden, 'a tap on Start the Story opens the story');
    for (let i = 0; i < 6 && !(await Q(page, () => __jp.mode === 'play')); i++) { await tapSel('#story-next'); await page.waitForTimeout(200); }
    await until(page, () => __jp.mode === 'play', 'tapping Next plays level 1');
    const L = await layout(page);
    check(L.noHScroll, 'no sideways scroll');
    check(L.canvas, 'the canvas matches the visible viewport');

    // drag on the board and lift: shoots where the finger was
    const a = await simToScreen(page, 9, 5), b = await simToScreen(page, 2, 6);
    const n0 = await Q(page, () => __jp.seen.shoot || 0);
    await touch('touchStart', a.x, a.y);
    for (let i = 1; i <= 5; i++) await touch('touchMove', a.x + (b.x - a.x) * i / 5, a.y + (b.y - a.y) * i / 5);
    await until(page, () => __jp.G.aim > 1.8, 'dragging a finger on the board aims');
    await touch('touchEnd', 0, 0);
    await until(page, (n) => (__jp.seen.shoot || 0) > n, 'lifting the finger shoots', 30000, n0);
    await until(page, () => __jp.G.phase === 'aim', 'the shot lands');
    // a drag that ends back below the launcher cancels
    const n1 = await Q(page, () => __jp.seen.shoot || 0);
    const low = await simToScreen(page, 5.5, 16.2);
    await touch('touchStart', a.x, a.y);
    await touch('touchMove', low.x, low.y);
    await touch('touchEnd', 0, 0);
    await page.waitForTimeout(600);
    check(await Q(page, (n) => (__jp.seen.shoot || 0) === n, n1), 'a drag back below the launcher cancels the shot');

    await Q(page, () => { __jp.start(20, 4); __jp.G.sack = ['bomb', 'star']; });
    await until(page, () => __jp.G.level === 20, 'level 20');
    const tray = await Q(page, () => __jp.G.tray.slice());
    await tapSel('#tray-hit button[data-slot="2"]');
    await until(page, (t) => __jp.G.tray[0] === t[2], 'tapping a tray ornament loads it', 30000, tray);
    await tapSel('#sack .slot[data-use="1"]');
    await until(page, () => __jp.G.loaded === 'star', 'tapping the sack loads a power-up');
    await shot(page, `phone-${w}x${h}`);

    const sizes = await Q(page, () => ['#btn-pause', '#sack .slot[data-use="0"]', '#sack .slot[data-use="2"]', '#tray-hit button[data-slot="1"]', '#tray-hit button[data-slot="2"]'].map((s) => {
        const e = document.querySelector(s), r = e.getBoundingClientRect();
        const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return { s, ok: r.width >= 43.5 && r.height >= 43.5 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight, onTop: top === e || e.contains(top) };
    }));
    for (const z of sizes) { check(z.ok, `${z.s} is at least 44 px and on screen`); check(z.onTop, `${z.s} is not covered by anything`); }

    await tapSel('#btn-pause');
    await until(page, () => !document.getElementById('pause').hidden, 'tapping ❚❚ pauses');
    await page.waitForTimeout(300);
    check(await vis(page, 'pause'), 'the pause screen stays open after the finger lifts');
    await tapSel('#pause-menu [data-act="resume"]');
    await until(page, () => document.getElementById('pause').hidden, 'a tap on Resume closes it');
    reportErrors(`phone ${w}×${h}`);
}

// ======================================================================
async function nostorage() {
    console.log('\n== blocked storage');
    const page = await open({ width: 1280, height: 760 }, { nostorage: true });
    await click(page, '#title-menu [data-act="story"]');
    await until(page, () => !document.getElementById('story').hidden, 'the story starts with localStorage throwing');
    await click(page, '#story-skip');
    await until(page, () => __jp.mode === 'play', 'and the level starts');
    await Q(page, () => __jp.ff(3));
    check(await Q(page, () => __jp.save() === false), 'saving fails quietly');
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

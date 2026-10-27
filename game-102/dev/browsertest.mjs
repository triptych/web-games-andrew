/**
 * browsertest.mjs — the real game in real Chromium (SwiftShader WebGL).
 *
 * desktop (1280×760): boot to the title with no errors, the ← Games link on top → New Game by
 *   click → real arrow keys turn the aim → a real mouse drag pulls the sling and lets go → a real
 *   Space press uses the special in flight → Escape pauses and the sim stops → Space presses a
 *   focused Resume → Save & Quit → Continue restores the game → the sector ends → Retry; a won
 *   sector unlocks the next and Next Sector starts it. No sideways scroll; the canvas fills the window.
 * phones (touch only, real CDP touches) at 390×844 and 844×390: taps through the menus, the touch
 *   deck appears, a touch drag on the canvas fires, a tap in flight uses the special, the FIRE
 *   button fires, controls ≥ 44 px and on screen, no sideways scroll, the canvas matches the
 *   visible viewport.
 * nostorage: localStorage throws; the game still boots and plays.
 * Fails on any console error, page error or failed request.
 *
 *   python3 -m http.server 8102          # from the REPO ROOT
 *   node game-102/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8102), ONLY=desktop,phones,nostorage, THREE_PKG, PW_CHROMIUM_PATH.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8102';
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
    await page.route('https://fonts.gstatic.com/**', (r) => r.abort());
    errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('requestfailed', (r) => { if (!r.url().includes('favicon') && !r.url().includes('fonts.gstatic')) errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`); });
    await page.goto(`${BASE}/game-102/index.html?debug=1&fast=4`);
    await page.waitForFunction(() => window.__ss && __ss.mode === 'title', null, { timeout: 60000 });
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
/** Client px of a sim point, through the game's own camera. */
const toClient = (page, x, y) => Q(page, ([x, y]) => __ss.view.worldToScreen(x, y), [x, y]);
/** Where to put a finger to pull the sling to this angle and power. */
const pullPoint = (page, angle, power) => toClient(page, 6 - Math.cos(angle) * power * 3.4, 5.3 - Math.sin(angle) * power * 3.4);
const finishTweens = (page) => Q(page, () => document.getAnimations().forEach((a) => a.finish()));

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

    // the sector list: only the first is open
    await click(page, '#title-menu [data-act="levels"]');
    await until(page, () => !document.getElementById('levels').hidden, 'Sectors opens the list');
    check(await Q(page, () => {
        const b = [...document.querySelectorAll('#level-grid button')];
        return b.length >= 6 && !b[0].disabled && b.slice(1).every((x) => x.disabled);
    }), 'only sector 1 is open to begin with');
    await shot(page, 'desktop-levels');
    await click(page, '#levels [data-close]');

    await click(page, '#title-menu [data-act="new"]');
    await until(page, () => __ss.mode === 'play' && document.getElementById('title').hidden, 'New Game starts play');
    check(await Q(page, () => __ss.G.level === 0 && __ss.G.state === 'ready'), 'on sector 1, ready to fire');

    // keys turn the aim
    const a0 = await Q(page, () => __ss.G.aim.angle);
    await page.keyboard.down('ArrowUp');
    await until(page, (a) => __ss.G.aim.angle > a + 0.1, 'holding ↑ raises the aim', 30000, a0);
    await page.keyboard.up('ArrowUp');
    const p0 = await Q(page, () => __ss.G.aim.power);
    await page.keyboard.down('ArrowLeft');
    await until(page, (p) => __ss.G.aim.power < p - 0.05, 'holding ← lowers the power', 30000, p0);
    await page.keyboard.up('ArrowLeft');

    // a real mouse drag: pull back, let go
    const want = { angle: 0.62, power: 0.8 };
    const from = await toClient(page, 6, 5.3), to = await pullPoint(page, want.angle, want.power);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 3 });
    await page.mouse.move(to.x, to.y, { steps: 3 });
    await until(page, (w) => Math.abs(__ss.G.aim.angle - w.angle) < 0.05 && Math.abs(__ss.G.aim.power - w.power) < 0.06, 'dragging sets the angle and power under the mouse', 30000, want);
    await shot(page, 'desktop-aim');
    await page.mouse.up();
    await until(page, () => __ss.seen.launch >= 1 && __ss.G.shots === 1, 'letting go fires');
    check(await Q(page, (w) => { const b = __ss.G.bodies.find((o) => o.ammo === 'rock' && o.id === __ss.G.proj); return !b || Math.abs(Math.atan2(b.vy, b.vx) - w.angle) < 0.35; }, want), 'the asteroid flies the way it was aimed');

    // Space in flight is the special (the rock burns). Fire again by key first if the shot has ended.
    await until(page, () => __ss.G.state === 'ready' || __ss.G.over, 'the shot ends and the next is ready', 60000);
    if (await Q(page, () => !__ss.G.over)) {
        await page.keyboard.press('Space');
        await until(page, () => __ss.G.shots >= 2, 'Space fires when ready');
        await page.keyboard.press('Space');
        await until(page, () => (__ss.seen.boost || 0) >= 1 || __ss.G.state !== 'flight', 'Space in flight burns the thrusters (or the shot had already ended)');
    }
    await shot(page, 'desktop-play');

    // pause: Escape, Space on a focused button, the sim stops
    await Q(page, () => __ss.start(5, 1));
    await until(page, () => __ss.mode === 'play' && __ss.G.level === 1, 'a debug start loads sector 2');
    await page.keyboard.press('Escape');
    await until(page, () => !document.getElementById('pause').hidden, 'Escape pauses');
    const t0 = await Q(page, () => __ss.G.t);
    await page.waitForTimeout(500);
    check(await Q(page, (t) => __ss.G.t === t, t0), 'the sim stops while paused');
    await finishTweens(page);
    await page.keyboard.press('Space');
    await until(page, () => document.getElementById('pause').hidden, 'Space presses the focused Resume (a real key press, not .click())');

    await Q(page, () => { __ss.ff(1); });
    const state = await Q(page, () => ({ score: __ss.G.score, shots: __ss.G.shots, level: __ss.G.level }));
    await Q(page, () => document.querySelector('#btn-pause').click());
    await until(page, () => !document.getElementById('pause').hidden, 'the ❚❚ button pauses');
    await click(page, '#pause-menu [data-act="quit"]');
    await until(page, () => __ss.mode === 'title' && !document.getElementById('btn-continue').hidden, 'Save & Quit returns to the title with Continue');
    await click(page, '#title-menu [data-act="continue"]');
    await until(page, (s) => __ss.mode === 'play' && __ss.G.score === s.score && __ss.G.shots === s.shots && __ss.G.level === s.level, 'Continue restores the saved game', 30000, state);

    // a lost sector: Retry
    await Q(page, () => __ss.ff(200));
    await until(page, () => __ss.mode === 'over' && !document.getElementById('over').hidden, 'the sector ends and shows the sheet');
    await shot(page, 'desktop-over');
    await click(page, '#over-retry');
    await until(page, () => __ss.mode === 'play' && __ss.G.t < 5 && __ss.G.level >= 0, 'Retry starts a fresh sector');

    // a won sector: unlocks the next, Next Sector starts it
    await Q(page, () => __ss.start(9, 0));
    await Q(page, () => { for (const b of __ss.G.bodies) if (b.mat === 'robot') { b.x = 18; b.y = -8.8; b.asleep = false; } });
    await until(page, () => __ss.mode === 'over' && __ss.G.won, 'with every robot gone the sector is won', 60000);
    await finishTweens(page);
    check(await Q(page, () => !document.getElementById('over-next').hidden && document.querySelectorAll('#over-stars span').length === 3), 'the sheet shows stars and Next Sector');
    check(await Q(page, () => __ss.progress.stars[0] >= 1), 'and the stars are recorded');
    await shot(page, 'desktop-won');
    await click(page, '#over-next');
    await until(page, () => __ss.mode === 'play' && __ss.G.level === 1, 'Next Sector starts sector 2');
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
    await finishTweens(page);
    await tapSel('#title-menu [data-act="new"]');
    await until(page, () => __ss.mode === 'play', 'a tap on New Game starts play');
    await until(page, () => !document.getElementById('touch').hidden, 'the touch deck is shown before the first shot');

    const L = await layout(page);
    check(L.noHScroll, 'no sideways scroll');
    check(L.canvas, 'the canvas matches the visible viewport');

    const sizes = await Q(page, () => ['#btn-a', '#btn-pause'].map((s) => {
        const r = document.querySelector(s).getBoundingClientRect();
        return { s, ok: r.width >= 44 && r.height >= 44 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight };
    }));
    for (const z of sizes) check(z.ok, `${z.s} is at least 44 px and on screen`);
    check(await Q(page, () => { const r = document.getElementById('hud').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight / 2; }), 'the HUD fits on the screen');

    // pull the sling with a real finger, anywhere: the aim follows the finger, the world point under it is where it should be
    const want = { angle: 0.7, power: 0.75 };
    const to = await pullPoint(page, want.angle, want.power);
    const start = { x: to.x - 20, y: to.y + 30 };
    await touch('touchStart', start.x, start.y);
    for (let i = 1; i <= 5; i++) await touch('touchMove', start.x + (to.x - start.x) * i / 5, start.y + (to.y - start.y) * i / 5);
    await until(page, (wnt) => Math.abs(__ss.G.aim.angle - wnt.angle) < 0.06 && Math.abs(__ss.G.aim.power - wnt.power) < 0.07, 'a touch drag sets the aim exactly under the finger', 30000, want);
    await shot(page, `phone-${w}x${h}-aim`);
    await touch('touchEnd', 0, 0);
    await until(page, () => __ss.G.shots === 1, 'lifting the finger fires');

    // a tap anywhere on the canvas in flight is the special
    const sp = await Q(page, () => ({ boost: __ss.seen.boost || 0, flying: __ss.G.state === 'flight' }));
    if (sp.flying) {
        await page.touchscreen.tap(w * 0.5, h * 0.5);
        await until(page, (n) => (__ss.seen.boost || 0) > n || __ss.G.state !== 'flight', 'a tap in flight uses the special (or the shot had ended)', 30000, sp.boost);
    }
    await until(page, () => __ss.G.state === 'ready' || __ss.G.over, 'the shot ends', 60000);

    // the FIRE button on the deck
    const shots = await Q(page, () => __ss.G.shots);
    if (await Q(page, () => !__ss.G.over)) {
        await tapSel('#btn-a');
        await until(page, (n) => __ss.G.shots > n, 'the deck button fires when ready', 30000, shots);
    }
    await shot(page, `phone-${w}x${h}`);

    await tapSel('#btn-pause');
    await until(page, () => !document.getElementById('pause').hidden, 'tapping ❚❚ pauses');
    await page.waitForTimeout(300);
    check(await Q(page, () => !document.getElementById('pause').hidden), 'the pause screen stays open after the finger lifts');
    await finishTweens(page);
    await tapSel('#pause-menu [data-act="resume"]');
    await until(page, () => document.getElementById('pause').hidden, 'a tap on Resume closes it');
    reportErrors(`phone ${w}×${h}`);
}

// ======================================================================
async function nostorage() {
    console.log('\n== blocked storage');
    const page = await open({ width: 1280, height: 760 }, { nostorage: true });
    await click(page, '#title-menu [data-act="new"]');
    await until(page, () => __ss.mode === 'play', 'boots and starts a game with localStorage throwing');
    await Q(page, () => __ss.ff(3));
    check(await Q(page, () => __ss.save() === false), 'saving fails quietly');
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

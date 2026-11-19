/**
 * browsertest.mjs — the real game in real Chromium (SwiftShader WebGL).
 *
 * desktop (1280×760): title and back link → Play → the map (castle 1 open, castle 2 locked) → the
 *   intro card → play. Real keys aim and fire; a mouse drag on the view aims, a click fires;
 *   Escape pauses (the sim stops) and Space presses the focused Resume; Escape closes Settings with a
 *   slider focused; Save & Quit → Continue restores the castle; the bot clears it → results with
 *   stars → castle 2 unlocked → Next Castle opens its intro. Every sound clip decodes, music plays.
 * phones (touch only, real CDP touches) at 390×844 and 844×390: taps through the menus, the FIRE
 *   button and the rack are ≥ 44 px and on screen, a drag on the view aims, a tap fires, FIRE fires,
 *   the pause screen stays open after the finger lifts, no sideways scroll, the canvas matches the
 *   visible viewport, the intro's buttons stay on screen.
 * nostorage: localStorage throws; the game boots, plays and can't save.
 * Fails on any console error, page error or failed request.
 *
 *   python3 -m http.server 8142          # from the REPO ROOT
 *   node game-142/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8142), ONLY=desktop,phones,nostorage, THREE_PKG.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8142';
const OUT = path.join(HERE, 'shots');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const want = (name) => !ONLY.length || ONLY.includes(name);
fs.mkdirSync(OUT, { recursive: true });

let fails = 0;
let errors = [];
let browser = null;

async function open(viewport, { touch = false, nostorage = false, query = '' } = {}) {
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
    await page.goto(`${BASE}/game-142/index.html?debug=1&fast=4${query}`);
    await page.waitForFunction(() => window.__kk && __kk.mode === 'title', null, { timeout: 60000 });
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
const onScreen44 = (page, sels) => Q(page, (ss) => ss.map((s) => {
    const e = document.querySelector(s);
    if (!e) return { s, ok: false };
    const r = e.getBoundingClientRect();
    return { s, ok: r.width >= 44 && r.height >= 44 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5 };
}), sels);
const reportErrors = (label) => { check(errors.length === 0, `${label}: no console errors, page errors or failed requests`); for (const e of errors.slice(0, 8)) console.log('    ', e); };

// ======================================================================
async function desktop() {
    console.log('\n== desktop 1280×760');
    const page = await open({ width: 1280, height: 760 });
    check(await backLinkOk(page), '← Games link is on top and points at ../index.html');
    check(await visible(page, 'title'), 'title screen is up');
    check(await Q(page, () => document.getElementById('btn-continue').hidden), 'no Continue without a save');
    const L = await layout(page);
    check(L.noHScroll && L.canvas, 'no sideways scroll; the canvas fills the window');
    await shot(page, 'desktop-title');

    await click(page, '#title-menu [data-act="play"]');
    await until(page, () => !document.getElementById('map').hidden, 'Play opens the map of castles');
    check(await Q(page, () => { const b = document.querySelectorAll('.lvl'); return b.length === 12 && !b[0].disabled && b[1].disabled; }), 'twelve castles: the first open, the second locked');
    await shot(page, 'desktop-map');
    await click(page, '.lvl[data-level="0"]');
    await until(page, () => !document.getElementById('intro').hidden && document.getElementById('intro-name').textContent.length > 3, 'a castle opens its intro card');
    await shot(page, 'desktop-intro');
    await click(page, '#intro-go');
    await until(page, () => __kk.mode === 'play' && !document.getElementById('hud').hidden && document.getElementById('intro').hidden, '"Fire away!" starts the castle');
    // real keys aim and fire (the first real key press also starts the sound)
    const y0 = await Q(page, () => __kk.G.aim.yaw);
    await page.keyboard.down('ArrowLeft');
    await until(page, (y) => __kk.G.aim.yaw > y + 0.05, 'holding ← turns the cannon left', 30000, y0);
    await page.keyboard.up('ArrowLeft');
    const p0 = await Q(page, () => __kk.G.aim.pitch);
    await page.keyboard.down('ArrowUp');
    await until(page, (p) => __kk.G.aim.pitch > p + 0.03, 'holding ↑ raises the barrel', 30000, p0);
    await page.keyboard.up('ArrowUp');
    await until(page, () => __kk.audio.ctx && __kk.audio.loaded + __kk.audio.failed.length >= 33, 'the sound clips have loaded', 30000);
    check(await Q(page, () => __kk.audio.failed.length === 0 && __kk.audio.loaded === 33), 'all 33 effect and voice clips decode');
    await until(page, () => __kk.audio.music.play && !__kk.audio.music.play.el.paused, 'the play music is playing');
    // test shots go wide of the tower, so the castle isn't won by accident
    await Q(page, () => __kk.aim(0.45, 0.17));
    await page.keyboard.press('Space');
    await until(page, () => __kk.G.shots === 1 && (__kk.seen.fire || 0) >= 1, 'Space fires (the press reaches a sim step)');
    await until(page, () => (__kk.seen.impact || 0) >= 1, 'the ball lands somewhere');
    await shot(page, 'desktop-shot');

    // a mouse drag on the view aims; a click fires
    await until(page, () => __kk.G.reload === 0, 'the cannon reloads');
    const a0 = await Q(page, () => ({ ...__kk.G.aim }));
    await page.mouse.move(640, 400);
    await page.mouse.down();
    for (let i = 1; i <= 8; i++) await page.mouse.move(640 - i * 12, 400 - i * 6);
    await page.mouse.up();
    await until(page, (a) => __kk.G.aim.yaw > a.yaw + 0.1 && __kk.G.aim.pitch > a.pitch + 0.03, 'dragging the view left and up aims left and up', 30000, a0);
    check(await Q(page, () => __kk.G.shots === 1), 'a drag does not fire');
    await Q(page, () => __kk.aim(-0.45, 0.17));
    await page.mouse.click(640, 400);
    await until(page, () => __kk.G.shots === 2, 'a click (no drag) on the view fires');

    // pause; Space presses the focused button; Escape closes a sheet with a slider focused
    await page.keyboard.press('Escape');
    await until(page, () => !document.getElementById('pause').hidden, 'Escape pauses');
    const t0 = await Q(page, () => __kk.G.t);
    await page.waitForTimeout(500);
    check(await Q(page, (t) => __kk.G.t === t, t0), 'the sim stops while paused');
    await click(page, '#pause-menu [data-act="settings"]');
    await until(page, () => !document.getElementById('settings').hidden, 'Settings opens over the pause screen');
    check(await Q(page, () => +getComputedStyle(document.getElementById('settings')).zIndex > +getComputedStyle(document.getElementById('pause')).zIndex), 'and on top of it');
    await Q(page, () => document.getElementById('set-sfx').focus());
    await page.keyboard.press('Escape');
    await until(page, () => document.getElementById('settings').hidden && !document.getElementById('pause').hidden, 'Escape closes Settings even with a slider focused');
    await Q(page, () => document.querySelector('#pause-menu [data-act="resume"]').focus());
    await page.keyboard.press('Space');
    await until(page, (t) => document.getElementById('pause').hidden && __kk.G.t > t, 'Space presses the focused Resume, and the sim runs again', 30000, t0);

    // save and continue
    await Q(page, () => document.querySelector('#btn-pause').click());
    await until(page, () => !document.getElementById('pause').hidden, 'the ❚❚ button pauses');
    const shots = await Q(page, () => __kk.G.shots);
    await click(page, '#pause-menu [data-act="quit"]');
    await until(page, () => __kk.mode === 'title' && !document.getElementById('btn-continue').hidden, 'Save & Quit returns to the title with Continue');
    await click(page, '#title-menu [data-act="continue"]');
    await until(page, (s) => __kk.mode === 'play' && __kk.G.shots === s && __kk.G.level === 0, 'Continue restores the castle', 30000, shots);

    // the bot clears it
    await Q(page, () => __kk.ff(60));
    await until(page, () => __kk.mode === 'over' && !document.getElementById('over').hidden, 'clearing the castle shows the results', 30000);
    await until(page, () => document.querySelectorAll('#res-stars span.on').length >= 1, 'and the stars light up');
    check(await Q(page, () => __kk.progress().stars.watchtower >= 1), 'the stars are saved');
    check(await Q(page, () => !__kk.hasSave()), 'a finished castle leaves no Continue');
    await shot(page, 'desktop-results');
    await click(page, '#res-next');
    await until(page, () => !document.getElementById('intro').hidden && document.getElementById('intro-name').textContent.includes('Gatehouse'), 'Next Castle opens castle 2\'s intro');
    await click(page, '#intro .sheet-foot [data-close]');
    await click(page, '#title-menu [data-act="play"]');
    await until(page, () => !document.getElementById('map').hidden && !document.querySelectorAll('.lvl')[1].disabled, 'castle 2 is now open on the map');

    // a castle with two kinds of ball: the number keys pick them
    await Q(page, () => __kk.start(1));
    await until(page, () => __kk.mode === 'play' && __kk.G.level === 1, 'castle 2 starts');
    await page.keyboard.press('Digit2');
    await until(page, () => __kk.G.sel === 'boom' && document.querySelector('.rack-btn.sel')?.dataset.ammo === 'boom', 'key 2 loads the Boom Ball and the rack shows it');
    await page.keyboard.press('KeyQ');
    await until(page, () => __kk.G.sel === 'iron', 'Q cycles back to the Iron Ball');
    await shot(page, 'desktop-play');
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
    await tapSel('#title-menu [data-act="play"]');
    await until(page, () => !document.getElementById('map').hidden, 'a tap on Play opens the map');
    await tapSel('.lvl[data-level="0"]');
    await until(page, () => !document.getElementById('intro').hidden, 'a tap on a castle opens its intro');
    check((await onScreen44(page, ['#intro-go']))[0].ok, 'the intro\'s button is on screen without scrolling');
    await shot(page, `phone-${w}x${h}-intro`);
    await tapSel('#intro-go');
    await until(page, () => __kk.mode === 'play' && !document.getElementById('hud').hidden, 'a tap on "Fire away!" starts the castle');

    const L = await layout(page);
    check(L.noHScroll, 'no sideways scroll');
    check(L.canvas, 'the canvas matches the visible viewport');
    for (const z of await onScreen44(page, ['#btn-fire', '#btn-pause', '.rack-btn[data-ammo="iron"]'])) check(z.ok, `${z.s} is at least 44 px and on screen`);

    // a drag on the view aims (real touches)
    const a0 = await Q(page, () => ({ ...__kk.G.aim }));
    const cx = w * 0.5, cy = h * 0.45;
    await touch('touchStart', cx, cy);
    for (let i = 1; i <= 8; i++) await touch('touchMove', cx + i * 10, cy + i * 3);
    await touch('touchEnd', 0, 0);
    await until(page, (a) => __kk.G.aim.yaw < a.yaw - 0.1, 'dragging right aims right', 30000, a0);
    check(await Q(page, () => __kk.G.shots === 0), 'and does not fire');
    await Q(page, () => __kk.aim(0.45, 0.17));
    await page.touchscreen.tap(cx, cy);
    await until(page, () => __kk.G.shots === 1, 'a tap on the view fires');
    await until(page, () => __kk.G.reload === 0 && __kk.G.state === 'aim', 'the cannon reloads');
    await shot(page, `phone-${w}x${h}`);
    await Q(page, () => __kk.aim(-0.45, 0.17));
    await tapSel('#btn-fire');
    await until(page, () => __kk.G.shots === 2, 'tapping FIRE fires');

    await tapSel('#btn-pause');
    await until(page, () => !document.getElementById('pause').hidden, 'tapping ❚❚ pauses');
    await page.waitForTimeout(300);
    check(await visible(page, 'pause'), 'the pause screen stays open after the finger lifts');
    await tapSel('#pause-menu [data-act="resume"]');
    await until(page, () => document.getElementById('pause').hidden, 'a tap on Resume closes it');
    reportErrors(`phone ${w}×${h}`);
}

// ======================================================================
async function nostorage() {
    console.log('\n== blocked storage');
    const page = await open({ width: 1280, height: 760 }, { nostorage: true });
    await Q(page, () => __kk.start(0));
    await until(page, () => __kk.mode === 'play', 'boots and starts a castle with localStorage throwing');
    await Q(page, () => __kk.ff(2));
    check(await Q(page, () => __kk.save() === false), 'saving fails quietly');
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

/**
 * browsertest.mjs — the real game in real Chromium (SwiftShader WebGL).
 *
 * desktop (1280×760): boot to the title with no errors, the ← Games link on top → New Game by click →
 *   the city card, Space on the focused Roll! button → real key presses steer and pounce → Escape pauses and
 *   the sim stops → Resume → Save & Quit → Continue restores the game → a flattened city shows the star sheet,
 *   a gift is chosen, the next city loads → losing the last life shows Play Again. No sideways scroll.
 * phones (touch only, real CDP touches) at 390×844 and 844×390: taps through the menus, the touch deck appears,
 *   the stick steers, POUNCE pounces, controls ≥ 44 px and on screen, HUD and sheets fit, no sideways scroll,
 *   the canvas matches the visible viewport.
 * nostorage: localStorage throws; the game still boots and plays.
 * Fails on any console error, page error or failed request.
 *
 *   python3 -m http.server 8107          # from the REPO ROOT
 *   node game-107/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8107), ONLY=desktop,phones,nostorage, THREE_PKG.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8107';
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
    await page.goto(`${BASE}/game-107/index.html?debug=1&fast=4`);
    await page.waitForFunction(() => window.__kr && __kr.mode === 'title', null, { timeout: 60000 });
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
// a sheet pops in with an animation; SwiftShader may not have drawn a frame of it, so finish them before tapping
const settle = (page) => Q(page, () => document.getAnimations().forEach((a) => { try { a.finish(); } catch { /* */ } }));
const shown = (page, id) => Q(page, (i) => { const e = document.getElementById(i); return !!e && !e.hidden; }, id);
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
/** Is every part of this element inside the viewport? (a sheet may scroll, so only its top matters) */
const onScreen = (page, sel) => Q(page, (s) => { const r = document.querySelector(s).getBoundingClientRect(); return r.left >= -1 && r.right <= innerWidth + 1 && r.top >= -1 && r.bottom <= innerHeight + 1; }, sel);

// ======================================================================
async function desktop() {
    console.log('\n== desktop 1280×760');
    const page = await open({ width: 1280, height: 760 });
    check(await backLinkOk(page), '← Games link is on top and points at ../index.html');
    check(await shown(page, 'title'), 'title screen is up');
    check(await Q(page, () => document.getElementById('btn-continue').hidden), 'no Continue without a save');
    const L = await layout(page);
    check(L.noHScroll && L.canvas, 'no sideways scroll; the canvas fills the window');
    // the title has a bot rolling behind it
    const t0 = await Q(page, () => __kr.G.t);
    await until(page, (t) => __kr.G.t > t + 0.2, 'a bot plays behind the title (attract mode)', 30000, t0);
    await shot(page, 'desktop-title');

    await click(page, '#title-menu [data-act="new"]');
    await until(page, () => !document.getElementById('choose').hidden && document.querySelectorAll('#chars .char').length === 3, 'New Game offers three monsters to choose from');
    check(await Q(page, () => [...document.querySelectorAll('#chars .char img')].every((i) => i.src.startsWith('data:image/png'))), 'each with a picture drawn from its own model');
    await settle(page);
    await shot(page, 'desktop-choose');
    await click(page, '#chars .char[data-id="monkey"]');
    await until(page, () => __kr.mode === 'play' && !document.getElementById('intro').hidden, 'choosing the monkey opens the city card');
    check(await Q(page, () => __kr.G.char === 'monkey' && __kr.G.ball.maxHp === 80), 'the monkey is a little more fragile');
    check(await Q(page, () => document.getElementById('intro-name').textContent === 'Pastel Bay'), 'the first city is Pastel Bay');
    const t1 = await Q(page, () => __kr.G.t);
    await page.waitForTimeout(400);
    check(await Q(page, (t) => __kr.G.t === t, t1), 'the sim waits behind the city card');
    await settle(page);
    await shot(page, 'desktop-intro');
    await page.keyboard.press('Space');                       // the focused Roll! button
    await until(page, () => document.getElementById('intro').hidden, 'Space presses the focused Roll! button');

    // keys steer
    const x0 = await Q(page, () => __kr.G.ball.x);
    await page.keyboard.down('ArrowRight');
    await until(page, (x) => __kr.G.ball.x > x + 3 && __kr.G.ball.vx > 2, 'holding → steers the monster right', 30000, x0);
    await page.keyboard.up('ArrowRight');
    await page.keyboard.press('Space');
    await until(page, () => (__kr.seen.pounce || 0) >= 1, 'Space pounces (the press reaches a sim step)');
    await until(page, () => (__kr.seen.slam || 0) >= 1, 'and the pounce lands with a slam');
    await until(page, () => __kr.audio.ready && __kr.audio.music.playing && __kr.audio.music.step > 8, 'the music sequencer is running');

    await Q(page, () => { __kr.ff(25); });
    await shot(page, 'desktop-play');
    await until(page, () => __kr.G.score > 0 && document.getElementById('hud-score').textContent !== '0', 'the HUD shows the score');
    check(await Q(page, () => parseFloat(document.getElementById('bar-city').style.width) > 0), 'and the city bar fills');

    await page.keyboard.press('Escape');
    await until(page, () => !document.getElementById('pause').hidden, 'Escape pauses');
    const t2 = await Q(page, () => __kr.G.t);
    await page.waitForTimeout(500);
    check(await Q(page, (t) => __kr.G.t === t, t2), 'the sim stops while paused');
    await click(page, '#pause-menu [data-act="resume"]');
    await until(page, () => document.getElementById('pause').hidden, 'Resume closes the pause screen');
    await Q(page, () => document.querySelector('#btn-pause').click());
    await until(page, () => !document.getElementById('pause').hidden, 'the ❚❚ button pauses');
    await click(page, '#pause-menu [data-act="settings"]');
    await until(page, () => !document.getElementById('settings').hidden && Number(document.getElementById('settings').style.zIndex) > Number(document.getElementById('pause').style.zIndex), 'Settings opens on top of the pause menu');
    check(await Q(page, () => __kr.view.cel.on === true), 'the cartoon outline pass is on by default');
    await Q(page, () => { const e = document.getElementById('set-outline'); e.value = '0'; e.dispatchEvent(new Event('change')); });
    check(await Q(page, () => __kr.view.cel.on === false), 'the Settings switch turns it off (a single plain pass)');
    await page.waitForTimeout(400);
    await Q(page, () => { const e = document.getElementById('set-outline'); e.value = '1'; e.dispatchEvent(new Event('change')); });
    check(await Q(page, () => __kr.view.cel.on === true), 'and on again');
    await click(page, '#settings [data-close]');
    const score = await Q(page, () => __kr.G.score);
    await click(page, '#pause-menu [data-act="quit"]');
    await until(page, () => __kr.mode === 'title' && !document.getElementById('btn-continue').hidden, 'Save & Quit returns to the title with Continue');
    await click(page, '#title-menu [data-act="continue"]');
    await until(page, (s) => __kr.mode === 'play' && __kr.G.score === s && document.getElementById('intro').hidden, 'Continue restores the saved game', 30000, score);

    // flatten the city
    await Q(page, () => __kr.ff(900));
    await until(page, () => __kr.G.phase === 'clear' && !document.getElementById('clear').hidden, 'a flattened city shows the star sheet');
    await settle(page);
    check(await Q(page, () => document.querySelectorAll('#clear-stars span.on').length >= 1 && document.querySelectorAll('#perks .perk').length === 3), 'with stars and three gifts to choose from');
    check(await Q(page, () => document.getElementById('clear-next').disabled), 'Next city waits for a gift');
    await shot(page, 'desktop-clear');
    await click(page, '#perks .perk');
    await until(page, () => !document.getElementById('clear-next').disabled && Object.values(__kr.G.perks).reduce((a, b) => a + b, 0) === 1, 'choosing a gift is recorded and unlocks Next city');
    await click(page, '#clear-next');
    await until(page, () => __kr.G.level === 1 && !document.getElementById('intro').hidden && document.getElementById('intro-name').textContent === 'Harbor Town', 'Next city loads Harbor Town');
    await click(page, '#intro-go');
    await Q(page, () => __kr.ff(10));
    await shot(page, 'desktop-city2');

    // lose the last life
    await Q(page, async () => {
        const Gm = await import('/game-107/js/sim/game.js');
        __kr.G.lives = 1; __kr.G.ball.hp = 1; __kr.G.ball.inv = 0; __kr.G.power.shield = 0;
        Gm.hurtBall(__kr.G, 90, 0, 0);
    });
    await until(page, () => __kr.mode === 'over' && !document.getElementById('over').hidden, 'losing the last life shows the game over sheet');
    check(await Q(page, () => /Harbor Town/.test(document.getElementById('over-text').textContent)), 'which names the city you reached');
    await shot(page, 'desktop-over');
    await click(page, '#over-again');
    await until(page, () => __kr.mode === 'play' && __kr.G.level === 0 && __kr.G.score === 0 && __kr.G.char === 'monkey', 'Play Again starts a fresh game with the same monster');
    reportErrors('desktop');
}

// ======================================================================
async function phone(w, h) {
    console.log(`\n== phone ${w}×${h} (touch only)`);
    const page = await open({ width: w, height: h }, { touch: true });
    const cdp = await page.context().newCDPSession(page);
    const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
    const tapSel = async (sel) => {
        await settle(page);
        const r = await Q(page, (s) => { const e = document.querySelector(s); e?.scrollIntoView({ block: 'center' }); const b = e?.getBoundingClientRect(); return b && { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, sel);
        if (!r) return false;
        await page.touchscreen.tap(r.x, r.y);
        return true;
    };

    check(await backLinkOk(page), '← Games link is on top');
    check(await onScreen(page, '#title .sheet') || (await Q(page, () => document.querySelector('#title .sheet').scrollHeight > 0)), 'the title sheet is on screen');
    await tapSel('#title-menu [data-act="new"]');
    await until(page, () => !document.getElementById('choose').hidden, 'a tap on New Game offers the monsters');
    await shot(page, `phone-choose-${w}x${h}`);
    await tapSel('#chars .char[data-id="robot"]');
    await until(page, () => __kr.mode === 'play' && !document.getElementById('intro').hidden && __kr.G.char === 'robot', 'a tap on the robot opens the city card');
    await until(page, () => !document.getElementById('touch').hidden, 'the touch deck is already on before the first city');
    await tapSel('#intro-go');
    await until(page, () => document.getElementById('intro').hidden, 'a tap on Roll! starts the city');

    const L = await layout(page);
    check(L.noHScroll, 'no sideways scroll');
    check(L.canvas, 'the canvas matches the visible viewport');
    const sizes = await Q(page, () => ['#btn-a', '#btn-pause'].map((s) => {
        const r = document.querySelector(s).getBoundingClientRect();
        return { s, ok: r.width >= 44 && r.height >= 44 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight };
    }));
    for (const z of sizes) check(z.ok, `${z.s} is at least 44 px and on screen`);
    check(await Q(page, () => { const r = document.getElementById('hud').getBoundingClientRect(); return r.right <= innerWidth + 1 && r.left >= 0; }), 'the HUD fits the width');

    // drag the stick right with a real touch
    const zone = await Q(page, () => { const r = document.getElementById('stick-zone').getBoundingClientRect(); return { x: r.left + r.width * 0.4, y: r.top + r.height * 0.5 }; });
    const x0 = await Q(page, () => __kr.G.ball.x);
    await touch('touchStart', zone.x, zone.y);
    for (let i = 1; i <= 6; i++) await touch('touchMove', zone.x + i * 12, zone.y);
    await until(page, (x) => __kr.G.ball.x > x + 2, 'dragging the stick steers the monster', 30000, x0);
    await touch('touchEnd', 0, 0);

    const n0 = await Q(page, () => __kr.seen.pounce || 0);
    await tapSel('#btn-a');
    await until(page, (n) => (__kr.seen.pounce || 0) > n, 'tapping POUNCE pounces', 30000, n0);
    await Q(page, () => __kr.ff(8));
    await shot(page, `phone-${w}x${h}`);

    await tapSel('#btn-pause');
    await until(page, () => !document.getElementById('pause').hidden, 'tapping ❚❚ pauses');
    await page.waitForTimeout(300);
    check(await shown(page, 'pause'), 'the pause screen stays open after the finger lifts');
    await tapSel('#pause-menu [data-act="resume"]');
    await until(page, () => document.getElementById('pause').hidden, 'a tap on Resume closes it');

    // the star sheet on a small screen: a gift and the way on are both reachable
    await Q(page, () => __kr.ff(900));
    await until(page, () => !document.getElementById('clear').hidden, 'a flattened city shows the star sheet');
    await settle(page);
    await shot(page, `phone-clear-${w}x${h}`);
    await tapSel('#perks .perk:nth-child(2)');
    await until(page, () => !document.getElementById('clear-next').disabled, 'a tap on a gift unlocks Next city');
    await tapSel('#clear-next');
    await until(page, () => __kr.G.level === 1 && !document.getElementById('intro').hidden, 'a tap on Next city shows the next city card');
    await tapSel('#intro-go');
    await until(page, () => document.getElementById('intro').hidden && __kr.G.phase === 'play', 'and Roll! starts it');
    reportErrors(`phone ${w}×${h}`);
}

// ======================================================================
async function nostorage() {
    console.log('\n== blocked storage');
    const page = await open({ width: 1280, height: 760 }, { nostorage: true });
    await click(page, '#title-menu [data-act="new"]');
    await click(page, '#chars .char');
    await until(page, () => __kr.mode === 'play', 'boots and starts a game with localStorage throwing');
    await click(page, '#intro-go');
    await Q(page, () => __kr.ff(3));
    check(await Q(page, () => __kr.save() === false), 'saving fails quietly');
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

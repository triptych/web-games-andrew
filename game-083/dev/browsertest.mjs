/**
 * browsertest.mjs — the real game in real Chromium (SwiftShader WebGL).
 *
 * desktop (1280×760): boot to the title with no errors, the ← Games link on top, the attract
 *   demo running → New Game by click → real keys walk and turn the dragon → Space breathes fire →
 *   a click captures the mouse and its motion turns the dragon; letting it go pauses
 *   → Escape pauses and the sim stops → Space on the focused Resume button resumes (game-078) →
 *   Save & Quit → Continue restores the game → the boss falls and the ascent leads into flight →
 *   the mouse moves the targeting cross and a held click streams fire → the dragon falls, the
 *   game-over sheet's Continue restarts the stage → the ward stone breaks and the homecoming
 *   sheet offers a second cycle. No sideways scroll; the canvas fills the window.
 * phones (touch only, real CDP touches) at 390×844 and 844×390: taps through the menus, the
 *   touch deck appears, the stick walks the dragon, FIRE breathes fire; in flight the stick
 *   aims; controls ≥ 44 px and on screen, no sideways scroll, the canvas matches the visible
 *   viewport, the ❚❚ menu stays open after the finger lifts.
 * nostorage: localStorage throws; the game still boots and plays.
 * Fails on any console error, page error or failed request.
 *
 *   python3 -m http.server 8083          # from the REPO ROOT
 *   node game-083/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8083), ONLY=desktop,phones,nostorage, THREE_PKG.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8083';
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
    await page.goto(`${BASE}/game-083/index.html?debug=1&fast=4`);
    await page.waitForFunction(() => window.__wz && __wz.mode === 'title', null, { timeout: 60000 });
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

// ======================================================================
async function desktop() {
    console.log('\n== desktop 1280×760');
    const page = await open({ width: 1280, height: 760 });
    check(await backLinkOk(page), '← Games link is on top and points at ../index.html');
    check(await Q(page, () => !document.getElementById('title').hidden), 'title screen is up');
    // a repeated id sends getElementById to the wrong element: the game-over Title button shared
    // its id with the sheet's heading, so its handler went on the heading and the button did nothing
    const dup = await Q(page, () => { const ids = [...document.querySelectorAll('[id]')].map((e) => e.id); return ids.filter((id, i) => ids.indexOf(id) !== i); });
    check(dup.length === 0, `every id in the page is unique${dup.length ? ` (repeated: ${dup.join(', ')})` : ''}`);
    check(await Q(page, () => document.getElementById('btn-continue').hidden), 'no Continue without a save');
    await until(page, () => __wz.G.t > 3, 'the attract demo plays behind the title');
    const L = await layout(page);
    check(L.noHScroll && L.canvas, 'no sideways scroll; the canvas fills the window');
    await shot(page, 'desktop-title');

    await click(page, '#title-menu [data-act="new"]');
    await until(page, () => __wz.mode === 'play' && document.getElementById('title').hidden && __wz.G.stageIdx === 0, 'New Game starts the first march');
    await until(page, () => __wz.G.phase === 'play', 'the march begins after its banner');
    // stand somewhere open, so a stone can't block the walk
    await Q(page, () => { const p = __wz.G.player; p.x = 0; p.z = 0; p.h = 0; __wz.G.enemies.length = 0; __wz.G.spawnT = 99; });

    await page.keyboard.down('ArrowUp');
    await until(page, () => __wz.G.player.z < -2, 'holding ↑ walks the dragon forward');
    await page.keyboard.up('ArrowUp');
    await page.keyboard.down('ArrowRight');
    await until(page, () => __wz.G.player.h > 0.3, 'holding → turns it right');
    await page.keyboard.up('ArrowRight');
    await page.keyboard.press('Space');
    await until(page, () => (__wz.seen.fire || 0) >= 1, 'Space breathes fire (the press reaches a sim step)');

    // mouse look: a click on the view captures the mouse, and its sideways motion turns the dragon.
    // Headless Chromium freezes the pointer under the lock, so the motion is dispatched as the
    // browser would deliver it (movementX); the nostorage run drives real moves with the lock refused.
    check(await Q(page, () => !document.getElementById('look-hint').hidden), 'the hint offers mouse look');
    await page.mouse.click(640, 420);
    await until(page, () => document.pointerLockElement?.id === 'view' && __wz.input.look.locked, 'a click on the view captures the mouse');
    await until(page, () => document.getElementById('look-hint').hidden, 'and the hint goes away');
    const hLook = await Q(page, () => __wz.G.player.h);
    await Q(page, () => document.getElementById('view').dispatchEvent(new PointerEvent('pointermove', { pointerType: 'mouse', clientX: 640, clientY: 420, movementX: 150, movementY: 0, bubbles: true })));
    await until(page, (h) => { let d = (__wz.G.player.h - h) % (2 * Math.PI); if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; return Math.abs(d - 150 * 0.0035) < 0.05; }, 'moving the captured mouse right turns the dragon right', 30000, hLook);
    await Q(page, () => document.exitPointerLock());
    await until(page, () => !document.getElementById('pause').hidden, 'letting the mouse go pauses the game');
    await page.waitForTimeout(500);
    check(await Q(page, () => !document.getElementById('pause').hidden), 'and the pause sheet stays open');
    await click(page, '#pause-menu [data-act="resume"]');
    await until(page, () => document.getElementById('pause').hidden && __wz.mode === 'play', 'Resume returns to play');

    await page.keyboard.press('Escape');
    await until(page, () => !document.getElementById('pause').hidden, 'Escape pauses');
    const t0 = await Q(page, () => __wz.G.t);
    await page.waitForTimeout(500);
    check(await Q(page, (t) => __wz.G.t === t, t0), 'the sim stops while paused');
    await Q(page, () => document.querySelector('#pause-menu [data-act="resume"]').focus());
    await page.keyboard.press('Space');
    await until(page, () => document.getElementById('pause').hidden, 'Space on the focused Resume button resumes');

    await shot(page, 'desktop-march');
    const score = await Q(page, () => { __wz.G.spawnT = 0; __wz.ff(8); return __wz.G.score; });
    await Q(page, () => document.querySelector('#btn-pause').click());
    await until(page, () => !document.getElementById('pause').hidden, 'the ❚❚ button pauses');
    await click(page, '#pause-menu [data-act="quit"]');
    await until(page, () => __wz.mode === 'title' && !document.getElementById('btn-continue').hidden, 'Save & Quit returns to the title with Continue');
    await click(page, '#title-menu [data-act="continue"]');
    await until(page, (s) => __wz.mode === 'play' && __wz.G.score === s, 'Continue restores the saved game', 30000, score);

    // the boss, and the wings coming back
    await Q(page, () => { __wz.start(11, 'boss'); });
    await until(page, () => __wz.G.phase === 'play', 'the Dragonbane stage begins');
    await shot(page, 'desktop-boss');
    // run the bot only until the engine breaks, then watch the ascent in real time
    await Q(page, () => { const b = __wz.G.enemies.find((e) => e.kind === 'dragonbane'); b.hp = 1; for (let i = 0; i < 120 && __wz.G.phase === 'play'; i++) __wz.ff(0.25); });
    await until(page, () => __wz.G.phase === 'ascend', 'breaking the Dragonbane starts the ascent', 60000);
    await until(page, () => __wz.G.phase === 'ascend' && __wz.G.phaseT < 3.5, 'the camera rises', 60000);
    await shot(page, 'desktop-ascend');
    await until(page, () => __wz.G.mode === 'flight', 'Act II: the dragon flies', 60000);
    await until(page, () => __wz.G.phase === 'play', 'the open sky begins', 30000);
    // a long grace, so the firebolts of a minute of slow test frames can't end the game mid-check
    await Q(page, () => { __wz.G.player.inv = 999; });

    // the mouse aims, a held click streams fire
    const box = await Q(page, () => { const r = document.getElementById('view').getBoundingClientRect(); return { x: r.width * 0.85, y: r.height * 0.3 }; });
    await page.mouse.move(box.x, box.y);
    await until(page, () => __wz.G.player.ax > 0.4 && __wz.G.player.ay > 0.2, 'the mouse moves the targeting cross');
    const f0 = await Q(page, () => __wz.seen.fire || 0);
    await page.mouse.down();
    await until(page, (n) => (__wz.seen.fire || 0) >= n + 3, 'a held click streams fire', 30000, f0);
    await page.mouse.up();
    await page.keyboard.down('ArrowLeft');
    await until(page, () => __wz.G.player.ax < 0, 'keys push the cross the other way');
    await page.keyboard.up('ArrowLeft');
    // captured, the mouse's motion steers the cross from where it is
    await page.mouse.click(640, 380);
    await until(page, () => __wz.input.look.locked, 'a click captures the mouse in flight too');
    const a0 = await Q(page, () => [__wz.G.player.ax, __wz.G.player.ay]);
    await Q(page, () => { const v = document.getElementById('view'); for (let i = 0; i < 4; i++) v.dispatchEvent(new PointerEvent('pointermove', { pointerType: 'mouse', clientX: 640, clientY: 380, movementX: 60, movementY: -40, bubbles: true })); });
    // 4 × 60 px right and 4 × 40 px up is +0.96 and +0.64 of the cross's range, clamped at ±1
    await until(page, ([x, y]) => __wz.G.player.ax > Math.min(x + 0.8, 0.95) && __wz.G.player.ay > Math.min(y + 0.5, 0.95), 'moving the captured mouse right and up steers the cross there', 30000, a0);
    await Q(page, () => document.exitPointerLock());
    await until(page, () => !document.getElementById('pause').hidden, 'letting it go pauses');
    await click(page, '#pause-menu [data-act="resume"]');
    await until(page, () => document.getElementById('pause').hidden, 'and Resume carries on');
    await Q(page, () => { __wz.G.player.inv = 999; });
    await Q(page, () => { __wz.ff(6); __wz.G.player.inv = 0; });
    await shot(page, 'desktop-sky');

    // falling, and continuing
    await Q(page, () => { __wz.G.scales = 1; __wz.idle(40); });
    await until(page, () => __wz.mode === 'over' && !document.getElementById('over').hidden && !document.getElementById('over-continue').hidden, 'the dragon falls: the game-over sheet offers Continue');
    await shot(page, 'desktop-over');
    await click(page, '#over-continue');
    await until(page, () => __wz.mode === 'play' && __wz.G.scales === 6 && __wz.G.continues === 1, 'Continue retries the stage with full scales');
    // fall again, and leave by the Title button, clicked with the real mouse where it is drawn
    await Q(page, () => { __wz.G.scales = 1; __wz.idle(40); });
    await until(page, () => __wz.mode === 'over' && !document.getElementById('over').hidden, 'the dragon falls again');
    const tb = await Q(page, () => { const r = document.getElementById('over-to-title').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await page.mouse.click(tb.x, tb.y);
    await until(page, () => __wz.mode === 'title' && !document.getElementById('title').hidden && document.getElementById('over').hidden, 'a mouse click on the game-over sheet\'s Title button returns to the title');

    // the gorge, the ward stone, home
    await Q(page, () => { __wz.start(5, 'gorge'); });
    await until(page, () => __wz.G.phase === 'play', 'the gorge begins');
    await Q(page, () => __wz.ff(9));
    await shot(page, 'desktop-gorge');
    await Q(page, () => { __wz.G.fl.dist = __wz.G.fl.len - 300; __wz.ff(30); });
    await until(page, () => __wz.mode === 'over' && !document.getElementById('over-cycle').hidden, 'the ward stone breaks and the dragon flies home', 60000);
    check(await Q(page, () => (__wz.seen.victory || 0) === 1 && (__wz.seen.gate || 0) === 1), 'the gate and the victory were both seen');
    await shot(page, 'desktop-home');
    await click(page, '#over-cycle');
    await until(page, () => __wz.mode === 'play' && __wz.G.loop === 1 && __wz.G.mode === 'ground', 'a second, fiercer cycle starts on foot');
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
    await until(page, () => __wz.mode === 'play', 'a tap on New Game starts play');
    await until(page, () => !document.getElementById('touch').hidden, 'the touch deck is shown');
    await until(page, () => __wz.G.phase === 'play', 'the march begins');
    await Q(page, () => { const p = __wz.G.player; p.x = 0; p.z = 0; p.h = 0; __wz.G.enemies.length = 0; __wz.G.spawnT = 99; });

    const L = await layout(page);
    check(L.noHScroll, 'no sideways scroll');
    check(L.canvas, 'the canvas matches the visible viewport');

    const sizes = await Q(page, () => ['#btn-fire', '#btn-pause'].map((s) => {
        const r = document.querySelector(s).getBoundingClientRect();
        return { s, ok: r.width >= 44 && r.height >= 44 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight };
    }));
    for (const z of sizes) check(z.ok, `${z.s} is at least 44 px and on screen`);
    check(await Q(page, () => document.getElementById('look-hint').hidden), 'no mouse-look hint on a touch screen');

    // push the stick up with a real touch: the dragon walks
    const zone = await Q(page, () => { const r = document.getElementById('stick-zone').getBoundingClientRect(); return { x: r.left + r.width * 0.4, y: r.top + r.height * 0.6 }; });
    await touch('touchStart', zone.x, zone.y);
    for (let i = 1; i <= 6; i++) await touch('touchMove', zone.x, zone.y - i * 12);
    await until(page, () => __wz.G.player.z < -1.5, 'pushing the stick up walks the dragon');
    await touch('touchEnd', 0, 0);

    const fires = await Q(page, () => __wz.seen.fire || 0);
    await tapSel('#btn-fire');
    await until(page, (n) => (__wz.seen.fire || 0) > n, 'tapping FIRE breathes fire', 30000, fires);
    await shot(page, `phone-${w}x${h}`);

    // in flight the stick aims
    await Q(page, () => __wz.start(4, 'sky'));
    await until(page, () => __wz.G.mode === 'flight' && document.getElementById('touch').dataset.mode === 'flight', 'in flight the deck aims');
    await touch('touchStart', zone.x, zone.y);
    for (let i = 1; i <= 6; i++) await touch('touchMove', zone.x + i * 14, zone.y);
    await until(page, () => __wz.G.player.ax > 0.4, 'dragging the stick right moves the cross right');
    await touch('touchEnd', 0, 0);
    await until(page, () => Math.abs(__wz.G.player.ax) < 0.2, 'letting go springs the cross back');
    await Q(page, () => __wz.ff(5));
    await shot(page, `phone-${w}x${h}-sky`);

    await tapSel('#btn-pause');
    await until(page, () => !document.getElementById('pause').hidden, 'tapping ❚❚ pauses');
    await page.waitForTimeout(300);
    check(await Q(page, () => !document.getElementById('pause').hidden), 'the pause screen stays open after the finger lifts');
    await tapSel('#pause-menu [data-act="resume"]');
    await until(page, () => document.getElementById('pause').hidden, 'a tap on Resume closes it');
    reportErrors(`phone ${w}×${h}`);
}

// ======================================================================
async function nostorage() {
    console.log('\n== blocked storage');
    const page = await open({ width: 1280, height: 760 }, { nostorage: true });
    await click(page, '#title-menu [data-act="new"]');
    await until(page, () => __wz.mode === 'play', 'boots and starts a game with localStorage throwing');
    await Q(page, () => __wz.ff(6));
    check(await Q(page, () => __wz.save() === false), 'saving fails quietly');
    // a browser that refuses the pointer lock (a sandboxed frame): real mouse moves turn the dragon
    await Q(page, () => { HTMLCanvasElement.prototype.requestPointerLock = function () { throw new Error('refused'); }; __wz.G.player.inv = 999; __wz.G.enemies.length = 0; __wz.G.spawnT = 99; });
    await page.mouse.move(600, 420);
    await page.mouse.click(600, 420);
    await until(page, () => __wz.input.look.free && !__wz.input.look.locked, 'with the lock refused, mouse look runs free');
    const hFree = await Q(page, () => __wz.G.player.h);
    await page.mouse.move(800, 420, { steps: 8 });
    // headings wrap at ±π: compare the wrapped turn, not the raw angles
    await until(page, (h) => { let d = (__wz.G.player.h - h) % (2 * Math.PI); if (d > Math.PI) d -= 2 * Math.PI; if (d < -Math.PI) d += 2 * Math.PI; return d > 0.4; }, 'and real mouse moves turn the dragon', 30000, hFree);
    await Q(page, () => { __wz.G.player.inv = 0; __wz.G.spawnT = 0; });
    await Q(page, () => { __wz.G.scales = 1; __wz.idle(40); });
    await until(page, () => __wz.mode === 'over', 'a game can still end (the best score just isn\'t kept)');
    // the keyboard way out: Down from Continue to Title, then Enter
    await page.keyboard.press('ArrowDown');
    await until(page, () => document.activeElement?.id === 'over-to-title', 'Down moves the focus to the Title button');
    await page.keyboard.press('Enter');
    await until(page, () => __wz.mode === 'title' && !document.getElementById('title').hidden, 'Enter on Title returns to the title');
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

/**
 * browsertest.mjs — the real game in real Chromium (SwiftShader WebGL).
 *
 * desktop (1280×760): boot to the title with no errors and the bot's demo running behind it, the
 *   ← Games link on top → New Game → real key presses: walk, a tapped jump (latched), blow a
 *   bubble → Escape pauses and the sim stops → Space on the focused Resume button resumes →
 *   the ❚❚ button → Save & Quit → Continue restores the run → the bot clears the sector and the
 *   next one scrolls in → GAME OVER → Continue restarts the sector at zero → the Baron is beaten
 *   → the ending → a name goes on the high-score table. No sideways scroll; the canvas fills the window.
 * phones (touch only, real CDP touches) at 390×844 and 844×390: taps through the menus, the
 *   touch deck appears, ▶ walks, JUMP jumps, ◯ blows, controls ≥ 44 px and on screen, the
 *   playfield is not under the deck, no sideways scroll, the canvas matches the visible viewport,
 *   the pause screen stays open after the finger lifts.
 * nostorage: localStorage throws; the game still boots and plays.
 * Fails on any console error, page error or failed request.
 *
 *   python3 -m http.server 8082          # from the REPO ROOT
 *   node game-082/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8082), ONLY=desktop,phones,nostorage, THREE_PKG.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8082';
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
    await page.goto(`${BASE}/game-082/index.html?debug=1&fast=4`);
    await page.waitForFunction(() => window.__bn && __bn.mode === 'title', null, { timeout: 60000 });
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
/** Wait until the sector is in play (the drop-in is over). */
const inPlay = (page, msg = 'the sector starts') => until(page, () => __bn.mode === 'play' && __bn.G.phase === 'play', msg, 60000);
const reportErrors = (label) => { check(errors.length === 0, `${label}: no console errors, page errors or failed requests`); for (const e of errors.slice(0, 8)) console.log('    ', e); };

// ======================================================================
async function desktop() {
    console.log('\n== desktop 1280×760');
    const page = await open({ width: 1280, height: 760 });
    check(await backLinkOk(page), '← Games link is on top and points at ../index.html');
    check(await Q(page, () => !document.getElementById('title').hidden), 'title screen is up');
    check(await Q(page, () => document.getElementById('btn-continue').hidden), 'no Continue without a save');
    check(await Q(page, () => performance.getEntriesByType('resource').some((r) => /sim\/game\.js\?v=/.test(r.name))), 'modules load through the version-stamped import map');
    const t0 = await Q(page, () => __bn.G.t);
    await until(page, (t) => __bn.G.t > t + 1, 'the bot plays a demo behind the title', 60000, t0);
    const L = await layout(page);
    check(L.noHScroll && L.canvas, 'no sideways scroll; the canvas fills the window');
    await shot(page, 'desktop-title');

    await click(page, '#title-menu [data-act="new"]');
    await until(page, () => __bn.mode === 'play' && document.getElementById('title').hidden && __bn.G.level === 0 && __bn.G.score === 0, 'New Game starts a fresh run in sector 1');
    await inPlay(page);
    // keep the crew away from the test
    await Q(page, () => { for (const e of __bn.G.enemies) { e.st = 'trap'; e.x = 28; e.y = 3; } });

    const x0 = await Q(page, () => __bn.G.player.x);
    await page.keyboard.down('ArrowRight');
    await until(page, (x) => __bn.G.player.x > x + 1.5, 'holding → walks right', 30000, x0);
    await page.keyboard.up('ArrowRight');
    const j0 = await Q(page, () => __bn.seen.jump || 0);
    await page.keyboard.press('KeyZ');
    await until(page, (n) => (__bn.seen.jump || 0) > n, 'a tapped Z jumps (the tap is latched until a step sees it)', 30000, j0);
    const b0 = await Q(page, () => __bn.seen.blow || 0);
    await page.keyboard.press('KeyX');
    await until(page, (n) => (__bn.seen.blow || 0) > n && __bn.G.bubbles.length > 0, 'a tapped X blows a bubble', 30000, b0);
    await shot(page, 'desktop-play');

    await page.keyboard.press('Escape');
    await until(page, () => !document.getElementById('pause').hidden, 'Escape pauses');
    const t1 = await Q(page, () => __bn.G.t);
    await page.waitForTimeout(600);
    check(await Q(page, (t) => __bn.G.t === t, t1), 'the sim stops while paused');
    check(await Q(page, () => document.activeElement?.dataset?.act === 'resume'), 'Resume has the focus');
    await page.keyboard.press('Space');
    await until(page, () => document.getElementById('pause').hidden, 'Space presses the focused Resume button (game-078)');
    await until(page, (t) => __bn.G.t > t, 'and play goes on', 30000, t1);

    await Q(page, () => document.querySelector('#btn-pause').click());
    await until(page, () => !document.getElementById('pause').hidden, 'the ❚❚ button pauses');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await until(page, () => document.activeElement?.dataset?.act === 'quit', '↓ ↓ ↓ walks the focus to Save & Quit (one press a frame)');
    const saved = await Q(page, () => ({ level: __bn.G.level, score: __bn.G.score, t: __bn.G.t }));
    await page.keyboard.press('Enter');
    await until(page, () => __bn.mode === 'title' && !document.getElementById('btn-continue').hidden, 'Save & Quit returns to the title with Continue');
    await page.waitForTimeout(500);
    await click(page, '#title-menu [data-act="continue"]');
    await until(page, (s) => __bn.mode === 'play' && __bn.G.level === s.level && __bn.G.score === s.score && Math.abs(__bn.G.t - s.t) < 2, 'Continue restores the run', 30000, saved);

    // the bot clears the sector; the next one scrolls in
    await inPlay(page, 'the restored sector is in play');
    await Q(page, () => { __bn.G.lives = 50; });
    await Q(page, () => __bn.ff(120));
    await until(page, () => __bn.G.level >= 1 && (__bn.G.phase === 'intro' || __bn.G.phase === 'play' || __bn.G.phase === 'warp'), 'the bot clears sector 1 and the next sector arrives', 60000);
    await until(page, () => __bn.view.tiles && __bn.view.tiles.userData.idx === __bn.G.level, 'the view has built the new sector', 60000);
    await shot(page, 'desktop-sector2');

    // GAME OVER and continue
    await inPlay(page, 'sector 2 is in play');
    await Q(page, () => { const G = __bn.G; G.lives = 0; G.player.inv = 0; G.score = 1234; for (const e of G.enemies) { e.st = 'live'; e.x = G.player.x; e.y = G.player.y; } });
    await until(page, () => __bn.mode === 'over' && !document.getElementById('over').hidden, 'losing the last life is GAME OVER', 60000);
    await shot(page, 'desktop-over');
    const lvl = await Q(page, () => __bn.G.level);
    await click(page, '#over-continue');
    await until(page, (l) => __bn.mode === 'play' && __bn.G.level === l && __bn.G.score === 0 && __bn.G.continues === 1, 'Continue restarts the same sector with the score at zero', 30000, lvl);

    // the Baron, beaten by the bot, and the ending
    await Q(page, () => { __bn.goto(__bn.LAST); __bn.G.lives = 99; });
    await inPlay(page, "the Baron's core is in play");
    await shot(page, 'desktop-boss');
    await Q(page, () => { __bn.G.score = 999999; __bn.ff(400); });
    await until(page, () => __bn.G.won && __bn.mode === 'ending', 'the bot beats the Baron', 60000);
    await until(page, () => !document.getElementById('ending').hidden && !document.getElementById('ending-name').hidden, 'the ending, with a name for the high-score table', 60000);
    await shot(page, 'desktop-ending');
    await Q(page, () => { document.getElementById('name-input2').value = 'TESTER'; });
    await click(page, '#ending-done');
    await until(page, () => __bn.mode === 'title' && document.getElementById('btn-continue').hidden, 'back to the title, the finished run is not saved');
    await click(page, '#title-menu [data-act="scores"]');
    await until(page, () => document.getElementById('score-list').textContent.includes('TESTER'), 'the name is on the high-score table');
    reportErrors('desktop');
}

// ======================================================================
async function phone(w, h) {
    console.log(`\n== phone ${w}×${h} (touch only)`);
    const page = await open({ width: w, height: h }, { touch: true });
    const cdp = await page.context().newCDPSession(page);
    const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
    const center = (sel) => Q(page, (s) => { const e = document.querySelector(s); e?.scrollIntoView({ block: 'center' }); const b = e?.getBoundingClientRect(); return b && { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, sel);
    const tapSel = async (sel) => { const r = await center(sel); if (!r) return false; await page.touchscreen.tap(r.x, r.y); return true; };

    check(await backLinkOk(page), '← Games link is on top');
    await tapSel('#title-menu [data-act="new"]');
    await until(page, () => __bn.mode === 'play', 'a tap on New Game starts play');
    await until(page, () => !document.getElementById('touch').hidden, 'the touch deck is shown');
    await inPlay(page);
    await Q(page, () => { for (const e of __bn.G.enemies) { e.st = 'trap'; e.x = 28; e.y = 3; } });

    const L = await layout(page);
    check(L.noHScroll, 'no sideways scroll');
    check(L.canvas, 'the canvas matches the visible viewport');
    const sizes = await Q(page, () => ['#dpad-l', '#dpad-r', '#btn-jump', '#btn-bubble', '#btn-pause'].map((s) => {
        const r = document.querySelector(s).getBoundingClientRect();
        return { s, ok: r.width >= 44 && r.height >= 44 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight };
    }));
    for (const z of sizes) check(z.ok, `${z.s} is at least 44 px and on screen`);
    // the playfield's corners must not sit under the deck
    const clear = await Q(page, () => {
        const st = __bn.view.stage;
        const a = st.toScreen(0.3, 0.3), b = st.toScreen(31.7, 25.7);
        const field = { l: Math.min(a.x, b.x), r: Math.max(a.x, b.x), t: Math.min(a.y, b.y), b: Math.max(a.y, b.y) };
        const hit = ['#dpad', '#btn-jump', '#btn-bubble'].filter((s) => {
            const r = document.querySelector(s).getBoundingClientRect();
            return r.left < field.r - 4 && r.right > field.l + 4 && r.top < field.b - 4 && r.bottom > field.t + 4;
        });
        return { hit, field };
    });
    check(!clear.hit.length, `the playfield is not under the touch deck${clear.hit.length ? ' — ' + clear.hit.join(', ') + ' ' + JSON.stringify(clear.field) : ''}`);

    // hold ▶ with a real touch
    const r = await center('#dpad-r');
    const x0 = await Q(page, () => __bn.G.player.x);
    await touch('touchStart', [{ x: r.x, y: r.y, id: 1 }]);
    await until(page, (x) => __bn.G.player.x > x + 1, 'holding ▶ walks right', 30000, x0);
    // slide onto ◀ without lifting
    const l = await center('#dpad-l');
    const x1 = await Q(page, () => __bn.G.player.x);
    await touch('touchMove', [{ x: l.x, y: l.y, id: 1 }]);
    await until(page, (x) => __bn.G.player.x < x - 0.5, 'sliding onto ◀ walks left', 30000, x1);
    await touch('touchEnd', []);

    const j0 = await Q(page, () => __bn.seen.jump || 0);
    await tapSel('#btn-jump');
    await until(page, (n) => (__bn.seen.jump || 0) > n, 'a tap on JUMP jumps', 30000, j0);
    const b0 = await Q(page, () => __bn.seen.blow || 0);
    await tapSel('#btn-bubble');
    await until(page, (n) => (__bn.seen.blow || 0) > n, 'a tap on ◯ blows a bubble', 30000, b0);
    await shot(page, `phone-${w}x${h}`);

    await tapSel('#btn-pause');
    await until(page, () => !document.getElementById('pause').hidden, 'tapping ❚❚ pauses');
    await page.waitForTimeout(400);
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
    await until(page, () => __bn.mode === 'play', 'boots and starts a game with localStorage throwing');
    await Q(page, () => __bn.ff(3));
    check(await Q(page, () => __bn.save() === false), 'saving fails quietly');
    await click(page, '#btn-pause');
    await until(page, () => !document.getElementById('pause').hidden, 'and still pauses');
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

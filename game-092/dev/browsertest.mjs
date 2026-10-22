/**
 * browsertest.mjs — the real game in real Chromium (SwiftShader WebGL: the CRT pass runs).
 *
 * desktop (1280×760): boot to the title with no errors and a bot playing behind the menu, the
 *   ← Games link on top → Start by click → real key presses run, jump and climb a ladder → Escape
 *   pauses and the sim stops → Space on the focused Resume button resumes → a treasure is picked up
 *   → Save & Quit → Continue restores the game → the bot plays it to the end → Play Again.
 *   The picture is 16:9 inside the window; no sideways scroll.
 * phones (touch only, real CDP touches) at 390×844 and 844×390: taps through the menus, the touch
 *   deck appears, the stick runs Harry, JUMP jumps, the HUD fits and clears the back link,
 *   controls ≥ 44 px and on screen, the picture matches the visible viewport.
 * nostorage: localStorage throws; the game still boots and plays.
 * Fails on any console error, page error or failed request.
 *
 *   python3 -m http.server 8092          # from the REPO ROOT
 *   node game-092/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8092), ONLY=desktop,phones,nostorage.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8092';
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
    await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('requestfailed', (r) => { if (!r.url().includes('favicon')) errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`); });
    await page.goto(`${BASE}/game-092/index.html?debug=1&fast=4`);
    await page.waitForFunction(() => window.__nf && __nf.mode === 'title', null, { timeout: 60000 });
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
/** The picture is 16:9, inside the visible viewport, and nothing scrolls sideways. */
const layout = (page) => Q(page, () => {
    const vv = window.visualViewport;
    const c = document.getElementById('view').getBoundingClientRect();
    const vw = vv?.width ?? innerWidth, vh = vv?.height ?? innerHeight;
    return {
        noHScroll: document.documentElement.scrollWidth <= innerWidth + 1,
        inside: c.left >= -1 && c.top >= -1 && c.right <= vw + 1 && c.bottom <= vh + 1,
        ratio: Math.abs(c.width / c.height - 320 / 180) < 0.02,
        fills: c.width >= vw - 2 || c.height >= vh - 90 || c.width > 300,
    };
});
const reportErrors = (label) => { check(errors.length === 0, `${label}: no console errors, page errors or failed requests`); for (const e of errors.slice(0, 8)) console.log('    ', e); };
const world = (page, fn) => Q(page, async (src) => { const W = await import('/game-092/js/sim/world.js'); return new Function('W', 'G', `return (${src})(W, G)`)(W, __nf.G); }, fn.toString());

// ======================================================================
async function desktop() {
    console.log('\n== desktop 1280×760');
    const page = await open({ width: 1280, height: 760 });
    check(await backLinkOk(page), '← Games link is on top and points at ../index.html');
    check(await Q(page, () => !document.getElementById('title').hidden), 'title screen is up');
    check(await Q(page, () => document.getElementById('btn-continue').hidden), 'no Continue without a save');
    const L = await layout(page);
    check(L.noHScroll && L.inside && L.ratio, 'the picture is 16:9 inside the window; no sideways scroll');
    await until(page, () => __nf.G.t > 1 && __nf.G.stats.screens + __nf.G.stats.jumps >= 0 && __nf.G.p.x > 60, 'a bot plays the demo behind the menu');
    await shot(page, 'desktop-title');

    await click(page, '#title-menu [data-act="new"]');
    await until(page, () => !document.getElementById('intro').hidden && __nf.mode === 'title', 'Start Expedition opens the intro scroll first, and the game has not started');
    check(await Q(page, () => { const t = document.getElementById('intro').textContent; return /Run/.test(t) && /Jump/.test(t) && /Climb/.test(t) && /24 treasures/.test(t); }), 'the scroll tells the player the goal and the controls');
    check(await Q(page, () => document.activeElement?.id === 'intro-go'), 'Begin has the focus');
    await shot(page, 'desktop-intro');
    await page.keyboard.press('Space');                      // a real key on the focused button
    await until(page, () => __nf.mode === 'play' && document.getElementById('title').hidden && document.getElementById('intro').hidden, 'Space on Begin starts play');
    check(await Q(page, () => !document.getElementById('hud').hidden), 'the HUD is shown');
    await Q(page, () => { __nf.tp(0, 40); });

    const x0 = await Q(page, () => __nf.G.p.x);
    await page.keyboard.down('ArrowRight');
    await until(page, (x) => __nf.G.p.x > x + 12, 'holding → runs Harry right', 30000, x0);
    await page.keyboard.up('ArrowRight');

    await page.keyboard.press('Space');
    await until(page, () => __nf.seen.jump >= 1, 'Space jumps (the press reaches a sim step)');
    await Q(page, () => { __nf.G.p.vx = 0; });
    await shot(page, 'desktop-play');

    // a ladder, by real keys: Down beside the hole climbs on, then all the way down
    const lad = await world(page, (W, G) => W.getWorld(G.seed).screens.findIndex((s) => s.ladder && s.i !== 0));
    await Q(page, (i) => __nf.tp(i, 148), lad);
    await page.keyboard.down('ArrowDown');
    await until(page, () => __nf.G.p.st === 'ladder' || __nf.G.p.layer === 'tunnel', 'Down beside a ladder hole climbs on');
    await until(page, () => __nf.G.p.layer === 'tunnel' && __nf.G.p.st === 'ground', 'and down into the tunnel');
    await page.keyboard.up('ArrowDown');
    await shot(page, 'desktop-tunnel');
    await page.keyboard.down('ArrowUp');
    await until(page, () => __nf.G.p.layer === 'surface', 'Up climbs back out');
    await page.keyboard.up('ArrowUp');

    // pause
    await page.keyboard.press('Escape');
    await until(page, () => !document.getElementById('pause').hidden, 'Escape pauses');
    const t0 = await Q(page, () => __nf.G.t);
    await page.waitForTimeout(500);
    check(await Q(page, (t) => __nf.G.t === t, t0), 'the sim stops while paused');
    check(await Q(page, () => document.activeElement?.dataset?.act === 'resume'), 'Resume has the focus');
    await page.keyboard.press('Space');                      // a real key on the focused button
    await until(page, () => document.getElementById('pause').hidden, 'Space presses the focused Resume button');
    await until(page, (t) => __nf.G.t > t, 'and the game runs again', 30000, t0);

    // treasure: stand just before a surface treasure and run into it
    const tr = await world(page, (W, G) => { const t = W.getWorld(G.seed).treasures.find((q) => q.layer === 'surface'); return { s: t.screen, x: t.x }; });
    await Q(page, (t) => __nf.tp(t.s, t.x - 30), tr);
    await Q(page, () => { __nf.G.p.inv = 3; });
    await page.keyboard.down('ArrowRight');
    await until(page, () => __nf.seen.treasure >= 1, 'running into a treasure collects it');
    await page.keyboard.up('ArrowRight');
    await until(page, () => __nf.G.score > 2000 && document.getElementById('hud-loot').textContent === '1/24' && +document.getElementById('hud-score').textContent > 2000, 'the score and the LOOT counter go up');
    await shot(page, 'desktop-treasure');

    // save, quit, continue
    const score = await Q(page, () => __nf.G.score);
    await Q(page, () => document.querySelector('#btn-pause').click());
    await until(page, () => !document.getElementById('pause').hidden, 'the ❚❚ button pauses');
    await click(page, '#pause-menu [data-act="quit"]');
    await until(page, () => __nf.mode === 'title' && !document.getElementById('btn-continue').hidden, 'Save & Quit returns to the title with Continue');
    await click(page, '#title-menu [data-act="continue"]');
    await until(page, (s) => __nf.mode === 'play' && __nf.G.score === s, 'Continue restores the saved game', 30000, score);

    // to the end
    await Q(page, () => { __nf.ff(1300); });
    await until(page, () => __nf.mode === 'over' && !document.getElementById('over').hidden, 'the game ends and shows the result');
    check(await Q(page, () => document.getElementById('over-stats').children.length >= 6), 'with its stats');
    await shot(page, 'desktop-over');
    check(await Q(page, () => (localStorage.getItem('neonfall.v1.best') || '').includes('score')), 'and the best score is remembered');
    await click(page, '#over-again');
    await until(page, () => __nf.mode === 'play' && __nf.G.t < 5, 'Play Again starts a fresh expedition');
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
    const L0 = await layout(page);
    check(L0.noHScroll && L0.inside && L0.ratio, 'the picture is 16:9 and inside the viewport');
    await shot(page, `phone-${w}x${h}-title`);
    await tapSel('#title-menu [data-act="new"]');
    await until(page, () => !document.getElementById('intro').hidden, 'a tap on Start Expedition opens the intro scroll');
    await Q(page, () => document.getAnimations().forEach((a) => { if (Number.isFinite(a.effect?.getComputedTiming().endTime)) a.finish(); }));
    const sc = await Q(page, () => { const r = document.querySelector('#intro .sheet').getBoundingClientRect(); const b = document.getElementById('intro-go').getBoundingClientRect(); return { fits: r.left >= 0 && r.right <= innerWidth, btn: b.width >= 44 && b.height >= 44 && b.right <= innerWidth }; });
    check(sc.fits && sc.btn, 'the scroll fits the screen and Begin is a finger-sized target');
    await shot(page, `phone-${w}x${h}-intro`);
    await tapSel('#intro-go');
    await until(page, () => __nf.mode === 'play', 'a tap on Begin starts play');
    await until(page, () => !document.getElementById('touch').hidden, 'the touch deck is shown');
    await Q(page, () => { __nf.tp(0, 40); });

    const L = await layout(page);
    check(L.noHScroll, 'no sideways scroll');
    check(L.inside && L.ratio, 'the picture is 16:9 and inside the visible viewport');

    const hud = await Q(page, () => {
        const link = document.getElementById('back-link').getBoundingClientRect();
        const hd = document.getElementById('hud').getBoundingClientRect();
        const cells = [...document.querySelectorAll('#hud .cell, #hud .ibtn')].map((e) => e.getBoundingClientRect());
        const overlap = cells.some((c) => c.left < link.right && c.right > link.left && c.top < link.bottom && c.bottom > link.top);
        return { fits: cells.every((c) => c.left >= 0 && c.right <= innerWidth), overlap, bottom: hd.bottom };
    });
    check(hud.fits, 'every HUD cell is on screen');
    check(!hud.overlap, 'and none sits under the ← Games link');

    const sizes = await Q(page, () => ['#btn-a', '#btn-pause'].map((s) => {
        const r = document.querySelector(s).getBoundingClientRect();
        return { s, ok: r.width >= 44 && r.height >= 44 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight };
    }));
    for (const z of sizes) check(z.ok, `${z.s} is at least 44 px and on screen`);

    // drag the stick right with a real touch
    const zone = await Q(page, () => { const r = document.getElementById('stick-zone').getBoundingClientRect(); return { x: r.left + r.width * 0.4, y: r.top + r.height * 0.5 }; });
    const x0 = await Q(page, () => __nf.G.p.x);
    await touch('touchStart', zone.x, zone.y);
    for (let i = 1; i <= 6; i++) await touch('touchMove', zone.x + i * 12, zone.y);
    await until(page, (x) => __nf.G.p.x > x + 10, 'dragging the stick runs Harry', 30000, x0);
    await touch('touchEnd', 0, 0);
    await Q(page, () => { __nf.G.p.vx = 0; });

    const jumps = await Q(page, () => __nf.seen.jump || 0);
    await tapSel('#btn-a');
    await until(page, (n) => (__nf.seen.jump || 0) > n, 'tapping JUMP jumps', 30000, jumps);
    await shot(page, `phone-${w}x${h}`);

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
    await click(page, '#intro-go');
    await until(page, () => __nf.mode === 'play', 'boots, shows the scroll and starts a game with localStorage throwing');
    await Q(page, () => __nf.ff(3));
    check(await Q(page, () => __nf.save() === false), 'saving fails quietly');
    await Q(page, () => __nf.ff(1300));
    await until(page, () => __nf.mode === 'over', 'and a whole game plays out');
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

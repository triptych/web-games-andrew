/**
 * browsertest.mjs — the real game in real Chromium.
 *
 * desktop (1280×760): boot to the title with the demo playing behind it and no errors, the
 *   ← Games link on top → How to Play shows all eleven treats → New Game by click → real held
 *   keys aim the dropper → Space drops (the press reaches a sim step) → a real mouse aims by
 *   hovering and drops by clicking → two treats placed together merge → Escape pauses and the
 *   sim stops → Space on Resume doesn't also drop → Save & Quit → Continue restores the game →
 *   the jar fills and the game-over screen shows the score and the best → Play Again. No
 *   sideways scroll; the canvas fills the window.
 * phones (touch only, real CDP touches) at 390×844 and 844×390: taps through the menus; a finger
 *   dragged on the jar aims under it and lifting drops; the dropper follows the finger's x;
 *   controls ≥ 44 px and on screen; the jar is on screen and under the HUD; no sideways scroll;
 *   the canvas matches the visible viewport; the pause screen stays open after the finger lifts.
 * nostorage: localStorage throws; the game still boots, plays and ends.
 * Fails on any console error, page error or failed request.
 *
 *   python3 -m http.server 8078          # from the REPO ROOT
 *   node game-078/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8078), ONLY=desktop,phones,nostorage.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8078';
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
        args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
    });
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: touch ? 2 : 1, hasTouch: touch, isMobile: touch });
    await ctx.addInitScript((ns) => {
        if (ns) Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } });
        else try { localStorage.clear(); } catch { /* */ }
    }, nostorage);
    const page = await ctx.newPage();
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('requestfailed', (r) => { if (!r.url().includes('favicon')) errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`); });
    await page.goto(`${BASE}/game-078/index.html?debug=1&fast=2`);
    await page.waitForFunction(() => window.__sd && __sd.mode === 'title', null, { timeout: 60000 });
    return page;
}

const check = (cond, msg) => { if (!cond) { fails++; console.log('  FAIL', msg); } else console.log('  ok', msg); return cond; };
const Q = (page, fn, arg) => page.evaluate(fn, arg);
const shot = async (page, name) => { await page.screenshot({ path: path.join(OUT, `bt-${name}.png`) }); };
// wait on state, never on the clock
const until = (page, fn, msg, timeout = 30000, arg = null) =>
    page.waitForFunction(fn, arg, { timeout, polling: 100 }).then(() => check(true, msg), () => check(false, msg));
// Playwright's click() waits for animation frames to settle; click from inside instead.
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
    const jar = __sd.view.jarRect();
    const hud = document.getElementById('hud').getBoundingClientRect();
    return {
        noHScroll: document.documentElement.scrollWidth <= innerWidth + 1,
        canvas: Math.abs(c.width - (vv?.width ?? innerWidth)) < 2 && Math.abs(c.height - (vv?.height ?? innerHeight)) < 2 && c.left === 0 && c.top === 0,
        jarOnScreen: jar.left >= 0 && jar.right <= innerWidth && jar.bottom <= innerHeight && jar.top > 0,
        jarUnderHud: hud.height === 0 || jar.top >= hud.bottom - 2,
        jarW: Math.round(jar.right - jar.left),
    };
});
const reportErrors = (label) => { check(errors.length === 0, `${label}: no console errors, page errors or failed requests`); for (const e of errors.slice(0, 8)) console.log('    ', e); };
/** Client x of a world x in the jar. */
const clientX = (page, wx) => Q(page, (x) => __sd.view.jarRect().left + x * __sd.view.scale, wx);

// ======================================================================
async function desktop() {
    console.log('\n== desktop 1280×760');
    const page = await open({ width: 1280, height: 760 });
    check(await backLinkOk(page), '← Games link is on top and points at ../index.html');
    check(await Q(page, () => !document.getElementById('title').hidden), 'title screen is up');
    check(await Q(page, () => document.getElementById('btn-continue').hidden), 'no Continue without a save');
    await until(page, () => __sd.G.drops >= 2, 'the demo plays behind the title');
    check(await Q(page, () => document.querySelectorAll('#title-chain canvas').length === 11), 'the title shows the merge ladder');
    const L = await layout(page);
    check(L.noHScroll && L.canvas && L.jarOnScreen, `no sideways scroll; the canvas fills the window; the jar is on screen (${L.jarW} px wide)`);
    await shot(page, 'desktop-title');

    await click(page, '#title-menu [data-act="howto"]');
    await until(page, () => !document.getElementById('howto').hidden && document.querySelectorAll('#howto-chain .link').length === 11, 'How to Play shows all eleven treats');
    await shot(page, 'desktop-howto');
    await page.keyboard.press('Escape');
    await until(page, () => document.getElementById('howto').hidden && !document.getElementById('title').hidden, 'Escape closes it, back to the title');

    await click(page, '#title-menu [data-act="new"]');
    await until(page, () => __sd.mode === 'play' && document.getElementById('title').hidden && __sd.G.drops === 0, 'New Game starts an empty jar');
    check(await Q(page, () => !document.getElementById('hud').hidden), 'the HUD is shown');

    const x0 = await Q(page, () => __sd.G.dropper.x);
    await page.keyboard.down('ArrowLeft');
    await until(page, (x) => __sd.G.dropper.x < x - 1.5, 'holding ← moves the dropper left', 30000, x0);
    await page.keyboard.up('ArrowLeft');

    await page.keyboard.press('Space');
    await until(page, () => __sd.G.drops === 1 && __sd.seen.drop >= 1, 'Space drops a treat (the press reaches a sim step)');

    // a real mouse: hover to aim, click to drop
    await until(page, () => __sd.G.dropper.cool <= 0, 'the dropper is ready again');
    const target = await clientX(page, 7.5);
    const jr = await Q(page, () => __sd.view.jarRect());
    await page.mouse.move(target, jr.top + 200);
    await until(page, () => Math.abs(__sd.G.dropper.x - 7.5) < 0.05, 'hovering the mouse aims the dropper under it');
    await page.mouse.down();
    await page.mouse.up();
    await until(page, () => __sd.G.drops === 2 && __sd.G.bodies.some((b) => Math.abs(b.x - 7.5) < 0.6), 'clicking drops the treat where the mouse is');

    // a merge through the real loop
    const merges = await Q(page, () => __sd.seen.merge || 0);
    await Q(page, () => { __sd.place(3, 3, 11); __sd.place(3, 3, 9.5); });
    await until(page, (n) => (__sd.seen.merge || 0) > n && __sd.G.bodies.some((b) => b.tier === 4), 'two truffles touching merge into a gingerbread man', 30000, merges);

    await page.keyboard.press('Escape');
    await until(page, () => !document.getElementById('pause').hidden, 'Escape pauses');
    const t0 = await Q(page, () => __sd.G.t);
    await page.waitForTimeout(500);
    check(await Q(page, (t) => __sd.G.t === t, t0), 'the sim stops while paused');
    const drops = await Q(page, () => __sd.G.drops);
    await Q(page, () => document.querySelector('#pause-menu [data-act="resume"]').focus());
    await page.keyboard.press('Space');
    await until(page, () => document.getElementById('pause').hidden && __sd.G.t > 0, 'Space on Resume closes the pause screen');
    await page.waitForTimeout(800);
    check(await Q(page, (d) => __sd.G.drops === d, drops), 'and the Space that resumed doesn\'t also drop a treat');

    await Q(page, () => __sd.ff(25));
    await shot(page, 'desktop-play');
    const saved = await Q(page, () => ({ score: __sd.G.score, n: __sd.G.bodies.length }));
    await Q(page, () => document.querySelector('#btn-pause').click());
    await until(page, () => !document.getElementById('pause').hidden, 'the ❚❚ button pauses');
    await click(page, '#pause-menu [data-act="quit"]');
    await until(page, () => __sd.mode === 'title' && !document.getElementById('btn-continue').hidden, 'Save & Quit returns to the title with Continue');
    await click(page, '#title-menu [data-act="continue"]');
    await until(page, (s) => __sd.mode === 'play' && __sd.G.score === s.score && __sd.G.bodies.length === s.n, 'Continue restores the saved jar', 30000, saved);

    await Q(page, () => __sd.ff(1200));
    await until(page, () => __sd.mode === 'over' && !document.getElementById('over').hidden, 'the jar fills and the game-over screen shows');
    check(await Q(page, () => +document.getElementById('over-score').textContent === __sd.G.score && __sd.best.score === __sd.G.score), 'it shows the score, which is the new best');
    check(await Q(page, () => document.getElementById('btn-continue').hidden && !__sd.hasSave()), 'a finished game leaves no save behind');
    check(await Q(page, () => document.activeElement?.id === 'over-again'), 'Play Again has the focus, so Enter plays again');
    await shot(page, 'desktop-over');
    await click(page, '#over-again');
    await until(page, () => __sd.mode === 'play' && __sd.G.drops === 0 && __sd.G.score === 0, 'Play Again starts a fresh jar');
    check(await Q(page, () => document.getElementById('hud-best').textContent.includes(String(__sd.best.score))), 'the HUD shows the best score');
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
    await shot(page, `phone-${w}x${h}-title`);
    await tapSel('#title-menu [data-act="new"]');
    await until(page, () => __sd.mode === 'play' && __sd.G.drops === 0, 'a tap on New Game starts play, without dropping anything');

    const L = await layout(page);
    check(L.noHScroll, 'no sideways scroll');
    check(L.canvas, 'the canvas matches the visible viewport');
    check(L.jarOnScreen && L.jarUnderHud, `the jar is on screen, under the HUD (${L.jarW} px wide)`);

    const sizes = await Q(page, () => ['#btn-pause', '#back-link'].map((s) => {
        const r = document.querySelector(s).getBoundingClientRect();
        return { s, ok: (s === '#back-link' || (r.width >= 44 && r.height >= 44)) && r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight };
    }));
    for (const z of sizes) check(z.ok, `${z.s} is finger-sized and on screen`);

    // drag a finger across the jar: the dropper follows it; lifting drops
    const jr = await Q(page, () => __sd.view.jarRect());
    const y = (jr.top + jr.bottom) / 2;
    const from = await clientX(page, 2), to = await clientX(page, 8);
    await touch('touchStart', from, y);
    await until(page, () => Math.abs(__sd.G.dropper.x - 2) < 0.1, 'a finger on the jar puts the dropper above it');
    for (let i = 1; i <= 6; i++) await touch('touchMove', from + ((to - from) * i) / 6, y);
    await until(page, () => Math.abs(__sd.G.dropper.x - 8) < 0.1, 'dragging moves the dropper with the finger');
    check(await Q(page, () => __sd.G.drops === 0), 'nothing drops while the finger is down');
    await touch('touchEnd', 0, 0);
    await until(page, () => __sd.G.drops === 1 && __sd.G.bodies.some((b) => Math.abs(b.x - 8) < 0.6), 'lifting the finger drops the treat there');

    // a quick tap drops too, wherever it lands
    await until(page, () => __sd.G.dropper.cool <= 0, 'the dropper is ready again');
    const tx = await clientX(page, 4);
    await page.touchscreen.tap(tx, y);
    await until(page, () => __sd.G.drops === 2, 'a quick tap drops a treat');
    await Q(page, () => __sd.ff(30));
    await page.waitForTimeout(400);
    await shot(page, `phone-${w}x${h}`);

    await tapSel('#btn-pause');
    await until(page, () => !document.getElementById('pause').hidden, 'tapping ❚❚ pauses');
    await page.waitForTimeout(300);
    check(await Q(page, () => !document.getElementById('pause').hidden), 'the pause screen stays open after the finger lifts');
    const d0 = await Q(page, () => __sd.G.drops);
    await tapSel('#pause-menu [data-act="resume"]');
    await until(page, () => document.getElementById('pause').hidden, 'a tap on Resume closes it');
    await page.waitForTimeout(600);
    check(await Q(page, (d) => __sd.G.drops === d, d0), 'and the tap on Resume doesn\'t drop a treat');
    reportErrors(`phone ${w}×${h}`);
}

// ======================================================================
async function nostorage() {
    console.log('\n== blocked storage');
    const page = await open({ width: 1280, height: 760 }, { nostorage: true });
    await click(page, '#title-menu [data-act="new"]');
    await until(page, () => __sd.mode === 'play', 'boots and starts a game with localStorage throwing');
    await Q(page, () => __sd.ff(5));
    check(await Q(page, () => __sd.save() === false), 'saving fails quietly');
    await Q(page, () => __sd.ff(1200));
    await until(page, () => __sd.mode === 'over', 'and the game still ends normally');
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

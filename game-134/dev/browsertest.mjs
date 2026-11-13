/**
 * browsertest.mjs — UFOops! in real Chromium.
 *
 * desktop (1280×760): boots to the title with no errors and the ← Games link on top; every painting decodes,
 *   the recorded effects and voices decode and the title theme is a recorded track; New Game → the episode
 *   card; Space on the focused Roll it! starts play; real keys fly, held Space beams; Escape pauses and the sim
 *   stops; Escape closes Settings with a slider focused; Space presses the focused Resume; Save & Quit →
 *   Continue restores the episode; the bot finishes it → the report card stamps a grade and offers upgrades →
 *   picking one opens the next card; crashing every saucer → CANCELLED! → Continue replays the episode.
 * phones (touch only, real CDP touches) at 390×844 and 844×390: taps through the title and the card, the
 *   touch deck shows, the stick flies, a held BEAM beams, DROP drops, controls ≥ 44 px and on screen, no
 *   sideways scroll, the canvas matches the visible viewport, ❚❚ pauses and stays open after the lift.
 * nostorage: localStorage throws; the game still boots and plays.
 * Fails on any console error, page error or failed request.
 *
 *   python3 -m http.server 8134          # from the REPO ROOT
 *   node game-134/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8134), ONLY=desktop,phones,nostorage.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8134';
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
    page.on('requestfailed', (r) => { if (!r.url().includes('favicon') && !/\.mp3/.test(r.url())) errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`); });
    page.on('response', (r) => { if (r.status() >= 400 && !r.url().includes('favicon')) errors.push(`http ${r.status()}: ${r.url()}`); });
    await page.goto(`${BASE}/game-134/index.html?debug=1&fast=4&seed=7`);
    await page.waitForFunction(() => window.__uo && __uo.mode === 'title', null, { timeout: 60000 });
    return page;
}

const check = (cond, msg) => { if (!cond) { fails++; console.log('  FAIL', msg); } else console.log('  ok', msg); return cond; };
const Q = (page, fn, arg) => page.evaluate(fn, arg);
const shot = async (page, name) => { await page.screenshot({ path: path.join(OUT, `bt-${name}.png`) }); };
// SwiftShader draws a few frames a second: wait on state, never on the clock.
const until = (page, fn, msg, timeout = 30000, arg = null) =>
    page.waitForFunction(fn, arg, { timeout, polling: 100 }).then(() => check(true, msg), () => check(false, msg));
const click = (page, sel) => Q(page, (s) => { const e = document.querySelector(s); if (!e) return false; e.click(); return true; }, sel);
// screens pop in with an animation; finish it so a tap lands where the button will be (game-088)
const settle = (page) => Q(page, () => { for (const a of document.getAnimations()) try { a.finish(); } catch { /* infinite */ } });
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
    check(await Q(page, () => !document.getElementById('title').hidden && document.getElementById('btn-continue').hidden), 'title screen is up, no Continue without a save');
    await until(page, () => { const a = __uo.art(); return a.total >= 30 && a.ok === a.total; }, 'every painting (sprites, backdrops, icons, portraits) decodes');
    check(await Q(page, () => __uo.art().failed === 0), 'no painting failed to load');
    const L = await layout(page);
    check(L.noHScroll && L.canvas, 'no sideways scroll; the canvas fills the window');
    await shot(page, 'desktop-title');

    await page.mouse.click(640, 700);                                    // a gesture: audio may start
    await until(page, () => __uo.sound().sfx >= 27 && __uo.sound().voices >= 40, 'the recorded effects and voices decode', 40000);
    check(await Q(page, () => __uo.sound().failed.length === 0), 'no sound file failed');
    await until(page, () => (__uo.sound().playing || '').startsWith('file:theme'), 'the title theme is the recorded track');

    await click(page, '#title-menu [data-act="new"]');
    await until(page, () => __uo.mode === 'play' && !document.getElementById('brief').hidden && __uo.G.phase === 'brief', 'New Game opens the episode card');
    await settle(page);
    await shot(page, 'desktop-brief');
    await until(page, () => document.activeElement?.id === 'brief-go', 'Roll it! has the focus');
    await page.keyboard.press('Space');
    await until(page, () => __uo.G.phase === 'play' && document.getElementById('brief').hidden, 'Space on Roll it! starts the episode');
    await until(page, () => (__uo.sound().playing || '').startsWith('file:play'), 'the gameplay track takes over');

    const x0 = await Q(page, () => __uo.G.ufo.x);
    await page.keyboard.down('ArrowRight');
    await until(page, (x) => __uo.G.ufo.x > x + 2, 'holding → flies right', 30000, x0);
    await page.keyboard.up('ArrowRight');
    await page.keyboard.down('Space');
    await until(page, () => __uo.G.ufo.beam && (__uo.seen.beamon || 0) >= 1, 'holding Space turns the beam on');
    await shot(page, 'desktop-beam');
    await page.keyboard.up('Space');
    await until(page, () => !__uo.G.ufo.beam, 'letting go turns it off');

    await page.keyboard.press('Escape');
    await until(page, () => !document.getElementById('pause').hidden, 'Escape pauses');
    const t0 = await Q(page, () => __uo.G.lt);
    await page.waitForTimeout(500);
    check(await Q(page, (t) => __uo.G.lt === t, t0), 'the sim stops while paused');
    await click(page, '#pause-menu [data-act="settings"]');
    await until(page, () => !document.getElementById('settings').hidden, 'Settings opens over the pause screen');
    await Q(page, () => document.getElementById('set-sfx').focus());
    await page.keyboard.press('Escape');
    await until(page, () => document.getElementById('settings').hidden && !document.getElementById('pause').hidden, 'Escape closes Settings with a slider focused');
    await settle(page);
    await Q(page, () => document.querySelector('#pause-menu [data-act="resume"]').focus());
    await page.keyboard.press('Space');
    await until(page, () => document.getElementById('pause').hidden && __uo.G.lt > 0, 'Space presses the focused Resume');

    await Q(page, () => __uo.ff(4));
    const snap = await Q(page, () => ({ lt: __uo.G.lt, score: __uo.G.score }));
    await Q(page, () => document.querySelector('#btn-pause').click());
    await until(page, () => !document.getElementById('pause').hidden, 'the ❚❚ button pauses');
    await click(page, '#pause-menu [data-act="quit"]');
    await until(page, () => __uo.mode === 'title' && !document.getElementById('btn-continue').hidden, 'Save & Quit returns to the title with Continue');
    await click(page, '#title-menu [data-act="continue"]');
    await until(page, (s) => __uo.mode === 'play' && __uo.G.score === s.score && Math.abs(__uo.G.lt - s.lt) < 0.5, 'Continue restores the episode', 30000, snap);

    await Q(page, () => __uo.finish());
    await until(page, () => __uo.G.phase === 'report' && !document.getElementById('report').hidden, 'the bot finishes the episode and the report card opens');
    await settle(page);
    check(await Q(page, () => /^(A\+|A|B|C|D)$/.test(document.getElementById('report-grade').textContent)), 'the report card stamps a passing grade');
    check(await Q(page, () => document.querySelectorAll('#report-ups [data-up]').length === 3), 'and offers three repairs');
    await shot(page, 'desktop-report');
    await click(page, '#report-ups [data-up]');
    await until(page, () => __uo.G.level === 1 && __uo.G.phase === 'brief' && !document.getElementById('brief').hidden, 'picking a repair opens episode 2\'s card');

    // run out of saucers
    await click(page, '#brief-go');
    await until(page, () => __uo.G.phase === 'play', 'episode 2 starts');
    await Q(page, () => { __uo.G.lives = 1; __uo.G.ufo.hull = 1; __uo.G.ufo.inv = 0; __uo.G.ufo.fx.shield = 0; __uo.G.shots.push({ kind: 'pellet', x: __uo.G.ufo.x, y: __uo.G.ufo.y, vx: 0, vy: 0, ttl: 1 }); });
    await until(page, () => __uo.G.phase === 'over' && !document.getElementById('over').hidden, 'losing the last saucer: CANCELLED!');
    await settle(page);
    await shot(page, 'desktop-over');
    await click(page, '#over-continue');
    await until(page, () => __uo.G.phase === 'brief' && __uo.G.level === 1 && __uo.G.lives === 3, 'Continue replays the episode with fresh saucers');
    reportErrors('desktop');
}

// ======================================================================
async function phone(w, h) {
    console.log(`\n== phone ${w}×${h} (touch only)`);
    const page = await open({ width: w, height: h }, { touch: true });
    const cdp = await page.context().newCDPSession(page);
    const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
    const center = (sel) => Q(page, (s) => { const e = document.querySelector(s); e?.scrollIntoView({ block: 'center' }); const b = e?.getBoundingClientRect(); return b && { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, sel);
    const tapSel = async (sel) => { await settle(page); const r = await center(sel); if (!r) return false; await page.touchscreen.tap(r.x, r.y); return true; };

    check(await backLinkOk(page), '← Games link is on top');
    await tapSel('#title-menu [data-act="new"]');
    await until(page, () => !document.getElementById('brief').hidden, 'a tap on New Game opens the episode card');
    await tapSel('#brief-go');
    await until(page, () => __uo.G.phase === 'play', 'a tap on Roll it! starts play');
    await until(page, () => !document.getElementById('touch').hidden, 'the touch deck is shown');

    const L = await layout(page);
    check(L.noHScroll, 'no sideways scroll');
    check(L.canvas, 'the canvas matches the visible viewport');
    const sizes = await Q(page, () => ['#btn-beam', '#btn-drop', '#btn-pause'].map((s) => {
        const r = document.querySelector(s).getBoundingClientRect();
        return { s, ok: r.width >= 44 && r.height >= 44 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight };
    }));
    for (const z of sizes) check(z.ok, `${z.s} is at least 44 px and on screen`);
    check(await Q(page, () => { const a = document.getElementById('back-link').getBoundingClientRect(), b = document.getElementById('hud-hull').getBoundingClientRect(); return b.left >= a.right - 1 || b.top >= a.bottom - 1; }), 'the HUD clears the ← Games link');

    // the stick, with a real touch
    const zone = await Q(page, () => { const r = document.getElementById('stick-zone').getBoundingClientRect(); return { x: r.left + r.width * 0.4, y: r.top + r.height * 0.5 }; });
    const x0 = await Q(page, () => __uo.G.ufo.x);
    await touch('touchStart', [{ x: zone.x, y: zone.y, id: 1 }]);
    for (let i = 1; i <= 6; i++) await touch('touchMove', [{ x: zone.x + i * 12, y: zone.y, id: 1 }]);
    await until(page, (x) => __uo.G.ufo.x > x + 1, 'dragging the stick flies the saucer', 30000, x0);
    // a second finger holds BEAM while the stick is down
    const bb = await center('#btn-beam');
    await touch('touchStart', [{ x: zone.x + 72, y: zone.y, id: 1 }, { x: bb.x, y: bb.y, id: 2 }]);
    await until(page, () => __uo.G.ufo.beam, 'a held BEAM beams (with the stick still down)');
    await shot(page, `phone-${w}x${h}`);
    await touch('touchEnd', []);
    await until(page, () => !__uo.G.ufo.beam, 'lifting the fingers stops the beam');
    const drops = await Q(page, () => { __uo.G.ufo.hold = ['cow']; __uo.G.ufo.dropCd = 0; return __uo.seen.drop || 0; });
    await tapSel('#btn-drop');
    await until(page, (n) => (__uo.seen.drop || 0) > n, 'tapping DROP drops a specimen', 30000, drops);

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
    await until(page, () => __uo.G.phase === 'brief', 'boots and opens a card with localStorage throwing');
    await click(page, '#brief-go');
    await until(page, () => __uo.G.phase === 'play', 'and plays');
    await Q(page, () => __uo.ff(3));
    check(await Q(page, () => __uo.save() === false), 'saving fails quietly');
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

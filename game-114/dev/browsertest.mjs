/**
 * browsertest.mjs — the real game in real Chromium (SwiftShader WebGL).
 *
 * desktop (1280×760): boot to the title (the bot plays behind it) with no errors, the ← Games
 *   link on top → New Game → the story → Space on the focused button → the briefing → Deploy →
 *   real keys run, jump, fire and throw a flare → Escape pauses and the sim stops → Space on the
 *   focused Resume resumes → ❚❚ → Save & Quit → Continue restores the sector → the exit door
 *   clears the sector and Onward briefs the next → losing every life shows Game Over and Continue
 *   restarts the sector → the Queen falls and the ending shows. No sideways scroll; the canvas
 *   fills the window.
 * phones (touch only, real CDP touches) at 390×844 and 844×390: taps through the title, story and
 *   briefing, the touch deck appears, the stick moves the player, JUMP jumps, FIRE fires, controls
 *   ≥ 44 px and on screen, no sideways scroll, the canvas matches the visible viewport, ❚❚ pauses
 *   and the pause screen stays open after the finger lifts.
 * nostorage: localStorage throws; the game still boots and plays.
 * Fails on any console error, page error or failed request.
 *
 *   python3 -m http.server 8114          # from the REPO ROOT
 *   node game-114/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8114), ONLY=desktop,phones,nostorage, THREE_PKG.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8114';
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
    page.on('requestfailed', (r) => { if (!r.url().includes('favicon')) errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`); });
    await page.goto(`${BASE}/game-114/index.html?debug=1&fast=4`);
    await page.waitForFunction(() => window.__lc && __lc.mode === 'title', null, { timeout: 60000 });
    return page;
}

const check = (cond, msg) => { if (!cond) { fails++; console.log('  FAIL', msg); } else console.log('  ok', msg); return cond; };
const Q = (page, fn, arg) => page.evaluate(fn, arg);
const shot = async (page, name) => { await page.screenshot({ path: path.join(OUT, `bt-${name}.png`) }); };
// SwiftShader draws a few frames a second: wait on state, never on the clock.
const until = (page, fn, msg, timeout = 40000, arg = null) =>
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
const reportErrors = (label) => { check(errors.length === 0, `${label}: no console errors, page errors or failed requests`); for (const e of errors.slice(0, 8)) console.log('    ', e); };
const quiet = (page) => Q(page, () => { const G = __lc.G; G.spawns.forEach((s) => { s.on = true; }); G.enemies.length = 0; G.ebul.length = 0; });

// ======================================================================
async function desktop() {
    console.log('\n== desktop 1280×760');
    const page = await open({ width: 1280, height: 760 });
    check(await backLinkOk(page), '← Games link is on top and points at ../index.html');
    check(await visible(page, 'title'), 'title screen is up');
    check(await Q(page, () => document.getElementById('btn-continue').hidden), 'no Continue without a save');
    await until(page, () => __lc.G.player.x > 5, 'the bot plays a sector behind the title');
    const L = await layout(page);
    check(L.noHScroll && L.canvas, 'no sideways scroll; the canvas fills the window');
    await shot(page, 'desktop-title');

    await click(page, '#title-menu [data-act="new"]');
    await until(page, () => __lc.mode === 'story' && !document.getElementById('story').hidden, 'New Game opens the story');
    await until(page, () => document.activeElement?.id === 'story-go', 'its button has focus');
    await page.keyboard.press('Space');
    await until(page, () => __lc.mode === 'brief' && !document.getElementById('brief').hidden, 'Space on the focused button goes on to the briefing');
    check(await Q(page, () => document.getElementById('brief-name').textContent === 'CRYO DECK'), 'the briefing names Sector 1');
    await shot(page, 'desktop-brief');
    await page.keyboard.press('Enter');
    await until(page, () => __lc.mode === 'play' && document.getElementById('brief').hidden, 'Enter on Deploy starts play');
    await quiet(page);

    const x0 = await Q(page, () => __lc.G.player.x);
    await page.keyboard.down('ArrowRight');
    await until(page, (x) => __lc.G.player.x > x + 2, 'holding → runs right', 40000, x0);
    await page.keyboard.up('ArrowRight');
    await page.keyboard.press('KeyZ');
    await until(page, () => __lc.seen.jump >= 1, 'Z jumps (the press reaches a sim step)');
    await page.keyboard.press('KeyX');
    await until(page, () => __lc.seen.shot >= 1, 'X fires');
    await page.keyboard.press('KeyC');
    await until(page, () => __lc.seen.flareThrow >= 1, 'C throws a flare');
    await until(page, () => __lc.seen.boom >= 1, 'and it goes off');
    await shot(page, 'desktop-play');

    await page.keyboard.press('Escape');
    await until(page, () => !document.getElementById('pause').hidden, 'Escape pauses');
    const t0 = await Q(page, () => __lc.G.t);
    await page.waitForTimeout(600);
    check(await Q(page, (t) => __lc.G.t === t, t0), 'the sim stops while paused');
    await page.keyboard.press('Space');
    await until(page, () => document.getElementById('pause').hidden, 'Space on the focused Resume resumes');
    await until(page, (t) => __lc.G.t > t, 'and the sim runs again', 40000, t0);

    await Q(page, () => __lc.ff(4));
    const snap = await Q(page, () => ({ idx: __lc.G.levelIdx, x: Math.round(__lc.G.player.x) }));
    await Q(page, () => document.querySelector('#btn-pause').click());
    await until(page, () => !document.getElementById('pause').hidden, 'the ❚❚ button pauses');
    await click(page, '#pause-menu [data-act="quit"]');
    await until(page, () => __lc.mode === 'title' && !document.getElementById('btn-continue').hidden, 'Save & Quit returns to the title with Continue');
    await click(page, '#title-menu [data-act="continue"]');
    await until(page, (s) => __lc.mode === 'play' && __lc.G.levelIdx === s.idx && Math.abs(__lc.G.player.x - s.x) < 1.5, 'Continue restores the sector and where you were', 40000, snap);

    // the exit door
    await Q(page, () => { const G = __lc.G; G.god = true; G.player.x = G.level.exit.x - 3; G.player.y = G.level.exit.y + 0.5; });
    await page.keyboard.down('ArrowRight');
    await until(page, () => __lc.mode === 'clear', 'walking through the exit door clears the sector');
    await page.keyboard.up('ArrowRight');
    await until(page, () => !document.getElementById('clear').hidden, 'the tally shows');
    await shot(page, 'desktop-clear');
    await click(page, '#clear-go');
    await until(page, () => __lc.mode === 'brief' && __lc.G.levelIdx === 1 && document.getElementById('brief-name').textContent === 'HYDROPONICS', 'Onward briefs Sector 2');
    await click(page, '#brief-go');
    await until(page, () => __lc.mode === 'play', 'and Deploy starts it');

    // game over and continue
    await Q(page, () => { const G = __lc.G; G.god = false; G.lives = 1; G.player.inv = 0; G.player.hp = 1; G.ebul.push({ x: G.player.x, y: G.player.y + 1, vx: 0, vy: 0, k: 'bolt', g: 0, life: 9, r: 0.3 }); });
    await until(page, () => __lc.mode === 'over' && !document.getElementById('over').hidden, 'losing the last life shows Game Over');
    await click(page, '#over-again');
    await until(page, () => __lc.mode === 'play' && __lc.G.lives === 3 && __lc.G.levelIdx === 1, 'Continue restarts the sector with full lives');

    // the ending
    await Q(page, () => { __lc.start(9, 7); const G = __lc.G; G.god = true; G.spawns.length = 0; G.player.x = G.level.arena.x0 + 5; __lc.autoplay(true); });
    await until(page, () => __lc.G.boss && __lc.G.boss.state !== 'intro', 'the Queen wakes', 60000);
    await shot(page, 'desktop-queen');
    await Q(page, () => { __lc.G.boss.hp = 1; });
    await until(page, () => __lc.mode === 'won' && !document.getElementById('ending').hidden, 'the Queen falls and the ending shows', 60000);
    check(await Q(page, () => document.getElementById('ending-text').textContent.includes('Larder')), 'the ending tells the story');
    await shot(page, 'desktop-ending');
    await Q(page, () => __lc.autoplay(false));
    await click(page, '#ending-go');
    await until(page, () => __lc.mode === 'title' && document.getElementById('btn-continue').hidden, 'and returns to the title with the finished save cleared');
    reportErrors('desktop');
}

// ======================================================================
async function phone(w, h) {
    console.log(`\n== phone ${w}×${h} (touch only)`);
    const page = await open({ width: w, height: h }, { touch: true });
    const cdp = await page.context().newCDPSession(page);
    const touch = (type, x, y, id = 1) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id }] });
    const center = (sel) => Q(page, (s) => { const e = document.querySelector(s); e?.scrollIntoView({ block: 'center' }); const b = e?.getBoundingClientRect(); return b && { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, sel);
    const tapSel = async (sel) => { const r = await center(sel); if (!r) return false; await page.touchscreen.tap(r.x, r.y); return true; };

    check(await backLinkOk(page), '← Games link is on top');
    await tapSel('#title-menu [data-act="new"]');
    await until(page, () => __lc.mode === 'story', 'a tap on New Game opens the story');
    await tapSel('#story-go');
    await until(page, () => __lc.mode === 'brief', 'a tap on Get up opens the briefing');
    await tapSel('#brief-go');
    await until(page, () => __lc.mode === 'play', 'a tap on Deploy starts play');
    await until(page, () => !document.getElementById('touch').hidden, 'the touch deck is shown');
    await quiet(page);

    const L = await layout(page);
    check(L.noHScroll, 'no sideways scroll');
    check(L.canvas, 'the canvas matches the visible viewport');
    const sizes = await Q(page, () => ['#btn-fire', '#btn-jump', '#btn-flare', '#btn-pause'].map((s) => {
        const r = document.querySelector(s).getBoundingClientRect();
        return { s, ok: r.width >= 44 && r.height >= 44 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight };
    }));
    for (const z of sizes) check(z.ok, `${z.s} is at least 44 px and on screen`);
    const hudOk = await Q(page, () => {
        const a = document.getElementById('back-link').getBoundingClientRect(), h = document.querySelector('.hud-l').getBoundingClientRect();
        return h.left >= a.right - 1 || h.top >= a.bottom;
    });
    check(hudOk, 'the HUD clears the ← Games link');

    const zone = await Q(page, () => { const r = document.getElementById('stick-zone').getBoundingClientRect(); return { x: r.left + r.width * 0.4, y: r.top + r.height * 0.6 }; });
    const x0 = await Q(page, () => __lc.G.player.x);
    await touch('touchStart', zone.x, zone.y);
    for (let i = 1; i <= 6; i++) await touch('touchMove', zone.x + i * 12, zone.y);
    await until(page, (x) => __lc.G.player.x > x + 1, 'dragging the stick runs right', 40000, x0);
    await touch('touchEnd', 0, 0);

    await tapSel('#btn-jump');
    await until(page, () => (__lc.seen.jump || 0) >= 1, 'tapping JUMP jumps');
    await tapSel('#btn-fire');
    await until(page, () => (__lc.seen.shot || 0) >= 1, 'tapping FIRE fires');
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
    await click(page, '#story-go');
    await click(page, '#brief-go');
    await until(page, () => __lc.mode === 'play', 'boots and starts a game with localStorage throwing');
    await Q(page, () => __lc.ff(3));
    check(await Q(page, () => __lc.save() === false), 'saving fails quietly');
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

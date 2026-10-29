/**
 * browsertest.mjs — the real game in real Chromium (SwiftShader WebGL).
 *
 * desktop (1280×760): boot to the title with no errors, the ← Games link on top, the attract demo
 *   plays behind the title without reaching the HUD or audio → New Game by click → real key
 *   presses move the player → Escape pauses and the sim stops → a real Space presses the focused
 *   Resume → the action key dashes → a level-up shows three cards and a real "2" picks one →
 *   Settings opened from Pause sits on top of it → Save & Quit → Continue restores the game →
 *   the run ends → Play Again. No sideways scroll; the canvas fills the window.
 * phones (touch only, real CDP touches) at 390×844 and 844×390: taps through the menus, the
 *   touch deck appears, the stick moves the player, DASH dashes, a tapped level-up card picks,
 *   controls ≥ 44 px and on screen, no sideways scroll, the canvas matches the visible viewport.
 * nostorage: localStorage throws; the game still boots and plays.
 * Fails on any console error, page error or failed request.
 *
 *   python3 -m http.server 8106          # from the REPO ROOT
 *   node game-106/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8106), ONLY=desktop,phones,nostorage, THREE_PKG.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8106';
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
    await page.goto(`${BASE}/game-106/index.html?debug=1&fast=4`);
    await page.waitForFunction(() => window.__ia && __ia.mode === 'title', null, { timeout: 60000 });
    return page;
}

const check = (cond, msg) => { if (!cond) { fails++; console.log('  FAIL', msg); } else console.log('  ok', msg); return cond; };
const Q = (page, fn, arg) => page.evaluate(fn, arg);
const shot = async (page, name) => { if (process.env.VERBOSE) console.log('  shot', name); await page.screenshot({ path: path.join(OUT, `bt-${name}.png`), timeout: 60000 }); };
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
/** Drop enough chips under the player for one level-up. */
const levelUp = (page) => Q(page, () => { const G = __ia.G, n = Math.round(5 * 1.32 ** (G.level - 1)) - G.xp; G.chips.push({ x: G.player.x, y: G.player.y, v: Math.max(1, n) }); });
/** If a level-up popped up on its own during a check, take the first card. */
const settle = (page) => Q(page, () => { if (__ia.G.choice) __ia.pick(0); });
const reportErrors = (label) => { check(errors.length === 0, `${label}: no console errors, page errors or failed requests`); for (const e of errors.slice(0, 8)) console.log('    ', e); };

// ======================================================================
async function desktop() {
    console.log('\n== desktop 1280×760');
    const page = await open({ width: 1280, height: 760 });
    check(await backLinkOk(page), '← Games link is on top and points at ../index.html');
    check(await Q(page, () => !document.getElementById('title').hidden), 'title screen is up');
    check(await Q(page, () => document.getElementById('btn-continue').hidden), 'no Continue without a save');
    const L = await layout(page);
    check(L.noHScroll && L.canvas, 'no sideways scroll; the canvas fills the window');
    const at = await Q(page, () => __ia.G.t);
    await until(page, (t) => __ia.G.t > t + 0.5, 'the attract demo plays behind the title', 30000, at);
    check(await Q(page, () => Object.keys(__ia.seen).length === 0 && document.getElementById('hud').hidden), 'the demo reaches neither the HUD nor the event counts');
    await shot(page, 'desktop-title');

    await click(page, '#title-menu [data-act="new"]');
    await until(page, () => __ia.mode === 'play' && document.getElementById('title').hidden, 'New Game starts play');

    const x0 = await Q(page, () => __ia.G.player.x);
    await page.keyboard.down('ArrowRight');
    await until(page, (x) => __ia.G.player.x > x + 1.5, 'holding → moves the player right', 30000, x0);
    await page.keyboard.up('ArrowRight');

    await page.keyboard.press('Escape');
    await until(page, () => !document.getElementById('pause').hidden, 'Escape pauses');
    const t0 = await Q(page, () => __ia.G.t);
    await page.waitForTimeout(500);
    check(await Q(page, (t) => __ia.G.t === t, t0), 'the sim stops while paused');
    check(await Q(page, () => document.activeElement?.dataset?.act === 'resume'), 'Resume has the focus');
    await page.keyboard.press('Space');
    await until(page, () => document.getElementById('pause').hidden && __ia.G.t > 0, 'a real Space presses Resume');
    await settle(page);
    // the press that closes a menu is flushed on the first frame back (game-078); let that frame run
    const tr = await Q(page, () => __ia.G.t);
    await until(page, (t) => __ia.G.t > t + 0.05, 'play resumes', 30000, tr);

    await page.keyboard.press('Space');
    await until(page, () => __ia.seen.dash >= 1, 'Space dashes (the press reaches a sim step)');

    await settle(page);
    await levelUp(page);
    await until(page, () => !document.getElementById('levelup').hidden && document.querySelectorAll('#levelup-menu button').length === 3, 'a level-up shows three upgrade cards');
    const tl = await Q(page, () => __ia.G.t);
    await page.waitForTimeout(400);
    check(await Q(page, (t) => __ia.G.t === t, tl), 'the game waits on the cards');
    await shot(page, 'desktop-levelup');
    const want = await Q(page, () => document.querySelectorAll('#levelup-menu button')[1].dataset.id);
    await page.keyboard.press('Digit2');
    await until(page, (id) => document.getElementById('levelup').hidden && __ia.G.up[id] >= 1 && __ia.seen.choose >= 1, 'a real "2" takes the second card', 30000, want);
    await until(page, (t) => __ia.G.t > t, 'and play goes on', 30000, tl);

    await settle(page);
    await page.waitForTimeout(300);                  // keys in the 250 ms after a pick are swallowed on purpose
    await page.keyboard.press('Escape');
    await until(page, () => !document.getElementById('pause').hidden, 'Escape pauses again');
    await click(page, '#pause-menu [data-act="settings"]');
    check(await Q(page, () => { const r = document.querySelector('#settings .sheet').getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + 20); return !!e?.closest('#settings'); }), 'Settings opened from Pause is on top of it');
    await click(page, '#settings [data-close]');
    await click(page, '#pause-menu [data-act="resume"]');
    await until(page, () => document.getElementById('pause').hidden && document.getElementById('settings').hidden, 'back to play');
    await settle(page);

    await shot(page, 'desktop-play');
    await Q(page, () => __ia.ff(5));
    await Q(page, () => document.querySelector('#btn-pause').click());
    await until(page, () => !document.getElementById('pause').hidden, 'the ❚❚ button pauses');
    await click(page, '#pause-menu [data-act="quit"]');
    await until(page, () => __ia.mode === 'title' && !document.getElementById('btn-continue').hidden, 'Save & Quit returns to the title with Continue');
    const saved = await Q(page, () => JSON.parse(localStorage.getItem('intruder-alert-84.v1')).data.score);
    await click(page, '#title-menu [data-act="continue"]');
    await until(page, (s) => __ia.mode === 'play' && __ia.G.score === s, 'Continue restores the saved game', 30000, saved);

    await Q(page, () => __ia.ff(400));
    await until(page, () => __ia.mode === 'over' && !document.getElementById('over').hidden, 'the run ends and shows the score');
    check(await Q(page, () => /Game Over|Escaped/.test(document.getElementById('over-title').textContent) && document.querySelectorAll('#over-text .row').length === 4), 'with a title and the stats');
    check(await Q(page, () => document.activeElement?.id === 'over-again'), 'Play Again has the focus, so Enter retries');
    await shot(page, 'desktop-over');
    await click(page, '#over-again');
    await until(page, () => __ia.mode === 'play' && __ia.G.t < 5, 'Play Again starts a fresh round');
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
    await until(page, () => __ia.mode === 'play', 'a tap on New Game starts play');
    await until(page, () => !document.getElementById('touch').hidden, 'the touch deck is shown');

    const L = await layout(page);
    check(L.noHScroll, 'no sideways scroll');
    check(L.canvas, 'the canvas matches the visible viewport');

    const sizes = await Q(page, () => ['#btn-a', '#btn-pause'].map((s) => {
        const r = document.querySelector(s).getBoundingClientRect();
        return { s, ok: r.width >= 44 && r.height >= 44 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight };
    }));
    for (const z of sizes) check(z.ok, `${z.s} is at least 44 px and on screen`);

    // drag the stick right with a real touch
    const zone = await Q(page, () => { const r = document.getElementById('stick-zone').getBoundingClientRect(); return { x: r.left + r.width * 0.4, y: r.top + r.height * 0.5 }; });
    const x0 = await Q(page, () => __ia.G.player.x);
    await touch('touchStart', zone.x, zone.y);
    for (let i = 1; i <= 6; i++) await touch('touchMove', zone.x + i * 12, zone.y);
    await until(page, (x) => __ia.G.player.x > x + 1, 'dragging the stick moves the player', 30000, x0);
    await touch('touchEnd', 0, 0);

    const dashes = await Q(page, () => __ia.seen.dash || 0);
    await tapSel('#btn-a');
    await until(page, (n) => (__ia.seen.dash || 0) > n, 'tapping A dashes', 30000, dashes);
    await shot(page, `phone-${w}x${h}`);

    await settle(page);
    await levelUp(page);
    await until(page, () => !document.getElementById('levelup').hidden, 'a level-up shows the cards');
    const cards = await Q(page, () => [...document.querySelectorAll('#levelup-menu button')].map((b) => { const r = b.getBoundingClientRect(); return r.height >= 44 && r.bottom <= innerHeight + 1 && r.top >= 0; }));
    check(cards.length === 3 && cards.every(Boolean), 'all three cards are on screen and finger-sized');
    await shot(page, `phone-${w}x${h}-levelup`);
    const ch = await Q(page, () => __ia.seen.choose || 0);
    await tapSel('#levelup-menu button');
    await until(page, (n) => document.getElementById('levelup').hidden && (__ia.seen.choose || 0) > n, 'a tapped card picks', 30000, ch);
    await settle(page);

    await settle(page);
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
    await until(page, () => __ia.mode === 'play', 'boots and starts a game with localStorage throwing');
    await Q(page, () => __ia.ff(3));
    check(await Q(page, () => __ia.save() === false), 'saving fails quietly');
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

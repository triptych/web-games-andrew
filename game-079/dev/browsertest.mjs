/**
 * browsertest.mjs — the real game in real Chromium (SwiftShader WebGL).
 *
 * desktop (1280×760): boot to the title with no errors and the bot playing behind it, the ← Games
 *   link on top → New Game → difficulty → the briefing → Lock & Load → real keys move and turn,
 *   Space jumps, Ctrl fires, V kicks, Escape pauses and the sim stops, Space presses the focused
 *   Resume button → the level is cleared → the tally → Next Level → the briefing for level 2 →
 *   death → CONTINUE? → Continue → Save & Quit → Continue restores the level. No sideways scroll;
 *   the canvas fills the window.
 * phones (touch only, real CDP touches) at 390×844 and 844×390: taps through the menus, the touch
 *   deck appears, the stick moves the player, the look pad turns, FIRE fires, JUMP jumps, KICK
 *   kicks, controls ≥ 44 px and on screen, no sideways scroll, the canvas matches the viewport.
 * nostorage: localStorage throws; the game still boots and plays.
 * Fails on any console error, page error or failed request.
 *
 *   python3 -m http.server 8079          # from the REPO ROOT
 *   node game-079/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8079), ONLY=desktop,phones,nostorage, THREE_PKG.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8079';
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
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text().slice(0, 300)}`); });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('requestfailed', (r) => { if (!r.url().includes('favicon')) errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`); });
    await page.goto(`${BASE}/game-079/index.html?debug=1&fast=4&seed=4242`);
    await page.waitForFunction(() => window.__vo && __vo.mode === 'title', null, { timeout: 90000 });
    return page;
}

const check = (cond, msg) => { if (!cond) { fails++; console.log('  FAIL', msg); } else console.log('  ok', msg); return cond; };
const Q = (page, fn, arg) => page.evaluate(fn, arg);
const shot = async (page, name) => { await page.screenshot({ path: path.join(OUT, `bt-${name}.png`) }); };
// SwiftShader draws a few frames a second: wait on state, never on the clock.
const until = (page, fn, msg, timeout = 60000, arg = null) =>
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
    check(await Q(page, () => document.getElementById('btn-continue').hidden), 'no Continue without a save');
    await until(page, () => __vo.seen.fire > 0 || __vo.G.player.x !== 0, 'the bot plays behind the title', 60000);
    const L = await layout(page);
    check(L.noHScroll && L.canvas, 'no sideways scroll; the canvas fills the window');
    await shot(page, 'desktop-title');

    await click(page, '#title-menu [data-act="newgame"]');
    await until(page, () => !document.getElementById('newgame').hidden, 'New Game opens the difficulty picker');
    await click(page, '#diff-menu [data-diff="1"]');
    await until(page, () => __vo.mode === 'brief' && !document.getElementById('brief').hidden, 'a difficulty opens the briefing');
    check(await Q(page, () => document.getElementById('brief-name').textContent === 'SUNSET STRIP'), 'the briefing names level 1');
    await shot(page, 'desktop-brief');
    await click(page, '#brief-go');
    await until(page, () => __vo.mode === 'play' && document.getElementById('brief').hidden && !document.getElementById('hud').hidden, 'Lock & Load starts play with the HUD');
    await Q(page, () => { __vo.G.god = true; for (const e of __vo.G.enemies) e.alert = false; });

    // real keys
    const p0 = await Q(page, () => ({ x: __vo.G.player.x, z: __vo.G.player.z, yaw: __vo.G.player.yaw }));
    await page.keyboard.down('KeyW');
    await until(page, (a) => Math.hypot(__vo.G.player.x - a.x, __vo.G.player.z - a.z) > 1.5, 'holding W moves the player', 30000, p0);
    await page.keyboard.up('KeyW');
    await page.keyboard.down('ArrowRight');
    await until(page, (a) => Math.abs(__vo.G.player.yaw - a.yaw) > 0.3, 'holding → turns', 30000, p0);
    await page.keyboard.up('ArrowRight');
    await page.keyboard.press('Space');
    await until(page, () => __vo.seen.jump >= 1, 'Space jumps');
    const fires = await Q(page, () => __vo.seen.fire || 0);
    await page.keyboard.down('ControlLeft');
    await until(page, (n) => (__vo.seen.fire || 0) > n, 'Ctrl fires (the press reaches a sim step)', 30000, fires);
    await page.keyboard.up('ControlLeft');
    await page.keyboard.press('KeyV');
    await until(page, () => __vo.seen.kick >= 1, 'V kicks');
    check(await Q(page, () => !document.getElementById('minimap').hidden && document.getElementById('minimap').width > 0), 'the minimap shows during play');
    await page.keyboard.press('KeyM');
    await until(page, () => document.getElementById('minimap').classList.contains('big'), 'M opens the big map');
    await shot(page, 'desktop-map');
    await page.keyboard.press('KeyM');
    await until(page, () => !document.getElementById('minimap').classList.contains('big'), 'M closes it again');
    await shot(page, 'desktop-play');

    await page.keyboard.press('Escape');
    await until(page, () => !document.getElementById('pause').hidden, 'Escape pauses');
    const t0 = await Q(page, () => __vo.G.t);
    await page.waitForTimeout(600);
    check(await Q(page, (t) => __vo.G.t === t, t0), 'the sim stops while paused');
    await page.keyboard.press('Space');                // Resume has focus: Space must press it (game-078)
    await until(page, () => document.getElementById('pause').hidden && __vo.mode === 'play', 'Space presses the focused Resume button');
    check(await Q(page, () => (__vo.seen.jump || 0) <= 2), 'and that Space did not also jump');

    // clear the level the quick way: the bot plays it, run ahead synchronously (SwiftShader is too slow to watch)
    await Q(page, () => { for (let k = 0; k < 20 && __vo.G.phase === 'play'; k++) __vo.ff(30); });
    await until(page, () => __vo.mode === 'tally' && !document.getElementById('tally').hidden, 'the level gets cleared and the tally shows', 60000);
    check(await Q(page, () => /CLEARED/.test(document.getElementById('tally-name').textContent) && document.getElementById('tally-rank').textContent.length > 0), 'the tally has a name and a rank');
    await shot(page, 'desktop-tally');
    await click(page, '#tally-next');
    await until(page, () => __vo.mode === 'brief' && __vo.G.level === 1 && document.getElementById('brief-name').textContent === 'GALLERIA OF DOOM', 'Next Level briefs level 2');
    await click(page, '#brief-go');
    await until(page, () => __vo.mode === 'play' && __vo.G.level === 1, 'level 2 starts');

    // death and CONTINUE?
    const gunsAtEntry = await Q(page, () => __vo.G.entry.weapons.length);
    await Q(page, () => { __vo.G.god = false; __vo.G.player.armor = 0; __vo.G.player.hp = 1; });
    await Q(page, () => { const p = __vo.G.player; __vo.G.proj.push({ id: 99999, x: p.x + 2, y: p.y + 1, z: p.z, vx: -20, vy: 0, vz: 0, owner: 'e', dmg: 50, kind: 'bolt', r: 0.3, life: 3, bounce: 0, homing: 0, splash: 0, splashFrac: 1, grav: 0 }); });
    await until(page, () => __vo.mode === 'dead', 'a hit at 1 HP kills Roxy');
    await until(page, () => !document.getElementById('dead').hidden, 'CONTINUE? appears', 30000);
    await shot(page, 'desktop-dead');
    await click(page, '#dead-go');
    await until(page, (n) => __vo.mode === 'brief' && __vo.G.phase === 'play' && __vo.G.player.hp >= 100 && __vo.G.player.weapons.length === n, 'Continue restarts the level with what you entered it with', 30000, gunsAtEntry);
    await click(page, '#brief-go');
    await until(page, () => __vo.mode === 'play', 'and play resumes');

    // save and quit, then continue
    await Q(page, () => { __vo.G.god = true; __vo.ff(3); });
    const where = await Q(page, () => ({ level: __vo.G.level, x: __vo.G.player.x }));
    await Q(page, () => document.querySelector('#btn-pause').click());
    await until(page, () => !document.getElementById('pause').hidden, 'the ❚❚ button pauses');
    await click(page, '#pause-menu [data-act="quit"]');
    await until(page, () => __vo.mode === 'title' && !document.getElementById('btn-continue').hidden, 'Save & Quit returns to the title with Continue');
    await click(page, '#title-menu [data-act="continue"]');
    await until(page, (w) => __vo.mode === 'brief' && __vo.G.level === w.level && Math.abs(__vo.G.player.x - w.x) < 0.01, 'Continue restores the saved game', 30000, where);
    reportErrors('desktop');
}

// ======================================================================
async function phone(w, h) {
    console.log(`\n== phone ${w}×${h} (touch only)`);
    const page = await open({ width: w, height: h }, { touch: true });
    const cdp = await page.context().newCDPSession(page);
    const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
    const tapSel = async (sel) => {
        const r = await Q(page, (s) => { const e = document.querySelector(s); e?.scrollIntoView({ block: 'center' }); const b = e?.getBoundingClientRect(); return b && { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, sel);
        if (!r) return false;
        await page.touchscreen.tap(r.x, r.y);
        return true;
    };
    const center = (sel) => Q(page, (s) => { const b = document.querySelector(s).getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, sel);

    check(await backLinkOk(page), '← Games link is on top');
    await tapSel('#title-menu [data-act="newgame"]');
    await until(page, () => !document.getElementById('newgame').hidden, 'a tap opens the difficulty picker');
    await tapSel('#diff-menu [data-diff="1"]');
    await until(page, () => __vo.mode === 'brief', 'a tap on a difficulty opens the briefing');
    await tapSel('#brief-go');
    await until(page, () => __vo.mode === 'play', 'a tap on Lock & Load starts play');
    await until(page, () => !document.getElementById('touch').hidden, 'the touch deck is shown');
    await Q(page, () => { __vo.G.god = true; for (const e of __vo.G.enemies) e.alert = false; });

    const L = await layout(page);
    check(L.noHScroll, 'no sideways scroll');
    check(L.canvas, 'the canvas matches the visible viewport');
    const sizes = await Q(page, () => ['#t-fire', '#t-jump', '#t-kick', '#t-reload', '#t-next', '#t-bomb', '#btn-pause'].map((s) => {
        const r = document.querySelector(s).getBoundingClientRect();
        return { s, ok: r.width >= 44 && r.height >= 44 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight };
    }));
    for (const z of sizes) check(z.ok, `${z.s} is at least 44 px and on screen`);
    const overlap = await Q(page, () => {
        const ids = ['#t-fire', '#t-jump', '#t-kick', '#t-reload', '#t-next', '#t-bomb'];
        const rs = ids.map((s) => document.querySelector(s).getBoundingClientRect());
        for (let a = 0; a < rs.length; a++) for (let b = a + 1; b < rs.length; b++) {
            const A = rs[a], B = rs[b];
            if (A.left < B.right - 2 && B.left < A.right - 2 && A.top < B.bottom - 2 && B.top < A.bottom - 2) return `${ids[a]} overlaps ${ids[b]}`;
        }
        return null;
    });
    check(!overlap, `touch buttons don't overlap${overlap ? ` (${overlap})` : ''}`);

    // the stick, with a real touch
    const zone = await Q(page, () => { const r = document.getElementById('stick-zone').getBoundingClientRect(); return { x: r.left + r.width * 0.4, y: r.top + r.height * 0.6 }; });
    const p0 = await Q(page, () => ({ x: __vo.G.player.x, z: __vo.G.player.z, yaw: __vo.G.player.yaw }));
    await touch('touchStart', [{ x: zone.x, y: zone.y, id: 1 }]);
    for (let i = 1; i <= 6; i++) await touch('touchMove', [{ x: zone.x, y: zone.y - i * 12, id: 1 }]);
    await until(page, (a) => Math.hypot(__vo.G.player.x - a.x, __vo.G.player.z - a.z) > 1, 'pushing the stick moves the player', 30000, p0);
    await touch('touchEnd', []);
    // the look pad
    const look = await Q(page, () => { const r = document.getElementById('look-zone').getBoundingClientRect(); return { x: r.left + r.width * 0.35, y: r.top + r.height * 0.4 }; });
    const yaw0 = await Q(page, () => __vo.G.player.yaw);
    await touch('touchStart', [{ x: look.x, y: look.y, id: 2 }]);
    for (let i = 1; i <= 6; i++) await touch('touchMove', [{ x: look.x + i * 15, y: look.y, id: 2 }]);
    await touch('touchEnd', []);
    await until(page, (a) => Math.abs(__vo.G.player.yaw - a) > 0.2, 'dragging the look pad turns', 30000, yaw0);
    // fire, jump, kick
    const fires = await Q(page, () => __vo.seen.fire || 0);
    const f = await center('#t-fire');
    await touch('touchStart', [{ x: f.x, y: f.y, id: 3 }]);
    await until(page, (n) => (__vo.seen.fire || 0) > n, 'holding FIRE fires', 30000, fires);
    await touch('touchEnd', []);
    await tapSel('#t-jump');
    await until(page, () => (__vo.seen.jump || 0) >= 1, 'tapping JUMP jumps');
    await tapSel('#t-kick');
    await until(page, () => (__vo.seen.kick || 0) >= 1, 'tapping KICK kicks');
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
    await click(page, '#title-menu [data-act="newgame"]');
    await click(page, '#diff-menu [data-diff="1"]');
    await click(page, '#brief-go');
    await until(page, () => __vo.mode === 'play', 'boots and starts a game with localStorage throwing');
    await Q(page, () => { __vo.G.god = true; __vo.ff(3); });
    check(await Q(page, () => __vo.save() === false), 'saving fails quietly');
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

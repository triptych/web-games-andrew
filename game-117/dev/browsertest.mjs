/**
 * browsertest.mjs — the real game in real Chromium (SwiftShader WebGL).
 *
 * desktop (1280×760): boot to the title with no errors, the ← Games link on top → New Mission by
 *   click → WASD walks the commander round the rock → Escape pauses and the sim stops → Space on
 *   the focused Resume button resumes → an arrow key fires → the mouse aims and its button fires →
 *   Space dashes → the ❚❚ button pauses → Save & Quit → Continue restores the mission → losing
 *   the last life shows the end screen → New Mission starts again. No sideways scroll; the canvas
 *   fills the window; the pause menu's Settings opens on top of it.
 * phones (touch only, real CDP touches) at 390×844 and 844×390: taps through the menus, the touch
 *   deck appears, the left stick walks, the right stick aims and fires, DASH dashes, controls
 *   ≥ 44 px and on screen, no sideways scroll, the canvas matches the visible viewport, the pause
 *   screen stays open after the finger lifts.
 * nostorage: localStorage throws; the game still boots and plays.
 * Fails on any console error, page error or failed request.
 *
 *   python3 -m http.server 8117          # from the REPO ROOT
 *   node game-117/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8117), ONLY=desktop,phones,nostorage, THREE_PKG.
 * The game opens with &q=0 (low graphics) so SwiftShader keeps up; play.mjs shows the real look.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8117';
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
    page.on('requestfailed', (r) => { if (!r.url().includes('favicon') && !r.url().includes('fonts.gstatic')) errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`); });
    await page.goto(`${BASE}/game-117/index.html?debug=1&fast=4&q=0`);
    await page.waitForFunction(() => window.__ph && __ph.mode === 'title', null, { timeout: 90000 });
    return page;
}

const check = (cond, msg) => { if (!cond) { fails++; console.log('  FAIL', msg); } else console.log('  ok', msg); return cond; };
const Q = (page, fn, arg) => page.evaluate(fn, arg);
const shot = async (page, name) => { try { await page.screenshot({ path: path.join(OUT, `bt-${name}.png`), timeout: 60000 }); } catch (e) { console.log('    (screenshot skipped:', e.message.split('\n')[0], ')'); } };
// SwiftShader draws a few frames a second: wait on state, never on the clock.
const until = (page, fn, msg, timeout = 60000, arg = null) =>
    page.waitForFunction(fn, arg, { timeout, polling: 150 }).then(() => check(true, msg), () => check(false, msg));
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
/** Keep the beacons and hangars quiet so a test of the controls isn't a fight. */
const calm = (page) => Q(page, () => { const G = __ph.G; G.enemies = []; G.spawnT = 1e9; for (const t of G.turrets) { t.cd = 1e9; t.alarmed = true; } G.player.inv = 1e9; __ph.skipIntro(); });
/** Great-circle distance walked since a position, in world units. */
const walked = (page, p0) => Q(page, (p) => { const G = __ph.G, q = G.player.p; return Math.acos(Math.min(1, p[0] * q[0] + p[1] * q[1] + p[2] * q[2])) * G.world.R; }, p0);

// ======================================================================
async function desktop() {
    console.log('\n== desktop 1280×760');
    const page = await open({ width: 1280, height: 760 });
    check(await backLinkOk(page), '← Games link is on top and points at ../index.html');
    check(await Q(page, () => !document.getElementById('title').hidden), 'title screen is up');
    check(await Q(page, () => document.getElementById('btn-continue').hidden), 'no Continue without a save');
    check(await Q(page, () => document.querySelectorAll('#over-title').length <= 1), 'no id collides with the a11y heading ids');
    const L = await layout(page);
    check(L.noHScroll && L.canvas, 'no sideways scroll; the canvas fills the window');
    check(await Q(page, () => { const l = document.querySelector('.logo'); return l.scrollWidth <= l.parentElement.clientWidth + 2; }), 'the logo fits on one line');
    await shot(page, 'desktop-title');

    await click(page, '#title-menu [data-act="new"]');
    await until(page, () => __ph.mode === 'play' && document.getElementById('title').hidden && !document.getElementById('hud').hidden, 'New Mission starts play with the HUD up');
    await until(page, () => __ph.G.world && __ph.view.world === __ph.G.world, 'the asteroid is built');
    await calm(page);

    const p0 = await Q(page, () => __ph.G.player.p.slice());
    await page.keyboard.down('KeyW');
    await until(page, (p) => { const q = __ph.G.player.p; return Math.acos(Math.min(1, p[0] * q[0] + p[1] * q[1] + p[2] * q[2])) * __ph.G.world.R > 1.2; }, 'holding W walks the commander across the rock', 60000, p0);
    await page.keyboard.up('KeyW');
    check(await Q(page, () => { const P = __ph.G.player; return Math.abs(Math.hypot(...P.p) - 1) < 1e-6 && Math.abs(P.p[0] * P.f[0] + P.p[1] * P.f[1] + P.p[2] * P.f[2]) < 1e-6; }), 'the commander stays on the surface with a tangent frame');

    await page.keyboard.press('Escape');
    await until(page, () => !document.getElementById('pause').hidden, 'Escape pauses');
    const t0 = await Q(page, () => __ph.G.t);
    await page.waitForTimeout(800);
    check(await Q(page, (t) => __ph.G.t === t, t0), 'the sim stops while paused');
    await click(page, '#pause-menu [data-act="settings"]');
    await until(page, () => !document.getElementById('settings').hidden, 'Settings opens from the pause menu');
    check(await Q(page, () => {
        const s = document.getElementById('settings').getBoundingClientRect();
        const top = document.elementFromPoint(s.left + s.width / 2, s.top + s.height / 2);
        return document.getElementById('settings').contains(top);
    }), 'and sits on top of it');
    await page.keyboard.press('Escape');
    await until(page, () => document.getElementById('settings').hidden && !document.getElementById('pause').hidden, 'Escape closes Settings back to the pause menu');
    await Q(page, () => document.querySelector('#pause-menu [data-act="resume"]').focus());
    await page.keyboard.press('Space');
    await until(page, () => document.getElementById('pause').hidden, 'Space on the focused Resume button resumes (a real key press)');
    await until(page, (t) => __ph.G.t > t, 'and the sim runs again', 60000, t0);
    const dashes0 = await Q(page, () => __ph.seen.dash || 0);
    check(dashes0 === 0, 'the Space that pressed Resume did not also dash');

    const shots0 = await Q(page, () => __ph.seen.shot || 0);
    await page.keyboard.press('ArrowLeft');
    await until(page, (n) => (__ph.seen.shot || 0) > n, 'a tap on an arrow key fires (the press reaches a sim step)', 60000, shots0);

    // mouse: aim at a point on the rock and hold the button
    const shots1 = await Q(page, () => __ph.seen.shot || 0);
    await page.mouse.move(980, 380);
    await page.mouse.down();
    await until(page, (n) => (__ph.seen.shot || 0) > n + 1, 'holding the mouse button fires', 60000, shots1);
    await page.mouse.up();
    check(await Q(page, () => {
        const P = __ph.G.player, r = [P.f[1] * P.p[2] - P.f[2] * P.p[1], P.f[2] * P.p[0] - P.f[0] * P.p[2], P.f[0] * P.p[1] - P.f[1] * P.p[0]];
        return P.aim[0] * r[0] + P.aim[1] * r[1] + P.aim[2] * r[2] > 0.5;
    }), 'the mouse to the right of the commander aims right');

    await page.keyboard.press('Space');
    await until(page, () => (__ph.seen.dash || 0) >= 1, 'Space dashes');
    await shot(page, 'desktop-play');

    await Q(page, () => { __ph.G.player.inv = 0; __ph.ff(6); });
    const score = await Q(page, () => __ph.G.score);
    await Q(page, () => document.querySelector('#btn-pause').click());
    await until(page, () => !document.getElementById('pause').hidden, 'the ❚❚ button pauses');
    await click(page, '#pause-menu [data-act="quit"]');
    await until(page, () => __ph.mode === 'title' && !document.getElementById('btn-continue').hidden, 'Save & Quit returns to the title with Continue');
    await click(page, '#title-menu [data-act="continue"]');
    await until(page, (s) => __ph.mode === 'play' && __ph.G.score === s, 'Continue restores the saved mission', 60000, score);
    check(await Q(page, () => __ph.G.world.walls.length > 0 && __ph.G.turrets.length > 0), 'with its asteroid rebuilt from the seed');

    // lose the last life
    await Q(page, () => {
        const G = __ph.G, P = G.player;
        G.lives = 1; P.hp = 1; P.inv = 0; P.dashT = 0; G.phase = 'play';
        const c = Math.cos(0.3 / G.world.R), s = Math.sin(0.3 / G.world.R);
        const p = P.p.map((x, i) => x * c + P.f[i] * s);
        G.bullets.push({ p, d: P.f.map((x) => -x), spd: 5, life: 2, own: 0, dmg: 50, r: 0.3 });
    });
    await until(page, () => __ph.mode === 'over' && !document.getElementById('over').hidden, 'losing the last life shows the end screen');
    check(await Q(page, () => document.getElementById('over-head').textContent === 'MISSION LOST'), 'which says the mission is lost');
    await shot(page, 'desktop-over');
    await click(page, '#over-again');
    await until(page, () => __ph.mode === 'play' && __ph.G.t < 5 && __ph.G.level === 0, 'New Mission starts again');
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

    check(await backLinkOk(page), '← Games link is on top');
    await tapSel('#title-menu [data-act="new"]');
    await until(page, () => __ph.mode === 'play', 'a tap on New Mission starts play');
    await until(page, () => !document.getElementById('touch').hidden, 'the touch deck is shown');
    await until(page, () => __ph.G.world && __ph.view.world === __ph.G.world, 'the asteroid is built');
    await calm(page);

    const L = await layout(page);
    check(L.noHScroll, 'no sideways scroll');
    check(L.canvas, 'the canvas matches the visible viewport');
    const sizes = await Q(page, () => ['#btn-dash', '#btn-pause'].map((s) => {
        const r = document.querySelector(s).getBoundingClientRect();
        return { s, ok: r.width >= 44 && r.height >= 44 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight };
    }));
    for (const z of sizes) check(z.ok, `${z.s} is at least 44 px and on screen`);
    check(await Q(page, () => {
        const a = document.getElementById('hud-level').getBoundingClientRect(), b = document.getElementById('back-link').getBoundingClientRect();
        return a.left >= b.right - 1 || a.top >= b.bottom - 1;
    }), 'the HUD clears the ← Games link');

    // walk with the left stick
    const zone = await Q(page, () => { const r = document.getElementById('stick-zone').getBoundingClientRect(); return { x: r.left + r.width * 0.45, y: r.top + r.height * 0.5 }; });
    const p0 = await Q(page, () => __ph.G.player.p.slice());
    await touch('touchStart', [{ x: zone.x, y: zone.y, id: 1 }]);
    for (let i = 1; i <= 6; i++) await touch('touchMove', [{ x: zone.x, y: zone.y - i * 12, id: 1 }]);
    await until(page, (p) => { const q = __ph.G.player.p; return Math.acos(Math.min(1, p[0] * q[0] + p[1] * q[1] + p[2] * q[2])) * __ph.G.world.R > 1; }, 'dragging the left stick walks', 60000, p0);
    await touch('touchEnd', []);
    // aim and fire with the right stick
    const az = await Q(page, () => { const r = document.getElementById('aim-zone').getBoundingClientRect(); return { x: r.left + r.width * 0.5, y: r.top + r.height * 0.5 }; });
    const shots0 = await Q(page, () => __ph.seen.shot || 0);
    await touch('touchStart', [{ x: az.x, y: az.y, id: 2 }]);
    for (let i = 1; i <= 6; i++) await touch('touchMove', [{ x: az.x + i * 12, y: az.y, id: 2 }]);
    await until(page, (n) => (__ph.seen.shot || 0) > n, 'dragging the right stick aims and fires', 60000, shots0);
    await touch('touchEnd', []);

    const dashes = await Q(page, () => __ph.seen.dash || 0);
    await tapSel('#btn-dash');
    await until(page, (n) => (__ph.seen.dash || 0) > n, 'tapping DASH dashes', 60000, dashes);
    await shot(page, `phone-${w}x${h}`);

    await tapSel('#btn-pause');
    await until(page, () => !document.getElementById('pause').hidden, 'tapping ❚❚ pauses');
    await page.waitForTimeout(400);
    check(await Q(page, () => !document.getElementById('pause').hidden), 'the pause screen stays open after the finger lifts');
    check(await Q(page, () => [...document.querySelectorAll('#pause .btn')].every((b) => { const r = b.getBoundingClientRect(); return r.height >= 44 && r.top >= 0 && r.bottom <= innerHeight; })), 'the pause menu fits on screen with 44 px buttons');
    await tapSel('#pause-menu [data-act="resume"]');
    await until(page, () => document.getElementById('pause').hidden, 'a tap on Resume closes it');
    reportErrors(`phone ${w}×${h}`);
}

// ======================================================================
async function nostorage() {
    console.log('\n== blocked storage');
    const page = await open({ width: 1280, height: 760 }, { nostorage: true });
    await click(page, '#title-menu [data-act="new"]');
    await until(page, () => __ph.mode === 'play', 'boots and starts a mission with localStorage throwing');
    await Q(page, () => __ph.ff(3));
    check(await Q(page, () => __ph.save() === false), 'saving fails quietly');
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

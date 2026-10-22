/**
 * browsertest.mjs — the real game in real Chromium (SwiftShader WebGL).
 *
 * desktop (1280×760): boot to the title with no errors, the ← Games link on top → New Run by
 *   click → real keys: Space spins, → selects a reel, ↑ nudges it, Space fires and the enemies
 *   answer → Escape pauses and actions wait → Space on the focused Resume button resumes →
 *   C opens the Constellation to look and Escape closes it → a won fight shows Salvage, a card
 *   adds a symbol, a star is lit with Ignite, Continue moves on → Save & Quit → Continue restores
 *   the run → the run ends → New Run. No sideways scroll; the canvas fills the window.
 * phones (touch only, real CDP touches) at 390×844 and 844×390: taps through the menus, the bar
 *   and enemy tags appear, every control is at least 44 px and on screen, SPIN by tap, a tap on a
 *   reel selects it, a swipe up nudges it, FIRE by tap, ❚❚ pauses and stays open after the finger
 *   lifts, a Salvage card and a star by tap. No sideways scroll; the canvas matches the viewport.
 * nostorage: localStorage throws; the game still boots and plays.
 * Fails on any console error, page error or failed request.
 *
 *   python3 -m http.server 8091          # from the REPO ROOT
 *   node game-091/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8091), ONLY=desktop,phones,nostorage, THREE_PKG.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8091';
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
    await page.goto(`${BASE}/game-091/index.html?debug=1&fast=4`);
    await page.waitForFunction(() => window.__ss && __ss.mode === 'title', null, { timeout: 60000 });
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
const settled = (page) => page.waitForFunction(() => __ss.idle() && !__ss.pending, null, { timeout: 40000, polling: 100 });
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
/** The bot plays until `cond(G)` is true. */
const ffTo = (page, cond) => Q(page, (c) => __ss.ff(1e6, new Function('g', 'return ' + c)), cond);

// ======================================================================
async function desktop() {
    console.log('\n== desktop 1280×760');
    const page = await open({ width: 1280, height: 760 });
    check(await backLinkOk(page), '← Games link is on top and points at ../index.html');
    check(await Q(page, () => !document.getElementById('title').hidden), 'title screen is up');
    check(await Q(page, () => document.getElementById('btn-continue').hidden), 'no Continue without a save');
    let L = await layout(page);
    check(L.noHScroll && L.canvas, 'no sideways scroll; the canvas fills the window');
    await shot(page, 'desktop-title');

    await click(page, '#title-menu [data-act="new"]');
    await until(page, () => __ss.mode === 'play' && document.getElementById('title').hidden && !document.getElementById('bar').hidden, 'New Run starts a fight');
    await settled(page);
    check(await Q(page, () => document.querySelectorAll('#foes .foe').length === __ss.G.b.enemies.length), 'every enemy has a tag');

    await page.keyboard.press('Space');
    await until(page, () => __ss.G.b.spun && __ss.seen.spin >= 1, 'Space spins the reels');
    await settled(page);
    await page.keyboard.press('ArrowRight');
    await until(page, () => __ss.ui.sel === 1, '→ selects the second reel');
    const e0 = await Q(page, () => __ss.G.b.energy + (__ss.G.b.free ? 1 : 0));
    await page.keyboard.press('ArrowUp');
    await until(page, (e) => __ss.seen.nudge >= 1 && __ss.G.b.energy + (__ss.G.b.free ? 1 : 0) === e - 1, '↑ nudges it for 1 Energy', 40000, e0);
    await settled(page);
    check(await Q(page, () => document.getElementById('preview').textContent.trim().length > 0), 'the bar previews what the payline will do');
    await shot(page, 'desktop-spun');
    await page.keyboard.press('Space');
    await until(page, () => __ss.seen.fire >= 1, 'Space fires');
    await until(page, () => (__ss.seen.eturn >= 1 || __ss.G.phase !== 'battle') && __ss.idle(), 'and the enemies answer');

    await page.keyboard.press('Escape');
    await until(page, () => !document.getElementById('pause').hidden, 'Escape pauses');
    const spun = await Q(page, () => __ss.G.b?.spun);
    await page.keyboard.press('KeyR');
    await page.waitForTimeout(400);
    check(await Q(page, (s) => __ss.G.b?.spun === s && !__ss.pending, spun), 'keys do nothing while paused');
    // Space on the focused Resume button must press it (game-078)
    await Q(page, () => document.querySelector('#pause-menu [data-act="resume"]').focus());
    await page.keyboard.press('Space');
    await until(page, () => document.getElementById('pause').hidden, 'Space on the focused Resume button resumes');

    if (await Q(page, () => __ss.G.phase === 'battle')) {
        await page.keyboard.press('KeyC');
        await until(page, () => !document.getElementById('tree').hidden && __ss.ui.treeView, 'C opens the Constellation to look at');
        await page.keyboard.press('Escape');
        await until(page, () => document.getElementById('tree').hidden, 'Escape closes it');
    }

    // win the fight and spend the rewards by clicking
    await ffTo(page, "g.phase === 'reward'");
    await until(page, () => !document.getElementById('reward').hidden && document.querySelectorAll('#reward-cards .card').length === 3, 'a won fight shows three Salvage cards');
    await shot(page, 'desktop-reward');
    const len0 = await Q(page, () => __ss.G.p.reels[0].length);
    await click(page, '#reward-cards .card');
    await until(page, (n) => __ss.G.p.reels[0].length === n + 1 && !document.getElementById('tree').hidden, 'a card adds a symbol to the reels and the Constellation opens', 40000, len0);
    const lit0 = await Q(page, () => __ss.G.tree.lit.length);
    await click(page, '#tree-map .node.open');
    await click(page, '#tree-light');
    await until(page, (n) => __ss.G.tree.lit.length === n + 1, 'Ignite lights the chosen star', 40000, lit0);
    await shot(page, 'desktop-tree');
    await until(page, () => !document.getElementById('tree').hidden, 'the Constellation stays open to look at');
    await click(page, '#tree-leave');
    await until(page, () => __ss.G.phase !== 'tree' && document.getElementById('tree').hidden, 'Continue moves on');
    await settled(page);

    await Q(page, () => document.querySelector('#btn-pause').click());
    await until(page, () => !document.getElementById('pause').hidden, 'the ❚❚ button pauses');
    const where = await Q(page, () => `${__ss.G.sector}:${__ss.G.stop}:${__ss.G.tree.lit.length}:${__ss.G.p.reels[0].length}`);
    await click(page, '#pause-menu [data-act="quit"]');
    await until(page, () => __ss.mode === 'title' && !document.getElementById('btn-continue').hidden, 'Save & Quit returns to the title with Continue');
    await click(page, '#title-menu [data-act="continue"]');
    await until(page, (w) => __ss.mode === 'play' && `${__ss.G.sector}:${__ss.G.stop}:${__ss.G.tree.lit.length}:${__ss.G.p.reels[0].length}` === w, 'Continue restores the run', 40000, where);

    await ffTo(page, 'g.over');
    await until(page, () => __ss.mode === 'over' && !document.getElementById('over').hidden, 'the run ends and shows its stats');
    await shot(page, 'desktop-over');
    check(await Q(page, () => document.getElementById('btn-continue').hidden || !__ss.hasSave()), 'a finished run leaves no save');
    await click(page, '#over-again');
    await until(page, () => __ss.mode === 'play' && __ss.G.stop === 0 && __ss.G.sector === 0, 'New Run starts again');
    L = await layout(page);
    check(L.noHScroll && L.canvas, 'still no sideways scroll');
    reportErrors('desktop');
}

// ======================================================================
async function phone(w, h) {
    console.log(`\n== phone ${w}×${h} (touch only)`);
    const page = await open({ width: w, height: h }, { touch: true });
    const cdp = await page.context().newCDPSession(page);
    const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
    const centre = (sel) => Q(page, (s) => { const e = document.querySelector(s); const b = e?.getBoundingClientRect(); return b && b.width ? { x: b.left + b.width / 2, y: b.top + b.height / 2 } : null; }, sel);
    const tapSel = async (sel) => {
        await Q(page, (s) => document.querySelector(s)?.scrollIntoView({ block: 'center' }), sel);
        const r = await centre(sel);
        if (!r) return false;
        await page.touchscreen.tap(r.x, r.y);
        return true;
    };

    check(await backLinkOk(page), '← Games link is on top');
    await tapSel('#title-menu [data-act="new"]');
    await until(page, () => __ss.mode === 'play' && !document.getElementById('bar').hidden, 'a tap on New Run starts a fight');
    await settled(page);

    const L = await layout(page);
    check(L.noHScroll, 'no sideways scroll');
    check(L.canvas, 'the canvas matches the visible viewport');

    const sizes = await Q(page, () => ['#btn-go', '#btn-up', '#btn-respin', '#btn-down', '#btn-pause', '#btn-tree', '#foes .foe', '#reels .reel-hit'].map((s) => {
        const r = document.querySelector(s).getBoundingClientRect();
        return { s, ok: r.width >= 44 && r.height >= 44 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5, r: [r.left, r.top, r.width, r.height].map(Math.round) };
    }));
    for (const z of sizes) check(z.ok, `${z.s} is at least 44 px and on screen ${z.ok ? '' : JSON.stringify(z.r)}`);
    // the enemy tags and the reels sit inside the band between the HUD and the bar
    const band = await Q(page, () => {
        const bar = document.getElementById('bar').getBoundingClientRect();
        const reels = [...document.querySelectorAll('#reels .reel-hit')].map((e) => e.getBoundingClientRect());
        const tags = [...document.querySelectorAll('#foes .foe')].map((e) => e.getBoundingClientRect());
        return reels.every((r) => r.bottom <= bar.top + 2 && r.top >= 40) && tags.every((t) => t.top >= 40 && t.bottom <= bar.top);
    });
    check(band, 'the reels and the enemy tags sit between the HUD and the bar');

    await tapSel('#btn-go');
    await until(page, () => __ss.G.b.spun, 'tapping SPIN spins');
    await settled(page);
    await tapSel('#reels .reel-hit:nth-child(2)');
    await until(page, () => __ss.ui.sel === 1, 'a tap on the second reel selects it');
    // a swipe up on a reel nudges it
    const r1 = await centre('#reels .reel-hit:nth-child(2)');
    const n0 = await Q(page, () => __ss.seen.nudge || 0);
    await touch('touchStart', r1.x, r1.y + 20);
    for (let i = 1; i <= 5; i++) await touch('touchMove', r1.x, r1.y + 20 - i * 12);
    await touch('touchEnd', 0, 0);
    await until(page, (n) => (__ss.seen.nudge || 0) > n, 'a swipe up on a reel nudges it', 40000, n0);
    await settled(page);
    await shot(page, `phone-${w}x${h}`);
    await tapSel('#btn-go');
    await until(page, () => __ss.seen.fire >= 1, 'tapping FIRE fires');
    await settled(page);

    await tapSel('#btn-pause');
    await until(page, () => !document.getElementById('pause').hidden, 'tapping ❚❚ pauses');
    await page.waitForTimeout(300);
    check(await Q(page, () => !document.getElementById('pause').hidden), 'the pause screen stays open after the finger lifts');
    await tapSel('#pause-menu [data-act="resume"]');
    await until(page, () => document.getElementById('pause').hidden, 'a tap on Resume closes it');

    await ffTo(page, "g.phase === 'reward'");
    await until(page, () => !document.getElementById('reward').hidden, 'Salvage opens after a win');
    await shot(page, `phone-${w}x${h}-reward`);
    await tapSel('#reward-cards .card:nth-child(2)');
    await until(page, () => !document.getElementById('tree').hidden, 'a tapped card opens the Constellation');
    await settled(page);
    const ok44 = await Q(page, () => [...document.querySelectorAll('#tree-map .node')].every((n) => { const r = n.getBoundingClientRect(); return r.width >= 44 && r.height >= 44; }));
    check(ok44, 'every star is at least 44 px');
    const lit0 = await Q(page, () => __ss.G.tree.lit.length);
    await tapSel('#tree-map .node.open');
    await tapSel('#tree-light');
    await until(page, (n) => __ss.G.tree.lit.length === n + 1, 'a star lit by touch', 40000, lit0);
    await shot(page, `phone-${w}x${h}-tree`);
    await tapSel('#tree-leave');
    await until(page, () => __ss.G.phase !== 'tree', 'Continue by touch');
    reportErrors(`phone ${w}×${h}`);
}

// ======================================================================
async function nostorage() {
    console.log('\n== blocked storage');
    const page = await open({ width: 1280, height: 760 }, { nostorage: true });
    await click(page, '#title-menu [data-act="new"]');
    await until(page, () => __ss.mode === 'play', 'boots and starts a run with localStorage throwing');
    await Q(page, () => __ss.ff(30));
    check(await Q(page, () => __ss.save() === false), 'saving fails quietly');
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

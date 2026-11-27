/**
 * browsertest.mjs — the real game in real Chromium (SwiftShader WebGL).
 *
 * desktop (1280×760): boot to the title with no errors, the ← Games link on top → New Run by click → real keys
 *   steer, fire, jump and launch a missile → Escape pauses and the sim stops → Resume → M mutes → the ❚❚ button
 *   pauses → Save & Quit → Continue restores the run → the sector is cleared and the dock opens → Launch starts
 *   sector 2 → the Skill Tree buys a rank with cores and Escape closes it → the run ends and the summary shows →
 *   Run Again. Music and clips decode and the master bus makes sound. The canvas is not blank.
 * phones (touch only, real CDP touches) at 390×844 and 844×390: taps through the menus, the touch deck appears,
 *   the stick steers, JUMP and MSL work, every control ≥ 44 px, on screen and not covered, no sideways scroll, the
 *   canvas matches the visible viewport, the pause sheet stays open after the finger lifts.
 * nostorage: localStorage throws; the game still boots and plays.
 * Fails on any console error, page error or failed request.
 *
 *   python3 -m http.server 8152          # from the REPO ROOT
 *   node game-152/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8152), ONLY=desktop,phones,nostorage, THREE_PKG.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8152';
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
    await page.goto(`${BASE}/game-152/index.html?debug=1&fast=4`);
    await page.waitForFunction(() => window.__hrs && __hrs.mode === 'title', null, { timeout: 60000 });
    return page;
}

const check = (cond, msg) => { if (!cond) { fails++; console.log('  FAIL', msg); } else console.log('  ok', msg); return cond; };
const Q = (page, fn, arg) => page.evaluate(fn, arg);
const shot = async (page, name) => { await page.screenshot({ path: path.join(OUT, `bt-${name}.png`) }); };
const until = (page, fn, msg, timeout = 30000, arg = null) =>
    page.waitForFunction(fn, arg, { timeout, polling: 100 }).then(() => check(true, msg), () => check(false, msg));
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
/** Read the rendered frame back: fail if it is one flat colour. */
const notBlank = (page) => Q(page, () => {
    const v = __hrs.view;
    v.renderer.render(v.scene, v.camera);
    const gl = v.renderer.getContext();
    const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
    const px = new Uint8Array(4);
    const seen = new Set();
    for (let i = 0; i < 64; i++) {
        gl.readPixels(Math.floor(((i % 8) + 0.5) * w / 8), Math.floor((Math.floor(i / 8) + 0.5) * h / 8), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
        seen.add((px[0] >> 4) + ',' + (px[1] >> 4) + ',' + (px[2] >> 4));
    }
    return seen.size;
});
const reportErrors = (label) => { check(errors.length === 0, `${label}: no console errors, page errors or failed requests`); for (const e of errors.slice(0, 8)) console.log('    ', e); };

// ======================================================================
async function desktop() {
    console.log('\n== desktop 1280×760');
    const page = await open({ width: 1280, height: 760 });
    check(await backLinkOk(page), '← Games link is on top and points at ../index.html');
    check(await visible(page, 'title'), 'title screen is up');
    check(await Q(page, () => document.getElementById('btn-continue').hidden), 'no Continue without a save');
    const L = await layout(page);
    check(L.noHScroll && L.canvas, 'no sideways scroll; the canvas fills the window');
    await shot(page, 'desktop-title');

    // keyboard focus walks the title menu and Space presses a button (game-078)
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Space');
    await until(page, () => __hrs.mode === 'play' && document.getElementById('title').hidden, 'Space on the focused New Run starts a run');
    await until(page, () => __hrs.G.t > 0.5, 'the sim runs');
    check(await notBlank(page) > 6, 'the river is drawn (the frame is not one flat colour)');

    const x0 = await Q(page, () => __hrs.G.boat.x);
    await page.keyboard.down('ArrowRight');
    await until(page, (x) => __hrs.G.boat.x > x + 2, 'holding → steers right', 30000, x0);
    await page.keyboard.up('ArrowRight');
    await page.keyboard.down('KeyJ');
    await until(page, () => (__hrs.seen.shoot || 0) >= 3, 'holding J fires the cannons');
    await page.keyboard.up('KeyJ');
    await page.keyboard.press('Space');
    await until(page, () => (__hrs.seen.jump || 0) >= 1, 'Space jumps (the press reaches a sim step)');
    await page.keyboard.press('KeyK');
    await until(page, () => (__hrs.seen.missile || 0) >= 1, 'K launches a missile');

    await page.keyboard.press('Escape');
    await until(page, () => !document.getElementById('pause').hidden, 'Escape pauses');
    const t0 = await Q(page, () => __hrs.G.t);
    await page.waitForTimeout(500);
    check(await Q(page, (t) => __hrs.G.t === t, t0), 'the sim stops while paused');
    await page.keyboard.press('Escape');
    await until(page, (t) => document.getElementById('pause').hidden && __hrs.G.t > t, 'Escape again resumes and the sim runs', 30000, t0);

    await page.keyboard.press('KeyM');
    await until(page, () => __hrs.audio.muted === true, 'M mutes');
    await page.keyboard.press('KeyM');
    await until(page, () => __hrs.audio.muted === false, 'and M again unmutes');
    await until(page, () => __hrs.audio.loaded >= 30, 'the effects and voices decode', 30000);
    await until(page, () => __hrs.audio.playing(), 'the river music plays');
    await until(page, () => __hrs.audio.peak() > 0.01, 'sound comes out of the master bus', 20000);

    await shot(page, 'desktop-play');
    const score = await Q(page, () => { __hrs.ff(8); return __hrs.G.score; });
    await Q(page, () => document.querySelector('#btn-pause').click());
    await until(page, () => !document.getElementById('pause').hidden, 'the ❚❚ button pauses');
    await click(page, '#pause-menu [data-act="quit"]');
    await until(page, () => __hrs.mode === 'title' && !document.getElementById('btn-continue').hidden, 'Save & Quit returns to the title with Continue');
    check(await Q(page, () => __hrs.meta.cores > 0), 'quitting banks the cores earned');
    await click(page, '#title-menu [data-act="continue"]');
    await until(page, (s) => __hrs.mode === 'play' && __hrs.G.score === s, 'Continue restores the saved run', 30000, score);

    // clear the sector with the bot → the dock
    await Q(page, () => { for (let i = 0; i < 400 && __hrs.G.phase !== 'dock' && !__hrs.G.over; i++) { __hrs.G.boat.hull = __hrs.G.stats.maxHull; __hrs.ff(1); } });
    await until(page, () => __hrs.mode === 'dock' && !document.getElementById('dock').hidden, 'beating the sector boss opens the dock', 60000);
    await shot(page, 'desktop-dock');
    // the skill tree from the dock: buy a rank with real clicks
    await Q(page, () => __hrs.give(200));
    await click(page, '#dock-menu [data-act="skills"]');
    await until(page, () => !document.getElementById('skills').hidden, 'the dock opens the Skill Tree');
    const before = await Q(page, () => __hrs.meta.cores);
    const r = await Q(page, () => { const b = document.querySelector('.node[data-id="hull"]'); const q = b.getBoundingClientRect(); return { x: q.left + q.width / 2, y: q.top + q.height / 2 }; });
    await page.mouse.click(r.x, r.y);
    await until(page, (c) => __hrs.meta.ranks.hull === 1 && __hrs.meta.cores < c, 'clicking Reinforced Hull buys rank I with cores', 30000, before);
    await shot(page, 'desktop-skills');
    const foot = await Q(page, () => { const s = document.querySelector('#skills .sheet'); s.scrollTop = 1e6; const f = s.querySelector('.sheet-foot').getBoundingClientRect(); return f.bottom <= innerHeight + 1 && f.top > 0; });
    check(foot, 'the Skill Tree foot (Done) stays on screen when scrolled');
    await page.keyboard.press('Escape');
    await until(page, () => document.getElementById('skills').hidden && !document.getElementById('dock').hidden, 'Escape closes the Skill Tree back to the dock');
    await click(page, '#dock-menu [data-act="launch"]');
    await until(page, () => __hrs.mode === 'play' && __hrs.G.sector === 1 && __hrs.G.stats.maxHull === 120, 'Launch starts sector 2 with the new skill');

    // the run ends
    await Q(page, () => { __hrs.G.boat.hull = 1; __hrs.G.boat.fuel = 0; });
    await until(page, () => __hrs.mode === 'over', 'an empty tank finally sinks the boat', 60000);
    await until(page, () => !document.getElementById('over').hidden, 'the run summary shows', 30000);
    check(await Q(page, () => document.getElementById('over-text').textContent.includes('ran out of fuel')), 'and says how the run ended');
    await shot(page, 'desktop-over');
    await click(page, '#over-again');
    await until(page, () => __hrs.mode === 'play' && __hrs.G.t < 5 && __hrs.G.sector === 0, 'Run Again starts a fresh run');
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
    await until(page, () => __hrs.mode === 'play', 'a tap on New Run starts a run');
    await until(page, () => !document.getElementById('touch').hidden, 'the touch deck is shown');
    check(await Q(page, () => __hrs.input.autoFire), 'auto-fire is on for touch');

    const L = await layout(page);
    check(L.noHScroll, 'no sideways scroll');
    check(L.canvas, 'the canvas matches the visible viewport');

    const sizes = await Q(page, () => ['#btn-jump', '#btn-missile', '#btn-fire', '#btn-pause', '#btn-mute'].map((s) => {
        const e = document.querySelector(s), r = e.getBoundingClientRect();
        const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return { s, ok: r.width >= 44 && r.height >= 44 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight, free: top === e || e.contains(top) };
    }));
    for (const z of sizes) { check(z.ok, `${z.s} is at least 44 px and on screen`); check(z.free, `${z.s} is not covered by anything`); }
    const gaugesClear = await Q(page, () => {
        const g = document.getElementById('hud-gauges').getBoundingClientRect();
        return ['#btn-jump', '#btn-missile', '#btn-fire'].every((s) => { const r = document.querySelector(s).getBoundingClientRect(); return r.left >= g.right || r.bottom <= g.top || r.top >= g.bottom; });
    });
    check(gaugesClear, 'the gauges do not sit under the touch buttons');

    const zone = await Q(page, () => { const r = document.getElementById('stick-zone').getBoundingClientRect(); return { x: r.left + r.width * 0.4, y: r.top + r.height * 0.5 }; });
    const x0 = await Q(page, () => __hrs.G.boat.x);
    await touch('touchStart', zone.x, zone.y);
    for (let i = 1; i <= 6; i++) await touch('touchMove', zone.x + i * 12, zone.y);
    await until(page, (x) => __hrs.G.boat.x > x + 1, 'dragging the stick steers', 30000, x0);
    await touch('touchEnd', 0, 0);

    const jumps = await Q(page, () => __hrs.seen.jump || 0);
    await Q(page, () => { __hrs.G.boat.charge = __hrs.G.stats.charges; });
    await tapSel('#btn-jump');
    await until(page, (n) => (__hrs.seen.jump || 0) > n, 'tapping JUMP jumps', 30000, jumps);
    const msl = await Q(page, () => __hrs.seen.missile || 0);
    await tapSel('#btn-missile');
    await until(page, (n) => (__hrs.seen.missile || 0) > n, 'tapping MSL launches a missile', 30000, msl);
    await until(page, () => (__hrs.seen.shoot || 0) > 5, 'auto-fire shoots');
    await shot(page, `phone-${w}x${h}`);

    await tapSel('#btn-pause');
    await until(page, () => !document.getElementById('pause').hidden, 'tapping ❚❚ pauses');
    await page.waitForTimeout(300);
    check(await Q(page, () => !document.getElementById('pause').hidden), 'the pause screen stays open after the finger lifts');
    await tapSel('#pause-menu [data-act="skills"]');
    await until(page, () => !document.getElementById('skills').hidden, 'the Skill Tree opens from pause');
    const foot = await Q(page, () => { const s = document.querySelector('#skills .sheet'); const f = s.querySelector('.sheet-foot').getBoundingClientRect(); return f.bottom <= innerHeight + 1 && f.top > 0; });
    check(foot, 'its Done button is on screen without scrolling');
    await shot(page, `phone-skills-${w}x${h}`);
    await tapSel('#skills [data-close]');
    await until(page, () => document.getElementById('skills').hidden, 'Done closes it');
    await tapSel('#pause-menu [data-act="resume"]');
    await until(page, () => document.getElementById('pause').hidden, 'a tap on Resume closes the pause screen');
    reportErrors(`phone ${w}×${h}`);
}

// ======================================================================
async function nostorage() {
    console.log('\n== blocked storage');
    const page = await open({ width: 1280, height: 760 }, { nostorage: true });
    await click(page, '#title-menu [data-act="new"]');
    await until(page, () => __hrs.mode === 'play', 'boots and starts a run with localStorage throwing');
    await Q(page, () => __hrs.ff(3));
    check(await Q(page, () => __hrs.save() === false), 'saving fails quietly');
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

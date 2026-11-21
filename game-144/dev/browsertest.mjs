/**
 * browsertest.mjs — the real game in real Chromium (SwiftShader WebGL).
 *
 * desktop (1280×760): boots to the title with no errors, ← Games on top → Story → pilot select by click →
 *   Launch → the opening cutscene shows its art, a portrait and voiced text; Enter advances, Escape skips →
 *   play: real keys move the ship, Shift focuses, X bombs, Space fires Burst when full, C warps; Escape pauses
 *   and the sim stops; Space on Resume resumes (game-078) → Save & Quit → Continue restores the run →
 *   the HUD shows boss bar on a boss → game over → Continue → results → title. Music plays (an <audio> is running)
 *   and sound comes out (meter peak > 0). Pixels are not blank. No sideways scroll; the canvas fills the window.
 * survival: starts from the title and reaches wave 2.
 * phones (touch only, real CDP touches) at 390×844 and 844×390: taps through the menus, skip a scene by tapping,
 *   the deck is shown, the stick moves the ship, BOMB bombs, FOCUS holds focus, controls ≥ 44 px and on screen.
 * nostorage: localStorage throws; the game boots and plays.
 * Fails on any console error, page error or failed request.
 *
 *   python3 -m http.server 8144          # from the REPO ROOT
 *   node game-144/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8144), ONLY=desktop,survival,phones,nostorage, THREE_PKG.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8144';
const OUT = path.join(HERE, 'shots');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const want = (name) => !ONLY.length || ONLY.includes(name);
fs.mkdirSync(OUT, { recursive: true });

let fails = 0;
let errors = [];
let browser = null;

async function open(viewport, { touch = false, nostorage = false, q = '' } = {}) {
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
    page.on('requestfailed', (r) => { const u = r.url(); if (!u.includes('favicon') && !/\.mp3/.test(u)) errors.push(`requestfailed: ${u} ${r.failure()?.errorText}`); });
    await page.goto(`${BASE}/game-144/index.html?debug=1&fast=4${q}`);
    await page.waitForFunction(() => window.__nr && __nr.mode === 'title', null, { timeout: 60000 });
    return page;
}

const check = (cond, msg) => { if (!cond) { fails++; console.log('  FAIL', msg); } else console.log('  ok', msg); return cond; };
const Q = (page, fn, arg) => page.evaluate(fn, arg);
const shot = async (page, name) => { await page.screenshot({ path: path.join(OUT, `bt-${name}.png`) }); };
const until = (page, fn, msg, timeout = 40000, arg = null) =>
    page.waitForFunction(fn, arg, { timeout, polling: 100 }).then(() => check(true, msg), () => check(false, msg));
const click = (page, sel) => Q(page, (s) => { const e = document.querySelector(s); if (!e) return false; e.click(); return true; }, sel);
const visible = (page, id) => Q(page, (i) => { const e = document.getElementById(i); return !!e && !e.hidden && e.getClientRects().length > 0; }, id);
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
// the frame is not blank: sample the canvas (preserveDrawingBuffer is off, so read in the same task as a render)
const notBlank = (page) => Q(page, () => {
    const v = __nr.view, r = v.stage.renderer;
    v.stage.render();
    const gl = r.getContext(), w = gl.drawingBufferWidth, h = gl.drawingBufferHeight;
    const px = new Uint8Array(4);
    const seen = new Set();
    let lum = 0;
    for (let i = 0; i < 64; i++) {
        gl.readPixels(Math.floor(((i % 8) + 0.5) * w / 8), Math.floor((Math.floor(i / 8) + 0.5) * h / 8), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
        seen.add(px[0] >> 4 | (px[1] >> 4) << 4 | (px[2] >> 4) << 8);
        lum += (px[0] + px[1] + px[2]) / 3;
    }
    return { colours: seen.size, lum: lum / 64 };
});
const reportErrors = (label) => { check(errors.length === 0, `${label}: no console errors, page errors or failed requests`); for (const e of errors.slice(0, 8)) console.log('    ', e); };

// ======================================================================
async function desktop() {
    console.log('\n== desktop 1280×760');
    const page = await open({ width: 1280, height: 760 });
    check(await backLinkOk(page), '← Games link is on top and points at ../index.html');
    check(await visible(page, 'title'), 'title screen is up');
    check(await Q(page, () => document.getElementById('btn-continue').hidden), 'no Continue without a save');
    check(await Q(page, () => document.querySelectorAll('#select-title, #over-title').length <= 1), 'no button steals a screen heading id');
    const L = await layout(page);
    check(L.noHScroll && L.canvas, 'no sideways scroll; the canvas fills the window');
    await page.mouse.click(5, 400);                                  // a gesture: audio may start
    await shot(page, 'desktop-title');

    await click(page, '#title-menu [data-act="story"]');
    await until(page, () => !document.getElementById('select').hidden, 'Story opens pilot select');
    await click(page, '.pilot[data-pilot="lyra"]');
    await click(page, '.diff[data-diff="0"]');
    check(await Q(page, () => document.querySelector('.pilot.sel')?.dataset.pilot === 'lyra' && __nr.ui.sel.diff === 0), 'choosing a pilot and difficulty selects them');
    await click(page, '#select-go');
    await until(page, () => __nr.mode === 'play' && !document.getElementById('scene').hidden, 'Launch starts the story with a cutscene');
    await until(page, () => document.getElementById('scene').classList.contains('full') && document.getElementById('scene-img').naturalWidth > 0, 'the opening scene shows its painted art');
    check(await Q(page, () => document.getElementById('dlg-who').textContent.includes('MEI') && document.getElementById('dlg-por').naturalWidth > 0), 'with the speaker\'s name and portrait');
    await shot(page, 'desktop-scene');
    const line0 = await Q(page, () => __nr.ui.scene?.i);
    await page.keyboard.press('Enter'); await page.keyboard.press('Enter');
    await until(page, (l) => __nr.ui.scene && __nr.ui.scene.i > l, 'Enter advances the dialogue', 20000, line0);
    // skip through the intro scenes
    for (let i = 0; i < 4; i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(300); if (await Q(page, () => __nr.G.phase === 'play')) break; }
    await until(page, () => __nr.G.phase === 'play' && document.getElementById('scene').hidden, 'Escape skips the scenes into stage 1');
    check(await Q(page, () => __nr.G.pilot === 'lyra' && __nr.G.diff === 0), 'the run uses the chosen pilot and difficulty');
    await until(page, () => (__nr.seen.radio || 0) >= 1 && !document.getElementById('radio').hidden, 'Commander Mei radios in at the stage start');

    const x0 = await Q(page, () => __nr.G.player.x);
    await page.keyboard.down('ArrowRight');
    await until(page, (x) => __nr.G.player.x > x + 2, 'holding → moves the ship right', 30000, x0);
    await page.keyboard.up('ArrowRight');
    await page.keyboard.down('ShiftLeft');
    await until(page, () => __nr.G.player.focus, 'holding Shift focuses');
    await page.keyboard.up('ShiftLeft');
    await until(page, () => __nr.G.shots.length > 0, 'the guns fire on their own');
    const b0 = await Q(page, () => __nr.G.bombs);
    await page.keyboard.press('KeyX');
    await until(page, (b) => __nr.G.bombs === b - 1 && (__nr.seen.bomb || 0) >= 1, 'X bombs', 30000, b0);
    await Q(page, () => { __nr.G.burst = 100; });
    await page.keyboard.press('Space');
    await until(page, () => (__nr.seen.burst || 0) >= 1, 'Space fires Burst when the gauge is full');
    await Q(page, () => { __nr.G.player.warpMax = 1; __nr.G.player.warp = 1; });
    await page.keyboard.press('KeyC');
    await until(page, () => (__nr.seen.warp || 0) >= 1, 'C warps');
    const blank = await notBlank(page);
    check(blank.colours > 6 && blank.lum > 4, `the frame is not blank (${blank.colours} colours, mean ${blank.lum.toFixed(0)})`);
    await shot(page, 'desktop-play');
    // a NaN/infinite pixel must not bloom into a square halo (learnings: game-065, game-144)
    const halo = await Q(page, () => {
        const st = __nr.view.stage, gl = st.renderer.getContext();
        const ring = () => { st.render(); const W = gl.drawingBufferWidth, H = gl.drawingBufferHeight, px = new Uint8Array(4), out = [];
            for (let a = 0; a < 24; a++) { gl.readPixels(Math.round(W / 2 + Math.cos(a) * 0.16 * H), Math.round(H / 2 + Math.sin(a) * 0.16 * H), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px); out.push(px[0] + px[1] + px[2]); } return out; };
        const saved = __nr.G.bullets.splice(0);
        const base = ring();
        st.poison(true); const hit = ring(); st.poison(false);
        __nr.G.bullets.push(...saved);
        return hit.filter((v, i) => Math.abs(v - base[i]) > 60).length;
    });
    check(halo <= 2, `a NaN/infinite pixel does not bloom into a square halo (${halo}/24 far pixels changed)`);
    // every Meshy model (js/view/meshy.js FIT: 3 ships, 21 enemies, 6 bosses) loads and the player wears one;
    // a missing or broken GLB would silently fall back to the procedural shape
    await until(page, () => __nr.view.meshyLoaded === 30 && !!__nr.view.ship?.userData.meshy, 'all 30 Meshy models load and the player ship wears its model');

    await page.keyboard.press('Escape');
    await until(page, () => !document.getElementById('pause').hidden, 'Escape pauses');
    const t0 = await Q(page, () => __nr.G.t);
    await page.waitForTimeout(500);
    check(await Q(page, (t) => __nr.G.t === t, t0), 'the sim stops while paused');
    await Q(page, () => document.querySelector('#pause-menu [data-act="resume"]').focus());
    await page.keyboard.press('Space');
    await until(page, (t) => document.getElementById('pause').hidden && __nr.G.t > t, 'Space on Resume resumes', 30000, t0);

    // a boss: the HUD bar, the warning
    await Q(page, () => { __nr.god(); __nr.G._script = { script: [], end: 0 }; __nr.G.scriptI = 0; });
    await until(page, () => (__nr.seen.warning || 0) >= 1, 'the boss is announced with a WARNING');
    await until(page, () => __nr.G.phase === 'talk' || (__nr.G.boss && !__nr.G.boss.dead), 'the pilot has words before the boss', 40000);
    for (let i = 0; i < 4 && await Q(page, () => __nr.G.phase === 'talk'); i++) { await page.keyboard.press('Escape'); await page.waitForTimeout(400); }
    await until(page, () => !document.getElementById('boss-bar').hidden, 'the boss bar shows its name and health', 40000);
    await shot(page, 'desktop-boss');

    // Save & Quit, then Continue
    const score = await Q(page, () => __nr.G.score);
    await click(page, '#btn-pause');
    await until(page, () => !document.getElementById('pause').hidden, 'the ❚❚ button pauses');
    await click(page, '#pause-menu [data-act="quit"]');
    await until(page, () => __nr.mode === 'title' && !document.getElementById('btn-continue').hidden, 'Save & Quit returns to the title with Continue');
    await click(page, '#title-menu [data-act="continue"]');
    await until(page, (s) => __nr.mode === 'play' && __nr.G.score >= s && __nr.G.pilot === 'lyra', 'Continue restores the saved run', 30000, score);

    // sound and music
    const snd = await Q(page, async () => { for (let i = 0; i < 30; i++) { if (__nr.audio.level() > 0.002) return true; await new Promise((r) => setTimeout(r, 100)); } return false; });
    check(snd, 'sound comes out (meter peak above zero)');
    check(await Q(page, () => __nr.audio.musicPlaying()), 'the stage music is playing');
    check(await Q(page, () => __nr.audio.loaded >= 10), 'the ElevenLabs sound effects decoded');

    // game over → continue → give up → results
    await Q(page, () => { __nr.god(false); __nr.G.lives = 0; __nr.G.player.inv = 0; __nr.G.player.shield = 0; const p = __nr.G.player; __nr.G.bullets.push({ x: p.x, y: p.y, vx: 0, vy: 0, r: 0.3, k: 'orb', c: 0, t: 0 }); });
    await until(page, () => !document.getElementById('over').hidden, 'losing the last ship shows Game Over');
    await click(page, '#over-cont');
    await until(page, () => __nr.G.phase === 'play' && __nr.G.continues === 1, 'Continue puts the ship back');
    await Q(page, () => { __nr.G.lives = 0; __nr.G.player.inv = 0; const p = __nr.G.player; __nr.G.bullets.push({ x: p.x, y: p.y, vx: 0, vy: 0, r: 0.3, k: 'orb', c: 0, t: 0 }); });
    await until(page, () => !document.getElementById('over').hidden, 'Game Over again');
    await click(page, '#over-quit');
    await until(page, () => !document.getElementById('results').hidden, 'giving up shows the results');
    await shot(page, 'desktop-results');
    await click(page, '#results-ok');
    await until(page, () => __nr.mode === 'title', 'and back to the title');
    reportErrors('desktop');
}

// ======================================================================
async function survival() {
    console.log('\n== survival');
    const page = await open({ width: 1280, height: 760 });
    await click(page, '#title-menu [data-act="endless"]');
    await until(page, () => !document.getElementById('select').hidden && document.getElementById('select-head').textContent.includes('Survival'), 'Survival opens pilot select');
    await click(page, '#select-go');
    await until(page, () => __nr.mode === 'play' && __nr.G.mode === 'endless', 'a survival run starts');
    await Q(page, () => { __nr.god(); __nr.autoplay(true); });
    await until(page, () => __nr.G.wave >= 2, 'the waves keep coming', 90000);
    await shot(page, 'survival');
    reportErrors('survival');
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
    await tapSel('#title-menu [data-act="story"]');
    await until(page, () => !document.getElementById('select').hidden, 'a tap on Story opens pilot select');
    await tapSel('.pilot[data-pilot="kaito"]');
    await tapSel('#select-go');
    await until(page, () => __nr.mode === 'play' && !document.getElementById('scene').hidden, 'a tap on Launch starts the opening scene');
    const sz = await Q(page, () => { const r = document.getElementById('scene-skip').getBoundingClientRect(); return r.height >= 36 && r.right <= innerWidth && r.top >= 0; });
    check(sz, 'Skip is on screen');
    await page.touchscreen.tap(w / 2, h / 2);
    await until(page, () => __nr.ui.scene && __nr.ui.scene.i >= 0, 'tapping the scene advances it');
    for (let i = 0; i < 5 && await Q(page, () => __nr.G.phase === 'talk'); i++) { await tapSel('#scene-skip'); await page.waitForTimeout(300); }
    await until(page, () => __nr.G.phase === 'play' && document.getElementById('scene').hidden, 'Skip gets to the stage');
    await Q(page, () => __nr.god());          // these steps test the controls; a ship shot down mid-step can't bomb or pause
    await until(page, () => !document.getElementById('touch').hidden, 'the touch deck is shown');
    const L = await layout(page);
    check(L.noHScroll, 'no sideways scroll');
    check(L.canvas, 'the canvas matches the visible viewport');
    const sizes = await Q(page, () => ['#t-bomb', '#t-warp', '#t-burst', '#t-focus', '#btn-pause'].map((s) => {
        const r = document.querySelector(s).getBoundingClientRect();
        return { s, ok: r.width >= 44 && r.height >= 44 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight };
    }));
    for (const z of sizes) check(z.ok, `${z.s} is at least 44 px and on screen`);
    check(await Q(page, () => __nr.view.onScreen(__nr.G.player.x, __nr.G.player.y) && __nr.view.onScreen(1, 1) && __nr.view.onScreen(31, 17)), 'the whole field is on screen');

    const zone = await Q(page, () => { const r = document.getElementById('stick-zone').getBoundingClientRect(); return { x: r.left + r.width * 0.4, y: r.top + r.height * 0.5 }; });
    const x0 = await Q(page, () => __nr.G.player.x);
    await touch('touchStart', zone.x, zone.y);
    for (let i = 1; i <= 6; i++) await touch('touchMove', zone.x + i * 12, zone.y);
    await until(page, (x) => __nr.G.player.x > x + 1, 'dragging the stick moves the ship', 30000, x0);
    await touch('touchEnd', 0, 0);
    const bombs = await Q(page, () => __nr.G.bombs);
    await tapSel('#t-bomb');
    await until(page, (b) => __nr.G.bombs === b - 1, 'tapping BOMB bombs', 30000, bombs);
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
    const page = await open({ width: 1280, height: 760 }, { nostorage: true, q: '&q=low' });
    await Q(page, () => __nr.start(5, { pilot: 'sora' }));
    await until(page, () => __nr.mode === 'play', 'boots and starts a game with localStorage throwing');
    await Q(page, () => __nr.ff(3));
    check(await Q(page, () => __nr.save() === false), 'saving fails quietly');
    reportErrors('nostorage');
}

try {
    if (want('desktop')) await desktop();
    if (want('survival')) await survival();
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

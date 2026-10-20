/**
 * browsertest.mjs — the real game in real Chromium (SwiftShader WebGL).
 *
 * desktop (1280×760): boot to the title with no errors and the ← Games link on top → New Game
 *   → type a name → the intro scene (Space advances, Skip ends it) → the museum → Dig by click
 *   → a real mouse drag swaps two finds and the board plays its script → a keyboard swap (Space,
 *   arrow) → Escape pauses → the hammer by click → win the dig → the win card → back to the
 *   museum with the find → a task by click plays its scene → the journal's tabs → the shop
 *   → reload and Continue restores the museum → run out of moves, buy five more, leave.
 *   No sideways scroll; the canvas fills the window.
 * phones (touch only, real CDP touches) at 390×844 and 844×390: taps through the menus, a
 *   touch drag swaps on the board, controls ≥ 44 px and on screen, no sideways scroll, the
 *   canvas matches the visible viewport, a pause tap stays open after the finger lifts.
 * nostorage: localStorage throws; the game still boots and plays a dig.
 * Fails on any console error, page error or failed request.
 *
 *   python3 -m http.server 8088          # from the REPO ROOT
 *   node game-088/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8088), ONLY=desktop,phones,nostorage, THREE_PKG.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8088';
const OUT = path.join(HERE, 'shots');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const want = (name) => !ONLY.length || ONLY.includes(name);
fs.mkdirSync(OUT, { recursive: true });

let fails = 0;
let errors = [];
let browser = null;
let context = null;

async function open(viewport, { touch = false, nostorage = false, keep = false } = {}) {
    if (!keep) {
        if (browser) await browser.close();
        browser = await chromium.launch({
            executablePath: process.env.PW_CHROMIUM_PATH || undefined,
            args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
        });
        context = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch });
        await context.addInitScript((ns) => {
            // a new context starts with empty storage; this only blocks it
            if (ns) Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } });
        }, nostorage);
    }
    const page = await context.newPage();
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
    page.on('dialog', (d) => d.accept());
    await page.goto(`${BASE}/game-088/index.html?debug=1&fast=4`);
    await page.waitForFunction(() => window.__cc && __cc.mode === 'title', null, { timeout: 90000 });
    return page;
}

const check = (cond, msg) => { if (!cond) { fails++; console.log('  FAIL', msg); } else console.log('  ok', msg); return cond; };
const Q = (page, fn, arg) => page.evaluate(fn, arg);
const shot = async (page, name) => { await page.screenshot({ path: path.join(OUT, `bt-${name}.png`) }); };
// SwiftShader draws a few frames a second: wait on state, never on the clock.
const until = (page, fn, msg, timeout = 60000, arg = null) =>
    page.waitForFunction(fn, arg, { timeout, polling: 100 }).then(() => check(true, msg), () => check(false, msg));
// Playwright's click() waits for frames to settle, which SwiftShader never does; click from inside.
const click = (page, sel) => Q(page, (s) => { const e = document.querySelector(s); if (!e) return false; e.click(); return true; }, sel);
const visible = (page, id) => Q(page, (i) => { const e = document.getElementById(i); return !!e && !e.hidden && getComputedStyle(e).display !== 'none'; }, id);
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
const idle = (page, msg = 'the board finishes its animation') => until(page, () => !__cc.busy, msg, 90000);
/** A valid move as screen points [from, to]. */
const moveAt = (page) => Q(page, () => { const m = __cc.moves()[0]; return m && { a: __cc.cell(...m[0]), b: __cc.cell(...m[1]), m }; });

// ======================================================================
async function desktop() {
    console.log('\n== desktop 1280×760');
    let page = await open({ width: 1280, height: 760 });
    check(await backLinkOk(page), '← Games link is on top and points at ../index.html');
    check(await visible(page, 'title'), 'title screen is up');
    check(await Q(page, () => document.getElementById('btn-continue').hidden), 'no Continue without a save');
    const L = await layout(page);
    check(L.noHScroll && L.canvas, 'no sideways scroll; the canvas fills the window');
    await shot(page, 'desktop-title');

    await click(page, '#title-menu [data-act="new"]');
    await until(page, () => !document.getElementById('newgame').hidden, 'New Game asks for a name');
    await page.fill('#name-input', 'Juniper');
    await click(page, '#name-go');
    await until(page, () => __cc.mode === 'museum' && !document.getElementById('dialogue').hidden, 'the intro scene starts in the museum');
    check(await Q(page, () => document.getElementById('dlg-name').textContent === 'Captain Gus'), 'Captain Gus speaks first');
    const before = await Q(page, () => __cc.ui.dlg.i);
    await page.keyboard.press('Space'); await page.keyboard.press('Space');
    await until(page, (b) => __cc.ui.dlg && __cc.ui.dlg.i > b, 'Space advances the dialogue', 30000, before);
    await click(page, '#dlg-skip');
    await until(page, () => document.getElementById('dialogue').hidden && __cc.G.introDone, 'Skip ends the intro');
    check(await Q(page, () => __cc.G.name === 'Juniper'), 'the name was kept');
    check(await Q(page, () => document.querySelector('#m-dig .dig-lv').textContent === 'Level 1'), 'the Dig button offers level 1');
    await shot(page, 'desktop-museum');

    // the island: geography, the map camera, labels, the camps
    const geo = await Q(page, async () => {
        const I = await import('./js/view/island.js');
        const bad = [];
        for (const s of I.DIG_SITES) {
            const hs = [0, 1, 2, 3].map((k) => I.islandH(s.x + Math.cos(k * 1.57) * 3, s.z + Math.sin(k * 1.57) * 3));
            if (Math.min(...hs) < 0.6) bad.push(`${s.name} is at the water's edge`);
            if (Math.max(...hs) - Math.min(...hs) > 0.3) bad.push(`${s.name} is not level`);
            if (Math.hypot((s.x - I.LAKE.x) / I.LAKE.rx, (s.z - I.LAKE.z) / I.LAKE.rz) < 1.6) bad.push(`${s.name} is in the lake`);
        }
        for (let x = -12; x <= 12; x += 4) for (let z = -14; z <= 10; z += 4) if (Math.abs(I.islandH(x, z) - (I.FLOOR_Y - 0.05)) > 0.01) bad.push(`museum floor not flat at ${x},${z}`);
        // no sea inland: every point well inside the coast is above water
        let wet = 0;
        const nearRiver = (x, z) => I.RIVER.some((p, i) => i + 1 < I.RIVER.length && (() => { const [ax, az] = p, [bx, bz] = I.RIVER[i + 1]; const dx = bx - ax, dz = bz - az; const t = Math.max(0, Math.min(1, ((x - ax) * dx + (z - az) * dz) / (dx * dx + dz * dz))); return Math.hypot(x - ax - dx * t, z - az - dz * t) < 8; })());
        for (let x = -60; x <= 60; x += 6) for (let z = -120; z <= 0; z += 6) if (I.islandH(x, z) < 0.3 && Math.hypot((x - I.LAKE.x) / I.LAKE.rx, (z - I.LAKE.z) / I.LAKE.rz) > 1.1 && !nearRiver(x, z)) wet++;
        if (wet) bad.push(`${wet} inland points below the sea`);
        const v = I.islandH(I.VOLCANO.x, I.VOLCANO.z + I.VOLCANO.crater + 2);
        if (v < 30) bad.push(`the volcano is only ${v.toFixed(1)} high at its rim`);
        return bad;
    });
    check(geo.length === 0, `the island's geography holds (${geo.join('; ') || 'camps level and dry, museum flat, no inland sea, volcano tall'})`);
    const rig0 = await Q(page, () => ({ ...__cc.museum.rig }));
    await page.mouse.move(640, 420); await page.mouse.down();
    for (let i = 1; i <= 6; i++) await page.mouse.move(640 - i * 30, 420 + i * 10);
    await page.mouse.up();
    await until(page, (r) => Math.hypot(__cc.museum.rig.tx - r.tx, __cc.museum.rig.tz - r.tz) > 5, 'a mouse drag pans over the island', 30000, rig0);
    await page.mouse.wheel(0, 400);
    await until(page, (r) => __cc.museum.rig.wantDist > r.wantDist, 'the wheel zooms out', 30000, rig0);
    await page.mouse.move(640, 420); await page.mouse.down({ button: 'right' });
    for (let i = 1; i <= 5; i++) await page.mouse.move(640 + i * 30, 420);
    await page.mouse.up({ button: 'right' });
    await until(page, (r) => Math.abs(__cc.museum.rig.yaw - r.yaw) > 0.3, 'a right-drag turns the view', 30000, rig0);
    await click(page, '#m-map');
    await until(page, () => __cc.museum.rig.wantDist > 200, 'the map button shows the whole island');
    await until(page, () => [...document.querySelectorAll('.maplabel.region')].filter((e) => !e.hidden && +e.style.opacity > 0.5).length >= 6, 'and names its places');
    await shot(page, 'desktop-map');
    await click(page, '.maplabel.region:not([hidden])');
    await until(page, () => __cc.museum.rig.wantDist <= 60, 'tapping a place name flies there');
    const locked = await Q(page, () => { const c = __cc.museum.siteMarkers.find((m) => m.userData.state === 'locked'); return c && c.userData.site; });
    await Q(page, (s) => { const r = __cc.museum.rig; r.tx = r.cx = s.x; r.tz = r.cz = s.z; r.wantDist = r.dist = 30; }, locked);
    await page.waitForTimeout(800);
    await Q(page, () => document.querySelectorAll('.toast').forEach((t) => t.remove()));
    const lp = await Q(page, (s) => __cc.museum.screenOf(s.x + 1, __cc.museum.siteMarkers.find((m) => m.userData.site.name === s.name).position.y + 0.5, s.z + 1), locked);
    await page.mouse.click(lp.x, lp.y);
    await until(page, () => [...document.querySelectorAll('.toast')].some((t) => /opens in Chapter/.test(t.textContent)), 'tapping a locked camp says which chapter opens it');
    await click(page, '#m-map'); await click(page, '#m-map');
    await until(page, () => __cc.museum.rig.wantDist < 60, 'the map button goes home again');

    await click(page, '#m-dig');
    await until(page, () => __cc.mode === 'dig' && __cc.G.dig && !document.getElementById('dhud').hidden, 'Dig opens level 1 with its HUD');
    await page.waitForTimeout(400);
    await Q(page, () => __cc.ui.inScene() && __cc.ui.endScene());
    await until(page, () => { if (__cc.ui.inScene()) __cc.ui.endScene(); return !__cc.busy && !__cc.ui.inScene(); }, 'the board settles after its intro', 90000);
    await page.waitForTimeout(1600);
    await Q(page, () => __cc.ui.inScene() && __cc.ui.endScene());
    // a real mouse drag
    const mv = await moveAt(page);
    await page.mouse.move(mv.a.x, mv.a.y);
    await page.mouse.down();
    for (let i = 1; i <= 6; i++) await page.mouse.move(mv.a.x + (mv.b.x - mv.a.x) * i / 6, mv.a.y + (mv.b.y - mv.a.y) * i / 6);
    await page.mouse.up();
    await until(page, () => __cc.G.dig.B.movesUsed === 1, 'a mouse drag swaps two finds and spends a move');
    await until(page, () => (__cc.seen['b:clear'] || 0) > 0, 'the move clears finds');
    await idle(page);
    await shot(page, 'desktop-dig');
    // a keyboard swap
    const km = await Q(page, () => __cc.moves()[0]);
    await Q(page, (m) => __cc.setCursor(m[0][0], m[0][1]), km);
    await page.keyboard.press('Space');
    const key = km[1][0] > km[0][0] ? 'ArrowDown' : km[1][0] < km[0][0] ? 'ArrowUp' : km[1][1] > km[0][1] ? 'ArrowRight' : 'ArrowLeft';
    await page.keyboard.press(key);
    await until(page, () => __cc.G.dig.B.movesUsed === 2 || __cc.G.dig.result, 'Space then an arrow swaps from the keyboard');
    await idle(page);
    // pause
    await page.keyboard.press('Escape');
    await until(page, () => !document.getElementById('menu').hidden, 'Escape pauses the dig');
    await page.keyboard.press('Escape');
    await until(page, () => document.getElementById('menu').hidden, 'Escape again resumes');
    // hammer
    if (!(await Q(page, () => !!__cc.G.dig.result))) {
        const h0 = await Q(page, () => __cc.G.boosters.hammer);
        await click(page, '#d-hammer');
        await until(page, () => !document.getElementById('hammer-hint').hidden, 'the hammer button arms the hammer');
        const p = await Q(page, () => __cc.cell(3, 3));
        await page.mouse.click(p.x, p.y);
        await until(page, (h) => __cc.G.boosters.hammer === h - 1 && (__cc.seen['b:hammer'] || 0) > 0, 'a click smashes a square with it', 60000, h0);
        await idle(page);
    }
    // win
    await Q(page, () => __cc.win());
    await until(page, () => !document.getElementById('win').hidden, 'winning shows the Dig Complete card', 90000);
    check(await Q(page, () => __cc.G.level === 1 && __cc.G.items.length === 1 && __cc.G.stars >= 1), 'the win pays stars and a find');
    await shot(page, 'desktop-win');
    await click(page, '#win-go');
    await until(page, () => __cc.mode === 'museum' && !__cc.G.dig, 'back to the museum');
    // a task
    await Q(page, () => { __cc.give(4, 0); });
    await click(page, '#m-tasks');
    await until(page, () => !document.getElementById('tasks').hidden && document.querySelectorAll('#task-list .task').length === 3, 'the task list shows three tasks');
    await click(page, '#task-list .task .btn');
    await until(page, () => __cc.G.tasks.includes('door') && !document.getElementById('dialogue').hidden, 'doing a task plays its scene');
    await click(page, '#dlg-skip');
    await until(page, () => document.getElementById('dialogue').hidden, 'and the scene can be skipped');
    // journal and shop
    await click(page, '#m-journal');
    await until(page, () => !document.getElementById('journal').hidden && document.querySelectorAll('#journal-body .card').length === 42, 'the journal lists all 42 finds');
    for (const tab of ['dinos', 'staff', 'digs']) {
        await click(page, `.tab[data-tab="${tab}"]`);
        await until(page, (t) => document.querySelector('.tab.on').dataset.tab === t, `the ${tab} tab opens`, 30000, tab);
    }
    await page.keyboard.press('Escape');
    await until(page, () => document.getElementById('journal').hidden, 'Escape closes the journal');
    await Q(page, () => __cc.give(0, 200));
    await click(page, '#m-shop');
    await until(page, () => !document.getElementById('shop').hidden, 'the shop opens');
    const hb = await Q(page, () => __cc.G.boosters.hammer);
    await click(page, '#shop-body .shop-item .btn');
    await until(page, (h) => __cc.G.boosters.hammer === h + 1, 'buying a hammer in the shop', 30000, hb);
    await click(page, '#shop [data-close]');
    reportErrors('desktop');

    // reload and continue
    await Q(page, () => __cc.save());
    await page.close();
    page = await open({ width: 1280, height: 760 }, { keep: true });
    await until(page, () => !document.getElementById('btn-continue').hidden, 'after a reload, Continue is offered');
    await click(page, '#btn-continue');
    await until(page, () => __cc.mode === 'museum' && __cc.G.level === 1 && __cc.G.name === 'Juniper' && __cc.G.tasks.includes('door'), 'Continue restores the museum');

    // run out of moves, buy more, leave
    await Q(page, () => __cc.dig(2));
    await until(page, () => { if (__cc.ui.inScene()) __cc.ui.endScene(); return __cc.mode === 'dig' && !__cc.busy; }, 'level 2 opens', 90000);
    await Q(page, () => { __cc.G.dig.B.moves = 1; __cc.give(0, 500); });
    const m2 = await Q(page, () => __cc.moves()[0]);
    await Q(page, (m) => __cc.digView.hooks.onSwap(m[0][0], m[0][1], m[1][0], m[1][1]), m2);
    await until(page, () => !document.getElementById('lose').hidden || !document.getElementById('win').hidden, 'the last move ends the dig', 90000);
    if (await visible(page, 'lose')) {
        await click(page, '#lose-more');
        await until(page, () => document.getElementById('lose').hidden && __cc.G.dig.B.moves === 5, '+5 moves carries on');
        await Q(page, () => __cc.G.dig.B.moves = 1);
        await idle(page);
        await Q(page, () => __cc.ui.inScene() && __cc.ui.endScene());
        const m3 = await Q(page, () => __cc.moves()[0]);
        await Q(page, (m) => __cc.digView.hooks.onSwap(m[0][0], m[0][1], m[1][0], m[1][1]), m3);
        await until(page, () => !document.getElementById('lose').hidden || !document.getElementById('win').hidden, 'and ends again', 90000);
        if (await visible(page, 'lose')) { await click(page, '#lose-quit'); await until(page, () => __cc.mode === 'museum', 'Back to the museum after a loss'); }
    } else check(true, '(won on the last move)');
    reportErrors('desktop (continue)');
}

// ======================================================================
async function phone(w, h) {
    console.log(`\n== phone ${w}×${h} (touch only)`);
    const page = await open({ width: w, height: h }, { touch: true });
    const cdp = await page.context().newCDPSession(page);
    const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
    const tapSel = async (sel) => {
        const r = await Q(page, (s) => {
            const e = document.querySelector(s);
            if (!e) return null;
            // SwiftShader may not have run a frame of a sheet's pop-in yet: finish it, then measure
            for (let n = e; n; n = n.parentElement) for (const a of n.getAnimations?.() || []) if (a.effect?.getTiming().iterations !== Infinity) a.finish();
            let b = e.getBoundingClientRect();
            if (b.top < 0 || b.bottom > innerHeight) { e.scrollIntoView({ block: 'nearest' }); b = e.getBoundingClientRect(); }
            const vv = window.visualViewport;
            return { x: b.left + b.width / 2 - (vv?.offsetLeft || 0), y: b.top + b.height / 2 - (vv?.offsetTop || 0), sy: document.scrollingElement.scrollTop };
        }, sel);
        if (!r) return false;
        await page.touchscreen.tap(r.x, r.y);
        return true;
    };

    check(await backLinkOk(page), '← Games link is on top');
    await tapSel('#title-menu [data-act="new"]');
    await until(page, () => !document.getElementById('newgame').hidden, 'a tap on New Game asks for a name');
    await tapSel('#name-go');
    await until(page, () => __cc.mode === 'museum' && !document.getElementById('dialogue').hidden, 'a tap sets sail into the intro');
    await tapSel('#dlg-skip');
    await until(page, () => document.getElementById('dialogue').hidden, 'a tap on Skip ends it');
    let L = await layout(page);
    check(L.noHScroll, 'no sideways scroll in the museum');
    check(L.canvas, 'the canvas matches the visible viewport');
    const msizes = await Q(page, () => ['#m-tasks', '#m-dig', '#m-journal', '#m-shop', '#m-menu'].map((s) => {
        const r = document.querySelector(s).getBoundingClientRect();
        return { s, ok: r.width >= 44 && r.height >= 44 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight };
    }));
    for (const z of msizes) check(z.ok, `${z.s} is at least 44 px and on screen`);
    await shot(page, `phone-museum-${w}x${h}`);
    // one finger pans, two fingers pinch
    const r0 = await Q(page, () => ({ ...__cc.museum.rig }));
    const cx = w / 2, cy = h / 2;
    await touch('touchStart', cx, cy);
    for (let i = 1; i <= 5; i++) await touch('touchMove', cx - i * 20, cy + i * 8);
    await touch('touchEnd', 0, 0);
    await until(page, (r) => Math.hypot(__cc.museum.rig.tx - r.tx, __cc.museum.rig.tz - r.tz) > 3, 'one finger pans the island', 30000, r0);
    const two = (type, d) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x: cx - d, y: cy, id: 1 }, { x: cx + d, y: cy, id: 2 }] });
    await two('touchStart', 40);
    for (let i = 1; i <= 5; i++) await two('touchMove', 40 + i * 20);
    await two('touchEnd', 0);
    await until(page, (r) => __cc.museum.rig.wantDist < r.wantDist * 0.8, 'two fingers pinch to zoom in', 30000, r0);
    await Q(page, () => __cc.museum.focus('museum'));

    await tapSel('#m-dig');
    await until(page, () => __cc.mode === 'dig', 'a tap on Dig opens the dig');
    await until(page, () => { if (__cc.ui.inScene()) __cc.ui.endScene(); return !__cc.busy; }, 'the board settles', 90000);
    await page.waitForTimeout(1600);
    await Q(page, () => __cc.ui.inScene() && __cc.ui.endScene());
    L = await layout(page);
    check(L.noHScroll && L.canvas, 'no sideways scroll; the canvas still fits in the dig');
    const sizes = await Q(page, () => ['#d-hammer', '#d-shuffle', '#d-pause'].map((s) => {
        const r = document.querySelector(s).getBoundingClientRect();
        return { s, ok: r.width >= 44 && r.height >= 44 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight };
    }));
    for (const z of sizes) check(z.ok, `${z.s} is at least 44 px and on screen`);
    const onBoard = await Q(page, () => {
        const B = __cc.G.dig.B, hud = document.querySelector('.dbottom').getBoundingClientRect(), top = document.querySelector('.dtop').getBoundingClientRect();
        let ok = true;
        for (let r = 0; r < B.R; r++) for (let c = 0; c < B.C; c++) {
            if (!B.mask[r * B.C + c]) continue;
            const p = __cc.cell(r, c);
            if (p.x < 0 || p.x > innerWidth || p.y < 0 || p.y > innerHeight) ok = false;
            if (innerHeight > 520 && (p.y > hud.top || p.y < top.bottom)) ok = false;
        }
        return ok;
    });
    check(onBoard, 'every cell of the board is on screen and clear of the HUD');
    // a real touch drag swaps
    const mv = await moveAt(page);
    await touch('touchStart', mv.a.x, mv.a.y);
    for (let i = 1; i <= 5; i++) await touch('touchMove', mv.a.x + (mv.b.x - mv.a.x) * i / 5, mv.a.y + (mv.b.y - mv.a.y) * i / 5);
    await touch('touchEnd', 0, 0);
    await until(page, () => __cc.G.dig.B.movesUsed === 1, 'a touch drag swaps two finds');
    await idle(page);
    await shot(page, `phone-dig-${w}x${h}`);

    if (w < h) {
        // photosensitivity: a still board must not flicker. Freeze the bob (motion, not light),
        // keep everything else, and read ~40 frames back (v1.0.1: polished gold coins swinging in
        // the sun lit 4.8% of the screen up and down by more than a quarter of full brightness)
        await Q(page, () => { __cc.digView.idle = -1e9; __cc.digView.still = true; __cc.stage.armSampler(); });
        await until(page, () => { __cc.digView.idle = -1e9; return __cc.stage.sampler.frames >= 40; }, 'forty still frames read back', 180000);
        const sw = await Q(page, () => { const r = __cc.stage.swing(0.25); __cc.stage.sampler = null; __cc.digView.still = false; return r; });
        check(sw.share < 0.01, `a still board doesn't flicker (${(sw.share * 100).toFixed(2)}% of the screen swings > 25%, max ${sw.max.toFixed(2)})`);
    }
    await tapSel('#d-pause');
    await until(page, () => !document.getElementById('menu').hidden, 'tapping ❚❚ pauses');
    await page.waitForTimeout(300);
    check(await visible(page, 'menu'), 'the pause menu stays open after the finger lifts');
    await tapSel('#menu-list [data-act="settings"]');
    await until(page, () => !document.getElementById('settings').hidden, 'Settings opens from the pause menu');
    await tapSel('#set-calm');
    await until(page, () => __cc.stage.calm && __cc.digView.fx.calm && __cc.digView.shakeOn === false, 'Calm effects turns off flashes and shake');
    await Q(page, () => { __cc.stage.kick(1, 3); });
    check(await Q(page, () => __cc.stage.flash === 0), 'and a blast no longer flashes the screen');
    await tapSel('#set-calm');
    await until(page, () => !__cc.stage.calm && __cc.digView.shakeOn === true, 'and turns them back on');
    await tapSel('#settings [data-close]');
    await until(page, () => document.getElementById('settings').hidden, 'Done closes Settings');
    await tapSel('#menu-list [data-act="resume"]');
    await until(page, () => document.getElementById('menu').hidden, 'a tap on Resume closes it');
    reportErrors(`phone ${w}×${h}`);
}

// ======================================================================
async function nostorage() {
    console.log('\n== blocked storage');
    const page = await open({ width: 1280, height: 760 }, { nostorage: true });
    await Q(page, () => __cc.start(5));
    await until(page, () => __cc.mode === 'museum', 'boots and starts a game with localStorage throwing');
    await Q(page, () => __cc.dig(1));
    await until(page, () => __cc.mode === 'dig', 'and opens a dig');
    check(await Q(page, () => __cc.save() === false), 'saving fails quietly');
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

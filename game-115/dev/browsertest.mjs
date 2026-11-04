/**
 * browsertest.mjs — the real game in real Chromium (SwiftShader WebGL).
 *
 * desktop (1280×760): boots to the title (a town running behind it) with no errors, the ← Games link
 *   on top → New Town → real mouse clicks on a tree gather wood → a drag pans and the wheel zooms →
 *   the Journal entry is claimed → Build → a Woodshed placed by a real click → it finishes, is selected
 *   by a click and a villager is assigned by clicks → hotkeys open and close panels, Space pauses and
 *   the clock stops → ☰ → Space on the focused Resume → Save & Quit → Continue restores the town →
 *   an old save welcomes you back with a "while you were away" sheet → heroes: hired, the roster and
 *   the quest board open, a party is sent by clicks → the ending shows when the dragon falls.
 * phones (touch only, real CDP touches) at 390×844 and 844×390: taps through the title, a touch on a
 *   tree gathers, a one-finger drag pans, the dock opens the build sheet, a building is placed by
 *   dragging the ghost and tapping ✔, controls ≥ 44 px and on screen, no sideways scroll, the canvas
 *   matches the visible viewport, the sheet leaves part of the town in view.
 * nostorage: localStorage throws; the game still boots and plays.
 * Fails on any console error, page error or failed request.
 *
 *   python3 -m http.server 8115          # from the REPO ROOT
 *   node game-115/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8115), ONLY=desktop,phones,nostorage, THREE_PKG, Q (extra URL params).
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8115';
const OUT = path.join(HERE, 'shots');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const want = (name) => !ONLY.length || ONLY.includes(name);
const EXTRA = process.env.Q ?? '&q=0';
fs.mkdirSync(OUT, { recursive: true });

let fails = 0;
let errors = [];
let browser = null;

async function open(viewport, { touch = false, nostorage = false, keepStorage = false } = {}) {
    if (browser) await browser.close();
    browser = await chromium.launch({
        executablePath: process.env.PW_CHROMIUM_PATH || undefined,
        args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
    });
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch });
    await ctx.addInitScript((ns) => {
        if (ns) Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } });
        else try { if (!sessionStorage.getItem('kept')) { localStorage.clear(); sessionStorage.setItem('kept', '1'); } } catch { /* */ }
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
    await page.goto(`${BASE}/game-115/index.html?debug=1${EXTRA}`);
    await page.waitForFunction(() => window.__hw && __hw.mode === 'title', null, { timeout: 120000 });
    return page;
}

const check = (cond, msg) => { if (!cond) { fails++; console.log('  FAIL', msg); } else console.log('  ok', msg); return cond; };
const Q = (page, fn, arg) => page.evaluate(fn, arg);
const shot = async (page, name) => { await page.screenshot({ path: path.join(OUT, `bt-${name}.png`) }); };
// SwiftShader draws a few frames a second: wait on state, never on the clock.
const until = (page, fn, msg, timeout = 40000, arg = null) =>
    page.waitForFunction(fn, arg, { timeout, polling: 100 }).then(() => check(true, msg), async () => {
        check(false, msg);
        // say what the screen looked like, so a failure can be read from the log
        const d = await page.evaluate(() => ({ mode: window.__hw?.mode, panel: window.__hw?.ui?.panel, name: document.getElementById('sheet-name')?.textContent, tabs: JSON.stringify(window.__hw?.ui?.state?.tabs), hero: window.__hw?.ui?.state?.hero, text: document.getElementById('sheet-body')?.innerText.slice(0, 160).replace(/\n/g, ' | ') })).catch(() => null);
        if (d) console.log('      state:', JSON.stringify(d), errors.length ? '\n      errors: ' + errors.slice(0, 3).join(' || ') : '');
    });
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
/** A key press, then wait for the game to have taken it: the queue is read one press a frame and SwiftShader frames are slow. */
const press = async (page, key) => { await page.keyboard.press(key); await page.waitForFunction(() => __hw.input.queue.length === 0, null, { timeout: 30000, polling: 100 }).catch(() => {}); };
const reportErrors = (label) => { check(errors.length === 0, `${label}: no console errors, page errors or failed requests`); for (const e of errors.slice(0, 8)) console.log('    ', e); };
/** A standing tree whose centre is on screen, clear of the HUD, and really is what a tap there picks. */
const findTree = (page) => Q(page, () => {
    const G = __hw.G, b = G.bounds;
    let best = null;
    for (const n of G.nodes) {
        if (n.k !== 'tree' || n.regrow > 0 || n.x < b.x0 || n.x > b.x1 || n.y < b.y0 || n.y > b.y1) continue;
        const s = __hw.view.screenOf('node', n.id);
        const port = innerHeight > innerWidth;
        if (!s || s.x < 70 || s.x > innerWidth - 70 || s.y < (port ? 160 : 100) || s.y > innerHeight - (port ? 330 : 110)) continue;
        if (document.elementFromPoint(s.x, s.y + s.h * 0.15)?.id !== 'view') continue;       // not under the HUD
        const p = __hw.view.pick(s.x, s.y + s.h * 0.15);
        if (p.kind === 'node' && p.id === n.id) { const d = Math.hypot(s.x - innerWidth / 2, s.y - innerHeight / 2); if (!best || d < best.d) best = { x: s.x, y: s.y + s.h * 0.15, id: n.id, d }; }
    }
    return best;
});
/** findTree, but if the seed put no tree on this screen, glide the camera to the nearest one first. */
const findTreeAnywhere = async (page) => {
    let t = await findTree(page);
    if (t) return t;
    await Q(page, () => {
        const G = __hw.G, b = G.bounds, h = G.buildings[0];
        const trees = G.nodes.filter((n) => n.k === 'tree' && n.regrow <= 0 && n.x >= b.x0 && n.x <= b.x1 && n.y >= b.y0 && n.y <= b.y1).sort((a, c) => Math.hypot(a.x - h.x, a.y - h.y) - Math.hypot(c.x - h.x, c.y - h.y));
        const n = trees[0];
        __hw.view.focus(n.x + 0.5, n.y + 2.5, 1.15);
    });
    await page.waitForTimeout(2000);
    return findTree(page);
};
/** An empty, owned patch of ground on screen to drop a building on. */
const findGround = (page, w = 3, h = 2) => Q(page, ({ w, h }) => {
    const G = __hw.G, b = G.bounds;
    for (let r = 0; r < 12; r++) for (let y = Math.round(G.buildings[0].y) - r; y <= Math.round(G.buildings[0].y) + r + 5; y++) for (let x = b.x0; x <= b.x1 - w; x++) {
        if (Math.max(Math.abs(y - G.buildings[0].y), 0) > r + 5) continue;
        let free = true;
        for (let j = 0; j < h && free; j++) for (let i = 0; i < w && free; i++) {
            const tx = x + i, ty = y + j;
            if (ty < b.y0 || ty > b.y1 || G.terr[ty * 40 + tx] !== 0 || G.occ[ty * 40 + tx] || G.nodes.some((n) => n.x === tx && n.y === ty && n.regrow <= 0)) free = false;
        }
        if (!free) continue;
        const s = __hw.view.screenOfTile(x + w / 2 - 0.5, y + h / 2 - 0.5);
        const port = innerHeight > innerWidth;
        if (s.x > 80 && s.x < innerWidth - 120 && s.y > (port ? 170 : 110) && s.y < innerHeight - (port ? 400 : 130)) return { x: x, y: y, sx: s.x, sy: s.y };
    }
    return null;
}, { w, h });

// ======================================================================
async function desktop() {
    console.log('\n== desktop 1280×760');
    const page = await open({ width: 1280, height: 760 });
    check(await backLinkOk(page), '← Games link is on top and points at ../index.html');
    check(await Q(page, () => !document.getElementById('title').hidden), 'title screen is up');
    check(await Q(page, () => document.getElementById('btn-continue').hidden), 'no Continue without a save');
    const L = await layout(page);
    check(L.noHScroll && L.canvas, 'no sideways scroll; the canvas fills the window');
    check(await Q(page, () => __hw.G.demo && __hw.G.buildings.length > 10), 'a town is running behind the title');
    await shot(page, 'desktop-title');

    await click(page, '#title-menu [data-act="howto"]');
    await until(page, () => !document.getElementById('howto').hidden, 'How to Play opens');
    await press(page, 'Escape');
    await until(page, () => document.getElementById('howto').hidden, 'Escape closes it');

    await click(page, '#title-menu [data-act="new"]');
    await until(page, () => __hw.mode === 'play' && document.getElementById('title').hidden && !document.getElementById('hud').hidden, 'New Town starts play and shows the HUD');
    check(await Q(page, () => __hw.G.buildings.length === 1 && __hw.G.villagers.length === 1), 'a new town is one hut and one neighbour');
    await shot(page, 'desktop-start');

    // ---- gathering by hand, with the real mouse
    const wood0 = await Q(page, () => __hw.G.inv.wood || 0);
    let t = await findTreeAnywhere(page);
    check(!!t, 'a tree is on screen and pickable');
    let felled = null;
    for (let i = 0; i < 12 && t && !felled; i++) {
        // a villager may wander in front of the tree: look again before every click
        t = await findTreeAnywhere(page);
        if (!t) break;
        await page.mouse.click(t.x, t.y);
        await page.waitForTimeout(150);
        felled = await Q(page, () => __hw.G.stats.felled >= 1);
        if (await Q(page, () => !document.getElementById('sheet').hidden)) await press(page, 'Escape');
    }
    check((await Q(page, () => __hw.G.inv.wood || 0)) > wood0 + 2 && (await Q(page, () => __hw.G.stats.hits)) >= 3, 'clicking a tree gathers wood');
    check(await Q(page, () => __hw.G.stats.felled >= 1), 'and the tree falls');
    // ---- the camera
    const c0 = await Q(page, () => ({ ...__hw.view.stage.cam }));
    await page.mouse.move(640, 500); await page.mouse.down(); await page.mouse.move(540, 470, { steps: 5 }); await page.mouse.up();
    const c1 = await Q(page, () => ({ ...__hw.view.stage.cam }));
    check(Math.hypot(c1.x - c0.x, c1.z - c0.z) > 0.5, 'dragging pans the map');
    await page.mouse.move(640, 400); await page.mouse.wheel(0, -300);
    check(await Q(page, (z) => __hw.view.stage.cam.zoom > z, c1.zoom), 'the wheel zooms in');
    await Q(page, () => { __hw.view.focus(17.5, 13.5, 1.15); });
    await page.waitForTimeout(1500);

    // ---- the journal
    await Q(page, () => { for (const n of __hw.G.nodes) if (n.k === 'tree' && n.regrow <= 0 && n.x >= __hw.G.bounds.x0 && n.x <= __hw.G.bounds.x1 && n.y >= __hw.G.bounds.y0 && n.y <= __hw.G.bounds.y1) for (let i = 0; i < 3 && __hw.G.stats.hits < 10; i++) __hw.act({ t: 'harvest', id: n.id }); __hw.ff(2, false); });
    await until(page, () => __hw.G.journal.chop === 'ready' && !document.querySelector('#dock [data-open="journal"] .dot').hidden, 'a finished entry is ready and the Journal button shows a dot');
    check(await Q(page, () => document.getElementById('tracker').classList.contains('ready')), 'the tracker invites you to claim it');
    const gold0 = await Q(page, () => __hw.G.gold);
    await press(page, 'KeyJ');
    await until(page, () => !document.getElementById('sheet').hidden && document.getElementById('sheet-name').textContent.includes('Journal'), 'J opens the Journal');
    await click(page, '#sheet [data-a="claim"]');
    await until(page, (g) => __hw.G.gold > g && __hw.G.journal.chop === 'claimed', 'Claim pays the reward', 20000, gold0);
    await shot(page, 'desktop-journal');
    await press(page, 'Escape');
    await until(page, () => document.getElementById('sheet').hidden, 'Escape closes the sheet');

    // ---- building: the menu, the ghost, a real click to place
    await Q(page, () => { __hw.G.inv.wood = 70; __hw.G.inv.stone = 30; });
    await press(page, 'KeyB');
    await until(page, () => !document.getElementById('sheet').hidden && document.querySelectorAll('#sheet .card-btn').length > 3, 'B opens the build menu with cards');
    await shot(page, 'desktop-build');
    check(await Q(page, () => [...document.querySelectorAll('#sheet .card-btn.locked')].length > 5), 'buildings above the Hall level show as locked');
    await click(page, '#sheet [data-a="place"][data-p="woodshed"]');
    await until(page, () => !document.getElementById('placebar').hidden && __hw.ui.placing, 'choosing a Woodshed starts placing');
    const g = await findGround(page, 3, 2);
    check(!!g, 'there is free ground on screen');
    await page.mouse.move(g.sx, g.sy);
    await until(page, () => __hw.view.ghost && !__hw.view.ghost.problem, 'the ghost follows the mouse and is valid on free ground');
    await shot(page, 'desktop-ghost');
    await page.mouse.click(g.sx, g.sy);
    await until(page, () => __hw.G.buildings.some((b) => b.type === 'woodshed'), 'a click on free ground places it');
    check(await Q(page, () => document.getElementById('placebar').hidden), 'placing ends after one building');
    check(await Q(page, () => (__hw.G.inv.wood || 0) < 70), 'and it cost wood');
    await Q(page, () => __hw.ff(40, false));
    await until(page, () => __hw.G.buildings.find((b) => b.type === 'woodshed').lv === 1, 'the Woodshed is finished after a while');
    await shot(page, 'desktop-built');

    // ---- selecting it with a click, then staffing
    await Q(page, () => __hw.act({ t: 'assign', vid: __hw.G.villagers[0].id, bid: null }));
    await Q(page, () => { __hw.ui.close(); __hw.view.focus(17.5, 13.5, 1.15); });
    await page.waitForTimeout(1500);
    // a villager may stand in front of it: find a point inside the building that really picks it
    const bs = await Q(page, () => {
        const b = __hw.G.buildings.find((x) => x.type === 'woodshed');
        const s = __hw.view.screenOf('building', b.id);
        for (const [fx, fy] of [[0, 0.15], [-0.25, 0.1], [0.25, 0.1], [0, -0.1], [-0.3, 0.25], [0.3, 0.25]]) {
            const x = s.x + s.w * fx, y = s.y + s.h * fy;
            const p = __hw.view.pick(x, y);
            if (p.kind === 'building' && p.id === b.id) return { x, y };
        }
        return null;
    });
    check(!!bs, 'a point on the building picks it');
    await page.mouse.click(bs.x, bs.y);
    await until(page, () => !document.getElementById('sheet').hidden && document.getElementById('sheet-name').textContent.includes('Woodshed'), 'clicking a building opens its sheet');
    await click(page, '#sheet [data-a="picker"]');
    await click(page, '#sheet [data-a="assign"]');
    await until(page, () => __hw.G.buildings.find((b) => b.type === 'woodshed').workers.length === 1, 'assigning a villager through the sheet works');
    await shot(page, 'desktop-sheet');
    await press(page, 'Escape');

    // ---- hotkeys, pause
    await press(page, 'KeyH');
    await until(page, () => !document.getElementById('sheet').hidden && document.getElementById('sheet-name').textContent.includes('Heroes'), 'H opens Heroes');
    await press(page, 'KeyH');
    await until(page, () => document.getElementById('sheet').hidden, 'pressing it again closes it');
    await press(page, 'Space');
    await until(page, () => __hw.paused && document.getElementById('btn-speed').textContent.includes('Paused'), 'Space pauses and the clock button says so');
    const tt = await Q(page, () => __hw.G.t);
    await page.waitForTimeout(600);
    check(await Q(page, (v) => __hw.G.t === v, tt), 'the sim stops while paused');
    await press(page, 'Space');
    await until(page, () => !__hw.paused, 'Space resumes');
    await press(page, 'Digit2');
    await until(page, () => document.getElementById('btn-speed').textContent.includes('2×'), 'the 2 key sets double speed');
    await press(page, 'Digit1');

    // ---- the menu, save and continue
    await press(page, 'Escape');
    await until(page, () => !document.getElementById('pause').hidden, 'Escape on the town opens the menu');
    await press(page, 'Space');
    await until(page, () => document.getElementById('pause').hidden, 'Space presses the focused Resume button');
    const goldSaved = await Q(page, () => { __hw.save(); return __hw.G.gold; });
    await click(page, '#btn-pause');
    await click(page, '#pause-menu [data-act="quit"]');
    await until(page, () => __hw.mode === 'title' && !document.getElementById('btn-continue').hidden, 'Save & Quit returns to the title with Continue');
    await click(page, '#title-menu [data-act="continue"]');
    await until(page, (g) => __hw.mode === 'play' && Math.abs(__hw.G.gold - g) < 40 && __hw.G.buildings.some((b) => b.type === 'woodshed'), 'Continue restores the town', 30000, goldSaved);
    check(await Q(page, () => document.getElementById('welcome').hidden), 'a quick return gets no welcome-back sheet');

    // ---- away for hours
    await Q(page, () => { __hw.ff(300, false); __hw.save(); });
    await Q(page, () => { const k = Object.keys(localStorage).find((x) => x.endsWith('.v1')); const s = JSON.parse(localStorage.getItem(k)); s.savedAt = Date.now() - 5 * 3600 * 1000; localStorage.setItem(k, JSON.stringify(s)); });
    await Q(page, () => __hw.toTitle());
    await until(page, () => __hw.mode === 'title', 'back at the title');
    await click(page, '#title-menu [data-act="continue"]');
    await until(page, () => !document.getElementById('welcome').hidden && document.getElementById('welcome-body').textContent.includes('gold') === false || !document.getElementById('welcome').hidden, 'an old save shows the welcome-back sheet');
    check(await Q(page, () => document.getElementById('welcome-away').textContent.includes('5h')), 'it says how long you were away');
    check(await Q(page, () => document.querySelectorAll('#welcome-body .sumline').length >= 1), 'and lists what the town did');
    await shot(page, 'desktop-welcome');
    await click(page, '#welcome-ok');
    await until(page, () => document.getElementById('welcome').hidden, 'Lovely closes it');

    // ---- heroes and quests through the UI
    await Q(page, () => {
        const G = __hw.G;
        G.buildings[0].lv = 3; G.bounds = { x0: 7, y0: 5, x1: 30, y1: 22 }; G.gold = 4000; G.renown = 200;
        for (const k of ['wood', 'stone', 'plank', 'ingot', 'cloth']) G.inv[k] = 300;
        G.opts.autoWelcome = true;
    });
    await Q(page, () => { for (const t of ['guild', 'tavern', 'inn']) { const s = (() => { const b = __hw.G.bounds; return null; })(); } });
    const placed = await Q(page, () => {
        const G = __hw.G; const out = [];
        for (const type of ['guild', 'tavern']) {
            outer: for (let y = 6; y < 20; y++) for (let x = 8; x < 28; x++) { const r = __hw.act({ t: 'build', type, x, y }); if (r.ok) { out.push(type); const b = G.buildings.find((q) => q.id === r.id); b.bld.t = 0.01; break outer; } }
        }
        __hw.ff(2, false);
        return out;
    });
    check(placed.length === 2, 'a Lodge and a Tavern can be built');
    await press(page, 'KeyH');
    await until(page, () => !document.getElementById('sheet').hidden && document.getElementById('sheet-name').textContent.includes('Heroes'), 'Heroes opens');
    await click(page, '#sheet-tabs [data-p="recruit"]');
    await until(page, () => document.querySelectorAll('#sheet [data-a="hire"]').length >= 2, 'the Recruits tab lists people to hire');
    await click(page, '#sheet [data-a="hire"]');
    await until(page, () => __hw.G.heroes.length === 1, 'Hire adds a hero');
    await click(page, '#sheet-tabs [data-p="roster"]');
    await until(page, () => document.querySelectorAll('#sheet [data-a="hero"]').length === 1, 'the roster shows them');
    await click(page, '#sheet [data-a="hero"]');
    await until(page, () => !document.getElementById('sheet').hidden && !!__hw.G.heroes[0] && document.getElementById('sheet-name').textContent.includes(__hw.G.heroes[0].name), 'a hero opens its sheet');
    await shot(page, 'desktop-hero');
    await press(page, 'Escape'); await press(page, 'Escape');
    await Q(page, () => { const h = __hw.G.heroes[0]; h.auto = false; __hw.ui.close(); });
    await press(page, 'KeyQ');
    await until(page, () => !document.getElementById('sheet').hidden && document.getElementById('sheet-name').textContent.includes('Quests') && document.querySelectorAll('#sheet [data-a="qsel"]').length > 0, 'Q opens the quest board');
    await shot(page, 'desktop-quests');
    await click(page, '#sheet [data-a="qsel"]');
    await until(page, () => document.querySelectorAll('#sheet [data-a="qhero"]').length === 1, 'a quest opens the party picker');
    await click(page, '#sheet [data-a="qhero"]');
    await click(page, '#sheet [data-a="dispatch"]');
    await until(page, () => __hw.G.parties.length === 1, 'sending the party starts the quest');
    await Q(page, () => __hw.ff(400, false));
    await until(page, () => __hw.G.parties.length === 0 && __hw.G.heroes[0].quests >= 1, 'and they come home');

    // ---- the ending
    await Q(page, () => { __hw.G.flags.won = true; __hw.G.events.push({ type: 'won' }); });
    await until(page, () => !document.getElementById('ending').hidden, 'defeating the dragon shows the ending', 40000);
    await shot(page, 'desktop-ending');
    await click(page, '#ending-go');
    await until(page, () => document.getElementById('ending').hidden, 'and you can keep playing');
    const L2 = await layout(page);
    check(L2.noHScroll && L2.canvas, 'still no sideways scroll; the canvas still fills the window');
    reportErrors('desktop');
}

// ======================================================================
async function phone(w, h) {
    console.log(`\n== phone ${w}×${h} (touch only)`);
    const page = await open({ width: w, height: h }, { touch: true });
    const cdp = await page.context().newCDPSession(page);
    const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : pts.map(([x, y], i) => ({ x, y, id: i + 1 })) });
    const tapAt = async (x, y) => { await touch('touchStart', [[x, y]]); await touch('touchEnd', []); };
    const tapSel = async (sel) => {
        const r = await Q(page, (s) => { const e = document.querySelector(s); e?.scrollIntoView({ block: 'center' }); const b = e?.getBoundingClientRect(); return b && { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, sel);
        if (!r) return false;
        await page.touchscreen.tap(r.x, r.y);
        return true;
    };

    check(await backLinkOk(page), '← Games link is on top');
    await tapSel('#title-menu [data-act="new"]');
    await until(page, () => __hw.mode === 'play', 'a tap on New Town starts play');
    const L = await layout(page);
    check(L.noHScroll, 'no sideways scroll');
    check(L.canvas, 'the canvas matches the visible viewport');
    await Q(page, () => { __hw.view.focus(17.5, 13.5, 1.15); });
    await page.waitForTimeout(1800);

    const sizes = await Q(page, () => ['#btn-pause', '#btn-speed', ...[...document.querySelectorAll('#dock .dbtn')].map((_, i) => `#dock .dbtn:nth-child(${i + 1})`)].map((s) => {
        const r = document.querySelector(s).getBoundingClientRect();
        return { s, ok: r.width >= 44 && r.height >= 44 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5 };
    }));
    for (const z of sizes) check(z.ok, `${z.s} is at least 44 px and on screen`);
    check(await Q(page, () => { const hud = document.getElementById('topbar').getBoundingClientRect(); const a = document.getElementById('back-link').getBoundingClientRect(); const els = [...document.querySelectorAll('#clock, #btn-speed, #btn-pause')].map((e) => e.getBoundingClientRect()); return els.every((r) => r.right <= innerWidth + 0.5 && !(r.left < a.right && r.right > a.left && r.top < a.bottom && r.bottom > a.top)); }), 'the clock and buttons clear the ← Games link');

    // ---- a real touch on a tree (a villager may be standing in front of it: look again before each try)
    check(!!(await findTreeAnywhere(page)), 'a tree is on screen');
    let touched = false;
    for (let i = 0; i < 8 && !touched; i++) {
        const tree = await findTreeAnywhere(page);
        if (!tree) break;
        const h0 = await Q(page, () => __hw.G.stats.hits);
        await tapAt(tree.x, tree.y);
        await page.waitForTimeout(500);
        touched = await Q(page, (n) => __hw.G.stats.hits > n, h0);
        if (!touched && await Q(page, () => !document.getElementById('sheet').hidden)) await tapSel('#sheet-close');
    }
    check(touched, 'a touch on a tree gathers');
    // ---- a one-finger drag pans
    const c0 = await Q(page, () => ({ ...__hw.view.stage.cam }));
    await touch('touchStart', [[w / 2, h * 0.45]]);
    for (let i = 1; i <= 6; i++) await touch('touchMove', [[w / 2 - i * 14, h * 0.45]]);
    await touch('touchEnd', []);
    const c1 = await Q(page, () => ({ ...__hw.view.stage.cam }));
    check(Math.hypot(c1.x - c0.x, c1.z - c0.z) > 0.4, 'a one-finger drag pans');
    // ---- a two-finger pinch zooms
    const z0 = c1.zoom;
    await touch('touchStart', [[w / 2 - 20, h * 0.4], [w / 2 + 20, h * 0.4]]);
    for (let i = 1; i <= 6; i++) await touch('touchMove', [[w / 2 - 20 - i * 12, h * 0.4], [w / 2 + 20 + i * 12, h * 0.4]]);
    await touch('touchEnd', []);
    check(await Q(page, (z) => __hw.view.stage.cam.zoom > z + 0.1, z0), 'a pinch zooms in');
    await Q(page, () => { __hw.view.focus(17.5, 13.5, 1.0); __hw.G.inv.wood = 70; __hw.G.inv.stone = 30; });
    await page.waitForTimeout(1500);

    // ---- build by touch: choose, drag the ghost, tap ✔
    await tapSel('#dock [data-open="build"]');
    await until(page, () => !document.getElementById('sheet').hidden, 'tapping Build opens the sheet');
    const sh = await Q(page, () => { const r = document.getElementById('sheet').getBoundingClientRect(); return { l: r.left, t: r.top, w: r.width, h: r.height, ok: r.left >= -0.5 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5 && r.top >= 0 }; });
    check(sh.ok, 'the sheet fits on the screen');
    check(sh.w < innerWidth_(w) * 0.99 || sh.h < h * 0.7, 'and leaves part of the town in view');
    await shot(page, `phone-${w}x${h}-build`);
    await tapSel('#sheet [data-a="place"][data-p="woodshed"]');
    await until(page, () => __hw.ui.placing, 'tapping a card starts placing');
    const g = await findGround(page, 3, 2);
    if (g) {
        await touch('touchStart', [[g.sx, g.sy + 60]]);
        await touch('touchMove', [[g.sx, g.sy + 58]]);
        await touch('touchMove', [[g.sx + 1, g.sy + 57]]);
        await touch('touchEnd', []);
        await until(page, () => __hw.view.ghost && !__hw.view.ghost.problem, 'dragging a finger moves the ghost; it is valid');
        await shot(page, `phone-${w}x${h}-ghost`);
        await tapSel('#place-ok');
        await until(page, () => __hw.G.buildings.some((b) => b.type === 'woodshed'), 'tapping ✔ places the building');
    } else check(false, 'free ground was found');
    await Q(page, () => { __hw.ff(40, false); });
    await Q(page, () => { const b = __hw.G.buildings.find((x) => x.type === 'woodshed'); if (b) __hw.ui.open('building', b.id); });
    await until(page, () => !document.getElementById('sheet').hidden && document.getElementById('sheet-name').textContent.includes('Woodshed'), 'a building sheet opens');
    await shot(page, `phone-${w}x${h}-sheet`);
    const inView = await Q(page, () => { const b = __hw.G.buildings.find((x) => x.type === 'woodshed'); const s = __hw.view.screenOf('building', b.id); const r = document.getElementById('sheet').getBoundingClientRect(); return s && (s.y < r.top - 10 || s.x < r.left - 10); });
    await page.waitForTimeout(1800);
    check(await Q(page, () => { const b = __hw.G.buildings.find((x) => x.type === 'woodshed'); const s = __hw.view.screenOf('building', b.id); const r = document.getElementById('sheet').getBoundingClientRect(); return !!s && (s.y < r.top + 20 || s.x < r.left); }), 'the camera brings the selected building into the free part of the screen');
    await tapSel('#sheet-close');
    await until(page, () => document.getElementById('sheet').hidden, '✕ closes the sheet');

    // ---- pause stays open after the finger lifts
    await tapSel('#btn-pause');
    await until(page, () => !document.getElementById('pause').hidden, 'tapping ☰ opens the menu');
    await page.waitForTimeout(300);
    check(await Q(page, () => !document.getElementById('pause').hidden), 'the menu stays open after the finger lifts');
    await tapSel('#pause-menu [data-act="resume"]');
    await until(page, () => document.getElementById('pause').hidden, 'a tap on Resume closes it');
    reportErrors(`phone ${w}×${h}`);
}
const innerWidth_ = (w) => w;

// ======================================================================
async function nostorage() {
    console.log('\n== blocked storage');
    const page = await open({ width: 1280, height: 760 }, { nostorage: true });
    await click(page, '#title-menu [data-act="new"]');
    await until(page, () => __hw.mode === 'play', 'boots and starts a town with localStorage throwing');
    await Q(page, () => __hw.ff(30));
    check(await Q(page, () => __hw.save() === false), 'saving fails quietly');
    check(await Q(page, () => document.getElementById('btn-continue').hidden), 'there is nothing to continue');
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

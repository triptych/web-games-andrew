/**
 * browsertest.mjs — Alchemist's Lattice in real Chromium (SwiftShader WebGL), driven by real input.
 *
 * desktop (1280×760): the title with no errors and the ← Games link on top → Begin (a real click) →
 *   the opening scene clicked through, a choice taken → the map: Travel here → the brief → a real
 *   mouse drag places a tile → a click on a tile then a click on the lattice places one → the
 *   keyboard (digit, arrows, Space) places one → a drag that completes a row clears it → Escape
 *   pauses and the level stops; a real Space on Resume → the Catalyst by key → the bot wins the
 *   level → the result → back on the map, moved on → the cauldron (a real click learns a tile type)
 *   → skills (a real click trains one) → the journal → Save & Quit → Continue restores the map → a
 *   shop visit and a purchase → the final boss won → the ending screen → the open road.
 *   Every painting the game asks for loads. No sideways scroll; the canvas fills the window.
 * phones (touch only, real CDP touches) at 390×844 and 844×390: taps through the title, the scene and
 *   the map, a touch drag places a tile (it floats above the finger), a tap then a tap places one,
 *   controls are at least 44 px and on screen, the pause screen stays open after the finger lifts.
 * nostorage: localStorage throws; the game still boots and plays.
 * Fails on any console error, page error or failed request. The repo is served from disk (serve.mjs).
 *
 *   node game-027/dev/browsertest.mjs
 *   ONLY=desktop,phones,nostorage node game-027/dev/browsertest.mjs
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { launch, serve, BASE } from './serve.mjs';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const OUT = path.join(HERE, 'shots');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const want = (name) => !ONLY.length || ONLY.includes(name);
fs.mkdirSync(OUT, { recursive: true });

let fails = 0, passes = 0;
let errors = [];
let browser = null;
const ok = (c, msg) => { if (c) passes++; else { fails++; console.log('  ✗', msg); } };
const shot = (page, name) => page.screenshot({ path: path.join(OUT, `bt-${name}.png`) });

async function open(viewport, { touch = false, nostorage = false, url = '?debug=1' } = {}) {
    if (browser) await browser.close();
    browser = await launch();
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch });
    await ctx.addInitScript((ns) => {
        if (ns) Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } });
        else if (!sessionStorage.getItem('kept')) { try { localStorage.clear(); } catch { /* */ } sessionStorage.setItem('kept', '1'); }
    }, nostorage);
    const page = await ctx.newPage();
    await serve(page);
    errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(m.text()); });
    page.on('pageerror', (e) => errors.push(e.message));
    page.on('requestfailed', (r) => errors.push('request failed ' + r.url()));
    page.on('response', (r) => { if (r.status() >= 400) errors.push(`${r.status()} ${r.url()}`); });
    await page.goto(`${BASE}/game-027/index.html${url}`);
    await page.waitForFunction(() => window.__al && window.__al.frames > 3, null, { timeout: 90000 });
    return page;
}
const until = (page, fn, arg, ms = 30000) => page.waitForFunction(fn, arg, { timeout: ms }).then(() => true, () => false);
const ev = (page, f, a) => page.evaluate(f, a);
/** Wait until the level takes input (no queued events, no screen, a few frames in). */
async function ready(page) {
    await until(page, () => { const a = window.__al; return a.mode === 'level' && !a.dlg && !a.ui.anyScreen() && a.G.level && a.G.level.events.length === 0; });
    const f = await ev(page, () => window.__al.frames);
    await until(page, (f0) => window.__al.frames > f0 + 2, f);
}
/** Client px of a cell centre, and of a hand slot. */
const cellAt = (page, x, y) => ev(page, ([x, y]) => window.__al.view.toScreen(x + 0.5, y + 0.5), [x, y]);
const slotAt = (page, k) => ev(page, (k) => { const v = window.__al.view; const s = v.slots[k]; return v.toScreen(s.x, s.y); }, k);
/** An empty spot where hand tile `slot` fits: { x, y } top-left, or null. */
const spotFor = (page, slot) => ev(page, (slot) => {
    const L = window.__al.G.level, h = L.hand[slot];
    if (!h) return null;
    const w = Math.max(...h.cells.map((c) => c[0])) + 1, hh = Math.max(...h.cells.map((c) => c[1])) + 1;
    for (let y = 0; y + hh <= 9; y++) for (let x = 0; x + w <= 9; x++) {
        if (h.cells.every(([cx, cy]) => { const i = (y + cy) * 9 + x + cx; return !L.cells[i] && L.foeAt[i] < 0; })) return { x, y, w, h: hh };
    }
    return null;
}, slot);
/** Click through every queued scene with real clicks (choices take their first answer). */
async function clickScenes(page, tap = null) {
    for (let k = 0; k < 60; k++) {
        const d = await ev(page, () => !!window.__al.dlg);
        if (!d) { await page.waitForTimeout(150); if (!(await ev(page, () => !!window.__al.dlg))) return; continue; }
        const choice = await page.$('#dlg-choices button');
        if (choice) { if (tap) await tap(choice); else await choice.click(); }
        else if (tap) { const b = await (await page.$('.dlg-box')).boundingBox(); await tap({ x: b.x + b.width / 2, y: b.y + 20 }); }
        else await page.click('.dlg-box');
        await page.waitForTimeout(60);
    }
}

// ============================================================================ desktop
if (want('desktop')) {
    console.log('desktop');
    const page = await open({ width: 1280, height: 760 });
    ok(await page.isVisible('#title'), 'the title');
    const back = await page.$eval('#back-link', (a) => { const r = a.getBoundingClientRect(); return document.elementFromPoint(r.x + 5, r.y + 5) === a; });
    ok(back, 'the ← Games link is on top');
    await shot(page, 'title');
    await page.click('#btn-new');
    ok(await until(page, () => window.__al.dlg === 'ch1-intro'), 'the opening scene');
    ok(await page.isVisible('#dlg-face'), 'a portrait');
    await clickScenes(page);
    ok(await until(page, () => window.__al.mode === 'map' && !window.__al.dlg), 'the map');
    await shot(page, 'map');
    ok(await page.isVisible('#map-info .go'), 'the first node is offered');
    await page.click('#map-info .go');
    ok(await until(page, () => window.__al.mode === 'level' && window.__al.G.level?.name === 'The First Stir'), 'the first level');
    ok(await until(page, () => window.__al.ui.is('brief')), 'its brief');
    await page.click('#brief-go');
    await ready(page);

    // a real mouse drag
    let m0 = await ev(page, () => window.__al.G.level.moves);
    let s = await spotFor(page, 0);
    let from = await slotAt(page, 0);
    let to = await cellAt(page, s.x + (s.w - 1) / 2, s.y + (s.h - 1) / 2);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    for (let k = 1; k <= 8; k++) await page.mouse.move(from.x + ((to.x - from.x) * k) / 8, from.y + ((to.y - from.y) * k) / 8);
    await page.waitForTimeout(120);
    await page.mouse.up();
    ok(await until(page, (m) => window.__al.G.level.moves === m + 1, m0, 8000), 'a mouse drag places a tile');
    // a click then a click
    await ready(page);
    m0 = await ev(page, () => window.__al.G.level.moves);
    const slot = await ev(page, () => window.__al.G.level.hand.findIndex(Boolean));
    s = await spotFor(page, slot);
    from = await slotAt(page, slot);
    await page.mouse.click(from.x, from.y);
    to = await cellAt(page, s.x + Math.floor((s.w - 1) / 2), s.y + Math.floor((s.h - 1) / 2));
    await page.mouse.click(to.x, to.y);
    ok(await until(page, (m) => window.__al.G.level.moves === m + 1, m0, 8000), 'a click on a tile, then on the lattice, places it');
    // the keyboard
    await ready(page);
    m0 = await ev(page, () => window.__al.G.level.moves);
    const ks = await ev(page, () => window.__al.G.level.hand.findIndex(Boolean));
    await page.keyboard.press(`Digit${ks + 1}`);
    await page.waitForTimeout(150);
    await page.keyboard.press('ArrowRight');
    await page.waitForTimeout(150);
    await page.keyboard.press('ArrowLeft');
    await page.waitForTimeout(150);
    await page.keyboard.press('Space');
    ok(await until(page, (m) => window.__al.G.level.moves === m + 1, m0, 8000), 'digit, arrows and Space place a tile');
    // a drag that completes a row clears it
    await ready(page);
    const setup = await ev(page, () => {
        const L = window.__al.G.level;
        L.hand[0] = { uid: 900, shape: 'mono', el: 'ember', cells: [[0, 0]] };
        for (let c = 0; c < 9; c++) { const i = 8 * 9 + c; L.foeAt[i] = -1; L.cells[i] = c === 4 ? 0 : 1; }
        return window.__al.seen.clear || 0;
    });
    from = await slotAt(page, 0);
    to = await cellAt(page, 4, 8);
    await page.mouse.move(from.x, from.y);
    await page.mouse.down();
    for (let k = 1; k <= 8; k++) await page.mouse.move(from.x + ((to.x - from.x) * k) / 8, from.y + ((to.y - from.y) * k) / 8);
    await page.waitForTimeout(120);
    await page.mouse.up();
    ok(await until(page, (n) => (window.__al.seen.clear || 0) > n, setup, 8000), 'a drag that completes a row clears it');
    await page.waitForTimeout(400);
    await shot(page, 'clear');
    // pause
    await ready(page);
    await page.keyboard.press('Escape');
    ok(await until(page, () => window.__al.ui.is('pause')), 'Escape pauses');
    const mv = await ev(page, () => window.__al.G.level.moves);
    await page.waitForTimeout(300);
    ok(await ev(page, (m) => window.__al.G.level.moves === m, mv), 'nothing moves while paused');
    await page.keyboard.press('Space');
    ok(await until(page, () => !window.__al.ui.is('pause')), 'Space on the focused Resume');
    // an item by key
    await ready(page);
    const cat = await ev(page, () => window.__al.G.level.items.catalyst || 0);
    await page.keyboard.press('Digit5');
    ok(await until(page, (c) => (window.__al.G.level.items.catalyst || 0) === c - 1, cat, 8000), 'the Catalyst by its key');
    // the bot finishes the level
    await ev(page, () => window.__al.autoplay(true, 1));
    ok(await until(page, () => window.__al.ui.is('result'), null, 240000), 'the level ends, the result shows');
    await ev(page, () => window.__al.autoplay(false));
    const won = await ev(page, () => window.__al.G.reward.won);
    await shot(page, 'result');
    await page.click('#result-ok');
    ok(await until(page, () => window.__al.mode === 'map'), 'back to the map');
    await clickScenes(page);
    if (won) ok(await ev(page, () => window.__al.G.at === 'n0_0'), 'moved on along the map');
    // cauldron, skills, journal
    await ev(page, () => { const G = window.__al.G; G.stores.salt = 4; G.stores.ember = 4; G.xp = 300; });
    await page.click('.map-bar [data-open=cauldron]');
    ok(await until(page, () => window.__al.ui.is('cauldron')), 'the cauldron opens');
    await clickScenes(page);
    const n0 = await ev(page, () => window.__al.G.shapes.length);
    await page.click('[data-learn]:not([disabled])');
    ok(await until(page, (n) => window.__al.G.shapes.length === n + 1, n0), 'a click learns a tile type');
    await shot(page, 'cauldron');
    await page.click('#cauldron [data-close]');
    await page.click('.map-bar [data-open=skills]');
    await page.click('[data-train="swap"]');
    ok(await until(page, () => window.__al.G.skills.includes('swap')), 'a click trains Tile Swap');
    await page.click('#skills [data-close]');
    await page.click('.map-bar [data-open=journal]');
    ok(await until(page, () => window.__al.ui.is('journal')), 'the journal');
    await page.click('#journal [data-close]');
    // save, quit, continue
    const at = await ev(page, () => window.__al.G.at);
    await page.click('.map-bar [data-open=pause]');
    await page.click('#pause-menu [data-act=quit]');
    ok(await until(page, () => window.__al.mode === 'title'), 'Save & Quit');
    ok(await page.isVisible('#btn-continue'), 'Continue is offered');
    await page.click('#btn-continue');
    ok(await until(page, (a) => window.__al.mode === 'map' && window.__al.G.at === a, at), 'Continue restores the map');
    await clickScenes(page);
    // a shop: put one in reach and buy something
    await ev(page, () => {
        const G = window.__al.G, nx = G.map.edges.filter((e) => e.from === (G.at || G.map.entry));
        if (!G.at) G.at = G.map.entry;
        const id = G.map.edges.find((e) => e.from === G.at).to;
        for (const l of G.map.layers) for (const n of l) if (n.id === id) n.type = 'shop';
        G.gold = 200;
        window.__al.toMap();
        return nx.length;
    });
    const shopId = await ev(page, () => window.__al.G.map.edges.find((e) => e.from === window.__al.G.at).to);
    await page.click(`.node[data-id="${shopId}"]`);
    await page.click('#map-info .go');
    ok(await until(page, () => window.__al.mode === 'shop'), 'the shop');
    await clickScenes(page);
    await page.click('[data-buy="dissolvent"]');
    ok(await until(page, () => window.__al.G.gold < 200), 'a purchase');
    await shot(page, 'shop');
    await page.click('#shop-leave');
    ok(await until(page, () => window.__al.mode === 'map'), 'leave the stall');
    // the last boss, won by the bot, and the ending
    await ev(page, () => {
        const a = window.__al, G = a.G;
        a.skipScenes();
        G.chapter = 3; G.tier = 3; G.seen['ch3-intro'] = true;
        G.items = { tonic: 3, dissolvent: 3, catalyst: 3 };
        G.skills = ['swap', 'steady', 'affinity', 'sight', 'surge', 'overflow', 'reclaim'];
        G.shapes = ['mono', 'domH', 'domV', 'triH', 'triV', 'bendA', 'bendB', 'bendC', 'bendD', 'square', 'tetH', 'tetV', 'tetT', 'tetL', 'tetJ'];
        G.at = G.map.edges.find((e) => e.to === G.map.boss).from;
        a.toMap();
        a.go(G.map.boss);
    });
    await clickScenes(page);
    ok(await until(page, () => window.__al.G.level?.boss), 'the Ashen Homunculus');
    await page.click('#brief-go').catch(() => {});
    await shot(page, 'boss');
    await ev(page, () => window.__al.autoplay(true, 1));
    let bossWon = false;
    for (let k = 0; k < 3 && !bossWon; k++) {
        ok(await until(page, () => window.__al.ui.is('result'), null, 300000), 'the boss level ends');
        bossWon = await ev(page, () => window.__al.G.reward.won);
        await page.click('#result-ok');
        if (!bossWon) {
            await clickScenes(page);
            await ev(page, () => { const a = window.__al, G = a.G; a.skipScenes(); G.at = G.map.edges.find((e) => e.to === G.map.boss).from; a.toMap(); a.go(G.map.boss); });
            await clickScenes(page);
            await page.click('#brief-go').catch(() => {});
        }
    }
    await ev(page, () => window.__al.autoplay(false));
    ok(bossWon, 'the boss falls');
    await clickScenes(page);
    ok(await until(page, () => window.__al.ui.is('ending')), 'the ending');
    await shot(page, 'ending');
    await page.click('#ending-on');
    ok(await until(page, () => window.__al.mode === 'map' && window.__al.G.chapter === 4), 'the open road');
    // every painting asked for arrived
    const failed = await ev(page, () => window.__al.art.failed);
    ok(!failed.length, `every painting loads (${failed.join(', ')})`);
    const wide = await ev(page, () => document.documentElement.scrollWidth <= innerWidth && document.getElementById('view').getBoundingClientRect().width === innerWidth);
    ok(wide, 'no sideways scroll; the canvas fills the window');
    ok(!errors.length, 'no console errors: ' + errors.slice(0, 5).join(' | '));
}

// ============================================================================ phones
async function touchDrag(page, cdp, a, b) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: a.x, y: a.y }] });
    for (let k = 1; k <= 10; k++) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: a.x + ((b.x - a.x) * k) / 10, y: a.y + ((b.y - a.y) * k) / 10 }] });
        await page.waitForTimeout(16);
    }
    await page.waitForTimeout(100);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
if (want('phones')) {
    for (const vp of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
        console.log(`phone ${vp.width}×${vp.height}`);
        const page = await open(vp, { touch: true });
        const cdp = await page.context().newCDPSession(page);
        const tap = async (target) => {
            const p = target.boundingBox ? await target.boundingBox().then((b) => ({ x: b.x + b.width / 2, y: b.y + b.height / 2 })) : target;
            await page.touchscreen.tap(p.x, p.y);
        };
        await tap(await page.$('#btn-new'));
        ok(await until(page, () => !!window.__al.dlg), 'a tap begins');
        await clickScenes(page, tap);
        ok(await until(page, () => window.__al.mode === 'map'), 'the map');
        await shot(page, `phone-map-${vp.width}`);
        const small = await ev(page, () => [...document.querySelectorAll('.map-bar .btn, #map-info .go, .node.open')].filter((b) => b.offsetParent).map((b) => b.getBoundingClientRect()).filter((r) => r.width < 44 || r.height < 40 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1).length);
        ok(small === 0, 'map controls are big enough and on screen');
        await tap(await page.$('#map-info .go'));
        ok(await until(page, () => window.__al.ui.is('brief')), 'a tap travels');
        await tap(await page.$('#brief-go'));
        await ready(page);
        // a touch drag
        let m0 = await ev(page, () => window.__al.G.level.moves);
        const s = await spotFor(page, 0);
        const from = await slotAt(page, 0);
        // the tile floats above the finger: aim the finger below where it should land
        const lift = await ev(page, (h) => window.__al.view.cellPx() * (h / 2 + 1.1), s.h);
        const to = await cellAt(page, s.x + s.w / 2 - 0.5, s.y + s.h / 2 - 0.5);
        await touchDrag(page, cdp, from, { x: to.x, y: to.y + lift });
        ok(await until(page, (m) => window.__al.G.level.moves === m + 1, m0, 8000), 'a touch drag places a tile');
        // a tap then a tap
        await ready(page);
        m0 = await ev(page, () => window.__al.G.level.moves);
        const sl = await ev(page, () => window.__al.G.level.hand.findIndex(Boolean));
        const s2 = await spotFor(page, sl);
        await tap(await slotAt(page, sl));
        await page.waitForTimeout(150);
        await tap(await cellAt(page, s2.x + Math.floor((s2.w - 1) / 2), s2.y + Math.floor((s2.h - 1) / 2)));
        ok(await until(page, (m) => window.__al.G.level.moves === m + 1, m0, 8000), 'a tap then a tap places a tile');
        const cell = await ev(page, () => window.__al.view.cellPx());
        ok(cell >= (vp.width < vp.height ? 34 : 26), `cells are big enough (${cell.toFixed(1)} px)`);
        const bad = await ev(page, () => [...document.querySelectorAll('#btn-pause, .tool')].filter((b) => b.offsetParent).map((b) => b.getBoundingClientRect()).filter((r) => r.width < 44 || r.height < 44 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1 || r.left < -1).length);
        ok(bad === 0, 'level controls are at least 44 px and on screen');
        // the HUD leaves the lattice clear
        const clear = await ev(page, () => { const v = window.__al.view; const a = v.toScreen(0, 0); const hud = document.getElementById('hud').getBoundingClientRect(); return a.y >= hud.bottom - 4 || a.x >= hud.right - 4; });
        ok(clear, 'the HUD leaves the lattice clear');
        await shot(page, `phone-level-${vp.width}`);
        await tap(await page.$('#btn-pause'));
        await page.waitForTimeout(400);
        ok(await ev(page, () => window.__al.ui.is('pause')), 'pause stays open after the finger lifts');
        ok(await ev(page, () => document.documentElement.scrollWidth <= innerWidth), 'no sideways scroll');
        ok(!errors.length, 'no console errors: ' + errors.slice(0, 5).join(' | '));
    }
}

// ============================================================================ blocked storage
if (want('nostorage')) {
    console.log('nostorage');
    const page = await open({ width: 1000, height: 700 }, { nostorage: true });
    await page.click('#btn-new');
    await clickScenes(page);
    await page.click('#map-info .go');
    await page.click('#brief-go');
    await ready(page);
    const m0 = await ev(page, () => window.__al.G.level.moves);
    await ev(page, () => window.__al.ff(3));
    ok(await ev(page, (m) => window.__al.G.level.moves > m, m0), 'plays with storage blocked');
    ok(!errors.length, 'no console errors: ' + errors.slice(0, 5).join(' | '));
}

if (browser) await browser.close();
console.log(`\n${fails ? '✗' : '✓'} ${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);

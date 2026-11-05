/**
 * browsertest.mjs — the real game in real Chromium (SwiftShader WebGL).
 *
 * desktop (1280×760): boot to the title with no errors, the ← Games link on top → New Game by click →
 *   a real click on a generator harvests it → a real mouse drag merges two seeds → click-to-select then
 *   click-to-merge → the keyboard cursor (arrows, Space) → Escape pauses and the sim stops → Resume →
 *   Serve by clicking a guest and by dragging a dish onto one → drag to the compost bin → a new table
 *   (stars) brings a generator → cookbook icons draw → the shop → Save & Quit → Continue restores the
 *   game → the bot plays the whole Dinner Plan and the ending screen opens.
 * phones (touch only, real CDP touches) at 390×844 and 844×390: taps through the title, the HUD fits and
 *   nothing covers the board, tap harvests, a touch drag merges (the dish rides above the finger), tap
 *   selects and merges, tap serves, ❚❚ pauses and the sheet stays open when the finger lifts, controls
 *   ≥ 44 px, no sideways scroll, the canvas matches the visible viewport.
 * nostorage: localStorage throws; the game still boots and plays.
 * Fails on any console error, page error or failed request.
 *
 *   python3 -m http.server 8118          # from the REPO ROOT
 *   node game-118/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8118), ONLY=desktop,phones,nostorage, THREE_PKG, PW_CHROMIUM_PATH.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8118';
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
    await page.goto(`${BASE}/game-118/index.html?debug=1`);
    await page.waitForFunction(() => window.__kt && __kt.mode === 'title', null, { timeout: 60000 });
    return page;
}

const check = (cond, msg) => { if (!cond) { fails++; console.log('  FAIL', msg); } else console.log('  ok', msg); return cond; };
const Q = (page, fn, arg) => page.evaluate(fn, arg);
const shot = async (page, name) => { await page.screenshot({ path: path.join(OUT, `bt-${name}.png`) }); };
// SwiftShader draws a few frames a second: wait on state, never on the clock.
const until = (page, fn, msg, timeout = 30000, arg = null) =>
    page.waitForFunction(fn, arg, { timeout, polling: 100 }).then(() => check(true, msg), () => check(false, msg));
// Playwright's click() waits for animation frames to settle, which SwiftShader never does; click from inside.
const click = (page, sel) => Q(page, (s) => { const e = document.querySelector(s); if (!e) return false; e.click(); return true; }, sel);
// ...or, for a real pointer, click the middle of the element with the mouse
const mouseClick = async (page, sel) => {
    const r = await Q(page, (s) => { const e = document.querySelector(s); if (!e) return null; e.scrollIntoView({ block: 'center' }); const b = e.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, sel);
    if (!r) return false;
    await page.mouse.click(r.x, r.y);
    return true;
};
const settle = (page, msg = 'the scene settles') => until(page, () => {
    const K = window.__kt;
    return K.G.events.length === 0 && !K.view.busy && K.view.items.size === K.G.cells.filter(Boolean).length;
}, msg);
const cell = (c, r) => r * 6 + c;
const at = (page, i, y = 0.19) => Q(page, ([i2, y2]) => __kt.cellClient(i2, y2), [i, y]);
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
const clear = (page) => Q(page, () => { __kt.G.cells.fill(null); });   // an empty table, for staged setups
const setup = (page, items) => Q(page, (list) => { for (const [i, c, t] of list) __kt.place(i, c, t); }, items);
// every finished animation, so a pop-in can't leave a button half drawn when the test taps it
const finishAnims = (page) => Q(page, () => document.getAnimations().forEach((a) => { try { a.finish(); } catch { /* infinite */ } }));

// ======================================================================
async function desktop() {
    console.log('\n== desktop 1280×760');
    const page = await open({ width: 1280, height: 760 });
    check(await backLinkOk(page), '← Games link is on top and points at ../index.html');
    check(await Q(page, () => !document.getElementById('title').hidden), 'title screen is up');
    check(await Q(page, () => document.getElementById('btn-continue').hidden), 'no Continue without a save');
    check(await Q(page, () => document.querySelectorAll('#over-title').length === 0), 'no element id collides with a screen heading id');
    const L = await layout(page);
    check(L.noHScroll && L.canvas, 'no sideways scroll; the canvas fills the window');
    await until(page, () => __kt.view.items.size >= 4, 'the title shows a live board with items on it');
    await shot(page, 'desktop-title');

    await mouseClick(page, '#btn-new');
    await until(page, () => __kt.mode === 'play' && document.getElementById('title').hidden && !document.getElementById('hud').hidden, 'New Game starts play and shows the HUD');
    await Q(page, () => __kt.start(21));
    await settle(page, 'the first table settles');
    check(await Q(page, () => document.querySelectorAll('#guests .guest[data-q]').length === 3), 'three guest cards are showing');
    check(await Q(page, () => [...document.querySelectorAll('#guests .want img')].every((i) => i.src.startsWith('data:image/png') && i.src.length > 500)), 'every ordered dish has a drawn icon');

    // harvest a generator with a real click
    const gen = await Q(page, () => __kt.G.cells.findIndex((c) => c && c.k === 'gen' && c.c === 'pumpkin'));
    const p0 = await at(page, gen);
    const charges0 = await Q(page, (g) => __kt.G.cells[g].ch, gen);
    await page.mouse.click(p0.x, p0.y);
    await until(page, ([g, c]) => __kt.seen.spawn >= 1 && __kt.G.cells[g].ch === c - 1, 'a click on the Pumpkin Patch harvests one charge', 30000, [gen, charges0]);
    await settle(page);

    // a real drag merges two seeds
    await clear(page);
    await setup(page, [[cell(2, 2), 'pumpkin', 1], [cell(3, 2), 'pumpkin', 1], [cell(1, 5), 'pumpkin', 'gen']]);
    await settle(page);
    const a = await at(page, cell(2, 2)), b = await at(page, cell(3, 2));
    await page.mouse.move(a.x, a.y);
    await page.mouse.down();
    await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 4 });
    await page.mouse.move(b.x, b.y, { steps: 4 });
    check(await Q(page, () => __kt.view.drag !== null && __kt.view.marks.targets.length === 1), 'dragging a seed lights the one place it can merge');
    await page.mouse.up();
    await until(page, (t) => __kt.seen.merge >= 1 && __kt.G.cells[t] && __kt.G.cells[t].t === 2 && !__kt.G.cells[t - 1], 'dropping a seed on a seed merges them into a sprout', 30000, cell(3, 2));
    await settle(page);

    // tap to select, tap to merge
    await setup(page, [[cell(1, 2), 'craft', 2], [cell(4, 2), 'craft', 2]]);
    await settle(page);
    const s1 = await at(page, cell(1, 2)), s2 = await at(page, cell(4, 2));
    await page.mouse.click(s1.x, s1.y);
    await until(page, (c) => __kt.board.selected === c, 'a click selects an item', 30000, cell(1, 2));
    await until(page, () => !document.getElementById('tip').hidden && /Paper Leaf/.test(document.getElementById('tip').textContent), 'and the tip says what it is');
    await page.mouse.click(s2.x, s2.y);
    await until(page, (t) => __kt.G.cells[t] && __kt.G.cells[t].t === 3 && __kt.G.cells[t].c === 'craft', 'a second click on its twin merges them into a place card', 30000, cell(4, 2));
    await settle(page);

    // the keyboard cursor
    await page.keyboard.press('ArrowRight');
    await until(page, () => __kt.board.cursor === 2 + 3 * 6, 'the first arrow key puts the cursor on the board');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowDown');
    await page.keyboard.press('ArrowLeft');
    await until(page, (c) => __kt.board.cursor === c, 'arrows walk the cursor over open cells (here onto the patch)', 30000, cell(1, 5));
    const sp = await Q(page, () => __kt.seen.spawn || 0);
    await page.keyboard.press('Space');
    await until(page, (n) => (__kt.seen.spawn || 0) > n, 'Space on a generator harvests it (the press reaches the sim)', 30000, sp);
    await page.keyboard.press('ArrowUp');
    await page.keyboard.press('ArrowRight');
    await shot(page, 'desktop-play');

    // pause
    const t0 = await Q(page, () => __kt.G.t);
    await page.keyboard.press('Escape');
    await until(page, () => !document.getElementById('pause').hidden, 'Escape pauses');
    await page.waitForTimeout(700);
    check(await Q(page, (t) => __kt.G.t === t, t0), 'the clock stops while paused');
    await finishAnims(page);
    await mouseClick(page, '#pause-menu [data-act="settings"]');
    await until(page, () => !document.getElementById('settings').hidden && Number(getComputedStyle(document.getElementById('settings')).zIndex) > Number(getComputedStyle(document.getElementById('pause')).zIndex), 'Settings opens on top of the pause menu');
    await page.keyboard.press('Escape');
    await until(page, () => document.getElementById('settings').hidden && !document.getElementById('pause').hidden, 'Escape closes just Settings');
    await mouseClick(page, '#pause-menu [data-act="resume"]');
    await until(page, () => document.getElementById('pause').hidden, 'Resume closes the pause menu');

    // serve by clicking a guest
    await clear(page);
    const q0 = await Q(page, () => { const q = __kt.G.guests[0]; return { id: q.id, wants: q.wants, coins: q.coins }; });
    let k = 0;
    await setup(page, q0.wants.flatMap((w) => Array.from({ length: w.n }, () => [cell(1 + (k++ % 4), 2), w.c, w.t])));
    await settle(page);
    await until(page, (id) => document.querySelector(`#guests .guest.ready[data-q="${id}"]`) !== null, 'a guest turns ready when their dishes are on the table', 30000, q0.id);
    const coins0 = await Q(page, () => __kt.G.coins);
    await finishAnims(page);
    await mouseClick(page, `#guests .guest[data-q="${q0.id}"]`);
    await until(page, ([id, c0, add]) => __kt.seen.serve >= 1 && __kt.G.coins >= c0 + add && !__kt.G.guests.some((g) => g && g.id === id), 'clicking a ready guest serves them and pays', 30000, [q0.id, coins0, q0.coins]);
    await settle(page);

    // serve by dragging a dish onto a guest
    await until(page, () => __kt.G.guests.every(Boolean), 'the guest seat refills');
    await clear(page);
    const q1 = await Q(page, () => { const q = __kt.G.guests[1]; return { id: q.id, wants: q.wants }; });
    k = 0;
    await setup(page, q1.wants.flatMap((w) => Array.from({ length: w.n }, () => [cell(1 + (k++ % 4), 3), w.c, w.t])));
    await settle(page);
    await until(page, (id) => document.querySelector(`#guests .guest.ready[data-q="${id}"]`) !== null, 'the second guest turns ready (and the cards stop redrawing)', 30000, q1.id);
    const dish = await at(page, cell(1, 3)), card = await Q(page, () => __kt.cardPoint(1));
    const served0 = await Q(page, () => __kt.seen.serve || 0);
    await page.mouse.move(dish.x, dish.y);
    await page.mouse.down();
    await page.mouse.move((dish.x + card.x) / 2, (dish.y + card.y) / 2, { steps: 4 });
    await page.mouse.move(card.x, card.y, { steps: 4 });
    await until(page, () => document.querySelector('#guests .guest.hot') !== null, 'a card lights up while a dish is over it');
    await page.mouse.up();
    await until(page, (n) => (__kt.seen.serve || 0) > n, 'dropping a dish on a guest serves them', 30000, served0);
    await settle(page);

    // compost by dragging to the bin
    await clear(page);
    await setup(page, [[cell(2, 3), 'grain', 4]]);
    await settle(page);
    const junk = await at(page, cell(2, 3)), bin = await Q(page, () => { const r = document.getElementById('d-compost').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await page.mouse.move(junk.x, junk.y);
    await page.mouse.down();
    await page.mouse.move((junk.x + bin.x) / 2, (junk.y + bin.y) / 2, { steps: 4 });
    await page.mouse.move(bin.x, bin.y, { steps: 4 });
    await page.mouse.up();
    await until(page, () => (__kt.seen.compost || 0) >= 1 && !__kt.G.cells[2 + 3 * 6], 'dropping a dish on the compost bin clears the cell', 30000);
    await settle(page);

    // a bigger table
    await Q(page, () => __kt.set({ stars: 3 }));
    await until(page, () => !document.querySelector('#d-table .badge').hidden, 'the Table button shows a badge once a table is affordable');
    await finishAnims(page);
    await mouseClick(page, '#d-table');
    await until(page, () => !document.getElementById('tables').hidden && document.querySelector('#tables [data-up]') !== null, 'the Tables sheet opens with an upgrade button');
    await finishAnims(page);
    await mouseClick(page, '#tables [data-up]');
    await until(page, () => __kt.G.table === 1 && __kt.G.cells.some((c) => c && c.k === 'gen' && c.c === 'turkey') && (__kt.seen.upgrade || 0) >= 1, 'upgrading opens the Card Table and brings the Turkey Coop', 30000);
    await Q(page, () => document.querySelector('#tables [data-close]').click());

    // the cookbook draws every chain from the real models
    await finishAnims(page);
    await mouseClick(page, '#d-book');
    await until(page, () => document.querySelectorAll('#book-body .tier img').length === 24 && [...document.querySelectorAll('#book-body .tier img')].every((i) => i.src.startsWith('data:image/png') && i.naturalWidth > 0), 'the cookbook shows all 24 dishes, each drawn');
    await shot(page, 'desktop-cookbook');
    await Q(page, () => document.querySelector('#book [data-close]').click());

    // the shop
    await Q(page, () => __kt.set({ coins: 200 }));
    await finishAnims(page);
    await mouseClick(page, '#d-shop');
    await until(page, () => !document.getElementById('shop').hidden && document.querySelector('#shop [data-buy="basket"]:not(:disabled)') !== null, 'the shop opens with a basket to buy');
    await finishAnims(page);
    await mouseClick(page, '#shop [data-buy="basket"]');
    await until(page, () => (__kt.seen.basket || 0) >= 1, 'buying a mystery basket puts an item on the table');
    await Q(page, () => document.querySelector('#shop [data-close]').click());

    // goals
    await finishAnims(page);
    await mouseClick(page, '#d-plan');
    await until(page, () => !document.getElementById('plan').hidden && document.querySelectorAll('#plan .goal').length === 3, 'the Dinner Plan lists this course\'s three goals');
    await shot(page, 'desktop-plan');
    await Q(page, () => document.querySelector('#plan [data-close]').click());

    // save, quit, continue
    await page.keyboard.press('Escape');
    await until(page, () => !document.getElementById('pause').hidden, 'Escape pauses again');
    const snap = await Q(page, () => JSON.stringify({ c: __kt.G.coins, s: __kt.G.stars, t: __kt.G.table, cells: __kt.G.cells.map((x) => x && [x.k, x.c, x.t]) }));
    await finishAnims(page);
    await mouseClick(page, '#pause-menu [data-act="quit"]');
    await until(page, () => __kt.mode === 'title' && !document.getElementById('btn-continue').hidden, 'Save & Quit returns to the title with Continue');
    await finishAnims(page);
    await mouseClick(page, '#btn-continue');
    await until(page, () => __kt.mode === 'play', 'Continue starts play');
    check(await Q(page, () => JSON.stringify({ c: __kt.G.coins, s: __kt.G.stars, t: __kt.G.table, cells: __kt.G.cells.map((x) => x && [x.k, x.c, x.t]) })) === snap, 'Continue restores exactly the saved table');

    // the whole Dinner Plan, played by the bot, ends in the dinner
    await Q(page, () => __kt.start(5));
    await Q(page, () => { for (let i = 0; i < 60 && !__kt.G.won; i++) __kt.ff(120); });
    await until(page, () => __kt.G.won && !document.getElementById('win').hidden, 'the bot finishes all five courses and the ending screen opens');
    await shot(page, 'desktop-win');
    await finishAnims(page);
    await mouseClick(page, '#win-keep');
    await until(page, () => document.getElementById('win').hidden && __kt.mode === 'play', 'Seconds, please! closes the ending and play goes on');
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
    const tapCell = async (i) => { const p = await at(page, i); await page.touchscreen.tap(p.x, p.y); };

    check(await backLinkOk(page), '← Games link is on top');
    await tapSel('#btn-new');
    await until(page, () => __kt.mode === 'play', 'a tap on New Game starts play');
    await Q(page, () => __kt.start(33));
    await settle(page);

    const L = await layout(page);
    check(L.noHScroll, 'no sideways scroll');
    check(L.canvas, 'the canvas matches the visible viewport');

    const sizes = await Q(page, () => ['#btn-pause', '#d-compost', '#d-book', '#d-shop', '#d-table', '#d-plan', '#plan-pill', '#guests .guest'].map((s) => {
        const r = document.querySelector(s).getBoundingClientRect();
        return { s, ok: r.width >= 44 && r.height >= 44 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5 };
    }));
    for (const z of sizes) check(z.ok, `${z.s} is at least 44 px and on screen`);

    // nothing covers the board: every corner of the frame is visible and is the canvas, not a HUD panel
    const corners = await Q(page, () => [0, 5, 36, 41].map((i) => {
        const p = __kt.cellClient(i, 0.19);
        const el = document.elementFromPoint(p.x, p.y);
        return { i, x: Math.round(p.x), y: Math.round(p.y), onScreen: p.x > 0 && p.y > 0 && p.x < innerWidth && p.y < innerHeight, canvas: el && el.id === 'view' };
    }));
    for (const c of corners) check(c.onScreen && c.canvas, `board corner cell ${c.i} is on screen and not covered (${c.x}, ${c.y})`);
    const cellPx = await Q(page, () => { const a = __kt.cellClient(15, 0.19), b = __kt.cellClient(16, 0.19), c = __kt.cellClient(21, 0.19); return { w: Math.abs(b.x - a.x), h: Math.abs(c.y - a.y) }; });
    check(cellPx.w >= 36 && cellPx.h >= 28, `cells are big enough to hit with a finger (${Math.round(cellPx.w)} × ${Math.round(cellPx.h)} px)`);
    await shot(page, `phone-${w}x${h}`);

    // a tap harvests
    const gen = await Q(page, () => __kt.G.cells.findIndex((c) => c && c.k === 'gen' && c.c === 'craft'));
    await tapCell(gen);
    await until(page, () => (__kt.seen.spawn || 0) >= 1, 'a finger tap on the Craft Box harvests it');
    await settle(page);

    // a touch drag merges: the dish rides one row above the finger, so the finger goes one row below the target
    await clear(page);
    await setup(page, [[cell(2, 2), 'pumpkin', 1], [cell(3, 2), 'pumpkin', 1]]);
    await settle(page);
    const from = await at(page, cell(2, 2)), to = await Q(page, (i) => __kt.cellClient(i + 6, 0.59), cell(3, 2));
    await touch('touchStart', from.x, from.y);
    for (let i = 1; i <= 6; i++) await touch('touchMove', from.x + ((to.x - from.x) * i) / 6, from.y + ((to.y - from.y) * i) / 6);
    check(await Q(page, () => __kt.view.drag !== null && __kt.view.marks.targets.length === 1), 'a finger drag picks the seed up and lights where it can merge');
    await touch('touchEnd', 0, 0);
    await until(page, (t) => __kt.G.cells[t] && __kt.G.cells[t].t === 2 && !__kt.G.cells[t - 1], 'dropping it on the other seed merges them', 30000, cell(3, 2));
    await settle(page);

    // tap, tap
    await setup(page, [[cell(1, 3), 'turkey', 1], [cell(4, 3), 'turkey', 1]]);
    await settle(page);
    await tapCell(cell(1, 3));
    await until(page, (c) => __kt.board.selected === c, 'a tap selects an egg', 30000, cell(1, 3));
    await tapCell(cell(4, 3));
    await until(page, (t) => __kt.G.cells[t] && __kt.G.cells[t].t === 2 && __kt.G.cells[t].c === 'turkey', 'a tap on its twin merges them into a chick', 30000, cell(4, 3));
    await settle(page);

    // tap a guest to serve
    await clear(page);
    const q0 = await Q(page, () => { const q = __kt.G.guests[0]; return { id: q.id, wants: q.wants }; });
    let k = 0;
    await setup(page, q0.wants.flatMap((x) => Array.from({ length: x.n }, () => [cell(1 + (k++ % 4), 2), x.c, x.t])));
    await settle(page);
    await until(page, (id) => document.querySelector(`#guests .guest.ready[data-q="${id}"]`) !== null, 'the guest turns ready', 30000, q0.id);
    await finishAnims(page);
    await tapSel(`#guests .guest[data-q="${q0.id}"]`);
    await until(page, (id) => !__kt.G.guests.some((g) => g && g.id === id), 'a tap on a ready guest serves them', 30000, q0.id);
    await settle(page);

    // pause: a ❚❚ tap opens it and the sheet stays when the finger lifts
    await tapSel('#btn-pause');
    await until(page, () => !document.getElementById('pause').hidden, 'tapping ❚❚ pauses');
    await page.waitForTimeout(300);
    check(await Q(page, () => !document.getElementById('pause').hidden), 'the pause sheet stays open after the finger lifts');
    await finishAnims(page);
    await tapSel('#pause-menu [data-act="resume"]');
    await until(page, () => document.getElementById('pause').hidden, 'a tap on Resume closes it');

    // the cookbook, on a phone
    await finishAnims(page);
    await tapSel('#d-book');
    await until(page, () => !document.getElementById('book').hidden, 'tapping Cookbook opens it');
    const fits = await Q(page, () => { const r = document.querySelector('#book .sheet').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight + 1; });
    check(fits, 'the cookbook sheet fits the screen');
    await shot(page, `phone-${w}x${h}-book`);
    await finishAnims(page);
    await tapSel('#book [data-close]');
    await until(page, () => document.getElementById('book').hidden, 'and Close closes it');
    reportErrors(`phone ${w}×${h}`);
}

// ======================================================================
async function nostorage() {
    console.log('\n== blocked storage');
    const page = await open({ width: 1280, height: 760 }, { nostorage: true });
    await mouseClick(page, '#btn-new');
    await until(page, () => __kt.mode === 'play', 'boots and starts a game with localStorage throwing');
    await Q(page, () => __kt.ff(30));
    check(await Q(page, () => __kt.save() === false), 'saving fails quietly');
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

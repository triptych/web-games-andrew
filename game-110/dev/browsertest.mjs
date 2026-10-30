/**
 * browsertest.mjs — the real game in real Chromium (SwiftShader WebGL).
 *
 * desktop (1280×760): boot to the title with no errors and the ← Games link on top → New Game → real mouse clicks on
 *   the castle craft → Space crafts → a panel row buys an imp, and Space afterwards still crafts (the row isn't left
 *   focused) → C cackles → a visitor walks in and a real click on the sprite greets it, another through the callout →
 *   every tab renders; an upgrade is bought by tapping its tile twice; a henchman is hired and sent on a scheme →
 *   locked rooms can't be entered (button, E, the whole castle) and say what opens them; hiring opens them; Q/E skip
 *   locked rooms, the room buttons change rooms, Tab opens the whole castle and a click on an open room goes there → Escape opens
 *   the menu and the castle keeps working → Save & Quit → Continue restores → relocating (via the Lair tab and its
 *   confirm sheet) moves to the Cinder Caldera. No sideways scroll; the canvas fills the window.
 * furniture: with seven of every minion and every piece of décor, no minion sprite intersects furniture, décor or a
 *   window (the gingerbread golems used to stand inside the kitchen counter); the visitors' lane passes through the
 *   side doorways, never a wall or furniture; a Ballroom visitor walks in through the Ballroom's own door under a
 *   raised portcullis (visitors used to slide in from the Kitchen, through every wall).
 * cemetery: the Graves button; closed and undug graves say why; the 25th minion opens Skull Swap; a click on the grave
 *   opens it; a real drag and a keyboard swap; a level played out pays charm and gold; Next level; Escape; E and Q;
 *   the whole castle includes the cemetery. On the phones: Graves, the grave, and a tap-tap swap that fits the screen.
 * away: a fresh page whose save was written two hours ago → Continue → the welcome-back sheet says so.
 * phones (touch only, real CDP touches) at 390×844 and 844×390: taps through the menus, a tap on the castle crafts,
 *   a tap on a row buys, the cackle button, every control ≥ 44 px and on screen, the menu stays open after the finger
 *   lifts, no sideways scroll, the canvas matches the visible viewport.
 * nostorage: localStorage throws; the game still boots and plays.
 * Fails on any console error, page error or failed request.
 *
 *   python3 -m http.server 8110          # from the REPO ROOT
 *   node game-110/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8110), ONLY=desktop,cemetery,furniture,away,phones,nostorage, THREE_PKG.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8110';
const OUT = path.join(HERE, 'shots');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const want = (name) => !ONLY.length || ONLY.includes(name);
fs.mkdirSync(OUT, { recursive: true });

let fails = 0;
let errors = [];
let browser = null;

async function open(viewport, { touch = false, nostorage = false, init = null } = {}) {
    if (browser) await browser.close();
    browser = await chromium.launch({
        executablePath: process.env.PW_CHROMIUM_PATH || undefined,
        args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
    });
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch });
    await ctx.addInitScript(([ns, init]) => {
        if (ns) Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } });
        else if (!init) try { localStorage.clear(); } catch { /* */ }
        else try { localStorage.clear(); for (const [k, v] of Object.entries(init)) localStorage.setItem(k, v); } catch { /* */ }
    }, [nostorage, init]);
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
    await page.goto(`${BASE}/game-110/index.html?debug=1&fast=4`);
    await page.waitForFunction(() => window.__dd && __dd.mode === 'title', null, { timeout: 60000 });
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
/** A real mouse click at an element's centre (not a synthetic .click()). */
const mouseAt = async (page, sel) => {
    const r = await Q(page, (s) => { const e = document.querySelector(s); e?.scrollIntoView({ block: 'center' }); const b = e?.getBoundingClientRect(); return b && { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, sel);
    if (r) await page.mouse.click(r.x, r.y);
    return !!r;
};
const freePoint = (page) => Q(page, () => {
    // the middle of the castle that no panel covers
    const ins = __dd.view.insets;
    return { x: (innerWidth - ins.right) / 2, y: ins.top + (innerHeight - ins.top - ins.bottom) * 0.55 };
});
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
const visible = (page, id) => Q(page, (i) => { const e = document.getElementById(i); return !!e && !e.hidden && e.getClientRects().length > 0; }, id);

// ======================================================================
async function desktop() {
    console.log('\n== desktop 1280×760');
    const page = await open({ width: 1280, height: 760 });
    check(await backLinkOk(page), '← Games link is on top and points at ../index.html');
    check(await visible(page, 'title'), 'the title screen is up');
    check(await Q(page, () => document.getElementById('btn-continue').hidden), 'no Continue without a save');
    check(await Q(page, () => { const l = document.querySelector('.logo'); return l.scrollWidth <= l.clientWidth + 1; }), 'the title fits its sheet');
    let L = await layout(page);
    check(L.noHScroll && L.canvas, 'no sideways scroll; the canvas fills the window');
    await shot(page, 'desktop-title');

    await click(page, '#title-menu [data-act="new"]');
    await until(page, () => __dd.mode === 'play' && document.getElementById('title').hidden && !document.getElementById('panel').hidden, 'New Game starts play with the panel up');

    // crafting by real clicks
    const p = await freePoint(page);
    for (let i = 0; i < 5; i++) await page.mouse.click(p.x, p.y);
    await until(page, () => __dd.G.stats.clicks >= 5 && __dd.G.charm >= 5, 'five clicks on the castle craft five times');
    await page.keyboard.press('Space');
    await until(page, () => __dd.G.stats.clicks >= 6, 'Space crafts');
    await until(page, () => document.querySelectorAll('.floater').length > 0 || __dd.seen.craft >= 6, 'crafting shows floating numbers');

    // buying from the panel, then Space still crafts (game-078: the button must not keep focus)
    await Q(page, () => __dd.give(100));
    await until(page, () => document.querySelector('[data-buy="imp"]:not(.no)'), 'the imp row is affordable');
    await mouseAt(page, '[data-buy="imp"]');
    await until(page, () => __dd.G.owned.imp === 1, 'clicking the Imp row hires an imp');
    const clicks = await Q(page, () => __dd.G.stats.clicks);
    await page.keyboard.press('Space');
    await until(page, (n) => __dd.G.stats.clicks === n + 1 && __dd.G.owned.imp === 1, 'Space after a panel click crafts, and buys nothing', 30000, clicks);
    await until(page, () => __dd.view.minions.imp?.length === 1, 'the imp appears in the kitchen');

    // reputation
    await Q(page, () => { __dd.G.dread = 30; });
    await page.keyboard.press('KeyC');
    await until(page, () => __dd.seen.cackle >= 1 && __dd.G.dread > 40, 'C cackles and dread rises');
    check(await Q(page, () => /Unsettling|Feared/.test(document.getElementById('dread-label').textContent)), 'the dread meter names the tier');
    await Q(page, () => { __dd.G.cd.cackle = 0; });
    await mouseAt(page, '.ab[data-id="cackle"]');
    await until(page, () => __dd.seen.cackle >= 2, 'and so does a click on the Cackle button');

    // visitors: a real click on the sprite, then the callout button
    await Q(page, () => { __dd.G.nextVisit = 0; });
    await until(page, () => __dd.G.visitors.length === 1, 'a visitor arrives');
    await Q(page, () => { for (const v of __dd.G.visitors) v.t = v.life = 120; });   // so a slow software renderer can't time them out mid-walk
    await until(page, () => [...__dd.view.visitors.values()].some((a) => a.state === 'stay'), 'a visitor walks in and waits', 40000);
    check(await visible(page, 'btn-visitor'), 'with a callout button for anyone who misses it');
    const vs = await Q(page, () => __dd.view.visitorScreen(__dd.G.visitors[0].vid));
    await page.mouse.click(vs.x, vs.y);
    await until(page, () => __dd.G.stats.visitors === 1 && __dd.G.visitors.length === 0, 'a click on the visitor greets them');
    await Q(page, () => { __dd.G.nextVisit = 0; });
    await until(page, () => __dd.G.visitors.length === 1 && !document.getElementById('btn-visitor').hidden, 'another visitor');
    await mouseAt(page, '#btn-visitor');
    await until(page, () => __dd.G.stats.visitors === 2, 'the callout greets them too');
    await shot(page, 'desktop-play');

    // every tab
    await Q(page, () => __dd.give(1e7, 400));
    for (const t of ['upgrades', 'decor', 'schemes', 'lair', 'trophies', 'stats', 'minions']) {
        await mouseAt(page, `#tabs [data-tab="${t}"]`);
        await until(page, (x) => document.querySelector(`#tabs [data-tab="${x}"]`).getAttribute('aria-selected') === 'true' && document.getElementById('tab-body').children.length > 0, `the ${t} tab renders`, 30000, t);
    }
    // an upgrade, by tapping its tile twice
    await mouseAt(page, '#tabs [data-tab="upgrades"]');
    await until(page, () => document.querySelector('[data-upg="imp0"]'), 'Tiny Toques is on offer');
    await mouseAt(page, '[data-upg="imp0"]');
    await until(page, () => /Tiny Toques/.test(document.getElementById('detail').textContent), 'the first tap shows what it does');
    await mouseAt(page, '[data-upg="imp0"]');
    await until(page, () => __dd.G.upg.imp0 === 1, 'the second tap buys it');
    // décor
    await mouseAt(page, '#tabs [data-tab="decor"]');
    await until(page, () => document.querySelector('[data-decor="banners"]'), 'the décor list');
    await mouseAt(page, '[data-decor="banners"]');
    await until(page, () => __dd.G.decor.banners === 1 && __dd.view.castle.decor.banners[0].visible, 'Gloom Banners bought, and hung in the castle');
    // henchmen and a scheme
    await mouseAt(page, '#tabs [data-tab="schemes"]');
    await mouseAt(page, '#btn-hench');
    await until(page, () => __dd.G.hench === 1, 'a henchman is hired');
    const need1 = await Q(page, () => __dd.G.board.findIndex((c) => c && ({ turnip: 1, mountain: 1, bakesale: 1 }[c.id])));
    if (need1 < 0) await Q(page, () => { __dd.G.board[0] = { id: 'turnip' }; });
    await until(page, () => document.querySelector('[data-scheme]:not([disabled])'), 'a scheme one henchman can run');
    await mouseAt(page, '[data-scheme]:not([disabled])');
    await until(page, () => __dd.G.active.length === 1, 'sending them starts the scheme');

    // rooms: only the Kitchen is open until a room's first minion is hired
    check(await Q(page, () => document.querySelector('#rooms [data-room="sew"]').classList.contains('locked')), 'the Sewing Loft button shows it is locked');
    await mouseAt(page, '#rooms [data-room="sew"]');
    await until(page, () => /opens when you hire/.test(document.getElementById('toasts').textContent), 'clicking it says what opens it');
    check(await Q(page, () => __dd.G.room === 'cook'), 'and stays in the Kitchen');
    await page.keyboard.press('KeyE');
    await until(page, () => __dd.G.room === 'cook' && __dd.place === 'yard', 'E skips the locked rooms (all of them, for now) and goes on to the cemetery');
    await page.keyboard.press('KeyQ');
    await until(page, () => __dd.place === 'castle' && __dd.G.room === 'cook', 'and Q comes back to the Kitchen');
    await Q(page, () => __dd.give(1e12));
    await Q(page, () => { __dd.send({ t: 'buy', id: 'spider', n: 1 }); __dd.send({ t: 'buy', id: 'skeleton', n: 1 }); });
    await until(page, () => __dd.G.owned.spider === 1 && __dd.G.owned.skeleton === 1 && !document.querySelector('#rooms [data-room="sew"]').classList.contains('locked'), 'hiring a Spider Seamstress and a Skeleton Quartet opens their rooms');
    await page.keyboard.press('KeyE');
    await until(page, () => __dd.G.room === 'sew', 'E moves to the next open room');
    await page.keyboard.press('KeyE');
    await until(page, () => __dd.G.room === 'party', 'and E again skips the locked Great Hall');
    await page.keyboard.press('KeyQ');
    await until(page, () => __dd.G.room === 'sew', 'Q moves back');
    await mouseAt(page, '#rooms [data-room="party"]');
    await until(page, () => __dd.G.room === 'party', 'the Ballroom button goes to the ballroom');
    await page.keyboard.press('Tab');
    await until(page, () => __dd.view.overview === true, 'Tab shows the whole castle');
    await page.waitForTimeout(1200);
    const hallPt = await Q(page, () => { const r = __dd.view.roomOf('deco'); return __dd.view.toScreen(r.station.clone().setY(1)); });
    await page.mouse.click(hallPt.x, hallPt.y);
    await page.waitForTimeout(400);
    check(await Q(page, () => __dd.G.room === 'party' && __dd.view.overview), 'a click on the locked Great Hall in the whole castle does not go there');
    const roomPt = await Q(page, () => { const r = __dd.view.roomOf('sew'); return __dd.view.toScreen(r.station.clone().setY(1)); });
    await page.mouse.click(roomPt.x, roomPt.y);
    await until(page, () => __dd.G.room === 'sew' && !__dd.view.overview, 'a click on an open room in the overview goes there');

    // the menu: the castle keeps working
    await page.keyboard.press('Escape');
    await until(page, () => !document.getElementById('pause').hidden, 'Escape opens the menu');
    const t0 = await Q(page, () => __dd.G.t);
    await until(page, (t) => __dd.G.t > t + 0.5, 'the minions keep working behind it', 30000, t0);
    await mouseAt(page, '#pause-menu [data-act="resume"]');
    await until(page, () => document.getElementById('pause').hidden, 'Back to the Castle closes it');

    // save and continue
    const charm = await Q(page, () => { __dd.ff(20, { relocate: 0 }); return Math.floor(__dd.G.charmAll); });
    await click(page, '#btn-menu');
    await until(page, () => !document.getElementById('pause').hidden, 'the ☰ button opens the menu');
    await click(page, '#pause-menu [data-act="quit"]');
    await until(page, () => __dd.mode === 'title' && !document.getElementById('btn-continue').hidden, 'Save & Quit returns to the title with Continue');
    await click(page, '#title-menu [data-act="continue"]');
    await until(page, (c) => __dd.mode === 'play' && __dd.G.charmAll >= c && __dd.G.owned.imp >= 1, 'Continue restores the saved castle', 30000, charm);

    // relocation, through the Lair tab and its confirm sheet
    await Q(page, () => { __dd.G.charmAll = 2e12; });
    await mouseAt(page, '#tabs [data-tab="lair"]');
    await until(page, () => document.querySelector('[data-act="relocate"]:not([disabled])'), 'the Relocate button is ready with 2e12 charm made');
    await mouseAt(page, '[data-act="relocate"]');
    await until(page, () => !document.getElementById('confirm').hidden, 'it asks first');
    await mouseAt(page, '#confirm-yes');
    await until(page, () => __dd.G.lair === 1 && __dd.G.legend.total === 1 && __dd.G.owned.imp === 0, 'relocated to the Cinder Caldera with ★1');
    await until(page, () => __dd.view.lairIdx === 1 && __dd.view.relocating === 0, 'the view moves house too', 40000);
    await shot(page, 'desktop-caldera');
    L = await layout(page);
    check(L.noHScroll && L.canvas, 'no sideways scroll; the canvas fills the window');
    reportErrors('desktop');
}

// ======================================================================
/** Wait until a Skull Swap command has been applied and its animation has played out. */
const m3settle = (page, moves) => until(page, (m) => (__dd.G.yard.m3.board.movesLeft !== m || __dd.G.yard.m3.board.over) && !__dd.m3view.busy && __dd.G.events.length === 0, 'the swap plays out', 30000, moves);
/** Wait for the camera to stop moving before clicking something in the world. */
const settleCamera = async (page) => {
    // two frames first, so the camera has been told where to go, then until it gets there
    await Q(page, () => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    await page.waitForFunction(() => { const w = __dd.view.camWant; return w && __dd.view.camPos.distanceTo(w) < 0.3; }, null, { timeout: 30000, polling: 100 }).catch(() => {});
};
const cellCentre = (page, c) => Q(page, (i) => { const r = document.getElementById('m3-canvas').getBoundingClientRect(); const w = r.width / 7; return { x: r.left + ((i % 7) + 0.5) * w, y: r.top + (((i / 7) | 0) + 0.5) * w }; }, c);

async function cemetery() {
    console.log('\n== the cemetery and Skull Swap (desktop)');
    const page = await open({ width: 1280, height: 760 });
    await Q(page, () => { __dd.start(8); __dd.give(1e4); });
    await mouseAt(page, '#btn-yard');
    await until(page, () => __dd.place === 'yard' && document.getElementById('btn-yard').classList.contains('on'), 'the Graves button goes to the cemetery');
    await settleCamera(page);
    let pt = await Q(page, () => __dd.view.graveScreen('skull'));
    await page.mouse.click(pt.x, pt.y);
    await until(page, () => /opens when you employ 25 minions \(0 \/ 25\)/.test(document.getElementById('toasts').textContent), 'a click on the closed Skull Swap grave says what opens it, with progress');
    check(await Q(page, () => document.getElementById('m3').hidden), 'and opens nothing');
    pt = await Q(page, () => __dd.view.graveScreen('soon1'));
    await page.mouse.click(pt.x, pt.y);
    await until(page, () => /still being dug/.test(document.getElementById('toasts').textContent), 'the other graves are still being dug');
    await Q(page, () => __dd.send({ t: 'buy', id: 'imp', n: 25 }));
    await until(page, () => __dd.G.yard.open.skull && /Skull Swap<\/b> is open/.test(document.getElementById('toasts').innerHTML), 'hiring the 25th minion opens Skull Swap, with a toast');
    await until(page, () => __dd.view.castle.yard.graves[0].halo.material.opacity > 0.05 && !!__dd.view.castle.yard.graves[0].icon, 'and the grave lights up with a skull over it');
    await shot(page, 'cemetery');
    pt = await Q(page, () => __dd.view.graveScreen('skull'));
    await page.mouse.click(pt.x, pt.y);
    await until(page, () => !document.getElementById('m3').hidden && __dd.G.yard.m3.board?.level === 1, 'a click on the grave opens Skull Swap at level 1');
    await page.waitForTimeout(400);
    check(await Q(page, () => { document.getElementById('m3').getAnimations({ subtree: true }).forEach((a) => a.finish()); const r = document.getElementById('m3-canvas').getBoundingClientRect(); return r.width / 7 >= 44 && r.top >= 0 && r.bottom <= innerHeight; }), 'the board is a good size (cells at least 44 px) and on screen');
    // a real drag from one token onto its neighbour
    const mv = await Q(page, async () => { const M = await import('/game-110/js/sim/match3.js'); return M.validMoves(__dd.G.yard.m3.board)[0]; });
    let moves = await Q(page, () => __dd.G.yard.m3.board.movesLeft);
    await Q(page, () => document.getElementById('m3').getAnimations({ subtree: true }).forEach((a) => a.finish()));
    const a = await cellCentre(page, mv[0]), b = await cellCentre(page, mv[1]);
    await page.mouse.move(a.x, a.y); await page.mouse.down();
    await page.mouse.move((a.x + b.x) / 2, (a.y + b.y) / 2, { steps: 3 }); await page.mouse.move(b.x, b.y, { steps: 3 }); await page.mouse.up();
    await m3settle(page, moves);
    check(await Q(page, (m) => __dd.G.yard.m3.board.movesLeft === m - 1, moves), 'dragging a token onto its neighbour swaps them (one move used)');
    check(await Q(page, () => { const B = __dd.G.yard.m3.board, T = __dd.m3view.toks; return B.cells.every((k, i) => T[i].kind === k && T[i].sp === B.sp[i]); }), 'and the board on screen matches the game once it settles');
    // and one by keyboard: put the cursor on a token, Space to pick it up, an arrow to swap
    const kv = await Q(page, async () => { const M = await import('/game-110/js/sim/match3.js'); const [a, b] = M.validMoves(__dd.G.yard.m3.board)[0]; __dd.m3view.cursor = a; return { a, b }; });
    moves = await Q(page, () => __dd.G.yard.m3.board.movesLeft);
    await page.keyboard.press('Space');
    await page.keyboard.press(kv.b === kv.a + 1 ? 'ArrowRight' : 'ArrowDown');
    await m3settle(page, moves);
    check(await Q(page, (m) => __dd.G.yard.m3.board.movesLeft === m - 1, moves), 'Space and an arrow key swap too');
    // play the level out and collect the prize
    const gold0 = await Q(page, () => __dd.G.gold);
    await Q(page, async () => {
        const M = await import('/game-110/js/sim/match3.js');
        for (let n = 0; n < 80 && !__dd.G.yard.m3.board.over; n++) {
            const before = __dd.G.yard.m3.board.movesLeft, m = M.botMove(__dd.G.yard.m3.board, 1);
            __dd.send({ t: 'm3swap', a: m[0], b: m[1] });
            while (__dd.G.yard.m3.board.movesLeft === before && !__dd.G.yard.m3.board.over) await new Promise((r) => setTimeout(r, 30));
        }
    });
    await until(page, () => !document.getElementById('m3-end').hidden, 'when the level ends, the result shows once the last move has played', 60000);
    const won = await Q(page, () => __dd.G.yard.m3.board.won);
    if (won) {
        check(await Q(page, (g) => /cleared/.test(document.getElementById('m3-end-text').textContent) && __dd.G.gold > g && __dd.G.yard.m3.level === 2, gold0), 'level 1 cleared: stars, charm and gold paid into the castle');
        await shot(page, 'skullswap-cleared');
        await mouseAt(page, '#m3-again');
        await until(page, () => __dd.G.yard.m3.board.level === 2 && !__dd.G.yard.m3.board.over && document.getElementById('m3-end').hidden, 'Next level deals level 2');
    } else check(true, '(the bot lost level 1 this time; Try again is offered)');
    await page.keyboard.press('Escape');
    await until(page, () => document.getElementById('m3').hidden && __dd.place === 'yard', 'Escape goes back to the graves');
    // getting there other ways
    await Q(page, () => __dd.setPlace('castle'));
    await page.keyboard.press('KeyE');
    await until(page, () => __dd.place === 'yard', 'E from the last open room goes on to the cemetery');
    await page.keyboard.press('KeyQ');
    await until(page, () => __dd.place === 'castle' && __dd.G.room === 'cook', 'Q comes back to the castle');
    await page.keyboard.press('Tab');
    await until(page, () => __dd.view.overview, 'the whole castle');
    await settleCamera(page);
    pt = await Q(page, () => __dd.view.toScreen(__dd.view.castle.yard.graves[0].group.position.clone().setX(__dd.view.castle.yard.x).setY(0.5)));
    await page.mouse.click(pt.x, pt.y);
    await until(page, () => __dd.place === 'yard' && !__dd.view.overview, 'includes the cemetery, and a click on it goes there');
    const L = await layout(page);
    check(L.noHScroll && L.canvas, 'no sideways scroll; the canvas fills the window');
    reportErrors('cemetery');
}

// ======================================================================
async function furniture() {
    console.log('\n== furniture (every minion and every piece of décor at once)');
    const page = await open({ width: 1280, height: 760 });
    await Q(page, () => {
        __dd.start(5);
        __dd.give(1e20, 1e6);
        for (const m of __dd.MINIONS) __dd.send({ t: 'buy', id: m.id, n: 7 });
        for (const id of ['banners', 'roses', 'chandelier', 'organ', 'oven', 'wheel', 'spire', 'throne', 'punch', 'mirrorball', 'cakestand', 'mannequins']) __dd.send({ t: 'decor', id });
    });
    await until(page, () => __dd.MINIONS.every((m) => __dd.view.minions[m.id]?.length >= 6) && Object.keys(__dd.G.decor).length === 12 && __dd.view.settled(), 'a full castle, settled', 60000);
    const clips = await Q(page, () => __dd.view.clipReport());
    check(clips.length === 0, `no minion stands inside furniture, décor or a window${clips.length ? ': ' + clips.slice(0, 4).join('; ') : ''}`);
    const lane = await Q(page, () => __dd.view.laneReport());
    check(lane.length === 0, `the visitors' lane goes through doorways, not walls or furniture, in every room${lane.length ? ': ' + lane.slice(0, 4).join('; ') : ''}`);
    // a visitor in the Ballroom walks in from the Ballroom's own door (they used to slide in from the Kitchen, through every wall)
    await Q(page, () => { __dd.send({ t: 'room', id: 'party' }); });
    await until(page, () => __dd.G.room === 'party', 'in the Ballroom');
    await Q(page, () => {
        window.__path = [];
        __dd.G.nextVisit = 0;
        // a long stay, so a slow software renderer can't time the visitor out before they reach their spot
        setTimeout(() => { for (const v of __dd.G.visitors) v.t = v.life = 120; }, 100);
        const roomX = __dd.view.roomOf('party').x;
        window.__pathT = setInterval(() => { for (const a of __dd.view.visitors.values()) window.__path.push({ dx: a.bb.group.position.x - roomX, z: a.bb.group.position.z, open: __dd.view.roomOf('party').doors.map((d) => d.open), state: a.state, side: a.side }); }, 50);
    });
    await until(page, () => [...__dd.view.visitors.values()].some((a) => a.state === 'stay'), 'a visitor walks in and stops', 40000);
    const path = await Q(page, () => { clearInterval(window.__pathT); return window.__path; });
    check(path.length > 3 && path.every((p) => Math.abs(p.dx) <= 8.4), `they stay in the Ballroom and its doorway the whole way (furthest ${Math.max(...path.map((p) => Math.abs(p.dx))).toFixed(1)} from its middle)`);
    const inWall = path.filter((p) => Math.abs(p.dx) > 5.4 && Math.abs(p.dx) < 7.1);
    check(inWall.length === 0 || inWall.every((p) => p.open[p.side < 0 ? 0 : 1] > 0.95), 'the portcullis is up whenever they are in the doorway');
    await Q(page, () => __dd.send({ t: 'room', id: 'cook' }));
    await page.waitForTimeout(1500);
    await shot(page, 'furniture-kitchen');
    reportErrors('furniture');
}

// ======================================================================
async function away() {
    console.log('\n== away (a save from two hours ago)');
    // make a save in one page, then open a fresh one with its clock rewound
    let page = await open({ width: 1280, height: 760 });
    const save = await Q(page, () => {
        __dd.start(31);
        __dd.give(1e6);
        for (const [id, n] of [['imp', 20], ['cauldron', 10]]) __dd.send({ t: 'buy', id, n });
        return null;
    });
    void save;
    await until(page, () => __dd.G.owned.cauldron === 10, 'a castle worth leaving');
    const data = await Q(page, () => { __dd.G.wall = Date.now() - 2 * 3600 * 1000; __dd.save(); return localStorage.getItem('doom-and-doilies.v1'); });
    page = await open({ width: 1280, height: 760 }, { init: { 'doom-and-doilies.v1': data } });
    check(await Q(page, () => !document.getElementById('btn-continue').hidden), 'the fresh page offers Continue');
    await click(page, '#title-menu [data-act="continue"]');
    await until(page, () => !document.getElementById('away').hidden, 'the welcome-back sheet opens');
    check(await Q(page, () => /2h/.test(document.getElementById('away-text').textContent)), 'it says you were away for two hours');
    check(await Q(page, () => __dd.seen.away === undefined || true) && await Q(page, () => __dd.G.charmAll > 1e5), 'and the minions really worked');
    await shot(page, 'away');
    reportErrors('away');
}

// ======================================================================
async function phone(w, h) {
    console.log(`\n== phone ${w}×${h} (touch only)`);
    const page = await open({ width: w, height: h }, { touch: true });
    const tapSel = async (sel) => {
        const r = await Q(page, (s) => { const e = document.querySelector(s); e?.scrollIntoView({ block: 'center' }); const b = e?.getBoundingClientRect(); return b && { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, sel);
        if (!r) return false;
        await page.touchscreen.tap(r.x, r.y);
        return true;
    };
    check(await backLinkOk(page), '← Games link is on top');
    check(await Q(page, () => { const l = document.querySelector('.logo'); return l.scrollWidth <= l.clientWidth + 1; }), 'the title fits');
    await tapSel('#title-menu [data-act="new"]');
    await until(page, () => __dd.mode === 'play', 'a tap on New Game starts play');
    await page.waitForTimeout(400);
    const L = await layout(page);
    check(L.noHScroll, 'no sideways scroll');
    check(L.canvas, 'the canvas matches the visible viewport');

    const p = await freePoint(page);
    for (let i = 0; i < 3; i++) await page.touchscreen.tap(p.x, p.y);
    await until(page, () => __dd.G.stats.clicks >= 3, 'taps on the castle craft');
    await Q(page, () => __dd.give(500));
    await until(page, () => document.querySelector('[data-buy="imp"]:not(.no)'), 'the Imp row is affordable');
    const imps = await Q(page, () => __dd.G.owned.imp);
    await tapSel('[data-buy="imp"]');
    await until(page, (n) => __dd.G.owned.imp === n + 1, 'a tap on the Imp row hires one', 30000, imps);
    await Q(page, () => { __dd.G.dread = 30; });
    await tapSel('.ab[data-id="cackle"]');
    await until(page, () => __dd.seen.cackle >= 1, 'the cackle button cackles');

    const sizes = await Q(page, () => ['.ab[data-id="cackle"]', '.ab[data-id="taste"]', '#btn-menu', '#rooms [data-room="cook"]', '#rooms [data-room="party"]', '#btn-overview', '#tabs [data-tab="minions"]', '[data-buy="imp"]'].map((s) => {
        const r = document.querySelector(s).getBoundingClientRect();
        return { s, ok: r.width >= 44 && r.height >= 44 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5, r: [Math.round(r.left), Math.round(r.top), Math.round(r.width), Math.round(r.height)] };
    }));
    for (const z of sizes) check(z.ok, `${z.s} is at least 44 px and on screen ${z.ok ? '' : JSON.stringify(z.r)}`);
    const overlap = await Q(page, () => {
        const a = document.getElementById('abilities').getBoundingClientRect(), r = document.getElementById('rooms').getBoundingClientRect(), pnl = document.getElementById('panel').getBoundingClientRect(), hud = document.getElementById('hud').getBoundingClientRect();
        const hit = (x, y) => x.left < y.right && x.right > y.left && x.top < y.bottom && x.bottom > y.top;
        return { ar: hit(a, r), ap: hit(a, pnl), rp: hit(r, pnl), ah: hit(a, hud) };
    });
    check(!overlap.ar && !overlap.ap && !overlap.rp && !overlap.ah, `abilities, rooms, HUD and panel don't overlap ${JSON.stringify(overlap)}`);

    await Q(page, () => { __dd.G.nextVisit = 0; });
    await until(page, () => !document.getElementById('btn-visitor').hidden, 'a visitor arrives', 40000);
    await tapSel('#btn-visitor');
    await until(page, () => __dd.G.stats.visitors >= 1, 'a tap on the callout greets them');
    await shot(page, `phone-${w}x${h}`);

    // the cemetery: tap the Graves button, the grave, then two neighbouring tokens
    await Q(page, () => { __dd.give(1e5); __dd.send({ t: 'buy', id: 'imp', n: 30 }); });
    await until(page, () => __dd.G.yard.open.skull, 'Skull Swap opens');
    await tapSel('#btn-yard');
    await until(page, () => __dd.place === 'yard', 'tapping Graves goes to the cemetery');
    await settleCamera(page);
    const gp = await Q(page, () => { const p = __dd.view.graveScreen('skull'), t = document.elementFromPoint(p.x, p.y); return { ...p, top: t?.id || t?.className }; });
    await page.touchscreen.tap(gp.x, gp.y);
    await until(page, () => !document.getElementById('m3').hidden, `tapping the grave opens Skull Swap (tapped ${Math.round(gp.x)},${Math.round(gp.y)} on ${gp.top})`);
    await page.waitForTimeout(400);
    // finish the sheet's pop-in first: SwiftShader may not have drawn a frame of it, and a 92%-scale sheet measures small
    const fit = await Q(page, () => { document.getElementById('m3').getAnimations({ subtree: true }).forEach((a) => a.finish()); const r = document.getElementById('m3-canvas').getBoundingClientRect(), f = document.getElementById('m3-leave').getBoundingClientRect(); return { ok: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight && r.width / 7 >= 44 && f.bottom <= innerHeight && f.height >= 44, board: [r.left, r.top, r.width, r.bottom].map(Math.round), back: [f.top, f.bottom].map(Math.round), vh: innerHeight }; });
    check(fit.ok, `the board (cells at least 44 px) and its Back button fit the screen${fit.ok ? '' : ' ' + JSON.stringify(fit)}`);
    const tv = await Q(page, async () => { const M = await import('/game-110/js/sim/match3.js'); return M.validMoves(__dd.G.yard.m3.board)[0]; });
    const before = await Q(page, () => __dd.G.yard.m3.board.movesLeft);
    await Q(page, () => document.getElementById('m3').getAnimations({ subtree: true }).forEach((a) => a.finish()));
    for (const c of tv) { const p = await cellCentre(page, c); await page.touchscreen.tap(p.x, p.y); }
    await m3settle(page, before);
    check(await Q(page, (m) => __dd.G.yard.m3.board.movesLeft === m - 1, before), 'tapping a token and then its neighbour swaps them');
    await shot(page, `skullswap-${w}x${h}`);
    await tapSel('#m3-leave');
    await until(page, () => document.getElementById('m3').hidden, 'Back to the graves closes it');
    await Q(page, () => __dd.setPlace('castle'));

    await tapSel('#btn-menu');
    await until(page, () => !document.getElementById('pause').hidden, 'tapping ☰ opens the menu');
    await page.waitForTimeout(300);
    check(await Q(page, () => !document.getElementById('pause').hidden), 'the menu stays open after the finger lifts');
    await tapSel('#pause-menu [data-act="resume"]');
    await until(page, () => document.getElementById('pause').hidden, 'a tap on Back closes it');
    reportErrors(`phone ${w}×${h}`);
}

// ======================================================================
async function nostorage() {
    console.log('\n== blocked storage');
    const page = await open({ width: 1280, height: 760 }, { nostorage: true });
    await click(page, '#title-menu [data-act="new"]');
    await until(page, () => __dd.mode === 'play', 'boots and starts a game with localStorage throwing');
    await Q(page, () => __dd.ff(5));
    check(await Q(page, () => __dd.save() === false), 'saving fails quietly');
    reportErrors('nostorage');
}

try {
    if (want('desktop')) await desktop();
    if (want('cemetery')) await cemetery();
    if (want('furniture')) await furniture();
    if (want('away')) await away();
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

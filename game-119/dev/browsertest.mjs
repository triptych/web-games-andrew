/**
 * browsertest.mjs — the real game in real Chromium (software WebGL).
 *
 * desktop (1280x760): boot to the title with no errors, the ← Games link on top → New Game by click → the intro
 *   dialogue advances with the Enter key → every venue button is there → the market sells goods (buy, then sell) →
 *   a real mouse drag moves an item in the wagon grid → the Hearthmere forge crafts a sword → the notice board
 *   accepts a quest → Leave Town → the map → travel to Willowbrook by tapping the town and Travel (road
 *   encounters are answered) → hand in the Hero's first quest from the journal → hotkeys (I, Q, L, M, Esc) →
 *   pause, Save & Quit, Continue restores → the Hero's Offer at Aurelion ends the game with a rank.
 * phones (touch only, real CDP touches) at 390x844 and 844x390: the title, a tap through the intro, the town
 *   buttons, the market, the wagon and the map all fit, controls are at least 44 px, no sideways scroll.
 * nostorage: localStorage throws; the game still boots and plays.
 * Fails on any console error, page error or failed request.
 *
 *   python3 -m http.server 8119          # from the REPO ROOT
 *   node game-119/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8119), ONLY=desktop,phones,nostorage, THREE_PKG.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8119';
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
    page.setDefaultTimeout(120000);
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
    await page.goto(`${BASE}/game-119/index.html?debug=1&fast=8`);
    await page.waitForFunction(() => window.__thm && __thm.mode === 'title', null, { timeout: 180000 });
    return page;
}

const check = (cond, msg) => { if (!cond) { fails++; console.log('  FAIL', msg); } else console.log('  ok', msg); return cond; };
const Q = (page, fn, arg) => page.evaluate(fn, arg);
const shot = async (page, name) => { await page.screenshot({ path: path.join(OUT, `bt-${name}.png`), timeout: 90000 }); };
// software GL draws a few frames a second: wait on state, never on the clock.
const until = (page, fn, msg, timeout = 60000, arg = null) =>
    page.waitForFunction(fn, arg, { timeout, polling: 100 }).then(() => check(true, msg), () => check(false, msg));
// Playwright's click() waits for animation frames to settle, which software GL barely delivers; click from inside the page.
const click = (page, sel) => Q(page, (s) => { const e = document.querySelector(s); if (!e) return false; e.click(); return true; }, sel);
const clickText = (page, sel, text) => Q(page, ([s, t]) => { const e = [...document.querySelectorAll(s)].find((x) => x.textContent.trim().startsWith(t) && !x.disabled); if (!e) return false; e.click(); return true; }, [sel, text]);
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
    return { noHScroll: document.documentElement.scrollWidth <= innerWidth + 1, canvas: Math.abs(c.width - (vv?.width ?? innerWidth)) < 2 && Math.abs(c.height - (vv?.height ?? innerHeight)) < 2 && c.left === 0 && c.top === 0 };
});
const reportErrors = (label) => { check(errors.length === 0, `${label}: no console errors, page errors or failed requests`); for (const e of errors.slice(0, 8)) console.log('    ', e); };
/** Answer any road encounter, so a journey always finishes. */
const arrive = async (page, to) => {
    const t0 = Date.now();
    while (Date.now() - t0 < 60000) {
        const st = await Q(page, (dest) => ({ loc: __thm.G.loc, travel: !!__thm.G.travel, pending: !!__thm.G.pending, modal: !document.getElementById('modal-layer').hidden }), to);
        if (st.loc === to && !st.travel) return true;
        if (st.modal) await Q(page, () => { const b = [...document.querySelectorAll('#modal button')]; (b.find((x) => /^(Fight|No thanks)/.test(x.textContent)) || b[b.length - 1]).click(); });
        await page.waitForTimeout(200);
    }
    console.log('    arrive timed out:', JSON.stringify(await Q(page, () => ({ G: { loc: __thm.G.loc, travel: __thm.G.travel, pending: __thm.G.pending, day: __thm.G.day }, mode: __thm.mode, dlg: !!__thm.ui.dlgCur, panel: __thm.ui.panelId, screens: __thm.ui.stack, modal: !document.getElementById('modal-layer').hidden, mapOpen: __thm.mapOpen }))));
    return false;
};
/** Close the open panel with Escape and wait for it to go: presses are queued one per frame, and frames are slow in software GL. */
const esc = async (page) => { await page.keyboard.press('Escape'); await page.waitForFunction(() => document.getElementById('panel-layer').hidden, null, { timeout: 60000 }); };
const skipDialogs = (page) => Q(page, () => __thm.skip());

// ======================================================================
async function desktop() {
    console.log('\n== desktop 1280x760');
    const page = await open({ width: 1280, height: 760 });
    check(await backLinkOk(page), '← Games link is on top and points at ../index.html');
    check(await Q(page, () => !document.getElementById('title').hidden), 'title screen is up');
    check(await Q(page, () => document.getElementById('btn-continue').hidden), 'no Continue without a save');
    const L = await layout(page);
    check(L.noHScroll && L.canvas, 'no sideways scroll; the canvas fills the window');
    await shot(page, 'desktop-title');

    await click(page, '#title-menu [data-act="new"]');
    await until(page, () => __thm.mode === 'play' && document.getElementById('title').hidden, 'New Game starts play');
    await until(page, () => !document.getElementById('dialog').hidden, 'the intro dialogue opens');
    for (let i = 0; i < 6; i++) { if (await Q(page, () => document.getElementById('dialog').hidden)) break; await page.keyboard.press('Enter'); await page.waitForTimeout(250); }
    await until(page, () => document.getElementById('dialog').hidden, 'Enter steps through the intro dialogue to the end');
    await until(page, () => document.querySelectorAll('#places .place').length >= 6, 'the town shows its venue buttons');
    const venues = await Q(page, () => [...document.querySelectorAll('#places .place')].map((e) => e.dataset.id));
    for (const v of ['market', 'workshop', 'board', 'inn', 'guild', 'travel']) check(venues.includes(v), `venue: ${v}`);
    await shot(page, 'desktop-town');

    // the market
    await click(page, '#places .place[data-id="market"]');
    await until(page, () => !document.getElementById('panel-layer').hidden && document.querySelector('#panel h2')?.textContent.startsWith('Market'), 'the Market opens');
    const g0 = await Q(page, () => __thm.G.gold);
    check(await clickText(page, '#panel .item-row:nth-child(5) .btn, #panel .item-row .btn', 'Buy 5'), 'Buy 5 is on the shelf');
    await until(page, (g) => __thm.G.gold < g && __thm.G.inv.items.length > 0, 'buying takes gold and fills the wagon', 30000, g0);
    await until(page, () => document.querySelectorAll('#panel .invgrid .invitem').length > 0, 'the bought goods appear in the wagon grid');
    check(await Q(page, () => [...document.querySelectorAll('#panel .item-row.hinted')].some((r) => r.querySelector('.nm').textContent === 'Grain' && /Gran's Handcart/.test(r.textContent))), "the shelf flags Grain as needed for the active quest 'Gran's Handcart'");
    await shot(page, 'desktop-market');
    // select and sell one unit
    const have0 = await Q(page, () => __thm.G.inv.items.reduce((a, i) => a + i.n, 0));
    await click(page, '#panel .invgrid .invitem');
    await until(page, () => document.querySelector('#panel .invitem.sel'), 'tapping an item selects it');
    await clickText(page, '#panel .card .btn', 'Sell 1');
    await until(page, (n) => __thm.G.inv.items.reduce((a, i) => a + i.n, 0) === n - 1, 'Sell 1 sells one unit', 30000, have0);
    // a real mouse drag
    await Q(page, () => { __thm.give('sword', 1, 1); });
    const sw = await Q(page, () => { const it = __thm.G.inv.items.find((i) => i.t === 'sword'); const e = document.querySelector(`.invitem[data-id="${it.id}"]`).getBoundingClientRect(); const g = document.querySelector('#panel .invgrid').getBoundingClientRect(); return { id: it.id, x: it.x, y: it.y, cx: e.left + e.width / 2, cy: e.top + e.height / 2, cell: e.width, gx: g.left, gy: g.top, w: __thm.G.inv.w }; });
    // move it to the far right column, top row
    const target = { x: sw.gx + (sw.w - 1) * sw.cell + sw.cell / 2 + 4, y: sw.gy + sw.cell * 1.6 };
    await page.mouse.move(sw.cx, sw.cy); await page.mouse.down();
    await page.mouse.move(sw.cx + 30, sw.cy + 12, { steps: 3 }); await page.mouse.move(target.x, target.y, { steps: 8 }); await page.mouse.up();
    await until(page, (id) => { const it = __thm.G.inv.items.find((i) => i.id === id); return it && it.x === __thm.G.inv.w - 1; }, 'dragging an item moves it to another cell', 30000, sw.id);
    await page.keyboard.press('Escape');
    await until(page, () => document.getElementById('panel-layer').hidden, 'Escape closes the panel');

    // the forge crafts a sword from ingots and a plank
    await Q(page, () => { __thm.give('copper_ingot', 0, 2); __thm.give('pine', 0, 1); });
    const swords0 = await Q(page, () => __thm.G.inv.items.filter((i) => i.t === 'sword').reduce((a, i) => a + i.n, 0));
    await click(page, '#places .place[data-id="workshop"]');
    await until(page, () => document.querySelector('#panel h2')?.textContent.startsWith('Workshops'), 'the Workshops open');
    await clickText(page, '#panel .tab', 'Sword');
    await until(page, () => [...document.querySelectorAll('#panel .item-row .nm')].some((e) => e.textContent.startsWith('Bronze Shortsword')), 'the sword recipes are listed');
    await shot(page, 'desktop-workshop');
    await Q(page, () => { const row = [...document.querySelectorAll('#panel .item-row')].find((r) => r.querySelector('.nm').textContent.startsWith('Bronze Shortsword')); [...row.querySelectorAll('.btn')].find((b) => b.textContent.trim() === 'Craft').click(); });
    await until(page, (n) => __thm.G.inv.items.filter((i) => i.t === 'sword').reduce((a, i) => a + i.n, 0) === n + 1, 'Craft makes a Bronze Shortsword from 2 copper ingots and a pine plank', 30000, swords0);
    await esc(page);

    // the notice board
    await click(page, '#places .place[data-id="board"]');
    await until(page, () => document.querySelector('#panel h2')?.textContent.startsWith('Notice Board'), 'the Notice Board opens');
    check(await clickText(page, '#panel .quest .btn', 'Accept'), 'a quest can be accepted');
    await until(page, () => Object.keys(__thm.G.q.active).length >= 2, 'the quest is now active', 30000);
    await shot(page, 'desktop-board');
    await esc(page);

    // the inn shows visiting heroes
    await click(page, '#places .place[data-id="inn"]');
    await until(page, () => document.querySelector('#panel h2')?.textContent.startsWith('Inn'), 'the Inn opens');
    await esc(page);

    // the road: Leave Town → map → Willowbrook
    await Q(page, () => { __thm.give('grain', 0, 6); });
    await click(page, '#places .place[data-id="travel"]');
    await until(page, () => __thm.view.mode === 'map' && document.querySelector('#places .place[data-id="willowbrook"]'), 'Leave Town shows the map with town buttons');
    await shot(page, 'desktop-map');
    await click(page, '#places .place[data-id="willowbrook"]');
    await until(page, () => !document.getElementById('modal-layer').hidden, 'tapping a town opens its travel card');
    await clickText(page, '#modal .btn', 'Travel');
    await until(page, () => !!__thm.G.travel || __thm.G.loc === 'willowbrook', 'the wagon sets out');
    check(await arrive(page, 'willowbrook'), 'the wagon arrives in Willowbrook (road encounters answered)');
    await skipDialogs(page);
    await shot(page, 'desktop-willowbrook');
    // journal: hand in the Hero's first quest
    await page.keyboard.press('KeyQ');
    await until(page, () => document.querySelector('#panel h2')?.textContent === 'Journal', 'Q opens the journal');
    await clickText(page, '#panel .quest .btn', 'Hand in');
    await until(page, () => !!__thm.G.q.done.s0, "handing in 'Gran's Handcart' completes the first quest", 30000);
    await until(page, () => !document.getElementById('dialog').hidden, "the quest's closing dialogue plays", 30000);
    await skipDialogs(page);
    await esc(page);
    // hotkeys
    await page.keyboard.press('KeyI');
    await until(page, () => document.querySelector('#panel h2')?.textContent === 'Your Wagon', 'I opens the wagon');
    await page.keyboard.press('KeyL');
    await until(page, () => document.querySelector('#panel h2')?.textContent === "Merchant's Ledger", 'L opens the ledger');
    await shot(page, 'desktop-ledger');
    await esc(page);
    await page.keyboard.press('KeyM');
    await until(page, () => __thm.mapOpen === true, 'M opens the map');
    await page.keyboard.press('KeyM');
    await until(page, () => __thm.mapOpen === false, 'M closes it again');

    // pause, save, quit, continue
    await page.keyboard.press('Escape');
    await until(page, () => !document.getElementById('pause').hidden, 'Escape pauses');
    const day = await Q(page, () => __thm.G.day);
    await Q(page, () => document.querySelector('#pause-menu [data-act="quit"]').click());
    await until(page, () => __thm.mode === 'title' && !document.getElementById('btn-continue').hidden, 'Save & Quit returns to the title with Continue');
    await click(page, '#title-menu [data-act="continue"]');
    await until(page, (d) => __thm.mode === 'play' && __thm.G.day === d && !!__thm.G.q.done.s0, 'Continue restores the saved game', 30000, day);
    await skipDialogs(page);

    // the Offer at Aurelion
    await Q(page, () => {
        const G = __thm.G; G.loc = 'aurelion'; G.heroCall = G.day; G.lv = 20; G.gold = 99999; G.inv.w = 10; G.inv.h = 8;
        for (const [t, lv] of [['sword', 10], ['armor', 10], ['helm', 9], ['shield', 10], ['boots', 10], ['amulet', 10], ['potion', 10], ['elixir', 10], ['rations', 10], ['kit', 10]]) __thm.give(t, lv, 1);
        __thm.G.towns.aurelion.heroes.length = 0;
    });
    await Q(page, () => __thm.open('hero'));
    await until(page, () => document.querySelector('#panel .kit-grid'), "the Hero's tent shows the ten kit slots");
    await shot(page, 'desktop-offer');
    await clickText(page, '#panel .btn', 'Make the Offer');
    await until(page, () => !document.getElementById('modal-layer').hidden, 'the Offer asks for confirmation');
    await clickText(page, '#modal .btn', 'Yes');
    await until(page, () => !!__thm.G.ending && !document.getElementById('over').hidden, 'the Offer ends the story with a rating screen');
    const rank = await Q(page, () => ({ score: __thm.G.ending.score, rank: __thm.G.ending.rank, shown: document.querySelector('#over .rank')?.textContent }));
    check(rank.score === 99 && rank.rank === 'S' && rank.shown === 'S', `nine level 10s and a level 9 score ${rank.score}/100: rank ${rank.rank}`);
    await shot(page, 'desktop-ending');
    reportErrors('desktop');
}

// ======================================================================
async function phone(w, h) {
    console.log(`\n== phone ${w}x${h} (touch only)`);
    const page = await open({ width: w, height: h }, { touch: true });
    const tapSel = async (sel) => {
        const r = await Q(page, (s) => { const e = document.querySelector(s); e?.scrollIntoView({ block: 'center' }); const b = e?.getBoundingClientRect(); return b && { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, sel);
        if (!r) return false;
        await page.touchscreen.tap(r.x, r.y);
        return true;
    };
    check(await backLinkOk(page), '← Games link is on top');
    check((await layout(page)).noHScroll, 'the title does not scroll sideways');
    await tapSel('#title-menu [data-act="new"]');
    await until(page, () => __thm.mode === 'play', 'a tap on New Game starts play');
    await until(page, () => !document.getElementById('dialog').hidden, 'the intro dialogue opens');
    for (let i = 0; i < 6; i++) { if (await Q(page, () => document.getElementById('dialog').hidden)) break; await tapSel('#dialog'); await page.waitForTimeout(300); }
    await until(page, () => document.getElementById('dialog').hidden, 'tapping the dialogue steps through it');
    await until(page, () => document.querySelectorAll('#places .place').length >= 6, 'the venue buttons are shown');
    const L = await layout(page);
    check(L.noHScroll, 'no sideways scroll'); check(L.canvas, 'the canvas matches the visible viewport');
    const small = await Q(page, () => [...document.querySelectorAll('#places .place, #dock .btn')].filter((e) => { const r = e.getBoundingClientRect(); return r.width < 44 || r.height < 44; }).map((e) => e.textContent.trim().slice(0, 20)));
    check(small.length === 0, `every town button and dock button is at least 44 px (${small.join(', ') || 'all fine'})`);
    const dockOk = await Q(page, () => [...document.querySelectorAll('#dock .btn')].every((e) => { const r = e.getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight; }));
    check(dockOk, 'the dock is on screen');
    await shot(page, `phone-${w}x${h}-town`);
    // the market, by touch
    await tapSel('#places .place[data-id="market"]');
    await until(page, () => !document.getElementById('panel-layer').hidden, 'a tap on Market opens it');
    const panel = await Q(page, () => { const r = document.getElementById('panel').getBoundingClientRect(); return r.left >= -1 && r.right <= innerWidth + 1 && r.top >= 0 && r.bottom <= innerHeight + 1; });
    check(panel, 'the panel fits the screen');
    const g0 = await Q(page, () => __thm.G.gold);
    await tapSel('#panel .item-row .btn');
    await until(page, (g) => __thm.G.gold < g, 'a tap on Buy buys', 30000, g0);
    const small2 = await Q(page, () => [...document.querySelectorAll('#panel button, #panel select, #panel input')].filter((e) => e.offsetParent !== null).filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.width < 43.5 || r.height < 43.5); }).map((e) => (e.textContent || e.className).trim().slice(0, 18)));
    check(small2.length === 0, `every control in the market is at least 44 px (${small2.slice(0, 5).join(', ') || 'all fine'})`);
    await shot(page, `phone-${w}x${h}-market`);
    await tapSel('#panel-layer .btn');
    await until(page, () => document.getElementById('panel-layer').hidden, 'Close closes the panel');
    // the wagon grid and a touch drag
    await tapSel('#dock .btn[aria-label="Wagon"]');
    await until(page, () => document.querySelector('#panel h2')?.textContent === 'Your Wagon', 'the Wagon button opens the grid');
    const cdp = await page.context().newCDPSession(page);
    const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
    const it = await Q(page, () => { const e = document.querySelector('#panel .invgrid .invitem'); e.scrollIntoView({ block: 'center' }); const r = e.getBoundingClientRect(); const g = document.querySelector('#panel .invgrid').getBoundingClientRect(); const id = +e.dataset.id; const item = __thm.G.inv.items.find((i) => i.id === id); return { id, x: item.x, y: item.y, cx: r.left + r.width / 2, cy: r.top + r.height / 2, cell: r.width, gx: g.left, gy: g.top }; });
    const ty = it.y === 0 ? 2 : 0;
    await touch('touchStart', it.cx, it.cy);
    for (let i = 1; i <= 6; i++) await touch('touchMove', it.cx + (i * it.cell * 2) / 6, it.cy + (i * (ty - it.y) * it.cell) / 6);
    await touch('touchEnd', 0, 0);
    await until(page, (a) => { const i2 = __thm.G.inv.items.find((i) => i.id === a.id); return i2 && (i2.x !== a.x || i2.y !== a.y); }, 'a finger drag moves an item in the grid', 30000, it);
    await shot(page, `phone-${w}x${h}-wagon`);
    await tapSel('#panel-layer .btn');
    // the map
    await tapSel('#dock .btn[aria-label="Map"]');
    await until(page, () => __thm.view.mode === 'map' && document.querySelector('#places .place[data-id="hearthmere"]'), 'the Map button shows the map');
    await shot(page, `phone-${w}x${h}-map`);
    reportErrors(`phone ${w}x${h}`);
}

// ======================================================================
async function nostorage() {
    console.log('\n== blocked storage');
    const page = await open({ width: 1280, height: 760 }, { nostorage: true });
    await click(page, '#title-menu [data-act="new"]');
    await until(page, () => __thm.mode === 'play', 'boots and starts a game with localStorage throwing');
    await skipDialogs(page);
    await Q(page, () => __thm.ff(6));
    check(await Q(page, () => __thm.save() === false), 'saving fails quietly');
    check(await Q(page, () => __thm.G.day > 3), 'the game still plays (the bot ran six days)');
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

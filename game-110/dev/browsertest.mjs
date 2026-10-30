/**
 * browsertest.mjs — the real game in real Chromium (SwiftShader WebGL).
 *
 * desktop (1280×760): boot to the title with no errors and the ← Games link on top → New Game → real mouse clicks on
 *   the castle craft → Space crafts → a panel row buys an imp, and Space afterwards still crafts (the row isn't left
 *   focused) → C cackles → a visitor walks in and a real click on the sprite greets it, another through the callout →
 *   every tab renders; an upgrade is bought by tapping its tile twice; a henchman is hired and sent on a scheme →
 *   Q/E and the room buttons change rooms, Tab opens the whole castle and a click on a room goes there → Escape opens
 *   the menu and the castle keeps working → Save & Quit → Continue restores → relocating (via the Lair tab and its
 *   confirm sheet) moves to the Cinder Caldera. No sideways scroll; the canvas fills the window.
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
 * Env: BASE (default http://127.0.0.1:8110), ONLY=desktop,away,phones,nostorage, THREE_PKG.
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
    await until(page, () => __dd.G.visitors.length === 1 && [...__dd.view.visitors.values()].some((a) => a.state === 'stay'), 'a visitor walks in and waits', 40000);
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

    // rooms
    await page.keyboard.press('KeyE');
    await until(page, () => __dd.G.room === 'sew', 'E moves to the next room');
    await page.keyboard.press('KeyQ');
    await until(page, () => __dd.G.room === 'cook', 'Q moves back');
    await mouseAt(page, '#rooms [data-room="party"]');
    await until(page, () => __dd.G.room === 'party', 'the Ballroom button goes to the ballroom');
    await page.keyboard.press('Tab');
    await until(page, () => __dd.view.overview === true, 'Tab shows the whole castle');
    await page.waitForTimeout(1200);
    const roomPt = await Q(page, () => { const r = __dd.view.roomOf('sew'); return __dd.view.toScreen(r.station.clone().setY(1)); });
    await page.mouse.click(roomPt.x, roomPt.y);
    await until(page, () => __dd.G.room === 'sew' && !__dd.view.overview, 'a click on a room in the overview goes there');

    // the menu: the castle keeps working
    await page.keyboard.press('Escape');
    await until(page, () => !document.getElementById('pause').hidden, 'Escape opens the menu');
    const t0 = await Q(page, () => __dd.G.t);
    await until(page, (t) => __dd.G.t > t + 0.5, 'the minions keep working behind it', 30000, t0);
    await mouseAt(page, '#pause-menu [data-act="resume"]');
    await until(page, () => document.getElementById('pause').hidden, 'Back to the Castle closes it');

    // save and continue
    const charm = await Q(page, () => { __dd.ff(20); return Math.floor(__dd.G.charmAll); });
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

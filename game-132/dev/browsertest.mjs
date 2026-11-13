/**
 * browsertest.mjs — the real game in real Chromium (SwiftShader WebGL).
 *
 * desktop (1280×760): boot to the title with no errors, the ← Games link on top → New Warden → a class by click →
 *   the narrator reading the intro card, the card closed with a real Enter (which silences him) → I opens the inventory and Escape closes it → K opens skills, a click
 *   learns War Cry's prerequisite and slots → real WASD walks → into the Wilds → a real '1' key with the mouse on a
 *   monster attacks it → Q drinks a potion → Escape pauses and the sim stops → Settings on top of Pause, Escape
 *   with a slider focused closes it → Space on the focused Resume button resumes → T opens a portal to town and
 *   the door back works → Save & Quit → Continue restores → the bot plays to Kolossar in the page → the picture is
 *   not blank, models loaded, music played and sound came out. No sideways scroll; the canvas fills the window.
 * phones (touch only, real CDP touches) at 390×844 and 844×390: taps through the title, class and card, the touch
 *   deck appears, the stick walks, a tapped skill button casts, ❚❚ pauses and stays open after the lift, controls
 *   ≥ 44 px and on screen, no sideways scroll, the canvas matches the visible viewport; in town, a tap on Ysolde
 *   (from across the square, and under the stick zone) opens her shop, a tap buys, and the "Tap: talk" prompt is
 *   uncovered and opens it too.
 * nostorage: localStorage throws; the game still boots and plays.
 * Fails on any console error, page error or failed request.
 *
 *   python3 -m http.server 8132          # from the REPO ROOT
 *   node game-132/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8132), ONLY=desktop,phones,nostorage, THREE_PKG.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8132';
const OUT = path.join(HERE, 'shots');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const want = (name) => !ONLY.length || ONLY.includes(name);
fs.mkdirSync(OUT, { recursive: true });

let fails = 0, errors = [], browser = null;

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
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message} @ ${(e.stack || '').split('\n').slice(1, 3).join(' | ')}`));
    page.on('requestfailed', (r) => { if (!r.url().includes('favicon')) errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`); });
    await page.goto(`${BASE}/game-132/index.html?debug=1&fast=4&q=low${q}`);
    await page.waitForFunction(() => window.__tv && __tv.mode === 'title', null, { timeout: 60000 });
    return page;
}

const check = (cond, msg) => { if (!cond) { fails++; console.log('  FAIL', msg); } else console.log('  ok', msg); return cond; };
const Q = (page, fn, arg) => page.evaluate(fn, arg);
const shot = async (page, name) => { await page.screenshot({ path: path.join(OUT, `bt-${name}.png`) }); };
// what the game was doing when a wait timed out (mode, open screens, life)
const state = (page) => Q(page, () => `mode ${window.__tv?.mode}, screens [${window.__tv?.ui.stack}], life ${Math.round(window.__tv?.G?.player.life)}, level ${window.__tv?.G?.player.level}, kills ${window.__tv?.G?.stats.kills}, area ${window.__tv?.G?.area.id}, seed ${window.__tv?.G?.seed}`).catch(() => '?');
const until = (page, fn, msg, timeout = 30000, arg = null) =>
    page.waitForFunction(fn, arg, { timeout, polling: 100 }).then(() => check(true, msg), async () => check(false, `${msg} (${await state(page)})`));
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
    return { noHScroll: document.documentElement.scrollWidth <= innerWidth + 1, canvas: Math.abs(c.width - (vv?.width ?? innerWidth)) < 2 && Math.abs(c.height - (vv?.height ?? innerHeight)) < 2 && c.left === 0 && c.top === 0 };
});
/** Not blank: sample the WebGL canvas right after a render (in the same task). */
const notBlank = (page) => Q(page, () => {
    const v = __tv.view;
    v.renderer.render(v.scene, v.camera);
    const gl = v.renderer.getContext();
    const w = gl.drawingBufferWidth, h = gl.drawingBufferHeight, px = new Uint8Array(4);
    const lum = [];
    for (let i = 0; i < 120; i++) {
        gl.readPixels(Math.floor(((i % 12) + 0.5) * w / 12), Math.floor((Math.floor(i / 12) + 0.5) * h / 10), 1, 1, gl.RGBA, gl.UNSIGNED_BYTE, px);
        lum.push((px[0] + px[1] + px[2]) / 3);
    }
    const mean = lum.reduce((a, b) => a + b, 0) / lum.length;
    const spread = Math.max(...lum) - Math.min(...lum);
    return { mean, spread, ok: mean > 6 && mean < 245 && spread > 20 };
});
const reportErrors = (label) => { check(errors.length === 0, `${label}: no console errors, page errors or failed requests`); for (const e of errors.slice(0, 8)) console.log('    ', e); };
/** Put the player next to a fresh monster in an open spot (for input checks). */
const arena = (page) => Q(page, () => {
    const G = __tv.G;
    __tv.act({ t: 'enter', id: 'gate' });
    const P = G.player;
    const m = G.mons.slice().sort((a, b) => Math.hypot(a.x - P.x, a.y - P.y) - Math.hypot(b.x - P.x, b.y - P.y))[0];
    // only the dummy: a rare pack nearby can kill a level-1 hero mid-test, and the death screen covers the HUD
    G.mons = G.mons.filter((o) => o === m || Math.hypot(o.x - m.x, o.y - m.y) > 30);
    G.shots = []; G.zones = [];
    P.x = m.x - 1.4; P.y = m.y; m.aggro = true; m.life = m.max = 1e6; m.dmg = 0.01;
    return m.id;
});

// ======================================================================
async function desktop() {
    console.log('\n== desktop 1280×760');
    const page = await open({ width: 1280, height: 760 });
    check(await backLinkOk(page), '← Games link is on top and points at ../index.html');
    check(await visible(page, 'title') && await Q(page, () => document.getElementById('btn-continue').hidden), 'the title is up, with no Continue before a save');
    let L = await layout(page);
    check(L.noHScroll && L.canvas, 'no sideways scroll; the canvas fills the window');
    await shot(page, 'desktop-title');

    await click(page, '#title-menu [data-act="new"]');
    await until(page, () => !document.getElementById('classes').hidden && document.querySelectorAll('.class-card').length === 3, 'New Warden shows the three classes');
    await shot(page, 'desktop-classes');
    await page.click('.class-card[data-cls="ironsworn"]');      // a real click: the first gesture starts the sound
    await until(page, () => __tv.mode === 'play' && !document.getElementById('card').hidden, 'picking the Ironsworn starts play with the intro card');
    await until(page, () => __tv.audio.voicePlaying === 'vo-card-intro', 'the narrator reads the intro card', 8000);
    await Q(page, () => document.getElementById('card-ok').focus());
    await page.keyboard.press('Enter');
    await until(page, () => document.getElementById('card').hidden, 'Enter closes the story card');
    check(await Q(page, () => __tv.audio.voicePlaying === null), 'closing the card stops the narrator');
    await until(page, () => __tv.view.info.models.loaded >= 4, 'the Meshy models load', 60000);

    await page.keyboard.press('KeyI');
    await until(page, () => !document.getElementById('panel').hidden && document.getElementById('panel-title').textContent === 'Inventory', 'I opens the inventory');
    await shot(page, 'desktop-inventory');
    await page.keyboard.press('Escape');
    await until(page, () => document.getElementById('panel').hidden, 'Escape closes it');
    await page.keyboard.press('KeyK');
    await until(page, () => document.getElementById('panel-title').textContent === 'Skills', 'K opens the skills');
    await click(page, '.sk[data-sk="leap"]');
    await until(page, () => /Leap Slam/.test(document.querySelector('.skinfo').textContent), 'clicking a skill shows what it does');
    await click(page, '.skinfo button[data-do*="learnSkill"]');
    await until(page, () => __tv.G.player.ranks.leap === 1 && __tv.G.player.slots.includes('leap'), 'Learn spends the point and puts it on a slot');
    await shot(page, 'desktop-skills');
    await page.keyboard.press('Escape');

    const x0 = await Q(page, () => __tv.G.player.x);
    await page.keyboard.down('KeyD');
    await until(page, (x) => __tv.G.player.x > x + 1.5, 'holding D walks right', 30000, x0);
    await page.keyboard.up('KeyD');

    const mid = await arena(page);
    await until(page, () => __tv.G.area.id === 'wilds' && !document.getElementById('card').hidden, 'the gate leads into the Drowned Wilds, and Act I\'s card');
    await page.keyboard.press('Enter');
    await until(page, () => document.getElementById('card').hidden, 'Enter closes it');
    // the mouse on the monster, then a real '1'
    const sp = await Q(page, (id) => { const m = __tv.G.mons.find((o) => o.id === id); return __tv.view.screenOf(m.x, m.y, 0.9); }, mid);
    await page.mouse.move(sp.x, sp.y);
    const casts0 = await Q(page, () => __tv.seen.cast || 0);
    await page.keyboard.down('Digit1');
    await until(page, (n) => (__tv.seen.cast || 0) > n && (__tv.seen.hit || 0) > 0, 'pressing 1 with the mouse on a monster attacks it', 30000, casts0);
    await page.keyboard.up('Digit1');
    // and a left click on it attacks too
    const hits0 = await Q(page, () => __tv.seen.hit || 0);
    await page.mouse.down(); await page.waitForTimeout(400); await page.mouse.up();
    await until(page, (n) => (__tv.seen.hit || 0) > n, 'a left click on a monster attacks it', 30000, hits0);
    await shot(page, 'desktop-fight');

    await Q(page, () => { __tv.G.player.life = __tv.G.player.stats.maxLife * 0.3; });
    await page.keyboard.press('KeyQ');
    await until(page, () => (__tv.seen.potion || 0) >= 1, 'Q drinks a potion');

    await page.keyboard.press('Escape');
    await until(page, () => !document.getElementById('pause').hidden, 'Escape pauses');
    const t0 = await Q(page, () => __tv.G.t);
    await page.waitForTimeout(500);
    check(await Q(page, (t) => __tv.G.t === t, t0), 'the sim stops while paused');
    await click(page, '#pause-menu [data-act="settings"]');
    await until(page, () => !document.getElementById('settings').hidden && +getComputedStyle(document.getElementById('settings')).zIndex > +getComputedStyle(document.getElementById('pause')).zIndex, 'Settings opens on top of Pause');
    await Q(page, () => document.getElementById('set-sfx').focus());
    await page.keyboard.press('Escape');
    await until(page, () => document.getElementById('settings').hidden && !document.getElementById('pause').hidden, 'Escape with a slider focused closes Settings');
    await Q(page, () => document.querySelector('#pause-menu [data-act="resume"]').focus());
    await page.keyboard.press('Space');
    await until(page, () => document.getElementById('pause').hidden, 'Space on the focused Resume button resumes');

    // town portal and the door back
    // nothing near, so no hit interrupts the cast (a hit does: that is a rule)
    await Q(page, () => { const P = __tv.G.player; __tv.G.mons = __tv.G.mons.filter((m) => Math.hypot(m.x - P.x, m.y - P.y) > 25); __tv.G.shots = []; __tv.G.zones = []; });
    const spot = await Q(page, () => ({ x: __tv.G.player.x, y: __tv.G.player.y }));
    await page.keyboard.press('KeyT');
    await until(page, () => __tv.G.area.id === 'town' && __tv.G.features.some((f) => f.kind === 'portal'), 'T casts a town portal and takes you to town');
    await Q(page, () => { const P = __tv.G.player, d = __tv.G.features.find((f) => f.kind === 'portal'); P.x = d.x; P.y = d.y + 0.5; });
    await until(page, (s) => __tv.G.area.id === 'wilds' && Math.hypot(__tv.G.player.x - s.x, __tv.G.player.y - s.y) < 0.5, 'the portal door takes you back to the same spot', 30000, spot);

    await Q(page, () => document.querySelector('#btn-pause').click());
    await until(page, () => !document.getElementById('pause').hidden, 'the ❚❚ button pauses');
    await click(page, '#pause-menu [data-act="quit"]');
    await until(page, () => __tv.mode === 'title' && !document.getElementById('btn-continue').hidden, 'Save & Quit returns to the title with Continue');
    await click(page, '#title-menu [data-act="continue"]');
    await until(page, () => __tv.mode === 'play' && __tv.G.player.ranks.leap === 1 && __tv.G.area.id === 'wilds', 'Continue restores the saved game');

    // the bot plays on in the page
    // the unkillable training dummy from arena() goes first: it follows the bot and pins it down (1 seed in 9)
    await Q(page, (id) => { __tv.G.mons = __tv.G.mons.filter((m) => m.id !== id); for (const id of [...__tv.ui.stack]) __tv.ui.closeScreen(id); __tv.ff(200); }, mid);
    await until(page, () => __tv.G.player.level >= 5 && __tv.G.stats.kills > 40, 'the bot plays the real game in the page (level 5+)', 60000);
    await Q(page, () => { for (const id of [...__tv.ui.stack]) __tv.ui.closeScreen(id); });
    await page.waitForTimeout(1500);
    const nb = await notBlank(page);
    check(nb.ok, `the picture is not blank (mean ${nb.mean.toFixed(0)}, spread ${nb.spread})`);
    check(await Q(page, () => __tv.view.info.models.failed === 0 && __tv.view.info.models.loaded >= 8), 'models loaded and none failed');
    await until(page, () => __tv.audio.musicPlaying, 'music is playing');
    await until(page, () => __tv.audio.level() > 0.001, 'sound came out of the master bus', 15000);
    await shot(page, 'desktop-play');
    L = await layout(page);
    check(L.noHScroll && L.canvas, 'still no sideways scroll; the canvas still fills the window');
    // labels and the merchant panel draw without errors
    await page.keyboard.down('AltLeft'); await page.waitForTimeout(400); await page.keyboard.up('AltLeft');
    await Q(page, () => { __tv.act({ t: 'portal' }); __tv.panels.open('merchant', __tv.G); });
    await until(page, () => /Ysolde/.test(document.getElementById('panel-title').textContent), 'the merchant panel opens in town');
    await shot(page, 'desktop-merchant');
    await page.keyboard.press('Escape');
    reportErrors('desktop');
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
            for (let p = e; p; p = p.parentElement) p.getAnimations?.().forEach((a) => a.finish());
            e.scrollIntoView({ block: 'center' });
            const b = e.getBoundingClientRect();
            return { x: b.left + b.width / 2, y: b.top + b.height / 2 };
        }, sel);
        if (!r) return false;
        await page.touchscreen.tap(r.x, r.y);
        return true;
    };
    check(await backLinkOk(page), '← Games link is on top');
    await tapSel('#title-menu [data-act="new"]');
    await until(page, () => !document.getElementById('classes').hidden, 'a tap on New Warden shows the classes');
    await tapSel('.class-card[data-cls="stormcaller"]');
    await until(page, () => __tv.mode === 'play' && !document.getElementById('card').hidden, 'a tap on a class starts play');
    await tapSel('#card-ok');
    await until(page, () => document.getElementById('card').hidden, 'a tap closes the card');
    await until(page, () => !document.getElementById('touch').hidden, 'the touch deck is shown');
    const L = await layout(page);
    check(L.noHScroll, 'no sideways scroll');
    check(L.canvas, 'the canvas matches the visible viewport');
    const sizes = await Q(page, () => ['#btn-pause', '.tbtn[data-i="0"]', '.tbtn[data-i="5"]', '.tbtn[data-i="6"]', '#hud-btns .ibtn'].map((s) => {
        const r = document.querySelector(s).getBoundingClientRect();
        return { s, ok: r.width >= 44 && r.height >= 44 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5 };
    }));
    for (const z of sizes) check(z.ok, `${z.s} is at least 44 px and on screen`);

    // the stick walks (in town)
    const zone = await Q(page, () => { const r = document.getElementById('stick-zone').getBoundingClientRect(); return { x: r.left + r.width * 0.5, y: r.top + r.height * 0.5 }; });
    const p0 = await Q(page, () => ({ x: __tv.G.player.x, y: __tv.G.player.y }));
    await touch('touchStart', zone.x, zone.y);
    for (let i = 1; i <= 6; i++) await touch('touchMove', zone.x + i * 10, zone.y - i * 6);
    await until(page, (p) => Math.hypot(__tv.G.player.x - p.x, __tv.G.player.y - p.y) > 1, 'dragging the stick walks', 30000, p0);
    await touch('touchEnd', 0, 0);

    await arena(page);
    await until(page, () => !document.getElementById('card').hidden, 'Act I\'s card shows');
    await tapSel('#card-ok');
    await until(page, () => document.getElementById('card').hidden, 'a tap closes it');
    const casts = await Q(page, () => __tv.seen.cast || 0);
    await tapSel('.tbtn[data-i="0"]');
    await until(page, (n) => (__tv.seen.cast || 0) > n, 'tapping the skill button casts at the nearest enemy', 30000, casts);
    await shot(page, `phone-${w}x${h}`);

    await tapSel('#btn-pause');
    await until(page, () => !document.getElementById('pause').hidden, 'tapping ❚❚ pauses');
    await page.waitForTimeout(300);
    check(await visible(page, 'pause'), 'the pause screen stays open after the finger lifts');
    await tapSel('#pause-menu [data-act="resume"]');
    await until(page, () => document.getElementById('pause').hidden, 'a tap on Resume closes it');
    await tapSel('#hud-btns [data-panel="inventory"]');
    await until(page, () => !document.getElementById('panel').hidden, 'a tap opens the inventory');
    const inv = await Q(page, () => { const r = document.querySelector('#panel .sheet').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 0.5; });
    check(inv, 'the inventory fits the screen');
    await shot(page, `phone-${w}x${h}-inventory`);
    await tapSel('#panel [data-close]');
    await until(page, () => document.getElementById('panel').hidden, 'a tap on ✕ closes it');

    // town on a phone: tap a person (even under the stick zone) to walk over and talk, buy, and tap the prompt
    await Q(page, () => { const P = __tv.G.player; __tv.G.mons = []; __tv.G.shots = []; __tv.G.zones = []; __tv.act({ t: 'portal' }); P.gold = 99999; });
    await until(page, () => __tv.G.area.id === 'town', 'the portal takes the phone player to town');
    await Q(page, () => { const P = __tv.G.player, f = __tv.G.features.find((x) => x.id === 'ysolde'); P.x = f.x + 5; P.y = f.y + 3; });
    await page.waitForTimeout(800);
    const at = await Q(page, () => { const f = __tv.G.features.find((x) => x.id === 'ysolde'); const p = __tv.view.screenOf(f.x, f.y, 0.9); return { x: p.x, y: p.y, under: document.elementFromPoint(p.x, p.y)?.id }; });
    await page.touchscreen.tap(at.x, at.y);
    await until(page, () => /Ysolde/.test(document.getElementById('panel-title').textContent) && !document.getElementById('panel').hidden, `a tap on Ysolde (under #${at.under}) walks over and opens her shop`, 15000);
    const bag0 = await Q(page, () => __tv.G.player.bag.filter(Boolean).length);
    check(await tapSel('#panel [data-do*="gamble"]:not([disabled])'), 'the shop has a buy button');
    await until(page, (n) => __tv.G.player.bag.filter(Boolean).length > n, 'a tap on it buys an item', 5000, bag0);
    await tapSel('#panel [data-close]');
    await until(page, () => document.getElementById('panel').hidden && !document.getElementById('prompt').hidden, 'beside her, the "Tap: talk" prompt shows');
    const pr = await Q(page, () => { const r = document.getElementById('prompt').getBoundingClientRect(); return document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2)?.id; });
    check(pr === 'prompt', `nothing covers the prompt (on top: #${pr})`);
    await tapSel('#prompt');
    await until(page, () => !document.getElementById('panel').hidden, 'a tap on the prompt opens the shop');
    await shot(page, `phone-${w}x${h}-shop`);
    await tapSel('#panel [data-close]');
    await until(page, () => document.getElementById('panel').hidden, 'and ✕ closes it again');
    // a person under the walking stick's zone: a quick tap there is a tap on her, not a walk
    const under = await Q(page, () => {
        const P = __tv.G.player, f = __tv.G.features.find((x) => x.id === 'ysolde');
        for (const [dx, dy] of [[1.2, 0.3], [3, -2], [4, -3], [2, -4], [5, -1]]) {
            P.x = f.x + dx; P.y = f.y + dy;
            __tv.view.camPos.x = P.x; __tv.view.camPos.z = P.y;
            __tv.view.frame(__tv.G, 0, 0);
            const p = __tv.view.screenOf(f.x, f.y, 0.9);
            if (document.elementFromPoint(p.x, p.y)?.id === 'stick-zone') return { x: p.x, y: p.y };
        }
        return null;
    });
    if (under) {
        await page.touchscreen.tap(under.x, under.y);
        await until(page, () => !document.getElementById('panel').hidden, 'a quick tap on a person under the stick zone talks to her');
        await tapSel('#panel [data-close]');
    }
    reportErrors(`phone ${w}×${h}`);
}

// ======================================================================
async function nostorage() {
    console.log('\n== blocked storage');
    const page = await open({ width: 1280, height: 760 }, { nostorage: true });
    await Q(page, () => __tv.start(5, 'shadebinder'));
    await until(page, () => __tv.mode === 'play', 'boots and starts a game with localStorage throwing');
    await Q(page, () => { __tv.act({ t: 'enter', id: 'gate' }); __tv.ff(20); });
    check(await Q(page, () => __tv.G.stats.kills > 0), 'and plays');
    check(await Q(page, () => __tv.save() === false), 'saving fails quietly');
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

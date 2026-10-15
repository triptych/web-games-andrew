/**
 * browsertest.mjs — the real game in real Chromium (SwiftShader).
 *
 * desktop (1280×760): boot to the title with no errors, the ← Games link on top → New Game by
 *   click → the Mayor's welcome, advanced with real Space presses → real arrow keys walk into the
 *   library → Wick wakes up → Escape pauses and the sim stops → Resume → I opens the satchel, every
 *   tab renders → a squabble: real clicks on Shush until it's calm, Continue → a shop: buy with a
 *   click → the bed: a dialogue choice pressed with Space on the focused button → Save & Quit →
 *   Continue restores the game. No sideways scroll; the canvas fills the window.
 * phones (touch only, real CDP touches) at 390×844 and 844×390: taps through the menus, a tap on
 *   the dialogue box moves it on, the touch deck appears, the stick walks, A talks to someone, a
 *   battle is won by tapping its buttons, ❚❚ pauses and stays open after the finger lifts;
 *   controls ≥ 44 px and on screen, no sideways scroll, the canvas matches the visible viewport.
 * nostorage: localStorage throws; the game still boots and plays.
 * Fails on any console error, page error or failed request.
 *
 *   python3 -m http.server 8080          # from the REPO ROOT
 *   node game-080/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8080), ONLY=desktop,phones,nostorage.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8080';
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
    await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    await page.route('https://fonts.gstatic.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('requestfailed', (r) => { if (!r.url().includes('favicon')) errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`); });
    await page.goto(`${BASE}/game-080/index.html?debug=1&fast=4`);
    await page.waitForFunction(() => window.__el && __el.mode === 'title', null, { timeout: 60000 });
    await page.waitForTimeout(800);   // the first frames under SwiftShader are slow
    return page;
}

const check = (cond, msg) => { if (!cond) { fails++; console.log('  FAIL', msg); } else console.log('  ok', msg); return cond; };
const Q = (page, fn, arg) => page.evaluate(fn, arg);
const shot = async (page, name) => { await page.screenshot({ path: path.join(OUT, `bt-${name}.png`) }); };
const until = (page, fn, msg, timeout = 30000, arg = null) =>
    page.waitForFunction(fn, arg, { timeout, polling: 100 }).then(() => check(true, msg), () => check(false, msg));
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
const reportErrors = (label) => { check(errors.length === 0, `${label}: no console errors, page errors or failed requests`); for (const e of errors.slice(0, 8)) console.log('    ', e); };

/** Press Space until the dialogue is over (real key presses, waiting for each line). */
async function talkThrough(page, max = 40) {
    for (let i = 0; i < max; i++) {
        const st = await Q(page, () => ({ mode: __el.G.mode, choices: !!__el.G.dialog?.choices }));
        if (st.mode !== 'dialog') return true;
        if (st.choices) { await page.keyboard.press('Space'); await page.waitForTimeout(250); continue; }
        await page.keyboard.press('Space');
        await page.waitForTimeout(150);
    }
    return Q(page, () => __el.G.mode !== 'dialog');
}

// ======================================================================
async function desktop() {
    console.log('\n== desktop 1280×760');
    const page = await open({ width: 1280, height: 760 });
    check(await backLinkOk(page), '← Games link is on top and points at ../index.html');
    check(await Q(page, () => !document.getElementById('title').hidden), 'title screen is up');
    check(await Q(page, () => document.getElementById('btn-continue').hidden), 'no Continue without a save');
    const L = await layout(page);
    check(L.noHScroll && L.canvas, 'no sideways scroll; the canvas fills the window');
    await shot(page, 'desktop-title');

    await click(page, '#title-menu [data-act="new"]');
    await until(page, () => __el.mode === 'play' && __el.G.mode === 'dialog' && !document.getElementById('dialog').hidden, 'New Game opens on the Mayor\'s welcome');
    await shot(page, 'desktop-intro');
    check(await talkThrough(page), 'real Space presses read through the welcome');
    await until(page, () => __el.G.mode === 'explore' && __el.G.bag.libkey === 1, 'you have the Library Key and can walk');

    // walk north into the library with real keys
    await page.keyboard.down('ArrowUp');
    await until(page, () => __el.G.map === 'library', 'holding ↑ walks in at the library door');
    await page.keyboard.up('ArrowUp');
    await until(page, () => __el.G.mode === 'dialog' && __el.G.dialog.line?.who !== 'mayor', 'Wick wakes up inside');
    await shot(page, 'desktop-wick');
    check(await talkThrough(page), 'and you can read through it');
    await until(page, () => __el.G.flags.metWick === 1 && __el.G.mode === 'explore', 'Wick joins you');

    // facing: walk left and right with real keys and look at which side of the face the eye is on
    for (const [key, dir] of [['ArrowLeft', 'left'], ['ArrowRight', 'right']]) {
        await page.keyboard.down(key);
        await until(page, (d) => __el.G.p.dir === d, `holding ${key} turns you ${dir}`, 10000, dir);
        await page.keyboard.up(key);
        const eyeX = await Q(page, async (d) => {
            const { personFrame, PLAYER_LOOK } = await import('./js/view/sprites.js');
            const c = personFrame(PLAYER_LOOK, d, 0, 'player');
            const px = c.getContext('2d').getImageData(0, 0, c.width, c.height).data;
            // the eye: the dark pixel in the face's eye row (the head starts at row 6)
            for (let x = 0; x < c.width; x++) { const i = (10 * c.width + x) * 4; if (px[i] === 42 && px[i + 1] === 30 && px[i + 2] === 30) return x; }
            return -1;
        }, dir);
        check(dir === 'left' ? eyeX >= 0 && eyeX < 8 : eyeX >= 8, `walking ${dir}, the librarian faces ${dir} (eye at x ${eyeX})`);
    }
    await page.keyboard.down('ArrowUp'); await page.waitForTimeout(150); await page.keyboard.up('ArrowUp');

    // a grimoire set on a lectern flies to its own lectern and lands in light
    await Q(page, () => { __el.grant(['lumen']); __el.warp('library', 13, 2); __el.G.p.dir = 'up'; });
    await page.waitForTimeout(400);
    await page.keyboard.press('Space');
    await until(page, () => __el.G.mode === 'dialog', 'the lectern offers to take the book');
    for (let i = 0; i < 6 && !(await Q(page, () => __el.G.placed.length)); i++) { await page.keyboard.press('Space'); await page.waitForTimeout(200); }
    await until(page, () => __el.G.placed.length === 1 && __el.view.world.restores.length === 1, 'placing it starts the flight to its lectern');
    check(await Q(page, () => __el.view.world.awaiting(0)), 'the lectern stays empty while the book is in the air');
    await until(page, () => __el.view.world.restores[0]?.landed, 'and it lands, in a burst of light', 5000);
    await shot(page, 'desktop-lectern');
    await until(page, () => !__el.view.world.restores.length, 'then the light settles', 5000);
    check(await talkThrough(page), 'and Wick remembers something');

    // pause
    await page.keyboard.press('Escape');
    await until(page, () => !document.getElementById('pause').hidden, 'Escape pauses');
    const t0 = await Q(page, () => __el.G.t);
    await page.waitForTimeout(500);
    check(await Q(page, (t) => __el.G.t === t, t0), 'the sim stops while paused');
    await page.keyboard.press('Space');     // Resume has focus: Space must press it (game-078)
    await until(page, () => document.getElementById('pause').hidden, 'Space on the focused Resume button resumes');
    await page.waitForTimeout(400);           // a key right after closing a menu is swallowed on purpose

    // the satchel
    await page.keyboard.press('KeyI');
    await until(page, () => !document.getElementById('bag').hidden, 'I opens the satchel');
    for (const tab of ['books', 'items', 'gear', 'shelves', 'journal', 'map']) {
        await click(page, `#bag-tabs [data-tab="${tab}"]`);
        await until(page, (t) => document.querySelector(`#bag-tabs [data-tab="${t}"]`).classList.contains('on') && document.getElementById('bag-body').children.length > 0, `the ${tab} tab renders`, 10000, tab);
        if (tab === 'map') await shot(page, 'desktop-map');
    }
    await page.keyboard.press('Escape');
    await until(page, () => document.getElementById('bag').hidden, 'Escape closes it');
    await page.waitForTimeout(400);

    // the satchel by keys alone: X opens and closes it, arrows walk the tabs and rows, Z uses
    await Q(page, () => { __el.give('tea', 2); __el.G.hp = 10; });
    await page.keyboard.press('KeyX');
    await until(page, () => !document.getElementById('bag').hidden, 'X opens the satchel');
    await Q(page, () => { __el.ui.bagTab('books'); document.querySelector('#bag-tabs .on').focus(); });
    await page.keyboard.press('ArrowRight');
    await until(page, () => document.querySelector('#bag-tabs .on')?.dataset.tab === 'items', 'Right turns to the next tab');
    await page.keyboard.press('ArrowDown');
    await until(page, () => document.activeElement?.closest('#bag-body') && /Tea/.test(document.activeElement.textContent), 'Down moves onto the first row');
    await page.keyboard.press('KeyZ');
    await until(page, () => __el.G.hp > 10, 'Z uses the tea on that row');
    await page.keyboard.press('ArrowLeft');
    await until(page, () => document.querySelector('#bag-tabs .on')?.dataset.tab === 'books', 'Left turns back a tab');
    await page.keyboard.press('KeyM');
    await until(page, () => document.querySelector('#bag-tabs .on')?.dataset.tab === 'map', 'M turns to the map');
    await page.keyboard.press('KeyX');
    await until(page, () => document.getElementById('bag').hidden, 'X closes the satchel again');
    await page.waitForTimeout(400);

    // settings by keys: Left and Right move a slider; Z on it doesn't press Delete
    await page.keyboard.press('Escape');
    await until(page, () => !document.getElementById('pause').hidden, 'Escape pauses again');
    await Q(page, () => document.querySelector('#pause [data-act="settings"]').focus());
    await page.keyboard.press('KeyZ');
    await until(page, () => !document.getElementById('settings').hidden, 'Z on Settings opens it');
    await Q(page, () => document.getElementById('set-sfx').focus());
    const sfx0 = await Q(page, () => +document.getElementById('set-sfx').value);
    await page.keyboard.press(sfx0 > 0 ? 'ArrowLeft' : 'ArrowRight');
    await until(page, (v) => +document.getElementById('set-sfx').value !== v, 'Left / Right move the Sound slider', 10000, sfx0);
    await page.keyboard.press('KeyZ');
    await page.waitForTimeout(400);
    check(await Q(page, () => !document.getElementById('settings').hidden && __el.hasSave()), 'Z on a slider presses nothing (the save is still there)');
    await page.keyboard.press('KeyX');
    await until(page, () => document.getElementById('settings').hidden && !document.getElementById('pause').hidden, 'X closes Settings, back to the pause menu');
    await page.keyboard.press('KeyX');
    await until(page, () => document.getElementById('pause').hidden, 'and X closes the pause menu');
    await page.waitForTimeout(400);

    // houses hide small things in their furniture; a "Z" prompt floats over anything Action would use
    await Q(page, () => __el.warp('mabels', 6, 4));
    await page.keyboard.down('ArrowUp'); await page.waitForTimeout(80); await page.keyboard.up('ArrowUp');
    await until(page, () => !document.getElementById('prompt').hidden && /Talk/.test(document.getElementById('prompt').textContent), 'facing Mabel across the counter, a prompt says Z Talk');
    check(await Q(page, () => document.getElementById('prompt-key').textContent === 'Z'), 'the prompt shows the Z key');
    const spot = await Q(page, async () => {
        const { getWorld } = await import('./js/sim/worldgen.js');
        const M = getWorld().maps.mabels;
        for (const k in M.objs) if (M.objs[k].kind === 'stash') return { x: k % M.w, y: Math.floor(k / M.w), id: M.objs[k].id };
        return null;
    });
    check(!!spot, 'Mabel\'s shop has something tucked away in it');
    await Q(page, (s) => { __el.warp('mabels', s.x, s.y + 1); __el.G.p.dir = 'up'; }, spot);
    await until(page, () => /Search/.test(document.getElementById('prompt').textContent) && !document.getElementById('prompt').hidden, 'facing that piece of furniture, the prompt says Z Search');
    await shot(page, 'desktop-search');
    const had = await Q(page, () => ({ coins: __el.G.coins, n: Object.values(__el.G.bag).reduce((a, b) => a + b, 0) }));
    await page.keyboard.press('KeyZ');
    await until(page, () => __el.G.mode === 'dialog' && /!/.test(__el.G.dialog.line?.text || ''), 'Z searches it and finds something');
    check(await Q(page, (b) => __el.G.coins > b.coins || Object.values(__el.G.bag).reduce((a, x) => a + x, 0) > b.n, had), 'and it goes in your satchel (or purse)');
    check(await Q(page, () => document.getElementById('prompt').hidden), 'no prompt floats while a dialogue is open');
    check(await talkThrough(page), 'and you read on');
    await page.waitForTimeout(300);
    check(await Q(page, () => document.getElementById('prompt').hidden), 'once searched, it has no prompt any more');

    // a squabble, by clicks
    await Q(page, () => { __el.warp('world', 30, 60); __el.fight(['paperback']); });
    await until(page, () => __el.G.mode === 'battle' && !document.getElementById('battle').hidden, 'a squabble begins');
    await shot(page, 'desktop-battle');
    for (let i = 0; i < 12; i++) {
        const st = await Q(page, () => ({ phase: __el.G.battle?.phase, idle: __el.ui.battleIdle(), mode: __el.G.mode }));
        if (st.mode !== 'battle' || st.phase !== 'choose') break;
        await page.waitForFunction(() => __el.ui.battleIdle() && !document.getElementById('b-menu').classList.contains('busy'), null, { timeout: 20000, polling: 100 }).catch(() => {});
        await click(page, '#b-menu button');            // Shush (one foe: no target step)
        await page.waitForTimeout(300);
    }
    await until(page, () => __el.G.battle?.phase === 'won', 'Shush by Shush, the paperback is calmed');
    await until(page, () => [...document.querySelectorAll('#b-menu button')].some((b) => /Continue/.test(b.textContent)), 'the result shows with a Continue button', 30000);
    await shot(page, 'desktop-battle-won');
    await click(page, '#b-menu button');
    await until(page, () => __el.G.mode === 'explore' && document.getElementById('battle').hidden, 'Continue returns to the world');

    // a shop, by clicks
    await Q(page, () => { __el.G.coins = 200; __el.warp('pips', 6, 4); __el.G.p.dir = 'up'; });
    await page.waitForTimeout(400);
    await page.keyboard.press('Space');
    await until(page, () => __el.G.mode === 'dialog', 'Space at the counter talks to Pip');
    await talkThrough(page);
    await until(page, () => __el.G.mode === 'shop' && !document.getElementById('shop').hidden, 'and Pip\'s shop opens');
    await shot(page, 'desktop-shop');
    const coins = await Q(page, () => __el.G.coins);
    await Q(page, () => [...document.querySelectorAll('#shop-body .row-btn')].find((b) => /Honey Biscuit/.test(b.textContent))?.click());
    await until(page, (c) => __el.G.coins < c && __el.G.bag.biscuit >= 1, 'clicking a biscuit buys it', 10000, coins);
    await click(page, '#shop-close');
    await until(page, () => __el.G.mode === 'explore' && document.getElementById('shop').hidden, 'Leave closes the shop');

    // the bed: a dialogue choice, pressed with Space on the focused button
    await Q(page, () => { __el.G.hp = 3; __el.warp('library', 27, 8); __el.G.p.dir = 'left'; });
    await page.waitForTimeout(400);
    await page.keyboard.press('Space');
    await until(page, () => __el.G.mode === 'dialog', 'Space at the bed asks to rest');
    await until(page, () => document.querySelectorAll('#dlg-choices .choice').length === 2 || __el.ui.dlg.done, 'the line finishes', 10000);
    await page.keyboard.press('Space');     // finish the line if it's still typing, or press the focused choice
    await until(page, () => document.querySelectorAll('#dlg-choices .choice').length === 2, 'the choices appear', 10000);
    await page.keyboard.press('Space');
    await until(page, () => __el.G.hp > 3, 'Space on the focused "Rest" choice rests');
    await talkThrough(page);
    // the same with the Action key Z, which the browser doesn't press buttons with by itself
    await Q(page, () => { __el.G.hp = 3; __el.G.p.dir = 'left'; });
    await page.waitForTimeout(400);
    await page.keyboard.press('KeyZ');
    await until(page, () => __el.G.mode === 'dialog', 'Z at the bed asks to rest');
    for (let i = 0; i < 3 && !(await Q(page, () => document.querySelectorAll('#dlg-choices .choice').length === 2)); i++) { await page.keyboard.press('KeyZ'); await page.waitForTimeout(200); }
    await until(page, () => document.querySelectorAll('#dlg-choices .choice').length === 2, 'the choices appear', 10000);
    await page.keyboard.press('KeyZ');
    await until(page, () => __el.G.hp > 3, 'Z picks the highlighted "Rest" choice');
    await talkThrough(page);
    // Z presses battle buttons too
    await Q(page, () => { __el.warp('world', 30, 60); __el.fight(['dustbunny']); });
    await until(page, () => __el.G.mode === 'battle', 'a squabble for the Z key');
    for (let i = 0; i < 40; i++) {
        if (await Q(page, () => __el.G.mode !== 'battle')) break;
        await page.waitForFunction(() => __el.ui.battleIdle(), null, { timeout: 20000, polling: 100 }).catch(() => {});
        await page.keyboard.press('KeyZ');
        await page.waitForTimeout(250);
    }
    await until(page, () => __el.G.mode === 'explore', 'Z alone shushes, wins and continues');
    await Q(page, () => __el.warp('library', 27, 8));

    // save and continue
    const before = await Q(page, () => ({ lvl: __el.G.lvl, coins: __el.G.coins, map: __el.G.map }));
    await Q(page, () => document.querySelector('#btn-pause').click());
    await until(page, () => !document.getElementById('pause').hidden, 'the ❚❚ button pauses');
    await click(page, '#pause-menu [data-act="quit"]');
    await until(page, () => __el.mode === 'title' && !document.getElementById('btn-continue').hidden, 'Save & Quit returns to the title with Continue');
    await click(page, '#title-menu [data-act="continue"]');
    await until(page, (b) => __el.mode === 'play' && __el.G.coins === b.coins && __el.G.map === b.map && __el.G.flags.metWick === 1, 'Continue restores the saved game', 30000, before);
    await shot(page, 'desktop-continue');
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
    await until(page, () => __el.mode === 'play' && __el.G.mode === 'dialog', 'a tap on New Game starts with the welcome');
    for (let i = 0; i < 30; i++) {
        const m = await Q(page, () => __el.G.mode);
        if (m !== 'dialog') break;
        await tapSel('#dlg-box');
        await page.waitForTimeout(120);
    }
    await until(page, () => __el.G.mode === 'explore', 'tapping the dialogue box reads through it');
    await until(page, () => !document.getElementById('touch').hidden, 'the touch deck is shown');
    await shot(page, `phone-${w}x${h}-start`);

    const L = await layout(page);
    check(L.noHScroll, 'no sideways scroll');
    check(L.canvas, 'the canvas matches the visible viewport');
    const sizes = await Q(page, () => ['#btn-a', '#btn-pause', '#btn-bag'].map((s) => {
        const r = document.querySelector(s).getBoundingClientRect();
        return { s, ok: r.width >= 44 && r.height >= 44 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight };
    }));
    for (const z of sizes) check(z.ok, `${z.s} is at least 44 px and on screen`);
    const hudClear = await Q(page, () => {
        const a = document.getElementById('back-link').getBoundingClientRect(), b = document.getElementById('hud-stats').getBoundingClientRect();
        const c = document.getElementById('hud-books').getBoundingClientRect();
        const hit = (p, q) => p.left < q.right && q.left < p.right && p.top < q.bottom && q.top < p.bottom;
        return !hit(a, b) && !hit(a, c) && !hit(b, c);
    });
    check(hudClear, 'the HUD panels don\'t overlap the back link or each other');

    // drag the stick with a real touch
    const zone = await Q(page, () => { const r = document.getElementById('stick-zone').getBoundingClientRect(); return { x: r.left + r.width * 0.5, y: r.top + r.height * 0.5 }; });
    const p0 = await Q(page, () => ({ x: __el.G.p.x, y: __el.G.p.y }));
    await touch('touchStart', zone.x, zone.y);
    for (let i = 1; i <= 6; i++) await touch('touchMove', zone.x + i * 12, zone.y);
    await until(page, (p) => Math.hypot(__el.G.p.x - p.x, __el.G.p.y - p.y) > 1, 'dragging the stick walks', 30000, p0);
    await touch('touchEnd', 0, 0);

    // A talks to the Mayor
    const mpos = await Q(page, async () => {
        const mod = await import('./js/sim/worldgen.js');
        const W = mod.getWorld().maps.world;
        const n = W.npcs.find((x) => x.id === 'mayor');
        __el.warp('world', n.x, n.y + 1);
        __el.G.p.dir = 'up';
        return n;
    });
    check(!!mpos, 'found the Mayor');
    await page.waitForTimeout(300);
    await tapSel('#btn-a');
    await until(page, () => __el.G.mode === 'dialog' && __el.G.dialog.from === 'mayor', 'tapping A talks to the Mayor');
    for (let i = 0; i < 20; i++) { if (await Q(page, () => __el.G.mode) !== 'dialog') break; await tapSel('#btn-a'); await page.waitForTimeout(150); }
    await until(page, () => __el.G.mode === 'explore', 'tapping A again reads through it');

    // a choice by the A button: the bed
    await Q(page, () => { __el.G.flags.metWick = 1; __el.G.hp = 3; __el.warp('library', 27, 8); __el.G.p.dir = 'left'; });
    await page.waitForTimeout(300);
    await tapSel('#btn-a');
    await until(page, () => __el.G.mode === 'dialog', 'tapping A at the bed asks to rest');
    for (let i = 0; i < 6; i++) { if (await Q(page, () => __el.G.hp > 3 || __el.G.mode !== 'dialog')) break; await tapSel('#btn-a'); await page.waitForTimeout(250); }
    if (!await until(page, () => __el.G.hp > 3, 'tapping A picks the highlighted "Rest" choice')) {
        console.log('    ', JSON.stringify(await Q(page, () => ({ mode: __el.G.mode, line: __el.G.dialog?.line, choices: __el.G.dialog?.choices, focus: document.activeElement?.outerHTML?.slice(0, 80), a: (() => { const r = document.getElementById('btn-a').getBoundingClientRect(); const t = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return t?.id || t?.className; })() }))));
        await shot(page, `phone-${w}x${h}-choice`);
    }
    // read the rest by tapping the dialogue box (another A here would ask about the bed again)
    for (let i = 0; i < 10; i++) { if (await Q(page, () => __el.G.mode) !== 'dialog') break; await tapSel('#dlg-box'); await page.waitForTimeout(150); }
    await Q(page, () => __el.warp('world', 30, 60));

    // a battle by taps
    await Q(page, () => { __el.G.flags.metWick = 1; __el.fight(['dustbunny']); });
    await until(page, () => __el.G.mode === 'battle', 'a squabble begins');
    await until(page, () => document.getElementById('touch').hidden, 'the touch deck steps aside for the battle menu');
    for (let i = 0; i < 12; i++) {
        const st = await Q(page, () => __el.G.battle?.phase);
        if (st !== 'choose') break;
        await page.waitForFunction(() => __el.ui.battleIdle() && !document.getElementById('b-menu').classList.contains('busy'), null, { timeout: 20000, polling: 100 }).catch(() => {});
        await tapSel('#b-menu button');
        await page.waitForTimeout(300);
    }
    await until(page, () => [...document.querySelectorAll('#b-menu button')].some((b) => /Continue/.test(b.textContent)), 'tapping Shush wins it', 40000);
    await shot(page, `phone-${w}x${h}-battle`);
    const sz = await Q(page, () => [...document.querySelectorAll('#b-menu button')].every((b) => { const r = b.getBoundingClientRect(); return r.height >= 40 && r.bottom <= innerHeight && r.left >= 0 && r.right <= innerWidth; }));
    check(sz, 'battle buttons are finger-sized and on screen');
    await tapSel('#b-menu button');
    await until(page, () => __el.G.mode === 'explore', 'Continue');

    await tapSel('#btn-pause');
    await until(page, () => !document.getElementById('pause').hidden, 'tapping ❚❚ pauses');
    await page.waitForTimeout(300);
    check(await Q(page, () => !document.getElementById('pause').hidden), 'the pause screen stays open after the finger lifts');
    await tapSel('#pause-menu [data-act="resume"]');
    await until(page, () => document.getElementById('pause').hidden, 'a tap on Resume closes it');
    await tapSel('#btn-bag');
    await until(page, () => !document.getElementById('bag').hidden, 'tapping 🎒 opens the satchel');
    await shot(page, `phone-${w}x${h}-bag`);
    const sheetOk = await Q(page, () => { const r = document.querySelector('#bag .sheet').getBoundingClientRect(); const a = document.getElementById('back-link').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.top >= a.bottom - 1; });
    check(sheetOk, 'the satchel sits on screen, below the back link');
    reportErrors(`phone ${w}×${h}`);
}

// ======================================================================
// Just after an update a browser can hold some old files and fetch some new ones. Every module is
// fetched at the release's version, so that can't mix; and if loading fails anyway, the page says
// so and offers a fresh copy instead of a title screen whose buttons do nothing.
async function stale() {
    console.log('\n== a stale file after an update (touch phone)');
    if (browser) await browser.close();
    browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });
    const ctx = await browser.newContext({ viewport: { width: 390, height: 844 }, hasTouch: true, isMobile: true });
    const page = await ctx.newPage();
    await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    const js = [];
    page.on('request', (r) => { if (/\/game-080\/(js\/.*\.js|style\.css)/.test(r.url())) js.push(r.url()); });
    await page.goto(`${BASE}/game-080/index.html`);
    await page.waitForFunction(() => document.getElementById('title') && !document.getElementById('title').hidden, null, { timeout: 60000 });
    await page.waitForTimeout(1500);
    const v = await Q(page, () => import('./js/config.js').then((m) => m.VERSION));
    check(js.length >= 30 && js.every((u) => u.endsWith('?v=' + v)), `every module and the stylesheet carry ?v=${v} (${js.length} files)`);
    // an old js/sim/game.js, from before prompt() existed
    await page.route('**/game-080/js/sim/game.js*', async (r) => {
        const res = await r.fetch();
        r.fulfill({ response: res, body: (await res.text()).replace('export function prompt', 'function prompt') });
    });
    await page.goto(`${BASE}/game-080/index.html`);
    await until(page, () => !document.getElementById('boot-fail').hidden, 'a module that fails to link shows "couldn\'t start" and a Reload button');
    await shot(page, 'stale-bootfail');
    await page.unroute('**/game-080/js/sim/game.js*');
    const b = await page.locator('#boot-reload').boundingBox();
    await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
    await until(page, () => /fresh=/.test(location.search) && document.getElementById('boot-fail').hidden && !document.getElementById('title').hidden, 'tapping Reload loads a fresh copy');
    await page.waitForTimeout(1000);
    const nb = await page.locator('#title-menu [data-act="new"]').boundingBox();
    await page.touchscreen.tap(nb.x + nb.width / 2, nb.y + nb.height / 2);
    await until(page, () => document.getElementById('title').hidden && !document.getElementById('hud').hidden, 'and tapping New Game starts the game');
}

// ======================================================================
async function nostorage() {
    console.log('\n== blocked storage');
    const page = await open({ width: 1280, height: 760 }, { nostorage: true });
    await click(page, '#title-menu [data-act="new"]');
    await until(page, () => __el.mode === 'play', 'boots and starts a game with localStorage throwing');
    await talkThrough(page);
    await Q(page, () => __el.ff(20));
    check(await Q(page, () => __el.save() === false), 'saving fails quietly');
    reportErrors('nostorage');
}

try {
    if (want('desktop')) await desktop();
    if (want('phones')) { await phone(390, 844); await phone(844, 390); }
    if (want('nostorage')) await nostorage();
    if (want('stale')) await stale();
} catch (err) {
    fails++;
    console.log('  FAIL threw:', err.message);
} finally {
    if (browser) await browser.close();
}
console.log(`\n${fails ? `${fails} FAILED` : 'all passed'} · screenshots in ${path.relative(process.cwd(), OUT)}`);
process.exit(fails ? 1 : 0);

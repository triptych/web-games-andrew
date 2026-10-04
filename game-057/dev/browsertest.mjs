/**
 * browsertest.mjs — real Chromium, real WebGL, real three.js r165.
 *
 * Desktop (1280×760): the title's attract demo → New Operation → difficulty →
 * intro → sector card → HUD; move with WASD, aim and fire with the mouse,
 * roll, grenade, Shock Pulse, swap weapons; a sealed room clears; pickups;
 * the Supply Depot (buy), a data log (read, close); pause, map, settings,
 * controls, codex; a boss to death → field upgrade → elevator → Sector II
 * card; death → SIGNAL LOST → retry; the escape → dropship → ending; Horde
 * Mode. Then touch-only phones at 390×844 and 844×390: twin sticks, ROLL,
 * the weapon panel swaps, USE at a terminal, HUD on screen, 44 px targets.
 * Fails on any console error, page error or failed request. Screenshots go
 * to dev/shots/.
 *
 *   python3 -m http.server 8057                 # from the REPO ROOT
 *   node game-057/dev/browsertest.mjs
 *
 * No network to unpkg.com? Point THREE_PKG at an unpacked three@0.165.0:
 *   npm pack three@0.165.0 && tar xzf three-0.165.0.tgz     # -> ./package
 *   THREE_PKG=$PWD/package node game-057/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8057), OUT, ONLY=desktop|flows|phones, PW_CHROMIUM_PATH.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? path.join(HERE, 'package');
const BASE = process.env.BASE ?? 'http://127.0.0.1:8057';
const OUT = process.env.OUT ?? path.join(HERE, 'shots');
const ONLY = process.env.ONLY ?? '';
fs.mkdirSync(OUT, { recursive: true });

const errors = [];
let browser = null;
const launch = () => chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
});

async function newPage(viewport, touch = false) {
    if (browser) await browser.close();
    browser = await launch();
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch });
    await ctx.addInitScript(() => {
        try {
            localStorage.clear();
            localStorage.setItem('hivebreaker.save.v1', JSON.stringify({ v: 1, settings: { master: 0, sfx: 0, music: 0, quality: 'low' } }));
        } catch { /* ignore */ }
    });
    const page = await ctx.newPage();
    if (fs.existsSync(PKG)) {
        await page.route('https://unpkg.com/**', (route) => {
            const rel = new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, '');
            const file = path.join(PKG, rel);
            if (!fs.existsSync(file)) return route.abort();
            route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
        });
    }
    await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('requestfailed', (r) => { if (!r.url().includes('favicon')) errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`); });
    await page.goto(`${BASE}/game-057/index.html?debug=1`);
    await page.waitForFunction(() => window.__hb && __hb.mode === 'title', null, { timeout: 60000 });
    return { ctx, page };
}

const shot = async (page, name) => { await page.waitForTimeout(300); await page.screenshot({ path: path.join(OUT, `${name}.png`) }); console.log('  shot', name); };
const check = (cond, msg) => { if (!cond) { errors.push(`check: ${msg}`); console.log('  FAIL', msg); } else console.log('  ok', msg); };
const until = async (page, fn, msg, timeout = 60000, arg = null) => {
    const ok = await page.waitForFunction(fn, arg, { timeout }).then(() => true, () => false);
    check(ok, msg);
    return ok;
};
const Q = (page, fn, arg) => page.evaluate(fn, arg);
const visible = (page, id) => Q(page, (i) => { let e = document.getElementById(i); if (!e) return false; for (; e; e = e.parentElement) if (getComputedStyle(e).display === 'none') return false; return true; }, id);
const toGame = async (page) => {
    // In debug mode the card auto-dismisses quickly, so it may already be gone by the next poll.
    await until(page, () => !document.getElementById('sector-card').classList.contains('hidden') || __hb.mode === 'game', 'sector card shows');
    await page.waitForTimeout(600);
    await Q(page, () => __hb.skipCard());
    await until(page, () => __hb.mode === 'game', 'into the game', 10000);
};

// ------------------------------------------------------------------ desktop

async function desktop() {
    console.log('\n== desktop');
    const { page } = await newPage({ width: 1280, height: 760 });
    check(await Q(page, () => !!__hb.G.attract && __hb.world.enemies !== undefined), 'title runs the attract demo');
    await page.waitForTimeout(1500);
    await shot(page, 'd01-title');

    await page.click('#m-new');
    check(await visible(page, 'difficulty'), 'New Operation asks for a difficulty');
    await shot(page, 'd02-difficulty');
    await page.click('#diff-list .mbtn.primary');
    await until(page, () => !document.getElementById('intro').classList.contains('hidden'), 'intro crawl plays');
    await page.waitForTimeout(1600);
    await shot(page, 'd03-intro');
    await page.click('#intro-skip');
    await toGame(page);
    check(await visible(page, 'hud'), 'HUD is up');
    check(await visible(page, 'crosshair'), 'mouse crosshair shown');
    await page.waitForTimeout(800);
    await shot(page, 'd04-sector1');

    // Move with WASD.
    const p0 = await Q(page, () => ({ x: __hb.world.player.x, y: __hb.world.player.y }));
    await page.keyboard.down('KeyW');
    await Q(page, () => __hb.advance(0.6));
    await page.keyboard.up('KeyW');
    const p1 = await Q(page, () => ({ x: __hb.world.player.x, y: __hb.world.player.y }));
    check(p1.y < p0.y - 1, 'W moves the marine north');
    // Aim and fire with the mouse.
    await Q(page, () => __hb.snapCam());
    await page.waitForTimeout(300);
    const sp = await Q(page, () => { const p = __hb.world.player; return __hb.screen(p.x + 4, p.y, 1.15); });
    await page.mouse.move(sp.x, sp.y);
    await page.mouse.down();
    await Q(page, () => __hb.advance(0.5));
    await page.mouse.up();
    check(await Q(page, () => __hb.world.stats.shots > 2), 'holding the mouse fires');
    const face = await Q(page, () => __hb.world.player.face);
    check(Math.abs(face) < 0.4, `the marine aims at the cursor (face ${face.toFixed(2)})`);
    // Roll, grenade (right click), pulse, swap.
    await page.keyboard.press('Space');
    await Q(page, () => __hb.advance(1 / 60));
    check(await Q(page, () => __hb.world.player.rollT > 0), 'Space rolls');
    await Q(page, () => __hb.advance(0.6));
    await page.mouse.click(sp.x, sp.y, { button: 'right' });
    await Q(page, () => __hb.advance(1 / 60));
    check(await Q(page, () => __hb.world.player.grenades === 2), 'right click throws a grenade');
    await Q(page, () => __hb.advance(1.4));
    await page.keyboard.press('KeyQ');
    await Q(page, () => __hb.advance(1 / 60));
    check(await Q(page, () => __hb.world.player.pulses === 1), 'Q fires a Shock Pulse');
    await Q(page, () => __hb.give('scatter', 2));
    await page.keyboard.press('Tab');
    await Q(page, () => __hb.advance(1 / 60));
    check(await Q(page, () => __hb.world.player.weapons[__hb.world.player.cur].id === 'scatter'), 'Tab swaps to the new gun');
    await page.keyboard.press('Digit1');
    await Q(page, () => __hb.advance(1 / 60));
    check(await Q(page, () => __hb.world.player.cur === 0), '1 selects slot one');

    // A sealed room.
    await Q(page, () => { __hb.god(true); __hb.toRoom('combat'); __hb.advance(0.4); });
    check(await Q(page, () => __hb.world.activeRoom >= 0 && __hb.world.lv.doors.some((d) => d.target === 0)), 'entering a combat room seals the doors');
    await Q(page, () => __hb.advance(1.5));
    await shot(page, 'd05-sealed');
    await Q(page, () => __hb.bot(6));
    await page.waitForTimeout(500);
    await shot(page, 'd06-fight');
    for (let i = 0; i < 40 && await Q(page, () => __hb.world.activeRoom >= 0); i++) await Q(page, () => { __hb.killAll(); __hb.advance(1.5); });
    check(await Q(page, () => __hb.world.activeRoom < 0 && __hb.world.cleared >= 1), 'the room clears and the doors open');
    const salv = await Q(page, () => { __hb.advance(3); const w = __hb.world, r = w.lv.rooms.find((x) => x.state === 'cleared'); w.player.x = r.cx; w.player.y = r.cy; __hb.advance(3); return w.player.salvage; });
    check(salv > 0, `room rewards collected (salvage ${salv})`);

    // Supply Depot.
    await Q(page, () => {
        const w = __hb.world, it = w.items.find((x) => x.kind === 'shopitem' && x.item !== 'weapon');
        w.player.salvage = 500; w.player.hp = 40;
        w.player.x = it.x; w.player.y = it.y + 0.8; w.player.ox = w.player.x; w.player.oy = w.player.y;
        __hb.advance(0.2);
    });
    await page.waitForTimeout(400);
    check(await visible(page, 'prompt'), 'standing at a shop item shows a prompt');
    const pr = await Q(page, () => JSON.stringify(__hb.world.prompt));
    await page.keyboard.press('KeyE');
    await Q(page, () => __hb.advance(0.1));
    check(await Q(page, () => __hb.world.player.salvage < 500), `E buys it (prompt ${pr})`);
    await shot(page, 'd07-shop');
    // A data log.
    await Q(page, () => {
        const w = __hb.world, it = w.items.find((x) => x.kind === 'terminal');
        w.player.x = it.x; w.player.y = it.y + 0.9; w.player.ox = w.player.x; w.player.oy = w.player.y;
        __hb.advance(0.2);
    });
    await page.keyboard.press('KeyE');
    await Q(page, () => __hb.advance(0.1));
    await until(page, () => __hb.mode === 'log', 'a terminal opens its data log', 5000);
    await page.waitForTimeout(1200);
    await shot(page, 'd08-log');
    await page.keyboard.press('KeyE');
    check(await Q(page, () => __hb.mode === 'game'), 'E closes the log');

    // Pause, map, settings, controls.
    await page.keyboard.press('Escape');
    check(await visible(page, 'pause'), 'Esc pauses');
    await shot(page, 'd09-pause');
    await page.click('#p-map');
    check(await visible(page, 'bigmap'), 'map from the pause menu');
    await shot(page, 'd10-map');
    await page.click('#bigmap [data-close]');
    await page.click('#p-settings');
    check(await visible(page, 'settings'), 'settings open');
    await page.click('#settings [data-close]');
    await page.click('#p-help');
    check(await visible(page, 'help'), 'controls open');
    await page.click('#help [data-close]');
    await page.click('#p-resume');
    check(await Q(page, () => __hb.mode === 'game'), 'resume');

    // Boss → field upgrade → elevator → Sector II.
    await Q(page, () => { __hb.toBoss(); __hb.advance(2.2); });
    await until(page, () => !!__hb.world.boss, 'the boss spawns', 10000);
    await Q(page, () => __hb.advance(2));
    await page.waitForTimeout(600);
    await shot(page, 'd11-boss');
    check(await visible(page, 'boss-bar'), 'boss bar shows');
    await Q(page, () => { __hb.world.boss.hp = 5; __hb.bot(4); });
    await until(page, () => __hb.mode === 'perk', 'boss down → field upgrade choice', 20000);
    await shot(page, 'd12-perk');
    await page.keyboard.press('Digit1');
    check(await Q(page, () => Object.keys(__hb.world.player.perks).length === 1 && __hb.mode === 'game'), 'picked a field upgrade');
    await Q(page, () => {
        __hb.advance(1);
        const w = __hb.world, it = w.items.find((x) => x.kind === 'elevator');
        w.player.x = it.x; w.player.y = it.y + 0.5; w.player.ox = w.player.x; w.player.oy = w.player.y;
        __hb.advance(0.1);
    });
    await page.keyboard.press('KeyE');
    await Q(page, () => __hb.advance(0.05));
    await until(page, () => __hb.G.run.sector === 1, 'the elevator takes us to Sector II', 10000);
    await toGame(page);
    check(await Q(page, () => __hb.world.sectorNum === 1 && Object.keys(__hb.world.player.perks).length === 1), 'Sector II keeps the loadout and perk');
    check(await Q(page, () => __hb.meta().run && __hb.meta().run.sector === 1), 'progress saved at the elevator');
    await shot(page, 'd13-sector2');

    // Death and retry.
    await Q(page, () => { __hb.god(false); const p = __hb.world.player; p.armor = 0; p.inv = 0; p.rollT = 0; p.hp = 1; p.pow.aegis = 0; });
    await Q(page, () => { const w = __hb.world; __hb.toRoom('combat'); __hb.advance(2); for (let i = 0; i < 600 && w.phase !== 'dead'; i++) { w.player.inv = 0; w.player.rollT = 0; __hb.advance(1 / 60, { mx: 0, my: 0, aimX: w.player.x, aimY: w.player.y - 1 }); if (w.phase !== 'dead' && i % 60 === 0) { const e = w.enemies[0]; if (e) { w.player.x = e.x; w.player.y = e.y; } } } });
    if (!(await Q(page, () => __hb.world.phase === 'dead'))) await Q(page, () => { const w = __hb.world; w.player.hp = 0; w.player.alive = false; w.phase = 'dead'; });
    await until(page, () => !document.getElementById('gameover').classList.contains('hidden'), 'SIGNAL LOST screen', 20000);
    await shot(page, 'd14-gameover');
    await page.click('#go-retry');
    await toGame(page);
    check(await Q(page, () => __hb.world.sectorNum === 1 && __hb.world.player.alive && __hb.G.run.stats.deaths === 1), 'retry restarts the sector');

    // Codex from the title.
    await page.keyboard.press('Escape');
    await page.click('#p-quit');
    await until(page, () => __hb.mode === 'title', 'abort to title', 5000);
    check(await visible(page, 'm-continue'), 'title offers Continue');
    await page.click('#m-codex');
    check(await visible(page, 'codex'), 'codex opens');
    await page.waitForTimeout(500);
    check(await Q(page, () => document.querySelectorAll('#codex-body .cx:not(.locked) img').length >= 1), 'codex shows rendered bugs we met');
    await shot(page, 'd15-codex');
    await page.click('#codex .tab[data-tab="logs"]');
    check(await Q(page, () => document.querySelectorAll('#codex-body .cx.log .n').length >= 1), 'codex lists the log we read');
    await page.click('#codex [data-close]');
}

// ------------------------------------------------------------------ escape, ending, horde, every sector

async function flows() {
    console.log('\n== escape, ending, horde, sectors');
    const { page } = await newPage({ width: 1280, height: 760 });
    for (const s of [2, 3, 4]) {
        await Q(page, (n) => __hb.toSector(n), s);
        await toGame(page);
        await Q(page, () => { __hb.god(true); __hb.toRoom('combat'); __hb.advance(0.4); __hb.bot(4); });
        await page.waitForTimeout(700);
        await shot(page, `f0${s}-sector${s + 1}`);
        check(await Q(page, () => __hb.world.enemies.length > 0 || __hb.world.stats.kills > 0), `sector ${s + 1} fights`);
    }
    // Sector V boss, then free Ellie.
    for (let i = 0; i < 40 && await Q(page, () => __hb.world.activeRoom >= 0); i++) await Q(page, () => { __hb.killAll(); __hb.advance(1.5); });
    await Q(page, () => { __hb.toBoss(); __hb.advance(2.2); __hb.advance(3); });
    await page.waitForTimeout(500);
    await shot(page, 'f05-mother');
    await Q(page, () => { __hb.world.boss.hp = 5; __hb.bot(4); });
    await until(page, () => __hb.mode === 'perk', 'the Brood Mother falls', 20000);
    await page.click('#perk-list .perk-card');
    await Q(page, () => {
        __hb.advance(1);
        const w = __hb.world, it = w.items.find((x) => x.kind === 'cocoon');
        w.player.x = it.x; w.player.y = it.y + 1; w.player.ox = w.player.x; w.player.oy = w.player.y;
        __hb.advance(0.1);
    });
    check(await Q(page, () => __hb.world.prompt?.kind === 'cocoon'), 'Ellie\'s cocoon can be cut open');
    await page.keyboard.press('KeyE');
    await Q(page, () => __hb.advance(0.05));
    await until(page, () => __hb.G.run.sector === 5, 'freeing Ellie starts the escape', 10000);
    await toGame(page);
    check(await Q(page, () => __hb.world.mode === 'escape' && !!__hb.world.ellie), 'the escape, with Ellie');
    check(await visible(page, 'escape-timer'), 'self-destruct countdown');
    await Q(page, () => { __hb.god(true); __hb.bot(8); });
    await page.waitForTimeout(600);
    await shot(page, 'f06-escape');
    await Q(page, () => {
        const w = __hb.world, pad = w.lv.rooms[w.lv.padRoom];
        for (const o of [w.player, w.ellie]) { o.x = pad.cx; o.y = pad.cy + 1; o.ox = o.x; o.oy = o.y; }
        __hb.advance(0.2);
    });
    await until(page, () => __hb.mode === 'victory', 'reaching the dropship wins', 10000);
    await page.waitForTimeout(3500);
    await shot(page, 'f07-ending');
    check(await Q(page, () => __hb.meta().beaten && !__hb.meta().run), 'campaign marked beaten');

    // Horde.
    await page.goto(`${BASE}/game-057/index.html?debug=1`);
    await page.waitForFunction(() => window.__hb && __hb.mode === 'title');
    await page.click('#m-horde');
    await page.click('#diff-list .mbtn.primary');
    await toGame(page);
    await Q(page, () => { __hb.god(true); __hb.bot(14); });
    check(await Q(page, () => __hb.world.mode === 'horde' && __hb.world.horde.wave >= 1), 'horde waves arrive');
    await page.waitForTimeout(600);
    await shot(page, 'f08-horde');
}

// ------------------------------------------------------------------ phones

async function phone(viewport, tag) {
    console.log(`\n== phone ${viewport.width}×${viewport.height}`);
    const { page } = await newPage(viewport, true);
    await page.waitForTimeout(800);
    await shot(page, `${tag}-01-title`);
    await page.tap('#m-new');
    await page.tap('#diff-list .mbtn.primary');
    await page.tap('#intro-skip');
    await toGame(page);
    await page.touchscreen.tap(5, viewport.height / 2); // a first touch switches to touch controls
    await page.waitForTimeout(200);
    check(await visible(page, 'touch'), 'touch controls shown');
    check(!(await visible(page, 'crosshair')), 'no mouse crosshair on touch');
    // Every HUD panel on screen, tap targets ≥ 44 px.
    const boxes = await Q(page, () => ['hp-box', 'weapon-panel', 'map-wrap', 'pause-btn', 't-roll', 't-gren', 't-pulse', 't-reload'].map((id) => { const r = document.getElementById(id).getBoundingClientRect(); return { id, l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height }; }));
    for (const b of boxes) check(b.l >= 0 && b.t >= 0 && b.r <= innerWidthOf(viewport) + 1 && b.b <= viewport.height + 1, `${b.id} fully on screen`);
    for (const b of boxes.filter((x) => x.id.startsWith('t-') || x.id === 'pause-btn')) check(b.w >= 44 && b.h >= 44, `${b.id} is at least 44 px`);
    // Move with the left stick.
    const p0 = await Q(page, () => ({ x: __hb.world.player.x, y: __hb.world.player.y }));
    const cdp = await page.context().newCDPSession(page);
    const lx = viewport.width * 0.2, ly = viewport.height * 0.75;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: lx, y: ly, id: 1 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: lx, y: ly - 60, id: 1 }] });
    await Q(page, () => __hb.advance(0.6));
    const p1 = await Q(page, () => ({ x: __hb.world.player.x, y: __hb.world.player.y }));
    check(p1.y < p0.y - 1, 'the left stick moves the marine');
    // Aim and fire with the right stick while still moving.
    const rx = viewport.width * 0.8, ry = viewport.height * 0.45;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: lx, y: ly - 60, id: 1 }, { x: rx, y: ry, id: 2 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: lx, y: ly - 60, id: 1 }, { x: rx + 60, y: ry, id: 2 }] });
    const s0 = await Q(page, () => __hb.world.stats.shots);
    await Q(page, () => __hb.advance(0.5));
    check(await Q(page, (s) => __hb.world.stats.shots > s, s0), 'pushing the right stick fires');
    check(await Q(page, () => Math.abs(__hb.world.player.face) < 0.5), 'and aims where it points');
    await page.waitForTimeout(400);
    await shot(page, `${tag}-02-sticks`);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    // Buttons.
    await page.tap('#t-roll');
    await Q(page, () => __hb.advance(1 / 60));
    check(await Q(page, () => __hb.world.player.rollT > 0), 'ROLL rolls');
    await Q(page, () => { __hb.advance(0.8); __hb.give('flame'); });
    await page.tap('#weapon-panel');
    await Q(page, () => __hb.advance(1 / 60));
    check(await Q(page, () => __hb.world.player.cur === 1), 'tapping the weapon panel swaps');
    await page.tap('#t-gren');
    await Q(page, () => __hb.advance(1 / 60));
    check(await Q(page, () => __hb.world.player.grenades === 2), 'grenade button throws');
    // USE at a terminal.
    await Q(page, () => {
        const w = __hb.world, it = w.items.find((x) => x.kind === 'terminal');
        w.player.x = it.x; w.player.y = it.y + 0.9; w.player.ox = w.player.x; w.player.oy = w.player.y;
        __hb.advance(0.2);
    });
    await page.waitForTimeout(300);
    check(await visible(page, 't-use'), 'USE appears near a terminal');
    await page.tap('#t-use');
    await Q(page, () => __hb.advance(0.05));
    await until(page, () => __hb.mode === 'log', 'USE reads the log', 5000);
    await shot(page, `${tag}-03-log`);
    await page.tap('#log-close');
    // A fight on the phone.
    await Q(page, () => { __hb.god(true); __hb.toRoom('combat'); __hb.advance(0.4); __hb.bot(4); });
    await page.waitForTimeout(700);
    await shot(page, `${tag}-04-fight`);
    await page.tap('#pause-btn');
    check(await visible(page, 'pause'), 'pause button');
    await shot(page, `${tag}-05-pause`);
}
const innerWidthOf = (v) => v.width;

try {
    if (!ONLY || ONLY === 'desktop') await desktop();
    if (!ONLY || ONLY === 'flows') await flows();
    if (!ONLY || ONLY === 'phones') {
        await phone({ width: 390, height: 844 }, 'p');
        await phone({ width: 844, height: 390 }, 'l');
    }
} catch (err) {
    errors.push(`exception: ${err.stack ?? err}`);
}
if (browser) await browser.close();
console.log(errors.length ? `\n${errors.length} problem(s):\n` + errors.join('\n') : '\nall browser checks passed, no console errors');
process.exit(errors.length ? 1 : 0);

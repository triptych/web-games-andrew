/**
 * browsertest.mjs — real Chromium, real WebGL (SwiftShader), real three.js r165.
 *
 * Desktop (1280×760): boot to the title (back link on top, no console errors) → New Delve with a
 * typed name → the prologue played with the keyboard → drive, drill down, bore sideways and fly
 * with real key presses → a blast rune on key 1 → park at the Guild, E opens it, Talk plays the
 * license scene and starts chapter 1 → sell at the Assay House, buy an upgrade at the Forge and a
 * rune at Runes & Remedies by clicking → the journal's five tabs and the map → pause, Save & Quit,
 * Continue → wake a waystone and travel → the Rune Gate opened with the lance → a heart-shard broken
 * by drilling into it while the wyrm is awake → the wyrm freed, the Wyrmheart touched, the ending
 * choice, the epilogue cards and the ledger → back to free delving.
 * Phones (touch only, real CDP touches) at 390×844 and 844×390: menus by tap, the name screen,
 * dialogue by tap, the stick drives and drills, the rune buttons work, Enter appears at a shop and
 * opens it, a long shop scrolls with a finger, buttons ≥ 44 px, nothing overlaps the controls,
 * nothing scrolls sideways, the canvas fills the window.
 * Blocked storage: the game boots and plays with localStorage throwing.
 * Fails on any console error, page error or failed request.
 *
 *   python3 -m http.server 8073          # from the REPO ROOT
 *   node game-073/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8073), ONLY=desktop|phones|nostorage, THREE_PKG.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8073';
const OUT = path.join(HERE, 'shots');
const ONLY = process.env.ONLY ?? '';
fs.mkdirSync(OUT, { recursive: true });

const errors = [];
let fails = 0;
let browser = null;

async function newPage(viewport, { touch = false, nostorage = false } = {}) {
    if (browser) await browser.close();
    browser = await chromium.launch({
        executablePath: process.env.PW_CHROMIUM_PATH || undefined,
        args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
    });
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch });
    await ctx.addInitScript((ns) => {
        if (ns) {
            Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } });
        } else {
            try { localStorage.clear(); localStorage.setItem('runebore.v1.settings', JSON.stringify({ sfx: 0, music: 0, quality: 'high', shake: true, touch: 'auto' })); } catch { /* */ }
        }
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
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('requestfailed', (r) => { if (!r.url().includes('favicon')) errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`); });
    await page.goto(`${BASE}/game-073/index.html?debug=1&fast=4`);
    await page.waitForFunction(() => window.__rb && __rb.mode === 'title', null, { timeout: 60000 });
    return { ctx, page };
}

const shot = async (page, name) => { await page.waitForTimeout(300); await page.screenshot({ path: path.join(OUT, `bt-${name}.png`) }); console.log('  shot', name); };
const check = (cond, msg) => { if (!cond) { fails++; console.log('  FAIL', msg); } else console.log('  ok', msg); return cond; };
const Q = (page, fn, arg) => page.evaluate(fn, arg);
const until = async (page, fn, msg, timeout = 30000, arg = null) => {
    const ok = await page.waitForFunction(fn, arg, { timeout, polling: 100 }).then(() => true, () => false);
    return check(ok, msg);
};
// Playwright's click() waits for animation frames to settle, which SwiftShader never does; click from inside.
const click = (page, sel) => Q(page, (s) => { const e = document.querySelector(s); if (!e) return false; e.click(); return true; }, sel);
const visible = (page, sel) => Q(page, (s) => {
    const e = document.querySelector(s); if (!e) return false;
    const r = e.getBoundingClientRect(); if (!r.width || !r.height) return false;
    const st = getComputedStyle(e);
    return st.display !== 'none' && st.visibility !== 'hidden' && !e.closest('[hidden]') && r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight;
}, sel);
const backLinkOk = (page) => Q(page, () => {
    const a = document.getElementById('back-link');
    if (!a || a.getAttribute('href') !== '../index.html') return false;
    const r = a.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return r.width > 0 && (top === a || a.contains(top));
});
const layoutOk = (page) => Q(page, () => {
    const c = document.getElementById('gl').getBoundingClientRect();
    return {
        noHScroll: document.documentElement.scrollWidth <= innerWidth + 1,
        canvas: Math.abs(c.width - innerWidth) < 2 && Math.abs(c.height - innerHeight) < 2 && c.left === 0 && c.top === 0,
    };
});
/** Press through every dialogue line with a key; returns how many lines were advanced. */
async function finishScenes(page, key = 'Enter', max = 80) {
    let n = 0;
    for (; n < max; n++) {
        const up = await Q(page, () => !!__rb.ui.scene || __rb.ui.sceneQueue.length > 0);
        if (!up) break;
        const choice = await Q(page, () => { const b = document.querySelector('#dlg-choices button'); if (b) { b.click(); return true; } return false; });
        if (!choice) await page.keyboard.press(key);
        await page.waitForTimeout(60);
    }
    return n;
}

// ======================================================================
async function desktop() {
    console.log('\n== desktop 1280×760');
    const { page } = await newPage({ width: 1280, height: 760 });
    check(await visible(page, '#title .logo'), 'title screen with the logo');
    check(await backLinkOk(page), '← Games link is on top and points at ../index.html');
    check(!(await visible(page, '#btn-continue')), 'no Continue button without a save');
    await shot(page, 'd-title');

    // New Delve with a typed name
    await click(page, '#btn-new');
    await until(page, () => !document.getElementById('newgame').hidden, 'name screen opens');
    await page.fill('#name-input', 'Wynn');
    await page.keyboard.press('Enter');
    await until(page, () => __rb.mode === 'play' && __rb.G.name === 'Wynn', 'New Delve starts play with the typed name');
    await until(page, () => !!__rb.ui.scene && __rb.ui.scene.id === 'prologue', 'the prologue plays');
    await shot(page, 'd-prologue');
    const lines = await finishScenes(page);
    check(lines >= 8, `prologue advanced with Enter (${lines} presses)`);
    check(await visible(page, '#hud'), 'HUD visible');
    check(await visible(page, '#objective') && (await Q(page, () => document.querySelector('#objective .obj-txt').textContent)).includes('Guild'), 'objective points at the Guild');

    // Drive, drill, bore, fly — real keys
    const x0 = await Q(page, () => __rb.G.rig.x);
    await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(700); await page.keyboard.up('ArrowLeft');
    check((await Q(page, () => __rb.G.rig.x)) < x0 - 0.5, 'ArrowLeft drives Thimble left');
    await page.keyboard.down('ArrowDown');
    await until(page, () => __rb.G.rig.y < -2.5, 'ArrowDown drills down three rows', 40000);
    await page.keyboard.up('ArrowDown');
    await page.waitForTimeout(300);
    const dug0 = await Q(page, () => __rb.G.stats.dug);
    check(dug0 >= 2, `tiles dug (${dug0})`);
    await shot(page, 'd-dig');
    await page.keyboard.down('ArrowUp');
    await until(page, () => __rb.G.rig.y > 0, 'ArrowUp flies back up the shaft', 30000);
    await page.keyboard.up('ArrowUp');
    // sideways: stand in a pocket against a wall and push into it
    await Q(page, () => { const w = __rb.G.world; for (let c = 3; c <= 5; c++) for (let r = 8; r <= 9; r++) w.tiles[r * 36 + c] = 0; w.tiles[10 * 36 + 4] = 1; w.tiles[9 * 36 + 6] = 1; __rb.tp(5, 10); });
    await page.waitForTimeout(500);
    const dugS = await Q(page, () => __rb.G.stats.dug);
    await page.keyboard.down('ArrowRight');
    await until(page, (d) => __rb.G.stats.dug > d && __rb.G.rig.x > 6, 'ArrowRight into a wall bores sideways', 30000, dugS);
    await page.keyboard.up('ArrowRight');
    // Blast rune on key 1
    await Q(page, () => __rb.tp(30, 12));
    await page.waitForTimeout(400);
    const blasts = await Q(page, () => __rb.G.items.blast);
    await page.keyboard.press('Digit1');
    await until(page, () => __rb.G.items.blast === 0 && __rb.G.stats.blasts === 1, `key 1 sets off a blast rune (had ${blasts})`);

    // The Guild: park, E, Talk
    await Q(page, () => __rb.tp(23, 0));
    await until(page, () => __rb.G.at === 'guild', 'parked at the Guild');
    await until(page, () => !document.getElementById('btn-enter').hidden && document.getElementById('btn-enter').textContent.includes('Guild'), 'Enter button names the Guild');
    await page.keyboard.press('KeyE');
    await until(page, () => __rb.ui.panelKey === 'guild', 'E opens the Guild');
    check(await Q(page, () => document.getElementById('panel-talk').classList.contains('has-business')), 'Talk button flags Orla has business');
    await shot(page, 'd-guild');
    await click(page, '#panel-talk');
    await until(page, () => __rb.ui.scene && __rb.ui.scene.id === 'license', 'Talk plays the license scene');
    await finishScenes(page, 'Space');
    check(await Q(page, () => __rb.G.story.ch === 1), 'chapter 1 begins');
    await click(page, '#panel-leave');
    await until(page, () => !__rb.ui.panelKey, 'Leave closes the shop');

    // The Assay House: sell
    await Q(page, () => { __rb.G.cargo[0] = 5; __rb.G.cargo[2] = 2; __rb.tp(8, 0); });
    await until(page, () => __rb.G.at === 'assay', 'parked at the Assay House');
    await click(page, '#btn-enter');
    await until(page, () => __rb.ui.panelKey === 'assay', 'Enter button opens the Assay House');
    const m0 = await Q(page, () => __rb.G.money);
    await click(page, '#panel-body [data-act=sell]');
    await until(page, (m) => __rb.G.money === m + 5 * 12 + 2 * 34, 'Sell everything pays for the hold', 5000, m0);
    await click(page, '#panel-leave');

    // The Forge: buy an upgrade; Runes: buy a rune
    await Q(page, () => { __rb.G.money = 5000; __rb.tp(13, 0); });
    await until(page, () => __rb.G.at === 'forge', 'parked at the Forge');
    await page.keyboard.press('Enter');
    await until(page, () => __rb.ui.panelKey === 'forge', 'Enter key opens the Forge');
    await click(page, '#panel-body [data-act="up:lantern"]');
    check(await Q(page, () => __rb.G.up.lantern === 1), 'bought the Oil Lamp');
    await shot(page, 'd-forge');
    await page.keyboard.press('Escape');
    await until(page, () => !__rb.ui.panelKey, 'Escape closes the shop');
    await Q(page, () => __rb.tp(29, 0));
    await until(page, () => __rb.G.at === 'runes', 'parked at Runes & Remedies');
    await page.keyboard.press('KeyE');
    await until(page, () => __rb.ui.panelKey === 'runes', 'opened Runes & Remedies');
    await click(page, '#panel-body [data-act="item:recall"]');
    check(await Q(page, () => __rb.G.items.recall === 1), 'bought a recall scroll');
    await page.keyboard.press('KeyE');

    // Journal
    await page.keyboard.press('KeyJ');
    await until(page, () => !document.getElementById('journal').hidden, 'J opens the journal');
    for (const tab of ['relics', 'codex', 'map', 'stats', 'quest']) {
        await click(page, `#journal .tabs button[data-tab=${tab}]`);
        check(await Q(page, (t) => document.querySelector(`#journal .tabs button[data-tab=${t}]`).classList.contains('on') && document.getElementById('journal-body').textContent.length > 20, tab), `journal tab: ${tab}`);
        if (tab === 'map') { check(await Q(page, () => document.getElementById('map-canvas')?.width > 100), 'the map draws'); await shot(page, 'd-map'); }
    }
    await page.keyboard.press('Escape');
    await until(page, () => document.getElementById('journal').hidden, 'Escape closes the journal');

    // Pause, Save & Quit, Continue
    await page.keyboard.press('Escape');
    await until(page, () => !document.getElementById('pause').hidden, 'Escape pauses');
    const t0 = await Q(page, () => __rb.G.time);
    await page.waitForTimeout(800);
    check((await Q(page, () => __rb.G.time)) === t0, 'the world stops while paused');
    await click(page, '#pause [data-act=quit]');
    await until(page, () => __rb.mode === 'title' && !document.getElementById('btn-continue').hidden, 'Save & Quit returns to a title with Continue');
    check((await Q(page, () => document.getElementById('continue-info').textContent)).includes('Wynn'), 'Continue shows the save');
    await click(page, '#btn-continue');
    await until(page, () => __rb.mode === 'play' && __rb.G.name === 'Wynn' && __rb.G.up.lantern === 1 && __rb.G.items.recall === 1 && __rb.G.story.ch === 1, 'Continue restores the delve');

    // A waystone: stand on it, travel up and back
    await Q(page, () => { const p = __rb.G.world.waystonePos[0]; __rb.G.up.drill = 4; __rb.tp(p.c, p.r); });
    await until(page, () => __rb.G.waystones[0], 'standing on the Kharadun Waystone wakes it', 30000);
    await finishScenes(page);
    await until(page, () => __rb.G.at === 'waystone:0', 'parked on the waystone');
    await page.keyboard.press('KeyE');
    await until(page, () => __rb.ui.panelKey === 'waystone:0', 'E opens the waystone');
    await shot(page, 'd-waystone');
    await click(page, '#panel-body [data-act="travel:surface"]');
    await until(page, () => __rb.G.rig.y > 0 && !__rb.ui.panelKey, 'the waystone carries Thimble to the Spire');
    await Q(page, () => __rb.tp(18, 0));
    await until(page, () => __rb.G.at === 'spire', 'parked at the Spire');
    await page.keyboard.press('KeyE');
    await until(page, () => !!document.querySelector('#panel-body [data-act="travel:0"]'), 'the Spire offers the Kharadun Waystone');
    await click(page, '#panel-body [data-act="travel:0"]');
    await until(page, () => __rb.G.rig.y < -190, 'and travels back down');

    // The Rune Gate and the wyrm
    await Q(page, () => { for (let i = 0; i < 7; i++) __rb.relic(i); __rb.G.up.hull = 6; __rb.G.up.tank = 6; __rb.G.rig.hull = 330; __rb.G.rig.fuel = 120; const w = __rb.G.world; for (let c = 15; c <= 18; c++) for (let r = 365; r <= 367; r++) w.tiles[r * 36 + c] = 0; __rb.tp(16, 368); });
    await page.waitForTimeout(400);
    await finishScenes(page);
    await page.keyboard.down('ArrowDown');
    await until(page, () => __rb.G.gateOpen, 'drilling the Rune Gate with the lance opens it', 30000);
    await page.keyboard.up('ArrowDown');
    await finishScenes(page);
    await until(page, () => !!__rb.G.boss, 'falling into the chamber wakes the Gloamwyrm', 30000);
    await finishScenes(page);
    await shot(page, 'd-wyrm');
    // break a shard by drilling into it from its ledge
    await Q(page, () => { __rb.G.rig.hull = 330; const s = __rb.G.boss.shards[0]; __rb.tp(s.c + 1, s.r + 1); });
    await page.keyboard.down('ArrowLeft');
    await until(page, () => __rb.G.boss.shards[0].broken, 'drilling a heart-shard breaks it', 30000);
    await page.keyboard.up('ArrowLeft');
    await finishScenes(page);
    // the rest by the sim, then the ending by the player
    await Q(page, () => { for (const s of __rb.G.boss.shards) if (!s.broken) { __rb.G.world.tiles[s.r * 36 + s.c] = 0; __rb.G.boss.shardBroken(__rb.G, s.c, s.r); } });
    await until(page, () => __rb.G.bossDefeated, 'the wyrm is freed when every shard is broken', 60000);
    await finishScenes(page);
    await shot(page, 'd-freed');
    await Q(page, () => { const w = __rb.G.world; __rb.tp(18, 396); __rb.G.rig.hull = 330; void w; });
    await page.keyboard.down('ArrowDown');
    await until(page, () => __rb.ui.scene && __rb.ui.scene.id === 'ending', 'touching the Wyrmheart plays the ending', 30000);
    await page.keyboard.up('ArrowDown');
    await finishScenes(page);
    await until(page, () => !document.getElementById('cards').hidden, 'the epilogue cards follow the choice');
    await shot(page, 'd-epilogue');
    for (let i = 0; i < 8 && await Q(page, () => !document.getElementById('cards').hidden); i++) { await page.keyboard.press('Space'); await page.waitForTimeout(80); }
    await until(page, () => !document.getElementById('ending').hidden, 'then the ledger');
    await shot(page, 'd-ledger');
    await click(page, '#ending-next');
    await until(page, () => __rb.mode === 'play' && __rb.G.story.flags.ending && !__rb.G.ended && __rb.G.rig.y > 0, 'and free delving resumes on the surface');
}

// ======================================================================
async function phone(w, h) {
    console.log(`\n== phone ${w}×${h} (touch only)`);
    const { ctx, page } = await newPage({ width: w, height: h }, { touch: true });
    const cdp = await ctx.newCDPSession(page);
    const tapAt = async (x, y) => {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
        await page.waitForTimeout(40);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await page.waitForTimeout(120);
    };
    const tap = async (sel) => {
        const r = await Q(page, (s) => { const e = document.querySelector(s); if (!e) return null; e.scrollIntoView({ block: 'center' }); const b = e.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, sel);
        if (!r) return false;
        await tapAt(r.x, r.y);
        return true;
    };
    const drag = async (x0, y0, dx, dy, holdMs) => {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: x0, y: y0, id: 2 }] });
        for (let i = 1; i <= 6; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: x0 + (dx * i) / 6, y: y0 + (dy * i) / 6, id: 2 }] }); await page.waitForTimeout(20); }
        await page.waitForTimeout(holdMs);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
    check(await backLinkOk(page), 'back link on top');
    let L = await layoutOk(page);
    check(L.noHScroll && L.canvas, 'title: no sideways scroll, canvas fills the window');
    await tap('#btn-new');
    await until(page, () => !document.getElementById('newgame').hidden, 'tap New Delve opens the name screen');
    await tap('#newgame-go');
    await until(page, () => __rb.mode === 'play' && !!__rb.ui.scene, 'tap Begin starts the prologue');
    for (let i = 0; i < 40 && await Q(page, () => !!__rb.ui.scene); i++) await tap('.dlg-box');
    check(await Q(page, () => !__rb.ui.scene), 'dialogue advanced by tapping');
    await until(page, () => !document.getElementById('touch').hidden && document.body.classList.contains('touch'), 'touch controls shown');
    check(await backLinkOk(page), 'back link still on top in play');
    // sizes
    const small = await Q(page, () => [...document.querySelectorAll('#touch .item-btn, #btn-pause, #btn-journal')].filter((b) => { const r = b.getBoundingClientRect(); return r.width < 44 || r.height < 44; }).length);
    check(small === 0, `every touch control ≥ 44 px (${small} too small)`);
    const overlaps = await Q(page, () => {
        const els = ['#hud-btns', '#gauges', '#readouts', '#item-btns', '#back-link'].map((s) => document.querySelector(s)).filter(Boolean).map((e) => e.getBoundingClientRect());
        let n = 0;
        for (let i = 0; i < els.length; i++) for (let j = i + 1; j < els.length; j++) {
            const a = els[i], b = els[j];
            if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) n++;
        }
        return n;
    });
    check(overlaps === 0, `HUD, buttons and back link don't overlap (${overlaps})`);
    L = await layoutOk(page);
    check(L.noHScroll && L.canvas, 'play: no sideways scroll, canvas fills the window');
    // the stick: drag down to drill
    const zone = await Q(page, () => { const r = document.getElementById('stick-zone').getBoundingClientRect(); return { x: r.left + r.width * 0.35, y: r.top + r.height * 0.5 }; });
    await drag(zone.x, zone.y, 0, 70, 6000);
    check(await Q(page, () => __rb.G.rig.y < -0.5 && __rb.G.stats.dug >= 1), 'stick down drills');
    await drag(zone.x, zone.y, 0, -70, 3500);
    check(await Q(page, () => __rb.G.rig.y > 0), 'stick up flies');
    const x1 = await Q(page, () => __rb.G.rig.x);
    await drag(zone.x, zone.y, 70, 0, 900);
    check((await Q(page, () => __rb.G.rig.x)) > x1 + 0.4, 'stick right drives');
    // an item button
    await Q(page, () => { __rb.G.items.flask = 1; __rb.G.rig.fuel = 2; });
    await tap('#item-btns [data-item=flask]');
    await until(page, () => __rb.G.items.flask === 0 && __rb.G.rig.fuel > 6, 'the flask button pours aether');
    // a shop by tapping Enter, scrolled with a finger
    await Q(page, () => { __rb.G.money = 99999; __rb.tp(13, 0); });
    await until(page, () => !document.getElementById('btn-enter').hidden, 'Enter appears at the Forge');
    const eb = await Q(page, () => { const r = document.getElementById('btn-enter').getBoundingClientRect(); return { w: r.width, h: r.height, inView: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight }; });
    check(eb.h >= 44 && eb.inView, `Enter button ≥ 44 px tall and on screen (${Math.round(eb.w)}×${Math.round(eb.h)})`);
    const enterHitsStick = await Q(page, () => { const a = document.getElementById('btn-enter').getBoundingClientRect(); const b = document.getElementById('item-btns').getBoundingClientRect(); return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom; });
    check(!enterHitsStick, 'Enter button clear of the rune buttons');
    await shot(page, `p${w}-enter`);
    await tap('#btn-enter');
    await until(page, () => __rb.ui.panelKey === 'forge', 'tap Enter opens the Forge');
    const sc = await Q(page, () => { const s = document.querySelector('#panel .sheet'); return { can: s.scrollHeight > s.clientHeight + 4, top: s.scrollTop }; });
    if (sc.can) {
        const r = await Q(page, () => { const b = document.querySelector('#panel .sheet').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height * 0.75 }; });
        await drag(r.x, r.y, 0, -200, 200);
        await page.waitForTimeout(300);
        check(await Q(page, () => document.querySelector('#panel .sheet').scrollTop > 20), 'the shop scrolls with a finger');
    } else check(true, 'the shop fits without scrolling');
    await shot(page, `p${w}-forge`);
    const lastBuy = await Q(page, () => [...document.querySelectorAll('#panel-body [data-act^="up:"]')].pop().dataset.act);
    await tap(`#panel-body [data-act="${lastBuy}"]`);
    check(await Q(page, () => __rb.G.up.ward === 1), 'tap buys the Frostward at the bottom of the list');
    await tap('#panel-leave');
    await until(page, () => !__rb.ui.panelKey, 'tap Leave closes the shop');
    // journal and pause by tap
    await tap('#btn-journal');
    await until(page, () => !document.getElementById('journal').hidden, 'journal button opens the journal');
    await tap('#journal .tabs button[data-tab=map]');
    await page.waitForTimeout(300);
    await shot(page, `p${w}-map`);
    await tap('#journal-close');
    await tap('#btn-pause');
    await until(page, () => !document.getElementById('pause').hidden, 'pause button pauses');
    await tap('#pause [data-act=resume]');
    await until(page, () => document.getElementById('pause').hidden, 'Resume');
    // underground screenshot
    await Q(page, () => { __rb.G.relics[0] = true; __rb.tp(10, 70); });
    await page.waitForTimeout(1500);
    await shot(page, `p${w}-deep`);
}

// ======================================================================
async function nostorage() {
    console.log('\n== blocked storage');
    const { page } = await newPage({ width: 1024, height: 700 }, { nostorage: true });
    await click(page, '#btn-new');
    await click(page, '#newgame-go');
    await until(page, () => __rb.mode === 'play' && !!__rb.ui.scene, 'boots and starts with localStorage throwing');
    await finishScenes(page);
    await page.keyboard.down('ArrowDown');
    if (!await until(page, () => __rb.G.rig.y < -1, 'and plays')) console.log(await Q(page, () => JSON.stringify({ y: __rb.G.rig.y, stack: __rb.ui.screenStack, scene: !!__rb.ui.scene, q: __rb.ui.sceneQueue, mode: __rb.mode, act: document.activeElement?.id })));
    await page.keyboard.up('ArrowDown');
}

try {
    if (!ONLY || ONLY === 'desktop') await desktop();
    if (!ONLY || ONLY === 'phones') { await phone(390, 844); await phone(844, 390); }
    if (!ONLY || ONLY === 'nostorage') await nostorage();
} catch (err) {
    fails++;
    console.log('  CRASH', err.message);
}
if (browser) await browser.close();
for (const e of errors) console.log('  ERROR', e);
const total = fails + errors.length;
console.log(total ? `\n${total} FAILURE(S)` : '\nall passed');
process.exit(total ? 1 : 0);

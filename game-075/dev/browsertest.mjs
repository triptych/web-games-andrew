/**
 * browsertest.mjs — the real game in Chromium (SwiftShader WebGL for the CRT).
 *
 * Desktop 1280×800: boot with no errors → the back link is on screen and on top →
 * the attract pages and the demo → coin (5) and START → GAME SELECT by keyboard →
 * the realm intro → play: arrows move SQUIRE, touching the sword picks it up,
 * X drops it, Z slashes → P pauses, Options toggles the CRT, P resumes →
 * a cleared realm shows the tally and leads to realm 2 → losing the last life asks
 * CONTINUE?, B gives up → GAME OVER → name entry → the score is in the table →
 * every realm boots → the bot beats CHROMAGON and carries the Chrome Chalice home
 * → the ending → loop 2.
 * Touch-only phones at 390×844 and 844×390: the right layout, nothing scrolls
 * sideways, the monitor is fully on screen, every control ≥ 44 px and clear of
 * the monitor; tap 1P START, tap a menu row, tap through the intro, the joystick
 * moves SQUIRE, ❚❚ pauses.
 * With localStorage blocked the game still boots and plays.
 * Fails on any console error, page error or failed request.
 *
 *   python3 -m http.server 8075                  # from the REPO ROOT
 *   node game-075/dev/browsertest.mjs            # ONLY=desktop|realms|phones|storage
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8075';
const OUT = path.join(HERE, 'shots');
const ONLY = process.env.ONLY ?? '';
fs.mkdirSync(OUT, { recursive: true });

const errors = [];
let browser = null;
let fails = 0, passes = 0;
const ok = (c, msg) => { if (c) { passes++; console.log('  ok  ', msg); } else { fails++; console.log('  FAIL', msg); } };
const run = (n) => !ONLY || ONLY.split(',').includes(n);

async function newPage(viewport, touch = false, opts = {}) {
    if (!browser) browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: touch ? 2 : 1, hasTouch: touch, isMobile: touch });
    await ctx.addInitScript((blocked) => {
        if (blocked) { Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } }); return; }
        try { localStorage.clear(); localStorage.setItem('chromechalice.v1', JSON.stringify({ settings: { sound: false, music: false, amb: false, quality: 'low' } })); } catch { /* ignore */ }
    }, !!opts.blockStorage);
    const page = await ctx.newPage();
    await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('requestfailed', (r) => { if (!r.url().includes('fonts.g')) errors.push(`requestfailed: ${r.url()}`); });
    await page.goto(`${BASE}/game-075/index.html?debug=1${opts.q || ''}`);
    await page.waitForFunction(() => window.__cc && __cc.mode === 'attract', null, { timeout: 60000 });
    // SwiftShader compiles shaders on the first frames: let it settle
    await page.waitForTimeout(1500);
    return { page, ctx };
}

const mode = (page) => page.evaluate(() => __cc.mode);
const waitMode = (page, m, timeout = 30000) => page.waitForFunction((m) => __cc.mode === m, m, { timeout }).then(() => true, () => false);
const until = (page, fn, arg, timeout = 8000) => page.waitForFunction(fn, arg, { timeout }).then(() => true, () => false);
const shot = (page, name) => page.screenshot({ path: path.join(OUT, `${name}.png`) });

function checkErrors(label) {
    ok(errors.length === 0, `${label}: no console errors, page errors or failed requests${errors.length ? ' — ' + errors.slice(0, 3).join(' | ') : ''}`);
    errors.length = 0;
}

// ===================================================================== desktop
if (run('desktop')) {
    console.log('\n== desktop 1280×800');
    const { page, ctx } = await newPage({ width: 1280, height: 800 });
    const link = await page.evaluate(() => {
        const a = document.getElementById('back-link'), r = a.getBoundingClientRect();
        const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return { href: a.getAttribute('href'), on: r.top >= 0 && r.left >= 0 && r.bottom <= innerHeight, top: top === a };
    });
    ok(link.href === '../index.html' && link.on && link.top, 'the ← Games link is on screen, on top, and points at the launcher');
    ok(await page.evaluate(() => document.body.dataset.layout) === 'cabinet', 'a desktop gets the cabinet');
    ok(await page.evaluate(() => __cc.crt()), 'the WebGL CRT is running');
    // attract pages
    for (const n of [1, 2, 3, 4]) { await page.evaluate((n) => __cc.page(n), n); await page.waitForTimeout(400); }
    ok(await page.evaluate(() => __cc.pageName) === 'scores', 'the attract pages cycle');
    await page.evaluate(() => __cc.page(5));
    await page.waitForTimeout(3000);
    const demo = await page.evaluate(() => ({ w: !!__cc.world, t: __cc.world && __cc.world.t, demo: __cc.G.demo }));
    ok(demo.w && demo.demo && demo.t > 0.5, `the demo plays itself (t=${(demo.t || 0).toFixed(1)}s)`);
    await shot(page, 'desk-demo');
    // coin and start
    await page.keyboard.press('Digit5');
    ok(await until(page, () => __cc.credits === 1), '5 inserts a coin');
    ok(await page.evaluate(() => document.body.classList.contains('has-credit')), 'and 1P START lights up');
    await page.keyboard.press('Enter');
    ok(await waitMode(page, 'select'), 'START opens GAME SELECT');
    ok(await page.evaluate(() => __cc.credits) === 0, 'and uses the credit');
    await page.keyboard.press('ArrowUp');
    ok(await until(page, () => __cc.G.sel === 4), 'a tapped arrow key moves the menu (START GAME)');
    await page.keyboard.press('Enter');
    ok(await waitMode(page, 'intro'), 'START GAME shows the realm intro');
    await shot(page, 'desk-intro');
    ok(await waitMode(page, 'play'), 'and play begins');
    // movement
    const p0 = await page.evaluate(() => ({ x: __cc.world.player.x, y: __cc.world.player.y }));
    await page.keyboard.down('ArrowRight'); await page.waitForTimeout(900); await page.keyboard.up('ArrowRight');
    const p1 = await page.evaluate(() => ({ x: __cc.world.player.x, y: __cc.world.player.y }));
    ok(p1.x > p0.x + 4, `the arrows move SQUIRE (${(p1.x - p0.x).toFixed(1)} px)`);
    // pick up the sword, slash, drop
    await page.evaluate(() => { const w = __cc.world, s = w.items.find((i) => i.kind === 'sword'); s.x = w.player.x + 6; s.y = w.player.y; });
    await page.waitForFunction(() => __cc.world.player.held && __cc.world.player.held.kind === 'sword', null, { timeout: 5000 }).catch(() => {});
    ok(await page.evaluate(() => __cc.world.player.held?.kind) === 'sword', 'touching the sword picks it up');
    await page.keyboard.press('KeyZ');
    ok(await until(page, () => __cc.G.seen.slash > 0), 'Z slashes');
    await page.keyboard.press('KeyX');
    ok(await until(page, () => !__cc.world.player.held), 'X drops it');
    await page.keyboard.press('KeyC');
    ok(await until(page, () => __cc.G.seen.dash > 0), 'C dashes');
    await shot(page, 'desk-play');
    // pause and options
    await page.keyboard.press('KeyP');
    ok(await waitMode(page, 'pause'), 'P pauses');
    const tp = await page.evaluate(() => __cc.world.t);
    await page.waitForTimeout(500);
    ok(await page.evaluate((t) => __cc.world.t === t, tp), 'the world stands still while paused');
    await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
    ok(await waitMode(page, 'options'), 'Options opens from the pause menu');
    for (let k = 0; k < 4; k++) { await page.keyboard.press('ArrowDown'); await page.waitForTimeout(60); }
    await page.keyboard.press('Enter');
    ok(await until(page, () => __cc.data.settings.crt === false && document.body.classList.contains('no-crt')), 'CRT can be switched off');
    await page.keyboard.press('Enter');
    ok(await until(page, () => __cc.data.settings.crt === true), 'and on again');
    await page.keyboard.press('Escape');
    ok(await waitMode(page, 'pause'), 'Escape goes back to the pause menu');
    await page.keyboard.press('KeyP');
    ok(await waitMode(page, 'play'), 'P resumes');
    // a cleared realm
    await page.evaluate(() => __cc.clearRealm());
    ok(await waitMode(page, 'clear', 20000), 'carrying the chalice home shows the tally');
    await page.waitForTimeout(800);
    await shot(page, 'desk-tally');
    await page.keyboard.press('Enter'); await page.waitForTimeout(300); await page.keyboard.press('Enter');
    ok(await waitMode(page, 'intro'), 'and START moves on to the next realm');
    ok(await page.evaluate(() => __cc.session.realm) === 1, 'realm 2');
    ok(await waitMode(page, 'play'), 'realm 2 starts');
    // continue → give up → game over → name entry
    await page.evaluate(() => __cc.kill());
    ok(await waitMode(page, 'continue', 30000), 'losing the last life asks CONTINUE?');
    await shot(page, 'desk-continue');
    await page.keyboard.press('KeyX');
    ok(await waitMode(page, 'gameover'), 'B gives up: GAME OVER');
    ok(await waitMode(page, 'entry', 30000), 'a high score asks for initials');
    await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
    await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowDown'); await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    ok(await waitMode(page, 'attract'), 'and returns to the attract mode');
    const table = await page.evaluate(() => __cc.data.hiscores.map((h) => h.name));
    ok(table.includes('BCA'), `the initials are in the table (${table.slice(0, 5).join(' ')})`);
    ok(await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('chromechalice.v1')).hiscores.some((h) => h.name === 'BCA'); } catch { return false; } }), 'and saved');
    checkErrors('desktop flow');
    await ctx.close();
}

// ===================================================================== every realm, the boss, the ending
if (run('realms')) {
    console.log('\n== every realm, the boss and the ending');
    const { page, ctx } = await newPage({ width: 1100, height: 760 }, false, { q: '&fast=8' });
    for (let i = 0; i < 6; i++) {
        await page.evaluate((i) => __cc.start(i), i);
        await page.waitForTimeout(1200);
        const st = await page.evaluate(() => ({ m: __cc.mode, r: __cc.world.realmIndex, t: __cc.world.t }));
        ok(st.m === 'play' && st.r === i && st.t > 0, `realm ${i + 1} boots and runs`);
        await shot(page, `realm-${i + 1}`);
    }
    // the bot plays the Citadel through
    await page.evaluate(() => { __cc.start(5); __cc.god(true); __cc.autoplay(true); });
    const boss = await page.waitForFunction(() => __cc.world && __cc.world.boss && __cc.world.boss.active, null, { timeout: 240000 }).then(() => true, () => false);
    ok(boss, 'the bot opens the Citadel and wakes CHROMAGON');
    await shot(page, 'boss');
    const dead = await page.waitForFunction(() => __cc.world && __cc.world.boss.dead, null, { timeout: 300000 }).then(() => true, () => false);
    ok(dead, 'CHROMAGON falls');
    const home = await page.waitForFunction(() => __cc.mode === 'clear', null, { timeout: 300000 }).then(() => true, () => false);
    ok(home, 'the Chrome Chalice is carried home');
    await page.evaluate(() => __cc.autoplay(false));
    await page.keyboard.press('Enter'); await page.waitForTimeout(300); await page.keyboard.press('Enter');
    ok(await waitMode(page, 'ending'), 'the ending plays');
    await page.waitForTimeout(2500);
    await shot(page, 'ending');
    await page.evaluate(() => { __cc.G.modeT = 11; });
    await page.keyboard.press('Enter');
    ok(await waitMode(page, 'intro'), 'and START begins loop 2');
    ok(await page.evaluate(() => __cc.session.loop === 2 && __cc.session.realm === 0), 'loop 2, realm 1');
    checkErrors('realms');
    await ctx.close();
}

// ===================================================================== phones
async function touchTap(page, cdp, x, y) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
    await page.waitForTimeout(80);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(120);
}
async function center(page, sel) {
    return page.evaluate((sel) => { const r = document.querySelector(sel).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }; }, sel);
}

if (run('phones')) {
    for (const [w, h, want] of [[390, 844, 'portrait'], [844, 390, 'landscape']]) {
        console.log(`\n== touch-only phone ${w}×${h}`);
        const { page, ctx } = await newPage({ width: w, height: h }, true);
        const cdp = await ctx.newCDPSession(page);
        ok(await page.evaluate(() => document.body.dataset.layout) === want, `the ${want} layout`);
        const geo = await page.evaluate(() => {
            const r = (s) => document.querySelector(s).getBoundingClientRect();
            const tube = r('#tube');
            const ctrls = ['#stick', '#b-a', '#b-b', '#b-c', '#b-start', '#b-pause'].map((s) => ({ s, r: r(s) }));
            const over = (a, b) => a.left < b.right && a.right > b.left && a.top < b.bottom && a.bottom > b.top;
            return {
                scroll: document.documentElement.scrollWidth <= innerWidth + 1,
                tubeOn: tube.left >= -1 && tube.top >= -1 && tube.right <= innerWidth + 1 && tube.bottom <= innerHeight + 1,
                small: ctrls.filter((c) => c.r.width < 44 || c.r.height < 44).map((c) => c.s),
                overlap: ctrls.filter((c) => over(c.r, tube)).map((c) => c.s),
                offscreen: ctrls.filter((c) => c.r.left < 0 || c.r.top < 0 || c.r.right > innerWidth || c.r.bottom > innerHeight).map((c) => c.s),
                link: (() => { const a = document.getElementById('back-link'), b = a.getBoundingClientRect(); return document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2) === a; })(),
            };
        });
        ok(geo.scroll, 'nothing scrolls sideways');
        ok(geo.tubeOn, 'the monitor is fully on screen');
        ok(geo.small.length === 0, `every control is at least 44 px${geo.small.length ? ' — ' + geo.small.join(' ') : ''}`);
        ok(geo.overlap.length === 0, `no control covers the monitor${geo.overlap.length ? ' — ' + geo.overlap.join(' ') : ''}`);
        ok(geo.offscreen.length === 0, `every control is on screen${geo.offscreen.length ? ' — ' + geo.offscreen.join(' ') : ''}`);
        ok(geo.link, 'the ← Games link is on top');
        await shot(page, `phone-${want}-title`);
        // tap 1P START → GAME SELECT
        let c = await center(page, '#b-start');
        await touchTap(page, cdp, c.x, c.y);
        ok(await waitMode(page, 'select', 8000), 'tapping 1P START opens GAME SELECT (free play)');
        // tap the START GAME row on the monitor
        const tube = await center(page, '#tube');
        const rowY = tube.y - tube.h / 2 + tube.h * ((66 + 4 * 18 + 3) / 240);
        await touchTap(page, cdp, tube.x, rowY);
        ok(await waitMode(page, 'intro', 8000), 'tapping START GAME on the screen starts');
        await touchTap(page, cdp, tube.x, tube.y);
        ok(await waitMode(page, 'play', 15000), 'tapping skips the intro');
        await shot(page, `phone-${want}-play`);
        // the joystick
        const p0 = await page.evaluate(() => __cc.world.player.x);
        c = await center(page, '#stick');
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: c.x, y: c.y, id: 2 }] });
        for (let k = 1; k <= 6; k++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: c.x + k * c.w * 0.07, y: c.y, id: 2 }] }); await page.waitForTimeout(40); }
        await page.waitForTimeout(900);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        const p1 = await page.evaluate(() => __cc.world.player.x);
        ok(p1 > p0 + 3, `dragging the joystick moves SQUIRE (${(p1 - p0).toFixed(1)} px)`);
        ok(await page.evaluate(() => getComputedStyle(document.querySelector('.st-top')).transform !== 'none'), 'and the stick tilts');
        c = await center(page, '#b-c');
        await touchTap(page, cdp, c.x, c.y);
        ok(await until(page, () => __cc.G.seen.dash > 0), 'C dashes');
        c = await center(page, '#b-pause');
        await touchTap(page, cdp, c.x, c.y);
        ok(await waitMode(page, 'pause', 5000), '❚❚ pauses');
        checkErrors(`phone ${w}×${h}`);
        await ctx.close();
    }
}

// ===================================================================== blocked storage
if (run('storage')) {
    console.log('\n== localStorage blocked');
    const { page, ctx } = await newPage({ width: 1280, height: 800 }, false, { blockStorage: true });
    ok(await mode(page) === 'attract', 'boots to the attract mode');
    await page.keyboard.press('Enter');
    ok(await waitMode(page, 'select'), 'START works');
    await page.keyboard.press('ArrowUp'); await page.keyboard.press('Enter');
    ok(await waitMode(page, 'play', 20000), 'and the game plays');
    checkErrors('blocked storage');
    await ctx.close();
}

if (browser) await browser.close();
console.log(`\n${passes} passed, ${fails} failed`);
process.exit(fails ? 1 : 0);

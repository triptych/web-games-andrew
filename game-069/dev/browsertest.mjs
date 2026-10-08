/**
 * browsertest.mjs — real Chromium, real WebGL (SwiftShader), real three.js r165, real input.
 *
 * Desktop (1280×760, keyboard and mouse): the title (back link, logo, attract-mode race) → New Career
 * → name → the prologue (portrait drawn, typing, Enter advances, Skip) → the hub (coins, rating,
 * county map, first race open and the second locked) → buy an engine (coins drop, rating rises, the
 * car gains an exhaust) → try and buy a paint job → the event card → the pre-race scene → countdown
 * with a held throttle → keyboard driving → a finish → results with a purse → Continue → the next
 * race unlocked → a time trial: pause, resume, quit → reload and Continue keeps the career →
 * settings → jump to the final, win it, the ending scene, the credits and the Crown on the shelf.
 * Phones (390×844 and 844×390, touch only, CDP touches): every screen fits with no sideways scroll,
 * the canvas matches the visible viewport, buttons are finger-sized, taps drive the menus and the
 * story, the touch steering turns the car and auto-accelerate drives it.
 * Fails on any console error, page error or failed request. Screenshots go to dev/shots/.
 *
 *   python3 -m http.server 8069          # from the REPO ROOT
 *   node game-069/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8069), ONLY=desktop|phones, THREE_PKG.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8069';
const OUT = path.join(HERE, 'shots');
const ONLY = process.env.ONLY ?? '';
fs.mkdirSync(OUT, { recursive: true });

let errors = [];
let fails = 0;
let browser = null;
const ok = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => { fails++; console.log(`  ✗ ${m}`); };
const check = (cond, m) => (cond ? ok(m) : fail(m));

async function newPage(viewport, touch = false, query = '') {
    if (browser) await browser.close();
    browser = await chromium.launch({
        executablePath: process.env.PW_CHROMIUM_PATH || undefined,
        args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
    });
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: touch ? 2 : 1, hasTouch: touch, isMobile: touch });
    await ctx.addInitScript(() => {
        try {
            if (!sessionStorage.getItem('bt-init')) {
                sessionStorage.setItem('bt-init', '1');
                localStorage.clear();
                localStorage.setItem('dirt-crown.v1.settings', JSON.stringify({ master: 0, music: 0, sfx: 0, muted: true, quality: 2 }));
            }
        } catch { /* storage blocked */ }
    });
    const page = await ctx.newPage();
    if (PKG && fs.existsSync(PKG)) {
        await page.route('https://unpkg.com/**', (route) => {
            const rel = new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, '');
            const file = path.join(PKG, rel);
            if (!fs.existsSync(file)) return route.abort();
            route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
        });
    }
    await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message} @ ${(e.stack || '').split('\n').slice(1, 3).join(' ').trim()}`));
    page.on('requestfailed', (r) => { if (!r.url().includes('favicon')) errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`); });
    await page.goto(`${BASE}/game-069/index.html?debug=1&fast=8${query}`);
    await page.waitForFunction('window.__dc && window.__dcApp.mode === "title"', null, { timeout: 120000 });
    return { page, ctx };
}

const S = (page, js) => page.evaluate(`(() => { const S = window.__dc, A = S.app; ${js} })()`);
const until = (page, js, timeout = 90000) => page.waitForFunction(`(() => { const S = window.__dc, A = S && S.app; return ${js}; })()`, null, { timeout, polling: 150 });
const shot = (page, name) => page.screenshot({ path: path.join(OUT, `${name}.png`) });
const visible = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.display !== 'none' && cs.visibility !== 'hidden'; }, sel);
const text = (page, sel) => page.evaluate((s) => document.querySelector(s)?.textContent || '', sel);
const flushErrors = (label) => { check(errors.length === 0, `${label}: no console/page errors${errors.length ? '\n      ' + errors.slice(0, 6).join('\n      ') : ''}`); errors = []; };

async function skipStory(page) {
    await until(page, 'S.UI.storyActive()');
    await S(page, 'S.skipStory()');
    await until(page, '!S.UI.storyActive()');
}

// ================================================================== desktop
async function desktop() {
    console.log('\ndesktop 1280×760');
    const { page } = await newPage({ width: 1280, height: 760 });
    // Title.
    check(await visible(page, '#title'), 'the title screen shows');
    check(await visible(page, '#back-link'), 'the ← Games link is visible');
    const bl = await page.evaluate(() => { const r = document.getElementById('back-link').getBoundingClientRect(); const e = document.elementFromPoint(r.left + 5, r.top + 5); return e && e.id === 'back-link' && document.getElementById('back-link').getAttribute('href') === '../index.html'; });
    check(bl, 'the back link is on top and points at ../index.html');
    check(await S(page, 'return A.race && A.race.type === "attract" && A.race.cars.length === 6'), 'an attract-mode race runs behind the title');
    await until(page, 'A.race.cars.some((c) => c.speed > 5)', 60000);
    ok('the attract cars are driving');
    await shot(page, 'bt-title');

    // New career.
    await page.click('#t-new');
    await until(page, '!!document.querySelector("#m-name")');
    await page.fill('#m-name', 'Ace');
    await page.click('#m-go');
    await until(page, 'S.UI.storyActive()');
    await page.waitForTimeout(600);
    const portraitDrawn = await page.evaluate(() => { const c = document.getElementById('dlg-portrait'); const d = c.getContext('2d').getImageData(128, 128, 1, 1).data; return d[3] > 0; });
    check(portraitDrawn, 'the prologue shows a painted portrait');
    check((await text(page, '#dlg-who')).includes('Gus'), 'Grandpa Gus speaks first');
    await shot(page, 'bt-prologue');
    const t0 = await text(page, '#dlg-text');
    await page.keyboard.press('Enter');
    await page.keyboard.press('Enter');
    await page.waitForTimeout(300);
    const t1 = await text(page, '#dlg-text');
    check(t1 !== t0, 'Enter advances the dialogue');
    await page.click('#dlg-skip');
    await until(page, '!S.UI.storyActive() && !document.getElementById("hub").classList.contains("hidden")');
    check(await S(page, 'return A.profile.seen.prologue === true'), 'the prologue is marked seen');
    check((await text(page, '#hub-coins')) === '150' && (await text(page, '#hub-rating')) === '100', 'the hub shows 150 coins and rating 100');
    check(await visible(page, '#map-cv'), 'the county map is drawn');
    check(await page.evaluate(() => !document.querySelector('[data-ev="flats-1"]').classList.contains('locked') && document.querySelector('[data-ev="flats-2"]').classList.contains('locked')), 'the first race is open and the second locked');
    await shot(page, 'bt-hub');

    // Garage: buy an engine.
    await page.click('[data-tab=garage]');
    await page.click('.buy[data-cat=engine]');
    await page.waitForTimeout(300);
    check(await S(page, 'return A.profile.levels.engine === 1 && A.profile.coins === 30'), 'buying an engine costs 120 coins and adds a level');
    check((await text(page, '#hub-rating')) === '130', 'the rating rises to 130');
    check(await S(page, 'return S.app.profile && document.querySelectorAll(".upg .pips i.on").length === 1'), 'the engine card shows one level');
    await page.click('.buy[data-cat=drive]');
    check(await S(page, 'return A.profile.levels.drive === 0'), 'an upgrade you can\'t afford is refused');
    await shot(page, 'bt-garage');

    // Paint: preview then buy.
    await S(page, 'S.coins(500)');
    await page.click('[data-tab=paint]');
    await page.click('[data-paint=red]');
    await until(page, '!!document.querySelector("#pp-buy")');
    await page.click('#pp-buy');
    await page.waitForTimeout(200);
    check(await S(page, 'return A.profile.paint === "red" && A.profile.coins === 530 - 80'), 'a paint job is bought and applied');
    await page.click('[data-tab=races]');

    // First race through the real UI.
    await page.click('#hub-go');
    await until(page, '!!document.querySelector("#m-race")');
    check(await visible(page, '.track-cv'), 'the event card shows the track');
    await shot(page, 'bt-card');
    await page.click('#m-race');
    await until(page, 'A.mode === "race" && S.UI.storyActive()');
    check((await text(page, '#dlg-who')).includes('Colt'), 'Colt shows up before the first race');
    await skipStory(page);
    check(await S(page, 'return A.race.phase === "countdown"'), 'the countdown starts after the scene');
    await page.keyboard.down('KeyW');
    await until(page, 'A.race.phase === "race" && A.race.t > 1.5');
    check(await S(page, 'return A.race.player.speed > 3'), `holding W drives the car (${await S(page, 'return A.race.player.speed.toFixed(1)')} m/s)`);
    await page.keyboard.down('KeyD');
    await until(page, 'A.race.player.steerVis > 0.2', 20000).then(() => ok('D steers right'), () => fail('D steers right'));
    await page.keyboard.up('KeyD');
    await shot(page, 'bt-race');
    check(await visible(page, '#h-speedo') && await visible(page, '#h-map'), 'the HUD shows the speedometer and the minimap');
    await page.keyboard.up('KeyW');
    await S(page, 'S.autopilot()');
    // On the oval's banked turns every wheel sits on the road (the car rolls with the banking).
    await until(page, 'A.race.t > 8 && Math.abs(A.track.bankTan[A.race.player.loc.i]) > 0.2', 120000);
    const gaps = await S(page, `const tr = A.track, L = { i: 0, f: 0, d: 0 }, out = [];
        A.models.forEach((m, k) => { const c = A.race.cars[k]; if (c.air) return; m.root.updateMatrixWorld(true);
            for (const w of m.wheels) { const p = w.hub.getWorldPosition(w.hub.position.clone()); tr.locate(p.x, p.z, c.loc.i, L); out.push(p.y - w.baseY - tr.heightAt(L.i, L.f, L.d)); } });
        return out;`);
    const worst = Math.max(...gaps.map(Math.abs));
    check(gaps.length >= 8 && worst < 0.12, `on a banked turn every wheel touches the road (worst ${worst.toFixed(2)} m over ${gaps.length} wheels)`);
    await S(page, 'S.win(1)');
    await until(page, 'A.mode === "results"', 60000);
    await page.waitForTimeout(1500);
    check(await visible(page, '#results-panel'), 'the results show');
    check((await text(page, '#results-panel')).includes('Victory'), 'first place reads as a victory');
    check(await S(page, 'return A.profile.results["flats-1"].pos === 1 && A.profile.coins > 450'), 'the win is recorded and paid');
    await shot(page, 'bt-results');
    await page.click('#r-cont');
    await until(page, 'A.mode === "hub" && !document.getElementById("hub").classList.contains("hidden")');
    check(await page.evaluate(() => !document.querySelector('[data-ev="flats-2"]').classList.contains('locked')), 'the time trial is now open');

    // Time trial: pause, resume, quit.
    await S(page, 'S.go("flats-2")');
    await until(page, 'A.mode === "race" && A.race && A.race.type === "tt" && !document.getElementById("fade").classList.contains("on")');
    check(await S(page, 'return A.ev.targets && A.ev.targets.length === 3 && A.ev.targets[0] < A.ev.targets[2]'), 'the time trial has gold, silver and bronze times');
    await page.waitForTimeout(800);
    await page.keyboard.press('Escape');
    await until(page, 'A.paused && !!document.querySelector("#p-res")');
    const tP = await S(page, 'return A.race.cd + A.race.t');
    await page.waitForTimeout(700);
    check(Math.abs((await S(page, 'return A.race.cd + A.race.t')) - tP) < 1e-6, 'pause stops the race clock');
    await page.click('#p-res');
    check(await S(page, 'return !A.paused'), 'Resume carries on');
    await page.keyboard.press('Escape');
    await until(page, '!!document.querySelector("#p-quit")');
    await page.click('#p-quit');
    await until(page, 'A.mode === "hub"');
    ok('Quit goes back to the garage');

    // Reload: Continue keeps the career.
    await page.reload();
    await page.waitForFunction('window.__dc && window.__dcApp.mode === "title"', null, { timeout: 120000 });
    check(await visible(page, '#t-continue'), 'after a reload the title offers Continue');
    await page.click('#t-continue');
    await until(page, 'A.mode === "hub"');
    check(await S(page, 'return A.profile.name === "Ace" && A.profile.levels.engine === 1 && A.profile.paint === "red" && A.profile.results["flats-1"]'), 'the career, upgrades and paint survived the reload');

    // Settings.
    await page.click('#hub-menu');
    await page.click('#m-set');
    await until(page, '!!document.querySelector(".seg[data-key=camera]")');
    await page.click('.seg[data-key=camera] button[data-v="1"]');
    check(await S(page, 'return A.settings.camera === 1'), 'settings change the camera');
    await page.click('#m-ok');

    // The final: unlock everything before it, win it, watch the ending.
    await S(page, `for (const c of S.CIRCUITS) for (const e of c.events) if (e.id !== 'crown-2') A.profile.results[e.id] = { pos: 1, time: 60, medal: 'gold', wins: 1, runs: 1 }; for (const id of Object.keys(S.app.profile.seen)) {} S.levels({ engine: 5, drive: 5, tires: 5, susp: 5, body: 5, nitro: 5 })`);
    await S(page, 'S.go("crown-2")');
    await until(page, 'A.mode === "race" && S.UI.storyActive()');
    check((await text(page, '#story-title')).includes('Dirt Crown'), 'the final opens with its scene');
    await skipStory(page);
    await until(page, 'A.race.phase === "race" && A.race.t > 2');
    check(await S(page, 'return A.race.cars.length === 2 && A.race.cars[1].name === "Colt Ravenwood"'), 'the final is a duel with Colt');
    await shot(page, 'bt-final');
    await S(page, 'S.win(1)');
    await until(page, 'A.mode === "results"', 60000);
    check((await text(page, '#results-panel')).includes('CHAMPION'), 'winning the final crowns you champion');
    await page.click('#r-cont');
    await until(page, 'S.UI.storyActive()');
    check((await text(page, '#story-title')).includes('Crown Comes Home'), 'the ending plays');
    await shot(page, 'bt-ending');
    await skipStory(page);
    await until(page, 'A.mode === "hub" && !!document.querySelector(".credits")');
    check(await S(page, 'return A.profile.done === true'), 'the career is complete');
    check(await visible(page, '.credits'), 'the credits roll');
    check(await S(page, 'return S.app && document.querySelector("#hub-panel h2").textContent.includes("career")'), 'the hub opens on the career page');
    await shot(page, 'bt-credits');
    flushErrors('desktop');
}

// ================================================================== phones
async function phone(w, h) {
    console.log(`\nphone ${w}×${h} (touch)`);
    const { page } = await newPage({ width: w, height: h }, true);
    const fits = async (label) => {
        const r = await page.evaluate(() => ({ sw: document.documentElement.scrollWidth, iw: innerWidth, cw: document.getElementById('gl').clientWidth, ch: document.getElementById('gl').clientHeight, ih: innerHeight }));
        check(r.sw <= r.iw, `${label}: no sideways scroll (${r.sw} ≤ ${r.iw})`);
        check(Math.abs(r.cw - r.iw) <= 1 && Math.abs(r.ch - r.ih) <= 1, `${label}: the canvas matches the viewport (${r.cw}×${r.ch})`);
    };
    const bigEnough = async (sel, label) => {
        const small = await page.evaluate((s) => [...document.querySelectorAll(s)].filter((e) => { const r = e.getBoundingClientRect(); return r.width > 0 && (r.width < 40 || r.height < 36); }).map((e) => e.textContent.trim().slice(0, 12) + ` ${Math.round(e.getBoundingClientRect().width)}×${Math.round(e.getBoundingClientRect().height)}`), sel);
        check(!small.length, `${label}: buttons are finger-sized${small.length ? ' — ' + small.join(', ') : ''}`);
    };
    await fits('title');
    await bigEnough('#title .btn', 'title');
    await page.tap('#t-new');
    await until(page, '!!document.querySelector("#m-go")');
    await page.tap('#m-go');
    await until(page, 'S.UI.storyActive()');
    const t0 = await text(page, '#dlg-text');
    await page.tap('#dlg-text');
    await page.tap('#dlg-text');
    await page.waitForTimeout(300);
    check((await text(page, '#dlg-text')) !== t0, 'a tap advances the story');
    await fits('story');
    await shot(page, `bt-phone-${w}-story`);
    await page.tap('#dlg-skip');
    await until(page, 'A.mode === "hub" && !S.UI.storyActive()');
    await fits('hub');
    await bigEnough('#hub-tabs .tab, #hub-menu, #hub-go', 'hub');
    await page.tap('[data-tab=garage]');
    await page.waitForTimeout(300);
    await page.tap('.buy[data-cat=engine]');
    check(await S(page, 'return A.profile.levels.engine === 1'), 'a tap buys an upgrade');
    await shot(page, `bt-phone-${w}-garage`);
    await page.tap('#hub-go');
    await until(page, '!!document.querySelector("#m-race")');
    await fits('event card');
    await page.tap('#m-race');
    await until(page, 'A.mode === "race" && S.UI.storyActive()');
    await S(page, 'S.skipStory()');
    await until(page, 'A.race.phase === "race" && A.race.t > 1');
    check(await visible(page, '#touch .tl') && await visible(page, '[data-ctl=brake]'), 'touch driving buttons show');
    await bigEnough('.tbtn, #h-pause', 'race');
    await until(page, 'A.race.player.speed > 4', 30000);
    ok('auto-accelerate drives the car');
    // Hold the right steering button with a real touch.
    const box = await page.evaluate(() => { const r = document.querySelector('[data-ctl=right]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    const cdp = await page.context().newCDPSession(page);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: box.x, y: box.y, id: 1 }] });
    await until(page, 'A.race.player.steerVis > 0.2', 20000).then(() => ok('holding ▶ steers right'), () => fail('holding ▶ steers right'));
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await fits('race');
    await shot(page, `bt-phone-${w}-race`);
    await page.tap('#h-pause');
    await until(page, '!!document.querySelector("#p-res")');
    await fits('pause');
    await page.tap('#p-quit');
    await until(page, 'A.mode === "hub"');
    flushErrors(`phone ${w}×${h}`);
}

try {
    if (!ONLY || ONLY === 'desktop') await desktop();
    if (!ONLY || ONLY === 'phones') { await phone(390, 844); await phone(844, 390); }
} catch (e) {
    fail(`threw: ${e.message.split('\n')[0]}`);
    if (errors.length) console.log('    ' + errors.join('\n    '));
} finally {
    if (browser) await browser.close();
}
console.log(fails ? `\n${fails} check(s) failed` : '\nall browser checks passed');
process.exit(fails ? 1 : 0);

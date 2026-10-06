/**
 * browsertest.mjs — real Chromium, real WebGL (SwiftShader), real three.js r165.
 *
 * Desktop (1280×760): boot → title (back link visible) → New Quest → hero creator (type a name, pick a
 * look) → prologue (advance with Space, then Skip) → world map → Enter on 1-1 → realm intro → hole
 * fly-over skipped with Space → aim with the arrow keys, change club, a real three-press swing on
 * the keyboard → the shot flies and settles → Mulligan rewinds it → pause, settings, resume → hole out
 * (debug) → results with stars → Continue → map → walk to the Clubhouse, buy an item, tabs → reload
 * → Continue from the title → a boss hole shows its boss bar and seal → ESC pause → quit to map.
 * Touch-only phones at 390×844 and 844×390: CDP touches through the title, creator, story and map
 * into a hole; every control ≥ 44 px and not overlapping the HUD readouts; a drag aims; three taps on
 * SWING take a shot; nothing scrolls sideways; the canvas isn't clipped.
 * Fails on any console error, page error or failed request. Screenshots go to dev/shots/.
 *
 *   python3 -m http.server 8063                 # from the REPO ROOT
 *   node game-063/dev/browsertest.mjs
 *
 * No network to unpkg.com? Unpack three@0.165.0 into dev/package (repo root) or point THREE_PKG at it.
 * Env: BASE (default http://127.0.0.1:8063), ONLY=desktop|phones.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = (process.env.BASE ?? 'http://127.0.0.1:8063') + '/game-063/';
const OUT = path.join(HERE, 'shots');
const ONLY = process.env.ONLY ?? '';
fs.mkdirSync(OUT, { recursive: true });

let errors = [];
let fails = 0;
let browser = null;
const ok = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => { fails++; console.log(`  ✗ ${m}`); };
const check = (c, m) => (c ? ok(m) : fail(m));

async function newPage(viewport, touch = false) {
    if (browser) await browser.close();
    browser = await chromium.launch({ args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'] });
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: touch ? 2 : 1, hasTouch: touch, isMobile: touch });
    await ctx.addInitScript(() => {
        try {
            if (!sessionStorage.getItem('ts-init')) {
                sessionStorage.setItem('ts-init', '1');
                localStorage.clear();
                localStorage.setItem('teeandsorcery.v1', JSON.stringify({ profile: null, settings: { music: 0, sfx: 0, quality: 0, gentle: false, shake: true, tips: true } }));
            }
        } catch { /* storage blocked */ }
    });
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
    return { page, ctx };
}

const S = (page, js) => page.evaluate(`(() => { const S = window.__ts; ${js} })()`);
const waitFor = (page, js, timeout = 60000) => page.waitForFunction(`(() => { const S = window.__ts; return ${js}; })()`, null, { timeout, polling: 100 });
const shot = (page, name) => page.screenshot({ path: path.join(OUT, `${name}.png`) });
const visible = (page, sel) => page.evaluate((s) => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(); const cs = getComputedStyle(e); return r.width > 0 && r.height > 0 && cs.visibility !== 'hidden' && cs.display !== 'none' && !e.closest('.hidden'); }, sel);
const reportErrors = (label) => { check(errors.length === 0, `${label}: no console errors, page errors or failed requests${errors.length ? '\n      ' + errors.slice(0, 6).join('\n      ') : ''}`); errors = []; };

// The back link must be on screen and the topmost element at its centre.
async function backLinkOk(page) {
    return page.evaluate(() => {
        const a = document.getElementById('back-link');
        if (!a || getComputedStyle(a).display === 'none') return false;
        const r = a.getBoundingClientRect();
        if (r.left < 0 || r.top < 0 || r.right > innerWidth || r.bottom > innerHeight) return false;
        const el = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return el === a || a.contains(el);
    });
}

// Hold the swing key through the meter: press, wait for the power, press, wait for the sweet spot, press.
async function keyboardSwing(page, power = 0.6) {
    await page.keyboard.press('Space');
    await waitFor(page, `S.app.swing.state === 'power' && S.app.swing.m >= ${power}`, 30000);
    await page.keyboard.press('Space');
    await waitFor(page, `S.app.swing.state !== 'acc' || S.app.swing.m <= 0.02`, 30000);
    await page.keyboard.press('Space');
}

// ======================================================================================== desktop
async function desktop() {
    console.log('\n== desktop 1280×760');
    const { page } = await newPage({ width: 1280, height: 760 });
    await page.goto(BASE + 'index.html?debug=1&fast=6');
    await waitFor(page, `S && S.mode === 'title'`);
    await page.waitForTimeout(800);
    check(await visible(page, '#title .logo'), 'title logo shows');
    check(await backLinkOk(page), 'back link visible and clickable on the title');
    check(await page.evaluate(() => document.querySelector('#title-menu .btn')?.textContent.includes('Begin')), 'a fresh save offers "Begin the Quest"');
    await shot(page, 'd01-title');
    // creator
    await page.click('[data-act="title-new"]');
    await waitFor(page, `S.mode === 'creator'`);
    await page.fill('#hero-name', 'Tess');
    await page.click('[data-act="pick-look"][data-i="2"]');
    await page.click('[data-act="pick-outfit"][data-i="4"]');
    await page.waitForTimeout(500);
    await shot(page, 'd02-creator');
    await page.click('[data-act="creator-go"]');
    // prologue
    await waitFor(page, `S.mode === 'story' && S.app.dlg.active`, 30000);
    check(await visible(page, '#dlg-portrait'), 'story dialogue shows a portrait');
    const name0 = await page.textContent('#dlg-name');
    await page.keyboard.press('Space'); await page.keyboard.press('Space');
    await page.waitForTimeout(300);
    const name1 = await page.textContent('#dlg-name');
    check(name0 !== name1 || (await page.textContent('#dlg-text')).length > 0, `Space advances the dialogue (${name0} → ${name1})`);
    await shot(page, 'd03-prologue');
    await page.click('[data-act="dlg-skip"]');
    await waitFor(page, `S.mode === 'map'`, 30000);
    check(await S(page, `return S.profile.name === 'Tess' && S.profile.look === 2 && S.profile.flags.prologue`), 'profile saved the name, look and prologue flag');
    check((await page.textContent('#map-hero')).includes('Tess'), 'map shows the hero badge');
    await waitFor(page, `!S.app.map.walk`, 30000);
    check(await S(page, `return S.app.map.cur === 1`), 'Tess walked to the first hole');
    await shot(page, 'd04-map');
    // into the first hole (realm intro first)
    await page.keyboard.press('Enter');
    await waitFor(page, `S.mode === 'story'`, 30000);
    await page.click('[data-act="dlg-skip"]');
    await waitFor(page, `S.mode === 'hole' && S.world && S.app.intro`, 60000);
    check(await visible(page, '#hole-card'), 'hole card shows during the fly-over');
    await shot(page, 'd05-intro');
    await page.keyboard.press('Space');
    await waitFor(page, `!S.app.intro`, 20000);
    check(await visible(page, '#hud'), 'HUD is up');
    check(await visible(page, '#minimap'), 'minimap shows');
    // aim and club
    const yaw0 = await S(page, `return S.world.s.aimYaw`);
    await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(500); await page.keyboard.up('ArrowLeft');
    const yaw1 = await S(page, `return S.world.s.aimYaw`);
    check(yaw1 > yaw0 + 0.01, `← aims left (${yaw0.toFixed(3)} → ${yaw1.toFixed(3)})`);
    await page.keyboard.down('ArrowRight'); await page.waitForTimeout(500); await page.keyboard.up('ArrowRight');
    const club0 = await S(page, `return S.world.s.club`);
    await page.keyboard.press('ArrowDown');
    const club1 = await S(page, `return S.world.s.club`);
    check(club0 !== club1, `↓ changes club (${club0} → ${club1})`);
    await page.keyboard.press('ArrowUp');
    await S(page, `S.world.setAim(S.world.defaultAim()); S.world.setClub('iron')`);
    await shot(page, 'd06-aim');
    // a real keyboard swing
    await keyboardSwing(page, 0.7);
    await waitFor(page, `S.world.s.strokes === 1`, 20000);
    ok('three presses of Space take a shot');
    await page.waitForTimeout(400);
    await shot(page, 'd07-flight');
    await waitFor(page, `['aim', 'done', 'failed'].includes(S.world.s.phase)`, 120000);
    const after = await S(page, `const B = S.world.s.ball; return { z: B.z, phase: S.world.s.phase, strokes: S.world.s.strokes }`);
    check(after.z > 40, `the shot travelled down the hole (z ${after.z.toFixed(1)}, ${after.phase})`);
    await shot(page, 'd08-rest');
    // mulligan rewinds it
    if (after.phase === 'aim') {
        await page.keyboard.press('Digit1');
        await page.waitForTimeout(400);
        const m = await S(page, `const B = S.world.s.ball; return { z: B.z, strokes: S.world.s.strokes, mp: S.world.s.mp }`);
        check(m.strokes === 0 && m.z < 2, `Mulligan rewinds the shot (strokes ${m.strokes}, z ${m.z.toFixed(1)}, MP ${m.mp})`);
    }
    // pause and settings
    await page.keyboard.press('Escape');
    await waitFor(page, `S.app.overlay === 'pause'`);
    await page.click('[data-act="open-settings"]');
    await waitFor(page, `S.app.overlay === 'settings'`);
    const g0 = await S(page, `return S.app.settings.gentle`);
    await page.click('[data-act="set-gentle"]');
    check(await S(page, `return S.app.settings.gentle !== ${g0}`), 'settings toggle gentle swing');
    await page.click('[data-act="set-gentle"]');
    await shot(page, 'd09-settings');
    await page.click('[data-act="close-settings"]');
    await page.click('[data-act="resume"]');
    await waitFor(page, `S.app.overlay === null`);
    ok('pause → settings → resume');
    // hole out
    await S(page, `S.win()`);
    await waitFor(page, `S.app.overlay === 'result'`, 60000);
    await page.waitForTimeout(1600);
    check(await visible(page, '#result-panel .score-name'), 'results show a score name');
    check((await page.$$eval('#res-stars .stars', (e) => e.length)) > 0, 'results show stars');
    await shot(page, 'd10-result');
    const saved = await page.evaluate(() => { try { return JSON.parse(localStorage.getItem('teeandsorcery.v1')).profile.holes['1-1']; } catch { return null; } });
    check(!!saved, 'the result is saved to localStorage');
    await page.click('[data-act="res-continue"]');
    await waitFor(page, `S.mode === 'map'`, 30000);
    await waitFor(page, `!S.app.map.walk`, 60000);
    check(await S(page, `return S.app.map.cur === 2`), 'continuing walks on to hole 1-2');
    // clubhouse
    await page.keyboard.press('ArrowLeft');
    await waitFor(page, `!S.app.map.walk && S.app.map.cur === 1`, 60000);
    await page.keyboard.press('ArrowLeft');
    await waitFor(page, `!S.app.map.walk && S.app.map.cur === 0`, 60000);
    await page.keyboard.press('Enter');
    await waitFor(page, `S.mode === 'club'`, 30000);
    await page.waitForTimeout(500);
    const tab = await S(page, `return S.app.menus.tab`);
    if (tab !== 'shop') await page.click('[data-tab="shop"]');
    const gold0 = await S(page, `return S.profile.gold`);
    await page.click('[data-act="buy"][data-cat="items"][data-id="sticky"]');
    check(await S(page, `return S.profile.gold === ${gold0} - 30 && S.profile.items.sticky >= 1`), 'bought a Sticky Ball in the Pro Shop');
    await shot(page, 'd11-shop');
    for (const t of ['gear', 'stats', 'spells', 'records']) { await page.click(`[data-tab="${t}"]`); await page.waitForTimeout(150); }
    await shot(page, 'd12-records');
    await page.click('[data-act="club-close"]');
    await waitFor(page, `S.mode === 'map'`, 30000);
    // reload and continue
    await page.reload();
    await waitFor(page, `S && S.mode === 'title'`, 60000);
    check(await page.evaluate(() => document.querySelector('#title-menu .btn')?.textContent.includes('Continue')), 'after a reload the title offers Continue');
    await page.click('[data-act="title-continue"]');
    await waitFor(page, `S.mode === 'map'`, 30000);
    check(await S(page, `return S.profile.items.sticky >= 1 && !!S.profile.holes['1-1']`), 'Continue restores the saved quest');
    // a boss hole
    await S(page, `S.go('1-4')`);
    await waitFor(page, `S.mode === 'hole' && S.world && S.world.hole.id === '1-4'`, 60000);
    await S(page, `S.skipIntro()`);
    check(await visible(page, '#hud-boss'), 'boss bar shows on a boss hole');
    check(await S(page, `return S.world.s.sealed && S.world.s.boss.hp === S.world.s.boss.max`), 'the cup starts sealed');
    // bonk the gopher king through the real hit path
    await S(page, `const w = S.world; for (const C of w.bossCols) if (!C.off && C.tag === 'boss') w.onHit(C, 20, w.s.ball);`);
    await page.waitForTimeout(600);
    check(await S(page, `return S.world.s.boss.hp < S.world.s.boss.max`), 'hitting the boss lowers its HP');
    await shot(page, 'd13-boss');
    await page.keyboard.press('Escape');
    await waitFor(page, `S.app.overlay === 'pause'`);
    await page.click('[data-act="quit-map"]');
    await waitFor(page, `S.mode === 'map'`, 30000);
    ok('quit to the map from a hole');
    reportErrors('desktop');
}

// ======================================================================================== phones
async function tap(cdp, x, y) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
async function tapSel(page, cdp, sel) {
    const r = await page.evaluate((s) => { const e = document.querySelector(s); if (!e) return null; const b = e.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, sel);
    if (!r) throw new Error('no element ' + sel);
    await tap(cdp, r.x, r.y);
    await page.waitForTimeout(250);
}

async function phone(w, h) {
    console.log(`\n== touch phone ${w}×${h}`);
    const { page, ctx } = await newPage({ width: w, height: h }, true);
    const cdp = await ctx.newCDPSession(page);
    await page.goto(BASE + 'index.html?debug=1&fast=6');
    await waitFor(page, `S && S.mode === 'title'`);
    await page.waitForTimeout(600);
    check(await backLinkOk(page), 'back link visible and clickable');
    await shot(page, `p${w}-01-title`);
    await tapSel(page, cdp, '[data-act="title-new"]');
    await waitFor(page, `S.mode === 'creator'`);
    await shot(page, `p${w}-02-creator`);
    await tapSel(page, cdp, '[data-act="creator-go"]');
    await waitFor(page, `S.mode === 'story' && S.app.dlg.active`, 30000);
    await tapSel(page, cdp, '.dlg-box');
    await shot(page, `p${w}-03-story`);
    await tapSel(page, cdp, '[data-act="dlg-skip"]');
    await waitFor(page, `S.mode === 'map' && !S.app.map.walk`, 60000);
    await shot(page, `p${w}-04-map`);
    await tapSel(page, cdp, '[data-act="map-go"]');
    await waitFor(page, `S.mode === 'story'`, 30000);
    await tapSel(page, cdp, '[data-act="dlg-skip"]');
    await waitFor(page, `S.mode === 'hole' && S.world`, 60000);
    await tap(cdp, w / 2, h / 2);
    await waitFor(page, `!S.app.intro`, 20000);
    await page.waitForTimeout(500);
    check(await page.evaluate(() => document.body.classList.contains('touch')), 'touch mode is on');
    // control sizes and overlaps
    const geo = await page.evaluate(() => {
        const rect = (e) => { const r = e.getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height, r: r.right, b: r.bottom }; };
        const vis = (e) => { const r = e.getBoundingClientRect(); return r.width > 0 && r.height > 0 && getComputedStyle(e).display !== 'none' && getComputedStyle(e).visibility !== 'hidden'; };
        const controls = [...document.querySelectorAll('#hud button')].filter(vis).map((e) => ({ id: e.id || e.dataset.act || e.className, ...rect(e) }));
        const readouts = ['#hud-hole', '#hud-wind', '.mp', '#hud-coins', '#hud-lie', '#meter'].map((s) => document.querySelector(s)).filter((e) => e && vis(e)).map((e) => ({ id: e.id || e.className, ...rect(e) }));
        return { controls, readouts, sw: document.documentElement.scrollWidth, iw: innerWidth, canvas: rect(document.getElementById('view')) };
    });
    const small = geo.controls.filter((c) => c.w < 43.5 || c.h < 43.5);
    check(small.length === 0, `every HUD control ≥ 44 px${small.length ? ': ' + small.map((c) => `${c.id} ${c.w.toFixed(0)}×${c.h.toFixed(0)}`).join(', ') : ''}`);
    const hit = (a, b) => a.x < b.r - 1 && b.x < a.r - 1 && a.y < b.b - 1 && b.y < a.b - 1;
    const clashes = [];
    for (const c of geo.controls) for (const r of geo.readouts) if (hit(c, r)) clashes.push(`${c.id}×${r.id}`);
    for (let i = 0; i < geo.controls.length; i++) for (let j = i + 1; j < geo.controls.length; j++) if (hit(geo.controls[i], geo.controls[j])) clashes.push(`${geo.controls[i].id}×${geo.controls[j].id}`);
    check(clashes.length === 0, `no control overlaps another control or a readout${clashes.length ? ': ' + clashes.join(', ') : ''}`);
    check(geo.sw <= geo.iw + 1, `no sideways scroll (${geo.sw} ≤ ${geo.iw})`);
    check(geo.canvas.x >= -1 && geo.canvas.r <= w + 1 && geo.canvas.y >= -1 && geo.canvas.b <= h + 1, 'the canvas is not clipped');
    await shot(page, `p${w}-05-hole`);
    // drag to aim
    const yaw0 = await S(page, `return S.world.s.aimYaw`);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: w * 0.5, y: h * 0.35, id: 2 }] });
    for (let i = 1; i <= 6; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: w * 0.5 - i * 12, y: h * 0.35, id: 2 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(400);
    const yaw1 = await S(page, `return S.world.s.aimYaw`);
    check(Math.abs(yaw1 - yaw0) > 0.05, `a drag aims (${yaw0.toFixed(3)} → ${yaw1.toFixed(3)})`);
    await S(page, `S.world.setAim(S.world.defaultAim()); S.world.setClub('iron')`);
    // three taps on SWING
    await tapSel(page, cdp, '#btn-swing');
    await waitFor(page, `S.app.swing.state === 'power' && S.app.swing.m >= 0.5`, 30000);
    await tapSel(page, cdp, '#btn-swing');
    await waitFor(page, `S.app.swing.state !== 'acc' || S.app.swing.m <= 0.03`, 30000);
    await tapSel(page, cdp, '#btn-swing');
    await waitFor(page, `S.world.s.strokes === 1`, 20000);
    ok('three taps on SWING take a shot');
    await waitFor(page, `['aim', 'done', 'failed'].includes(S.world.s.phase)`, 120000);
    await shot(page, `p${w}-06-after`);
    // pause button
    await tapSel(page, cdp, '#btn-pause');
    await waitFor(page, `S.app.overlay === 'pause'`);
    await shot(page, `p${w}-07-pause`);
    await tapSel(page, cdp, '[data-act="resume"]');
    await waitFor(page, `S.app.overlay === null`);
    ok('❚❚ pauses and resumes');
    reportErrors(`phone ${w}×${h}`);
}

try {
    if (!ONLY || ONLY === 'desktop') await desktop();
    if (!ONLY || ONLY === 'phones') { await phone(390, 844); await phone(844, 390); }
} catch (e) {
    fail(`crashed: ${e.message}`);
    if (errors.length) console.log('   errors so far:\n   ' + errors.join('\n   '));
}
if (browser) await browser.close();
console.log(`\n${fails ? '✗ ' + fails + ' failed' : '✓ all passed'}`);
process.exit(fails ? 1 : 0);

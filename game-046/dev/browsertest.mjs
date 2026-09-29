/**
 * browsertest.mjs — real Chromium, real WebGL, real three.js r165.
 *
 * Loads game-046/index.html?debug=1 and walks: title (attract demo) → PLAY →
 * starting blessing → first room (walk, shoot) → clear → door → level-up
 * card → angel room → boss room → victory → results; pause/resume; the
 * talents screen; a screenshot of every chapter's biome; then touch-only
 * play on a 390×844 phone and a 844×390 landscape phone. Fails on any
 * console error, page error or failed request. Screenshots → dev/shots/.
 *
 *   python3 -m http.server 8046                 # from the REPO ROOT
 *   node game-046/dev/browsertest.mjs
 *
 * No network to unpkg.com? Fetch the package once and point THREE_PKG at it;
 * CDN requests are then fulfilled from disk (still the genuine r165):
 *   npm pack three@0.165.0 && tar xzf three-0.165.0.tgz     # -> ./package
 *   THREE_PKG=$PWD/package node game-046/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8046), PW_CHROMIUM_PATH, OUT, ONLY=desktop|phones.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? path.join(HERE, 'package');
const BASE = process.env.BASE ?? 'http://127.0.0.1:8046';
const OUT = process.env.OUT ?? path.join(HERE, 'shots');
fs.mkdirSync(OUT, { recursive: true });

const errors = [];
// A fresh browser per section: software GL (SwiftShader) can run out of resources
// after a long session, which would show up as a black canvas in the next context.
const launch = () => chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
});
let browser = null;

async function newPage(viewport, extra = {}) {
    if (browser) await browser.close();
    browser = await launch();
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, ...extra });
    await ctx.addInitScript(() => { try { localStorage.clear(); } catch { /* ignore */ } });
    const page = await ctx.newPage();
    if (fs.existsSync(PKG)) {
        await page.route('https://unpkg.com/**', (route) => {
            const rel = new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, '');
            const file = path.join(PKG, rel);
            if (!fs.existsSync(file)) return route.abort();
            route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
        });
    }
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); else if (process.env.VERBOSE) console.log('   console.' + m.type(), m.text()); });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('requestfailed', (r) => { if (!r.url().includes('favicon')) errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`); });
    return { ctx, page };
}

const shot = async (page, name) => { await page.screenshot({ path: path.join(OUT, `${name}.png`) }); console.log('  shot', name); };
const wait = (page, ms) => page.waitForTimeout(ms);
const check = (cond, msg) => { if (!cond) { errors.push(`check: ${msg}`); console.log('  FAIL', msg); } else console.log('  ok', msg); };
// Software GL can run at a few fps: wait on game state, never on wall-clock time.
const until = async (page, fn, msg, timeout = 90000, arg = null) => {
    const ok = await page.waitForFunction(fn, arg, { timeout }).then(() => true, () => false);
    check(ok, msg);
    return ok;
};
const Q = (page, fn, arg) => page.evaluate(fn, arg);

/** Clear the current room and walk out of the door with the keyboard, taking any cards offered. */
async function clearAndExit(page, label) {
    await Q(page, () => { __qs.god(true); __qs.killAll(); });
    await until(page, () => __qs.world.phase !== 'fight', `${label}: room clears`);
    const start = await Q(page, () => __qs.world.stageNum);
    const t0 = Date.now();
    let held = null, cards = 0;
    const hold = async (k) => { if (held === k) return; if (held) await page.keyboard.up(held); held = k; if (k) await page.keyboard.down(k); };
    let ok = false;
    while (Date.now() - t0 < 180000) {
        const s = await Q(page, () => ({ mode: __qs.mode, stage: __qs.world.stageNum, x: __qs.world.player.x }));
        if (s.stage > start || s.mode === 'over') { ok = true; break; }
        if (s.mode === 'choice') { await hold(null); await page.click('#choice-cards .card'); cards++; }
        else await hold(Math.abs(s.x) > 0.6 ? (s.x > 0 ? 'KeyA' : 'KeyD') : 'KeyW');
        await wait(page, 150);
    }
    await hold(null);
    check(ok, `${label}: walked through the door (${cards} card${cards === 1 ? '' : 's'} taken)`);
}

const ONLY = process.env.ONLY;          // 'desktop' | 'phones' to run one half

// ------------------------------------------------------------------ Desktop
if (ONLY !== 'phones') {
    const { ctx, page } = await newPage({ width: 1280, height: 800 });
    await page.goto(`${BASE}/game-046/index.html?debug=1`);
    await page.waitForFunction(() => window.__qs, null, { timeout: 30000 });
    await wait(page, 2500);
    await shot(page, '01-title');
    check(await Q(page, () => __qs.mode === 'title' && __qs.attract), 'boots into title with attract demo');
    await until(page, () => __qs.world.stats.dmgDealt > 0, 'attract-mode bot shoots enemies');
    check(await Q(page, () => document.getElementById('endless-btn').disabled), 'endless is locked on a fresh save');
    await page.click('#ch-next');
    await wait(page, 300);
    check(await Q(page, () => document.getElementById('play-btn').disabled), 'chapter 2 is locked on a fresh save');
    await page.click('#ch-prev');

    // Talents screen.
    await page.click('#talents-btn');
    await wait(page, 300);
    check(await Q(page, () => document.querySelectorAll('.talent').length === 6), 'talents screen lists six talents');
    await shot(page, '02-talents');
    await page.click('#talents-back');

    // Start a run.
    await page.click('#play-btn');
    await until(page, () => __qs.mode === 'choice', 'PLAY opens the starting blessing');
    await shot(page, '03-blessing');
    check(await Q(page, () => document.querySelectorAll('#choice-cards .card').length === 3), 'three ability cards');
    await page.click('#choice-cards .card');
    await until(page, () => __qs.mode === 'playing' && __qs.world.phase === 'fight', 'card pick starts the fight');

    // Move, then stand still and shoot.
    const y0 = await Q(page, () => __qs.world.player.y);
    await page.keyboard.down('KeyW');
    await until(page, (y) => __qs.world.player.y > y + 0.5, 'W walks up the room', 30000, y0);
    await page.keyboard.up('KeyW');
    await Q(page, () => __qs.god(true));
    await until(page, () => __qs.world.stats.dmgDealt > 0, 'standing still fires arrows that land');
    await shot(page, '04-fight');

    // Pause / resume.
    await page.keyboard.press('KeyP');
    await wait(page, 200);
    check(await Q(page, () => __qs.mode === 'paused' && !document.getElementById('pause').classList.contains('hidden')), 'P pauses');
    await shot(page, '05-pause');
    await page.click('#resume-btn');
    await wait(page, 200);
    check(await Q(page, () => __qs.mode === 'playing'), 'resume');

    await clearAndExit(page, 'room 1-1');
    check(await Q(page, () => __qs.stageLabel() === '1-2'), 'arrived in 1-2');

    // Angel room (stage index 3).
    await Q(page, () => __qs.toStage(3));
    await until(page, () => __qs.world.room.kind === 'angel', 'jump to the angel room');
    await wait(page, 600);
    await page.keyboard.down('KeyW');
    await until(page, () => __qs.mode === 'choice' && __qs.world.choice.kind === 'angel', 'walking up reaches the angel');
    await page.keyboard.up('KeyW');
    await shot(page, '06-angel');
    await page.click('#choice-cards .card');
    await until(page, () => __qs.world.grid.doorOpen, 'angel opens the door');

    // Boss room (stage index 11).
    await Q(page, () => __qs.toStage(11));
    await until(page, () => __qs.world.room.kind === 'boss' && !!__qs.world.boss, 'jump to the boss room');
    await wait(page, 2500);
    check(await Q(page, () => !document.getElementById('boss-bar').classList.contains('hidden')), 'boss health bar shows');
    await shot(page, '07-boss');
    await clearAndExit(page, 'boss room');
    await until(page, () => __qs.mode === 'over', 'leaving the boss room ends the chapter');
    await wait(page, 500);
    check(await Q(page, () => document.getElementById('over-title').textContent.includes('CLEAR')), 'results say CHAPTER CLEAR');
    check(await Q(page, () => __qs.state.unlocked === 2 && __qs.state.coins > 0), 'chapter 2 unlocked and coins banked');
    check(await Q(page, () => !document.getElementById('fade').classList.contains('on')), 'the room fade lifts for the results');
    await shot(page, '08-results');

    // Every biome, via the title's chapter picker.
    await page.click('#menu-btn');
    await Q(page, () => { __qs.state.unlocked = 10; __qs.state.chapter = 1; });
    for (let ch = 1; ch <= 10; ch++) {
        if (ch > 1) await page.click('#ch-next');
        await wait(page, 1800);
        await Q(page, () => document.getElementById('title').classList.add('hidden'));
        await shot(page, `09-biome-${String(ch).padStart(2, '0')}`);
        await Q(page, () => document.getElementById('title').classList.remove('hidden'));
    }
    check(await Q(page, () => __qs.world.chapter === 10), 'chapter picker previews chapter 10');
    // The scene is actually drawn (not a black canvas, not hidden behind the fade).
    const lit = await Q(page, () => (document.getElementById('fade').classList.contains('on') ? 0 : __qs.brightness()));
    check(lit > 6, `title scene is lit (mean brightness ${lit.toFixed(1)})`);
    await ctx.close();
}

// ------------------------------------------------------------------ Phones (touch only)
for (const [name, vp] of ONLY === 'desktop' ? [] : [['phone-portrait', { width: 390, height: 844 }], ['phone-landscape', { width: 844, height: 390 }]]) {
    const { ctx, page } = await newPage(vp, { hasTouch: true, isMobile: true });
    const cdp = await ctx.newCDPSession(page);
    const touch = async (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y }] });
    const tap = async (sel) => {
        const b = await page.locator(sel).first().boundingBox();
        await touch('touchStart', b.x + b.width / 2, b.y + b.height / 2);
        await touch('touchEnd');
    };
    await page.goto(`${BASE}/game-046/index.html?debug=1`);
    await page.waitForFunction(() => window.__qs, null, { timeout: 30000 });
    await wait(page, 2000);
    await shot(page, `10-${name}-title`);
    const top = await Q(page, () => document.querySelector('.logo').getBoundingClientRect().top);
    check(top >= 0, `${name}: title logo is not clipped (top ${top.toFixed(0)}px)`);
    // Every button a thumb needs is at least 44px.
    const small = await Q(page, () => [...document.querySelectorAll('button')].filter((b) => {
        const r = b.getBoundingClientRect();
        return r.width > 0 && (r.width < 43.5 || r.height < 43.5);
    }).map((b) => b.id || b.textContent));
    check(small.length === 0, `${name}: tap targets ≥ 44px (${small.join(', ')})`);
    await tap('#play-btn');
    await until(page, () => __qs.mode === 'choice', `${name}: tap PLAY`);
    await shot(page, `11-${name}-blessing`);
    await tap('#choice-cards .card');
    await until(page, () => __qs.mode === 'playing', `${name}: tap a card`);
    await Q(page, () => __qs.god(true));
    // Floating joystick: thumb down, drag up, hold.
    const y0 = await Q(page, () => __qs.world.player.y);
    const cx = vp.width / 2, cy = vp.height * 0.7;
    await touch('touchStart', cx, cy);
    for (let i = 1; i <= 6; i++) await touch('touchMove', cx, cy - i * 10);
    await until(page, (y) => __qs.world.player.y > y + 0.6, `${name}: dragging the joystick walks`, 30000, y0);
    await shot(page, `12-${name}-joystick`);
    await touch('touchEnd');
    await until(page, () => __qs.world.stats.dmgDealt > 0, `${name}: lifting the thumb shoots`);
    const lit = await Q(page, () => __qs.brightness());
    check(lit > 6, `${name}: the scene is drawn (mean brightness ${lit.toFixed(1)})`);
    await shot(page, `13-${name}-fight`);
    await ctx.close();
}

if (browser) await browser.close();
if (errors.length) {
    console.log(`\n${errors.length} PROBLEM(S):`);
    for (const e of errors) console.log('  ', e);
    process.exit(1);
}
console.log('\nALL BROWSER CHECKS PASSED');

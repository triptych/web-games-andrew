/**
 * browsertest.mjs — real Chromium, real WebGL, real three.js r165.
 *
 * Desktop (1280×800): boot → attract title (back link visible) → every attract
 * page including the demo (the bot plays) → click to the menu → change a setting
 * with the keyboard → START → the ball launches with Space, the paddle moves with
 * the arrows and the mouse, the laser fires → pause / resume → wave clear → tally
 * → next stage → lose the last ship → CONTINUE? → continue → game over → initials
 * typed on the keyboard → the high-score table → every one of the 24 stages boots
 * and plays → beating the Overmind plays the ending and starts loop 2.
 * Then touch-only phones at 390×844 and 844×390: tap to the menu, tap START, the
 * spinner pad moves the paddle, FIRE launches, ❚❚ pauses, buttons are ≥ 44 px,
 * nothing scrolls sideways, the canvas isn't clipped.
 * Fails on any console error, page error or failed request. Screenshots go to
 * dev/shots/.
 *
 *   python3 -m http.server 8060                 # from the REPO ROOT
 *   node game-060/dev/browsertest.mjs
 *
 * No network to unpkg.com? Unpack three@0.165.0 into dev/package (repo root) or
 * point THREE_PKG at it. Env: BASE (default http://127.0.0.1:8060), ONLY=desktop|stages|phones.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8060';
const OUT = path.join(HERE, 'shots');
const ONLY = process.env.ONLY ?? '';
fs.mkdirSync(OUT, { recursive: true });

const errors = [];
let browser = null;

async function newPage(viewport, touch = false) {
    if (browser) await browser.close();
    browser = await chromium.launch({
        executablePath: process.env.PW_CHROMIUM_PATH || undefined,
        args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
    });
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch });
    await ctx.addInitScript(() => {
        try { localStorage.clear(); localStorage.setItem('brickvaders.v1', JSON.stringify({ settings: { sound: false, music: false, crt: true, difficulty: 'arcade' } })); } catch { /* ignore */ }
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
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('requestfailed', (r) => { if (!r.url().includes('favicon')) errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`); });
    await page.goto(`${BASE}/game-060/index.html?debug=1`);
    await page.waitForFunction(() => window.__bv && __bv.mode === 'attract', null, { timeout: 60000 });
    return { ctx, page };
}

const shot = async (page, name) => { await page.waitForTimeout(200); await page.screenshot({ path: path.join(OUT, `bt-${name}.png`) }); console.log('  shot', name); };
const check = (cond, msg) => { if (!cond) { errors.push(`check: ${msg}`); console.log('  FAIL', msg); } else console.log('  ok', msg); };
const until = async (page, fn, msg, timeout = 30000, arg = null) => {
    const ok = await page.waitForFunction(fn, arg, { timeout }).then(() => true, () => false);
    check(ok, msg);
    return ok;
};
const Q = (page, fn, arg) => page.evaluate(fn, arg);
const visible = (page, sel) => Q(page, (s) => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(); if (!r.width || !r.height) return false; const st = getComputedStyle(e); return st.display !== 'none' && st.visibility !== 'hidden' && r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight; }, sel);
const backLinkOk = (page) => Q(page, () => {
    const a = document.getElementById('back-link');
    if (!a || a.getAttribute('href') !== '../index.html') return false;
    const r = a.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return r.width > 0 && (top === a || a.contains(top));
});
/** Screen point (CSS px) of a low-res canvas coordinate. */
const at = (page, x, y) => Q(page, ([x, y]) => { const r = document.getElementById('game').getBoundingClientRect(); return { x: r.left + (x / 240) * r.width, y: r.top + (y / 320) * r.height }; }, [x, y]);

// ---------------------------------------------------------------- desktop
async function desktop() {
    console.log('desktop: boot and attract mode');
    const { page } = await newPage({ width: 1280, height: 800 });
    check(await backLinkOk(page), '← Games link visible, uncovered, points at ../index.html');
    check(await Q(page, () => __bv.page === 'title'), 'title page first');
    check(await visible(page, '#side-l') && await visible(page, '#side-r'), 'side art panels on a wide desktop');
    check(!(await visible(page, '#deck')), 'no touch deck on desktop');
    await page.waitForTimeout(2500);
    check(await Q(page, () => __bv.view.vox.n > 300), 'brick logo drawn as voxels');
    await shot(page, 'title');
    for (const [n, name] of [[1, 'scores'], [2, 'capsules'], [3, 'hiscores']]) {
        await Q(page, (k) => __bv.goPage(k), n);
        await until(page, (nm) => __bv.page === nm, `attract page: ${name}`, 5000, name);
        await page.waitForTimeout(1200);
        await shot(page, `attract-${name}`);
    }
    await Q(page, () => __bv.goPage(4));
    await until(page, () => __bv.page === 'demo' && __bv.world && __bv.world.demo, 'demo play starts a bot-driven world');
    await until(page, () => __bv.world && __bv.world.state === 'play' && __bv.world.balls.some((b) => !b.stuck), 'the demo bot launches the ball', 30000);
    await shot(page, 'demo');

    console.log('desktop: menu');
    const c = await at(page, 120, 200);
    await page.mouse.click(c.x, c.y);
    await until(page, () => __bv.mode === 'menu', 'a click in attract mode opens the menu');
    await page.keyboard.press('ArrowDown');
    await until(page, () => __bv.G.sel === 1, 'ArrowDown moves to MODE', 5000);
    await page.keyboard.press('ArrowRight');
    await until(page, () => __bv.data.settings.difficulty === 'cadet', 'ArrowRight changes MODE to CADET', 5000);
    await page.keyboard.press('ArrowLeft');
    await until(page, () => __bv.data.settings.difficulty === 'arcade', 'and back to ARCADE', 5000);
    await shot(page, 'menu');
    await page.keyboard.press('ArrowUp');
    await until(page, () => __bv.G.sel === 0, 'back up to START GAME', 5000);
    await page.keyboard.press('Enter');
    await until(page, () => __bv.mode === 'play' && __bv.world && __bv.world.stageIndex === 0, 'START GAME begins stage 1-1');
    check(!(await visible(page, '#back-link')), 'back link hidden while playing');
    await until(page, () => __bv.world.state === 'play', 'READY → play', 20000);

    console.log('desktop: controls');
    await page.keyboard.press('Space');
    await until(page, () => __bv.world.balls.some((b) => !b.stuck), 'Space launches the ball', 5000);
    await Q(page, () => { __bv.world.god = true; });
    const x0 = await Q(page, () => __bv.world.paddle.x);
    await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(500); await page.keyboard.up('ArrowLeft');
    const x1 = await Q(page, () => __bv.world.paddle.x);
    check(x1 < x0 - 3, `ArrowLeft moves the paddle (${x0.toFixed(0)} → ${x1.toFixed(0)})`);
    const r = await at(page, 210, 300);
    await page.mouse.move(r.x - 20, r.y); await page.mouse.move(r.x, r.y, { steps: 4 });
    await until(page, () => __bv.world.paddle.x > 180, 'the mouse steers the paddle', 8000);
    const shots0 = await Q(page, () => __bv.session.shots);
    for (let i = 0; i < 4; i++) { await page.keyboard.press('KeyZ'); await page.waitForTimeout(250); }
    check(await Q(page, (s) => __bv.session.shots > s, shots0), 'Z fires the laser');
    await shot(page, 'play');

    console.log('desktop: pause');
    await page.keyboard.press('KeyP');
    await until(page, () => __bv.mode === 'pause', 'P pauses');
    const tP = await Q(page, () => __bv.world.time);
    await page.waitForTimeout(500);
    check(await Q(page, (t) => __bv.world.time === t, tP), 'the sim is frozen while paused');
    await shot(page, 'pause');
    await page.keyboard.press('Escape');
    await until(page, () => __bv.mode === 'play', 'Esc resumes');

    console.log('desktop: clear, tally, next stage');
    await Q(page, () => __bv.killAll());
    await until(page, () => __bv.world.state === 'tally', 'killing every invader clears the wave and shows the tally', 30000);
    await page.waitForTimeout(2500);
    await shot(page, 'tally');
    await page.keyboard.press('Space');
    await until(page, () => __bv.world.stageIndex === 1, 'tally → stage 1-2', 20000);

    console.log('desktop: continue and game over');
    await until(page, () => __bv.world.state === 'play', 'stage 1-2 starts', 20000);
    await Q(page, () => { __bv.world.god = false; __bv.session.lives = 1; __bv.world.loseLife('shot'); });
    await until(page, () => __bv.mode === 'continue', 'losing the last ship asks CONTINUE?', 20000);
    await shot(page, 'continue');
    await page.keyboard.press('Enter');
    await until(page, () => __bv.mode === 'play', 'Enter continues');
    check(await Q(page, () => __bv.session.continues === 1 && __bv.session.lives >= 2), `continuing restores the ships (${await Q(page, () => JSON.stringify({ lives: __bv.session.lives, cont: __bv.session.continues }))})`);
    await Q(page, () => { __bv.session.score = 54321; __bv.session.lives = 1; __bv.world.paddle.invuln = 0; __bv.world.loseLife('shot'); });
    await until(page, () => __bv.mode === 'continue', 'CONTINUE? again', 20000);
    await Q(page, () => { __bv.G.contT = 0.3; });
    await until(page, () => __bv.mode === 'entry', 'the countdown runs out into initials entry (a top-10 score)', 10000);
    await page.keyboard.type('ZAX', { delay: 120 });
    await until(page, () => __bv.mode === 'attract' && __bv.page === 'hiscores', 'three letters go to the high-score table');
    check(await Q(page, () => __bv.data.hiscores.some((e) => e.name === 'ZAX' && e.score === 54321)), 'ZAX 54321 is in the table');
    check(await Q(page, () => { try { return JSON.parse(localStorage.getItem('brickvaders.v1')).hiscores.some((e) => e.name === 'ZAX'); } catch { return false; } }), 'and saved to localStorage');
    await shot(page, 'hiscores-entry');
}

// ---------------------------------------------------------------- every stage
async function stages() {
    console.log('stages: every stage boots and plays');
    const { page } = await newPage({ width: 900, height: 800 });
    const n = await Q(page, () => __bv.STAGES.length);
    for (let i = 0; i < n; i++) {
        await Q(page, (k) => { __bv.start('arcade', k); __bv.world.god = true; __bv.skipIntro(); __bv.G.autoBot = null; }, i);
        const ok = await page.waitForFunction(() => __bv.world.state === 'play' && __bv.world.time > 0.6, null, { timeout: 20000 }).then(() => true, () => false);
        const info = await Q(page, () => ({ label: __bv.world.stage.label, type: __bv.world.stage.type, vox: __bv.view.vox.n, bd: __bv.view.back.current }));
        check(ok && info.vox > 60, `stage ${info.label} (${info.type}) plays — ${info.vox} voxels, backdrop ${info.bd}`);
        if (i % 4 === 3 || info.type === 'challenge') await shot(page, `stage-${info.label}`);
    }
    console.log('stages: the ending and loop 2');
    await Q(page, () => { __bv.start('arcade', 23); __bv.world.god = true; __bv.skipIntro(); });
    await until(page, () => __bv.world.state === 'play', 'the Overmind fight starts', 20000);
    await Q(page, () => __bv.killAll());
    await until(page, () => __bv.world.state === 'tally', 'the Overmind dies (tally)', 40000);
    await page.keyboard.press('Space');
    await until(page, () => __bv.mode === 'ending', 'the ending plays', 20000);
    await page.waitForFunction(() => __bv.G.endT > 5.5, null, { timeout: 30000 });
    await shot(page, 'ending');
    await page.keyboard.press('Enter');
    await until(page, () => __bv.mode === 'play' && __bv.session.loop === 1 && __bv.world.stageIndex === 0, 'loop 2 starts at 1-1', 20000);
}

// ---------------------------------------------------------------- phones
async function phone(w, h) {
    console.log(`phone ${w}×${h}: touch only`);
    const { page } = await newPage({ width: w, height: h }, true);
    check(await backLinkOk(page), '← Games link visible and uncovered');
    check(await Q(page, () => document.documentElement.scrollWidth <= innerWidth + 1), 'no sideways scroll');
    check(await Q(page, () => { const r = document.getElementById('game').getBoundingClientRect(); return r.left >= -1 && r.right <= innerWidth + 1 && r.top >= -1 && r.bottom <= innerHeight + 1; }), 'the screen fits the viewport');
    for (const id of ['#pad', '#btn-fire', '#btn-bomb', '#btn-pause']) {
        const box = await Q(page, (s) => { const r = document.querySelector(s).getBoundingClientRect(); return { w: r.width, h: r.height, l: r.left, t: r.top, r: r.right, b: r.bottom }; }, id);
        check(await visible(page, id) && box.w >= 44 && box.h >= 44 && box.r <= w + 1 && box.b <= h + 1, `${id} on screen and ≥ 44 px (${Math.round(box.w)}×${Math.round(box.h)})`);
    }
    await page.waitForTimeout(1500);
    await shot(page, `phone-${w}x${h}-title`);
    const c = await at(page, 120, 220);
    await page.touchscreen.tap(c.x, c.y);
    await until(page, () => __bv.mode === 'menu', 'a tap opens the menu');
    await page.waitForTimeout(400);
    const hit = await Q(page, () => __bv.G.hits.find((r) => r.id === 0));
    const s = await at(page, hit.x + hit.w / 2, hit.y + hit.h / 2);
    await page.touchscreen.tap(s.x, s.y);
    await until(page, () => __bv.mode === 'play', 'tapping START GAME starts');
    await Q(page, () => { __bv.skipIntro(); __bv.world.god = true; });
    await until(page, () => __bv.world.state === 'play', 'play begins');
    // drag the spinner pad
    const pad = await Q(page, () => { const r = document.getElementById('pad').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width }; });
    const x0 = await Q(page, () => __bv.world.paddle.x);
    const cdp = await page.context().newCDPSession(page);
    const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
    await touch('touchStart', pad.x, pad.y);
    for (let k = 1; k <= 8; k++) { await touch('touchMove', pad.x - k * pad.w * 0.05, pad.y); await page.waitForTimeout(40); }
    await touch('touchEnd', 0, 0);
    await page.waitForTimeout(200);
    const x1 = await Q(page, () => __bv.world.paddle.x);
    check(x1 < x0 - 10, `the spinner pad slides the paddle (${x0.toFixed(0)} → ${x1.toFixed(0)})`);
    const fire = await Q(page, () => { const r = document.getElementById('btn-fire').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await page.touchscreen.tap(fire.x, fire.y);
    await until(page, () => __bv.world.balls.some((b) => !b.stuck), 'FIRE launches the ball', 5000);
    await page.waitForTimeout(1500);
    await shot(page, `phone-${w}x${h}-play`);
    const pz = await Q(page, () => { const r = document.getElementById('btn-pause').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await page.touchscreen.tap(pz.x, pz.y);
    await until(page, () => __bv.mode === 'pause', '❚❚ pauses');
    const res = await Q(page, () => __bv.G.hits.find((r) => r.id === 0));
    const rp = await at(page, res.x + res.w / 2, res.y + res.h / 2);
    await page.touchscreen.tap(rp.x, rp.y);
    await until(page, () => __bv.mode === 'play', 'tapping RESUME resumes');
    check(await Q(page, () => document.documentElement.scrollWidth <= innerWidth + 1), 'still no sideways scroll in play');
}

const t0 = Date.now();
try {
    if (!ONLY || ONLY === 'desktop') await desktop();
    if (!ONLY || ONLY === 'stages') await stages();
    if (!ONLY || ONLY === 'phones') { await phone(390, 844); await phone(844, 390); }
} catch (e) {
    errors.push(`exception: ${e.stack || e}`);
}
if (browser) await browser.close();
console.log(`\n${errors.length ? 'FAILED' : 'PASSED'} in ${((Date.now() - t0) / 1000).toFixed(0)}s`);
for (const e of errors) console.log(' - ' + e);
process.exit(errors.length ? 1 : 0);

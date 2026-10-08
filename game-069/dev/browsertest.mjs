/**
 * browsertest.mjs — real Chromium, real WebGL, real three.js r165.
 *
 * Desktop (1600×900): boot → attract title (back link visible, side panels) →
 * every attract page including the bot-flown demo → click to the menu → change a
 * setting with the keyboard → START → thrust both ways, climb, fire, smart bomb,
 * hyperspace → pause / resume → wave clear and tally → wave 2 → lose the last
 * ship → GAME OVER → CONTINUE? → continue → lose again → initials typed on the
 * keyboard → the high-score table → every one of the 15 waves boots and plays
 * (bosses included) → beating the Overseer plays the ending and starts loop 2.
 * Then touch-only phones at 390×844 and 844×390: tap to the menu, tap START,
 * the stick flies the ship, FIRE / BOMB / HYPER work, ❚❚ pauses, buttons are
 * ≥ 44 px, nothing scrolls sideways, the canvas isn't clipped.
 * Fails on any console error, page error or failed request. Screenshots go to
 * dev/shots/.
 *
 *   python3 -m http.server 8069                 # from the REPO ROOT
 *   node game-069/dev/browsertest.mjs
 *
 * No network to unpkg.com? Unpack three@0.165.0 into dev/package (repo root) or
 * point THREE_PKG at it. Env: BASE (default http://127.0.0.1:8069), ONLY=desktop|waves|phones.
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
        try { localStorage.clear(); localStorage.setItem('phosphor-patrol.v1', JSON.stringify({ settings: { sound: false, music: false, crt: true, difficulty: 'arcade' } })); } catch { /* ignore */ }
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
    await page.goto(`${BASE}/game-069/index.html?debug=1`);
    await page.waitForFunction(() => window.__pp && __pp.mode === 'attract', null, { timeout: 60000 });
    return { ctx, page };
}

const shot = async (page, name) => { await page.waitForTimeout(250); await page.screenshot({ path: path.join(OUT, `bt-${name}.png`) }); console.log('  shot', name); };
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
/** Screen point (CSS px) of a logical 400×300 coordinate (y up). */
const at = (page, x, y) => Q(page, ([x, y]) => { const r = document.getElementById('game').getBoundingClientRect(); return { x: r.left + (x / 400) * r.width, y: r.top + (1 - y / 300) * r.height }; }, [x, y]);
const center = (page, sel) => Q(page, (s) => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width, h: r.height }; }, sel);
/** Centre of a menu item's tap rectangle. */
const hitAt = async (page, id) => {
    const h = await Q(page, (i) => __pp.G.hits.find((r) => r.id === i), id);
    if (!h) return null;
    return at(page, h.x + h.w / 2, h.y + h.h / 2);
};

// ---------------------------------------------------------------- desktop
async function desktop() {
    console.log('desktop: boot and attract mode');
    const { page } = await newPage({ width: 1600, height: 900 });
    check(await backLinkOk(page), '← Games link visible, uncovered, points at ../index.html');
    check(await Q(page, () => __pp.page === 'title'), 'title page first');
    check(await visible(page, '#side-l') && await visible(page, '#side-r'), 'side panels on a wide desktop');
    check(!(await visible(page, '#stick')) && !(await visible(page, '#btn-fire')), 'no touch deck on desktop');
    await page.waitForTimeout(2500);
    check(await Q(page, () => __pp.view.r.hud.n > 150), 'the logo is drawn in beams');
    await shot(page, 'title');
    for (const [n, name] of [[1, 'reapers'], [2, 'howto'], [3, 'hiscores']]) {
        await Q(page, (k) => __pp.goPage(k), n);
        await until(page, (nm) => __pp.page === nm, `attract page: ${name}`, 5000, name);
        await page.waitForTimeout(1500);
        await shot(page, `attract-${name}`);
    }
    await Q(page, () => __pp.goPage(4));
    await until(page, () => __pp.page === 'demo' && __pp.world && __pp.world.demo, 'demo play starts a bot-flown world');
    await until(page, () => __pp.world && __pp.world.state === 'play' && __pp.world.stats.shots > 0, 'the demo bot flies and shoots', 40000);
    await shot(page, 'demo');

    console.log('desktop: menu');
    const c = await at(page, 200, 150);
    await page.mouse.click(c.x, c.y);
    await until(page, () => __pp.mode === 'menu', 'a click in attract mode opens the menu');
    await page.keyboard.press('ArrowDown');
    await until(page, () => __pp.G.sel === 1, 'ArrowDown moves to MODE', 5000);
    await page.keyboard.press('ArrowRight');
    await until(page, () => __pp.data.settings.difficulty === 'cadet', 'ArrowRight changes MODE to CADET', 5000);
    await page.keyboard.press('ArrowLeft');
    await until(page, () => __pp.data.settings.difficulty === 'arcade', 'and back to ARCADE', 5000);
    await shot(page, 'menu');
    await page.keyboard.press('ArrowUp');
    await until(page, () => __pp.G.sel === 0, 'back up to START GAME', 5000);
    await page.keyboard.press('Enter');
    await until(page, () => __pp.mode === 'play' && __pp.world && __pp.session.wave === 0, 'START GAME begins wave 1');
    check(!(await visible(page, '#back-link')), 'back link hidden while playing');
    await until(page, () => __pp.world.state === 'play', 'intro → play', 20000);

    console.log('desktop: controls');
    await Q(page, () => { __pp.world.god = true; });
    await page.keyboard.down('ArrowRight'); await page.waitForTimeout(700);
    check(await Q(page, () => __pp.world.ship.face === 1 && __pp.world.ship.vx > 20), 'ArrowRight thrusts right');
    await page.keyboard.up('ArrowRight');
    await page.keyboard.down('ArrowLeft'); await page.waitForTimeout(900);
    check(await Q(page, () => __pp.world.ship.face === -1 && __pp.world.ship.vx < -20), 'ArrowLeft turns around and thrusts left');
    await page.keyboard.up('ArrowLeft');
    const y0 = await Q(page, () => __pp.world.ship.y);
    await page.keyboard.down('ArrowUp'); await page.waitForTimeout(500); await page.keyboard.up('ArrowUp');
    const y1 = await Q(page, () => __pp.world.ship.y);
    check(y1 > y0 + 3, `ArrowUp climbs (${y0.toFixed(0)} → ${y1.toFixed(0)})`);
    const s0 = await Q(page, () => __pp.world.stats.shots);
    for (let i = 0; i < 4; i++) { await page.keyboard.press('Space'); await page.waitForTimeout(150); }
    check(await Q(page, (s) => __pp.world.stats.shots > s, s0), 'Space fires the laser');
    await shot(page, 'play');
    const b0 = await Q(page, () => __pp.session.bombs);
    await page.keyboard.press('KeyX');
    await until(page, (b) => __pp.session.bombs === b - 1, 'X fires a smart bomb', 5000, b0);
    const hx = await Q(page, () => __pp.world.ship.x);
    await page.keyboard.press('KeyH');
    await until(page, (x) => Math.abs(__pp.world.ship.x - x) > 1, 'H jumps to hyperspace', 5000, hx);
    await page.keyboard.press('KeyP');
    await until(page, () => __pp.mode === 'pause', 'P pauses', 5000);
    await shot(page, 'pause');
    await page.keyboard.press('KeyP');
    await until(page, () => __pp.mode === 'play', 'P resumes', 5000);

    console.log('desktop: wave flow');
    await Q(page, () => __pp.clearWave());
    await until(page, () => __pp.world.state === 'tally', 'clearing the wave shows the tally', 10000);
    await shot(page, 'tally');
    await until(page, () => __pp.session.wave === 1 && __pp.world.state !== 'tally', 'the next wave starts', 40000);
    await Q(page, () => { const w = __pp.world; w.god = false; __pp.session.lives = 1; w.state = 'play'; w.ship.inv = 0; w.killShip('test'); });
    await until(page, () => __pp.world.state === 'gameover', 'losing the last ship is game over', 20000);
    await until(page, () => __pp.mode === 'continue', 'CONTINUE? appears', 20000);
    await shot(page, 'continue');
    await page.keyboard.press('Space');
    await until(page, () => __pp.mode === 'play' && __pp.session.continues === 1 && __pp.world.ship.alive, 'Space continues the game', 10000);
    await Q(page, () => { const w = __pp.world; __pp.session.score = 123456; __pp.session.lives = 1; w.ship.inv = 0; w.state = 'play'; w.killShip('test'); });
    await until(page, () => __pp.mode === 'continue', 'CONTINUE? again', 30000);
    await Q(page, () => { __pp.G.contT = 0.05; });
    await until(page, () => __pp.mode === 'entry', 'a top score asks for initials', 10000);
    for (const k of ['KeyA', 'KeyC', 'KeyE']) { await page.keyboard.press(k); await page.waitForTimeout(120); }
    await until(page, () => __pp.mode === 'attract' && __pp.page === 'hiscores', 'three letters go to the high scores', 10000);
    check(await Q(page, () => __pp.data.hiscores[0].name === 'ACE' && __pp.data.hiscores[0].score === 123456), 'ACE is top of the table');
    await shot(page, 'hiscores-new');
}

// ---------------------------------------------------------------- every wave
async function waves() {
    console.log('desktop: every wave');
    const { page } = await newPage({ width: 1024, height: 768 });
    const n = await Q(page, () => __pp.WAVES.length);
    for (let i = 0; i < n; i++) {
        await Q(page, (k) => { __pp.start('arcade', k); __pp.god(); __pp.skipIntro(); __pp.autoplay(); }, i);
        await until(page, (k) => __pp.world && __pp.session.wave === k && __pp.world.state === 'play', `wave ${i + 1} (${await Q(page, (k) => __pp.WAVES[k].name, i)}) starts`, 20000, i);
        const st = await Q(page, () => __pp.ff(10));
        await page.waitForTimeout(900);
        const boss = await Q(page, () => !!__pp.world.def.boss);
        if (boss) check(await Q(page, () => !!__pp.world.boss), `boss present in wave ${i + 1}`);
        check(st === 'play' || st === 'tally' || st === 'done', `wave ${i + 1} runs (${st})`);
        if ([0, 3, 4, 6, 9, 12, 14].includes(i)) await shot(page, `wave-${String(i + 1).padStart(2, '0')}`);
    }
    console.log('desktop: ending and loop 2');
    await Q(page, () => { __pp.start('arcade', 14); __pp.god(); __pp.skipIntro(); });
    await until(page, () => __pp.world.state === 'play' && __pp.world.boss, 'the Overseer arrives', 20000);
    await Q(page, () => __pp.clearWave());
    await until(page, () => __pp.mode === 'ending', 'beating the Overseer plays the ending', 60000);
    await page.waitForTimeout(3000);
    await shot(page, 'ending');
    await Q(page, () => { __pp.G.endT = 99; });
    await until(page, () => __pp.mode === 'play' && __pp.session.loop === 1 && __pp.session.wave === 0, 'loop 2 begins at wave 1', 20000);
}

// ---------------------------------------------------------------- phones
async function phone(w, h) {
    console.log(`phone ${w}×${h}: touch only`);
    const { page } = await newPage({ width: w, height: h }, true);
    check(await backLinkOk(page), 'back link visible and uncovered');
    check(await visible(page, '#stick') && await visible(page, '#btn-fire'), 'touch deck shown');
    const over = await Q(page, () => document.documentElement.scrollWidth - innerWidth);
    check(over <= 1, `no sideways scroll (${over}px)`);
    const cv = await Q(page, () => { const r = document.getElementById('game').getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: r.width, h: r.height }; });
    check(cv.l >= -1 && cv.r <= w + 1 && cv.t >= -1 && cv.b <= h + 1, `canvas fits the viewport (${cv.w.toFixed(0)}×${cv.h.toFixed(0)})`);
    for (const sel of ['#btn-fire', '#btn-bomb', '#btn-hyper', '#btn-pause']) {
        const r = await center(page, sel);
        check(r.w >= 44 && r.h >= 44, `${sel} is at least 44 px (${r.w.toFixed(0)}×${r.h.toFixed(0)})`);
    }
    const overlap = await Q(page, () => {
        const ids = ['#screen', '#stick', '#btn-fire', '#btn-bomb', '#btn-hyper'];
        const rs = ids.map((s) => document.querySelector(s).getBoundingClientRect());
        const hit = (a, b) => a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1;
        const bad = [];
        for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) if (hit(rs[i], rs[j])) bad.push(`${ids[i]}×${ids[j]}`);
        return bad;
    });
    check(!overlap.length, `controls don't overlap the monitor or each other ${overlap.join(' ')}`);
    await shot(page, `phone-${w}x${h}-title`);
    const c = await at(page, 200, 150);
    await page.touchscreen.tap(c.x, c.y);
    await until(page, () => __pp.mode === 'menu', 'tap opens the menu', 10000);
    await page.waitForTimeout(400);
    const s = await hitAt(page, 0);
    await page.touchscreen.tap(s.x, s.y);
    await until(page, () => __pp.mode === 'play', 'tap START begins the game', 10000);
    await until(page, () => __pp.world.state === 'play', 'intro → play', 20000);
    await Q(page, () => { __pp.world.god = true; });
    const st = await center(page, '#stick');
    const cdp = await page.context().newCDPSession(page);
    const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
    await touch('touchStart', st.x, st.y);
    for (let k = 1; k <= 6; k++) { await touch('touchMove', st.x + k * 8, st.y - k * 3); await page.waitForTimeout(40); }
    await page.waitForTimeout(800);
    check(await Q(page, () => __pp.world.ship.face === 1 && __pp.world.ship.vx > 20), 'the stick thrusts right');
    for (let k = 1; k <= 10; k++) { await touch('touchMove', st.x + 48 - k * 10, st.y); await page.waitForTimeout(40); }
    await page.waitForTimeout(800);
    check(await Q(page, () => __pp.world.ship.face === -1), 'and turns the ship around');
    await touch('touchEnd', 0, 0);
    await page.waitForTimeout(300);
    check(await Q(page, () => !__pp.G.world || __pp.world.ship.thrusting === false), 'letting go stops thrusting');
    const s0 = await Q(page, () => __pp.world.stats.shots);
    const fire = await center(page, '#btn-fire');
    for (let i = 0; i < 3; i++) { await page.touchscreen.tap(fire.x, fire.y); await page.waitForTimeout(150); }
    check(await Q(page, (v) => __pp.world.stats.shots > v, s0), 'FIRE shoots');
    const b0 = await Q(page, () => __pp.session.bombs);
    const bomb = await center(page, '#btn-bomb');
    await page.touchscreen.tap(bomb.x, bomb.y);
    await until(page, (b) => __pp.session.bombs === b - 1, 'BOMB fires a smart bomb', 5000, b0);
    const hx = await Q(page, () => __pp.world.ship.x);
    const hy = await center(page, '#btn-hyper');
    await page.touchscreen.tap(hy.x, hy.y);
    await until(page, (x) => Math.abs(__pp.world.ship.x - x) > 1, 'HYPER jumps', 5000, hx);
    await shot(page, `phone-${w}x${h}-play`);
    const pz = await center(page, '#btn-pause');
    await page.touchscreen.tap(pz.x, pz.y);
    await until(page, () => __pp.mode === 'pause', '❚❚ pauses', 5000);
    await page.waitForTimeout(300);
    const rp = await hitAt(page, 0);
    await page.touchscreen.tap(rp.x, rp.y);
    await until(page, () => __pp.mode === 'play', 'tap RESUME resumes', 5000);
}

try {
    if (!ONLY || ONLY === 'desktop') await desktop();
    if (!ONLY || ONLY === 'waves') await waves();
    if (!ONLY || ONLY === 'phones') { await phone(390, 844); await phone(844, 390); }
} catch (e) {
    errors.push(`exception: ${e.stack || e}`);
} finally {
    if (browser) await browser.close();
}
console.log(errors.length ? `\nFAILED\n - ${[...new Set(errors)].join('\n - ')}` : '\nPASSED');
process.exit(errors.length ? 1 : 0);

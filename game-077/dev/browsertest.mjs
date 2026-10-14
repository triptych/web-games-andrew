/**
 * browsertest.mjs — real Chromium, real WebGL (SwiftShader), real three.js r165.
 *
 * Desktop 1280×720: boot → title (back link on top and clickable) → New Game
 * plays the prologue (clicks advance it, Escape skips) → the briefing shows
 * Rico picked → Roll Out starts Episode 1 → a real mouse drag from Rico shoots
 * him (the aim guide is drawn while dragging) → Space mid-roll uses Bank On It
 * → R rewinds the shot → T lets time pass → P pauses and Escape resumes →
 * Options changes a setting with the keyboard → winning shows the grade and
 * Next plays the interlude into Episode 2's briefing → losing shows Busted and
 * Instant Replay undoes it → the Garage sells an upgrade for Rep → every
 * episode boots, survives a burst of random shots and waits at 3× speed with
 * every ability fired → winning Episode 10 plays the ending and the credits →
 * Home returns to the title.
 * Touch-only phones at 390×844 and 844×390: tap through the menus, skip the
 * story, a touch drag shoots, the ABILITY button fires, ❚❚ pauses; every
 * control ≥ 44 px; nothing scrolls sideways; the HUD fits.
 * With localStorage blocked the game still boots and plays.
 * Fails on any console error, page error or failed request.
 *
 *   python3 -m http.server 8077                 # from the REPO ROOT
 *   node game-077/dev/browsertest.mjs           # ONLY=desktop|episodes|phones|storage
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8077';
const OUT = path.join(HERE, 'shots');
const ONLY = process.env.ONLY ?? '';
fs.mkdirSync(OUT, { recursive: true });

const errors = [];
let browser = null;
let fails = 0;

async function newPage(viewport, touch = false, opts = {}) {
    if (browser) await browser.close();
    browser = await chromium.launch({
        args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
    });
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch });
    await ctx.addInitScript((blocked) => {
        if (blocked) {
            Object.defineProperty(window, 'localStorage', { get() { throw new Error('blocked'); } });
            return;
        }
        try { localStorage.clear(); localStorage.setItem('cuevice.v1', JSON.stringify({ settings: { sound: false, music: false, quality: 'low', volume: 0.8, shake: true, scanlines: true, patrols: true } })); } catch { /* ignore */ }
        window.confirm = () => true;
    }, !!opts.blockStorage);
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
    page.on('requestfailed', (r) => { if (!r.url().includes('favicon') && !r.url().includes('fonts.gstatic')) errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`); });
    await page.goto(`${BASE}/game-077/index.html?debug=1${opts.fast ? '&fast=3' : ''}`);
    await page.waitForFunction(() => window.__cv && __cv.G.mode === 'title', null, { timeout: 90000 });
    return { ctx, page };
}

const shot = async (page, name) => { await page.waitForTimeout(250); await page.screenshot({ path: path.join(OUT, `bt-${name}.png`) }); console.log('  shot', name); };
const check = (cond, msg) => { if (!cond) { fails++; errors.push(`check: ${msg}`); console.log('  FAIL', msg); } else console.log('  ok', msg); };
const until = async (page, fn, msg, timeout = 30000, arg = null) => {
    const okk = await page.waitForFunction(fn, arg, { timeout }).then(() => true, () => false);
    check(okk, msg);
    return okk;
};
const Q = (page, fn, arg) => page.evaluate(fn, arg);
const press = async (page, key, ms = 60) => { await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key); await page.waitForTimeout(250); };
const clickSel = (page, sel) => Q(page, (s) => { const e = document.querySelector(s); if (!e) return false; e.click(); return true; }, sel);
const visible = (page, sel) => Q(page, (s) => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(); if (!r.width || !r.height) return false; const st = getComputedStyle(e); return st.display !== 'none' && st.visibility !== 'hidden' && r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight; }, sel);
const backLinkOk = (page) => Q(page, () => {
    const a = document.getElementById('back-link');
    if (!a) return false;
    const r = a.getBoundingClientRect();
    const hit = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return a.getAttribute('href') === '../index.html' && (hit === a || a.contains(hit));
});
const noSideScroll = (page) => Q(page, () => document.documentElement.scrollWidth <= innerWidth + 1 && document.body.scrollWidth <= innerWidth + 1);
const settle = (page, sec = 15) => Q(page, (s) => __cv.settle(s), sec);

/** Real pointer drag from the selected teammate. */
async function dragShoot(page, dx, dy, touch = false) {
    const p = await Q(page, () => { const b = __cv.W.body(__cv.G.sel); return __cv.view.screenOf(b.x, b.y); });
    if (!touch) {
        await page.mouse.move(p.x, p.y);
        await page.mouse.down();
        for (let k = 1; k <= 5; k++) await page.mouse.move(p.x + (dx * k) / 5, p.y + (dy * k) / 5);
        await page.waitForTimeout(400);
        const aim = await Q(page, () => ({ on: __cv.G.aim.on, power: __cv.G.aim.power, guide: !!__cv.G.pred }));
        await page.mouse.up();
        return aim;
    }
    const cdp = await page.context().newCDPSession(page);
    const tp = (x, y) => [{ x, y, id: 1, radiusX: 4, radiusY: 4, force: 1 }];
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: tp(p.x, p.y) });
    for (let k = 1; k <= 5; k++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: tp(p.x + (dx * k) / 5, p.y + (dy * k) / 5) });
    await page.waitForTimeout(400);
    const aim = await Q(page, () => ({ on: __cv.G.aim.on, power: __cv.G.aim.power, guide: !!__cv.G.pred }));
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    return aim;
}

// ================================================================== desktop
async function desktop() {
    console.log('\n== desktop 1280×720');
    const { page } = await newPage({ width: 1280, height: 720 });
    check(await visible(page, '#s-title'), 'title screen visible');
    check(await backLinkOk(page), '← Games link present, on top and pointing at ../index.html');
    await shot(page, 'title');
    // New Game → prologue
    await clickSel(page, '#s-title [data-act="new"]');
    await until(page, () => __cv.G.mode === 'story', 'New Game plays the prologue');
    await page.mouse.click(640, 640); await page.waitForTimeout(200); await page.mouse.click(640, 640);
    const li = await Q(page, () => __cv.G.story?.li ?? -1);
    check(li >= 1, `clicking advances the story (line ${li})`);
    await shot(page, 'story');
    await press(page, 'Escape');
    await until(page, () => __cv.G.mode === 'story' || __cv.G.mode === 'brief', 'Escape skips a scene');
    if (await Q(page, () => __cv.G.mode === 'story')) await press(page, 'Escape');
    await until(page, () => __cv.G.mode === 'brief', 'the briefing follows the story');
    check(await Q(page, () => __cv.G.chosen.join() === 'rico'), 'Rico is picked for Episode 1');
    await shot(page, 'brief');
    await clickSel(page, '#btn-go');
    await until(page, () => __cv.G.mode === 'play' && !!__cv.W, 'Roll Out starts Episode 1');
    check(await visible(page, '#hud'), 'HUD visible');
    await page.waitForTimeout(800);
    // a real drag shot
    const aim = await dragShoot(page, 40, 160);
    check(aim.on && aim.power > 0.2 && aim.guide, `dragging back aims with a guide (power ${aim.power?.toFixed(2)})`);
    await until(page, () => __cv.W.S.stats.shots === 1, 'letting go shoots');
    await shot(page, 'rolling');
    await press(page, 'Space');
    const used = await Q(page, () => __cv.W.crew[0].charges);
    check(used === 1, `Space mid-roll uses Bank On It (charges ${used})`);
    await settle(page);
    check(await Q(page, () => __cv.W.S.phase === 'aim' && __cv.W.S.freeShot != null), 'Bank On It gives a free shot');
    // rewind
    const before = await Q(page, () => __cv.W.S.rewinds);
    await press(page, 'KeyR');
    check(await Q(page, (b) => __cv.W.S.rewinds === b - 1 && __cv.W.S.stats.shots === 0, before), 'R rewinds the shot');
    // wait
    const t0 = await Q(page, () => __cv.W.S.t);
    await press(page, 'KeyT');
    await settle(page);
    check(await Q(page, (t) => __cv.W.S.t > t + 1, t0), 'T lets time pass and the guards walk');
    // keyboard aim + shoot
    await press(page, 'ArrowUp', 200);
    await press(page, 'ArrowLeft', 150);
    check(await Q(page, () => __cv.G.aim.on && __cv.G.aim.kind === 'kb'), 'arrow keys aim');
    await press(page, 'Space');
    check(await Q(page, () => __cv.W.S.stats.shots === 1), 'Space shoots a keyboard aim');
    await settle(page);
    // wheel zoom
    const z0 = await Q(page, () => __cv.view.cam.zoom);
    await page.mouse.move(640, 360); await page.mouse.wheel(0, -400); await page.waitForTimeout(200);
    check(await Q(page, (z) => __cv.view.cam.zoom < z, z0), 'mouse wheel zooms in');
    await press(page, 'KeyC');
    // pause
    await press(page, 'KeyP');
    check(await visible(page, '#s-pause'), 'P pauses');
    await shot(page, 'pause');
    await press(page, 'Escape');
    check(await Q(page, () => __cv.G.mode === 'play'), 'Escape resumes');
    // options via keyboard from the pause menu
    await press(page, 'KeyP');
    await clickSel(page, '#s-pause [data-act="options"]');
    check(await visible(page, '#s-options'), 'Options opens from pause');
    const q0 = await Q(page, () => __cv.data.settings.quality);
    await press(page, 'ArrowDown'); await press(page, 'ArrowDown'); await press(page, 'ArrowDown'); await press(page, 'ArrowDown');
    await press(page, 'Enter');
    check(await Q(page, (q) => __cv.data.settings.quality !== q, q0), 'keyboard changes a setting');
    await clickSel(page, '#s-options [data-act="back"]');
    check(await visible(page, '#s-pause'), 'Back returns to pause');
    await clickSel(page, '#s-pause [data-act="resume"]');
    // lose → busted → instant replay
    await Q(page, () => __cv.lose('down'));
    await until(page, () => __cv.G.mode === 'fail', 'losing shows Busted', 15000);
    await shot(page, 'fail');
    await clickSel(page, '#btn-fail-rewind');
    await until(page, () => __cv.G.mode === 'play' && __cv.W.S.phase === 'aim', 'Instant Replay undoes the loss');
    // win → result → next → story → brief 2
    await Q(page, () => __cv.win());
    await until(page, () => __cv.G.mode === 'result', 'winning shows the case-closed screen', 15000);
    check(await Q(page, () => /^[SABC]$/.test(document.querySelector('#grade').textContent)), 'a grade is shown');
    check(await Q(page, () => __cv.data.reached >= 2 && __cv.data.rep > 0), 'progress and Rep are saved');
    await shot(page, 'result');
    // garage
    await clickSel(page, '#s-result [data-act="garage-result"]');
    check(await visible(page, '#s-garage'), 'Garage opens from the result');
    const rep0 = await Q(page, () => __cv.data.rep);
    const bought = await Q(page, () => { const b = [...document.querySelectorAll('#garage-list button')].find((x) => !x.disabled); if (!b) return false; b.click(); return true; });
    check(bought && await Q(page, (r) => __cv.data.rep < r, rep0), 'an upgrade can be bought with Rep');
    await shot(page, 'garage');
    await clickSel(page, '#s-garage [data-act="back"]');
    check(await visible(page, '#s-result'), 'Done returns to the result');
    await clickSel(page, '#btn-next');
    await until(page, () => __cv.G.mode === 'story', 'Next plays the interlude');
    await clickSel(page, '#s-story .skip'); await page.waitForTimeout(200);
    if (await Q(page, () => __cv.G.mode === 'story')) await clickSel(page, '#s-story .skip');
    await until(page, () => __cv.G.mode === 'brief' && __cv.G.briefEp === 2, 'into the Episode 2 briefing');
    // menus from the title
    await Q(page, () => __cv.toTitle());
    for (const [act, id] of [['episodes', 's-episodes'], ['dossier', 's-dossier'], ['howto', 's-howto'], ['garage', 's-garage']]) {
        await clickSel(page, `#s-title [data-act="${act}"]`);
        check(await visible(page, `#${id}`), `${act} opens`);
        if (act === 'episodes') await shot(page, 'episodes');
        if (act === 'dossier') await shot(page, 'dossier');
        await press(page, 'Escape');
        check(await visible(page, '#s-title'), `Escape returns from ${act}`);
    }
}

// ================================================================== every episode
async function episodes() {
    console.log('\n== every episode');
    const { page } = await newPage({ width: 1280, height: 720 }, false, { fast: true });
    for (let ep = 1; ep <= 10; ep++) {
        await Q(page, (e) => { __cv.unlockAll(); __cv.start(e); }, ep);
        await until(page, (e) => __cv.G.mode === 'play' && __cv.W.def.ep === e, `episode ${ep} starts`, 30000, ep);
        const r = await Q(page, () => {
            const W = __cv.W;
            let s = 99 + W.def.ep * 7;
            const rnd = () => ((s = (s * 1103515245 + 12345) >>> 0) / 4294967296);
            const seen = new Set();
            for (let n = 0; n < 14 && W.S.phase === 'aim'; n++) {
                const sh = W.shooters();
                if (!sh.length) break;
                if (n % 4 === 3) W.wait(1.5);
                else {
                    const b = sh[n % sh.length];
                    __cv.shoot(b.id, rnd() * Math.PI * 2, 0.35 + rnd() * 0.6);
                    for (let k = 0; k < 12; k++) W.step(1 / 120);
                    W.ability();
                    for (let k = 0; k < 6; k++) W.step(1 / 120);
                    W.ability();
                }
                __cv.settle(15);
                if (W.S.phase === 'lost') { W.S.phase = 'aim'; W.rewind(); }
            }
            for (const b of W.S.bodies) if (!Number.isFinite(b.x) || !Number.isFinite(b.y)) return { nan: true };
            return { nan: false, phase: W.S.phase, shots: W.S.stats.shots };
        });
        check(!r.nan && r.phase !== 'motion', `episode ${ep} survives random play (${JSON.stringify(r)})`);
        await page.waitForTimeout(600);
        await shot(page, `ep${ep}`);
    }
    // the ending (from a fresh start: the random play above may have left a loss pending)
    await Q(page, () => __cv.start(10));
    await page.waitForTimeout(500);
    await Q(page, () => __cv.win());
    await until(page, () => __cv.G.mode === 'result', 'Episode 10 won', 15000);
    await clickSel(page, '#btn-next');
    await until(page, () => __cv.G.mode === 'story', 'the ending plays');
    await clickSel(page, '#s-story .skip');
    await until(page, () => __cv.G.mode === 'credits', 'then the credits');
    await shot(page, 'credits');
    check(await Q(page, () => __cv.data.finished), 'finishing is saved');
    await clickSel(page, '#s-credits [data-act="title"]');
    await until(page, () => __cv.G.mode === 'title', 'Home returns to the title');
}

// ================================================================== phones
async function phone(w, h) {
    console.log(`\n== touch phone ${w}×${h}`);
    const { page } = await newPage({ width: w, height: h }, true);
    check(await backLinkOk(page), 'back link on top');
    check(await noSideScroll(page), 'no sideways scroll on the title');
    await shot(page, `phone-${w}-title`);
    await page.tap('#s-title [data-act="new"]');
    await until(page, () => __cv.G.mode === 'story', 'tap New Game');
    await page.tap('#s-story .skip'); await page.waitForTimeout(300);
    if (await Q(page, () => __cv.G.mode === 'story')) await page.tap('#s-story .skip');
    await until(page, () => __cv.G.mode === 'brief', 'Skip reaches the briefing');
    check(await noSideScroll(page), 'no sideways scroll on the briefing');
    await page.locator('#btn-go').scrollIntoViewIfNeeded();
    await page.tap('#btn-go');
    await until(page, () => __cv.G.mode === 'play', 'tap Roll Out');
    await page.waitForTimeout(800);
    await shot(page, `phone-${w}-play`);
    const aim = await dragShoot(page, 10, Math.min(w, h) * 0.25, true);
    check(aim.on && aim.power > 0.1, `a touch drag aims (power ${aim.power?.toFixed(2)})`);
    await until(page, () => __cv.W.S.stats.shots === 1, 'lifting the finger shoots');
    const st = await Q(page, () => ({ phase: __cv.W.S.phase, on: !document.querySelector('#b-ability').disabled }));
    const btnOk = st.on;
    check(st.on || st.phase !== 'motion', `ABILITY lights up while rolling (${JSON.stringify(st)})`);
    if (btnOk) {
        await page.tap('#b-ability');
        check(await Q(page, () => __cv.W.crew[0].charges === 1), 'tapping ABILITY fires it');
    }
    await settle(page);
    const small = await Q(page, () => [...document.querySelectorAll('#hud button, #hud .card')].filter((b) => b.offsetParent).map((b) => { const r = b.getBoundingClientRect(); return { id: b.id || b.className, w: r.width, h: r.height }; }).filter((r) => r.w < 44 || r.h < 44));
    check(small.length === 0, `every HUD control ≥ 44 px (${JSON.stringify(small)})`);
    const inside = await Q(page, () => [...document.querySelectorAll('#hud-bot, #hud-tr, #hud-tl')].every((e) => { const r = e.getBoundingClientRect(); return r.left >= -1 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1; }));
    check(inside, 'the HUD fits on screen');
    check(await noSideScroll(page), 'no sideways scroll while playing');
    await page.tap('#b-pause');
    check(await visible(page, '#s-pause'), '❚❚ pauses');
    await shot(page, `phone-${w}-pause`);
}

// ================================================================== storage
async function storage() {
    console.log('\n== localStorage blocked');
    const { page } = await newPage({ width: 1280, height: 720 }, false, { blockStorage: true });
    check(await visible(page, '#s-title'), 'boots to the title');
    await Q(page, () => __cv.start(1));
    await until(page, () => __cv.G.mode === 'play', 'starts an episode');
    await Q(page, () => __cv.win());
    await until(page, () => __cv.G.mode === 'result', 'and can finish it without saving', 15000);
}

try {
    if (!ONLY || ONLY === 'desktop') await desktop();
    if (!ONLY || ONLY === 'episodes') await episodes();
    if (!ONLY || ONLY === 'phones') { await phone(390, 844); await phone(844, 390); }
    if (!ONLY || ONLY === 'storage') await storage();
} catch (e) {
    errors.push(`exception: ${e.stack || e.message}`);
} finally {
    if (browser) await browser.close();
}
const real = errors.filter((e) => !e.startsWith('check:'));
console.log(`\n${fails} failed checks, ${real.length} errors`);
for (const e of real) console.log('  ', e);
process.exit(fails || real.length ? 1 : 0);

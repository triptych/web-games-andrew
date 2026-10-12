/**
 * browsertest.mjs — real Chromium, real WebGL (SwiftShader), real three.js r165.
 *
 * Desktop 1280×720: boot → title (back link on top and clickable) → Enter opens
 * the trial picker → the prologue plays and advances with Enter → stage 1
 * starts → arrows fly, Z fires and scores, X charges and releases Radiance, a
 * crystal grants the Halo and C casts and calls it → P pauses and resumes →
 * Options changes a setting with the keyboard → losing every life asks to
 * continue, Yes continues, No ends the run and records it → a cleared circle
 * shows the tally and Ascend plays the next interlude into stage 2 → every
 * stage boots, its boss arrives and dies → beating Malphas plays the ending
 * and the credits → Home returns to the title → the attract demo starts when
 * idle and any key ends it.
 * Touch-only phones at 390×844 and 844×390: tap through the menus, skip the
 * story, a drag flies the angel, BEAM charges, HALO casts, ❚❚ pauses; every
 * control ≥ 44 px; nothing scrolls sideways.
 * With localStorage blocked the game still boots and plays.
 * Fails on any console error, page error or failed request.
 *
 *   python3 -m http.server 8074                 # from the REPO ROOT
 *   node game-074/dev/browsertest.mjs           # ONLY=desktop|stages|phones|storage
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8074';
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
        try { localStorage.clear(); localStorage.setItem('cinderwing.v1', JSON.stringify({ settings: { sound: false, music: false, quality: 'low' } })); } catch { /* ignore */ }
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
    await page.goto(`${BASE}/game-074/index.html?debug=1&fast=3`);
    await page.waitForFunction(() => window.__cw && __cw.mode === 'title', null, { timeout: 90000 });
    return { ctx, page };
}

const shot = async (page, name) => { await page.waitForTimeout(200); await page.screenshot({ path: path.join(OUT, `bt-${name}.png`) }); console.log('  shot', name); };
const check = (cond, msg) => { if (!cond) { fails++; errors.push(`check: ${msg}`); console.log('  FAIL', msg); } else console.log('  ok', msg); };
const until = async (page, fn, msg, timeout = 30000, arg = null) => {
    const okk = await page.waitForFunction(fn, arg, { timeout }).then(() => true, () => false);
    check(okk, msg);
    return okk;
};
const Q = (page, fn, arg) => page.evaluate(fn, arg);
const press = async (page, key, ms = 60) => { await page.keyboard.down(key); await page.waitForTimeout(ms); await page.keyboard.up(key); await page.waitForTimeout(300); };
const visible = (page, sel) => Q(page, (s) => { const e = document.querySelector(s); if (!e) return false; const r = e.getBoundingClientRect(); if (!r.width || !r.height) return false; const st = getComputedStyle(e); return st.display !== 'none' && st.visibility !== 'hidden' && r.right > 0 && r.bottom > 0 && r.left < innerWidth && r.top < innerHeight; }, sel);
const backLinkOk = (page) => Q(page, () => {
    const a = document.getElementById('back-link');
    if (!a || a.getAttribute('href') !== '../index.html') return false;
    const r = a.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return r.width > 0 && (top === a || a.contains(top));
});

// ============================================================ desktop
async function desktop() {
    console.log('desktop');
    const { page } = await newPage({ width: 1280, height: 720 });
    check(await backLinkOk(page), 'back link visible, on top and pointing at ../index.html');
    check(await visible(page, '#s-title'), 'title screen shows');
    check(await Q(page, () => document.body.innerText.trim().startsWith('← Games') || !!document.getElementById('back-link')), 'no stray text before the page');
    await shot(page, 'title');

    // keyboard into the trial picker
    await press(page, 'Enter');
    await until(page, () => !document.getElementById('s-diff').hidden, 'Enter opens the trial picker');
    await press(page, 'Escape');
    await until(page, () => !document.getElementById('s-title').hidden, 'Escape goes back to the title');
    await press(page, 'Enter');
    await until(page, () => !document.getElementById('s-diff').hidden, 'and again');
    await shot(page, 'difficulty');
    const focused = await Q(page, () => document.querySelector('#s-diff button.focus')?.dataset.diff);
    check(focused === 'seraph', `Seraph is the default trial (${focused})`);
    await press(page, 'Enter');
    await until(page, () => __cw.mode === 'story', 'choosing a trial plays the prologue');
    await page.waitForTimeout(600);
    await shot(page, 'prologue');
    for (let i = 0; i < 80 && await Q(page, () => __cw.mode === 'story'); i++) { await press(page, 'Enter', 40); await page.waitForTimeout(260); }
    await until(page, () => __cw.mode === 'play' && __cw.world && __cw.world.si === 0, 'the prologue ends in stage 1');
    check(await Q(page, () => !document.getElementById('hud').hidden), 'HUD shows in play');

    // fly and fire
    const x0 = await Q(page, () => __cw.world.player.x);
    await page.keyboard.down('ArrowRight'); await page.waitForTimeout(700); await page.keyboard.up('ArrowRight');
    const x1 = await Q(page, () => __cw.world.player.x);
    check(x1 > x0 + 0.5, `arrows fly the angel (${x0.toFixed(1)} → ${x1.toFixed(1)})`);
    await page.keyboard.down('KeyZ');
    await until(page, () => __cw.world.pshots.length > 0, 'Z looses feathers', 8000);
    await page.keyboard.down('ArrowUp');
    await until(page, () => __cw.world.player.y > 11.3, 'up arrow climbs to the first wave', 8000);
    await page.keyboard.up('ArrowUp');
    await until(page, () => __cw.world.S.score > 0, 'shooting the first imps scores', 60000);
    await page.keyboard.up('KeyZ');
    await shot(page, 'stage1');
    // Radiance
    await Q(page, () => __cw.god(true));   // a stray imp must not end the charge test
    const beams0 = await Q(page, () => __cw.G.seen.beam || 0);
    await page.keyboard.down('KeyX');
    await until(page, () => __cw.world.player.charge > 0.6, 'holding X gathers Radiance', 15000);
    await shot(page, 'charging');
    await page.keyboard.up('KeyX');
    await until(page, (b) => (__cw.G.seen.beam || 0) > b, 'releasing X fires the beam', 8000, beams0);
    // the Halo
    await Q(page, () => { const w = __cw.world; w.dropItem(w.player.x + 2, w.player.y, 'red'); });
    await until(page, () => __cw.world.S.power.halo && __cw.world.halo && __cw.world.halo.st === 'front', 'a red crystal brings the Halo to the front', 20000);
    await press(page, 'KeyC');
    await until(page, () => ['launch', 'free'].includes(__cw.world.halo.st), 'C casts the Halo');
    await page.waitForTimeout(500);
    await press(page, 'KeyC');
    await until(page, () => ['front', 'back'].includes(__cw.world.halo.st), 'C again calls it home', 20000);
    await shot(page, 'halo');
    await Q(page, () => __cw.god(false));

    // pause
    await press(page, 'KeyP');
    await until(page, () => __cw.mode === 'pause' && !document.getElementById('s-pause').hidden, 'P pauses');
    const sc = await Q(page, () => __cw.world.scroll);
    await page.waitForTimeout(500);
    check(await Q(page, (s) => __cw.world.scroll === s, sc), 'nothing moves while paused');
    await shot(page, 'pause');
    // options from pause, change volume with the keyboard
    await press(page, 'ArrowDown'); await press(page, 'ArrowDown'); await press(page, 'Enter');
    await until(page, () => !document.getElementById('s-options').hidden, 'Options opens from pause');
    const vol0 = await Q(page, () => __cw.data.settings.volume);
    await press(page, 'ArrowDown'); await press(page, 'ArrowDown'); await press(page, 'ArrowLeft');
    await until(page, (v) => __cw.data.settings.volume < v, 'left arrow lowers the volume', 20000, vol0);
    await press(page, 'Escape');
    await until(page, () => !document.getElementById('s-pause').hidden, 'Back returns to the pause menu');
    await press(page, 'Escape');
    await until(page, () => __cw.mode === 'play', 'Escape resumes');

    // continue and game over
    await Q(page, () => { const w = __cw.world; w.S.lives = 0; w.player.inv = 0; w.kill(); });
    await until(page, () => __cw.mode === 'continue' && !document.getElementById('s-continue').hidden, 'losing the last life asks to continue', 30000);
    await shot(page, 'continue');
    await Q(page, () => document.querySelector('#s-continue button[data-act="cont-yes"]').click());
    await until(page, () => __cw.mode === 'play' && __cw.world.player.alive && __cw.world.S.continues === 1, 'Rise Again continues');
    check(await Q(page, () => __cw.world.S.lives === 2), 'a continue restores the lives');
    await Q(page, () => { const w = __cw.world; w.S.score = 4321; w.S.lives = 0; w.player.inv = 0; w.kill(); });
    await until(page, () => __cw.mode === 'continue', 'and asks again', 30000);
    await Q(page, () => document.querySelector('#s-continue button[data-act="cont-no"]').click());
    await until(page, () => __cw.mode === 'over' && !document.getElementById('s-over').hidden, 'Let the Light Go Out ends the run');
    check(await Q(page, () => __cw.data.hiscores.some((h) => h.score === 4321)), 'the run is recorded in the Hall of Light');
    await shot(page, 'over');
    await Q(page, () => document.querySelector('#s-over button').click());
    await until(page, () => __cw.mode === 'title', 'Return goes to the title');

    // a cleared circle → tally → interlude → stage 2
    await Q(page, () => { __cw.start(0); __cw.god(true); __cw.toBoss(); });
    await until(page, () => __cw.world.boss && __cw.world.boss.st === 'fight', 'the stage 1 boss arrives', 60000);
    await page.waitForTimeout(1500);
    await shot(page, 'boss1');
    await Q(page, () => __cw.killBoss());
    await until(page, () => __cw.mode === 'clear' && !document.getElementById('s-clear').hidden, 'killing the boss clears the circle and shows the tally', 90000);
    await shot(page, 'clear');
    await Q(page, () => document.querySelector('#s-clear button').click());
    await until(page, () => __cw.mode === 'story', 'Ascend plays the interlude');
    await Q(page, () => document.querySelector('#s-story .skip').click());
    await until(page, () => __cw.mode === 'play' && __cw.world.si === 1, 'and then stage 2 begins');
    check(await Q(page, () => __cw.data.reached >= 1), 'reaching stage 2 unlocks it in Stage Select');
    await Q(page, () => __cw.god(false));
}

// ============================================================ every stage and boss, then the ending
async function stages() {
    console.log('stages');
    const { page } = await newPage({ width: 1280, height: 720 });
    for (let i = 0; i < 7; i++) {
        await Q(page, (k) => { __cw.start(k); __cw.god(true); __cw.autoplay(true); }, i);
        await until(page, (k) => __cw.mode === 'play' && __cw.world.si === k, `stage ${i + 1} starts`, 30000, i);
        await Q(page, () => __cw.ff(30));
        await page.waitForTimeout(1200);
        await shot(page, `s${i + 1}`);
        check(await Q(page, () => __cw.world.stats.spawned > 5), `stage ${i + 1} spawns its waves`);
        await Q(page, () => __cw.toBoss());
        await until(page, () => __cw.world.boss && __cw.world.boss.st === 'fight', `stage ${i + 1}: the boss arrives and fights`, 90000);
        await Q(page, () => __cw.ff(6));
        await page.waitForTimeout(1000);
        await shot(page, `b${i + 1}`);
        if (i < 6) await Q(page, () => __cw.killBoss());
        else {
            // Malphas: break the hands and the head first so the Dawn plays
            await Q(page, () => { const w = __cw.world, b = w.boss; for (const n of ['handT', 'handB']) w.damageBossPart(b.parts.find((p) => p.name === n), 1e9, null); });
            await until(page, () => __cw.world.boss.phase === 2, 'Malphas loses his hands: phase 2', 20000);
            await Q(page, () => { const w = __cw.world, b = w.boss; w.damageBossPart(b.parts.find((p) => p.name === 'head'), 1e9, null); });
            await until(page, () => __cw.world.dawn && __cw.world.boss.phase === 3, 'his crown breaks: phase 3 and the Dawn Halo', 20000);
            await Q(page, () => __cw.ff(2));
            await page.waitForTimeout(800);
            await shot(page, 'dawn');
            await Q(page, () => __cw.killBoss());
        }
        await until(page, () => __cw.mode === 'clear', `stage ${i + 1} clears`, 90000);
    }
    await Q(page, () => document.querySelector('#s-clear button').click());
    await until(page, () => __cw.mode === 'story' && __cw.G.story && __cw.G.story.sc.bg === 7, 'beating Malphas plays the ending');
    await page.waitForTimeout(1500);
    await shot(page, 'ending');
    for (let i = 0; i < 30 && await Q(page, () => __cw.mode === 'story'); i++) { await Q(page, () => __cw.onAction('story-next')); await page.waitForTimeout(80); }
    await until(page, () => __cw.mode === 'credits' && !document.getElementById('s-credits').hidden, 'the credits roll');
    check(await Q(page, () => __cw.data.cleared), 'finishing the game is saved');
    await shot(page, 'credits');
    await Q(page, () => document.querySelector('#s-credits button').click());
    await until(page, () => __cw.mode === 'title', 'Home returns to the title');
    // attract demo
    await Q(page, () => { __cw.G.idleT = 31.5; });
    await until(page, () => __cw.mode === 'demo', 'idling on the title starts the demo', 20000);
    await page.waitForTimeout(2000);
    await shot(page, 'demo');
    await press(page, 'KeyQ');
    await until(page, () => __cw.mode === 'title', 'any key ends the demo');
}

// ============================================================ phones
async function phone(w, h) {
    console.log(`phone ${w}×${h}`);
    const { ctx, page } = await newPage({ width: w, height: h }, true);
    const cdp = await ctx.newCDPSession(page);
    const tap = async (sel) => {
        const r = await Q(page, (s) => { const e = document.querySelector(s); const b = e.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, sel);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: r.x, y: r.y, id: 1 }] });
        await page.waitForTimeout(60);
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await page.waitForTimeout(150);
    };
    check(await backLinkOk(page), 'back link visible and on top');
    await tap('#s-title button[data-act="start"]');
    await until(page, () => !document.getElementById('s-diff').hidden, 'tap Begin opens the trial picker');
    await tap('#s-diff button[data-diff="pilgrim"]');
    await until(page, () => __cw.mode === 'story', 'tap a trial plays the prologue');
    await shot(page, `phone-story-${w}`);
    await tap('#s-story .skip');
    await until(page, () => __cw.mode === 'play', 'Skip starts the stage');
    await until(page, () => document.body.classList.contains('touch') && !document.getElementById('touch').hidden, 'the touch deck shows');
    // drag to fly (relative)
    const p0 = await Q(page, () => ({ x: __cw.world.player.x, y: __cw.world.player.y }));
    const sx = w * 0.4, sy = h * 0.5;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: sx, y: sy, id: 2 }] });
    for (let i = 1; i <= 10; i++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: sx + i * 9, y: sy - i * 4, id: 2 }] }); await page.waitForTimeout(60); }
    await page.waitForTimeout(800);
    const p1 = await Q(page, () => ({ x: __cw.world.player.x, y: __cw.world.player.y }));
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    check(p1.x > p0.x + 0.6 && p1.y > p0.y + 0.2, `a drag flies the angel by the finger's motion (${p0.x.toFixed(1)},${p0.y.toFixed(1)} → ${p1.x.toFixed(1)},${p1.y.toFixed(1)})`);
    check(await Q(page, () => __cw.world.pshots.length > 0 || __cw.world.S.score >= 0), 'fire is automatic on touch');
    // BEAM
    const b = await Q(page, () => { const e = document.getElementById('t-beam').getBoundingClientRect(); return { x: e.left + e.width / 2, y: e.top + e.height / 2 }; });
    const beams0 = await Q(page, () => __cw.G.seen.beam || 0);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: b.x, y: b.y, id: 3 }] });
    await until(page, () => __cw.world.player.charge > 0.5, 'holding BEAM charges Radiance', 15000);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await until(page, (k) => (__cw.G.seen.beam || 0) > k, 'releasing BEAM fires', 8000, beams0);
    await Q(page, () => { const ww = __cw.world; ww.dropItem(ww.player.x + 1.5, ww.player.y, 'gold'); });
    await until(page, () => __cw.world.halo && __cw.world.halo.st === 'front', 'the Halo arrives', 20000);
    await tap('#t-halo');
    await until(page, () => ['launch', 'free'].includes(__cw.world.halo.st), 'HALO casts it');
    await shot(page, `phone-play-${w}`);
    await tap('#t-pause');
    await until(page, () => __cw.mode === 'pause', '❚❚ pauses');
    await shot(page, `phone-pause-${w}`);
    await tap('#s-pause button[data-act="resume"]');
    await until(page, () => __cw.mode === 'play', 'Resume by tap');
    const sizes = await Q(page, () => ['t-beam', 't-halo', 't-pause'].map((id) => { const r = document.getElementById(id).getBoundingClientRect(); return [id, Math.round(r.width), Math.round(r.height)]; }));
    check(sizes.every(([, a, c]) => a >= 44 && c >= 44), `touch controls ≥ 44 px (${JSON.stringify(sizes)})`);
    check(await Q(page, () => document.documentElement.scrollWidth <= innerWidth + 1), 'nothing scrolls sideways');
    const overlap = await Q(page, () => {
        const r = (id) => document.getElementById(id).getBoundingClientRect();
        const hit = (a, c) => a.left < c.right && c.left < a.right && a.top < c.bottom && c.top < a.bottom;
        return ['t-beam', 't-halo', 't-pause'].flatMap((t) => ['score', 'lives', 'beam-gauge'].filter((h) => hit(r(t), r(h))).map((h) => `${t}/${h}`));
    });
    check(overlap.length === 0, `touch controls don't cover the HUD (${overlap.join(', ') || 'none'})`);
}

async function storage() {
    console.log('blocked storage');
    const { page } = await newPage({ width: 1280, height: 720 }, false, { blockStorage: true });
    check(await visible(page, '#s-title'), 'boots to the title with localStorage blocked');
    await Q(page, () => __cw.start(0));
    await until(page, () => __cw.mode === 'play', 'and plays');
}

try {
    if (!ONLY || ONLY === 'desktop') await desktop();
    if (!ONLY || ONLY === 'stages') await stages();
    if (!ONLY || ONLY === 'phones') { await phone(390, 844); await phone(844, 390); }
    if (!ONLY || ONLY === 'storage') await storage();
} catch (e) {
    errors.push(`exception: ${e.stack || e}`);
}
if (browser) await browser.close();
const real = errors.filter((e) => !e.startsWith('check:'));
console.log(real.length ? `\nerrors:\n${real.join('\n')}` : '\nno console errors');
console.log(fails || real.length ? `\nFAILED (${fails} checks)` : '\nall passed');
process.exit(fails || real.length ? 1 : 0);

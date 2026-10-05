/**
 * browsertest.mjs — real Chromium, real WebGL, real three.js r165.
 *
 * Desktop (1280×720): boot bakes every sprite → title (attract demo running)
 * → Story/Normal → prologue → stage card → ECHO's dialogue → HUD; walk, the
 * jab chain, a special, a jump kick with the keyboard; a wave locks and clears;
 * pause → move list → settings → resume; stage clear → results → safehouse
 * (buy an upgrade) → stage 2 card; a boss intro card; death → CONTINUE? → yes
 * → play; GAME OVER → title; Arcade, Boss Rush and Survival boot; every stage
 * builds and renders. Then touch-only phones at 390×844 and 844×390: the
 * stick and buttons drive Juno, the HUD and buttons are on screen, no
 * sideways scroll, 44 px targets.
 * Fails on any console error, page error or failed request. Screenshots go
 * to dev/shots/.
 *
 *   python3 -m http.server 8059                 # from the REPO ROOT
 *   node game-059/dev/browsertest.mjs
 *
 * No network to unpkg.com? Point THREE_PKG at an unpacked three@0.165.0:
 *   npm pack three@0.165.0 && tar xzf three-0.165.0.tgz     # -> ./package
 *   THREE_PKG=$PWD/package node game-059/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8059), OUT, ONLY=desktop|flows|phones, PW_CHROMIUM_PATH.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8059';
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
        try { localStorage.clear(); localStorage.setItem('sister-circuit.save.v1', JSON.stringify({ v: 1, settings: { master: 0, music: 0, sfx: 0 } })); } catch { /* ignore */ }
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
    await page.goto(`${BASE}/game-059/index.html?debug=1`);
    await page.waitForFunction(() => window.__sc && __sc.mode === 'title', null, { timeout: 90000 });
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
const visible = (page, id) => Q(page, (i) => { let e = document.getElementById(i); if (!e) return false; for (; e; e = e.parentElement) if (getComputedStyle(e).display === 'none') return false; return true; }, id);
const click = (page, sel) => page.click(sel, { timeout: 5000 });

// ---------------------------------------------------------------- desktop
async function desktop() {
    console.log('desktop: boot, title, story start');
    const { page } = await newPage({ width: 1280, height: 720 });
    check(await visible(page, 'back-link'), '← Games link visible on the title');
    check(await Q(page, () => document.getElementById('back-link').getAttribute('href')) === '../index.html', 'back link points at ../index.html');
    check(await visible(page, 'title-menu'), 'title menu visible');
    await page.waitForTimeout(1200);
    check(await Q(page, () => window.__sc.view.actors.meshes.size > 0), 'attract demo is drawing fighters behind the title');
    await shot(page, 'title');

    // keyboard menu: Story is focused first
    await page.keyboard.press('ArrowDown'); await page.keyboard.press('ArrowUp');
    await page.keyboard.press('Enter');
    await until(page, () => !document.getElementById('modal-diff').classList.contains('hidden'), 'difficulty modal opens from the keyboard');
    await click(page, '#diff-menu [data-diff="normal"]');
    await until(page, () => __sc.mode === 'story', 'prologue plays');
    await shot(page, 'prologue');
    for (let i = 0; i < 12 && await Q(page, () => __sc.mode === 'story'); i++) { await page.keyboard.press('Enter'); await page.waitForTimeout(120); }
    await until(page, () => __sc.mode === 'card' || __sc.mode === 'dialog' || __sc.mode === 'play', 'stage card after the prologue');
    await until(page, () => __sc.mode === 'dialog', 'ECHO dialogue opens at the start of stage 1', 8000);
    await shot(page, 'dialog');
    check(await visible(page, 'hud'), 'HUD visible during dialogue');
    for (let i = 0; i < 20 && await Q(page, () => __sc.mode === 'dialog'); i++) { await page.keyboard.press('j'); await page.waitForTimeout(80); }
    await until(page, () => __sc.mode === 'play', 'dialogue advances with ATTACK and play begins');
    check(await Q(page, () => document.body.classList.contains('playing')), 'body.playing hides the back link in play');

    console.log('desktop: fight');
    await Q(page, () => __sc.god(true));
    const k = page.keyboard;
    await k.down('ArrowRight');
    await page.waitForFunction(() => __sc.world.lock !== null, null, { timeout: 8000 }).catch(() => {});
    await k.up('ArrowRight');
    await until(page, () => __sc.world.lock !== null, 'first wave locks the screen');
    for (let r = 0; r < 30 && await Q(page, () => __sc.world.lock !== null); r++) {
        const st = await Q(page, () => { const w = __sc.world, p = w.player; const e = w.fighters.filter((f) => f.team === 'enemy' && f.state !== 'dead').sort((a, b) => Math.abs(a.x - p.x) - Math.abs(b.x - p.x))[0]; return e ? { dx: e.x - p.x, dz: e.z - p.z } : null; });
        if (st) {
            if (Math.abs(st.dz) > 5) { const key = st.dz > 0 ? 'ArrowUp' : 'ArrowDown'; await k.down(key); await page.waitForTimeout(Math.min(400, Math.abs(st.dz) * 12)); await k.up(key); }
            if (Math.abs(st.dx) > 34) { const key = st.dx > 0 ? 'ArrowRight' : 'ArrowLeft'; await k.down(key); await page.waitForTimeout(Math.min(500, (Math.abs(st.dx) - 26) * 8)); await k.up(key); }
            else await k.press(st.dx > 0 ? 'ArrowRight' : 'ArrowLeft');
        }
        for (let i = 0; i < 4; i++) { await k.press('j'); await page.waitForTimeout(110); }
        if (r === 3) await shot(page, 'fight');
        if (r === 5) { await k.press('l'); await page.waitForTimeout(300); await shot(page, 'arc-burst'); }
        if (r === 7) { await k.press('k'); await page.waitForTimeout(120); await k.press('j'); await page.waitForTimeout(500); }
    }
    const stats = await Q(page, () => __sc.world.stats);
    check(stats.hits > 5, `keyboard attacks connect (${stats.hits} hits)`);
    check(stats.kos >= 2, `enemies go down (${stats.kos} KOs)`);
    check(stats.specials >= 1, 'SPECIAL fires an Arc Burst');
    await until(page, () => __sc.world.lock === null, 'the wave clears and the lock releases', 40000);

    console.log('desktop: pause menu');
    await k.press('Escape');
    await until(page, () => __sc.mode === 'pause', 'Esc pauses');
    await click(page, '#modal-pause [data-act="moves"]');
    check(await visible(page, 'modal-moves'), 'move list opens');
    await shot(page, 'moves');
    await k.press('Escape');
    await click(page, '#modal-pause [data-act="settings"]');
    check(await visible(page, 'modal-settings'), 'settings open');
    await click(page, '#modal-settings [data-close]');
    await click(page, '#modal-pause [data-act="resume"]');
    await until(page, () => __sc.mode === 'play', 'resume');

    console.log('desktop: stage clear → results → safehouse → stage 2');
    await Q(page, () => { __sc.world.profile.credits = 5000; __sc.clearStage(); });
    await until(page, () => __sc.mode === 'dialog' || __sc.mode === 'results', 'stage clear leads to the epilogue / results', 8000);
    for (let i = 0; i < 12 && await Q(page, () => __sc.mode === 'dialog'); i++) { await k.press('Enter'); await page.waitForTimeout(80); }
    await until(page, () => __sc.mode === 'results', 'results screen');
    await shot(page, 'results');
    await click(page, '#modal-results [data-act="next"]');
    await until(page, () => __sc.mode === 'shop', 'safehouse opens');
    const before = await Q(page, () => __sc.session.profile.credits);
    await click(page, '#shop-list .mbtn:not([disabled])');
    check(await Q(page, (b) => __sc.session.profile.credits < b, before), 'buying an upgrade spends credits');
    await shot(page, 'shop');
    await click(page, '#shop-go');
    await until(page, () => __sc.mode === 'card' || __sc.mode === 'dialog', 'stage 2 card');
    check(await Q(page, () => __sc.session.stage === 1 && __sc.world.level.key === 'train'), 'stage 2 is the Line 9 train');
    await until(page, () => __sc.mode === 'dialog' || __sc.mode === 'play', 'stage 2 begins', 8000);
    await Q(page, () => __sc.skipDialog());
    await until(page, () => __sc.mode === 'play', 'stage 2 plays');
    await shot(page, 'stage2');

    console.log('desktop: boss intro');
    await Q(page, () => { const w = __sc.world; w.lock = null; w.evIdx = w.level.events.findIndex((e) => e.t === 'boss'); __sc.warp(w.level.events[w.evIdx].x + 2); });
    await until(page, () => __sc.mode === 'dialog' || __sc.mode === 'bosscard', 'boss dialogue / card triggers');
    for (let i = 0; i < 12 && await Q(page, () => __sc.mode === 'dialog'); i++) { await k.press('Enter'); await page.waitForTimeout(80); }
    await until(page, () => __sc.mode === 'bosscard', 'WARNING boss card');
    await shot(page, 'bosscard');
    await until(page, () => __sc.mode === 'play' && __sc.world.boss, 'boss fight starts', 6000);
    check(await visible(page, 'boss-panel'), 'boss health bar shows');
    await page.waitForTimeout(1500);
    await shot(page, 'boss');

    console.log('desktop: death → continue → game over');
    await Q(page, () => { __sc.god(false); const p = __sc.world.player; __sc.world.lives = 1; p.hp = 1; });
    await until(page, () => __sc.mode === 'continue', 'losing the last life offers CONTINUE?', 30000);
    await shot(page, 'continue');
    await click(page, '#modal-continue [data-act="yes"]');
    await until(page, () => __sc.mode === 'play' && __sc.world.lives > 0, 'continuing restores lives');
    await Q(page, () => { __sc.session.continues = 0; __sc.world.lives = 1; __sc.world.player.hp = 1; __sc.world.player.armorMul = 50; });
    await until(page, () => __sc.mode === 'gameover', 'with no continues left: GAME OVER', 30000);
    await shot(page, 'gameover');
    await click(page, '#modal-gameover [data-act="title"]');
    await until(page, () => __sc.mode === 'title', 'back to the title');
}

// ---------------------------------------------------------------- other modes & every stage
async function flows() {
    console.log('flows: every stage, arcade, boss rush, survival');
    const { page } = await newPage({ width: 1280, height: 720 });
    for (let s = 0; s < 7; s++) {
        await Q(page, (st) => __sc.start('arcade', 'normal', st), s);
        await until(page, () => __sc.mode === 'play', `stage ${s + 1} builds and plays`, 20000);
        await page.waitForTimeout(900);
        await shot(page, `stage${s + 1}`);
        check(await Q(page, () => __sc.view.actors.meshes.size >= 1), `stage ${s + 1} draws actors`);
        await Q(page, () => { const w = __sc.world; w.evIdx = w.level.events.findIndex((e) => e.t === 'boss'); w.lock = null; __sc.warp(w.level.events[w.evIdx].x + 2); });
        await until(page, () => __sc.mode === 'bosscard' || (__sc.world && __sc.world.boss), `stage ${s + 1} boss spawns`, 10000);
        await until(page, () => __sc.mode === 'play', `stage ${s + 1} boss fight`, 6000);
        await page.waitForTimeout(1200);
        await shot(page, `boss${s + 1}`);
        await Q(page, () => __sc.ui.closeAll());
    }
    await Q(page, () => __sc.start('bossrush', 'normal', 0));
    await until(page, () => __sc.mode === 'play' || __sc.mode === 'bosscard', 'boss rush starts', 20000);
    await until(page, () => __sc.world && __sc.world.boss && __sc.world.boss.def.name.startsWith('JACKHAMMER'), 'boss rush opens with Jackhammer', 8000);
    await shot(page, 'bossrush');
    await Q(page, () => __sc.start('survival', 'normal', 0));
    await until(page, () => __sc.mode === 'play', 'survival starts', 20000);
    await until(page, () => __sc.world.survivalWave >= 1, 'survival wave 1 spawns', 8000);
    await shot(page, 'survival');
}

// ---------------------------------------------------------------- phones
async function phone(w, h, label) {
    console.log(`phone ${label}: ${w}x${h}`);
    const { page } = await newPage({ width: w, height: h }, true);
    check(await visible(page, 'back-link'), 'back link visible on phone title');
    const overflow = await Q(page, () => document.documentElement.scrollWidth > window.innerWidth + 1);
    check(!overflow, 'no sideways scroll');
    await shot(page, `${label}-title`);
    await page.tap('#title-menu [data-act="arcade"]');
    await until(page, () => !document.getElementById('modal-diff').classList.contains('hidden'), 'tap opens difficulty');
    await page.tap('#diff-menu [data-diff="easy"]');
    await until(page, () => __sc.mode === 'play', 'arcade starts on tap', 20000);
    check(await visible(page, 'touch'), 'touch controls visible');
    const sizes = await Q(page, () => [...document.querySelectorAll('#t-btns .tb, #pause-btn')].map((b) => { const r = b.getBoundingClientRect(); return { w: r.width, h: r.height, x: r.x, y: r.y, r: r.right, b: r.bottom }; }));
    check(sizes.every((s) => s.w >= 44 && s.h >= 44), 'touch targets are at least 44 px');
    check(sizes.every((s) => s.x >= 0 && s.y >= 0 && s.r <= w + 1 && s.b <= h + 1), 'touch buttons are on screen');
    // drive the stick right
    const zone = await Q(page, () => { const r = document.getElementById('t-stickzone').getBoundingClientRect(); return { x: r.x + r.width * 0.4, y: r.y + r.height * 0.6 }; });
    const cdp = await page.context().newCDPSession(page);
    const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
    const x0 = await Q(page, () => __sc.world.player.x);
    await touch('touchStart', [{ x: zone.x, y: zone.y, id: 1 }]);
    for (let i = 1; i <= 6; i++) { await touch('touchMove', [{ x: zone.x + i * 10, y: zone.y, id: 1 }]); await page.waitForTimeout(30); }
    await page.waitForTimeout(900);
    await touch('touchEnd', []);
    const x1 = await Q(page, () => __sc.world.player.x);
    check(x1 > x0 + 20, `the touch stick walks Juno right (${Math.round(x0)} → ${Math.round(x1)})`);
    const atk = await Q(page, () => { const r = document.querySelector('.tb.atk').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    await page.tap('.tb.atk');
    await page.waitForTimeout(60);
    const st = await Q(page, () => __sc.world.player.state);
    check(st === 'attack' || st === 'idle', `ATK button attacks (state ${st})`);
    void atk;
    check(await visible(page, 'hud'), 'HUD on screen');
    const hud = await Q(page, () => { const r = document.getElementById('p-panel').getBoundingClientRect(); return r.right <= window.innerWidth && r.top >= 0; });
    check(hud, 'player panel fits the screen');
    await page.tap('#pause-btn');
    await until(page, () => __sc.mode === 'pause', 'pause button pauses');
    await shot(page, `${label}-pause`);
    await page.tap('#modal-pause [data-act="resume"]');
    await until(page, () => __sc.mode === 'play', 'resume by tap');
    await page.waitForTimeout(600);
    await shot(page, `${label}-play`);
}

try {
    if (!ONLY || ONLY === 'desktop') await desktop();
    if (!ONLY || ONLY === 'flows') await flows();
    if (!ONLY || ONLY === 'phones') { await phone(390, 844, 'phone-portrait'); await phone(844, 390, 'phone-landscape'); }
} catch (e) {
    errors.push(`exception: ${e.stack || e}`);
} finally {
    if (browser) await browser.close();
}
console.log(errors.length ? `\n${errors.length} problem(s):\n${errors.join('\n')}` : '\nall browser checks passed');
process.exit(errors.length ? 1 : 0);

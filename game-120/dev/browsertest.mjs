/**
 * browsertest.mjs — the real game in real Chromium (SwiftShader WebGL).
 *
 * desktop (1280×760): boot to the title (the attract-mode walker is fighting behind it) with no errors, the
 *   ← Games link on top → Space presses the focused New Game button → story pages → briefing → Deploy → real
 *   key presses walk the walker, the mouse aims it, a mouse click fires, Space jumps, right-click launches a
 *   missile → Escape pauses and the sim stops → Settings opens from the pause menu and Escape closes it with a
 *   slider focused → Save & Quit → Continue restores the game → the hangar: buying an upgrade spends scrap and
 *   grows the walker → deploy → destroyed → retry → the ending after the last boss.
 * high graphics: the bloom, shadow and MSAA path boots without errors.
 * phones (touch only, real CDP touches) at 390×844 and 844×390: taps through story and briefing, the touch deck
 *   appears, the left stick walks, the right stick aims and fires, JUMP and MSL work, controls ≥ 44 px and on
 *   screen, no sideways scroll, the canvas matches the visible viewport, the hangar fits and buys.
 * nostorage: localStorage throws; the game still boots and plays.
 * Fails on any console error, page error or failed request.
 *
 *   python3 -m http.server 8120          # from the REPO ROOT
 *   node game-120/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8120), ONLY=desktop,high,phones,nostorage, THREE_PKG, PW_CHROMIUM_PATH.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8120';
const OUT = path.join(HERE, 'shots');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const want = (name) => !ONLY.length || ONLY.includes(name);
fs.mkdirSync(OUT, { recursive: true });

let fails = 0;
let errors = [];
let browser = null;

async function open(viewport, { touch = false, nostorage = false, q = 'low', fast = 4 } = {}) {
    if (browser) await browser.close();
    browser = await chromium.launch({
        executablePath: process.env.PW_CHROMIUM_PATH || undefined,
        args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
    });
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch });
    await ctx.addInitScript((ns) => {
        if (ns) Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } });
        else try { localStorage.clear(); } catch { /* */ }
    }, nostorage);
    const page = await ctx.newPage();
    if (PKG) {
        // No network to the CDN? Serve the genuine three.js package from disk.
        await page.route('https://unpkg.com/**', (route) => {
            const rel = new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, '');
            const file = path.join(PKG, rel);
            if (!fs.existsSync(file)) return route.abort();
            route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
        });
    }
    await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('requestfailed', (r) => { if (!r.url().includes('favicon')) errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`); });
    await page.goto(`${BASE}/game-120/index.html?debug=1&fast=${fast}&q=${q}`);
    await page.waitForFunction(() => window.__hr && __hr.mode === 'title', null, { timeout: 90000 });
    return page;
}

const check = (cond, msg) => { if (!cond) { fails++; console.log('  FAIL', msg); } else console.log('  ok', msg); return cond; };
const Q = (page, fn, arg) => page.evaluate(fn, arg);
const shot = async (page, name) => { await page.screenshot({ path: path.join(OUT, `bt-${name}.png`), timeout: 120000 }); };
// SwiftShader draws a few frames a second: wait on state, never on the clock.
const until = (page, fn, msg, timeout = 60000, arg = null) =>
    page.waitForFunction(fn, arg, { timeout, polling: 100 }).then(() => check(true, msg), () => check(false, msg));
// Playwright's click() waits for animation frames to settle, which SwiftShader never does; click from inside.
const click = (page, sel) => Q(page, (s) => { const e = document.querySelector(s); if (!e) return false; e.click(); return true; }, sel);
const backLinkOk = (page) => Q(page, () => {
    const a = document.getElementById('back-link');
    if (!a || a.getAttribute('href') !== '../index.html') return false;
    const r = a.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return r.width > 0 && r.top >= 0 && (top === a || a.contains(top));
});
const layout = (page) => Q(page, () => {
    const vv = window.visualViewport;
    const c = document.getElementById('view').getBoundingClientRect();
    return {
        noHScroll: document.documentElement.scrollWidth <= innerWidth + 1,
        canvas: Math.abs(c.width - (vv?.width ?? innerWidth)) < 2 && Math.abs(c.height - (vv?.height ?? innerHeight)) < 2 && c.left === 0 && c.top === 0,
    };
});
const reportErrors = (label) => { check(errors.length === 0, `${label}: no console errors, page errors or failed requests`); for (const e of errors.slice(0, 8)) console.log('    ', e); };
const visible = (page, id) => Q(page, (i) => { const e = document.getElementById(i); return !!e && !e.hidden; }, id);

// ======================================================================
async function desktop() {
    console.log('\n== desktop 1280×760');
    const page = await open({ width: 1280, height: 760 });
    check(await backLinkOk(page), '← Games link is on top and points at ../index.html');
    check(await visible(page, 'title'), 'title screen is up');
    check(await Q(page, () => document.getElementById('btn-continue').hidden), 'no Continue without a save');
    const L = await layout(page);
    check(L.noHScroll && L.canvas, 'no sideways scroll; the canvas fills the window');
    const logo = await Q(page, () => { const h = document.querySelector('#title .logo'), r = document.createRange(); r.selectNodeContents(h); const b = r.getBoundingClientRect(), s = h.closest('.sheet').getBoundingClientRect(); return { right: b.right, sheetRight: s.right, vw: innerWidth, clipped: h.scrollWidth > h.clientWidth + 1 }; });
    check(logo.right <= logo.sheetRight + 1 && logo.right <= logo.vw && !logo.clipped, `the title logo fits (text ends at ${Math.round(logo.right)} px, sheet at ${Math.round(logo.sheetRight)}, window ${logo.vw})`);
    await until(page, () => __hr.G && __hr.G.phase === 'play' && __hr.G.t > 0.5, 'the attract-mode walker is playing behind the title');
    await shot(page, 'desktop-title');

    // Space must press the focused primary button (game-078)
    await page.focus('#title-menu [data-act="new"]');
    await page.keyboard.press('Space');
    await until(page, () => __hr.mode === 'story' && !document.getElementById('story').hidden, 'Space presses the focused New Game button');
    await shot(page, 'desktop-story');
    for (let i = 0; i < 3; i++) { await click(page, '#story-next'); await page.waitForTimeout(150); }
    await click(page, '#story-next');
    await until(page, () => __hr.mode === 'brief' && !document.getElementById('brief').hidden, 'the story leads to the mission briefing');
    await shot(page, 'desktop-brief');
    await click(page, '#brief-go');
    await until(page, () => __hr.mode === 'play' && __hr.G.phase === 'play', 'Deploy starts the mission');
    await Q(page, () => __hr.god());
    await until(page, () => __hr.audio.ctx && __hr.audio.ctx.state === 'running' && __hr.audio.musicSteps > 8, 'the score is playing (the sequencer is running)');
    await until(page, () => __hr.audio.level() > 0.01, 'and it is audible (the master bus carries signal)');
    // colonists dance, then beam out
    const podId = await Q(page, () => __hr.freePod(0));
    await until(page, (id) => { const v = __hr.view.lv.podViews.get(id); return v && v.zapped; }, 'freed colonists dance, then the teleport fires', 90000, podId);
    await until(page, (id) => __hr.view.lv.podViews.get(id).gone && !__hr.view.lv.podViews.get(id).folks.visible, 'and they are gone from the battlefield afterwards', 90000, podId);

    const z0 = await Q(page, () => __hr.G.player.z);
    await page.keyboard.down('KeyW');
    await until(page, (z) => __hr.G.player.z < z - 3, 'holding W walks the walker forward', 60000, z0);
    await page.keyboard.up('KeyW');

    await page.mouse.move(1150, 300);
    await until(page, () => __hr.G.player.yaw > 0.35, 'the mouse aims the walker (it turns to face the cursor)');
    await Q(page, () => { __hr.G.player.missiles = __hr.G.st.msl.ammo; });
    await page.mouse.down();
    await until(page, () => (__hr.seen.shot || 0) > 3, 'holding the left button fires the guns');
    await page.mouse.up();
    // chorded buttons: the right button pressed while the left is held raises no pointerdown, only a pointermove with a new `buttons` mask
    await Q(page, () => { __hr.G.player.missiles = __hr.G.st.msl.ammo; });
    await page.mouse.down();
    await until(page, () => __hr.input.mouse.down, 'the left button is held');
    const used0 = await Q(page, () => __hr.G.st.msl.ammo - __hr.G.player.missiles);
    await page.mouse.down({ button: 'right' });
    await until(page, (u) => __hr.G.st.msl.ammo - __hr.G.player.missiles > u + 0.5 && __hr.input.mouse.down, 'the right button launches rockets while the left is still held (and the guns keep firing)', 60000, used0);
    await page.mouse.up({ button: 'right' });
    await page.mouse.up();
    await page.mouse.click(1150, 300, { button: 'right' });
    await until(page, () => __hr.G.bullets.some((b) => b.kind === 'missile') || __hr.G.player.missiles < __hr.G.st.msl.ammo, 'right-click launches a missile');
    await page.keyboard.press('Space');
    await until(page, () => (__hr.seen.jump || 0) >= 1, 'Space fires the jump jets (the press reaches a sim step)');
    await shot(page, 'desktop-play');

    await page.keyboard.press('Escape');
    await until(page, () => !document.getElementById('pause').hidden, 'Escape pauses');
    const t0 = await Q(page, () => __hr.G.t);
    await page.waitForTimeout(500);
    check(await Q(page, (t) => __hr.G.t === t, t0), 'the sim stops while paused');
    await click(page, '#pause-menu [data-act="settings"]');
    await until(page, () => __hr.ui.top() === 'settings', 'Settings opens on top of the pause menu');
    await page.focus('#set-sfx');
    await page.keyboard.press('Escape');
    await until(page, () => __hr.ui.top() === 'pause', 'Escape closes Settings with a slider focused (game-117)');
    await page.focus('#pause-menu [data-act="resume"]');
    await page.keyboard.press('Space');
    await until(page, () => document.getElementById('pause').hidden, 'Space presses Resume (game-078)');

    await Q(page, () => __hr.ff(8));
    const t1 = await Q(page, () => __hr.G.t);
    await Q(page, () => document.querySelector('#btn-pause').click());
    await until(page, () => !document.getElementById('pause').hidden, 'the ❚❚ button pauses');
    await click(page, '#pause-menu [data-act="quit"]');
    await until(page, () => __hr.mode === 'title' && !document.getElementById('btn-continue').hidden, 'Save & Quit returns to the title with Continue');
    await click(page, '#title-menu [data-act="continue"]');
    await until(page, (t) => __hr.mode === 'play' && Math.abs(__hr.G.t - t) < 0.5 && !document.getElementById('pause').hidden, 'Continue restores the game mid-mission', 60000, t1);
    await click(page, '#pause-menu [data-act="resume"]');

    // the hangar
    await Q(page, () => __hr.hangar());
    await until(page, () => __hr.mode === 'hangar' && !document.getElementById('hangar').hidden, 'a finished mission leads to the hangar');
    await page.waitForTimeout(1200);
    await shot(page, 'desktop-hangar-before');
    const before = await Q(page, () => ({ scrap: __hr.G.scrap, scale: __hr.G.st.scale, n: __hr.G.st.n }));
    await click(page, '#hangar-cards .card:nth-child(1) button');
    await until(page, (b) => __hr.G.scrap < b.scrap && __hr.G.st.scale > b.scale, 'buying an upgrade spends scrap and makes the walker bigger', 60000, before);
    await page.waitForTimeout(1500);
    await shot(page, 'desktop-hangar-after');
    check(await Q(page, () => document.querySelectorAll('#hangar-cards .card').length === 5), 'five upgrade cards');
    await click(page, '#hangar-go');
    await until(page, () => __hr.mode === 'brief' && __hr.G.level === 1, 'Next mission opens the next briefing');
    await click(page, '#brief-go');
    await until(page, () => __hr.mode === 'play', 'and deploys');

    // destroyed, retry
    await Q(page, () => { __hr.G.player.shieldT = 0; __hr.G.player.hp = 1; });
    await Q(page, () => { const e = __hr.G.enemies.find((q) => q.type !== 'pylon'); if (e) { e.x = __hr.G.player.x; e.z = __hr.G.player.z - 6; e.awake = true; } window.__hurt = () => 0; });
    await Q(page, () => { const G = __hr.G; G.player.shieldT = 0; G.player.hp = 0.5; G.bullets.push({ id: 9999, team: 'e', kind: 'bolt', x: G.player.x, y: G.player.y + 2, z: G.player.z, vx: 0, vy: 0, vz: 0.001, dmg: 40, splash: 0, life: 1, r: 1, pierce: 0, grav: 0, tgt: 0, turn: 0, col: 0, hit: null, cluster: 0, fire: 0 }); });
    await until(page, () => __hr.G.phase === 'dead', 'zero armour destroys the walker');
    await until(page, () => !document.getElementById('dead').hidden, 'the game-over screen offers a retry', 60000);
    await shot(page, 'desktop-dead');
    await click(page, '#dead-retry');
    await until(page, () => __hr.mode === 'play' && __hr.G.phase === 'play' && __hr.G.player.hp === __hr.G.st.maxHp, 'Retry restarts the mission with full armour');

    // the last boss ends the game
    await Q(page, () => { __hr.start(2, 5, { guns: 5, missiles: 4, armor: 5, fuel: 4, legs: 5 }); __hr.god(); });
    await Q(page, () => { const A = __hr.G.world.arena, e = __hr.G.enemies.find((q) => q.b); __hr.warp(A.z + 30); e.awake = true; __hr.ff(0.5); e.b.trans = 0; e.b.shield = false; e.hp = 1; __hr.G.player.shieldT = 1e9; });
    await Q(page, () => { const e = __hr.G.enemies.find((q) => q.b); __hr.G.stat.dealt += 0; e.b.trans = 0; e.b.shield = false; e.b.under = false; e.hp = 1; });
    await Q(page, () => { const e = __hr.G.enemies.find((q) => q.b); e.hp = e.maxhp * 0.2; e.b.trans = 0; });
    await Q(page, () => { const e = __hr.G.enemies.find((q) => q.b); e.b.trans = 0; e.b.shield = false; e.hp = 1; e.b.stun = 0; });
    await Q(page, () => __hr.autoplay(true));
    await until(page, () => __hr.G.phase === 'victory' || __hr.G.enemies.every((q) => !q.b || q.b.dying > 0 || q.hp <= 0) || __hr.G.bossDone, 'the Warlord goes down', 120000);
    await Q(page, () => { __hr.autoplay(false); });
    await until(page, () => __hr.G.phase === 'victory', 'the fall of the Warlord is a victory', 120000);
    await Q(page, () => __hr.skip());
    await until(page, () => __hr.mode === 'ending' && !document.getElementById('ending').hidden, 'the ending screen appears', 60000);
    await shot(page, 'desktop-ending');
    check(await Q(page, () => document.querySelectorAll('#ending-text p').length === 3), 'the ending tells its three beats');
    reportErrors('desktop');
}

// ======================================================================
async function high() {
    console.log('\n== high graphics (bloom, shadows, MSAA)');
    const page = await open({ width: 960, height: 600 }, { q: 'high', fast: 1 });
    await Q(page, () => { __hr.start(3, 1, { guns: 2, armor: 2 }); __hr.god(); __hr.ff(6); });
    await until(page, () => __hr.G.t > 6.5 && __hr.mode === 'play', 'boots and plays on the high path');
    const info = await Q(page, () => { const v = __hr.view; return { composer: !!v.composer, shadows: v.renderer.shadowMap.enabled, msaa: v.composer?.renderTarget1?.samples }; });
    check(info.composer && info.shadows && info.msaa === 4, `bloom, shadows and 4x MSAA are on (the composer renders into a multisampled half-float target)`);
    await shot(page, 'high');
    reportErrors('high');
}

// ======================================================================
async function phone(w, h) {
    console.log(`\n== phone ${w}×${h} (touch only)`);
    const page = await open({ width: w, height: h }, { touch: true });
    const cdp = await page.context().newCDPSession(page);
    const touch = (type, x, y, id = 1) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id }] });
    const tapSel = async (sel) => {
        const r = await Q(page, (s) => { const e = document.querySelector(s); e?.scrollIntoView({ block: 'center' }); const b = e?.getBoundingClientRect(); return b && { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, sel);
        if (!r) return false;
        await page.touchscreen.tap(r.x, r.y);
        return true;
    };

    check(await backLinkOk(page), '← Games link is on top');
    const lg = await Q(page, () => { const h = document.querySelector('#title .logo'), r = document.createRange(); r.selectNodeContents(h); return r.getBoundingClientRect().right <= innerWidth; });
    check(lg, 'the title logo fits the phone screen');
    await tapSel('#title-menu [data-act="new"]');
    await until(page, () => __hr.mode === 'story', 'a tap on New Game opens the story');
    await tapSel('#story-skip');
    await until(page, () => __hr.mode === 'brief', 'a tap on Skip leads to the briefing');
    await shot(page, `phone-${w}x${h}-brief`);
    const bsz = await Q(page, () => { const r = document.getElementById('brief-go').getBoundingClientRect(); return r.width >= 44 && r.height >= 44 && r.top >= 0 && r.bottom <= innerHeight; });
    check(bsz, 'Deploy is at least 44 px and on screen');
    await tapSel('#brief-go');
    await until(page, () => __hr.mode === 'play', 'a tap on Deploy starts play');
    await Q(page, () => __hr.god());
    await until(page, () => !document.getElementById('touch').hidden, 'the touch deck is shown before the first stage');

    const L = await layout(page);
    check(L.noHScroll, 'no sideways scroll');
    check(L.canvas, 'the canvas matches the visible viewport');

    const sizes = await Q(page, () => ['#tb-fire', '#tb-msl', '#tb-jump', '#tb-boost', '#btn-pause'].map((s) => {
        const r = document.querySelector(s).getBoundingClientRect();
        return { s, ok: r.width >= 44 && r.height >= 44 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight };
    }));
    for (const z of sizes) check(z.ok, `${z.s} is at least 44 px and on screen`);
    const hud = await Q(page, () => ['#hud-left', '#hud-right', '#radar'].map((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { s, ok: r.left >= 0 && r.right <= innerWidth && r.top >= 0 && r.bottom <= innerHeight }; }));
    for (const z of hud) check(z.ok, `HUD ${z.s} fits the screen`);

    // left stick walks
    const mz = await Q(page, () => { const r = document.getElementById('move-zone').getBoundingClientRect(); return { x: r.left + r.width * 0.4, y: r.top + r.height * 0.6 }; });
    const z0 = await Q(page, () => __hr.G.player.z);
    await touch('touchStart', mz.x, mz.y, 1);
    for (let i = 1; i <= 6; i++) await touch('touchMove', mz.x, mz.y - i * 14, 1);
    await until(page, (z) => __hr.G.player.z < z - 2, 'dragging the left stick walks the walker', 60000, z0);
    await touch('touchEnd', 0, 0, 1);
    // right stick aims and fires
    const az = await Q(page, () => { const r = document.getElementById('aim-zone').getBoundingClientRect(); return { x: r.left + r.width * 0.5, y: r.top + r.height * 0.4 }; });
    const shots0 = await Q(page, () => __hr.seen.shot || 0);
    await touch('touchStart', az.x, az.y, 2);
    for (let i = 1; i <= 6; i++) await touch('touchMove', az.x + i * 12, az.y, 2);
    await until(page, (n) => (__hr.seen.shot || 0) > n + 3 && __hr.G.player.yaw > 0.4, 'dragging the right stick aims and fires', 60000, shots0);
    await touch('touchEnd', 0, 0, 2);
    const jumps = await Q(page, () => __hr.seen.jump || 0);
    await tapSel('#tb-jump');
    await until(page, (n) => (__hr.seen.jump || 0) > n, 'tapping JUMP fires the jump jets', 60000, jumps);
    await Q(page, () => { __hr.G.player.missiles = __hr.G.st.msl.ammo; });
    await tapSel('#tb-msl');
    await until(page, () => __hr.G.bullets.some((b) => b.kind === 'missile') || __hr.G.player.missiles < __hr.G.st.msl.ammo, 'tapping MSL launches a missile');
    await shot(page, `phone-${w}x${h}`);

    await tapSel('#btn-pause');
    await until(page, () => !document.getElementById('pause').hidden, 'tapping ❚❚ pauses');
    await page.waitForTimeout(300);
    check(await visible(page, 'pause'), 'the pause screen stays open after the finger lifts (game-071)');
    await tapSel('#pause-menu [data-act="resume"]');
    await until(page, () => document.getElementById('pause').hidden, 'a tap on Resume closes it');

    // hangar on a phone
    await Q(page, () => __hr.hangar());
    await until(page, () => __hr.mode === 'hangar', 'the hangar opens');
    await page.waitForTimeout(1200);
    await shot(page, `phone-${w}x${h}-hangar`);
    const hs = await Q(page, () => {
        const s = document.querySelector('#hangar .sheet').getBoundingClientRect();
        const btns = [...document.querySelectorAll('#hangar button')].map((b) => { b.scrollIntoView({ block: 'nearest' }); const r = b.getBoundingClientRect(); return r.height >= 43 && r.width >= 43; });
        return { fits: s.left >= 0 && s.right <= innerWidth + 1, tall: btns.every(Boolean) };
    });
    check(hs.fits && hs.tall, 'the hangar panel fits and every button is at least 44 px');
    const sc = await Q(page, () => __hr.G.scrap);
    await tapSel('#hangar-cards .card:nth-child(3) button');
    await until(page, (s) => __hr.G.scrap < s, 'a tap on Upgrade buys it', 60000, sc);
    await tapSel('#hangar-go');
    await until(page, () => __hr.mode === 'brief', 'a tap on Next mission opens the briefing');
    reportErrors(`phone ${w}×${h}`);
}

// ======================================================================
async function nostorage() {
    console.log('\n== blocked storage');
    const page = await open({ width: 1280, height: 760 }, { nostorage: true });
    await Q(page, () => { __hr.start(1, 0); __hr.god(); });
    await until(page, () => __hr.mode === 'play', 'boots and starts a game with localStorage throwing');
    await Q(page, () => __hr.ff(3));
    check(await Q(page, () => __hr.save() === false), 'saving fails quietly');
    reportErrors('nostorage');
}

try {
    if (want('desktop')) await desktop();
    if (want('high')) await high();
    if (want('phones')) { await phone(390, 844); await phone(844, 390); }
    if (want('nostorage')) await nostorage();
} catch (err) {
    fails++;
    console.log('  FAIL threw:', err.message);
} finally {
    if (browser) await browser.close();
}
console.log(`\n${fails ? `${fails} FAILED` : 'all passed'} · screenshots in ${path.relative(process.cwd(), OUT)}`);
process.exit(fails ? 1 : 0);

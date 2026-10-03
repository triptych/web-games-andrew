/**
 * browsertest.mjs — real Chromium, real WebGL, real three.js r165.
 *
 * Desktop 1280×720: title (attract demo renders), How to Play, Options,
 * Codex, a new campaign through difficulty → briefing → level card → play:
 * WASD movement through the real input path, weapon keys, the automap, pause
 * and resume, a data terminal, a pickup, the exit switch and the
 * intermission tally, save + reload + Continue, death and Try again, a
 * guardian kill opening the exit, every theme rendering (not black), Endless
 * Descent, and the ending.
 * Phones (touch only) at 390×844 and 844×390: the menu works by real CDP
 * taps, every control is ≥ 44 px, on screen and clear of the HUD panels,
 * the move stick walks, dragging looks, FIRE shoots.
 * Fails on any console error, page error or failed request.
 *
 *   python3 -m http.server 8054                 # from the REPO ROOT
 *   node game-054/dev/browsertest.mjs
 *
 * No network to unpkg.com? Fetch three.js once; CDN requests are then served
 * from disk (still the genuine r165):
 *   cd game-054/dev && npm pack three@0.165.0 && tar xzf three-0.165.0.tgz
 *
 * Env: BASE (default http://127.0.0.1:8054), ONLY=desktop|phones.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? path.join(HERE, 'package');
const BASE = process.env.BASE ?? 'http://127.0.0.1:8054';
const SEED = +(process.env.SEED ?? (1 + Math.floor(Math.random() * 1e6)));
const URL0 = `${BASE}/game-054/index.html?debug=1&seed=${SEED}`;
console.log(`seed ${SEED} (SEED=${SEED} reproduces this run)`);
const OUT = path.join(HERE, 'shots');
fs.mkdirSync(OUT, { recursive: true });

const errors = [];
let browser = null;
const launch = () => chromium.launch({
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
});

async function newPage(viewport, extra = {}) {
    if (browser) await browser.close();
    browser = await launch();
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, ...extra });
    await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('__cleared')) { localStorage.clear(); sessionStorage.setItem('__cleared', '1'); } } catch { /* ignore */ } });
    const page = await ctx.newPage();
    if (fs.existsSync(PKG)) {
        await page.route('https://unpkg.com/**', (route) => {
            const rel = new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, '');
            const file = path.join(PKG, rel);
            if (!fs.existsSync(file)) return route.abort();
            route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
        });
    }
    // fonts are progressive enhancement; don't depend on the network for them
    await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('requestfailed', (r) => { if (!r.url().includes('favicon')) errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`); });
    return { ctx, page };
}

const shot = async (page, name) => { await page.screenshot({ path: path.join(OUT, `${name}.png`) }); console.log('  shot', name); };
const check = (cond, msg) => { if (!cond) { errors.push(`check: ${msg}`); console.log('  FAIL', msg); } else console.log('  ok', msg); };
const until = async (page, fn, msg, timeout = 90000, arg = null) => {
    const ok = await page.waitForFunction(fn, arg, { timeout }).then(() => true, () => false);
    check(ok, msg);
    return ok;
};
const Q = (page, fn, arg) => page.evaluate(fn, arg);
const visible = (page, id) => Q(page, (id) => { const e = document.getElementById(id); return !!e && !e.hidden && e.getClientRects().length > 0; }, id);
const clickText = async (page, sel, text) => { await page.locator(sel, { hasText: text }).first().click(); };
const state = (page) => Q(page, () => __pe.state());

async function startLevel(page, level, mode = 'campaign') {
    await Q(page, ([l, m]) => __pe.start(1, l, m), [level, mode]);
    await until(page, () => __pe.game.cardReady, `level ${mode} ${level} built`);
    await Q(page, () => __pe.begin());
    await until(page, () => __pe.state() === 'playing', `level ${mode} ${level} playing`);
}

// ------------------------------------------------------------------ Desktop

async function desktop() {
    console.log('desktop 1280×720');
    const { page } = await newPage({ width: 1280, height: 720 });
    await page.goto(URL0);
    await until(page, () => window.__pe && __pe.state() === 'title', 'title screen shows');
    await page.waitForTimeout(800);
    check(await Q(page, () => __pe.brightness()) > 2, 'attract demo renders behind the title');
    await shot(page, 'd_title');

    // menus
    await clickText(page, '#title-menu button', 'How to Play');
    check(await visible(page, 's-help'), 'How to Play opens');
    await page.locator('#s-help [data-back]').click();
    await clickText(page, '#title-menu button', 'Options');
    check(await visible(page, 's-options'), 'Options opens');
    const fov0 = await Q(page, () => __pe.settings.fov);
    await page.locator('#opts input[type=range]').nth(2).fill('95');
    check(await Q(page, () => __pe.settings.fov) === 95 && fov0 !== 95, 'FOV slider changes the setting');
    await page.locator('#s-options [data-back]').click();
    await clickText(page, '#title-menu button', 'Codex');
    check(await Q(page, () => document.querySelectorAll('#codex .cx').length) >= 10, 'Codex lists the bestiary');
    await page.locator('#s-codex [data-back]').click();

    // a new campaign, through the real screens
    await clickText(page, '#title-menu button', 'New Campaign');
    check(await visible(page, 's-difficulty'), 'difficulty select opens');
    await page.locator('.dcard').nth(1).click();
    check(await visible(page, 's-briefing'), 'episode briefing shows');
    await page.waitForTimeout(600);
    await shot(page, 'd_briefing');
    await page.locator('#brief-go').click();
    await until(page, () => __pe.game.cardReady, 'E1M1 built behind the card');
    await shot(page, 'd_card');
    await page.locator('#s-card').click();
    await until(page, () => __pe.state() === 'playing', 'playing E1M1');
    check(await visible(page, 'hud'), 'HUD visible');

    // walk with the keyboard
    const p0 = await Q(page, () => [__pe.player.x, __pe.player.z]);
    // hold W until we've moved (the first frames after a level starts can be slow in SwiftShader)
    await page.keyboard.down('KeyW');
    await until(page, (p) => Math.hypot(__pe.player.x - p[0], __pe.player.z - p[1]) > 0.8, 'W walks', 20000, p0);
    await page.keyboard.up('KeyW');
    await until(page, () => !__pe.input.keys.has('KeyW'), 'W released', 20000);
    // weapons by key
    await page.keyboard.press('Digit1');
    await until(page, () => __pe.weapons.current === 'blade', 'key 1 selects the Arc Blade', 20000);
    await page.keyboard.press('Digit2');
    await until(page, () => __pe.weapons.current === 'pistol', 'key 2 selects the pistol', 20000);
    // shoot
    await until(page, () => __pe.weapons.phase === 'ready', 'pistol raised', 20000);
    const shots0 = await Q(page, () => __pe.S.stats.shots);
    await Q(page, () => { __pe.input.fire = true; });
    await until(page, (s0) => __pe.S.stats.shots > s0, 'holding fire shoots', 20000, shots0);
    await Q(page, () => { __pe.input.fire = false; });
    // automap
    await page.keyboard.press('Tab');
    await until(page, () => !document.getElementById('automap').hidden, 'Tab opens the automap', 20000);
    await page.waitForTimeout(300);
    await shot(page, 'd_automap');
    await page.keyboard.press('Tab');
    await until(page, () => document.getElementById('automap').hidden, 'Tab closes the automap', 20000);
    // pause + resume
    await page.keyboard.press('Escape');
    await until(page, () => __pe.state() === 'paused', 'Esc pauses', 20000);
    check(await visible(page, 's-pause'), 'pause menu visible');
    await clickText(page, '#s-pause button', 'Resume');
    await until(page, () => __pe.state() === 'playing', 'Resume resumes', 20000);

    // a terminal
    const hasTerm = await Q(page, () => {
        const S = __pe.S, t = S.terminals[0];
        if (!t) return false;
        __pe.player.x = t.wx + t.nx * 0.7; __pe.player.z = t.wz + t.nz * 0.7; __pe.player.y = S.L.floor[t.cell];
        __pe.lookAt(t.wx - t.nx * 4, t.wz - t.nz * 4);
        return true;
    });
    if (hasTerm) {
        await page.waitForTimeout(300);
        await page.keyboard.press('KeyE');
        const okLog = await until(page, () => __pe.state() === 'log', 'E reads a data terminal', 20000);
        if (!okLog) console.log('   debug', await Q(page, () => { const t = __pe.S.terminals[0]; return { st: __pe.state(), prompt: __pe.S.usePrompt, p: [__pe.player.x, __pe.player.z], t: [t.wx, t.wz], alive: __pe.player.alive, paused: __pe.S.paused, keys: [...__pe.input.keys], move: __pe.input.move, v: [__pe.player.vx, __pe.player.vz] }; }));
        await page.waitForTimeout(700);
        await shot(page, 'd_log');
        await page.keyboard.press('KeyE');
        await until(page, () => __pe.state() === 'playing', 'E closes the log', 20000);
    }
    // a pickup
    const got = await Q(page, () => {
        const S = __pe.S;
        const p = S.pickups.find((q) => !q.taken && !q.id.startsWith('key_') && !q.id.startsWith('w_'));
        if (!p) return null;
        __pe.player.health = 50;
        const before = S.stats.items;
        __pe.player.x = p.x; __pe.player.z = p.z; __pe.player.y = p.y;
        return { before, id: p.id };
    });
    if (got) {
        await until(page, (b) => __pe.S.stats.items > b, `walking onto a ${got.id} picks it up`, 20000, got.before);
    }
    await shot(page, 'd_play');

    // the exit
    await Q(page, () => { __pe.toExit(); const L = __pe.S.L; __pe.lookAt((L.exit.x - L.exit.nx) * 2, (L.exit.z - L.exit.nz) * 2); });
    await page.waitForTimeout(300);
    await page.keyboard.press('KeyE');
    await until(page, () => __pe.state() === 'intermission', 'E at the exit switch ends the level', 30000);
    await page.waitForTimeout(2500);
    await shot(page, 'd_intermission');
    check(await Q(page, () => JSON.parse(localStorage.getItem('pale-engine-v1')).campaign.level === 1), 'progress saved to level 2');

    // reload and continue
    await page.reload();
    await until(page, () => window.__pe && __pe.state() === 'title', 'title after reload');
    check(await visible(page, 'btn-continue'), 'Continue offered after reload');
    await page.locator('#btn-continue').click();
    await until(page, () => __pe.game.cardReady, 'Continue builds E1M2');
    check(await Q(page, () => document.getElementById('card-id').textContent === 'E1M2'), 'Continue lands on E1M2');
    await page.locator('#s-card').click();
    await until(page, () => __pe.state() === 'playing', 'playing E1M2');

    // death and try again
    await Q(page, () => __pe.S.damagePlayer(999, null, [1, 0, 0]));
    await until(page, () => __pe.state() === 'dead', 'dying shows the death screen', 30000);
    await shot(page, 'd_death');
    await clickText(page, '#s-death button', 'Try again');
    await until(page, () => __pe.game.cardReady, 'Try again rebuilds the level');
    await Q(page, () => __pe.begin());
    await until(page, () => __pe.state() === 'playing' && __pe.player.health >= 100, 'restarted at full health');

    // the guardian on E1M3 seals the exit
    await startLevel(page, 2);
    check(await Q(page, () => !!__pe.S.boss && !__pe.S.exitOpen), 'E1M3 has a guardian and a sealed exit');
    await Q(page, () => { const b = __pe.S.boss; __pe.player.x = b.x; __pe.player.z = b.z + 9; __pe.player.y = b.y; __pe.lookAt(b.x, b.z); b.wake(__pe.player); });
    await page.waitForTimeout(1500);
    await shot(page, 'd_boss');
    await Q(page, () => __pe.killBoss());
    await until(page, () => __pe.S.exitOpen, 'killing the guardian opens the exit', 20000);

    // every theme renders
    for (const lv of [3, 6, 9]) {
        await startLevel(page, lv);
        await page.waitForTimeout(500);
        const b = await Q(page, () => __pe.brightness());
        check(b > 3, `level ${lv + 1} (${await Q(page, () => __pe.S.L.theme)}) renders (brightness ${b.toFixed(1)})`);
        await shot(page, `d_theme_${lv}`);
    }
    // the ending
    await Q(page, () => { __pe.killBoss(); });
    await until(page, () => __pe.S.exitOpen, 'the Archon falls', 20000);
    await Q(page, () => __pe.finish());
    await until(page, () => __pe.state() === 'intermission', 'final intermission', 30000);
    await page.locator('#inter-go').click();
    await until(page, () => __pe.state() === 'ending', 'the ending plays', 20000);
    await page.waitForTimeout(2000);
    await shot(page, 'd_ending');
    await page.locator('#ending-go').click();
    await until(page, () => __pe.state() === 'title', 'back to the title after the ending', 30000);

    // endless descent
    await startLevel(page, 4, 'descent');
    check(await Q(page, () => __pe.S.spec.id === 'D5' && !!__pe.S.boss), 'Descent floor 5 has a guardian');
}

// ------------------------------------------------------------------ Phones

async function phone(w, h) {
    console.log(`phone ${w}×${h}`);
    const { ctx, page } = await newPage({ width: w, height: h }, { hasTouch: true, isMobile: true });
    const cdp = await ctx.newCDPSession(page);
    const tap = async (x, y) => {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
    const tapEl = async (sel) => {
        const r = await page.locator(sel).first().boundingBox();
        const cx = r.x + r.width / 2, cy = r.y + r.height / 2;
        const hit = await Q(page, ([x, y, s]) => { const e = document.elementFromPoint(x, y); return !!e && !!e.closest(s); }, [cx, cy, sel]);
        check(hit, `${sel} is not covered at its centre`);
        await tap(cx, cy);
    };
    await page.goto(URL0);
    await until(page, () => window.__pe && __pe.state() === 'title', 'title (touch)');
    await page.waitForTimeout(500);
    await shot(page, `p_${w}x${h}_title`);
    // menu buttons are big enough and on screen
    const menu = await Q(page, () => [...document.querySelectorAll('#title-menu button:not([hidden])')].map((b) => b.getBoundingClientRect()).map((r) => [r.left, r.top, r.right, r.bottom]));
    check(menu.every(([l, t, r, b]) => b - t >= 44 && l >= 0 && t >= 0 && r <= innerW(w) && b <= h), 'title buttons ≥ 44 px and on screen');
    await tapEl('#title-menu button[data-act="new"]');
    await until(page, () => !document.getElementById('s-difficulty').hidden, 'tap opens difficulty', 20000);
    await tapEl('.dcard');
    await until(page, () => !document.getElementById('s-briefing').hidden, 'tap picks difficulty', 20000);
    await tapEl('#brief-go');
    await until(page, () => __pe.game.cardReady, 'level builds (touch)');
    await tapEl('#s-card');
    await until(page, () => __pe.state() === 'playing', 'tap starts play');
    await page.waitForTimeout(600);
    check(await visible(page, 'touch'), 'touch controls visible');
    // control geometry
    const geo = await Q(page, () => {
        const rect = (e) => { const r = e.getBoundingClientRect(); return [r.left, r.top, r.right, r.bottom]; };
        const btns = [...document.querySelectorAll('#touch .tbtn')].map((b) => ({ id: b.id, r: rect(b) }));
        const panels = [...document.querySelectorAll('#statusbar .sbg, #games-link')].filter((e) => e.getClientRects().length).map((e) => ({ id: e.id || e.className, r: rect(e) }));
        return { btns, panels, w: innerWidth, h: innerHeight };
    });
    const over = (a, b) => a[0] < b[2] && a[2] > b[0] && a[1] < b[3] && a[3] > b[1];
    check(geo.btns.every((b) => b.r[2] - b.r[0] >= 44 && b.r[3] - b.r[1] >= 44), 'every touch control ≥ 44 px');
    check(geo.btns.every((b) => b.r[0] >= 0 && b.r[1] >= 0 && b.r[2] <= geo.w && b.r[3] <= geo.h), 'every touch control on screen');
    const clash = [];
    for (const b of geo.btns) for (const p of geo.panels) if (over(b.r, p.r)) clash.push(`${b.id}×${p.id}`);
    for (let i = 0; i < geo.btns.length; i++) for (let j = i + 1; j < geo.btns.length; j++) if (over(geo.btns[i].r, geo.btns[j].r)) clash.push(`${geo.btns[i].id}×${geo.btns[j].id}`);
    check(!clash.length, `no control overlaps the HUD or another control ${clash.join(' ')}`);
    await shot(page, `p_${w}x${h}_play`);
    // stick walks
    const p0 = await Q(page, () => [__pe.player.x, __pe.player.z]);
    const sx = w * 0.2, sy = h * 0.72;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: sx, y: sy, id: 2 }] });
    for (let k = 1; k <= 6; k++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: sx, y: sy - k * 9, id: 2 }] }); await page.waitForTimeout(40); }
    await page.waitForTimeout(1500);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const p1 = await Q(page, () => [__pe.player.x, __pe.player.z]);
    check(Math.hypot(p1[0] - p0[0], p1[1] - p0[1]) > 0.8, 'the move stick walks');
    // drag looks
    const y0 = await Q(page, () => __pe.player.yaw);
    const lx = w * 0.62, ly = h * 0.4;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: lx, y: ly, id: 3 }] });
    for (let k = 1; k <= 6; k++) { await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: lx + k * 15, y: ly, id: 3 }] }); await page.waitForTimeout(30); }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await page.waitForTimeout(400);
    check(Math.abs((await Q(page, () => __pe.player.yaw)) - y0) > 0.1, 'dragging the right side looks');
    // FIRE shoots
    const s0 = await Q(page, () => __pe.S.stats.shots);
    const fr = await page.locator('#t-fire').boundingBox();
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: fr.x + fr.width / 2, y: fr.y + fr.height / 2, id: 4 }] });
    await page.waitForTimeout(1200);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    check(await Q(page, () => __pe.S.stats.shots) > s0, 'holding FIRE shoots');
    // pause button
    await tapEl('#t-pause');
    await until(page, () => __pe.state() === 'paused', 'the pause button pauses', 20000);
    await shot(page, `p_${w}x${h}_pause`);
}
function innerW(w) { return w; }

try {
    if (process.env.ONLY !== 'phones') await desktop();
    if (process.env.ONLY !== 'desktop') { await phone(390, 844); await phone(844, 390); }
} catch (e) {
    errors.push(`exception: ${e.stack ?? e}`);
} finally {
    if (browser) await browser.close();
}
console.log(errors.length ? `\nFAILED (${errors.length}):\n${errors.join('\n')}` : '\nPASSED');
process.exit(errors.length ? 1 : 0);

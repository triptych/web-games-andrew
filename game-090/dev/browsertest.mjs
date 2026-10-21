/**
 * browsertest.mjs — the real game in real Chromium (SwiftShader WebGL).
 *
 * desktop (1280×760): the title and the ← Games link → New Game with a typed callsign → the
 *   prologue by real Space presses and a choice by click → the station and its buttons → the
 *   Briefing and a deploy → real keys walk the Agent → a battle: the command menu by keyboard, a
 *   target, a skill list, Recode (the terminal, a script), Auto to the reward card → back on the
 *   floor → the menu (Tab) and its tabs → Escape pauses and a real Space presses Resume → Save &
 *   Quit → Continue restores the game. No sideways scroll; the canvas fills the window.
 * phones (touch only, real CDP touches) at 390×844 and 844×390: taps through the menus and the
 *   prologue, the station's buttons, a deploy, the touch deck, the stick moves the Agent, a battle
 *   by tapping the commands and a target, controls ≥ 44 px and on screen.
 * nostorage: localStorage throws; the game still boots and plays.
 * Fails on any console error, page error or failed request.
 *
 *   python3 -m http.server 8090          # from the REPO ROOT
 *   node game-090/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8090), ONLY=desktop,phones,nostorage, THREE_PKG.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8090';
const OUT = path.join(HERE, 'shots');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const want = (name) => !ONLY.length || ONLY.includes(name);
fs.mkdirSync(OUT, { recursive: true });

let fails = 0;
let errors = [];
let browser = null;

async function open(viewport, { touch = false, nostorage = false, q = 0, fast = 6 } = {}) {
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
    await page.goto(`${BASE}/game-090/index.html?debug=1&fast=${fast}&q=${q}`);
    await page.waitForFunction(() => window.__vp && __vp.mode === 'title', null, { timeout: 90000 });
    return page;
}

const check = (cond, msg) => { if (!cond) { fails++; console.log('  FAIL', msg); } else console.log('  ok', msg); return cond; };
const Q = (page, fn, arg) => page.evaluate(fn, arg);
const shot = async (page, name) => { await page.screenshot({ path: path.join(OUT, `bt-${name}.png`) }); };
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
const idle = (page, msg = 'the director is idle', timeout = 60000) => until(page, () => !__vp.busy, msg, timeout);

/** Press Space until the scene reaches a choice or ends; returns when a choice is up. */
async function toChoice(page, press) {
    for (let i = 0; i < 80; i++) {
        const st = await Q(page, () => ({ phase: __vp.G.phase, ch: !!(__vp.G.scene && __vp.G.scene.nodes[__vp.G.scene.i]?.ch), i: __vp.G.scene?.i }));
        if (st.phase !== 'scene' || st.ch) return st;
        await press();
        await page.waitForFunction((i0) => __vp.G.phase !== 'scene' || __vp.G.scene.i !== i0, st.i, { timeout: 15000, polling: 50 }).catch(() => {});
    }
    return null;
}

// ======================================================================
async function desktop() {
    console.log('\n== desktop 1280×760');
    const page = await open({ width: 1280, height: 760 });
    check(await backLinkOk(page), '← Games link is on top and points at ../index.html');
    check(await Q(page, () => !document.getElementById('title').hidden), 'title screen is up');
    check(await Q(page, () => document.getElementById('btn-continue').hidden), 'no Continue without a save');
    const L = await layout(page);
    check(L.noHScroll && L.canvas, 'no sideways scroll; the canvas fills the window');
    await shot(page, 'desktop-title');

    await click(page, '#title-menu [data-act="new"]');
    await until(page, () => !document.getElementById('newgame').hidden, 'New Game opens the registry');
    await page.fill('#hero-name', 'Juniper');
    await shot(page, 'desktop-newgame');
    await click(page, '#btn-start');
    await until(page, () => __vp.mode === 'game' && __vp.G.phase === 'scene' && !document.getElementById('vn').hidden, 'Begin starts the prologue');
    check(await Q(page, () => __vp.G.name === 'Juniper'), 'the typed callsign is the Agent\'s name');
    await idle(page);
    await shot(page, 'desktop-dialogue');

    // the prologue: real Space presses move the text on, Skip jumps to the next choice, answers by click
    for (let i = 0; i < 2; i++) {
        const i0 = await Q(page, () => __vp.G.scene.i);
        // the first press finishes a line that is still typing; the next moves on
        let moved = false;
        for (let k = 0; k < 4 && !moved; k++) {
            await page.keyboard.press('Space');
            moved = await page.waitForFunction((n) => __vp.G.scene.i > n, i0, { timeout: 4000, polling: 50 }).then(() => true, () => false);
        }
        check(moved, `Space advances line ${i0 + 1}`);
    }
    for (let n = 0; n < 8 && await Q(page, () => __vp.G.phase === 'scene'); n++) {
        if (!await Q(page, () => !!__vp.G.scene.nodes[__vp.G.scene.i]?.ch)) await click(page, '#vn-skip');
        await page.waitForFunction(() => __vp.G.phase !== 'scene' || !!__vp.G.scene.nodes[__vp.G.scene.i]?.ch, null, { timeout: 30000 }).catch(() => {});
        if (n === 0) { check(await Q(page, () => !!__vp.G.scene?.nodes[__vp.G.scene.i]?.ch), 'Skip stops at a choice'); await shot(page, 'desktop-choice'); }
        if (await Q(page, () => __vp.G.phase === 'scene')) await click(page, '#vn-choices button');
    }
    await until(page, () => __vp.G.phase === 'hub', 'the prologue ends in the station');
    await idle(page);
    check(await Q(page, () => document.querySelectorAll('#hub-nav .cbtn').length >= 6), 'the station has its buttons');
    await shot(page, 'desktop-hub');

    // the briefing and a deploy
    await click(page, '#hub-nav .cbtn:nth-child(1)');
    await until(page, () => !document.getElementById('panel').hidden && document.querySelector('#panel-sheet .item'), 'the Briefing lists zones');
    await shot(page, 'desktop-briefing');
    await Q(page, () => document.querySelector('#panel-sheet .item').click());
    await until(page, () => !document.getElementById('modal').hidden, 'choosing a zone asks to confirm');
    await Q(page, () => document.querySelector('#modal-sheet .btn.primary').click());
    await until(page, () => __vp.G.phase === 'explore' && !document.getElementById('hud-field').hidden, 'Deploy enters the zone with the field HUD');
    await idle(page);
    await shot(page, 'desktop-explore');

    // walking with real keys
    const p0 = await Q(page, () => ({ ...__vp.G.explore.p }));
    await page.keyboard.down('ArrowRight');
    await page.keyboard.down('ArrowDown');
    await until(page, (p) => Math.hypot(__vp.G.explore.p.x - p.x, __vp.G.explore.p.y - p.y) > 0.4, 'real key presses move the Agent', 60000, p0);
    await page.keyboard.up('ArrowRight');
    await page.keyboard.up('ArrowDown');

    // the menu by Tab
    await page.keyboard.press('Tab');
    await until(page, () => !document.getElementById('panel').hidden, 'Tab opens the menu');
    for (const tab of ['Items', 'Daemons', 'Compendium', 'Story', 'System']) {
        await Q(page, (t) => [...document.querySelectorAll('#panel-sheet .tabs .btn')].find((b) => b.textContent === t)?.click(), tab);
        await page.waitForTimeout(150);
    }
    await shot(page, 'desktop-menu');
    await page.keyboard.press('Escape');
    await until(page, () => document.getElementById('panel').hidden, 'Escape closes the menu');

    // a battle by keyboard
    await Q(page, () => { __vp.recruit('mossling', 'scrapfox'); return __vp.fight(['rustbot', 'mossling', 'hollowtech'], 4); });
    await until(page, () => __vp.view.scene === 'battle' && !__vp.busy && !document.getElementById('cmd').hidden, 'a fight starts and the command menu appears', 90000);
    await shot(page, 'desktop-battle');
    check(await Q(page, () => document.querySelectorAll('#icons .pt').length >= 2), 'Press Turn icons are shown');
    check(await Q(page, () => document.querySelectorAll('#markers .mk').length === 3), 'every foe has a marker');
    await page.keyboard.press('Space');                // Attack
    await until(page, () => !document.getElementById('target-bar').hidden, 'Attack asks for a target');
    await shot(page, 'desktop-target');
    await page.keyboard.press('ArrowRight');
    await page.keyboard.press('Space');
    await until(page, () => __vp.busy, 'the attack plays out');
    await idle(page, 'the round plays out', 90000);
    await until(page, () => !document.getElementById('cmd').hidden || __vp.G.phase !== 'battle', 'the menu returns');
    // the skill list
    if (await Q(page, () => __vp.G.phase === 'battle')) {
        await Q(page, () => [...document.querySelectorAll('#cmd .btn')].find((b) => b.textContent.startsWith('Skill'))?.click());
        await until(page, () => document.querySelectorAll('#cmd .btn.sk').length >= 1, 'the Skill list shows skills');
        await shot(page, 'desktop-skills');
        await page.keyboard.press('Escape');
        await until(page, () => [...document.querySelectorAll('#cmd .btn')].some((b) => b.textContent.startsWith('Recode')), 'Escape goes back to the commands');
        // recode: the terminal
        await Q(page, () => [...document.querySelectorAll('#cmd .btn')].find((b) => b.textContent.startsWith('Recode'))?.click());
        await until(page, () => !document.getElementById('target-bar').hidden, 'Recode asks which Hex');
        await Q(page, () => document.querySelector('#markers .mk.pick .hit')?.click() || document.querySelector('#markers .mk.pick')?.click());
        await idle(page, 'the terminal opens', 90000);
        await until(page, () => !!document.querySelector('.recode .term'), 'the recoding terminal opens');
        await shot(page, 'desktop-recode');
        check(await Q(page, () => document.querySelectorAll('.recode .scripts .btn').length === 4 || document.querySelectorAll('.recode .scripts .btn').length === 2), 'the terminal offers scripts (or a demand)');
        await Q(page, () => document.querySelector('.recode .scripts .btn')?.click());
        await idle(page, 'the exchange plays out', 90000);
    }
    // auto to the end
    await Q(page, () => document.getElementById('b-auto').click());
    await until(page, () => __vp.G.phase === 'reward' && !document.getElementById('reward').hidden, 'Auto plays the fight (recoding included) to the reward card', 300000);
    await shot(page, 'desktop-reward');
    await Q(page, () => document.getElementById('b-auto').click());
    await until(page, () => document.querySelector('#reward-sheet .btn.primary') || __vp.G.pendingLearn.length, 'the reward card has a Continue');
    for (let i = 0; i < 6 && await Q(page, () => __vp.G.pendingLearn.length); i++) await Q(page, () => { document.querySelector('#reward-sheet .btn.mini:last-child')?.click(); });
    await Q(page, () => document.querySelector('#reward-sheet .btn.primary')?.click());
    await until(page, () => __vp.G.phase === 'explore' || __vp.G.phase === 'defeat' || __vp.G.phase === 'scene', 'Continue goes back to the floor');
    await idle(page);

    // pause and resume with real keys
    if (await Q(page, () => __vp.G.phase === 'explore')) {
        await page.keyboard.press('Escape');
        await until(page, () => !document.getElementById('pause').hidden, 'Escape pauses');
        await page.keyboard.press('Space');
        await until(page, () => document.getElementById('pause').hidden, 'a real Space presses Resume');
        await page.keyboard.press('Escape');
        await until(page, () => !document.getElementById('pause').hidden, 'Escape pauses again');
        await click(page, '#pause-menu [data-act="quit"]');
        await until(page, () => __vp.mode === 'title' && !document.getElementById('btn-continue').hidden, 'Save & Quit returns to the title with Continue');
        await click(page, '#title-menu [data-act="continue"]');
        await until(page, () => __vp.mode === 'game' && __vp.G.name === 'Juniper', 'Continue restores the saved game');
        await idle(page);
        await shot(page, 'desktop-continued');
    }
    const L2 = await layout(page);
    check(L2.noHScroll && L2.canvas, 'still no sideways scroll; the canvas still fills the window');
    reportErrors('desktop');
}

// ======================================================================
async function phone(w, h) {
    console.log(`\n== phone ${w}×${h} (touch only)`);
    const page = await open({ width: w, height: h }, { touch: true });
    const cdp = await page.context().newCDPSession(page);
    const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
    const tapSel = async (sel) => {
        const r = await Q(page, (s) => { const e = document.querySelector(s); e?.scrollIntoView({ block: 'center' }); const b = e?.getBoundingClientRect(); return b && { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, sel);
        if (!r) return false;
        await page.touchscreen.tap(r.x, r.y);
        return true;
    };
    const tapText = async (scope, txt) => {
        const r = await Q(page, ([s, t]) => { const e = [...document.querySelectorAll(s)].find((b) => b.textContent.trim().toLowerCase().startsWith(t.toLowerCase())); e?.scrollIntoView({ block: 'center' }); const b = e?.getBoundingClientRect(); return b && { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, [scope, txt]);
        if (!r) return false;
        await page.touchscreen.tap(r.x, r.y);
        return true;
    };

    check(await backLinkOk(page), '← Games link is on top');
    await tapSel('#title-menu [data-act="new"]');
    await until(page, () => !document.getElementById('newgame').hidden, 'a tap on New Game opens the registry');
    await tapSel('#btn-start');
    await until(page, () => __vp.mode === 'game' && __vp.G.phase === 'scene', 'a tap on Begin starts the prologue');
    await idle(page);
    // tap through the prologue
    let guard = 0;
    while ((await Q(page, () => __vp.G.phase)) === 'scene' && guard++ < 120) {
        const ch = await Q(page, () => !!(__vp.G.scene && __vp.G.scene.nodes[__vp.G.scene.i]?.ch));
        const i0 = await Q(page, () => __vp.G.scene?.i);
        if (ch) await tapSel('#vn-choices button'); else await tapSel('#vn .vn-box');
        await page.waitForFunction((i) => __vp.G.phase !== 'scene' || __vp.G.scene.i !== i, i0, { timeout: 10000, polling: 50 }).catch(() => {});
    }
    check(await Q(page, () => __vp.G.phase) === 'hub', 'tapping through the prologue reaches the station');
    await idle(page);
    const sizes = await Q(page, () => [...document.querySelectorAll('#hub-nav .cbtn')].map((b) => { const r = b.getBoundingClientRect(); return { t: b.textContent.slice(0, 10), ok: r.height >= 44 && r.width >= 44 && r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight }; }));
    for (const z of sizes) check(z.ok, `station button ${z.t} is at least 44 px and on screen`);
    const L = await layout(page);
    check(L.noHScroll, 'no sideways scroll');
    check(L.canvas, 'the canvas matches the visible viewport');
    await shot(page, `phone-${w}x${h}-hub`);

    await tapText('#hub-nav .cbtn', 'Briefing');
    await until(page, () => !document.getElementById('panel').hidden && document.querySelector('#panel-sheet .item'), 'a tap on Briefing opens it');
    await shot(page, `phone-${w}x${h}-briefing`);
    check(await Q(page, () => { const r = document.getElementById('panel-sheet').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 1; }), 'the panel fits the screen width');
    await tapSel('#panel-sheet .item');
    await until(page, () => !document.getElementById('modal').hidden, 'a tap on a zone asks to confirm');
    await tapSel('#modal-sheet .btn.primary');
    await until(page, () => __vp.G.phase === 'explore' && !document.getElementById('hud-field').hidden, 'a tap on Deploy enters the zone');
    await until(page, () => !document.getElementById('touch').hidden, 'the touch deck is shown');
    await idle(page);
    const ctl = await Q(page, () => ['#btn-a', '#btn-dash', '#btn-fmenu', '#btn-fparty'].map((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { s, ok: r.width >= 44 && r.height >= 44 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight }; }));
    for (const z of ctl) check(z.ok, `${z.s} is at least 44 px and on screen`);
    await shot(page, `phone-${w}x${h}-explore`);

    // drag the stick with a real touch
    const zone = await Q(page, () => { const r = document.getElementById('stick-zone').getBoundingClientRect(); return { x: r.left + r.width * 0.4, y: r.top + r.height * 0.5 }; });
    const p0 = await Q(page, () => ({ ...__vp.G.explore.p }));
    await touch('touchStart', zone.x, zone.y);
    for (let i = 1; i <= 6; i++) await touch('touchMove', zone.x + i * 12, zone.y);
    await page.waitForTimeout(1200);
    await touch('touchEnd', 0, 0);
    const p1 = await Q(page, () => ({ ...__vp.G.explore.p }));
    check(Math.hypot(p1.x - p0.x, p1.y - p0.y) > 0.3, 'dragging the stick moves the Agent');

    // a battle by tapping
    await Q(page, () => { __vp.recruit('mossling', 'scrapfox'); return __vp.fight(['rustbot', 'mossling'], 4); });
    await until(page, () => __vp.view.scene === 'battle' && !__vp.busy && !document.getElementById('cmd').hidden, 'a fight starts and the commands appear', 90000);
    await shot(page, `phone-${w}x${h}-battle`);
    const bsz = await Q(page, () => [...document.querySelectorAll('#cmd .btn')].map((b) => { const r = b.getBoundingClientRect(); return { t: b.textContent.slice(0, 8), ok: r.height >= 36 && r.left >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1 }; }));
    for (const z of bsz) check(z.ok, `battle button ${z.t} is big enough and on screen`);
    check(await Q(page, () => { const r = document.getElementById('party-cards').getBoundingClientRect(); return r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1; }), 'the party cards fit the screen');
    await tapText('#cmd .btn', 'Attack');
    await until(page, () => !document.getElementById('target-bar').hidden, 'a tap on Attack asks for a target');
    await shot(page, `phone-${w}x${h}-target`);
    await Q(page, () => document.querySelector('#markers .mk.pick .hit')?.scrollIntoView?.());
    const tp = await Q(page, () => { const e = document.querySelector('#markers .mk.pick .hit'); const r = e?.getBoundingClientRect(); return r && { x: r.left + r.width / 2, y: r.top + r.height * 0.3 }; });
    if (tp) await page.touchscreen.tap(tp.x, tp.y);
    await until(page, () => __vp.busy || document.getElementById('target-bar').hidden, 'a tap on a Hex picks it');
    await idle(page, 'the round plays out', 120000);
    reportErrors(`phone ${w}×${h}`);
}

// ======================================================================
async function nostorage() {
    console.log('\n== blocked storage');
    const page = await open({ width: 1280, height: 760 }, { nostorage: true });
    await Q(page, () => __vp.start(5));
    await until(page, () => __vp.mode === 'game' && __vp.G.phase === 'hub', 'boots and starts a game with localStorage throwing');
    await Q(page, () => __vp.deploy('underpass'));
    await until(page, () => __vp.G.phase === 'explore', 'deploys with storage blocked');
    check(await Q(page, () => __vp.save() === false), 'saving fails quietly');
    reportErrors('nostorage');
}

try {
    if (want('desktop')) await desktop();
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

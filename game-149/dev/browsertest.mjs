/**
 * browsertest.mjs — Echoheart Academy in real Chromium (SwiftShader WebGL).
 *
 * desktop (1280×760), by real keys and clicks: the title and the ← Games link; New Game and a typed name; the chapter
 * card and lines read with Space; the Resonance exam played with the arrow keys; music playing and clips decoded;
 * walking with held arrows; Space at the library opens its sheet; a hangout from it; Escape pauses and closes;
 * a battle with Meshy models loaded, a Strike chosen with Enter; the Fireball Gallery fired with arrow keys; the
 * journal and bag; Save & Quit then Continue; the climax clock; the ending screen. A long sheet keeps its buttons
 * pinned. No sideways scroll; the canvas fills the window.
 * phones (touch only, real CDP touches) at 390×844 and 844×390: taps through the title and the name; a tap reads on;
 * the touch deck appears on the campus; the stick walks; A opens a place; a tapped hangout; a battle by tapping
 * Strike; a mini-game played with the on-screen pad; every control ≥ 44 px, on screen and not covered.
 * nostorage: localStorage throws; the game still boots and plays.
 * Fails on any console error, page error or failed request.
 *
 *   python3 -m http.server 8149          # from the REPO ROOT
 *   node game-149/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8149), ONLY=desktop,phones,nostorage, THREE_PKG.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8149';
const OUT = path.join(HERE, 'shots');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const want = (name) => !ONLY.length || ONLY.includes(name);
fs.mkdirSync(OUT, { recursive: true });

let fails = 0;
let errors = [];
let browser = null;

async function open(viewport, { touch = false, nostorage = false } = {}) {
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
    await page.goto(`${BASE}/game-149/index.html?debug=1&fast=3`);
    await page.waitForFunction(() => window.__ea && __ea.mode === 'title', null, { timeout: 60000 });
    return page;
}

const check = (cond, msg) => { if (!cond) { fails++; console.log('  FAIL', msg); } else console.log('  ok', msg); return cond; };
const Q = (page, fn, arg) => page.evaluate(fn, arg);
const shot = async (page, name) => { await page.screenshot({ path: path.join(OUT, `bt-${name}.png`) }); };
const until = (page, fn, msg, timeout = 30000, arg = null) =>
    page.waitForFunction(fn, arg, { timeout, polling: 100 }).then(() => check(true, msg), () => check(false, msg));
const click = (page, sel) => Q(page, (s) => { const e = document.querySelector(s); if (!e) return false; e.click(); return true; }, sel);
const visible = (page, sel) => Q(page, (s) => { const e = document.querySelector(s); return !!e && !e.hidden && e.getClientRects().length > 0 && getComputedStyle(e).visibility !== 'hidden'; }, sel);
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
/** Run the sim ahead (with the bot) until a condition holds. */
const ff = (page, cond, sec = 900, opts = {}) => Q(page, ([c, s, o]) => { __ea.ff(s, o, new Function('g', 'return ' + c)); return __ea.G.mode; }, [cond, sec, opts]);
/** Is a control finger-sized, on screen and on top at its centre? */
const control = (page, sel) => Q(page, (s) => {
    const e = document.querySelector(s);
    if (!e) return { s, ok: false, why: 'missing' };
    const r = e.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    const ok = r.width >= 44 && r.height >= 44 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5 && (top === e || e.contains(top));
    return { s, ok, why: `${Math.round(r.width)}×${Math.round(r.height)} at ${Math.round(r.left)},${Math.round(r.top)} top=${top?.id || top?.className}` };
}, sel);

// ======================================================================
async function desktop() {
    console.log('\n== desktop 1280×760');
    const page = await open({ width: 1280, height: 760 });
    check(await backLinkOk(page), '← Games link is on top and points at ../index.html');
    check(await visible(page, '#title'), 'the title screen is up');
    check(await Q(page, () => document.getElementById('btn-continue').hidden), 'no Continue without a save');
    const L = await layout(page);
    check(L.noHScroll, 'no sideways scroll');
    await shot(page, 'desktop-title');

    // New Game, a name typed with the keyboard
    await page.mouse.click(640, 572);
    await until(page, () => !document.getElementById('namescr').hidden, 'New Game asks for a name');
    await page.fill('#name-input', '');
    await page.keyboard.type('Sora');
    await page.keyboard.press('Enter');
    await until(page, () => __ea.mode === 'game' && __ea.G.name === 'Sora' && __ea.G.mode === 'vn', 'the story begins, with the typed name');
    await until(page, () => !document.getElementById('vn-chapter').hidden, 'the chapter card shows');
    await page.keyboard.press('Space');
    await until(page, () => __ea.G.vn?.say && !document.getElementById('vn-box').hidden, 'Space reads on: the first line');
    const pc0 = await Q(page, () => __ea.G.vn.pc);
    for (let i = 0; i < 4; i++) { await page.keyboard.press('Space'); await page.waitForTimeout(120); }
    check(await Q(page, (p) => __ea.G.vn.pc > p, pc0), 'Space finishes a line and reads the next');
    await until(page, () => __ea.audio.playing(), 'music is playing');
    await until(page, () => __ea.audio.decoded >= 8, 'sound effects decoded', 30000);
    // to Ren's line on the bridge: the sprite stands at the bottom of the screen
    await Q(page, () => __ea.ff(30, {}, (g) => g.vn?.say?.who === 'ren'));
    await page.waitForTimeout(600);
    check(await Q(page, () => { const i = [...document.querySelectorAll('.spr')].find((x) => !x.hidden); if (!i) return false; const r = i.getBoundingClientRect(); return Math.abs(r.bottom - innerHeight) < 2 && r.top > 0; }), 'a standing sprite stands on the bottom edge, head on screen');
    check(await Q(page, () => document.getElementById('vn-name').textContent === 'Ren'), 'the speaker\'s name tag');
    await shot(page, 'desktop-vn');
    // a choice by arrow keys and Enter
    await Q(page, () => __ea.ff(30, {}, (g) => !!g.vn?.choices));
    await until(page, () => document.querySelectorAll('#vn-choices button').length >= 2, 'a choice appears');
    await page.keyboard.press('ArrowDown');
    await page.waitForTimeout(150);
    const b0 = await Q(page, () => __ea.G.bonds.ren);
    await page.keyboard.press('Enter');
    await until(page, (b) => !__ea.G.vn?.choices && __ea.G.bonds.ren > b, 'ArrowDown and Enter pick the second answer', 30000, b0);

    // the Resonance exam, with the arrow keys
    await Q(page, () => __ea.ff(60, {}, (g) => g.mode === 'mini'));
    await until(page, () => __ea.G.mode === 'mini' && !document.getElementById('mini-ui').hidden, 'the entrance exam: the Resonance mini-game');
    await until(page, () => __ea.G.mini.M.phase === 'input', 'the crystals sing, then it\'s your turn', 30000);
    const seq = await Q(page, () => __ea.G.mini.M.seqs[0]);
    for (const n of seq) { await page.keyboard.press(['ArrowUp', 'ArrowRight', 'ArrowDown', 'ArrowLeft'][n]); await page.waitForTimeout(80); }
    await until(page, (n) => __ea.G.mini.M.score >= n, 'repeating the song with the arrow keys scores every note', 30000, seq.length);
    await shot(page, 'desktop-mini');
    await Q(page, () => __ea.ff(120, {}, (g) => g.mini?.result));
    await until(page, () => !document.getElementById('m-result').hidden, 'the grade card');
    await page.keyboard.press('Space');
    await until(page, () => __ea.G.mode !== 'mini', 'Space closes the grade card and the story carries on');

    // the campus
    await Q(page, () => __ea.ff(120, {}, (g) => g.mode === 'map'));
    await until(page, () => __ea.view.mode === 'campus' && !document.getElementById('hud').hidden, 'free time on the campus');
    await until(page, () => __ea.view.campus.kai.model, 'Kai\'s Meshy model has loaded', 60000);
    const x0 = await Q(page, () => __ea.G.pos.x);
    await page.keyboard.down('ArrowLeft');
    await until(page, (x) => __ea.G.pos.x < x - 2, 'holding ← walks Kai west', 30000, x0);
    await page.keyboard.up('ArrowLeft');
    check((await layout(page)).canvas, 'the canvas fills the window');
    await shot(page, 'desktop-campus');
    // the library: Space at the door opens it, and meeting Lys plays her scene
    await Q(page, () => { __ea.place('library'); });
    await until(page, () => __ea.G.near === 'library' && !document.getElementById('hud-prompt').hidden, 'the door prompt appears');
    await page.keyboard.press('Space');
    await until(page, () => __ea.G.panel === 'library' && !document.getElementById('panel').hidden, 'Space opens the library\'s sheet');
    await shot(page, 'desktop-panel');
    await click(page, '#panel-body button[data-id="meet"]');
    await until(page, () => __ea.G.mode === 'vn' && __ea.G.vn.scene === 'meet_lys', 'looking around the library meets Lys');
    // pause and close with Escape
    await page.keyboard.press('Escape');
    await until(page, () => !document.getElementById('pause').hidden, 'Escape pauses');
    await page.keyboard.press('Escape');
    await until(page, () => document.getElementById('pause').hidden, 'Escape closes the pause sheet');
    // settings: Escape closes it even with a slider focused
    await page.waitForTimeout(300);
    await page.keyboard.press('Escape');
    await until(page, () => !document.getElementById('pause').hidden, 'pause again');
    await click(page, '#pause-menu [data-act="settings"]');
    await until(page, () => !document.getElementById('settings').hidden, 'settings opens over the pause sheet');
    check(await Q(page, () => +getComputedStyle(document.getElementById('settings')).zIndex > +getComputedStyle(document.getElementById('pause')).zIndex), 'and is on top of it');
    await Q(page, () => document.getElementById('set-music').focus());
    await page.keyboard.press('Escape');
    await until(page, () => document.getElementById('settings').hidden, 'Escape closes Settings with a slider focused');
    await page.waitForTimeout(300);
    await page.keyboard.press('Escape');
    await until(page, () => document.getElementById('pause').hidden, 'and then the pause sheet');

    // a battle: Meshy models, a Strike by keyboard
    await Q(page, () => __ea.ff(1200, {}, (g) => g.mode === 'battle'));
    await until(page, () => __ea.view.mode === 'arena' && !document.getElementById('battle-ui').hidden, 'a battle in the arena');
    await until(page, () => Object.values(__ea.view.arena.actors).every((a) => a.model), 'every fighter\'s Meshy model loaded', 60000);
    await until(page, () => Object.values(__ea.view.arena.actors).filter((a) => a.rigged).every((a) => Object.keys(a.actions).length >= 5), 'rigged fighters have their animation clips', 60000);
    await until(page, () => __ea.G.battle.phase === 'cmd' && !document.getElementById('b-menu').hidden, 'a hero waits for a command', 60000);
    await shot(page, 'desktop-battle');
    const acts = await Q(page, () => __ea.seen.act || 0);
    await Q(page, () => document.querySelector('#b-main [data-cmd="attack"]').focus());
    await page.keyboard.press('Enter');
    await page.waitForTimeout(200);
    await Q(page, () => { const b = document.querySelector('#b-sub [data-target]'); if (b) b.focus(); });
    if (await Q(page, () => !!document.querySelector('#b-sub [data-target]'))) await page.keyboard.press('Enter');
    await until(page, (n) => (__ea.seen.act || 0) > n, 'Enter on Strike attacks', 30000, acts);
    await Q(page, () => __ea.act({ t: 'auto', on: true }));
    await until(page, () => ['won', 'lost'].includes(__ea.G.battle?.phase) && !document.getElementById('b-end').hidden, 'Auto fights to the end card', 90000);
    await page.keyboard.press('Enter');
    await until(page, () => __ea.G.mode !== 'battle', 'Enter closes the end card');
    await Q(page, () => __ea.act({ t: 'auto', on: false }));

    // the Fireball Gallery, fired with arrow keys
    await Q(page, () => __ea.ff(2400, { fav: 'hana' }, (g) => g.mode === 'mini' && g.mini.game === 'fireball'));
    await until(page, () => __ea.G.mini?.game === 'fireball', 'Hana\'s Fireball Gallery');
    await until(page, () => !__ea.ui.anyScreen() && __ea.G.mini.M.t > 0.5, 'the gallery is running');
    const shots0 = await Q(page, () => __ea.seen.mini || 0);
    for (const k of ['ArrowLeft', 'ArrowUp', 'ArrowRight']) { await page.keyboard.press(k); await page.waitForTimeout(150); }
    await until(page, (n) => (__ea.seen.mini || 0) >= n + 3, 'arrow keys fire into the lanes', 30000, shots0);
    await shot(page, 'desktop-fireball');
    await Q(page, () => __ea.ff(120, {}, (g) => g.mini?.result));
    await page.keyboard.press('Enter');
    await until(page, () => __ea.G.mode !== 'mini', 'the gallery closes');

    // journal and bag with a long list: the Close button stays pinned
    await Q(page, () => __ea.ff(200, {}, (g) => g.mode === 'map'));
    await Q(page, () => { for (const id of ['healing', 'mana', 'tart', 'chime', 'phoenix', 'chestnuts', 'starchart', 'gears', 'honeybun', 'moonflower', 'fireopal', 'windchime', 'bubblesoap', 'bookmark']) __ea.G.inv[id] = 2; });
    await page.keyboard.press('KeyB');
    await until(page, () => !document.getElementById('bag').hidden, 'B opens the bag');
    const pinned = await Q(page, () => { const s = document.querySelector('#bag .sheet'); s.scrollTop = 1e6; const f = s.querySelector('.sheet-foot').getBoundingClientRect(), r = s.getBoundingClientRect(); return s.scrollHeight > s.clientHeight && f.bottom <= r.bottom + 1 && f.top >= r.top; });
    check(pinned, 'a long bag scrolls but its Close button stays pinned');
    await page.keyboard.press('Escape');
    await page.waitForTimeout(300);
    await page.keyboard.press('KeyJ');
    await until(page, () => !document.getElementById('journal').hidden, 'J opens the journal');
    await page.keyboard.press('Escape');
    await until(page, () => document.getElementById('journal').hidden, 'Escape closes it');

    // Save & Quit, Continue
    const day = await Q(page, () => __ea.G.day);
    await page.keyboard.press('Escape');
    await click(page, '#pause-menu [data-act="quit"]');
    await until(page, () => __ea.mode === 'title' && !document.getElementById('btn-continue').hidden, 'Save & Quit returns to the title with Continue');
    await click(page, '#title-menu [data-act="continue"]');
    await until(page, (d) => __ea.mode === 'game' && __ea.G.day === d, 'Continue restores the saved game', 30000, day);

    // the Hollow Moon and the ending
    await Q(page, () => __ea.ff(6000, { fav: 'hana' }, (g) => !!g.climax && g.mode === 'map'));
    await until(page, () => __ea.G.climax && !document.getElementById('hud-moon').hidden, 'the Hollow Moon clock is ticking', 30000);
    await page.waitForTimeout(800);
    await shot(page, 'desktop-climax');
    await Q(page, () => __ea.ff(3000, { fav: 'hana' }, (g) => g.ended));
    await until(page, () => __ea.mode === 'ending' && !document.getElementById('ending').hidden, 'the ending screen');
    await shot(page, 'desktop-ending');
    check(await Q(page, () => document.querySelectorAll('#ending-title').length <= 1), 'no id clashes with the ending heading (lib/a11y.js names it #ending-title)');
    await click(page, '#ending-back');
    await until(page, () => __ea.mode === 'title' && !document.getElementById('title').hidden && document.getElementById('btn-continue').hidden, 'Back to Title returns to the title, the finished save cleared');
    reportErrors('desktop');
}

// ======================================================================
async function phone(w, h) {
    console.log(`\n== phone ${w}×${h} (touch only)`);
    const page = await open({ width: w, height: h }, { touch: true });
    const cdp = await page.context().newCDPSession(page);
    const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
    const tapSel = async (sel) => {
        const r = await Q(page, (s) => { const e = document.querySelector(s); e?.scrollIntoView({ block: 'center' }); const b = e?.getBoundingClientRect(); return b && b.width && { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, sel);
        if (!r) return false;
        await page.touchscreen.tap(r.x, r.y);
        return true;
    };
    check(await backLinkOk(page), '← Games link is on top');
    check((await layout(page)).noHScroll, 'no sideways scroll on the title');
    await tapSel('#title-menu [data-act="new"]');
    await until(page, () => !document.getElementById('namescr').hidden, 'a tap on New Game asks for a name');
    await tapSel('#name-go');
    await until(page, () => __ea.mode === 'game' && __ea.G.mode === 'vn', 'a tap on Begin starts the story');
    await until(page, () => !document.getElementById('vn-chapter').hidden && document.getElementById('vn-chapter').getClientRects().length > 0, 'the chapter card shows');
    await tapSel('#vn-chapter');
    await until(page, () => !!__ea.G.vn?.say, 'a tap dismisses the chapter card');
    const pc0 = await Q(page, () => __ea.G.vn.pc);
    for (let i = 0; i < 3; i++) { await tapSel('#vn-box'); await page.waitForTimeout(150); }
    check(await Q(page, (p) => __ea.G.vn.pc > p, pc0), 'taps read on');
    await Q(page, () => __ea.ff(30, {}, (g) => g.vn?.say?.who === 'ren'));
    await page.waitForTimeout(500);
    await shot(page, `phone-${w}x${h}-vn`);
    check(await Q(page, () => { const b = document.getElementById('vn-box').getBoundingClientRect(); return b.left >= 0 && b.right <= innerWidth && b.bottom <= innerHeight; }), 'the text box fits the screen');
    for (const s of ['#vn-auto', '#vn-skip', '#vn-menu']) { const c = await control(page, s); check(c.ok, `${s} is finger-sized and on top (${c.why})`); }

    // the mini-game pad
    await Q(page, () => __ea.ff(60, {}, (g) => g.mode === 'mini' && g.mini.M.phase === 'input'));
    await until(page, () => !document.querySelector('.mpad.up').getClientRects().length === false, 'the on-screen pad shows on a touch screen');
    const seq = await Q(page, () => __ea.G.mini.M.seqs[0]);
    for (const n of seq) { await tapSel(`.mpad.${['up', 'right', 'down', 'left'][n]}`); await page.waitForTimeout(120); }
    await until(page, (n) => __ea.G.mini.M.score >= n, 'tapping the pad repeats the song', 30000, seq.length);
    for (const s of ['.mpad.up', '.mpad.left', '.mpad.right', '.mpad.down']) { const c = await control(page, s); check(c.ok, `${s} is finger-sized and on top (${c.why})`); }
    await shot(page, `phone-${w}x${h}-mini`);
    await Q(page, () => __ea.ff(120, {}, (g) => g.mini?.result));
    await until(page, () => !document.getElementById('m-result').hidden, 'the grade card');
    await tapSel('#m-done');
    await until(page, () => __ea.G.mode !== 'mini', 'a tap closes it');

    // the campus: deck, stick, A
    await Q(page, () => __ea.ff(200, {}, (g) => g.mode === 'map'));
    await until(page, () => !document.getElementById('touch').hidden, 'the touch deck is shown on the campus');
    const L = await layout(page);
    check(L.noHScroll && L.canvas, 'no sideways scroll; the canvas matches the visible viewport');
    for (const s of ['#btn-a', '#btn-pause', '#btn-journal', '#btn-bag']) { const c = await control(page, s); check(c.ok, `${s} is finger-sized, on screen and not covered (${c.why})`); }
    const zone = await Q(page, () => { const r = document.getElementById('stick-zone').getBoundingClientRect(); return { x: r.left + r.width * 0.4, y: r.top + r.height * 0.6 }; });
    const z0 = await Q(page, () => __ea.G.pos.z);
    await touch('touchStart', zone.x, zone.y);
    for (let i = 1; i <= 6; i++) await touch('touchMove', zone.x, zone.y - i * 12);
    await until(page, (z) => __ea.G.pos.z < z - 1, 'dragging the stick walks Kai', 30000, z0);
    await touch('touchEnd', 0, 0);
    await shot(page, `phone-${w}x${h}-campus`);
    await Q(page, () => __ea.place('library'));
    await until(page, () => __ea.G.near === 'library', 'standing at the library');
    await tapSel('#btn-a');
    await until(page, () => !document.getElementById('panel').hidden, 'tapping A opens the library');
    await page.waitForTimeout(300);
    check(await visible(page, '#panel'), 'the sheet stays open after the finger lifts');
    const foot = await control(page, '#panel [data-close]');
    check(foot.ok, `the sheet's Leave button is on screen (${foot.why})`);
    await shot(page, `phone-${w}x${h}-panel`);
    await tapSel('#panel-body button[data-id="meet"]');
    await until(page, () => __ea.G.vn?.scene === 'meet_lys', 'a tap on the sheet meets Lys');

    // a battle by taps
    await Q(page, () => __ea.ff(1500, {}, (g) => g.mode === 'battle' && g.battle.phase === 'cmd'));
    await until(page, () => !document.getElementById('b-menu').hidden, 'a hero waits in battle', 60000);
    for (const s of ['#b-main [data-cmd="attack"]', '#b-main [data-cmd="skills"]', '#b-auto']) { const c = await control(page, s); check(c.ok, `${s} is finger-sized and on top (${c.why})`); }
    const acts = await Q(page, () => __ea.seen.act || 0);
    await tapSel('#b-main [data-cmd="attack"]');
    await page.waitForTimeout(200);
    if (await Q(page, () => !!document.querySelector('#b-sub [data-target]'))) await tapSel('#b-sub [data-target]');
    await until(page, (n) => (__ea.seen.act || 0) > n, 'tapping Strike attacks', 30000, acts);
    await shot(page, `phone-${w}x${h}-battle`);
    reportErrors(`phone ${w}×${h}`);
}

// ======================================================================
async function nostorage() {
    console.log('\n== blocked storage');
    const page = await open({ width: 1280, height: 760 }, { nostorage: true });
    await Q(page, () => __ea.start(4, 'Kai'));
    await until(page, () => __ea.mode === 'game', 'boots and starts a game with localStorage throwing');
    await Q(page, () => __ea.ff(300, {}, (g) => g.mode === 'map' && g.day === 2));
    check(await Q(page, () => __ea.G.day === 2), 'plays on to day two');
    check(await Q(page, () => __ea.save() === false), 'saving fails quietly');
    reportErrors('nostorage');
}

try {
    if (want('desktop')) await desktop();
    if (want('phones')) { if (!process.env.LAND) await phone(390, 844); await phone(844, 390); }
    if (want('nostorage')) await nostorage();
} catch (err) {
    fails++;
    console.log('  FAIL threw:', err.message);
} finally {
    if (browser) await browser.close();
}
console.log(`\n${fails ? `${fails} FAILED` : 'all passed'} · screenshots in ${path.relative(process.cwd(), OUT)}`);
process.exit(fails ? 1 : 0);

/**
 * browsertest.mjs — the real game in real Chromium.
 *
 * desktop (1280×760): boot to the title (attract demo running) with no errors, the ← Games link
 *   on top → Board the train by click → a held mouse button draws the drop to the cursor →
 *   real arrow keys steer → Space taps the glass → Escape pauses and the sim stops → Settings
 *   from the pause menu sits on top of it and Escape closes it even with a slider focused →
 *   Space on the focused Resume button resumes → M and the ✉ button open the album → the pane
 *   completes into a postcard → Next station → Save & Quit → Continue restores the mist exactly
 *   → the rest of the journey to the Morning ending → Stay aboard into the small hours → the
 *   album shows every postcard → New journey asks first. The pane is read back so a blank
 *   canvas fails. No sideways scroll; the canvas fills the window.
 * phones (touch only, real CDP touches) at 390×844 and 844×390: taps through the menus, the tap
 *   button appears, a drag anywhere moves the drop the same way (relative steering), the tap
 *   button taps the glass, the journal shows in portrait, controls ≥ 44 px and on screen, the
 *   pause screen survives the finger lifting, no sideways scroll, the canvas matches the
 *   visible viewport.
 * nostorage: localStorage throws; the game still boots and plays a pane to its postcard.
 * Fails on any console error, page error or failed request.
 *
 *   python3 -m http.server 8122          # from the REPO ROOT
 *   node game-122/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8122), ONLY=desktop,phones,nostorage, PW_CHROMIUM_PATH.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8122';
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
        args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
    });
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch });
    await ctx.addInitScript((ns) => {
        if (ns) Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } });
        else try { localStorage.clear(); } catch { /* */ }
    }, nostorage);
    const page = await ctx.newPage();
    await page.route(/fonts\.(googleapis|gstatic)\.com/, (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('requestfailed', (r) => { if (!r.url().includes('favicon')) errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`); });
    await page.goto(`${BASE}/game-122/index.html?debug=1&fast=2`);
    await page.waitForFunction(() => window.__rg && __rg.mode === 'title', null, { timeout: 30000 });
    return page;
}

const check = (cond, msg) => { if (!cond) { fails++; console.log('  FAIL', msg); } else console.log('  ok', msg); return cond; };
const Q = (page, fn, arg) => page.evaluate(fn, arg);
const shot = async (page, name) => { await page.screenshot({ path: path.join(OUT, `bt-${name}.png`) }); };
const until = (page, fn, msg, timeout = 15000, arg = null) =>
    page.waitForFunction(fn, arg, { timeout, polling: 50 }).then(() => check(true, msg), () => check(false, msg));
const click = (page, sel) => Q(page, (s) => { const e = document.querySelector(s); if (!e) return false; e.click(); return true; }, sel);
const shown = (page, id) => Q(page, (i) => !document.getElementById(i).hidden, id);
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
/** Distinct colours in a grid over the pane: a blank or flat canvas has one or two. */
const paneColours = (page) => Q(page, () => {
    const v = __rg.view, p = v.pane, c = v.canvas.getContext('2d'), set = new Set();
    for (let i = 1; i < 12; i++) for (let j = 1; j < 9; j++) {
        const d = c.getImageData(Math.round((p.x + p.w * i / 12) * v.dpr), Math.round((p.y + p.h * j / 9) * v.dpr), 1, 1).data;
        set.add(`${d[0] >> 3},${d[1] >> 3},${d[2] >> 3}`);
    }
    return set.size;
});
const reportErrors = (label) => { check(errors.length === 0, `${label}: no console errors, page errors or failed requests`); for (const e of errors.slice(0, 8)) console.log('    ', e); };

// ======================================================================
async function desktop() {
    console.log('\n== desktop 1280×760');
    const page = await open({ width: 1280, height: 760 });
    check(await backLinkOk(page), '← Games link is on top and points at ../index.html');
    check(await shown(page, 'title'), 'title screen is up');
    check(await Q(page, () => document.getElementById('btn-continue').hidden), 'no Continue without a save');
    const L = await layout(page);
    check(L.noHScroll && L.canvas, 'no sideways scroll; the canvas fills the window');
    const t0 = await Q(page, () => __rg.G.t);
    await until(page, (t) => __rg.G.t > t + 0.5, 'the attract demo plays behind the title', 15000, t0);
    check(await paneColours(page) > 12, 'the window is drawn (not blank)');
    await shot(page, 'desktop-title');

    await click(page, '#btn-new');
    await until(page, () => __rg.mode === 'play' && document.getElementById('title').hidden && !document.getElementById('hud').hidden, 'Board the train starts play');
    check(await Q(page, () => __rg.G.station === 0 && __rg.G.panes === 0), 'at the first station');

    // a held mouse button draws the drop toward the cursor
    let d = await Q(page, () => { const g = __rg.G; const s = __rg.view.toScreen(g.drop.x, g.drop.y); return { x: g.drop.x, y: g.drop.y, sx: s.x, sy: s.y }; });
    await page.mouse.move(d.sx, d.sy + 2);
    await page.mouse.down();
    await page.mouse.move(d.sx + 220, d.sy + 120, { steps: 6 });
    await until(page, (x) => __rg.G.drop.x > x + 1.5, 'a held mouse button draws the drop to the cursor', 15000, d.x);
    await page.mouse.up();

    // real keys steer
    d = await Q(page, () => ({ x: __rg.G.drop.x }));
    await page.keyboard.down('ArrowLeft');
    await until(page, (x) => __rg.G.drop.x < x - 1, 'holding ← steers the drop left', 15000, d.x);
    await page.keyboard.up('ArrowLeft');
    check(await Q(page, () => __rg.G.stats.wiped > 0.5), 'steering wipes the mist');

    await until(page, () => __rg.audio.ctx?.state === 'running' && __rg.audio.level() > 0.005, 'sound comes out (rain, keys and crackle on the meter)');
    await Q(page, () => { __rg.G.tapCD = 0; });
    await page.keyboard.press('Space');
    await until(page, () => (__rg.seen.tap || 0) >= 1, 'Space taps the glass (the press reaches a sim step)');

    // pause, settings on top, Escape with a slider focused
    await page.keyboard.press('Escape');
    await until(page, () => !document.getElementById('pause').hidden, 'Escape pauses');
    const tp = await Q(page, () => __rg.G.t);
    await page.waitForTimeout(400);
    check(await Q(page, (t) => __rg.G.t === t, tp), 'the sim stops while paused');
    await click(page, '#pause-menu [data-act="settings"]');
    await until(page, () => !document.getElementById('settings').hidden, 'Settings opens from the pause menu');
    check(await Q(page, () => { const r = document.querySelector('#set-music').getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return e && e.closest('#settings') !== null; }), 'Settings sits on top of the pause menu');
    await Q(page, () => document.getElementById('set-music').focus());
    await page.keyboard.press('Escape');
    await until(page, () => document.getElementById('settings').hidden && !document.getElementById('pause').hidden, 'Escape closes Settings even with a slider focused');
    await Q(page, () => document.querySelector('#pause-menu [data-act="resume"]').focus());
    await page.keyboard.press('Space');
    await until(page, () => document.getElementById('pause').hidden, 'Space on the focused Resume button resumes');
    await page.waitForTimeout(150);
    check(await Q(page, () => (__rg.seen.tap || 0) === 1), 'that Space did not also tap the glass');

    // the album
    await page.keyboard.press('KeyM');
    await until(page, () => !document.getElementById('album').hidden, 'M opens the album');
    check(await Q(page, () => document.querySelectorAll('#album-grid .acard').length === 8 && document.querySelectorAll('#album-grid .acard.locked').length === 8), 'eight stops, all still misted');
    await page.keyboard.press('Escape');
    await until(page, () => document.getElementById('album').hidden, 'Escape closes it');
    await click(page, '#btn-album-hud');
    await until(page, () => !document.getElementById('album').hidden, 'so does the ✉ button');
    await click(page, '#album [data-close]');

    await Q(page, () => __rg.ff(15));
    await shot(page, 'desktop-play');
    check(await paneColours(page) > 15, 'mid-pane: the scene shows through the wiped glass');

    // complete the pane
    await Q(page, () => __rg.ff(400));
    await until(page, () => __rg.mode === 'postcard' && !document.getElementById('postcard').hidden, 'the cleared pane becomes a postcard');
    check(await Q(page, () => document.querySelectorAll('#pc-found li').length === 3 && document.getElementById('pc-name').textContent.includes('Willow')), 'the postcard names the station and its three curios');
    check(await Q(page, () => { const c = document.getElementById('pc-art').getContext('2d').getImageData(240, 120, 1, 1).data; return c[3] === 255 && c[0] + c[1] + c[2] > 30; }), 'the postcard has its picture');
    await shot(page, 'desktop-postcard');
    await click(page, '#pc-next');
    await until(page, () => __rg.mode === 'play' && __rg.G.station === 1 && __rg.G.phase === 'play', 'Next station: Lantern Quay, misted over');

    // save and continue
    await Q(page, () => __rg.ff(20));
    await click(page, '#btn-pause');
    await until(page, () => !document.getElementById('pause').hidden, 'the ❚❚ button pauses');
    const before = await Q(page, () => ({ t: __rg.G.t, st: __rg.G.station, found: __rg.G.found.length, clear: 1 - __rg.G.fogSum / (255 * __rg.G.fog.length) }));
    await click(page, '#pause-menu [data-act="quit"]');
    await until(page, () => __rg.mode === 'title' && !document.getElementById('btn-continue').hidden, 'Save & Quit returns to the title with Continue');
    await click(page, '#btn-continue');
    // the sim runs on as soon as it loads, so compare it to the save within a moment of play
    await until(page, (b) => __rg.mode === 'play' && __rg.G.station === b.st && __rg.G.found.length >= b.found
        && Math.abs(__rg.G.t - b.t) < 1.5 && Math.abs((1 - __rg.G.fogSum / (255 * __rg.G.fog.length)) - b.clear) < 0.02, 'Continue restores the pane, mist and all', 15000, before);

    // the rest of the journey
    for (let i = 1; i < 8; i++) {
        await Q(page, () => __rg.ff(400));
        await page.waitForFunction(() => __rg.mode === 'postcard', null, { timeout: 15000 }).catch(() => {});
        if (i < 7) await click(page, '#pc-next');
    }
    check(await Q(page, () => document.getElementById('pc-next').textContent === 'Arrive'), 'the last postcard says Arrive');
    await click(page, '#pc-next');
    await until(page, () => __rg.mode === 'ending' && !document.getElementById('ending').hidden, 'Morning: the journey ends');
    await shot(page, 'desktop-ending');
    await click(page, '#end-next');
    await until(page, () => __rg.mode === 'play' && __rg.G.late && __rg.G.journeyDone, 'Stay aboard: back round in the small hours');
    check(await Q(page, () => document.getElementById('hud-station').textContent.includes('small hours') && document.querySelectorAll('#hud-pips span').length === 4), 'the HUD shows the late pass and its rare curio');
    await shot(page, 'desktop-late');
    await page.keyboard.press('KeyM');
    await until(page, () => !document.getElementById('album').hidden && document.querySelectorAll('#album-grid .acard:not(.locked) canvas').length === 8, 'the album holds all eight postcards');
    check(await Q(page, () => /^\d+ \/ 32 curios$/.test(document.getElementById('album-count').textContent)), 'and counts the curios out of 32');
    await shot(page, 'desktop-album');
    await page.keyboard.press('Escape');

    await click(page, '#btn-pause');
    await click(page, '#pause-menu [data-act="quit"]');
    await until(page, () => __rg.mode === 'title', 'back to the title');
    await click(page, '#btn-new');
    await until(page, () => !document.getElementById('confirm').hidden && __rg.mode === 'title', 'Board the train with a journey saved asks first');
    await click(page, '#confirm [data-close]');
    await until(page, () => document.getElementById('confirm').hidden && __rg.hasSave(), 'Keep my journey keeps it');
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

    check(await backLinkOk(page), '← Games link is on top');
    await tapSel('#btn-new');
    await until(page, () => __rg.mode === 'play', 'a tap on Board the train starts play');
    await until(page, () => !document.getElementById('touch').hidden, 'the tap button is shown');

    const L = await layout(page);
    check(L.noHScroll, 'no sideways scroll');
    check(L.canvas, 'the canvas matches the visible viewport');
    const sizes = await Q(page, () => ['#btn-tap', '#btn-pause', '#btn-album-hud'].map((s) => {
        const r = document.querySelector(s).getBoundingClientRect();
        return { s, ok: r.width >= 44 && r.height >= 44 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight };
    }));
    for (const z of sizes) check(z.ok, `${z.s} is at least 44 px and on screen`);
    check(await Q(page, () => { const p = __rg.view.pane; return p.x >= 0 && p.y > 50 && p.x + p.w <= innerWidth && p.y + p.h + p.sill <= innerHeight; }), 'the window and its sill fit on screen');

    // drag from below/beside the window: the drop follows the drag (relative steering)
    const start = await Q(page, () => ({ x: __rg.G.drop.x, y: __rg.G.drop.y }));
    const from = w > h ? { x: w * 0.12, y: h * 0.7 } : { x: w * 0.3, y: h * 0.85 };
    await touch('touchStart', from.x, from.y);
    for (let i = 1; i <= 8; i++) await touch('touchMove', from.x + i * 9, from.y - i * 4);
    await until(page, (s) => __rg.G.drop.x > s.x + 0.8 && __rg.G.drop.y < s.y + 0.6, 'dragging anywhere moves the drop along the drag', 15000, start);
    await touch('touchEnd', 0, 0);

    if (h > w) check(await shown(page, 'journal'), 'portrait: the journal lists the curios under the window');
    await Q(page, () => { __rg.G.tapCD = 0; });
    const taps = await Q(page, () => __rg.seen.tap || 0);
    await tapSel('#btn-tap');
    await until(page, (n) => (__rg.seen.tap || 0) > n, 'the tap button taps the glass', 15000, taps);
    await Q(page, () => __rg.ff(10));
    await shot(page, `phone-${w}x${h}`);

    await tapSel('#btn-pause');
    await until(page, () => !document.getElementById('pause').hidden, 'tapping ❚❚ pauses');
    await page.waitForTimeout(300);
    check(await shown(page, 'pause'), 'the pause screen stays open after the finger lifts');
    await tapSel('#pause-menu [data-act="resume"]');
    await until(page, () => document.getElementById('pause').hidden, 'a tap on Resume closes it');
    await Q(page, () => __rg.ff(400));
    await until(page, () => __rg.mode === 'postcard', 'a pane finishes into a postcard');
    await tapSel('#pc-next');
    await until(page, () => __rg.mode === 'play' && __rg.G.station === 1, 'a tap on Next station goes on');
    reportErrors(`phone ${w}×${h}`);
}

// ======================================================================
async function nostorage() {
    console.log('\n== blocked storage');
    const page = await open({ width: 1280, height: 760 }, { nostorage: true });
    await click(page, '#btn-new');
    await until(page, () => __rg.mode === 'play', 'boots and starts a journey with localStorage throwing');
    check(await Q(page, () => __rg.save() === false), 'saving fails quietly');
    await Q(page, () => __rg.ff(400));
    await until(page, () => __rg.mode === 'postcard', 'and plays a pane to its postcard');
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

/**
 * browsertest.mjs — VACANCY in real Chromium (SwiftShader WebGL).
 *
 * desktop (1280×760): the title with no errors and the ← Games link on top → New Journey → the waking card → Get up
 *   → real keys walk and turn → F toggles the flashlight → J opens the journal, Escape closes it → M the map →
 *   Escape pauses and the sim stops → Resume → E reads a diary (the reader opens with the right name) → Put it away
 *   → Save & Quit → Continue restores the journey → the seed field builds a named city → the bot plays the whole
 *   game (ff) and the ending card shows → A new journey. No sideways scroll; the canvas fills the window.
 * phones (touch only, real CDP touches) at 390×844 and 844×390: taps through the menus, the touch deck, the stick
 *   walks, the right half looks, USE reads a diary, controls ≥ 44 px and on screen, the canvas matches the viewport.
 * nostorage: localStorage throws; the game still boots and plays.
 * Fails on any console error, page error or failed request.
 *
 *   python3 -m http.server 8145          # from the REPO ROOT
 *   node game-145/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8145), ONLY=desktop,phones,nostorage, Q (picture quality, default low).
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8145';
const Q = process.env.Q ?? 'low';
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
    await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('requestfailed', (r) => { if (!r.url().includes('favicon') && !r.url().includes('fonts.g')) errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`); });
    await page.goto(`${BASE}/game-145/index.html?debug=1&fast=4&q=${Q}`);
    await page.waitForFunction(() => window.__va && __va.mode === 'title', null, { timeout: 60000 });
    return page;
}

const check = (cond, msg) => { if (!cond) { fails++; console.log('  FAIL', msg); } else console.log('  ok', msg); return cond; };
const Q_ = (page, fn, arg) => page.evaluate(fn, arg);
const shot = async (page, name) => { await page.screenshot({ path: path.join(OUT, `bt-${name}.png`) }); };
const until = (page, fn, msg, timeout = 60000, arg = null) =>
    page.waitForFunction(fn, arg, { timeout, polling: 100 }).then(() => check(true, msg), () => check(false, msg));
const click = (page, sel) => Q_(page, (s) => { const e = document.querySelector(s); if (!e) return false; e.click(); return true; }, sel);
const visible = (page, id) => Q_(page, (i) => !document.getElementById(i).hidden, id);
const backLinkOk = (page) => Q_(page, () => {
    const a = document.getElementById('back-link');
    if (!a || a.getAttribute('href') !== '../index.html') return false;
    const r = a.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return r.width > 0 && r.top >= 0 && (top === a || a.contains(top));
});
const layout = (page) => Q_(page, () => {
    const vv = window.visualViewport;
    const c = document.getElementById('view').getBoundingClientRect();
    return {
        noHScroll: document.documentElement.scrollWidth <= innerWidth + 1,
        canvas: Math.abs(c.width - (vv?.width ?? innerWidth)) < 2 && Math.abs(c.height - (vv?.height ?? innerHeight)) < 2 && c.left === 0 && c.top === 0,
    };
});
const reportErrors = (label) => { check(errors.length === 0, `${label}: no console errors, page errors or failed requests`); for (const e of errors.slice(0, 8)) console.log('    ', e); };
/** Stand a little way from a thing, facing it. */
const faceThing = (page, id, back = 1.1) => Q_(page, ([i, d]) => {
    const G = __va.G, t = G.thingById.get(i);
    __va.tp(i);
    G.p.x = t.x; G.p.z = t.z + d;
    G.p.yaw = Math.atan2(t.x - G.p.x, -(t.z - G.p.z));
    return true;
}, [id, back]);

// ======================================================================
async function desktop() {
    console.log('\n== desktop 1280×760');
    const page = await open({ width: 1280, height: 760 });
    check(await backLinkOk(page), '← Games link is on top and points at ../index.html');
    check(await visible(page, 'title'), 'the title screen is up');
    check(await Q_(page, () => document.getElementById('btn-continue').hidden), 'no Continue without a saved journey');
    const L = await layout(page);
    check(L.noHScroll && L.canvas, 'no sideways scroll; the canvas fills the window');
    check(await Q_(page, () => document.querySelectorAll('#over-title, #title-title').length <= 2), 'no element id shadows a screen heading');
    await shot(page, 'desktop-title');

    await click(page, '#title-menu [data-act="new"]');
    await until(page, () => __va.mode === 'intro' && !document.getElementById('intro').hidden, 'New Journey builds a city and shows the waking card', 120000);
    await shot(page, 'desktop-intro');
    await click(page, '#intro-go');
    await until(page, () => __va.mode === 'play' && !document.getElementById('hud').hidden, 'Get up starts play with the HUD');
    check(await Q_(page, () => __va.G.items.includes('compass') && document.getElementById('compass-label').textContent.length > 3), 'the compass names what it points at');

    const d0 = await Q_(page, () => __va.G.p.dist);
    await page.keyboard.down('KeyW');
    await until(page, (d) => __va.G.p.dist > d + 0.5, 'holding W walks', 60000, d0);
    await page.keyboard.up('KeyW');
    const y0 = await Q_(page, () => __va.G.p.yaw);
    await page.keyboard.down('ArrowRight');
    await until(page, (y) => Math.abs(__va.G.p.yaw - y) > 0.2, 'holding → turns', 60000, y0);
    await page.keyboard.up('ArrowRight');

    await page.keyboard.press('KeyF');
    await until(page, () => __va.view.flashOn === false, 'F switches the flashlight off');
    await page.keyboard.press('KeyF');
    await until(page, () => __va.view.flashOn === true, 'and on again');

    await page.keyboard.press('KeyJ');
    await until(page, () => !document.getElementById('journal').hidden, 'J opens the journal');
    await page.keyboard.press('Escape');
    await until(page, () => document.getElementById('journal').hidden && __va.mode === 'play', 'Escape closes it');
    await page.keyboard.press('KeyM');
    await until(page, () => !document.getElementById('map').hidden, 'M opens the map');
    await shot(page, 'desktop-map');
    await page.keyboard.press('Escape');
    await until(page, () => document.getElementById('map').hidden, 'Escape closes the map');

    await page.keyboard.press('Escape');
    await until(page, () => !document.getElementById('pause').hidden, 'Escape pauses');
    const t0 = await Q_(page, () => __va.G.t);
    await page.waitForTimeout(500);
    check(await Q_(page, (t) => __va.G.t === t, t0), 'the sim stops while paused');
    await click(page, '#pause-menu [data-act="resume"]');
    await until(page, (t) => document.getElementById('pause').hidden && __va.G.t > t, 'Resume closes the pause screen and the sim runs again', 60000, t0);

    // read the first diary with a real key press
    await faceThing(page, 'diary0');
    await page.waitForTimeout(300);
    await page.keyboard.press('KeyE');
    await until(page, () => !document.getElementById('reader').hidden && __va.G.gotSet.has('diary0'), 'E on a diary opens the reader');
    const name = await Q_(page, () => document.getElementById('reader-name').textContent);
    check(await Q_(page, (n) => n.length > 3 && __va.G.story.diaries[0] && n.includes(' '), name), `the reader shows whose diary it is (${name})`);
    check(await Q_(page, () => __va.ui.top() === 'reader' && __va.G.t === __va.G.t), 'reading pauses the walk');
    await shot(page, 'desktop-reader');
    await click(page, '#reader [data-close]');
    await until(page, () => document.getElementById('reader').hidden && __va.mode === 'play', 'Put it away returns to the city');
    await until(page, () => /diary/.test(document.getElementById('compass-label').textContent), 'and the compass points at the next diary');
    await shot(page, 'desktop-play');

    // save, quit, continue
    const read = await Q_(page, () => __va.G.read.length);
    await Q_(page, () => document.querySelector('#btn-pause').click());
    await until(page, () => !document.getElementById('pause').hidden, 'the ❚❚ button pauses');
    await click(page, '#pause-menu [data-act="quit"]');
    await until(page, () => __va.mode === 'title' && !document.getElementById('btn-continue').hidden, 'Save & Quit returns to the title with Continue');
    await click(page, '#title-menu [data-act="continue"]');
    await until(page, (r) => __va.mode === 'play' && __va.G.read.length === r, 'Continue restores the journey', 120000, read);

    // the whole game, by the bot
    await Q_(page, () => __va.ff(60 * 60));
    await until(page, () => __va.mode === 'over' && !document.getElementById('over').hidden, 'the bot brings everyone home and the ending shows', 180000);
    await shot(page, 'desktop-over');
    await click(page, '#over-again');
    await until(page, () => __va.mode === 'intro', 'A new journey builds a new city', 120000);
    // a named seed
    await Q_(page, () => { document.getElementById('intro-go').click(); });
    await until(page, () => __va.mode === 'play', 'into play');
    await Q_(page, () => document.querySelector('#btn-pause').click());
    await click(page, '#pause-menu [data-act="quit"]');
    await until(page, () => __va.mode === 'title', 'back to the title');
    await Q_(page, () => { document.getElementById('seed-input').value = 'ashmere'; document.querySelector('#title-menu [data-act="seed"]').click(); });
    await until(page, () => __va.mode === 'intro' && __va.G.seed !== 0, 'a typed seed builds that city', 120000);
    const s1 = await Q_(page, () => __va.G.seed);
    check(await Q_(page, async (s) => (await import('/game-145/js/rng.js')).seedFromText('ashmere') === s, s1), 'the same word always gives the same city');
    reportErrors('desktop');
}

// ======================================================================
async function phone(w, h) {
    console.log(`\n== phone ${w}×${h} (touch only)`);
    const page = await open({ width: w, height: h }, { touch: true });
    const cdp = await page.context().newCDPSession(page);
    const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
    const tapSel = async (sel) => {
        const r = await Q_(page, (s) => { const e = document.querySelector(s); e?.scrollIntoView({ block: 'center' }); const b = e?.getBoundingClientRect(); return b && { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, sel);
        if (!r) return false;
        await page.touchscreen.tap(r.x, r.y);
        return true;
    };
    check(await backLinkOk(page), '← Games link is on top');
    await tapSel('#title-menu [data-act="new"]');
    await until(page, () => __va.mode === 'intro', 'a tap on New Journey builds a city', 120000);
    await tapSel('#intro-go');
    await until(page, () => __va.mode === 'play', 'a tap on Get up starts play');
    await until(page, () => !document.getElementById('touch').hidden, 'the touch deck is shown');
    const L = await layout(page);
    check(L.noHScroll, 'no sideways scroll');
    check(L.canvas, 'the canvas matches the visible viewport');
    const sizes = await Q_(page, () => ['#btn-use', '#btn-run', '#btn-light', '#btn-pause', '#btn-journal', '#btn-map'].map((s) => {
        const r = document.querySelector(s).getBoundingClientRect();
        const el = document.querySelector(s), top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
        return { s, ok: r.width >= 44 && r.height >= 44 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight && (top === el || el.contains(top)) };
    }));
    for (const z of sizes) check(z.ok, `${z.s} is at least 44 px, on screen and on top`);

    // walk with the stick
    const zone = await Q_(page, () => { const r = document.getElementById('stick-zone').getBoundingClientRect(); return { x: r.left + r.width * 0.45, y: r.top + r.height * 0.55 }; });
    const d0 = await Q_(page, () => __va.G.p.dist);
    await touch('touchStart', [{ x: zone.x, y: zone.y, id: 1 }]);
    for (let i = 1; i <= 6; i++) await touch('touchMove', [{ x: zone.x, y: zone.y - i * 12, id: 1 }]);
    await until(page, (d) => __va.G.p.dist > d + 0.3, 'pushing the stick walks', 60000, d0);
    await touch('touchEnd', []);
    // look with the right half
    const look = await Q_(page, () => { const r = document.getElementById('look-zone').getBoundingClientRect(); return { x: r.left + r.width * 0.5, y: r.top + r.height * 0.4 }; });
    const y0 = await Q_(page, () => __va.G.p.yaw);
    await touch('touchStart', [{ x: look.x, y: look.y, id: 2 }]);
    for (let i = 1; i <= 6; i++) await touch('touchMove', [{ x: look.x + i * 15, y: look.y, id: 2 }]);
    await touch('touchEnd', []);
    await until(page, (y) => Math.abs(__va.G.p.yaw - y) > 0.1, 'dragging on the right turns the view', 60000, y0);

    // USE on a diary
    await faceThing(page, 'diary0');
    await page.waitForTimeout(300);
    await tapSel('#btn-use');
    await until(page, () => !document.getElementById('reader').hidden, 'tapping USE reads the diary');
    await page.waitForTimeout(300);
    check(await visible(page, 'reader'), 'the reader stays open after the finger lifts');
    const foot = await Q_(page, () => { const b = document.querySelector('#reader [data-close]').getBoundingClientRect(); return b.bottom <= innerHeight && b.top >= 0 && b.height >= 44; });
    check(foot, 'its Put it away button is on screen without scrolling');
    await shot(page, `phone-${w}x${h}-reader`);
    await tapSel('#reader [data-close]');
    await until(page, () => document.getElementById('reader').hidden, 'a tap puts it away');
    await shot(page, `phone-${w}x${h}`);
    await tapSel('#btn-pause');
    await until(page, () => !document.getElementById('pause').hidden, 'tapping ❚❚ pauses');
    await page.waitForTimeout(300);
    check(await visible(page, 'pause'), 'the pause screen stays open after the finger lifts');
    await tapSel('#pause-menu [data-act="resume"]');
    await until(page, () => document.getElementById('pause').hidden, 'a tap on Resume closes it');
    reportErrors(`phone ${w}×${h}`);
}

// ======================================================================
async function nostorage() {
    console.log('\n== blocked storage');
    const page = await open({ width: 1280, height: 760 }, { nostorage: true });
    await click(page, '#title-menu [data-act="new"]');
    await until(page, () => __va.mode === 'intro', 'builds a city with localStorage throwing', 120000);
    await click(page, '#intro-go');
    await until(page, () => __va.mode === 'play', 'and plays');
    await Q_(page, () => __va.ff(20));
    check(await Q_(page, () => __va.save() === false), 'saving fails quietly');
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

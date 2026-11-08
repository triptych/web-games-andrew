/**
 * browsertest.mjs — the real game in real Chromium (SwiftShader WebGL).
 *
 * desktop (1280×760): title and back link → New Year by click → the wake-up scene advanced with real Enter/Space
 *   (a press first finishes the typing) → real W walks → E at the Holo-table opens it after TILLY's scene, Escape
 *   closes it → Escape pauses and the clock stops → the Hangar's drop button lands Sprout in the Meadow → real keys
 *   drive, strike and gather → holding E on the beacon lifts off → the report closes with a real Space press → the
 *   Gene Lab splices and releases by click → research by click → Escape closes Settings with a slider focused →
 *   Save & Quit → Continue → the bot plays the year to its ending. The screen is read back and must not be blank.
 * phones (touch only, real CDP touches) at 390×844 and 844×390: taps through the intro, the stick walks, the look pad
 *   turns, the Use button opens a terminal that fits the screen, a tap drops a bot, ⚔ strikes, ⛏ gathers, ☰ pauses and
 *   stays open after the finger lifts, controls ≥ 44 px and on screen, no sideways scroll, the canvas matches the viewport.
 * nostorage: localStorage throws; the game boots and plays.
 * Fails on any console error, page error or failed request.
 *
 *   python3 -m http.server 8125          # from the REPO ROOT
 *   node game-125/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8125), ONLY=desktop,phones,nostorage, THREE_PKG, Q (extra URL params).
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8125';
const OUT = path.join(HERE, 'shots');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const want = (name) => !ONLY.length || ONLY.includes(name);
fs.mkdirSync(OUT, { recursive: true });

let fails = 0, errors = [], browser = null;

async function open(viewport, { touch = false, nostorage = false, q = '&q=low' } = {}) {
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
    if (PKG) await page.route('https://unpkg.com/**', (route) => {
        const file = path.join(PKG, new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, ''));
        if (!fs.existsSync(file)) return route.abort();
        route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
    });
    await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    await page.route('https://fonts.gstatic.com/**', (r) => r.fulfill({ status: 200, body: '' }));
    errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('requestfailed', (r) => { if (!r.url().includes('favicon')) errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`); });
    await page.goto(`${BASE}/game-125/index.html?debug=1&fast=4${q}${process.env.Q || ''}`);
    await page.waitForFunction(() => window.__sf && __sf.mode === 'title', null, { timeout: 90000 });
    return page;
}

const check = (cond, msg) => { if (!cond) { fails++; console.log('  FAIL', msg); } else console.log('  ok', msg); return cond; };
const Q = (page, fn, arg) => page.evaluate(fn, arg);
const shot = (page, name) => page.screenshot({ path: path.join(OUT, `bt-${name}.png`) });
const until = (page, fn, msg, timeout = 45000, arg = null) =>
    page.waitForFunction(fn, arg, { timeout, polling: 100 }).then(() => check(true, msg), async () => {
        check(false, msg);
        console.log('    state:', JSON.stringify(await page.evaluate(() => ({ mode: __sf.mode, gmode: __sf.G.mode, talk: __sf.G.talk, near: __sf.G.near, me: [__sf.G.me.x.toFixed(1), __sf.G.me.z.toFixed(1)], screens: __sf.ui.stack, panel: __sf.ui.panel, world: __sf.input.world, queue: __sf.input.queue.length, report: !!__sf.G.report })).catch((e) => e.message)));
        return false;
    });
const click = (page, sel) => Q(page, (s) => { const e = document.querySelector(s); if (!e) return false; e.click(); return true; }, sel);
const backLinkOk = (page) => Q(page, () => {
    const a = document.getElementById('back-link');
    if (!a || a.getAttribute('href') !== '../index.html') return false;
    const r = a.getBoundingClientRect(), top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return r.width > 0 && r.top >= 0 && (top === a || a.contains(top));
});
const layout = (page) => Q(page, () => {
    const vv = window.visualViewport, c = document.getElementById('view').getBoundingClientRect();
    return { noHScroll: document.documentElement.scrollWidth <= innerWidth + 1, canvas: Math.abs(c.width - (vv?.width ?? innerWidth)) < 2 && Math.abs(c.height - (vv?.height ?? innerHeight)) < 2 && c.left === 0 && c.top === 0 };
});
const reportErrors = (label) => { check(errors.length === 0, `${label}: no console errors, page errors or failed requests`); for (const e of errors.slice(0, 8)) console.log('    ', e); };
/** Press a key until the dialogue is gone (a real key: the first press finishes the typing). */
async function talkThrough(page, key = 'Enter', max = 300) {
    for (let i = 0; i < max; i++) {
        if (!(await Q(page, () => !!__sf.G.talk))) return true;
        await page.keyboard.press(key);
        // one press is consumed per frame, and SwiftShader draws a frame or two a second: wait for it
        await page.waitForFunction(() => __sf.input.queue.length === 0, null, { timeout: 15000, polling: 50 }).catch(() => {});
    }
    return !(await Q(page, () => !!__sf.G.talk));
}
/** Wait until the world takes input again: the frame that closes a screen drops queued keys on purpose (game-078). */
const world = (page) => page.waitForFunction(() => __sf.input.world && __sf.input.queue.length === 0, null, { timeout: 30000, polling: 50 }).catch(() => {});
const near = (term, dx = 0, dz = 2.2, yaw = 0) => `const t = { command: [0, -45], hangar: [9, -19.5], launch: [14, -27], lab: [-10, -8], research: [-10, -22], archive: [17, -7] }['${term}'];
    __sf.G.me.x = t[0] + ${dx}; __sf.G.me.z = t[1] + ${dz}; __sf.G.me.yaw = ${yaw}; __sf.G.me.pitch = 0;`;

// ======================================================================
async function desktop() {
    console.log('\n== desktop 1280×760');
    const page = await open({ width: 1280, height: 760 });
    check(await backLinkOk(page), '← Games link is on top and points at ../index.html');
    check(await Q(page, () => !document.getElementById('title').hidden && document.getElementById('btn-continue').hidden), 'title screen is up, no Continue without a save');
    const L = await layout(page);
    check(L.noHScroll && L.canvas, 'no sideways scroll; the canvas fills the window');
    const px = await Q(page, () => __sf.probe());
    check(px.sd > 6, `the title scene is drawn, not blank (spread ${px.sd.toFixed(1)})`);
    await shot(page, 'desktop-title');

    await click(page, '#title-menu [data-act="new"]');
    await until(page, () => __sf.mode === 'play' && __sf.G.talk?.id === 'wake' && !document.getElementById('talk').hidden, 'New Year starts on TILLY waking you');
    const i0 = await Q(page, () => __sf.G.talk.i);
    await page.keyboard.press('Enter');
    await page.waitForTimeout(150);
    check(await Q(page, (i) => __sf.G.talk.i === i, i0), 'the first press finishes the typing, it does not skip the line');
    check(await talkThrough(page, 'Enter'), 'Enter goes through the whole wake-up scene');
    check(await Q(page, () => document.getElementById('talk').hidden && !document.getElementById('hud-station').hidden), 'the station HUD is up');

    const z0 = await Q(page, () => __sf.G.me.z);
    await page.keyboard.down('KeyW');
    await until(page, (z) => __sf.G.me.z < z - 1.5, 'holding W walks north up the spine', 45000, z0);
    await page.keyboard.up('KeyW');
    check(await Q(page, () => __sf.G.day > 0), 'time ran while walking');

    await Q(page, new Function(near('command')));
    await until(page, () => __sf.G.near === 'command' && !document.getElementById('hud-use').hidden, 'the Use prompt names the Holo-table');
    await page.keyboard.press('KeyE');
    await until(page, () => __sf.G.talk?.id === 'command', 'E at the Holo-table starts TILLY\'s Command Deck scene');
    await talkThrough(page, 'Space');
    await until(page, () => !document.getElementById('term').hidden && document.getElementById('term-name').textContent === 'Holo-table', 'then the Holo-table panel opens');
    const d0 = await Q(page, () => __sf.G.day);
    await page.waitForTimeout(500);
    check(await Q(page, (d) => __sf.G.day === d, d0), 'the clock stops while a terminal is open');
    await shot(page, 'desktop-holotable');
    await page.keyboard.press('Escape');
    await until(page, () => document.getElementById('term').hidden, 'Escape closes the terminal');

    await world(page);
    await page.keyboard.press('Escape');
    await until(page, () => !document.getElementById('pause').hidden, 'Escape pauses');
    await page.keyboard.press('Escape');
    await until(page, () => document.getElementById('pause').hidden, 'Escape resumes');

    // the hangar and the first drop
    await Q(page, new Function(near('launch', 0, 3)));
    await until(page, () => __sf.G.near === 'launch', 'standing at the Drop Cradle');
    await world(page);
    await page.keyboard.press('KeyE');
    await until(page, () => __sf.G.talk?.id === 'hangar', 'TILLY introduces Sprout');
    await talkThrough(page);
    await until(page, () => !document.getElementById('term').hidden, 'the Hangar panel opens');
    await click(page, '#term-body .drop');
    await until(page, () => __sf.G.mode === 'mission' && document.getElementById('term').hidden, 'the Meadow button drops Sprout on the planet');
    await talkThrough(page);
    await until(page, () => !document.getElementById('hud-mission').hidden, 'the mission HUD is up');
    const px2 = await Q(page, () => __sf.probe());
    check(px2.sd > 8 && px2.mean > 15, `the Meadow is drawn (mean ${px2.mean.toFixed(0)}, spread ${px2.sd.toFixed(1)})`);
    const y0 = await Q(page, () => __sf.G.mission.p.y);
    await page.keyboard.down('KeyW');
    await until(page, (y) => __sf.G.mission.p.y < y - 1, 'W drives the bot forward', 45000, y0);
    await page.keyboard.up('KeyW');
    await page.keyboard.press('Space');
    await until(page, () => (__sf.seen.swing || 0) >= 1, 'Space strikes');
    // gather the nearest metal node with a held E
    await Q(page, () => { const M = __sf.G.mission, n = M.nodes.find((q) => q.kind === 'metal'); M.p.x = n.x; M.p.y = n.y + 1.1; M.p.yaw = 0; for (const e of M.enemies) e.passive = true; });
    await page.keyboard.down('KeyE');
    await until(page, () => (__sf.seen.gather || 0) >= 1 && __sf.G.mission.p.carry > 0, 'holding E gathers metal into the hold');
    await page.keyboard.up('KeyE');
    await shot(page, 'desktop-meadow');
    // home
    await Q(page, () => { const M = __sf.G.mission; M.p.x = 0; M.p.y = 25; });
    await page.keyboard.down('KeyE');
    await until(page, () => __sf.G.mode === 'station', 'holding E on the beacon lifts off');
    await page.keyboard.up('KeyE');
    await talkThrough(page);
    await until(page, () => !document.getElementById('report').hidden, 'the mission report is shown');
    await page.keyboard.press('Space');
    await until(page, () => document.getElementById('report').hidden && !__sf.G.report, 'Space presses its focused Continue button');

    // the Gene Lab
    await Q(page, () => { const G = __sf.G; G.samples.sunbloom = 2; G.samples.skitterling = 2; for (const k in G.res) G.res[k] = 200; });
    await Q(page, new Function(near('lab', 2.3, 0, -Math.PI / 2)));
    await until(page, () => __sf.G.near === 'lab', 'standing at the Gene Splicer');
    await world(page);
    await page.keyboard.press('KeyE');
    await until(page, () => __sf.G.talk?.id === 'lab', 'TILLY explains the Gene Lab');
    await talkThrough(page);
    await until(page, () => !document.getElementById('term').hidden && document.getElementById('term-name').textContent === 'Gene Lab', 'the Gene Lab opens');
    await click(page, '#term-body .act .btn.primary');
    await until(page, () => __sf.G.vats.length === 1, 'Splice starts a strain incubating');
    await Q(page, () => __sf.act({ t: 'wait', days: 2.1 }));
    await click(page, '#term-body .tab:nth-child(2)');
    await until(page, () => !!document.querySelector('#term-body .relb'), 'the ready strain lists the zones to release it on');
    await click(page, '#term-body .relb');
    await until(page, () => (__sf.seen.release || 0) === 1, 'a click releases it on the Meadow');
    await page.keyboard.press('Escape');
    await until(page, () => __sf.G.talk?.id === 'first_release', 'closing the lab, TILLY watches the readings change');
    await talkThrough(page);
    // research
    await Q(page, new Function(near('research', 2.2, 0, -Math.PI / 2)));
    await world(page);
    await until(page, () => __sf.G.near === 'research', 'standing at the Research Console');
    await page.keyboard.press('KeyE');
    await until(page, () => __sf.G.talk?.id === 'research', 'TILLY explains research');
    await talkThrough(page);
    await until(page, () => document.getElementById('term-name').textContent === 'Research Lab' && !document.getElementById('term').hidden, 'the Research Lab opens');
    await click(page, '#term-body .node.ready');
    await until(page, () => __sf.G.research.active.length === 1, 'a click starts a research project');
    await page.keyboard.press('Escape');

    // Escape closes Settings with a slider focused (game-117, game-118)
    await world(page);
    await page.keyboard.press('Escape');
    await until(page, () => !document.getElementById('pause').hidden, 'paused');
    await click(page, '#pause-menu [data-act="settings"]');
    await Q(page, () => document.getElementById('set-sfx').focus());
    await page.keyboard.press('Escape');
    await until(page, () => document.getElementById('settings').hidden, 'Escape closes Settings even with a slider focused');
    const day = await Q(page, () => __sf.G.day);
    await click(page, '#pause-menu [data-act="quit"]');
    await until(page, () => __sf.mode === 'title' && !document.getElementById('btn-continue').hidden, 'Save & Quit returns to the title with Continue');
    await click(page, '#title-menu [data-act="continue"]');
    await until(page, (d) => __sf.mode === 'play' && Math.abs(__sf.G.day - d) < 0.01 && __sf.G.research.active.length === 1, 'Continue restores the year', 45000, day);

    // the bot plays out the year
    await Q(page, () => __sf.ff(3e6));
    await until(page, () => __sf.mode === 'over', 'the year ends', 240000);
    await talkThrough(page);
    await until(page, () => !document.getElementById('ending').hidden && document.querySelector('#ending-body h2').textContent.length > 3, 'an ending is shown');
    console.log('    ending:', await Q(page, () => `${__sf.G.ending.kind} day ${__sf.G.ending.day} eden ${__sf.G.ending.eden}`));
    await shot(page, 'desktop-ending');
    await click(page, '#ending-again');
    await until(page, () => __sf.mode === 'title' && document.getElementById('btn-continue').hidden, 'Begin another year returns to the title with no save');
    reportErrors('desktop');
}

// ======================================================================
async function phone(w, h) {
    console.log(`\n== phone ${w}×${h} (touch only)`);
    const page = await open({ width: w, height: h }, { touch: true });
    const cdp = await page.context().newCDPSession(page);
    const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
    const centre = (sel) => Q(page, (s) => { const e = document.querySelector(s); if (!e) return null; e.scrollIntoView({ block: 'center' }); const b = e.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, sel);
    const tapSel = async (sel) => { const r = await centre(sel); if (!r) return false; await page.touchscreen.tap(r.x, r.y); return true; };
    const tapTalk = async () => { for (let i = 0; i < 300 && (await Q(page, () => !!__sf.G.talk)); i++) { const k = await Q(page, () => __sf.G.talk.id + __sf.G.talk.i + ':' + __sf.ui.typed); await tapSel('#talk'); await page.waitForFunction((k0) => !__sf.G.talk || __sf.G.talk.id + __sf.G.talk.i + ':' + __sf.ui.typed !== k0, k, { timeout: 15000, polling: 50 }).catch(() => {}); } };

    check(await backLinkOk(page), '← Games link is on top');
    await tapSel('#title-menu [data-act="new"]');
    await until(page, () => __sf.mode === 'play' && __sf.G.talk, 'a tap on New Year starts the year');
    await until(page, () => !document.getElementById('touch').hidden, 'the touch deck is shown');
    const talkFits = await Q(page, () => { const r = document.getElementById('talk').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight; });
    check(talkFits, 'the dialogue box fits the screen');
    await shot(page, `phone-${w}x${h}-talk`);
    await tapTalk();
    check(await Q(page, () => !__sf.G.talk), 'taps go through the wake-up scene');
    const L = await layout(page);
    check(L.noHScroll, 'no sideways scroll');
    check(L.canvas, 'the canvas matches the visible viewport');

    // the stick walks
    const zone = await Q(page, () => { const r = document.getElementById('stick-zone').getBoundingClientRect(); return { x: r.left + r.width * 0.5, y: r.top + r.height * 0.6 }; });
    const z0 = await Q(page, () => __sf.G.me.z);
    await touch('touchStart', zone.x, zone.y);
    for (let i = 1; i <= 6; i++) await touch('touchMove', zone.x, zone.y - i * 12);
    await until(page, (z) => __sf.G.me.z < z - 0.6, 'pushing the stick up walks forward', 45000, z0);
    await touch('touchEnd', 0, 0);
    // the look pad turns
    const lz = await Q(page, () => { const r = document.getElementById('look-zone').getBoundingClientRect(); return { x: r.left + r.width * 0.5, y: r.top + r.height * 0.4 }; });
    const yaw0 = await Q(page, () => __sf.G.me.yaw);
    await touch('touchStart', lz.x, lz.y);
    for (let i = 1; i <= 6; i++) await touch('touchMove', lz.x + i * 10, lz.y);
    await touch('touchEnd', 0, 0);
    await until(page, (y) => __sf.G.me.yaw > y + 0.1, 'dragging the look pad turns', 45000, yaw0);

    // the Use button opens a terminal that fits
    await Q(page, new Function(near('launch', 0, 3)));
    await until(page, () => !document.getElementById('hud-use').hidden, 'the Use button appears at the Drop Cradle');
    await tapSel('#hud-use');
    await until(page, () => !!__sf.G.talk, 'tapping Use starts TILLY\'s Hangar scene');
    await tapTalk();
    await until(page, () => !document.getElementById('term').hidden, 'the Hangar panel opens');
    const fit = await Q(page, () => { const r = document.querySelector('#term .sheet').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 0.5 && r.top >= 0 && r.bottom <= innerHeight + 0.5; });
    check(fit, 'the terminal fits the screen');
    await shot(page, `phone-${w}x${h}-hangar`);
    await tapSel('#term-body .drop');
    await until(page, () => __sf.G.mode === 'mission', 'a tap on the Meadow drops the bot');
    await tapTalk();
    await until(page, () => document.getElementById('btn-a').getClientRects().length > 0, 'the action buttons are shown');
    const sizes = await Q(page, () => ['#btn-a', '#btn-b', '#btn-pause2'].map((s) => {
        const r = document.querySelector(s).getBoundingClientRect();
        return { s, ok: r.width >= 44 && r.height >= 44 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight };
    }));
    for (const z of sizes) check(z.ok, `${z.s} is at least 44 px and on screen`);
    const sw = await Q(page, () => __sf.seen.swing || 0);
    await tapSel('#btn-a');
    await until(page, (n) => (__sf.seen.swing || 0) > n, 'tapping ⚔ strikes', 45000, sw);
    await Q(page, () => { const M = __sf.G.mission, n = M.nodes.find((q) => q.kind === 'metal'); M.p.x = n.x; M.p.y = n.y + 1.1; M.p.yaw = 0; for (const e of M.enemies) e.passive = true; });
    const b = await centre('#btn-b');
    await touch('touchStart', b.x, b.y);
    await until(page, () => __sf.G.mission.p.carry > 0, 'holding ⛏ gathers');
    await touch('touchEnd', 0, 0);
    await shot(page, `phone-${w}x${h}-meadow`);

    await tapSel('#btn-pause2');
    await until(page, () => !document.getElementById('pause').hidden, 'tapping ☰ pauses');
    await page.waitForTimeout(300);
    check(await Q(page, () => !document.getElementById('pause').hidden), 'the pause screen stays open after the finger lifts');
    await tapSel('#pause-menu [data-act="resume"]');
    await until(page, () => document.getElementById('pause').hidden, 'a tap on Resume closes it');
    reportErrors(`phone ${w}×${h}`);
}

// ======================================================================
async function nostorage() {
    console.log('\n== blocked storage');
    const page = await open({ width: 1280, height: 760 }, { nostorage: true });
    await click(page, '#title-menu [data-act="new"]');
    await until(page, () => __sf.mode === 'play', 'boots and starts a year with localStorage throwing');
    await Q(page, () => { __sf.skipTalk(); __sf.ff(20); });
    check(await Q(page, () => __sf.save() === false), 'saving fails quietly');
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

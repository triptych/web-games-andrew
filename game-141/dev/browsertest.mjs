/**
 * browsertest.mjs — the real SANDSUNK in real Chromium (SwiftShader WebGL).
 *
 * desktop (1280×760): boots to the title with no errors and the ← Games link on top; New Expedition; a real
 *   mouse click on an exposed block strikes it; a right-click marks a block; arrow keys + Space dig; Escape pauses
 *   and Space on a focused Resume closes it; the skill tree, quests and museum open and close (Escape and Done);
 *   the camp button climbs to camp, Zahra's shop sells a potion, Climb down returns to the floor; Save & Quit →
 *   Continue restores the game; the bot clears floor 1 and the hatch takes you to floor 2; an artifact opens the
 *   3D viewer and its model loads; sound effects and voices decode and a music theme plays.
 * phones (touch only, real CDP touches) at 390×844 and 844×390: taps through the title, the HUD and action bar fit,
 *   controls ≥ 44 px and on screen, a tap digs, a long-press marks, the Mark button + tap marks, no sideways
 *   scroll, the canvas matches the visible viewport, a long sheet's Done stays reachable.
 * nostorage: localStorage throws; the game still boots and digs.
 * Fails on any console error, page error or failed request.
 *
 *   python3 -m http.server 8141          # from the REPO ROOT
 *   node game-141/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8141), ONLY=desktop,phones,nostorage, THREE_PKG.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8141';
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
    await page.goto(`${BASE}/game-141/index.html?debug=1`);
    await page.waitForFunction(() => window.__ss && __ss.mode === 'title', null, { timeout: 60000 });
    return page;
}

const check = (cond, msg) => { if (!cond) { fails++; console.log('  FAIL', msg); } else console.log('  ok', msg); return cond; };
const Q = (page, fn, arg) => page.evaluate(fn, arg);
const shot = async (page, name) => { await page.screenshot({ path: path.join(OUT, `bt-${name}.png`) }); };
const until = (page, fn, msg, timeout = 30000, arg = null) =>
    page.waitForFunction(fn, arg, { timeout, polling: 100 }).then(() => check(true, msg), () => check(false, msg));
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
/** Client coordinates of an exposed ordinary block (and its index), found through the game's own picking. */
const exposedBlock = (page, avoid = []) => Q(page, (av) => {
    const G = __ss.G, F = G.F;
    for (let i = 0; i < F.cells.length; i++) {
        const c = F.cells[i];
        if (av.includes(i) || c.k !== 'b' || !__ss.exposed(i) || ['rune', 'panel', 'door'].includes(c.b) || c.m) continue;
        const p = __ss.cellAt(i);
        if (__ss.view.pick(p.x, p.y) === i) {
            // the point must not be covered by the HUD or a bubble
            const el = document.elementFromPoint(p.x, p.y);
            if (el && el.id === 'view') return { i, x: p.x, y: p.y };
        }
    }
    return null;
}, avoid);
const reportErrors = (label) => { check(errors.length === 0, `${label}: no console errors, page errors or failed requests`); for (const e of errors.slice(0, 8)) console.log('    ', e); };
const finishAnims = (page) => Q(page, () => document.querySelectorAll('.sheet').forEach((s) => s.getAnimations().forEach((a) => a.finish())));

// ======================================================================
async function desktop() {
    console.log('\n== desktop 1280×760');
    const page = await open({ width: 1280, height: 760 });
    check(await backLinkOk(page), '← Games link is on top and points at ../index.html');
    check(await Q(page, () => document.getElementById('btn-continue').hidden), 'no Continue without a save');
    const L = await layout(page);
    check(L.noHScroll && L.canvas, 'no sideways scroll; the canvas fills the window');
    check(await Q(page, () => [...document.querySelectorAll('.screen')].every((sc) => [...document.querySelectorAll(`[id="${sc.id}-title"]`)].every((e) => /^H[1-6]$/.test(e.tagName)))), 'no element id shadows a screen heading (lib/a11y.js)');
    await shot(page, 'desktop-title');

    await page.mouse.click(640, 255);   // New Expedition
    await until(page, () => __ss.mode === 'play' && document.getElementById('title').hidden, 'New Expedition starts the dig');
    await page.waitForTimeout(1200);
    const b = await exposedBlock(page);
    check(!!b, 'an exposed block is visible and pickable');
    const st0 = await Q(page, () => __ss.G.st);
    await page.mouse.move(b.x, b.y);
    await page.mouse.click(b.x, b.y);
    await until(page, (s) => __ss.G.st < s && (__ss.seen.strike || 0) >= 1, 'a real mouse click strikes the block', 30000, st0);
    const b2 = await exposedBlock(page, [b.i]);
    await page.mouse.click(b2.x, b2.y, { button: 'right' });
    await until(page, (i) => __ss.G.F.cells[i].m === 1, 'a right-click marks a block', 30000, b2.i);
    await page.mouse.click(b2.x, b2.y, { button: 'right' });
    await until(page, (i) => __ss.G.F.cells[i].m === 0, 'a second right-click unmarks it', 30000, b2.i);

    // keyboard: arrows move the cursor, Space digs
    const strikes = await Q(page, () => __ss.seen.strike || 0);
    await Q(page, () => { const G = __ss.G, F = G.F; __ss.view.setCursor(F.start, false); });
    for (const k of ['ArrowUp', 'Space', 'Space']) await page.keyboard.press(k);
    await until(page, (n) => (__ss.seen.strike || 0) > n || (__ss.seen.deny || 0) > 0, 'arrow keys and Space dig from the keyboard', 30000, strikes);

    await page.keyboard.press('Escape');
    await until(page, () => !document.getElementById('pause').hidden, 'Escape pauses');
    await finishAnims(page);
    await Q(page, () => document.querySelector('#pause-menu [data-act="resume"]').focus());
    await page.keyboard.press('Space');
    await until(page, () => document.getElementById('pause').hidden, 'Space on the focused Resume button closes the pause screen');

    for (const [btn, id] of [['#btn-skills', 'skills'], ['#btn-quests', 'quests'], ['#btn-museum', 'museum']]) {
        await click(page, btn);
        await until(page, (s) => !document.getElementById(s).hidden, `${id} opens`, 30000, id);
        await page.waitForTimeout(150);
        await page.keyboard.press('Escape');
        await until(page, (s) => document.getElementById(s).hidden, `Escape closes ${id}`, 30000, id);
    }
    await click(page, '#btn-skills');
    await until(page, () => document.querySelectorAll('#skill-tree .skill').length === 13, 'the skill tree shows all thirteen skills');
    await shot(page, 'desktop-skills');
    await click(page, '#skills .sheet-foot [data-close]');
    await until(page, () => document.getElementById('skills').hidden, 'Done closes the skill tree');
    await click(page, '#btn-shop');
    await until(page, () => document.getElementById('shop').hidden, "the shop button below ground only says Zahra is at camp");

    // camp, shop, back down
    await click(page, '#btn-camp');
    await until(page, () => __ss.G.mode === 'camp' && !document.getElementById('camp').hidden, 'the Camp button climbs up to camp');
    await Q(page, () => { __ss.G.gold = 200; });
    await click(page, '#camp [data-open="shop"]');
    await until(page, () => !document.getElementById('shop').hidden && document.querySelectorAll('#shop-list .ware').length === 6, "Zahra's shop opens with six wares");
    const pots = await Q(page, () => __ss.G.inv.potion);
    await click(page, '#shop-list .ware button');
    await until(page, (p) => __ss.G.inv.potion === p + 1 && __ss.G.gold === 200 - 35, 'buying a potion costs 35 gold', 30000, pots);
    await shot(page, 'desktop-shop');
    await click(page, '#shop .sheet-foot [data-close]');
    await click(page, '#camp-embark');
    await until(page, () => __ss.G.mode === 'dig' && document.getElementById('camp').hidden, 'Climb down returns to the floor');

    // save, quit, continue
    const sig = await Q(page, () => JSON.stringify([__ss.G.n, __ss.G.st, __ss.G.stats.strikes]));
    await page.keyboard.press('Escape');
    await until(page, () => !document.getElementById('pause').hidden, 'Escape pauses again');
    await click(page, '#pause-menu [data-act="quit"]');
    await until(page, () => __ss.mode === 'title' && !document.getElementById('btn-continue').hidden, 'Save & Quit returns to the title with Continue');
    await click(page, '#title-menu [data-act="continue"]');
    await until(page, (s) => __ss.mode === 'play' && JSON.stringify([__ss.G.n, __ss.G.st, __ss.G.stats.strikes]) === s, 'Continue restores the saved game', 30000, sig);

    // the bot clears the floor; the hatch takes you down
    await Q(page, () => __ss.bot(600, 1, (g) => g.F.cleared));
    await Q(page, () => __ss.ui.closeAll());
    await until(page, () => __ss.G.F.cleared && !document.getElementById('btn-descend').hidden, 'a cleared floor shows the Descend button');
    await shot(page, 'desktop-cleared');
    await click(page, '#btn-descend');
    await until(page, () => __ss.G.n === 2, 'Descend takes you to floor 2');
    await until(page, () => (__ss.seen.artifact || 0) >= 1 || __ss.G.artOrder.length >= 1, "floor 1's artifact was found on the way");
    await Q(page, () => { const G = __ss.G; __ss.ui.openViewer(G, G.artOrder[0], true); });
    await until(page, () => !document.getElementById('viewer').hidden && __ss.museum.loaded === __ss.G.artOrder[0], 'the 3D viewer opens and its Meshy model loads', 60000);
    await page.waitForTimeout(800);
    await shot(page, 'desktop-viewer');
    await click(page, '#viewer [data-close]');
    await until(page, () => document.getElementById('viewer').hidden, 'Close shuts the viewer');

    // sound
    await until(page, () => __ss.audio.ctx && Object.keys(__ss.audio.buffers).length >= 25 && Object.keys(__ss.audio.voices).length >= 25, 'the ElevenLabs effects and voices decode', 60000);
    await until(page, () => __ss.audio.playing(), 'a music theme is playing', 30000);
    await shot(page, 'desktop-floor2');
    reportErrors('desktop');
}

// ======================================================================
async function phone(w, h) {
    console.log(`\n== phone ${w}×${h} (touch only)`);
    const page = await open({ width: w, height: h }, { touch: true });
    const cdp = await page.context().newCDPSession(page);
    const touchAt = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
    const tapSel = async (sel) => {
        const r = await Q(page, (s) => { const e = document.querySelector(s); e?.scrollIntoView({ block: 'center' }); const b = e?.getBoundingClientRect(); return b && { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, sel);
        if (!r) return false;
        await page.touchscreen.tap(r.x, r.y);
        return true;
    };

    check(await backLinkOk(page), '← Games link is on top');
    await tapSel('#title-menu [data-act="new"]');
    await until(page, () => __ss.mode === 'play', 'a tap on New Expedition starts the dig');
    await page.waitForTimeout(1500);
    const L = await layout(page);
    check(L.noHScroll, 'no sideways scroll');
    check(L.canvas, 'the canvas matches the visible viewport');

    const sizes = await Q(page, () => ['#btn-pause', '#btn-quests', '#btn-mark', '#btn-skills', '#btn-museum', '#btn-camp', '.slot', '#back-link'].map((s) => {
        const r = document.querySelector(s).getBoundingClientRect();
        const min = s === '#back-link' ? 24 : 44;
        return { s, ok: r.width >= min && r.height >= min && r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5 };
    }));
    for (const z of sizes) check(z.ok, `${z.s} is finger-sized and on screen`);
    const overlap = await Q(page, () => {
        const hud = [...document.querySelectorAll('#hud .hud-row, #hud .pill')].map((e) => e.getBoundingClientRect());
        const back = document.getElementById('back-link').getBoundingClientRect();
        return hud.some((r) => !(r.right <= back.left || r.left >= back.right || r.bottom <= back.top || r.top >= back.bottom));
    });
    check(!overlap, 'the HUD never sits under the ← Games link');

    const b = await exposedBlock(page);
    check(!!b, 'an exposed block is visible between the HUD and the action bar');
    const st0 = await Q(page, () => __ss.G.st);
    await page.touchscreen.tap(b.x, b.y);
    await until(page, (s) => __ss.G.st < s, 'a tap digs', 30000, st0);
    const b2 = await exposedBlock(page, [b.i]);
    await touchAt('touchStart', b2.x, b2.y);
    await page.waitForTimeout(700);
    await touchAt('touchEnd', 0, 0);
    await until(page, (i) => __ss.G.F.cells[i].m === 1, 'a long-press marks a block', 30000, b2.i);
    // open a little more floor first: a start in a corner exposes only two blocks
    await Q(page, () => {
        for (let k = 0; k < 8; k++) {
            const F = __ss.G.F;
            const i = F.cells.findIndex((c, j) => c.k === 'b' && !c.m && __ss.exposed(j) && !['rune', 'panel', 'door'].includes(c.b));
            if (i < 0) break;
            __ss.act({ t: 'dig', i });
        }
        __ss.ui.closeAll();
    });
    await tapSel('#btn-mark');
    await until(page, () => document.getElementById('btn-mark').getAttribute('aria-pressed') === 'true', 'the Mark button turns mark mode on');
    const b3 = await exposedBlock(page, [b.i, b2.i]);
    await page.touchscreen.tap(b3.x, b3.y);
    await until(page, (i) => __ss.G.F.cells[i].m === 1, 'in mark mode a tap marks instead of digging', 30000, b3.i);
    await tapSel('#btn-mark');
    await shot(page, `phone-${w}x${h}`);

    // a long sheet: its Done button stays reachable
    await tapSel('#btn-skills');
    await until(page, () => !document.getElementById('skills').hidden, 'a tap opens the skill tree');
    await finishAnims(page);
    const foot = await Q(page, () => {
        const sheet = document.querySelector('#skills .sheet');
        sheet.scrollTop = 0;
        const f = document.querySelector('#skills .sheet-foot').getBoundingClientRect();
        return f.bottom <= innerHeight + 1 && f.top >= 0;
    });
    check(foot, 'the skill tree Done button is on screen without scrolling');
    await page.waitForTimeout(300);
    check(await Q(page, () => !document.getElementById('skills').hidden), 'the sheet stays open after the finger lifts');
    await tapSel('#skills .sheet-foot [data-close]');
    await until(page, () => document.getElementById('skills').hidden, 'a tap on Done closes it');

    await tapSel('#btn-pause');
    await until(page, () => !document.getElementById('pause').hidden, 'tapping ⚙ pauses');
    await finishAnims(page);
    await tapSel('#pause-menu [data-act="resume"]');
    await until(page, () => document.getElementById('pause').hidden, 'a tap on Resume closes it');
    reportErrors(`phone ${w}×${h}`);
}

// ======================================================================
async function nostorage() {
    console.log('\n== blocked storage');
    const page = await open({ width: 1280, height: 760 }, { nostorage: true });
    await click(page, '#title-menu [data-act="new"]');
    await until(page, () => __ss.mode === 'play', 'boots and starts a dig with localStorage throwing');
    await Q(page, () => __ss.bot(30));
    check(await Q(page, () => __ss.G.stats.strikes > 0), 'digging works');
    check(await Q(page, () => __ss.save() === false), 'saving fails quietly');
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

/**
 * browsertest.mjs — the real game in real Chromium (SwiftShader WebGL).
 *
 * desktop (1280×760): boot to the title with no errors, the ← Games link on top → New Game sheet
 *   → Wash Ashore → real keys walk → E gathers driftwood → Escape pauses and the sim stops →
 *   Resume → Tab opens the book, Escape closes it with a slider... no, with the book focused →
 *   writing a spell in the book's own UI and casting it with F → Save & Quit → Continue restores
 *   the game → the bot plays to the ending → Return to Title. Unique ids, no sideways scroll.
 * phones (touch only, real CDP touches) at 390×844 and 844×390: taps through the menus, the
 *   touch deck appears, the stick walks, the look pad turns, Use and Cast act, controls ≥ 44 px
 *   and on screen, no sideways scroll, the canvas matches the visible viewport.
 * nostorage: localStorage throws; the game still boots and plays.
 * Fails on any console error, page error or failed request.
 *
 *   python3 -m http.server 8122          # from the REPO ROOT
 *   node game-122/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8122), ONLY=desktop,phones,nostorage, THREE_PKG.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
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
    page.on('requestfailed', (r) => { if (!r.url().includes('favicon') && !r.url().includes('fonts.g')) errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`); });
    // q=low keeps SwiftShader quick; the look is checked in the tour screenshots
    await page.goto(`${BASE}/game-122/index.html?debug=1&fast=4&q=low`);
    await page.waitForFunction(() => window.__ww && __ww.mode === 'title', null, { timeout: 90000 });
    return page;
}

const check = (cond, msg) => { if (!cond) { fails++; console.log('  FAIL', msg); } else console.log('  ok', msg); return cond; };
const Q = (page, fn, arg) => page.evaluate(fn, arg);
const shot = async (page, name) => { await page.screenshot({ path: path.join(OUT, `bt-${name}.png`) }); };
const until = (page, fn, msg, timeout = 40000, arg = null) =>
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
const uniqueIds = (page) => Q(page, () => { const ids = [...document.querySelectorAll('[id]')].map((e) => e.id); return ids.length === new Set(ids).size; });
const reportErrors = (label) => { check(errors.length === 0, `${label}: no console errors, page errors or failed requests`); for (const e of errors.slice(0, 8)) console.log('    ', e); };
const finishAnims = (page) => Q(page, () => { for (const a of document.getAnimations()) try { a.finish(); } catch { /* */ } });

// ======================================================================
async function desktop() {
    console.log('\n== desktop 1280×760');
    const page = await open({ width: 1280, height: 760 });
    check(await backLinkOk(page), '← Games link is on top and points at ../index.html');
    check(await uniqueIds(page), 'every id in the page is unique');
    check(await Q(page, () => document.getElementById('btn-continue').hidden), 'no Continue without a save');
    const L = await layout(page);
    check(L.noHScroll && L.canvas, 'no sideways scroll; the canvas fills the window');
    await shot(page, 'desktop-title');

    await click(page, '#title-menu [data-act="newgame"]');
    await until(page, () => !document.getElementById('newgame').hidden, 'New Game opens the new-island sheet');
    await page.fill('#ng-name', 'Wren');
    await page.fill('#ng-seed', '4242');
    await click(page, '#ng-go');
    await until(page, () => __ww.mode === 'play' && __ww.G.name === 'Wren' && __ww.G.seed === 4242, 'Wash Ashore starts play with the chosen name and seed');
    // pointer lock may or may not be granted headless; make sure we're not left paused by it
    await page.waitForTimeout(300);
    await Q(page, () => { for (const id of [...__ww.ui.stack]) __ww.ui.closeScreen(id); });
    await until(page, () => !document.getElementById('hud').hidden, 'the HUD is shown');
    check(await Q(page, () => /shelter/i.test(document.getElementById('goal-text').textContent)), 'the first goal is to find shelter');

    // real keys walk; E gathers a piece of driftwood you face
    const z0 = await Q(page, () => __ww.G.p.z);
    await page.keyboard.down('KeyW');
    await until(page, (z) => __ww.G.p.z < z - 2, 'holding W walks forward (north)', 40000, z0);
    await page.keyboard.up('KeyW');
    await Q(page, () => { const k = __ww.G.pickups.find((p) => p.item === 'driftwood' && p.alive); __ww.put(k.x, k.z + 1.6, 0, -0.7); });
    await until(page, () => __ww.focus && __ww.focus.kind === 'pickup', 'looking at driftwood shows a prompt');
    await page.keyboard.press('KeyE');
    await until(page, () => (__ww.G.bag.driftwood || 0) >= 1, 'E gathers it');

    // pause
    await page.keyboard.press('Escape');
    await until(page, () => !document.getElementById('pause').hidden, 'Escape pauses');
    const t0 = await Q(page, () => __ww.G.t);
    await page.waitForTimeout(600);
    check(await Q(page, (t) => __ww.G.t === t, t0), 'the sim stops while paused');
    await page.keyboard.press('Escape');
    await until(page, () => document.getElementById('pause').hidden, 'Escape closes the pause screen');

    // into the hut: the journal, the Focus, the lintel
    await Q(page, () => { const W = __ww.view.W, d = W.hutAt('desk'); __ww.put(d.x - 1.3, d.z, Math.PI / 2, -0.3); });
    await until(page, () => __ww.focus?.id === 'desk', 'the desk is in focus inside the hut');
    await page.keyboard.press('KeyE');
    await until(page, () => !document.getElementById('pageview').hidden && __ww.G.hasWand, 'E at the desk takes the Focus and opens the journal');
    await shot(page, 'desktop-page');
    await page.keyboard.press('Escape');
    await until(page, () => document.getElementById('pageview').hidden && !__ww.G.dialog, 'Escape closes the page');
    await Q(page, () => { const W = __ww.view.W, c = W.hutAt('circle'); __ww.put(c.x, c.z, Math.PI, 0.45); });
    await until(page, () => __ww.focus?.id === 'lintel', 'the lintel is in focus above the circle');
    await page.keyboard.press('KeyE');
    await until(page, () => __ww.G.glyphs.length === 6, 'studying the lintel copies six marks');

    // the alembic through its sheet
    await Q(page, () => { const W = __ww.view.W, a = W.hutAt('alembic'); __ww.G.bag.kelp = 3; __ww.put(a.x + 1.3, a.z, -Math.PI / 2, -0.25); });
    await until(page, () => __ww.focus?.id === 'alembic', 'the alembic is in focus');
    await page.keyboard.press('KeyE');
    await until(page, () => !document.getElementById('inst').hidden, 'E opens the alembic');
    await click(page, '#inst-pick button[data-r="kelp"]');
    await click(page, '#inst-run');
    await until(page, () => !!__ww.G.notes.reagents.kelp?.essence && document.getElementById('inst-result').textContent.length > 20, 'distilling records what Bladderwrack carries');
    await page.keyboard.press('Escape');
    await until(page, () => document.getElementById('inst').hidden, 'Escape leaves the instrument');

    // the book: write a spell with its own controls, then cast it with F
    await page.keyboard.press('Tab');
    await until(page, () => !document.getElementById('book').hidden, 'Tab opens the book');
    await finishAnims(page);
    const plan = await Q(page, () => {
        const L = __ww.G.laws, e = L.reagents.kelp.essence;
        return { shape: L.glyphOf.ward, word: L.glyphOf[e], first: L.order === 'shape-first' };
    });
    for (const id of plan.first ? [plan.shape, plan.word] : [plan.word, plan.shape]) await click(page, `#book-body [data-add="${id}"]`);
    await Q(page, () => { const s = document.querySelector('#book-body select[data-feed]'); s.value = 'kelp'; s.dispatchEvent(new Event('change', { bubbles: true })); });
    await click(page, '#book-body [data-act="write"]');
    await until(page, () => __ww.G.wand[0].charges === 1, 'the book writes a spell into slot 1');
    await shot(page, 'desktop-book');
    await page.keyboard.press('Escape');
    await until(page, () => document.getElementById('book').hidden, 'Escape closes the book');
    await Q(page, () => { for (const id of [...__ww.ui.stack]) __ww.ui.closeScreen(id); });
    await page.waitForTimeout(400);
    await page.keyboard.press('KeyF');
    await until(page, () => __ww.seen.cast >= 1 && __ww.G.flags.firstSpell, 'F casts it: the first spell works');
    await Q(page, () => { __ww.G.tod = 0.2; });
    await page.waitForTimeout(800);
    await shot(page, 'desktop-cast');

    // the Marks tab and a pencil mark
    await page.keyboard.press('KeyJ');
    await until(page, () => !document.getElementById('book').hidden && document.querySelector('#book-body .grid'), 'J opens the Marks grid');
    await Q(page, () => document.querySelector('#book-body .gcell:not([disabled])').click());
    check(await Q(page, () => Object.keys(__ww.G.notes.pencil).length > 0), 'tapping a square pencils a guess');
    await page.keyboard.press('Escape');

    // save and continue
    const day = await Q(page, () => __ww.G.day);
    await page.keyboard.press('Escape');
    await until(page, () => !document.getElementById('pause').hidden, 'Escape pauses again');
    await click(page, '#pause-menu [data-act="quit"]');
    await until(page, () => __ww.mode === 'title' && !document.getElementById('btn-continue').hidden, 'Save & Quit returns to the title with Continue');
    await click(page, '#title-menu [data-act="continue"]');
    await until(page, () => __ww.mode === 'play' && __ww.G.flags.firstSpell && __ww.G.wand[0].glyphs.length === 2, 'Continue restores the game, spells and all');
    check(await Q(page, (d) => __ww.G.day === d, day), 'on the same day');

    // the bot plays to the end
    await Q(page, () => { for (const id of [...__ww.ui.stack]) __ww.ui.closeScreen(id); });
    for (let i = 0; i < 40; i++) {
        const done = await Q(page, () => { __ww.ff(150); return __ww.G.over; });
        if (done) break;
    }
    await until(page, () => __ww.mode === 'over' && !document.getElementById('ending').hidden, 'the bot frees Elowen and the ending is shown', 60000);
    await finishAnims(page);
    await shot(page, 'desktop-ending');
    check(await Q(page, () => document.getElementById('end-title').textContent.length > 2), 'the ending has a title');
    await click(page, '#end-title-btn');
    await until(page, () => __ww.mode === 'title', 'Return to Title');
    reportErrors('desktop');
}

// ======================================================================
async function phone(w, h) {
    console.log(`\n== phone ${w}×${h} (touch only)`);
    const page = await open({ width: w, height: h }, { touch: true });
    const cdp = await page.context().newCDPSession(page);
    const touch = (type, x, y, id = 1) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id }] });
    const tapSel = async (sel) => {
        await finishAnims(page);
        const r = await Q(page, (s) => { const e = document.querySelector(s); e?.scrollIntoView({ block: 'center' }); const b = e?.getBoundingClientRect(); return b && { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, sel);
        if (!r) return false;
        await page.touchscreen.tap(r.x, r.y);
        return true;
    };

    check(await backLinkOk(page), '← Games link is on top');
    await tapSel('#title-menu [data-act="newgame"]');
    await until(page, () => !document.getElementById('newgame').hidden, 'a tap on New Game opens the sheet');
    await tapSel('#ng-go');
    await until(page, () => __ww.mode === 'play', 'a tap on Wash Ashore starts play');
    await until(page, () => !document.getElementById('touch').hidden, 'the touch deck is shown');
    const L = await layout(page);
    check(L.noHScroll, 'no sideways scroll');
    check(L.canvas, 'the canvas matches the visible viewport');
    const sizes = await Q(page, () => ['#t-cast', '#t-use', '#t-jump', '#btn-pause', '#btn-book'].map((s) => {
        const r = document.querySelector(s).getBoundingClientRect();
        return { s, ok: r.width >= 44 && r.height >= 44 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight };
    }));
    for (const z of sizes) check(z.ok, `${z.s} is at least 44 px and on screen`);
    check(await Q(page, () => { const g = document.getElementById('goal').getBoundingClientRect(), v = document.getElementById('vitals').getBoundingClientRect(); return g.right <= innerWidth && v.right <= innerWidth && v.bottom <= innerHeight; }), 'goal and vitals stay on screen');

    // drag the stick up with a real touch
    const zone = await Q(page, () => { const r = document.getElementById('stick-zone').getBoundingClientRect(); return { x: r.left + r.width * 0.45, y: r.top + r.height * 0.55 }; });
    const z0 = await Q(page, () => __ww.G.p.z);
    await touch('touchStart', zone.x, zone.y);
    for (let i = 1; i <= 6; i++) await touch('touchMove', zone.x, zone.y - i * 12);
    await until(page, (z) => __ww.G.p.z < z - 1, 'dragging the stick walks', 40000, z0);
    await touch('touchEnd', 0, 0);
    // the look pad turns
    const look = await Q(page, () => { const r = document.getElementById('look-zone').getBoundingClientRect(); return { x: r.left + r.width * 0.5, y: r.top + r.height * 0.4 }; });
    const y0 = await Q(page, () => __ww.G.p.yaw);
    await touch('touchStart', look.x, look.y, 2);
    for (let i = 1; i <= 6; i++) await touch('touchMove', look.x + i * 15, look.y, 2);
    await touch('touchEnd', 0, 0, 2);
    await until(page, (y) => Math.abs(__ww.G.p.yaw - y) > 0.2, 'dragging the right side turns', 40000, y0);
    // Use gathers what you face
    await Q(page, () => { const k = __ww.G.pickups.find((p) => p.item === 'driftwood' && p.alive); __ww.put(k.x, k.z + 1.6, 0, -0.7); });
    await until(page, () => __ww.focus?.kind === 'pickup', 'something to gather in focus');
    await tapSel('#t-use');
    await until(page, () => (__ww.G.bag.driftwood || 0) >= 1, 'tapping Use gathers it');
    // Cast with a written spell
    await Q(page, () => { const G = __ww.G, L = G.laws; G.hasWand = true; G.glyphs = L.lintel.slice(); G.bag.kelp = 2; const e = L.reagents.kelp.essence; const gl = L.order === 'shape-first' ? [L.glyphOf.ward, L.glyphOf[e]] : [L.glyphOf[e], L.glyphOf.ward]; __ww.act({ t: 'inscribe', slot: 0, glyphs: gl, feed: gl.map((g) => (g === L.glyphOf[e] ? 'kelp' : null)), n: 1 }); });
    await tapSel('#t-cast');
    await until(page, () => (__ww.seen.cast || 0) >= 1, 'tapping Cast casts');
    await shot(page, `phone-${w}x${h}`);
    // the book by touch
    await tapSel('#btn-book');
    await until(page, () => !document.getElementById('book').hidden, 'the book button opens the book');
    await page.waitForTimeout(300);
    check(await Q(page, () => !document.getElementById('book').hidden), 'the book stays open after the finger lifts');
    check(await Q(page, () => { const b = document.querySelector('.book-close').getBoundingClientRect(); return b.bottom <= innerHeight && b.right <= innerWidth && b.top >= 0; }), 'the book\'s Close button is on screen');
    await shot(page, `phone-book-${w}x${h}`);
    await tapSel('.book-close');
    await until(page, () => document.getElementById('book').hidden, 'a tap on Close closes it');
    await tapSel('#btn-pause');
    await until(page, () => !document.getElementById('pause').hidden, 'tapping ❚❚ pauses');
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
    await Q(page, () => __ww.start(9));
    await until(page, () => __ww.mode === 'play', 'boots and starts a game with localStorage throwing');
    await Q(page, () => __ww.ff(30));
    check(await Q(page, () => __ww.save() === false), 'saving fails quietly');
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

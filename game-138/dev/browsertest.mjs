/**
 * browsertest.mjs — the real builder in real Chromium (SwiftShader WebGL).
 *
 * desktop (1280×760): boots with no errors, the ← Games link is on top, the welcome closes; the URL hash is the
 *   dungeon; the dice (a real click) reseeds and the hash follows; keys 2 / PageUp move between levels; a mix slider
 *   and a theme chip rebuild; Paint pins a square with a real click on the canvas; Place stamps an element with a real
 *   click, Tidy removes it, Ctrl+Z brings it back; the Share sheet's link opens to the very same dungeon in a new tab;
 *   W walks (held W moves the explorer), Esc returns; the tour (ff) meets friends and finds hoards; Escape closes
 *   Settings with a slider focused (game-117); Space presses a focused button (game-078); no sideways scroll.
 * phones (touch only, real CDP touches) at 390×844 and 844×390: taps through the welcome, the workbench tabs and the
 *   depth rail; controls ≥ 44 px and on screen; Walk, the stick walks, the look pad turns, Workbench returns.
 * nostorage: localStorage throws; the builder still builds, rebuilds and walks.
 * shared: opening a share link greets you with "Someone shared a dungeon" and builds exactly it.
 * Fails on any console error, page error or failed request.
 *
 *   python3 -m http.server 8138          # from the REPO ROOT
 *   node game-138/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8138), ONLY=desktop,phones,nostorage,shared, THREE_PKG.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8138';
const OUT = path.join(HERE, 'shots');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const want = (name) => !ONLY.length || ONLY.includes(name);
fs.mkdirSync(OUT, { recursive: true });

let fails = 0;
let errors = [];
let browser = null;

async function open(viewport, { touch = false, nostorage = false, hash = '' } = {}) {
    if (browser) await browser.close();
    browser = await chromium.launch({
        executablePath: process.env.PW_CHROMIUM_PATH || undefined,
        args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
    });
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch, permissions: ['clipboard-read', 'clipboard-write'] });
    await ctx.addInitScript((ns) => {
        if (ns) Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } });
        else try { localStorage.clear(); } catch { /* */ }
    }, nostorage);
    const page = await ctx.newPage();
    await routes(page);
    errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('requestfailed', (r) => { if (!r.url().includes('favicon')) errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`); });
    await page.goto(`${BASE}/game-138/index.html?debug=1&fast=4${hash}`);
    await page.waitForFunction(() => window.__lh && !document.getElementById('title').hidden, null, { timeout: 90000 });
    return page;
}
async function routes(page) {
    if (PKG) {
        // on the context, not the page: a page's routes were missed on a reload or a second page (the three.js modules
        // failed before the route saw them), so the reload / second-page steps timed out
        await page.context().route('https://unpkg.com/**', (route) => {
            const rel = new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, '');
            const file = path.join(PKG, rel);
            if (!fs.existsSync(file)) return route.abort();
            route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
        });
    }
    await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
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
const reportErrors = (label) => { check(errors.length === 0, `${label}: no console errors, page errors or failed requests`); for (const e of errors.slice(0, 8)) console.log('    ', e); };
/** Look straight down at the level (so a floor cell is never hidden behind a wall) and wait for the camera to settle. */
const topDown = async (page) => {
    await Q(page, () => { const o = __lh.view.orbit; o.goal.phi = 0.2; o.goal.theta = 0; __lh.view.frameLevel(false); });
    await page.waitForFunction(() => { const o = __lh.view.orbit; return Math.abs(o.phi - o.goal.phi) < 0.01 && Math.abs(o.r - o.goal.r) < 0.5; }, null, { timeout: 30000, polling: 100 });
};
/** A micro cell where `kind` can be stamped, near the middle of the shown level. */
const stampSpot = (page, kind) => Q(page, async (k) => {
    const F = await import('./js/sim/features.js');
    const L = __lh.G.d.levels[__lh.cur];
    const cands = [];
    for (let y = 1; y < L.mh - 1; y++) for (let x = 1; x < L.mw - 1; x++) if (!F.stampProblem(L, x, y, k)) cands.push({ x, y, d: Math.hypot(x - L.mw / 2, y - L.mh / 2) });
    cands.sort((a, b) => a.d - b.d);
    // a cell whose screen point really lands on it
    for (const c of cands.slice(0, 40)) {
        const p = __lh.screenOf(c.x, c.y, 0);
        const hit = __lh.view.pick(p.x, p.y);
        if (hit && hit.mx === c.x && hit.my === c.y) return { ...c, sx: p.x, sy: p.y };
    }
    return null;
}, kind);

// ======================================================================
async function desktop() {
    console.log('\n== desktop 1280×760');
    const page = await open({ width: 1280, height: 760 });
    check(await backLinkOk(page), '← Games link is on top and points at ../index.html');
    const L = await layout(page);
    check(L.noHScroll && L.canvas, 'no sideways scroll; the canvas fills the window');
    await shot(page, 'desktop-welcome');
    await click(page, '#title-menu [data-act="build"]');
    await until(page, () => document.getElementById('title').hidden && __lh.mode === 'build', 'Start building closes the welcome');
    check(await Q(page, async () => { const S = await import('./js/sim/share.js'); return JSON.stringify(S.decode(location.hash)) === JSON.stringify(__lh.G.params); }), 'the URL hash is the dungeon');
    await until(page, async () => (await import('./js/view/models.js')).modelState.ready, 'every Meshy model loads', 60000);
    check(await Q(page, async () => { const m = (await import('./js/view/models.js')).modelState; return m.failed === 0 && m.loaded === 17; }), '17 models, none failed');
    check(await Q(page, async () => { const t = (await import('./js/progress.js')).progressState.textures; return t && t.total > 5 && t.done === t.total; }), 'the loading screen waited for every texture to be painted');
    check(await Q(page, () => document.getElementById('loading').classList.contains('done') && document.getElementById('load-fill').style.width === '100%'), 'and its bar reached the end before it lifted');

    // the dice, with a real mouse click
    const seed0 = await Q(page, () => __lh.G.params.seed);
    const dice = await Q(page, () => { const r = document.getElementById('btn-dice').getBoundingClientRect(); return { x: r.x + r.width / 2, y: r.y + r.height / 2 }; });
    await page.mouse.click(dice.x, dice.y);
    await until(page, (s) => __lh.G.params.seed !== s && location.hash.includes('s=' + __lh.G.params.seed), 'the dice rolls a new seed and the link follows', 30000, seed0);
    check(await Q(page, () => __lh.undoDepth() === 1), 'and it can be undone');
    await shot(page, 'desktop-build');

    // levels with real keys
    await Q(page, () => document.activeElement?.blur());
    await page.keyboard.press('Digit2');
    await until(page, () => __lh.cur === 1 && document.querySelectorAll('.stop')[1].classList.contains('on'), 'key 2 shows level 2');
    await page.keyboard.press('PageUp');
    await until(page, () => __lh.cur === 0, 'PageUp goes back up');

    // a mix slider and a theme chip
    await Q(page, () => { const i = [...document.querySelectorAll('#mix input')][2]; i.value = 9; i.dispatchEvent(new Event('change', { bubbles: true })); });
    await until(page, () => __lh.G.params.mix.water === 9 && location.hash.includes('m=559'), 'the water slider rebuilds with more water');
    await click(page, '.tab[data-tab="themes"]');
    // watch the busy chip: it must appear while the level regrows and new stone is painted, then go away
    await Q(page, () => { window.__busySeen = []; new MutationObserver(() => { const b = document.getElementById('busy'); if (!b.hidden) window.__busySeen.push(document.getElementById('busy-text').textContent); }).observe(document.getElementById('busy'), { attributes: true, subtree: true, childList: true, characterData: true }); });
    await Q(page, () => document.querySelectorAll('.theme-row')[0].querySelectorAll('.chip')[5].click());
    await until(page, () => __lh.G.params.themes[0] === 'grotto' && __lh.G.d.levels[0].theme === 'grotto', 'a theme chip turns level 1 to crystal');
    await until(page, () => window.__busySeen.some((t) => t.includes('Growing')), 'the busy chip says the dungeon is growing');
    await until(page, () => window.__busySeen.some((t) => t.includes('Painting new stone')), 'and that new stone is being painted');
    await until(page, async () => document.getElementById('busy').hidden && (await import('./js/progress.js')).pending('textures') === 0, 'then goes away when the crystal is painted', 60000);

    // paint a square with a real click on the canvas
    await click(page, '.tab[data-tab="tools"]');
    await click(page, '.tool[data-tool="paint"]');
    await click(page, '.brush[data-b="well"]');
    await topDown(page);
    const cell = await Q(page, () => {
        const L = __lh.G.d.levels[0];
        for (let y = 2; y < L.h - 2; y++) for (let x = 2; x < L.w - 2; x++) {
            const p = __lh.screenOf(x * 3 + 1, y * 3 + 1, 3.2);
            const hit = __lh.view.pick(p.x, p.y);
            if (hit && hit.cx === x && hit.cy === y && Math.abs(x - L.up.cx) + Math.abs(y - L.up.cy) > 2 && (!L.down || Math.abs(x - L.down.cx) + Math.abs(y - L.down.cy) > 2)) return { x, y, sx: p.x, sy: p.y };
        }
        return null;
    });
    check(!!cell, 'found a square to paint');
    if (cell) {
        await page.mouse.click(cell.sx, cell.sy);
        await until(page, (c) => __lh.G.params.pins.some((p) => p.l === 0 && p.x === c.x && p.y === c.y && p.b === 'well'), 'a click with the Well brush pins that square', 30000, cell);
        check(await Q(page, (c) => { const L = __lh.G.d.levels[0]; return L.loosened || L.grid[c.y * 3 + 1][c.x * 3 + 1] === 'o'; }, cell), 'and a well grows there');
    }

    // place, tidy, undo
    await click(page, '.tool[data-tool="stamp"]');
    await click(page, '.stamp[data-k="cauldron"]');
    await topDown(page);
    const spot = await stampSpot(page, 'cauldron');
    check(!!spot, 'found a floor cell to place on');
    if (spot) {
        await page.mouse.click(spot.sx, spot.sy);
        await until(page, (s) => __lh.G.d.levels[0].features.some((f) => f.kind === 'cauldron' && f.mx === s.x && f.my === s.y), 'a click places a cauldron there', 30000, spot);
        await click(page, '.tool[data-tool="erase"]');
        await topDown(page);
        const p2 = await Q(page, (s) => __lh.screenOf(s.x, s.y, 0.4), spot);
        await page.mouse.click(p2.x, p2.y);
        await until(page, (s) => !__lh.G.d.levels[0].features.some((f) => f.kind === 'cauldron' && f.mx === s.x && f.my === s.y), 'Tidy takes it away', 30000, spot);
        await Q(page, () => document.activeElement?.blur());
        await page.keyboard.press('Control+KeyZ');
        await until(page, (s) => __lh.G.d.levels[0].features.some((f) => f.kind === 'cauldron' && f.mx === s.x && f.my === s.y), 'Ctrl+Z brings it back', 30000, spot);
    }
    await click(page, '.tool[data-tool="look"]');
    await shot(page, 'desktop-edited');

    // share, and open the link in a new tab
    await click(page, '#btn-share');
    await until(page, () => !document.getElementById('share').hidden && document.getElementById('share-url').value.includes('#s='), 'Share opens with the link');
    await click(page, '#btn-copy');
    const url = await Q(page, () => document.getElementById('share-url').value);
    const before = await Q(page, () => JSON.stringify(__lh.G.d.levels.map((L) => [L.grid, L.features.map((f) => f.id + f.kind)])));
    const p2 = await page.context().newPage();
    await routes(p2);
    await p2.goto(url.replace("#", "?debug=1#"), { waitUntil: "domcontentloaded", timeout: 90000 });
    await p2.waitForFunction(() => window.__lh && document.getElementById('loading').classList.contains('done'), null, { timeout: 120000 });
    check(await p2.evaluate((b) => JSON.stringify(__lh.G.d.levels.map((L) => [L.grid, L.features.map((f) => f.id + f.kind)])) === b, before), 'the shared link opens the very same dungeon, edits and all');
    check(await p2.evaluate(() => document.getElementById('welcome-text').textContent.includes('shared')), 'and greets you with "Someone shared a dungeon"');
    await p2.close();
    await page.keyboard.press('Escape');
    await until(page, () => document.getElementById('share').hidden, 'Escape closes the Share sheet');

    // Escape closes Settings with a slider focused (game-117)
    await click(page, '#btn-settings');
    await until(page, () => !document.getElementById('settings').hidden, 'Settings opens');
    await Q(page, () => document.getElementById('set-sfx').focus());
    await page.keyboard.press('Escape');
    await until(page, () => document.getElementById('settings').hidden, 'Escape closes Settings even with a slider focused');

    // Space presses a focused button (game-078)
    await click(page, '#btn-help');
    await until(page, () => !document.getElementById('howto').hidden, 'How it works opens');
    await Q(page, () => document.querySelector('#howto [data-close]').focus());
    await page.keyboard.press('Space');
    await until(page, () => document.getElementById('howto').hidden, 'Space on the focused "Lovely" button closes it');

    // walk
    await Q(page, () => document.activeElement?.blur());
    await page.keyboard.press('KeyW');
    await until(page, () => __lh.mode === 'walk' && !document.getElementById('walk').hidden, 'W starts walking');
    const d0 = await Q(page, () => __lh.G.dist);
    await page.keyboard.down('KeyW');
    await until(page, (d) => __lh.G.dist > d + 1, 'holding W walks forward', 30000, d0);
    await page.keyboard.up('KeyW');
    await shot(page, 'desktop-walk');
    const done = await Q(page, () => __lh.ff(1500));
    check(done, 'the tour walks to the bottom of the dungeon');
    await until(page, () => (__lh.seen.befriend || 0) > 0 && (__lh.seen.loot || 0) > 0 && (__lh.seen.stairs || 0) > 0, 'friends are met, hoards found and stairs taken');
    await until(page, () => /💛 (\d+)\/\1$/.test(document.getElementById('walk-friends').textContent) && __lh.G.friends > 0, 'the HUD counts every friend met');
    await page.keyboard.press('Escape');
    await until(page, () => __lh.mode === 'build' && !document.body.classList.contains('walking'), 'Escape returns to the workbench');
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
    await tapSel('#title-menu [data-act="build"]');
    await until(page, () => document.getElementById('title').hidden, 'a tap on Start building closes the welcome');
    const L = await layout(page);
    check(L.noHScroll, 'no sideways scroll');
    check(L.canvas, 'the canvas matches the visible viewport');
    const sizes = await Q(page, () => ['.tab', '#btn-walk', '#btn-share', '#btn-dice', '.stop', '#btn-settings'].map((s) => {
        const r = document.querySelector(s).getBoundingClientRect();
        return { s, ok: r.width >= 44 && r.height >= 44 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5 };
    }));
    for (const z of sizes) check(z.ok, `${z.s} is at least 44 px and on screen`);
    const overlap = await Q(page, () => {
        const a = document.getElementById('back-link').getBoundingClientRect(), b = document.querySelector('.brand').getBoundingClientRect();
        return a.right <= b.left || a.bottom <= b.top;
    });
    check(overlap, 'the title pill does not sit under the ← Games link');
    await tapSel('.tab[data-tab="elements"]');
    await until(page, () => document.querySelector('.pane[data-pane="elements"]').classList.contains('on'), 'a tap on Elements opens that pane');
    await tapSel('.stop:nth-child(2)');
    await until(page, () => __lh.cur === 1, 'a tap on depth stop 2 shows level 2');
    await shot(page, `phone-${w}x${h}-build`);

    await tapSel('#btn-walk');
    await until(page, () => __lh.mode === 'walk' && !document.getElementById('touch').hidden, 'Walk starts walking with the touch deck shown');
    const zone = await Q(page, () => { const r = document.getElementById('stick-zone').getBoundingClientRect(); return { x: r.left + r.width * 0.5, y: r.top + r.height * 0.6 }; });
    const d0 = await Q(page, () => __lh.G.dist);
    await touch('touchStart', zone.x, zone.y);
    for (let i = 1; i <= 6; i++) await touch('touchMove', zone.x, zone.y - i * 12);
    await until(page, (d) => __lh.G.dist > d + 0.5, 'pushing the stick walks', 30000, d0);
    await touch('touchEnd', 0, 0);
    const look = await Q(page, () => { const r = document.getElementById('look-zone').getBoundingClientRect(); return { x: r.left + r.width * 0.5, y: r.top + r.height * 0.5 }; });
    const yaw0 = await Q(page, () => __lh.G.yaw);
    await touch('touchStart', look.x, look.y);
    for (let i = 1; i <= 6; i++) await touch('touchMove', look.x + i * 15, look.y);
    await touch('touchEnd', 0, 0);
    await until(page, (y) => Math.abs(__lh.G.yaw - y) > 0.05, 'dragging on the right turns the view', 30000, yaw0);
    await shot(page, `phone-${w}x${h}-walk`);
    await tapSel('#btn-leave');
    await until(page, () => __lh.mode === 'build' && document.getElementById('touch').hidden, 'Workbench returns to building');
    reportErrors(`phone ${w}×${h}`);
}

// ======================================================================
async function nostorage() {
    console.log('\n== blocked storage');
    const page = await open({ width: 1280, height: 760 }, { nostorage: true });
    await click(page, '#title-menu [data-act="build"]');
    await until(page, () => document.getElementById('title').hidden, 'boots with localStorage throwing');
    await click(page, '#btn-dice');
    await until(page, () => __lh.undoDepth() === 1, 'and still rebuilds');
    await Q(page, () => __lh.startWalk());
    await until(page, () => __lh.mode === 'walk', 'and still walks');
    reportErrors('nostorage');
}

// ======================================================================
async function shared() {
    console.log('\n== a shared link');
    const hash = '#s=sleepy-otter-8&z=s&n=2&m=5593&e=595564&t=fc&p=0.5.4.o&k=1.10.10.dragon';
    const page = await open({ width: 1280, height: 760 }, { hash });
    check(await Q(page, () => document.getElementById('welcome-text').textContent.includes('shared')), 'the welcome says someone shared it');
    check(await Q(page, () => document.querySelector('#title-menu button').dataset.act === 'walk'), 'and offers Walk first');
    check(await Q(page, () => { const p = __lh.G.params; return p.seed === 'sleepy-otter-8' && p.size === 's' && p.levels === 2 && p.themes.join() === 'frost,grotto' && p.mix.pits === 3 && p.el.hoards === 9 && p.pins.length === 1; }), 'every part of the link is honoured');
    await click(page, '#title-menu [data-act="walk"]');
    await until(page, () => __lh.mode === 'walk', 'Walk it goes straight in');
    await shot(page, 'shared-walk');
    reportErrors('shared');
}

try {
    if (want('desktop')) await desktop();
    if (want('phones')) { await phone(390, 844); await phone(844, 390); }
    if (want('nostorage')) await nostorage();
    if (want('shared')) await shared();
} catch (err) {
    fails++;
    console.log('  FAIL threw:', err.message);
} finally {
    if (browser) await browser.close();
}
console.log(`\n${fails ? `${fails} FAILED` : 'all passed'} · screenshots in ${path.relative(process.cwd(), OUT)}`);
process.exit(fails ? 1 : 0);

/**
 * browsertest.mjs — ROMANCER in real Chromium (SwiftShader WebGL).
 *
 * desktop (1280×760): the title with no errors and the ← Games link on top → New Expedition, a
 *   name, the prologue read with real Enter presses → the Workbench → draw the ball with a real
 *   mouse drag → set the ball's bounce and the paddle's control in OBJECTS → Play: real keys move
 *   the paddle → a point → Stop → the cartridge is restored, VESTA remembers, the colour DAC comes
 *   back → a script error shows its line in CODE → Export burns an HTML file, and that file plays
 *   on its own in a fresh page → the Studio: a new cart, an object, save → reload → Continue
 *   brings it all back. Every editor tab opens.
 * phones (touch only, real CDP touches) at 390×844 and 844×390: taps through the title, the
 *   logbook and the dialogue, the dock, the workbench tabs; a finger draws on the sprite canvas;
 *   Play shows the pad; holding ▲ moves the paddle; controls are ≥ 44 px and on screen; no sideways
 *   scroll; the canvas matches the visible viewport.
 * nostorage: localStorage throws; the game boots and plays a cart.
 * Fails on any console error, page error or failed request.
 *
 *   python3 -m http.server 8084          # from the REPO ROOT
 *   node game-084/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8084), ONLY=desktop,phones,nostorage, THREE_PKG.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8084';
const OUT = path.join(HERE, 'shots');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const want = (name) => !ONLY.length || ONLY.includes(name);
fs.mkdirSync(OUT, { recursive: true });

let fails = 0;
let errors = [];
let browser = null;

async function launch() {
    if (browser) await browser.close();
    browser = await chromium.launch({
        executablePath: process.env.PW_CHROMIUM_PATH || undefined,
        args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
    });
}
async function route(page) {
    if (PKG) {
        await page.route('https://unpkg.com/**', (r) => {
            const file = path.join(PKG, new URL(r.request().url()).pathname.replace(/^\/three@0\.165\.0\//, ''));
            if (!fs.existsSync(file)) return r.abort();
            r.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
        });
    }
    // REAL_FONTS=1 loads Orbitron and Share Tech Mono for real: the system fallback is much narrower
    if (!process.env.REAL_FONTS) await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('requestfailed', (r) => { if (!r.url().includes('favicon')) errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`); });
}
async function open(viewport, { touch = false, nostorage = false, keep = false } = {}) {
    if (!keep) await launch();
    const ctx = keep && keep.context ? keep.context : await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch, acceptDownloads: true });
    if (!keep) {
        await ctx.addInitScript((ns) => {
            if (ns) Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } });
            else if (!sessionStorage.getItem('rm-keep')) { try { localStorage.clear(); } catch { /* */ } sessionStorage.setItem('rm-keep', '1'); }
        }, nostorage);
    }
    const page = await ctx.newPage();
    await route(page);
    errors = [];
    await page.goto(`${BASE}/game-084/index.html?debug=1&fast=4`);
    await page.waitForFunction(() => window.__rm && __rm.mode === 'title', null, { timeout: 60000 });
    return page;
}

const check = (cond, msg) => { if (!cond) { fails++; console.log('  FAIL', msg); } else console.log('  ok', msg); return cond; };
const Q = (page, fn, arg) => page.evaluate(fn, arg);
const shot = async (page, name) => { await page.screenshot({ path: path.join(OUT, `bt-${name}.png`) }); };
const until = (page, fn, msg, timeout = 30000, arg = null) =>
    page.waitForFunction(fn, arg, { timeout, polling: 100 }).then(() => check(true, msg), () => check(false, msg));
// Playwright's click() waits for frames to settle, which SwiftShader never does: click from inside.
const click = (page, sel) => Q(page, (s) => { const e = document.querySelector(s); if (!e) return false; e.click(); return true; }, sel);
const center = (page, sel) => Q(page, (s) => { const e = document.querySelector(s); if (!e) return null; e.scrollIntoView({ block: 'nearest' }); const b = e.getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2, w: b.width, h: b.height }; }, sel);
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
/** Read the dialogue to its end with real key presses. */
async function readScene(page) {
    // one press at a time, each consumed before the next (menus take one press per frame)
    for (let i = 0; i < 80; i++) {
        if (await Q(page, () => document.getElementById('dialogue').hidden)) return true;
        await page.keyboard.press('Enter');
        await page.waitForFunction(() => __rm.input.queue.length === 0, null, { timeout: 10000, polling: 50 }).catch(() => {});
    }
    return false;
}
const task = (page, id, t) => Q(page, ([m, k]) => __rm.tasks(m).find((s) => s.id === k).done, [id, t]);

// ======================================================================
async function desktop() {
    console.log('\n== desktop 1280×760');
    const page = await open({ width: 1280, height: 760 });
    check(await backLinkOk(page), '← Games link is on top and points at ../index.html');
    check(await Q(page, () => document.getElementById('btn-continue').hidden), 'no Continue without a save');
    const L = await layout(page);
    check(L.noHScroll && L.canvas, 'no sideways scroll; the canvas fills the window');
    // the logo is gradient-clipped text: if it overflows its column the overflow is simply invisible
    await page.evaluate(() => document.fonts.ready);
    check(await Q(page, () => { const l = document.querySelector('.logo'); return l.scrollWidth <= l.clientWidth + 1; }), 'the ROMANCER logo fits its column (run with REAL_FONTS=1 to check the real typeface)');
    await shot(page, 'desktop-title');

    await click(page, '#btn-new');
    await until(page, () => !document.getElementById('name').hidden, 'New Expedition asks for a name');
    await page.fill('#name-input', 'TESTER');
    await click(page, '#name-go');
    await until(page, () => __rm.mode === 'lab' && !document.getElementById('dialogue').hidden, 'the prologue starts in the lab');
    await shot(page, 'desktop-prologue');
    check(await readScene(page), 'Enter reads the whole prologue');
    check(await Q(page, () => __rm.P.name === 'TESTER' && __rm.hasSave()), 'the expedition is saved under the name');
    check(await Q(page, () => document.getElementById('hub-title').textContent === 'RALLY'), 'the lab says RALLY is next');
    await shot(page, 'desktop-lab');

    await click(page, '#dock-bench');
    await until(page, () => !document.getElementById('dialogue').hidden, 'the workbench starts with VESTA\'s briefing');
    await readScene(page);
    await until(page, () => __rm.mode === 'bench' && __rm.bench.tab === 'sprites' && __rm.bench.spr === 3, 'the bench opens on SPRITES at the ball\'s slot');
    // draw the ball with a real mouse drag
    const cv = await center(page, '#bench-main canvas.px');
    await page.mouse.move(cv.x - cv.w * 0.2, cv.y);
    await page.mouse.down();
    for (let i = 0; i <= 8; i++) await page.mouse.move(cv.x - cv.w * 0.2 + (i * cv.w * 0.4) / 8, cv.y + (i % 2) * cv.h * 0.12);
    await page.mouse.up();
    await until(page, () => __rm.tasks('rally').find((s) => s.id === 'ball').done, 'a mouse drag draws the ball (task ticks)');
    await shot(page, 'desktop-sprites');
    // OBJECTS: the ball's bounce, the paddle's control
    await click(page, '#bench-tabs [data-tab="objects"]');
    await until(page, () => __rm.bench.tab === 'objects', 'OBJECTS opens');
    await Q(page, () => { [...document.querySelectorAll('#bench-main .list button')].find((b) => b.textContent.startsWith('ball')).click(); });
    await Q(page, () => { const s = document.querySelector('#bench-main input[aria-label="bounce"]'); s.value = 1; s.dispatchEvent(new Event('change')); });
    // the paddle task's own button selects the object it means (a player once set the ball's control instead)
    await Q(page, () => [...document.querySelectorAll('[data-task="paddle"] .t-acts .btn')].find((b) => /Go to objects/i.test(b.textContent)).click());
    await until(page, () => __rm.bench.tab === 'objects' && document.querySelector('#bench-main .list button.on')?.textContent.startsWith('player'), '"Go to objects: player" selects the paddle', 10000);
    await page.selectOption('#bench-main select[aria-label="Control"]', 'paddle_v', { timeout: 5000 }).catch(() => Q(page, () => { const s = document.querySelector('#bench-main select[aria-label="Control"]'); s.value = 'paddle_v'; s.dispatchEvent(new Event('change')); }));
    await until(page, () => ['bounce', 'paddle'].every((k) => __rm.tasks('rally').find((s) => s.id === k).done), 'the inspector fixes the bounce and the paddle');
    await shot(page, 'desktop-objects');
    for (const t of ['code', 'map', 'sound', 'music']) check(await Q(page, (tab) => document.querySelector(`#bench-tabs [data-tab="${tab}"]`).classList.contains('locked'), t), `${t} is still locked on RALLY`);

    // play it on the television with real keys
    await click(page, '#bench-play');
    await until(page, () => __rm.mode === 'play' && !document.getElementById('playbar').hidden, 'Play puts the cart on the television');
    const y0 = await Q(page, () => __rm.run.objs.find((o) => o.type === 'player').y);
    await page.keyboard.down('ArrowDown');
    await until(page, (y) => __rm.run.objs.find((o) => o.type === 'player').y > y + 6, 'holding ↓ moves the paddle', 30000, y0);
    await page.keyboard.up('ArrowDown');
    await shot(page, 'desktop-play');
    await Q(page, () => { __rm.autoplay(true); });
    await until(page, () => __rm.run && __rm.run.globals.score >= 1, 'the paddle scores a point', 120000);
    await Q(page, () => { __rm.autoplay(false); });
    await page.keyboard.press('Escape');
    await until(page, () => !document.getElementById('restored').hidden, 'stopping with a point scored restores the cartridge');
    await shot(page, 'desktop-restored');
    check(await Q(page, () => document.getElementById('restored-list').textContent.includes('8 colours')), 'the restore lists the colour DAC coming back');
    await click(page, '#restored-ok');
    await until(page, () => !document.getElementById('dialogue').hidden, 'VESTA remembers');
    await readScene(page);
    check(await Q(page, () => __rm.P.missions.rally.state === 'done' && __rm.P.missions.brick.state === 'open' && __rm.P.ach.first_light), 'RALLY is restored, BRICKBREAK recovered, First Light given');
    check(await Q(page, () => document.getElementById('hub-mem').textContent === '11%'), 'VESTA\'s memory reads 11%');

    // BRICKBREAK: CODE shows a script error with its line
    await click(page, '#dock-bench');
    await until(page, () => !document.getElementById('dialogue').hidden, 'the second briefing');
    await readScene(page);
    await until(page, () => __rm.mode === 'bench', 'BRICKBREAK is on the bench');
    await click(page, '#bench-tabs [data-tab="code"]');
    await Q(page, () => { const s = document.querySelector('#bench-main select[aria-label="Which script"]'); s.value = 'ball'; s.dispatchEvent(new Event('change')); });
    await Q(page, () => { const t = document.querySelector('#bench-main textarea'); t.focus(); t.setSelectionRange(t.value.length, t.value.length); });
    await page.keyboard.type('\non bump\n  if tile >= 5 then\n  settile(tx, ty, 0)\n  score += 1\nend\nend\n');
    await until(page, () => __rm.tasks('brick').find((s) => s.id === 'bump').done, 'typing the on bump handler ticks the task');
    await page.keyboard.type('oops = = 1\n');
    await until(page, () => /line \d+/.test(document.querySelector('#bench-main .code-status').textContent) && document.querySelector('.code-gutter .err'), 'a typo shows the error and marks its line');
    await shot(page, 'desktop-code');
    await Q(page, () => { const t = document.querySelector('#bench-main textarea'); t.value = t.value.replace(/^.*oops.*$/m, ''); t.dispatchEvent(new Event('input')); });
    await until(page, () => /understands/.test(document.querySelector('#bench-main .code-status').textContent), 'fixing it clears the error', 10000);
    for (const t of ['map', 'objects', 'sprites', 'sound', 'cart']) {
        await click(page, `#bench-tabs [data-tab="${t}"]`);
        await until(page, (tab) => __rm.bench.tab === tab && document.getElementById('bench-main').children.length > 0, `the ${t} tab opens`, 10000, t);
    }
    await shot(page, 'desktop-cart');

    // the burner: export HTML and play the file on its own
    const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), click(page, '#bench-main .btn.primary')]);
    const file = path.join(OUT, 'exported-brickbreak.html');
    await dl.saveAs(file);
    const html = fs.readFileSync(file, 'utf8');
    check(html.startsWith('<!DOCTYPE html>') && html.includes('vesta-cart'), 'Export downloads a standalone HTML file');
    const errBefore = errors.length;
    const p2 = await page.context().newPage();
    const errs2 = [];
    p2.on('pageerror', (e) => errs2.push(e.message));
    p2.on('console', (m) => { if (m.type() === 'error') errs2.push(m.text()); });
    let net = 0;
    await p2.route('**/*', (r) => { if (r.request().url().startsWith('file:')) return r.continue(); net++; return r.abort(); });
    await p2.goto('file://' + file);
    await p2.waitForTimeout(500);
    await p2.keyboard.press('Space');
    await p2.keyboard.down('ArrowLeft');
    await p2.waitForTimeout(1500);
    await p2.keyboard.up('ArrowLeft');
    const lit = await p2.evaluate(() => { const c = document.querySelector('#vx-crt canvas'); const d = c.getContext('2d').getImageData(0, 0, c.width, c.height).data; let n = 0; for (let i = 0; i < d.length; i += 4) if (d[i] + d[i + 1] + d[i + 2] > 60) n++; return { n, started: document.getElementById('vx-start').classList.contains('vx-hide') }; });
    check(lit.started && lit.n > 400, `the exported file plays on its own from file://, with no network (${lit.n} lit pixels)`);
    check(errs2.length === 0 && net === 0, 'the exported file loads nothing and logs no errors');
    for (const e of errs2) console.log('    ', e);
    await p2.screenshot({ path: path.join(OUT, 'bt-exported.png') });
    await p2.close();
    errors.length = errBefore;
    check(await Q(page, () => __rm.P.ach.burner), 'the Cartridge Burner commendation');

    // the Studio
    await click(page, '#bench-back');
    await until(page, () => __rm.mode === 'lab', 'back to the lab');
    await Q(page, () => document.querySelector('#dock [data-act="studio"]').click());
    await until(page, () => !document.getElementById('studio').hidden, 'the Studio opens');
    await click(page, '#studio-create');
    await until(page, () => __rm.mode === 'bench' && __rm.bench.mode === 'studio', 'a blank Studio cartridge is on the bench');
    await click(page, '#bench-tabs [data-tab="objects"]');
    await Q(page, () => [...document.querySelectorAll('#bench-main .btn')].find((b) => b.textContent.includes('New')).click());
    await until(page, () => __rm.bench.cart.types.length === 1, 'a new object type');
    await Q(page, () => __rm.save());
    await page.reload();
    await page.waitForFunction(() => window.__rm && __rm.mode === 'title', null, { timeout: 60000 });
    check(await Q(page, () => !document.getElementById('btn-continue').hidden), 'after a reload the title offers Continue');
    await click(page, '#btn-continue');
    await until(page, () => __rm.mode === 'lab' && __rm.P.missions.rally.state === 'done' && __rm.P.creative.length === 1 && __rm.P.creative[0].cart.types.length === 1, 'Continue restores the expedition and the Studio cart');
    // Space on a focused menu button presses it (game-078)
    await Q(page, () => document.querySelector('#dock [data-act="menu"]').click());
    await until(page, () => !document.getElementById('menu').hidden, 'the menu opens');
    await Q(page, () => document.querySelector('#menu-menu [data-act="resume"]').focus());
    await page.keyboard.press('Space');
    await until(page, () => document.getElementById('menu').hidden, 'Space presses the focused button');
    reportErrors('desktop');
}

// ======================================================================
async function phone(w, h) {
    console.log(`\n== phone ${w}×${h} (touch only)`);
    const page = await open({ width: w, height: h }, { touch: true });
    const cdp = await page.context().newCDPSession(page);
    const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
    const tap = async (sel) => { const r = await center(page, sel); if (!r) return false; await page.touchscreen.tap(r.x, r.y); return true; };
    const tapScene = async () => { for (let i = 0; i < 120 && !(await Q(page, () => document.getElementById('dialogue').hidden)); i++) { await page.touchscreen.tap(w / 2, h - 60); await page.waitForTimeout(40); } };

    check(await backLinkOk(page), '← Games link is on top');
    await tap('#btn-new');
    await until(page, () => !document.getElementById('name').hidden, 'a tap on New Expedition');
    await tap('#name-go');
    await until(page, () => __rm.mode === 'lab', 'a tap reports for duty');
    await tapScene();
    check(await Q(page, () => document.getElementById('dialogue').hidden), 'taps read the prologue');
    const L = await layout(page);
    check(L.noHScroll, 'no sideways scroll');
    check(L.canvas, 'the canvas matches the visible viewport');
    const dock = await Q(page, () => [...document.querySelectorAll('#dock .dock-btn')].map((b) => { const r = b.getBoundingClientRect(); return r.width >= 44 && r.height >= 44 && r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight; }));
    check(dock.every(Boolean), 'every dock button is at least 44 px and on screen');
    await shot(page, `phone-${w}x${h}-lab`);
    await tap('#dock-bench');
    await tapScene();
    await until(page, () => __rm.mode === 'bench', 'the dock opens the workbench');
    // a finger draws on the sprite canvas
    const cv = await center(page, '#bench-main canvas.px');
    await touch('touchStart', cv.x - cv.w * 0.25, cv.y);
    for (let i = 1; i <= 6; i++) await touch('touchMove', cv.x - cv.w * 0.25 + i * cv.w * 0.08, cv.y + (i % 2) * cv.h * 0.12);
    await touch('touchEnd', 0, 0);
    await until(page, () => __rm.tasks('rally').find((s) => s.id === 'ball').done, 'a finger draws the ball');
    await shot(page, `phone-${w}x${h}-bench`);
    const tabs = await Q(page, () => [...document.querySelectorAll('#bench-tabs button')].every((b) => b.getBoundingClientRect().height >= 40));
    check(tabs, 'the workbench tabs are finger-sized');
    await tap('#bench-tabs [data-tab="objects"]');
    await until(page, () => __rm.bench.tab === 'objects', 'a tap opens OBJECTS');
    check((await layout(page)).noHScroll, 'no sideways scroll on the workbench');
    await Q(page, () => __rm.repairAll('rally'));
    await tap('#bench-play');
    await until(page, () => __rm.mode === 'play' && !document.getElementById('pad').hidden, 'Play shows the touch pad');
    const sizes = await Q(page, () => ['#dpad [data-b="up"]', '#dpad [data-b="down"]', '#abpad [data-b="a"]', '#play-stop'].map((s) => {
        const r = document.querySelector(s).getBoundingClientRect();
        return { s, ok: r.width >= 44 && r.height >= 44 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight };
    }));
    for (const z of sizes) check(z.ok, `${z.s} is at least 44 px and on screen`);
    const y0 = await Q(page, () => __rm.run.objs.find((o) => o.type === 'player').y);
    const up = await center(page, '#dpad [data-b="down"]');
    await touch('touchStart', up.x, up.y);
    await until(page, (y) => __rm.run.objs.find((o) => o.type === 'player').y > y + 4, 'holding ▼ on the pad moves the paddle', 30000, y0);
    await touch('touchEnd', 0, 0);
    await shot(page, `phone-${w}x${h}-play`);
    await tap('#play-stop');
    await until(page, () => __rm.mode === 'bench', 'Stop returns to the workbench');
    reportErrors(`phone ${w}×${h}`);
}

// ======================================================================
async function nostorage() {
    console.log('\n== blocked storage');
    const page = await open({ width: 1280, height: 760 }, { nostorage: true });
    await Q(page, () => { __rm.start('NOSAVE'); __rm.insert('rally'); });
    await until(page, () => __rm.mode === 'bench', 'boots and opens the workbench with localStorage throwing');
    await Q(page, () => { __rm.repairAll('rally'); __rm.play(); __rm.autoplay(true); });
    await until(page, () => __rm.mode === 'play' && __rm.run.stats.frames > 30, 'and plays a cart');
    check(await Q(page, () => __rm.save() === undefined && !__rm.hasSave()), 'saving fails quietly');
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

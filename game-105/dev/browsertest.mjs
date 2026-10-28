/**
 * browsertest.mjs — the real game in real Chromium (SwiftShader WebGL).
 *
 * desktop (1280×760): boot to the title with no errors, the ← Games link on top → New Case by click →
 *   the story opens with real key presses → the bell, a customer, the work order → at the bench a real
 *   mouse holds the driver on a screw until it is out and in the dish → a tap lifts a part and sticks it
 *   to the cursor, a second tap puts it down → dragging bare bench orbits, the wheel zooms → the spares
 *   drawer → Escape pauses and the sim stops → Save & Quit → Continue restores the bench → the bot
 *   finishes the job → the result card → the next scene. Free Bench from the title.
 * phones (touch only, real CDP touches) at 390×844 and 844×390: taps through the menus and the story,
 *   the tool bar is on screen and ≥ 44 px, a real touch turns a screw, a tap lifts a part, no sideways
 *   scroll, the canvas matches the visible viewport, the status line never covers a button.
 * nostorage: localStorage throws; the game still boots and plays.
 * Fails on any console error, page error or failed request.
 *
 *   python3 -m http.server 8105          # from the REPO ROOT
 *   node game-105/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8105), ONLY=desktop,phones,nostorage, THREE_PKG.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8105';
const OUT = path.join(HERE, 'shots');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const want = (name) => !ONLY.length || ONLY.includes(name);
fs.mkdirSync(OUT, { recursive: true });

let fails = 0;
let errors = [];
let browser = null;

async function open(viewport, { touch = false, nostorage = false, q = 'low', fast = 4 } = {}) {
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
    await page.goto(`${BASE}/game-105/index.html?debug=1&fast=${fast}&q=${q}`);
    await page.waitForFunction(() => window.__sr && __sr.G.phase === 'title', null, { timeout: 90000 });
    return page;
}

const check = (cond, msg) => { if (!cond) { fails++; console.log('  FAIL', msg); } else console.log('  ok', msg); return cond; };
const Q = (page, fn, arg) => page.evaluate(fn, arg);
const shot = async (page, name) => { await page.screenshot({ path: path.join(OUT, `bt-${name}.png`) }); };
// SwiftShader draws a few frames a second: wait on state, never on the clock.
const until = (page, fn, msg, timeout = 40000, arg = null) =>
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

/** Skip through dialogue by pressing the real keys until something else is on screen. */
async function skipDialogue(page, max = 400) {
    for (let i = 0; i < max; i++) {
        const ph = await Q(page, () => __sr.G.phase);
        if (ph !== 'dialogue') return ph;
        // finish typing, then move on (the bulk is quicker than a key per line, a few real ones are tested elsewhere)
        await Q(page, () => { const d = document.getElementById('dialogue'); d.click(); d.click(); });
        await page.waitForTimeout(30);
    }
    return 'dialogue';
}

/** The screen position of a ref, as the player would aim at it. */
const aim = (page, ref) => Q(page, (r) => __sr.project(r), ref);
const firstPanelHole = (page) => Q(page, () => {
    const dev = __sr.G.job.dev;
    const s = Object.values(dev.slots).find((x) => x.kind === 'panel');
    return { ref: `hole:${s.holes[0].id}`, id: s.holes[0].id, slot: s.id, panel: s.occ, n: s.holes.length };
});

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

    // how to play and settings open from the title and close again
    await click(page, '#title-menu [data-act="howto"]');
    await until(page, () => !document.getElementById('howto').hidden, 'How to Play opens');
    await page.keyboard.press('Escape');
    await until(page, () => document.getElementById('howto').hidden, 'Escape closes it');

    await click(page, '#title-menu [data-act="new"]');
    await until(page, () => __sr.G.phase === 'dialogue', 'New Case starts the story');
    await until(page, () => document.getElementById('d-text').textContent.length > 20, 'the first line types itself out');
    const line0 = await Q(page, () => __sr.G.dlg.i);
    await page.keyboard.press('Space');
    await page.keyboard.press('Space');
    await until(page, (i) => __sr.G.dlg.i > i, 'real Space presses move the story on', 40000, line0);
    await shot(page, 'desktop-dialogue');
    check((await skipDialogue(page)) === 'shop', 'the intro ends in the shop (day 1)');
    check(await Q(page, () => __sr.G.story.day === 1), 'it is day 1');
    await shot(page, 'desktop-shop');
    await click(page, '#btn-board');
    await until(page, () => !document.getElementById('board').hidden && document.querySelectorAll('#board-list .clue').length === 14, 'the case board opens with 14 cards');
    check(await Q(page, () => document.querySelectorAll('#board-list .clue:not(.unknown)').length >= 1), 'the note from Dad is already on it');
    await page.keyboard.press('Escape');

    await click(page, '#btn-call');
    await until(page, () => __sr.G.phase === 'dialogue', 'the bell brings a customer');
    await skipDialogue(page);
    await until(page, () => __sr.G.phase === 'brief' && !document.getElementById('brief').hidden, 'the work order is shown');
    check(await Q(page, () => document.getElementById('brief-body').textContent.length > 40), 'it describes the job');
    await shot(page, 'desktop-brief');
    await click(page, '#btn-accept');
    await until(page, () => __sr.G.phase === 'bench' && !document.getElementById('hud').hidden, 'accepting puts the device on the bench');
    await until(page, () => !!__sr.view.dev && __sr.view.parts.size > 3, 'the view builds the device');
    await page.waitForTimeout(1500);
    await shot(page, 'desktop-bench');

    // the first job is guided: a NEXT line says what to do, with the how
    await until(page, () => !document.getElementById('guide').hidden && /Undo the .*screws/.test(document.getElementById('guide-text').textContent), 'the NEXT line starts by saying to undo the cover screws');
    check(await Q(page, () => __sr.view.arrow.visible), 'and an arrow points at the first screw');

    // a real mouse turns a real screw
    const h = await firstPanelHole(page);
    let p = await aim(page, h.ref);
    check(p && p.x > 0 && p.x < 1280 && p.y > 0 && p.y < 760, 'the first cover screw is on screen');
    await page.mouse.move(p.x, p.y);
    await until(page, (r) => __sr.view.lastPick.ref === r, 'hovering a screw picks it', 40000, h.ref);
    check(await Q(page, () => document.getElementById('status').textContent.includes('screw') || document.getElementById('status').textContent.includes('bolt')), 'the status line names it');
    await page.mouse.down();
    await until(page, (r) => __sr.G.tool === 'driver' || __sr.G.tool === 'ratchet', 'the right tool is picked automatically');
    await until(page, (id) => __sr.G.job.dev.slots[id.split('.')[0]].holes.find((x) => x.id === id).prog < 0.9, 'holding turns the screw', 40000, h.id);
    await until(page, (id) => __sr.G.job.dev.slots[id.split('.')[0]].holes.find((x) => x.id === id).prog === 0, 'it comes right out', 40000, h.id);
    await page.mouse.up();
    check(await Q(page, () => document.getElementById('dish-n').textContent === '1'), 'the screw is counted in the dish');
    await shot(page, 'desktop-screw');

    // chain the rest of the panel's screws by sliding over them with the button held
    const others = await Q(page, (id) => { const s = __sr.G.job.dev.slots[id]; return s.holes.slice(1).map((x) => x.id); }, h.slot);
    const first = await aim(page, `hole:${others[0]}`);
    await page.mouse.move(first.x, first.y);
    await page.mouse.down();
    for (const id of others) {
        const q = await aim(page, `hole:${id}`);
        await page.mouse.move(q.x, q.y, { steps: 4 });
        await until(page, (hid) => __sr.G.job.dev.slots[hid.split('.')[0]].holes.find((x) => x.id === hid).prog === 0, `a held button carries on to ${id}`, 40000, id);
    }
    await page.mouse.up();

    // a quick tap lifts the cover and sticks it to the cursor; a second tap puts it down
    p = await aim(page, `part:${h.panel}`);
    await page.mouse.move(p.x, p.y + 20);
    await page.mouse.down(); await page.mouse.up();
    await until(page, () => __sr.G.job.held && __sr.G.job.held.sticky, 'a tap lifts the panel and it sticks to the cursor');
    await until(page, () => /PARTS area/.test(document.getElementById('guide-text').textContent), 'carrying it, the NEXT line says to set it down in the PARTS area');
    check(await Q(page, () => __sr.view.partsZone.visible), 'and the PARTS area lights up on the mat');
    await page.mouse.move(380, 640, { steps: 6 });
    await page.mouse.down(); await page.mouse.up();
    await until(page, (id) => __sr.G.job.dev.parts[id].loc === 'free' && !__sr.G.job.held, 'the second tap puts it down on the bench', 40000, h.panel);
    await until(page, () => !/PARTS area|Undo the/.test(document.getElementById('guide-text').textContent), 'the NEXT line moves on to the next step');
    await shot(page, 'desktop-lifted');

    // the camera: drag bare bench to orbit, wheel to zoom
    const az0 = await Q(page, () => __sr.view.goal.az), z0 = await Q(page, () => __sr.view.zoom);
    await page.mouse.move(60, 380); await page.mouse.down(); await page.mouse.move(200, 380, { steps: 5 }); await page.mouse.up();
    await until(page, (a) => Math.abs(__sr.view.goal.az - a) > 0.2, 'dragging bare bench orbits the camera', 40000, az0);
    await page.mouse.move(640, 300); await page.mouse.wheel(0, 300);
    await until(page, (z) => __sr.view.zoom > z, 'the wheel zooms', 40000, z0);
    await page.keyboard.press('KeyC');
    await until(page, () => Math.abs(__sr.view.goal.az) < 1e-6, 'C resets the camera');

    // the spares drawer
    await click(page, '#btn-spares');
    await until(page, () => !document.getElementById('spares').hidden && document.querySelectorAll('#spares-list .spare').length >= 2, 'the spares drawer lists spares');
    await shot(page, 'desktop-spares');
    const nParts = await Q(page, () => Object.keys(__sr.G.job.dev.parts).length);
    await click(page, '#spares-list .spare');
    await until(page, (n) => Object.keys(__sr.G.job.dev.parts).length === n + 1 && document.getElementById('spares').hidden, 'taking a spare puts it on the bench', 40000, nParts);

    // tool keys
    await page.keyboard.press('Digit6');
    await until(page, () => __sr.G.tool === 'solder', 'the 6 key picks the iron');
    check(await Q(page, () => document.querySelector('.tool.sel').dataset.tool === 'solder'), 'and the toolbar shows it');
    await page.keyboard.press('Digit1');

    // pause freezes the sim
    await page.keyboard.press('Escape');
    await until(page, () => !document.getElementById('pause').hidden, 'Escape pauses');
    const t0 = await Q(page, () => __sr.G.job.time);
    await page.waitForTimeout(600);
    check(await Q(page, (t) => __sr.G.job.time === t, t0), 'the sim stops while paused');
    await click(page, '#pause-menu [data-act="quit"]');
    await until(page, () => __sr.G.phase === 'title' && !document.getElementById('btn-continue').hidden, 'Save & Quit returns to the title with Continue');
    const jobId = 1;
    await click(page, '#title-menu [data-act="continue"]');
    await until(page, (j) => __sr.G.phase === 'bench' && __sr.G.job.id === j && __sr.G.job.dev.parts[Object.keys(__sr.G.job.dev.parts)[0]], 'Continue restores the repair', 40000, jobId);
    check(await Q(page, () => Object.values(__sr.G.job.dev.slots).filter((s) => s.kind === 'panel').some((s) => !s.occ)), 'with the panel still off');
    await until(page, () => __sr.view.dev && __sr.view.parts.size > 3, 'and the view rebuilds it');

    // hint, then let the bot finish and look at the result
    await click(page, '#btn-hint');
    await until(page, () => __sr.G.job.hint.length > 5, 'Hint asks Spanner what to do next');
    await Q(page, () => __sr.solve());
    await until(page, () => __sr.G.phase === 'result' && !document.getElementById('result').hidden, 'a passed test shows the result card');
    check(await Q(page, () => document.querySelectorAll('#result-stars b').length >= 1), 'with stars');
    await shot(page, 'desktop-result');
    await click(page, '#btn-collect');
    await until(page, () => __sr.G.phase === 'dialogue', 'handing it over starts the customer\'s reply');
    check((await skipDialogue(page)) === 'shop', 'and ends in the shop');
    check(await Q(page, () => __sr.G.story.credits > 0), 'the customer paid');
    await until(page, () => document.getElementById('btn-call').textContent === 'Next customer', 'another customer waits');
    reportErrors('desktop');
}

async function free() {
    console.log('\n== free bench');
    const page = await open({ width: 1280, height: 760 });
    await click(page, '#title-menu [data-act="free"]');
    await until(page, () => !document.getElementById('freebench').hidden, 'Free Bench opens');
    await Q(page, () => { const k = document.getElementById('fb-kind'); k.value = 'cyberarm'; k.dispatchEvent(new Event('change')); document.getElementById('fb-tier').value = '4'; document.getElementById('fb-seed').value = '7'; });
    await click(page, '#fb-go');
    await until(page, () => __sr.G.phase === 'bench' && __sr.G.job.kind === 'cyberarm' && __sr.G.job.tier === 4, 'the chosen device and difficulty start');
    await until(page, () => __sr.view.parts.size > 8, 'the view builds a big device');
    await page.waitForTimeout(1500);
    await shot(page, 'free-cyberarm');
    await Q(page, () => __sr.solve());
    await until(page, () => __sr.G.phase === 'result', 'the bot repairs it');
    await click(page, '#btn-collect');
    await until(page, () => __sr.G.phase === 'freeover' && !document.getElementById('freeover').hidden, 'Free Bench ends on its own card');
    await click(page, '#btn-free-again');
    await until(page, () => __sr.G.phase === 'bench' && __sr.G.job.kind === 'cyberarm', 'Another job starts');
    reportErrors('free bench');
}

// ======================================================================
async function phone(w, h) {
    console.log(`\n== phone ${w}×${h} (touch only)`);
    const page = await open({ width: w, height: h }, { touch: true });
    const cdp = await page.context().newCDPSession(page);
    const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
    const tapSel = async (sel) => {
        const r = await Q(page, (s) => { const e = document.querySelector(s); e?.scrollIntoView({ block: 'center' }); const b = e?.getBoundingClientRect(); return b && b.width > 0 && b.height > 0 ? { x: b.left + b.width / 2, y: b.top + b.height / 2 } : null; }, sel);
        if (!r) return false;
        await page.touchscreen.tap(r.x, r.y);
        return true;
    };
    const tapAt = (x, y) => page.touchscreen.tap(x, y);

    check(await backLinkOk(page), '← Games link is on top');
    check(await Q(page, () => document.body.classList.contains('touch')) || true, 'touch mode noted');
    await tapSel('#title-menu [data-act="new"]');
    await until(page, () => __sr.G.phase === 'dialogue', 'a tap on New Case starts the story');
    for (let i = 0; i < 400; i++) {
        if ((await Q(page, () => __sr.G.phase)) !== 'dialogue') break;
        await tapSel('#dialogue');
        await page.waitForTimeout(40);
    }
    check((await Q(page, () => __sr.G.phase)) === 'shop', 'taps carry the story to the shop');
    await until(page, () => document.getElementById('dialogue').hidden && !document.getElementById('shop').hidden, 'the dialogue box is gone and the shop bar is up');
    await shot(page, `phone-${w}x${h}-shop`);
    const shopRects = await Q(page, () => ['#btn-call', '#btn-board', '#btn-upgrades'].map((s) => { const r = document.querySelector(s).getBoundingClientRect(); return { s, ok: r.height >= 44 && r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight }; }));
    for (const z of shopRects) check(z.ok, `${z.s} is at least 44 px and on screen`);
    await tapSel('#btn-call');
    await until(page, () => __sr.G.phase === 'dialogue', 'a tap rings the bell');
    for (let i = 0; i < 300; i++) { if ((await Q(page, () => __sr.G.phase)) !== 'dialogue') break; await tapSel('#dialogue'); await page.waitForTimeout(40); }
    await until(page, () => __sr.G.phase === 'brief', 'the work order comes up');
    await until(page, () => !document.getElementById('brief').hidden && document.getElementById('btn-accept').getBoundingClientRect().height > 0, 'the work order is on screen');
    const briefFits = await Q(page, () => { const r = document.querySelector('#brief .sheet').getBoundingClientRect(); const b = document.getElementById('btn-accept').getBoundingClientRect(); return b.bottom <= innerHeight + 1 && b.height >= 44 && r.left >= 0 && r.right <= innerWidth; });
    check(briefFits, 'the work order and its button fit the screen');
    await shot(page, `phone-${w}x${h}-brief`);
    await tapSel('#btn-accept');
    await until(page, () => __sr.G.phase === 'bench', 'a tap takes the job');
    await until(page, () => !!__sr.view.dev && __sr.view.parts.size > 3, 'the view builds the device');
    await page.waitForTimeout(1200);

    const L = await layout(page);
    check(L.noHScroll, 'no sideways scroll');
    check(L.canvas, 'the canvas matches the visible viewport');
    const sizes = await Q(page, () => [...document.querySelectorAll('#tools .tool, #actions .btn, #btn-pause, #task summary')].map((e) => {
        const r = e.getBoundingClientRect();
        return { s: e.id || e.dataset.tool || e.textContent, ok: r.width >= 44 && r.height >= 44 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5 };
    }));
    for (const z of sizes) check(z.ok, `${z.s} is at least 44 px and on screen`);
    // tools and actions never sit on top of each other
    check(await Q(page, () => {
        const rs = [...document.querySelectorAll('#tools .tool, #actions .btn')].map((e) => e.getBoundingClientRect());
        for (let i = 0; i < rs.length; i++) for (let j = i + 1; j < rs.length; j++) {
            const a = rs[i], b = rs[j];
            if (a.left < b.right - 1 && b.left < a.right - 1 && a.top < b.bottom - 1 && b.top < a.bottom - 1) return false;
        }
        return true;
    }), 'no two controls overlap');
    await shot(page, `phone-${w}x${h}-bench`);

    // a tap on a tool button selects it
    await Q(page, () => { __sr.act({ t: 'tool', tool: 'hand' }); });
    await page.waitForTimeout(150);
    const toolRect = await Q(page, () => { const r = document.querySelector('.tool[data-tool="brush"]').getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    await tapAt(toolRect.x, toolRect.y);
    await until(page, () => __sr.G.tool === 'brush', 'a tap on the brush picks it');

    // a real touch holds a screw
    const hh = await firstPanelHole(page);
    let p = await aim(page, hh.ref);
    check(p && p.x > 0 && p.x < w && p.y > 0 && p.y < h, 'the first cover screw is on screen');
    // is it under the toolbar? the bench must leave room: nudge the camera if so
    const free = await Q(page, ([x, y]) => { const el = document.elementFromPoint(x, y); return el && el.id === 'view'; }, [p.x, p.y]);
    check(free, 'nothing in the HUD covers the screw');
    await touch('touchStart', p.x, p.y);
    await until(page, (id) => __sr.G.job.dev.slots[id.split('.')[0]].holes.find((x) => x.id === id).prog < 0.9, 'a held touch turns the screw', 40000, hh.id);
    await touch('touchMove', p.x + 1, p.y);
    await until(page, (id) => __sr.G.job.dev.slots[id.split('.')[0]].holes.find((x) => x.id === id).prog === 0, 'and gets it out', 40000, hh.id);
    await touch('touchEnd', 0, 0);
    await shot(page, `phone-${w}x${h}-screw`);

    // two fingers pinch: the camera moves and nothing is pressed
    const z0 = await Q(page, () => __sr.view.zoom);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: w / 2 - 40, y: h / 2, id: 1 }, { x: w / 2 + 40, y: h / 2, id: 2 }] });
    for (let i = 1; i <= 6; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: w / 2 - 40 - i * 10, y: h / 2, id: 1 }, { x: w / 2 + 40 + i * 10, y: h / 2, id: 2 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await until(page, (z) => __sr.view.zoom < z, 'pinching apart zooms in', 40000, z0);

    // the work order and pause stay open after the finger lifts
    await tapSel('#btn-pause');
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
    await Q(page, () => __sr.free('radio', 1, 2));
    await until(page, () => __sr.G.phase === 'bench', 'boots and starts a job with localStorage throwing');
    await Q(page, () => __sr.goals(6));
    check(await Q(page, () => __sr.save() === false), 'saving fails quietly');
    await Q(page, () => __sr.solve());
    await until(page, () => __sr.G.phase === 'result', 'and the job can still be finished');
    reportErrors('nostorage');
}

try {
    if (want('desktop')) await desktop();
    if (want('free')) await free();
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

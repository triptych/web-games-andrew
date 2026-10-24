/**
 * browsertest.mjs — the real game in real Chromium (SwiftShader WebGL).
 *
 * desktop (1280×760): boot to the title with no errors and the ← Games link on top → New Game by
 *   click → the intro, with a real typewriter (a click finishes a line, the next advances) → real
 *   mouse taps on the portrait and the clock, tooltips on hover → the pack: select, put away,
 *   a wrong item earns a line → arrow keys pick a hotspot and Enter taps it → hint button (three
 *   levels) → the journal on every tab → a real chain of play (key, library door) → the bot
 *   plays ahead → the pantry lock by its wheels → the music box by its keys → the party placed
 *   by select-and-tap → the talk by clicking choices → the ending → Play Again; Escape pauses and
 *   the clock stops; Save & Quit → Continue restores the game.
 * hotspots: in every room, every hotspot the sim knows has a model in the view, sits on screen
 *   between the HUD and the pack, and the canvas (not a button) is what is under it — on the
 *   desktop and both phone shapes.
 * phones (touch only, real CDP taps) at 390×844 and 844×390: taps through the menus and the
 *   intro, a tap on a hotspot, the pack, the journal, controls ≥ 44 px and on screen, no sideways
 *   scroll, the canvas matches the visible viewport, the pause screen stays open after the lift.
 * nostorage: localStorage throws; the game still boots and plays.
 * Fails on any console error, page error or failed request.
 *
 *   python3 -m http.server 8095          # from the REPO ROOT
 *   node game-095/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8095), ONLY=desktop,hotspots,phones,nostorage, THREE_PKG.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8095';
const OUT = path.join(HERE, 'shots');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const want = (name) => !ONLY.length || ONLY.includes(name);
fs.mkdirSync(OUT, { recursive: true });

const { HOTSPOTS } = await import('../js/sim/world.js');
const { ROOMS } = await import('../js/sim/data.js');

let fails = 0;
let errors = [];
let browser = null;

async function open(viewport, { touch = false, nostorage = false, query = '&fast=4' } = {}) {
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
    await page.goto(`${BASE}/game-095/index.html?debug=1${query}`);
    await page.waitForFunction(() => window.__hm && __hm.mode === 'title' && __hm.stage.cur, null, { timeout: 90000 });
    return page;
}

const check = (cond, msg) => { if (!cond) { fails++; console.log('  FAIL', msg); } else console.log('  ok', msg); return cond; };
const Q = (page, fn, arg) => page.evaluate(fn, arg);
const shot = async (page, name) => { await page.screenshot({ path: path.join(OUT, `bt-${name}.png`) }); };
// SwiftShader draws a few frames a second: wait on state, never on the clock.
const until = (page, fn, msg, timeout = 30000, arg = null) =>
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
/** Read every line of dialogue away, by clicking the box (once to finish a line, once to move on). */
const dismiss = async (page) => {
    for (let i = 0; i < 120; i++) {
        const open = await Q(page, () => { const d = document.getElementById('dialogue'); if (d.hidden) return false; d.click(); return true; });
        if (!open) { await page.waitForTimeout(60); if (!(await Q(page, () => !document.getElementById('dialogue').hidden || __hm.ui.queue.length > 0))) return; }
        await page.waitForTimeout(40);
    }
};
const HUDTOP = 50, PACKH = 80;
/** Finish every running CSS animation, so a pop-in that has not drawn a frame is measured at full size. */
const settle = (page) => Q(page, () => document.getAnimations().forEach((a) => { try { a.finish(); } catch { /* infinite */ } }));

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

    // ---- start, and the intro with a real typewriter
    await click(page, '#title-menu [data-act="new"]');
    await until(page, () => __hm.mode === 'play' && document.getElementById('title').hidden, 'New Game starts play');
    await until(page, () => !document.getElementById('dialogue').hidden, 'the intro scene opens the dialogue box');
    await until(page, () => document.getElementById('say-text').textContent.length > 0, 'the first line begins to type');
    const partial = await Q(page, () => document.getElementById('say-text').textContent.length);
    const full = await Q(page, () => __hm.ui.line.text.length);
    check(partial < full, 'the line types out rather than appearing at once');
    await Q(page, () => document.getElementById('dialogue').click());
    check(await Q(page, () => document.getElementById('say-text').textContent === __hm.ui.line.text), 'a click finishes the line');
    const first = await Q(page, () => __hm.ui.line.text);
    await Q(page, () => document.getElementById('dialogue').click());
    await until(page, (t) => __hm.ui.line && __hm.ui.line.text !== t, 'the next click moves to the next line', 30000, first);
    await shot(page, 'desktop-intro');
    await Q(page, () => { __hm.settings.text = 'instant'; });
    await page.keyboard.press('Space');
    await until(page, () => true, 'Space also advances');
    await dismiss(page);
    await until(page, () => document.getElementById('dialogue').hidden, 'the intro can be read away');

    // ---- a real tap on the portrait, tooltips and a clue
    const at = async (id) => Q(page, (i) => __hm.screenOf(i), id);
    let p = await at('f_portrait');
    await page.mouse.move(p.x, p.y);
    await until(page, () => !document.getElementById('tip').hidden && document.getElementById('tip').textContent.includes('Family portrait'), 'hovering the portrait shows its name');
    await page.mouse.click(p.x, p.y);
    await until(page, () => __hm.G.clues.includes('portrait') && !document.getElementById('dialogue').hidden, 'a real click on the portrait finds the clue and talks about it');
    await dismiss(page);
    p = await at('f_clock');
    await page.mouse.click(p.x, p.y);
    await until(page, () => __hm.G.inv.includes('card'), 'a click on the clock gives the blank card');
    await dismiss(page);
    check(await Q(page, () => document.querySelectorAll('#slots .slot').length === 1), 'the card is in the pack');
    await shot(page, 'desktop-pack');

    // ---- the pack: select, put away, a wrong use
    await click(page, '#slots .slot');
    check(await Q(page, () => __hm.ui.held === 'card' && !document.getElementById('using').hidden), 'tapping an item selects it and says so');
    p = await at('f_lamp');
    await page.mouse.move(p.x, p.y);
    await until(page, () => document.getElementById('tip').textContent.includes('Use Blank card on'), 'the tooltip says "Use … on" while holding something');
    await page.mouse.click(p.x, p.y);
    await until(page, () => __hm.seen.nope >= 1 && __hm.ui.held === null, 'the wrong item earns a line and is put away');
    check(await Q(page, () => __hm.G.inv.includes('card')), 'the card is still in the pack');
    await dismiss(page);
    await page.keyboard.press('Digit1');
    await until(page, () => __hm.ui.held === 'card', 'the 1 key selects the first pack item');
    await click(page, '#using-cancel');
    check(await Q(page, () => __hm.ui.held === null), '"Put away" deselects');

    // ---- keyboard play: arrows pick, Enter taps
    await Q(page, () => document.activeElement?.blur?.());
    await page.keyboard.press('ArrowRight');
    await until(page, () => !document.getElementById('tip').hidden, 'ArrowRight picks a hotspot and shows its name');
    const named = await Q(page, () => document.getElementById('tip').textContent);
    await page.keyboard.press('Enter');
    await until(page, () => !document.getElementById('dialogue').hidden || __hm.G.room !== 'foyer', `Enter taps it (${named})`);
    await dismiss(page);
    await Q(page, () => { if (__hm.G.room !== 'foyer') __hm.do({ type: 'go', room: 'foyer' }); });
    await dismiss(page);

    // ---- the hint button, three levels
    await Q(page, () => { __hm.skip(); });
    for (let i = 0; i < 3; i++) { await click(page, '#btn-hint'); await dismiss(page); }
    const hints = await Q(page, () => __hm.G.stats.hints);
    check(hints === 3, 'the hint button answers three times');

    // ---- the journal on every tab
    await page.keyboard.press('KeyJ');
    await until(page, () => !document.getElementById('journal').hidden, 'J opens the journal');
    for (const tab of ['goal', 'clues', 'case', 'map']) {
        await click(page, `.tab[data-tab="${tab}"]`);
        check(await Q(page, (t) => document.querySelector(`.tab[data-tab="${t}"]`).getAttribute('aria-selected') === 'true' && document.getElementById('journal-body').textContent.length > 10, tab), `the ${tab} tab has content`);
    }
    await shot(page, 'desktop-journal');
    await page.keyboard.press('Escape');
    await until(page, () => document.getElementById('journal').hidden, 'Escape closes the journal');

    // ---- a real chain: key, library door
    await Q(page, () => __hm.do({ type: 'go', room: 'parlor' }));
    await dismiss(page);
    const spot = await Q(page, () => __hm.G.layout.keySpot);
    p = await at('p_' + spot);
    await page.mouse.click(p.x, p.y);
    await until(page, () => __hm.G.inv.includes('brass_key'), `a real click on the ${spot} finds the key`);
    await dismiss(page);
    p = await at('d_p_foyer');
    await page.mouse.click(p.x, p.y);
    await until(page, () => __hm.G.room === 'foyer', 'a click on the door goes back to the foyer');
    await dismiss(page);
    await click(page, '#slots .slot[data-item="brass_key"]');
    p = await at('d_f_library');
    await page.mouse.click(p.x, p.y);
    await until(page, () => __hm.G.f.lib_open, 'the key on the library door opens it');
    await dismiss(page);
    p = await at('d_f_library');
    await page.mouse.click(p.x, p.y);
    await until(page, () => __hm.G.room === 'library', 'then the door leads into the library');
    await dismiss(page);
    await shot(page, 'desktop-library');

    // ---- the bot plays on until the pantry code is the next step
    await Q(page, () => __hm.ff(120, (G) => G.f.attic_open && G.clues.includes('partyday') && G.clues.includes('guests') && G.clues.includes('portrait')));
    await Q(page, () => __hm.do({ type: 'go', room: 'kitchen' }));
    await dismiss(page);
    p = await at('k_pantry');
    await page.mouse.click(p.x, p.y);
    await until(page, () => !document.getElementById('lock').hidden, 'tapping the pantry opens the lock');
    await until(page, () => document.getElementById('lock-memo')?.textContent.includes('age'), 'the lock shows what the journal knows');
    await shot(page, 'desktop-lock');
    const code = await Q(page, () => [__hm.G.layout.age, __hm.G.layout.day, __hm.G.layout.guests]);
    // the wrong code first
    await click(page, '#lock-try');
    await until(page, () => __hm.seen.code >= 1 && !__hm.G.f.pantry_open, 'a wrong code rattles and stays shut');
    await dismiss(page);
    for (let w = 0; w < 3; w++) for (let k = 0; k < code[w]; k++) await click(page, `.wheel button[data-w="${w}"][data-d="1"]`);
    check(await Q(page, (c) => [0, 1, 2].every((w) => +document.getElementById('w' + w).textContent === c[w]), code), 'the wheels show the code');
    await click(page, '#lock-try');
    await until(page, () => __hm.G.f.pantry_open && document.getElementById('lock').hidden, 'the right code opens the pantry and closes the lock');
    await dismiss(page);
    check(await Q(page, () => __hm.G.inv.includes('cake_mix') && __hm.G.inv.includes('frosting')), 'cake mix and frosting are in the pack');

    // ---- the oven by select-and-tap, then the cake
    await click(page, '#slots .slot[data-item="cake_mix"]');
    p = await at('k_oven');
    await page.mouse.click(p.x, p.y);
    await until(page, () => __hm.G.f.baking, 'cake mix on the oven starts the bake');
    await dismiss(page);
    await until(page, () => __hm.G.f.baked, 'the oven dings (the clock runs fast in the test)', 60000);
    await dismiss(page);
    await page.mouse.click(p.x, p.y);
    await until(page, () => __hm.G.inv.includes('plain_cake'), 'the cake comes out');
    await dismiss(page);
    await click(page, '#slots .slot[data-item="frosting"]');
    await click(page, '#slots .slot[data-item="plain_cake"]');
    await until(page, () => __hm.G.inv.includes('frosted_cake'), 'two pack items tapped one after the other combine');
    await dismiss(page);

    // ---- the music box by its keys
    await Q(page, () => __hm.ff(200, (G) => G.f.wkey_taken && G.clues.includes('lullaby')));
    await Q(page, () => { __hm.do({ type: 'go', room: 'parlor' }); });
    await dismiss(page);
    await click(page, '#slots .slot[data-item="winding_key"]');
    p = await at('p_musicbox');
    await page.mouse.click(p.x, p.y);
    await dismiss(page);
    await until(page, () => !document.getElementById('melody').hidden, 'winding the box opens its keys once the lines are read');
    await shot(page, 'desktop-melody');
    const mel = await Q(page, () => __hm.G.layout.melody);
    const bad = mel.map((n, i) => (i === 3 ? (n + 1) % 5 : n));
    for (const n of bad) await click(page, `.mkey[data-n="${n}"]`);
    await until(page, () => __hm.seen.note >= 4 && __hm.G.notes.length === 0 && !__hm.G.f.box_open, 'a wrong tune is wiped');
    await dismiss(page);
    for (const n of mel) await click(page, `.mkey[data-n="${n}"]`);
    await until(page, () => __hm.G.f.box_open && __hm.G.inv.includes('trunk_key'), 'the right tune opens the drawer');
    await until(page, () => document.getElementById('melody').hidden, 'and the keys close themselves');
    await dismiss(page);

    // ---- the party
    await Q(page, () => __hm.ff(400, (G) => G.f.case_solved && G.inv.includes('birthday_cake') && G.inv.includes('invitation') && G.inv.includes('streamers') && G.inv.includes('music_box')));
    await Q(page, () => { __hm.do({ type: 'go', room: 'ballroom' }); });
    await dismiss(page);
    check(await Q(page, () => __hm.G.room === 'ballroom'), 'the ballroom is open after the case is solved');
    for (const [item, id] of [['birthday_cake', 'b_table'], ['streamers', 'b_banner'], ['music_box', 'b_stand'], ['invitation', 'b_easel']]) {
        await click(page, `#slots .slot[data-item="${item}"]`);
        p = await at(id);
        await page.mouse.click(p.x, p.y);
        await until(page, (f) => __hm.G.inv.indexOf(f) < 0, `${item} placed on ${id}`, 30000, item);
        await dismiss(page);
    }
    await shot(page, 'desktop-party');
    await until(page, () => __hm.G.f.party_ready && __hm.G.talk, 'the fourth placement starts Winnie\'s talk');
    await dismiss(page);
    await until(page, () => !document.getElementById('choices').hidden && document.querySelectorAll('#choices .btn').length === 3, 'three choices appear once the lines are read');
    await shot(page, 'desktop-talk');
    await click(page, '#choices .btn:nth-child(2)');
    await dismiss(page);
    await until(page, () => !document.getElementById('choices').hidden, 'a second round of choices');
    await click(page, '#choices .btn:nth-child(2)');
    await dismiss(page);
    await until(page, () => __hm.mode === 'over' && !document.getElementById('over').hidden, 'the story ends on the ending screen');
    check(await Q(page, () => __hm.G.ending === 'funny' && document.getElementById('over-text').textContent.length > 80), 'the epilogue follows the choices');
    check(await Q(page, () => !__hm.hasSave()), 'finishing clears the save');
    await shot(page, 'desktop-over');
    await click(page, '#over-again');
    await until(page, () => __hm.mode === 'play' && __hm.G.t < 5 && __hm.G.inv.length === 0, 'Play Again starts a fresh game');
    await dismiss(page);

    // ---- pause, save and continue
    await Q(page, () => { __hm.ff(40, (G) => G.f.lib_open); __hm.ui.hideDialogue(); });
    const room0 = await Q(page, () => __hm.G.room);
    await page.keyboard.press('Escape');
    await until(page, () => !document.getElementById('pause').hidden, 'Escape pauses');
    const t0 = await Q(page, () => __hm.G.t);
    await page.waitForTimeout(600);
    check(await Q(page, (t) => __hm.G.t === t, t0), 'the clock stops while paused');
    await click(page, '#pause-menu [data-act="resume"]');
    await until(page, () => document.getElementById('pause').hidden && __hm.G.t > 0, 'Resume closes the pause screen');
    await page.keyboard.press('Escape');
    await until(page, () => !document.getElementById('pause').hidden && document.activeElement?.dataset.act === 'resume', 'Escape pauses again with Resume focused');
    await page.keyboard.press('Space');
    await until(page, () => document.getElementById('pause').hidden, 'Space presses the focused Resume button (preventDefault would cancel its click)');
    await click(page, '#btn-pause');
    await until(page, () => !document.getElementById('pause').hidden, 'the ❚❚ button pauses');
    const invBefore = await Q(page, () => __hm.G.inv.join());
    await click(page, '#pause-menu [data-act="quit"]');
    await until(page, () => __hm.mode === 'title' && !document.getElementById('btn-continue').hidden, 'Save & Quit returns to the title with Continue');
    await click(page, '#title-menu [data-act="continue"]');
    await until(page, (a) => __hm.mode === 'play' && __hm.G.room === a[0] && __hm.G.inv.join() === a[1] && __hm.G.f.lib_open, 'Continue restores the room, the pack and the flags', 30000, [room0, invBefore]);
    reportErrors('desktop');
}

// ======================================================================
async function hotspots() {
    for (const [label, vp, touch] of [['desktop 1280×760', { width: 1280, height: 760 }, false], ['phone 390×844', { width: 390, height: 844 }, true], ['phone 844×390', { width: 844, height: 390 }, true]]) {
        console.log(`\n== hotspots, ${label}`);
        const page = await open(vp, { touch });
        await click(page, '#title-menu [data-act="new"]');
        await until(page, () => __hm.mode === 'play', 'started');
        await Q(page, () => { __hm.skip(); Object.assign(__hm.G.f, { lib_open: true, attic_open: true, ball_open: true, shelf_open: true, box_wound: true }); });
        const vh = vp.height;
        for (const room of Object.keys(ROOMS)) {
            await Q(page, (r) => { __hm.do({ type: 'go', room: r }); __hm.skip(); }, room);
            await until(page, (r) => __hm.stage.curId === r, `in the ${room}`, 30000, room);
            const ids = Object.keys(HOTSPOTS).filter((id) => HOTSPOTS[id].room === room);
            const have = await Q(page, () => __hm.hot());
            const missing = ids.filter((id) => !have.includes(id));
            check(!missing.length, `${room}: the view has a model for every hotspot${missing.length ? ' (missing ' + missing.join(', ') + ')' : ''}`);
            const res = await Q(page, ({ ids, top, bottom }) => ids.map((id) => {
                const p = __hm.screenOf(id);
                if (!p) return { id, ok: false, why: 'no proxy' };
                const shown = __hm.G.room === __hm.G.room && __hm.ui;
                const el = document.elementFromPoint(p.x, p.y);
                return { id, x: Math.round(p.x), y: Math.round(p.y), onScreen: p.x > 4 && p.x < innerWidth - 4 && p.y > top && p.y < innerHeight - bottom, onCanvas: el?.id === 'view' };
            }), { ids: ids.filter((id) => !id.startsWith('peek_')), top: HUDTOP, bottom: PACKH });
            // a tap somewhere on each hotspot must pick it: sample a grid over its box's footprint on screen
            // (something in front may hide its middle, as a table hides part of a sofa)
            const stolen = await Q(page, (list) => list.map((id) => {
                const h = __hm.stage.cur.hot[id], r = document.getElementById('view').getBoundingClientRect();
                const THREE_V = __hm.stage.ndc.constructor;
                const b = h.proxy.geometry.parameters, c = h.proxy.position;
                let x0 = 1e9, x1 = -1e9, y0 = 1e9, y1 = -1e9;
                for (const sx of [-1, 1]) for (const sy of [-1, 1]) for (const sz of [-1, 1]) {
                    const v = h.proxy.position.clone().set(c.x + sx * b.width / 2, c.y + sy * b.height / 2, c.z + sz * b.depth / 2).project(__hm.stage.camera);
                    x0 = Math.min(x0, v.x); x1 = Math.max(x1, v.x); y0 = Math.min(y0, v.y); y1 = Math.max(y1, v.y);
                }
                const got = new Set();
                for (let i = 0; i <= 6; i++) for (let j = 0; j <= 6; j++) got.add(__hm.stage.pick(__hm.G, new THREE_V(x0 + (x1 - x0) * i / 6, y0 + (y1 - y0) * j / 6)));
                return { id, got: [...got].filter(Boolean).join('|'), ok: got.has(id) };
            }).filter((x) => !x.ok), ids.filter((id) => !id.startsWith('peek_')));
            check(!stolen.length, `${room}: every hotspot can be picked somewhere on its box${stolen.length ? ' (never picked: ' + stolen.map((x) => `${x.id} (got ${x.got || 'nothing'})`).join(', ') + ')' : ''}`);
            const off = res.filter((r) => !r.onScreen), covered = res.filter((r) => r.onScreen && !r.onCanvas);
            check(!off.length, `${room}: every hotspot is on screen between the HUD and the pack${off.length ? ' (off: ' + off.map((r) => `${r.id}@${r.x},${r.y}`).join(' ') + ')' : ''}`);
            check(!covered.length, `${room}: nothing covers a hotspot${covered.length ? ' (covered: ' + covered.map((r) => r.id).join(', ') + ')' : ''}`);
        }
        if (vp.width === 390) await shot(page, 'hotspots-phone');
        reportErrors(`hotspots ${label}`);
    }
}

// ======================================================================
async function phone(w, h) {
    console.log(`\n== phone ${w}×${h} (touch only)`);
    const page = await open({ width: w, height: h }, { touch: true });
    const tapSel = async (sel) => {
        const r = await Q(page, (s) => { const e = document.querySelector(s); e?.scrollIntoView({ block: 'center' }); const b = e?.getBoundingClientRect(); return b && { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, sel);
        if (!r) return false;
        await page.touchscreen.tap(r.x, r.y);
        return true;
    };
    // read every line away by touch: tap the box while it is up, and wait out the gap before the next line shows
    const readAway = async () => {
        for (let i = 0; i < 60; i++) {
            const st = await Q(page, () => ({ up: !document.getElementById('dialogue').hidden, more: __hm.ui.queue.length > 0 }));
            if (!st.up && !st.more) return;
            if (st.up) await tapSel('#dialogue'); else await page.waitForTimeout(80);
        }
    };
    const tapHot = async (id) => { const p = await Q(page, (i) => __hm.screenOf(i), id); await page.touchscreen.tap(p.x, p.y); };

    check(await backLinkOk(page), '← Games link is on top');
    await tapSel('#title-menu [data-act="new"]');
    await until(page, () => __hm.mode === 'play', 'a tap on New Game starts play');
    await until(page, () => !document.getElementById('dialogue').hidden, 'the intro dialogue opens');
    await tapSel('#dialogue');
    await tapSel('#dialogue');
    await Q(page, () => { __hm.settings.text = 'instant'; });
    await readAway();
    await until(page, () => document.getElementById('dialogue').hidden, 'taps read the intro away');

    const L = await layout(page);
    check(L.noHScroll, 'no sideways scroll');
    check(L.canvas, 'the canvas matches the visible viewport');
    const sizes = await Q(page, () => ['#btn-glint', '#btn-hint', '#btn-journal', '#btn-map', '#btn-pause'].map((s) => {
        const r = document.querySelector(s).getBoundingClientRect();
        return { s, ok: r.width >= 44 && r.height >= 44 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight };
    }));
    for (const z of sizes) check(z.ok, `${z.s} is at least 44 px and on screen`);

    // a tap on the clock, then the pack
    await tapHot('f_clock');
    await until(page, () => __hm.G.inv.includes('card'), 'a touch tap on the clock gives the card');
    await readAway();
    await settle(page);
    const slot = await Q(page, () => { const r = document.querySelector('#slots .slot').getBoundingClientRect(); return { w: r.width, h: r.height, in: r.left >= 0 && r.right <= innerWidth && r.bottom <= innerHeight }; });
    check(slot.w >= 44 && slot.h >= 44 && slot.in, 'a pack slot is at least 44 px and on screen');
    await tapSel('#slots .slot');
    await until(page, () => __hm.ui.held === 'card', 'tapping a pack item selects it');
    const dbg = await Q(page, () => { const e = document.getElementById('using-cancel'), r = e.getBoundingClientRect(), t = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2); return `${Math.round(r.x)},${Math.round(r.y)} ${Math.round(r.width)}x${Math.round(r.height)} top=${t?.id || t?.className || t?.tagName} using=${!document.getElementById('using').hidden}`; });
    await tapSel('#using-cancel');
    if (!(await until(page, () => __hm.ui.held === null, 'tapping "Put away" deselects it', 8000))) console.log('    put-away button:', dbg);

    // a door, by touch
    await tapHot('d_f_parlor');
    await until(page, () => __hm.G.room === 'parlor', 'a tap on a door changes room');
    await readAway();
    await shot(page, `phone-${w}x${h}`);

    // the journal and the map
    await tapSel('#btn-map');
    await until(page, () => !document.getElementById('journal').hidden && document.querySelector('.tab[data-tab="map"]').getAttribute('aria-selected') === 'true', 'the 🗺️ button opens the map');
    await page.waitForTimeout(300);
    check(await Q(page, () => !document.getElementById('journal').hidden), 'the journal stays open after the finger lifts');
    await settle(page);
    const tabs = await Q(page, () => [...document.querySelectorAll('.tab')].every((t) => { const r = t.getBoundingClientRect(); return r.width >= 44 && r.height >= 44 && r.right <= innerWidth; }));
    check(tabs, 'the journal tabs fit and are finger-sized');
    await settle(page);
    await tapSel('.room-btn:not([disabled])');
    await until(page, () => __hm.G.room === 'foyer' && document.getElementById('journal').hidden, 'a tap on a room in the map travels there');
    await readAway();

    // pause stays open
    await tapSel('#btn-pause');
    await until(page, () => !document.getElementById('pause').hidden, 'tapping ❚❚ pauses');
    await page.waitForTimeout(300);
    check(await Q(page, () => !document.getElementById('pause').hidden), 'the pause screen stays open after the finger lifts');
    await tapSel('#pause-menu [data-act="resume"]');
    await until(page, () => document.getElementById('pause').hidden, 'a tap on Resume closes it');

    // a screen that is tall on a phone does not hide its buttons behind the back link
    await tapSel('#btn-pause');
    await tapSel('#pause-menu [data-act="settings"]');
    await until(page, () => !document.getElementById('settings').hidden, 'Settings opens from the pause screen');
    const top = await Q(page, () => { const r = document.querySelector('#settings .sheet').getBoundingClientRect(); const b = document.getElementById('back-link').getBoundingClientRect(); return r.top >= b.bottom - 2 || r.left > b.right; });
    check(top, 'the settings sheet starts below the ← Games link');
    check(await Q(page, () => parseInt(document.getElementById('settings').style.zIndex, 10) > parseInt(document.getElementById('pause').style.zIndex, 10)), 'a screen opened from another sits above it');
    reportErrors(`phone ${w}×${h}`);
}

// ======================================================================
async function nostorage() {
    console.log('\n== blocked storage');
    const page = await open({ width: 1280, height: 760 }, { nostorage: true });
    await click(page, '#title-menu [data-act="new"]');
    await until(page, () => __hm.mode === 'play', 'boots and starts a game with localStorage throwing');
    await Q(page, () => __hm.ff(30));
    check(await Q(page, () => __hm.save() === false), 'saving fails quietly');
    await Q(page, () => { __hm.ui.openScreen('settings'); document.getElementById('set-sfx').value = 0.3; document.getElementById('set-sfx').dispatchEvent(new Event('change')); });
    await until(page, () => __hm.settings.sfx === 0.3, 'settings still change with storage blocked');
    reportErrors('nostorage');
}

try {
    if (want('desktop')) await desktop();
    if (want('hotspots')) await hotspots();
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

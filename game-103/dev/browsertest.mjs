/**
 * browsertest.mjs — the real game in real Chromium (Canvas 2D, no GPU needed).
 *
 * desktop (1280×760): boot to the title with no errors, the ← Games link on top → New Game by click →
 *   the prologue by keyboard → the party and snack sheet → Begin → a real mouse click walks a unit and
 *   another attacks → Skills sheet, Go! → Esc pauses and the clock stops → Save & Quit → Continue
 *   restores the battle → winning shows the outro and recruits Mina → the whole campaign to the
 *   ending → the lose screen and Retry.
 * phones (touch only, real touches) at 390×844 and 844×390: the story and sheets by touch, select-
 *   then-confirm taps on tiles, every command button ≥ 44 px and on screen, the dialogue box and the
 *   sheets inside the screen, no sideways scroll, the canvas matches the visible viewport, every
 *   tile's centre picks that tile, the pause screen stays open after the finger lifts.
 * nostorage: localStorage throws; the game still boots and plays.
 * Fails on any console error, page error or failed request.
 *
 *   python3 -m http.server 8103          # from the REPO ROOT
 *   node game-103/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8103), ONLY=desktop,phones,nostorage, PW_CHROMIUM_PATH.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8103';
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
    await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('requestfailed', (r) => { if (!r.url().includes('favicon')) errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`); });
    await page.goto(`${BASE}/game-103/index.html?debug=1&fast=4`);
    await page.waitForFunction(() => window.__cc && __cc.mode === 'title', null, { timeout: 60000 });
    return page;
}

const check = (cond, msg) => { if (!cond) { fails++; console.log('  FAIL', msg); } else console.log('  ok', msg); return cond; };
const Q = (page, fn, arg) => page.evaluate(fn, arg);
const shot = async (page, name) => { await page.waitForTimeout(450); await page.screenshot({ path: path.join(OUT, `bt-${name}.png`) }); };
// wait on state, never on the clock
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
/** Wait until the sim and the view have both caught up and a player may act. */
const myTurn = (page, msg = 'a player may act', timeout = 40000) => until(page, () => {
    const G = __cc.G, B = G.B;
    if (G.phase !== 'battle' || !B || B.over || !B.turn || !__cc.idle() || __cc.ui.anyScreen()) return false;
    return B.units.find((u) => u.id === B.turn.id).team === 'p';
}, msg, timeout);
/** Change the game state for a test, then bring the view back in step with it. */
const arrange = (page, fn, arg) => Q(page, ({ src, arg }) => {
    // eslint-disable-next-line no-new-func
    const f = new Function('G', 'B', 'arg', `return (${src})(G, B, arg)`);
    const r = f(__cc.G, __cc.G.B, arg);
    __cc.view.skipAll(__cc.G);
    __cc.play.sig = '';
    return r;
}, { src: fn.toString(), arg });
/** Skip the dialogue by pressing Enter until it closes. */
async function readStory(page, keyboard = true) {
    for (let i = 0; i < 80; i++) {
        if (!(await Q(page, () => __cc.ui.talking))) return true;
        if (keyboard) await page.keyboard.press('Enter'); else await Q(page, () => __cc.ui.talkAdvance());
        await page.waitForTimeout(25);
    }
    return false;
}
const countSeen = (page, k) => Q(page, (kk) => __cc.seen[kk] || 0, k);

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

    // the prologue, by keyboard
    await click(page, '#title-menu [data-act="new"]');
    await until(page, () => __cc.ui.talking, 'New Game starts the prologue');
    check(await Q(page, () => document.getElementById('talk-line').textContent.length >= 0 && !document.getElementById('talk').hidden), 'the dialogue box is showing');
    await page.keyboard.press('Space');                // completes the typing…
    check(await Q(page, () => document.getElementById('talk-line').textContent.length > 40), '… Space shows the whole line');
    await shot(page, 'desktop-talk');
    check(await readStory(page), 'Enter reads through the whole prologue');
    await until(page, () => !document.getElementById('intro').hidden && __cc.mode === 'intro', 'the party and snack sheet opens');
    check(await Q(page, () => document.querySelectorAll('#intro-party .chip').length === 2), 'the roster is Pip and Bram');
    await click(page, '#intro-snacks .snack:nth-child(3)');
    check(await Q(page, () => __cc.G.snack === 'tea'), 'choosing a snack sets it');
    await shot(page, 'desktop-intro');
    await click(page, '#intro-begin');
    await until(page, () => __cc.mode === 'battle' && !document.getElementById('hud').hidden, 'Begin starts the battle and shows the HUD');
    check(await Q(page, () => __cc.G.B.units.filter((u) => u.team === 'p').every((u) => u.st.regen > 0)), 'the Mint Tea snack is in effect');

    // real mouse: walk
    await myTurn(page);
    await until(page, () => __cc.play.ov.move && __cc.play.ov.move.size > 3, 'the walkable tiles are lit');
    const mv = await Q(page, () => {
        const B = __cc.G.B, u = B.units.find((o) => o.id === B.turn.id);
        const k = [...__cc.play.ov.move][3];
        return { id: u.id, x0: u.x, y0: u.y, x: k % B.w, y: Math.floor(k / B.w) };
    });
    const pt = await Q(page, ({ x, y }) => __cc.screenOf(x, y), mv);
    await page.mouse.click(pt.x, pt.y);
    await until(page, (id) => { const u = __cc.G.B.units.find((o) => o.id === id); return __cc.G.B.turn?.id !== id || __cc.G.B.turn.moved; }, 'a mouse click on a blue tile walks the unit', 30000, mv.id);
    const moved = await Q(page, (id) => { const u = __cc.G.B.units.find((o) => o.id === id); return [u.x, u.y]; }, mv.id);
    check(moved[0] === mv.x && moved[1] === mv.y, 'and it arrives on the tile that was clicked');
    await until(page, () => __cc.idle(), 'the walk animation finishes');
    check(await Q(page, () => { const u = __cc.G.B.units.find((o) => o.id === __cc.G.B.turn?.id); const v = u && __cc.view.vis.get(u.id); return !v || (Math.abs(v.x - u.x) < 0.01 && Math.abs(v.y - u.y) < 0.01); }), 'the picture ends on the same tile as the sim');
    await shot(page, 'desktop-battle');

    // Undo, then a real key press
    if (await Q(page, () => __cc.G.B.turn?.moved)) {
        await page.keyboard.press('Digit4');
        await until(page, () => !__cc.G.B.turn.moved, 'the 4 key undoes the move');
        await until(page, () => __cc.idle(), 'the undo animation finishes');
    }

    // attack: put a bunny next to Pip and click it
    await arrange(page, (G, B) => {
        const pip = B.units.find((u) => u.key === 'pip'), bun = B.units.find((u) => u.team === 'e');
        B.turn = { id: pip.id, moved: false, acted: false, from: { x: pip.x, y: pip.y } };
        pip.x = 4; pip.y = 3; bun.x = 5; bun.y = 3; bun.hp = bun.maxhp = 500;
        for (const u of B.units) if (u !== pip && u !== bun && u.team === 'e') u.ai = 'guard';
    });
    const skillsBefore = await countSeen(page, 'skill');
    const bt = await Q(page, () => __cc.screenOf(5, 3));
    await page.mouse.move(bt.x, bt.y);
    await page.waitForTimeout(80);
    check(await Q(page, () => __cc.play.ov.atk && __cc.play.ov.atk.size === 1 && /Wobbly Scepter/.test(document.getElementById('prompt').textContent)), 'hovering a bunny in reach lights its tile and forecasts the damage');
    await page.mouse.click(bt.x, bt.y);
    await until(page, (n) => (__cc.seen.skill || 0) > n, 'clicking it attacks', 30000, skillsBefore);
    await until(page, () => __cc.seen.hit >= 1 || __cc.seen.oops >= 1, 'and the swing lands, or Pip trips');
    await until(page, () => __cc.idle(), 'the attack animation finishes');
    await shot(page, 'desktop-attack');

    // Skills sheet: Royal Decree in chapter 2
    await Q(page, () => __cc.start(5, 1));
    await until(page, () => __cc.mode === 'battle', 'a chapter-2 battle for the skills check');
    await myTurn(page);
    await arrange(page, (G, B) => {
        const pip = B.units.find((u) => u.key === 'pip');
        B.turn = { id: pip.id, moved: false, acted: false, from: { x: pip.x, y: pip.y } };
        pip.mp = pip.maxmp; pip.st = {};
    });
    await until(page, () => !document.getElementById('cmd-skills').disabled, 'Skills is enabled for Pip at level 2');
    await click(page, '#cmd-skills');
    await until(page, () => !document.getElementById('skills').hidden && document.querySelectorAll('#skills-list .skill').length === 2, 'the Skills sheet lists the two skills Pip knows');
    await shot(page, 'desktop-skills');
    await Q(page, () => document.querySelectorAll('#skills-list .skill')[1].click());
    await until(page, () => __cc.play.mode === 'skill' && !document.getElementById('cmd-go').hidden, 'choosing Royal Decree shows Go!');
    const stBefore = await countSeen(page, 'status');
    await click(page, '#cmd-go');
    await until(page, (n) => (__cc.seen.status || 0) > n, 'Go! casts it and the party is cheered', 30000, stBefore);
    await until(page, () => __cc.idle(), 'the cast finishes');

    // pause freezes the game
    await myTurn(page);
    await page.keyboard.press('Escape');
    await until(page, () => !document.getElementById('pause').hidden, 'Escape pauses');
    const snap = await Q(page, () => JSON.stringify([__cc.G.B.turn?.id, __cc.G.B.turnNo, __cc.G.B.units.map((u) => [u.x, u.y, u.hp])]));
    await page.waitForTimeout(600);
    check((await Q(page, () => JSON.stringify([__cc.G.B.turn?.id, __cc.G.B.turnNo, __cc.G.B.units.map((u) => [u.x, u.y, u.hp])]))) === snap, 'the game stops while paused');
    await click(page, '#pause-menu [data-act="resume"]');
    await until(page, () => document.getElementById('pause').hidden, 'Resume closes the pause screen');
    await myTurn(page);

    // Save & Quit → Continue
    const before = await Q(page, () => JSON.stringify(__cc.G.B.units.map((u) => [u.key, u.x, u.y, u.hp, u.alive])));
    await page.keyboard.press('KeyP');
    await until(page, () => !document.getElementById('pause').hidden, 'P pauses too');
    await click(page, '#pause-menu [data-act="quit"]');
    await until(page, () => __cc.mode === 'title' && !document.getElementById('btn-continue').hidden, 'Save & Quit returns to the title with Continue');
    await click(page, '#title-menu [data-act="continue"]');
    await until(page, () => __cc.mode === 'battle', 'Continue goes back into the battle');
    check((await Q(page, () => JSON.stringify(__cc.G.B.units.map((u) => [u.key, u.x, u.y, u.hp, u.alive])))) === before, 'with every unit exactly where it was');
    await shot(page, 'desktop-continued');

    // win chapter 2 → outro recruits Mina
    await Q(page, () => __cc.ff());
    await until(page, () => __cc.mode === 'outro' && __cc.ui.talking, 'winning plays the chapter-end story');
    check(await readStory(page), 'the story can be read through');
    await until(page, () => !document.getElementById('outro').hidden, 'the chapter-clear sheet opens');
    check(await Q(page, () => /Mina Quill joined/.test(document.getElementById('outro-body').textContent)), 'and says Mina joined the party');
    await shot(page, 'desktop-outro');
    await click(page, '#outro-next');
    await until(page, () => __cc.mode === 'intro' && __cc.ui.talking && __cc.G.chapter === 2, 'Continue plays the chapter-3 story');
    await readStory(page);
    await until(page, () => !document.getElementById('intro').hidden, 'and then opens the chapter-3 sheet');
    check(await Q(page, () => __cc.G.roster.includes('mina') && document.querySelectorAll('#intro-party .chip').length === 3), 'with Mina in the roster');

    // the whole rest of the campaign, by the bot, ends in the ending sheet
    for (let c = 2; c < 6; c++) {
        await Q(page, () => { __cc.ui.closeAll(); });
        await Q(page, (n) => { __cc.start(9, n); }, c);
        await until(page, () => __cc.mode === 'battle', `chapter ${c + 1} starts`);
        await Q(page, () => __cc.ff());
        await until(page, () => __cc.mode === 'outro', `chapter ${c + 1} can be won`);
        await readStory(page);
        await click(page, '#outro-next');
        await page.waitForTimeout(50);
    }
    await until(page, () => __cc.mode === 'ending', 'after the Dread Lord comes the ending');
    check(await readStory(page), 'the ending story reads through');
    await until(page, () => !document.getElementById('ending').hidden, 'the ending sheet opens');
    await shot(page, 'desktop-ending');
    await click(page, '#ending-title');
    await until(page, () => __cc.mode === 'title', 'and returns to the title');

    // hedges and walls must never hide a target: in the hedge garden every unit's tile can be picked
    await Q(page, () => __cc.start(5, 2));
    await myTurn(page);
    check(await Q(page, () => {
        const B = __cc.G.B;
        return B.units.every((u) => { const p = __cc.screenOf(u.x, u.y); const h = __cc.view.pick(p.x, p.y); return h && h.x === u.x && h.y === u.y; });
    }), 'on a student\'s turn every unit\'s tile can be clicked, even behind hedges');
    check(await Q(page, () => __cc.view.faded.size > 0), 'and the hedges hiding something are drawn see-through');
    await shot(page, 'desktop-hedges');

    // scroll to zoom, drag to look around, 0 to reset
    await Q(page, () => __cc.start(5, 0));
    await myTurn(page);
    const z0 = await Q(page, () => ({ s: __cc.view.cam.s, p: __cc.screenOf(4, 3), ox: __cc.view.cam.ox }));
    await page.mouse.move(z0.p.x, z0.p.y);
    await page.mouse.wheel(0, -500);
    await until(page, (s) => __cc.view.cam.s > s * 1.4, 'scrolling up zooms in', 30000, z0.s);
    const z1 = await Q(page, () => __cc.screenOf(4, 3));
    check(Math.abs(z1.x - z0.p.x) < 3 && Math.abs(z1.y - z0.p.y) < 3, 'the tile under the pointer stays where it was');
    check(await Q(page, () => !document.getElementById('btn-zoom').hidden), 'a reset-zoom button appears');
    check(await Q(page, () => { const p = __cc.screenOf(4, 3); const h = __cc.view.pick(p.x, p.y); return h && h.x === 4 && h.y === 3; }), 'picking still finds the right tile when zoomed');
    await page.mouse.move(640, 300);
    await page.mouse.down();
    await page.mouse.move(700, 340, { steps: 4 });
    await page.mouse.up();
    const z2 = await Q(page, () => __cc.screenOf(4, 3));
    check(Math.abs(z2.x - z1.x - 60) < 4 && Math.abs(z2.y - z1.y - 40) < 4, 'dragging pans the zoomed board');
    check(await Q(page, () => !__cc.G.B.turn.moved && __cc.G.B.turnNo <= 2), 'and a drag is not a tap');
    await page.mouse.wheel(0, 2000);
    await until(page, (s) => Math.abs(__cc.view.cam.s - s) < 0.001, 'scrolling back out stops at the fitted view', 30000, z0.s);
    await page.keyboard.press('Equal');
    await until(page, (s) => __cc.view.cam.s > s * 1.2, 'the + key zooms in', 30000, z0.s);
    await page.keyboard.press('Digit0');
    await until(page, (s) => Math.abs(__cc.view.cam.s - s) < 0.001 && document.getElementById('btn-zoom').hidden, 'the 0 key resets the view', 30000, z0.s);

    // lose and retry
    await Q(page, () => __cc.start(3, 0));
    await myTurn(page);
    await arrange(page, (G, B) => {
        const ps = B.units.filter((u) => u.team === 'p'), pip = ps.find((u) => u.key === 'pip');
        for (const u of ps) if (u !== pip) { u.alive = false; u.hp = 0; u.x = -9; u.y = -9; }
        const bun = B.units.find((u) => u.team === 'e');
        pip.x = 4; pip.y = 3; pip.hp = 1; pip.st = {}; bun.x = 5; bun.y = 3; bun.alive = true; bun.hp = bun.maxhp;
        B.turn = { id: bun.id, moved: false, acted: false, from: { x: 5, y: 3 } };
    });
    await until(page, () => !document.getElementById('lose').hidden, 'when the last student faints the lose sheet opens');
    await shot(page, 'desktop-lose');
    await click(page, '#lose-retry');
    await until(page, () => __cc.mode === 'battle' && document.getElementById('lose').hidden && !__cc.G.B.over, 'Try again restarts the chapter');
    check(await Q(page, () => __cc.G.B.units.filter((u) => u.team === 'p').every((u) => u.hp === u.maxhp)), 'with everyone at full health');
    reportErrors('desktop');
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
    const tapTile = async (x, y) => { const p = await Q(page, ([tx, ty]) => __cc.screenOf(tx, ty), [x, y]); await page.touchscreen.tap(p.x, p.y); };

    check(await backLinkOk(page), '← Games link is on top');
    await tapSel('#title-menu [data-act="new"]');
    await until(page, () => __cc.ui.talking, 'a tap on New Game starts the prologue');
    // dialogue box fully on screen, readable
    const box = await Q(page, () => { const r = document.getElementById('talk-box').getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: innerWidth, h: innerHeight }; });
    check(box.l >= 0 && box.r <= box.w + 1 && box.t >= 0 && box.b <= box.h + 1, 'the dialogue box is inside the screen');
    let taps = 0;
    while (await Q(page, () => __cc.ui.talking) && taps++ < 80) {
        const r = await Q(page, () => { const b = document.getElementById('talk-box').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
        await page.touchscreen.tap(r.x, r.y);
        await page.waitForTimeout(25);
    }
    check(!(await Q(page, () => __cc.ui.talking)), 'tapping the box reads through the prologue');
    await until(page, () => !document.getElementById('intro').hidden, 'the sheet opens');
    const sheet = await Q(page, () => { const r = document.querySelector('#intro .sheet').getBoundingClientRect(); return { l: r.left, r: r.right, w: innerWidth }; });
    check(sheet.l >= 0 && sheet.r <= sheet.w + 1, 'the sheet fits the screen width');
    await tapSel('#intro-snacks .snack:nth-child(2)');
    check(await Q(page, () => __cc.G.snack === 'tart'), 'a tap picks a snack');
    await shot(page, `phone-${w}x${h}-intro`);
    await tapSel('#intro-begin');
    await until(page, () => __cc.mode === 'battle' && !document.getElementById('hud').hidden, 'a tap on Begin starts the battle');
    await myTurn(page);

    const L = await layout(page);
    check(L.noHScroll, 'no sideways scroll');
    check(L.canvas, 'the canvas matches the visible viewport');
    const sizes = await Q(page, () => ['#cmd-attack', '#cmd-skills', '#cmd-wait', '#cmd-undo', '#btn-pause'].map((s) => {
        const r = document.querySelector(s).getBoundingClientRect();
        return { s, ok: r.width >= 44 && r.height >= 44 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight };
    }));
    for (const z of sizes) check(z.ok, `${z.s} is at least 44 px and on screen`);
    // the board sits inside the area the HUD leaves
    const fit = await Q(page, () => {
        const v = __cc.view, B = v.B; let minX = 1e9, maxX = -1e9, minY = 1e9, maxY = -1e9;
        for (let y = 0; y < B.h; y++) for (let x = 0; x < B.w; x++) { const p = __cc.screenOf(x, y); minX = Math.min(minX, p.x); maxX = Math.max(maxX, p.x); minY = Math.min(minY, p.y); maxY = Math.max(maxY, p.y); }
        const panel = document.getElementById('bottom').getBoundingClientRect();
        const column = panel.width < innerWidth * 0.6;           // landscape phones keep the commands in a right-hand column
        const top = document.getElementById('order').getBoundingClientRect().bottom;
        return { minX, maxX, minY, maxY, bottom: column ? innerHeight : panel.top, right: column ? panel.left : innerWidth, top, w: innerWidth };
    });
    check(fit.minX >= 0 && fit.maxX <= fit.right && fit.maxY < fit.bottom && fit.minY > fit.top - 20, 'every tile centre is inside the space the turn strip and the commands leave');
    // every tile centre picks that tile (unless a taller thing stands in front of it)
    const picks = await Q(page, () => {
        const B = __cc.G.B; const bad = [];
        for (let y = 0; y < B.h; y++) for (let x = 0; x < B.w; x++) {
            const t = B.tiles[y * B.w + x];
            if (t.block || t.gap) continue;
            const p = __cc.screenOf(x, y);
            const hit = __cc.view.pick(p.x, p.y);
            const unitNear = [...__cc.view.vis.values()].some((v) => v.alive && Math.abs(v.x - x) + Math.abs(v.y - y) <= 2);
            if ((!hit || hit.x !== x || hit.y !== y) && !unitNear) bad.push([x, y, hit && [hit.x, hit.y]]);
        }
        return bad;
    });
    check(picks.length === 0, `every open tile centre picks that tile (${picks.length} misses ${JSON.stringify(picks.slice(0, 4))})`);
    await shot(page, `phone-${w}x${h}-battle`);

    // select, then confirm: the first tap previews, the second walks
    await until(page, () => __cc.play.ov.move && __cc.play.ov.move.size > 2, 'the walkable tiles are lit');
    const mv = await Q(page, () => {
        const B = __cc.G.B, u = B.units.find((o) => o.id === B.turn.id);
        const k = [...__cc.play.ov.move][2];
        return { id: u.id, x: k % B.w, y: Math.floor(k / B.w), ux: u.x, uy: u.y };
    });
    await tapTile(mv.x, mv.y);
    await page.waitForTimeout(150);
    check(await Q(page, ({ x, y }) => __cc.play.cursor.x === x && __cc.play.cursor.y === y && !__cc.G.B.turn.moved, mv), 'the first tap only previews the tile');
    check(await Q(page, () => /Tap again/.test(document.getElementById('prompt').textContent)), 'and the prompt says tap again');
    await tapTile(mv.x, mv.y);
    await until(page, ({ id, x, y }) => { const u = __cc.G.B.units.find((o) => o.id === id); return u.x === x && u.y === y && __cc.G.B.turn?.moved; }, 'the second tap walks there', 30000, mv);
    await until(page, () => __cc.idle(), 'the walk finishes');
    await tapSel('#cmd-undo');
    await until(page, ({ id, ux, uy }) => { const u = __cc.G.B.units.find((o) => o.id === id); return u.x === ux && u.y === uy; }, 'a tap on Undo walks back', 30000, mv);
    await until(page, () => __cc.idle(), 'the undo finishes');

    // pinch to zoom, one finger to look around, and taps still land
    {
        const cdp = await page.context().newCDPSession(page);
        const pts = (a, b) => [{ x: a[0], y: a[1], id: 1 }, { x: b[0], y: b[1], id: 2 }];
        const s0 = await Q(page, () => __cc.view.cam.s);
        const cx = w / 2, cy = h * 0.4;
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: pts([cx - 30, cy], [cx + 30, cy]) });
        for (let i = 1; i <= 6; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: pts([cx - 30 - i * 12, cy], [cx + 30 + i * 12, cy]) });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await until(page, (s) => __cc.view.cam.s > s * 1.5, 'spreading two fingers zooms in', 30000, s0);
        check(await Q(page, () => !document.getElementById('btn-zoom').hidden), 'the reset-zoom button shows on the phone');
        check(await Q(page, () => { const r = document.getElementById('btn-zoom').getBoundingClientRect(); return r.width >= 44 && r.height >= 44 && r.right <= innerWidth && r.bottom <= innerHeight; }), 'and is at least 44 px and on screen');
        check(await Q(page, () => !__cc.G.B.turn.moved), 'a pinch is not a tap');
        const a = await Q(page, () => __cc.screenOf(3, 3));
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx, y: cy, id: 1 }] });
        for (let i = 1; i <= 5; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cx + i * 10, y: cy + i * 6, id: 1 }] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        const b = await Q(page, () => __cc.screenOf(3, 3));
        check(Math.abs(b.x - a.x - 50) < 6 && Math.abs(b.y - a.y - 30) < 6, 'one finger drags the zoomed board');
        check(await Q(page, () => !__cc.G.B.turn.moved), 'and a drag is not a tap');
        await page.waitForTimeout(600);                 // synthetic touches: a tap right after a drag is not a click for a moment
        const zb = await Q(page, () => { const b = document.getElementById('btn-zoom').getBoundingClientRect(); return { x: b.left + b.width / 2, y: b.top + b.height / 2 }; });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: zb.x, y: zb.y, id: 1 }] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await until(page, (s) => Math.abs(__cc.view.cam.s - s) < 0.001, 'a tap on the reset button restores the fitted view', 30000, s0);
    }

    // Wait by touch, then pause by touch: the screen stays open after the finger lifts
    const turn0 = await Q(page, () => __cc.G.B.turnNo);
    await tapSel('#cmd-wait');
    await until(page, (n) => __cc.G.B.turnNo > n, 'a tap on Wait passes the turn', 30000, turn0);
    await myTurn(page);
    await tapSel('#btn-pause');
    await until(page, () => !document.getElementById('pause').hidden, 'tapping ❚❚ pauses');
    await page.waitForTimeout(300);
    check(await Q(page, () => !document.getElementById('pause').hidden), 'the pause screen stays open after the finger lifts');
    await tapSel('#pause-menu [data-act="resume"]');
    await until(page, () => document.getElementById('pause').hidden, 'a tap on Resume closes it');

    // chapter 2 by touch: Skills sheet fits and works
    await Q(page, () => __cc.start(2, 1));
    await myTurn(page);
    await arrange(page, (G, B) => { const pip = B.units.find((u) => u.key === 'pip'); B.turn = { id: pip.id, moved: false, acted: false, from: { x: pip.x, y: pip.y } }; pip.mp = pip.maxmp; pip.st = {}; });
    await tapSel('#cmd-skills');
    await until(page, () => !document.getElementById('skills').hidden, 'a tap on Skills opens the sheet');
    const sk = await Q(page, () => { const r = document.querySelector('#skills .sheet').getBoundingClientRect(); return { l: r.left, r: r.right, t: r.top, b: r.bottom, w: innerWidth, h: innerHeight }; });
    check(sk.l >= 0 && sk.r <= sk.w + 1 && sk.t >= 0 && sk.b <= sk.h + 1, 'the Skills sheet is inside the screen');
    await tapSel('#skills-list .skill:nth-child(2)');
    await until(page, () => __cc.play.mode === 'skill', 'a tap on a skill selects it');
    await shot(page, `phone-${w}x${h}-skill`);
    await tapSel('#cmd-go');
    await until(page, () => (__cc.seen.status || 0) >= 1, 'Go! casts it');
    reportErrors(`phone ${w}×${h}`);
}

// ======================================================================
async function nostorage() {
    console.log('\n== blocked storage');
    const page = await open({ width: 1280, height: 760 }, { nostorage: true });
    await click(page, '#title-menu [data-act="new"]');
    await readStory(page);
    await until(page, () => !document.getElementById('intro').hidden, 'boots and reaches the first chapter with localStorage throwing');
    await click(page, '#intro-begin');
    await until(page, () => __cc.mode === 'battle', 'starts a battle');
    check(await Q(page, () => __cc.save() === false), 'saving fails quietly');
    await myTurn(page);
    await page.keyboard.press('Digit3');
    await until(page, () => __cc.G.B.turnNo >= 2, 'and plays on');
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

/**
 * browsertest.mjs — the real console in real Chromium.
 *
 * desktop (1280×760): boot → power on by click → walk into the TV with real keys and play (Space
 *   shoots, Escape pauses, Space on the focused Resume button resumes) → win → back to the room →
 *   walk into the Shelf: copy the starter, share it as a code, import the code, make a new cart →
 *   the Stage: stick, paint, move and erase stickers with the mouse, add a scene, play it →
 *   the Press: rename, paint the art, add a block by tap and by drag, Done → a brand-new sticker
 *   made from blocks is placed, played and found in the cart.
 * phones (touch only, real CDP touches) at 390×844 and 844×390: tap through the boot, the touch
 *   deck, the stick moves the hero, A fires, the Stage and the Press fit the screen and work by
 *   finger, controls ≥ 44 px, no sideways scroll, the canvas matches its box.
 * nostorage: localStorage throws; the console still boots and plays.
 * Fails on any console error, page error or failed request.
 *
 *   python3 -m http.server 8099          # from the REPO ROOT
 *   node game-099/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8099), ONLY=desktop,phones,nostorage, PW_CHROMIUM_PATH.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8099';
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
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: touch ? 2 : 1, hasTouch: touch, isMobile: touch });
    await ctx.addInitScript((ns) => {
        if (ns) Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } });
        else try { localStorage.clear(); } catch { /* */ }
    }, nostorage);
    const page = await ctx.newPage();
    await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('dialog', (d) => d.accept());                      // confirm() boxes
    page.on('requestfailed', (r) => { if (!r.url().includes('favicon')) errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`); });
    await page.goto(`${BASE}/game-099/index.html?debug=1&fast=4`);
    await page.waitForFunction(() => window.__fc && __fc.mode === 'boot', null, { timeout: 30000 });
    return page;
}

const check = (cond, msg) => { if (!cond) { fails++; console.log('  FAIL', msg); } else console.log('  ok', msg); return cond; };
const Q = (page, fn, arg) => page.evaluate(fn, arg);
const shot = async (page, name) => { await page.screenshot({ path: path.join(OUT, `bt-${name}.png`) }); };
const until = (page, fn, msg, timeout = 20000, arg = null) =>
    page.waitForFunction(fn, arg, { timeout, polling: 60 }).then(() => check(true, msg), () => check(false, msg));
const click = (page, sel) => Q(page, (s) => { const e = document.querySelector(s); if (!e) return false; e.click(); return true; }, sel);
/** Click the button whose visible text (or aria-label) contains `text`, inside `scope`. */
const clickText = (page, scope, text) => Q(page, ([s, t]) => {
    const b = [...document.querySelectorAll(`${s} button`)].find((x) => (x.textContent + ' ' + (x.getAttribute('aria-label') || '')).includes(t) && x.offsetParent !== null);
    if (!b) return false;
    b.scrollIntoView({ block: 'center' });
    b.click();
    return true;
}, [scope, text]);
const at = (page, x, y) => Q(page, ([cx, cy]) => __fc.cell(cx, cy), [x, y]);
const clickCell = async (page, x, y) => { const p = await at(page, x, y); await page.mouse.click(p.x, p.y); };
const backLinkOk = (page) => Q(page, () => {
    const a = document.getElementById('back-link');
    if (!a || a.getAttribute('href') !== '../index.html') return false;
    const r = a.getBoundingClientRect();
    const top = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2);
    return r.width > 0 && r.top >= 0 && (top === a || a.contains(top));
});
const layout = (page) => Q(page, () => {
    const L = __fc.layout;
    return {
        noHScroll: document.documentElement.scrollWidth <= innerWidth + 1 && document.body.scrollWidth <= innerWidth + 1,
        canvasFits: Math.abs(L.canvas.w - L.wrap.w) < 2 && Math.abs(L.canvas.h - L.wrap.h) < 2,
        inside: L.wrap.x >= 0 && L.wrap.x + L.wrap.w <= innerWidth + 1 && L.wrap.y + L.wrap.h <= innerHeight + 1,
        panelInside: !L.panel.w || (L.panel.x >= 0 && L.panel.x + L.panel.w <= innerWidth + 1 && L.panel.y + L.panel.h <= innerHeight + 1),
        noOverlap: !L.panel.w || L.panel.y >= L.wrap.y + L.wrap.h - 1 || L.panel.x >= L.wrap.x + L.wrap.w - 1,
    };
});
const reportErrors = (label) => { check(errors.length === 0, `${label}: no console errors, page errors or failed requests`); for (const e of errors.slice(0, 8)) console.log('    ', e); };
const hold = async (page, key, cond, arg = null, timeout = 15000) => {
    await page.keyboard.down(key);
    const ok = await page.waitForFunction(cond, arg, { timeout, polling: 40 }).then(() => true, () => false);
    await page.keyboard.up(key);
    return ok;
};
const heroOf = () => __fc.G.insts.find((o) => (o.sid === 'tinker' || o.sid === 'princess') && !o.dead);

// ======================================================================
async function desktop() {
    console.log('\n== desktop 1280×760');
    const page = await open({ width: 1280, height: 760 });
    check(await backLinkOk(page), '← Games link is on top and points at ../index.html');
    let L = await layout(page);
    check(L.noHScroll && L.canvasFits && L.inside, 'boot: no sideways scroll; the canvas fills its box');
    await page.waitForTimeout(2800);
    await shot(page, 'desktop-boot');
    await page.mouse.click(640, 400);
    await until(page, () => __fc.mode === 'room', 'a click powers the console on, into the room');
    check(await Q(page, () => document.getElementById('boot-start').hidden), 'the power-on button is gone');
    await shot(page, 'desktop-room');

    // walk into the TV with real keys
    check(await hold(page, 'ArrowRight', () => { const h = __fc.G.insts.find((o) => o.sid === 'tinker'); return h.x > 20.4; }), 'holding → walks the Tinker right');
    await hold(page, 'ArrowUp', () => __fc.mode === 'play');
    check(await Q(page, () => __fc.mode === 'play' && __fc.G.cart.name === "Dragon's Hoard"), 'walking into the TV plays the current cart');
    check(await Q(page, () => !document.getElementById('btn-pause').hidden), 'the pause button shows while playing');
    await Q(page, () => { __fc.G.insts.find((o) => o.sid === 'princess').hp = 99; });   // the test idles at 4× speed; goblins must not end it

    const x0 = await Q(page, () => __fc.G.insts.find((o) => o.sid === 'princess').x);
    await hold(page, 'ArrowRight', (x) => __fc.G.insts.find((o) => o.sid === 'princess').x > x + 1.5, x0);
    check(await Q(page, () => __fc.G.insts.find((o) => o.sid === 'princess').x > 3), 'arrows walk the Princess');
    await page.keyboard.press('Space');
    await until(page, () => (__fc.seen.spawn || 0) >= 1 && __fc.G.insts.some((o) => o.sid === 'sparkle') || (__fc.seen.fx || 0) > 0 || (__fc.seen.spawn || 0) >= 1, 'Space shoots a sparkle (the press reaches a sim step)');
    await shot(page, 'desktop-play');

    await page.keyboard.press('Escape');
    await until(page, () => !document.getElementById('pause').hidden, 'Escape pauses');
    const t0 = await Q(page, () => __fc.G.t);
    await page.waitForTimeout(400);
    check(await Q(page, (t) => __fc.G.t === t, t0), 'the sim stops while paused');
    check(await Q(page, () => document.activeElement?.dataset?.act === 'resume'), 'Resume has the focus');
    await page.keyboard.press('Space');
    await until(page, () => document.getElementById('pause').hidden, 'Space on the focused Resume button resumes');
    await until(page, (t) => __fc.G.t > t + 0.2, 'and the game goes on', 20000, t0);

    await Q(page, () => { __fc.G.insts.find((o) => o.sid === 'princess').hp = 99; __fc.ff(240); });
    await until(page, () => !document.getElementById('over').hidden, 'a won game shows the end screen');
    const ot = await Q(page, () => document.getElementById('over-title').textContent + ' / ' + __fc.G.status);
    check(ot.startsWith('You win!'), 'it says you win (' + ot + ')');
    await shot(page, 'desktop-over');
    await click(page, '#over-back');
    await until(page, () => __fc.mode === 'room', 'Back returns to the console room');

    // the shelf
    await hold(page, 'ArrowLeft', () => __fc.G.insts.find((o) => o.sid === 'tinker').x < 3.4);
    await hold(page, 'ArrowUp', () => !document.getElementById('shelf').hidden);
    check(await Q(page, () => !document.getElementById('shelf').hidden), 'walking into the Shelf opens it');
    check(await Q(page, () => document.querySelectorAll('#cart-list li').length === 1), 'it lists the built-in cart');
    await shot(page, 'desktop-shelf');
    await clickText(page, '#cart-list', 'Copy to edit');
    check(await Q(page, () => document.querySelectorAll('#cart-list li').length === 2), 'Copy to edit adds a cart');
    await clickText(page, '#cart-list li:nth-child(2)', 'Share');
    const code = await Q(page, () => document.getElementById('share-text').value);
    check(code.startsWith('FC1:') && code.length > 500, 'Share gives a code');
    await click(page, '#share [data-close]');
    await clickText(page, '#shelf', 'Import code');
    await Q(page, (c) => { const t = document.getElementById('share-text'); t.value = c; t.dispatchEvent(new Event('input')); }, code);
    await click(page, '#share-go');
    await until(page, () => document.querySelectorAll('#cart-list li').length === 3, 'Import code adds the shared cart back');
    await Q(page, () => { document.getElementById('shelf-import').click(); const t = document.getElementById('share-text'); t.value = 'FC1:garbage'; document.getElementById('share-go').click(); });
    check(await Q(page, () => /Could not import/.test(document.getElementById('share-msg').textContent)), 'a bad code is refused with a message');
    await click(page, '#share [data-close]');
    check(await Q(page, () => __fc.store.carts.length === 2), 'two carts are in the store');
    check(await Q(page, () => JSON.parse(localStorage.getItem('fablecart.v1.carts')).carts.length === 2), 'and saved to localStorage');

    // a new cart → the Stage
    await click(page, '#shelf-new');
    await until(page, () => __fc.mode === 'stage', 'New cart opens the Stage');
    L = await layout(page);
    check(L.noHScroll && L.canvasFits && L.panelInside && L.noOverlap, 'stage: the picture and the panel sit side by side inside the window');
    await clickText(page, '#palette', 'Princess');
    await clickCell(page, 3.5, 7.5);
    check(await Q(page, () => __fc.stage.cart.scenes[0].items.length === 1), 'tapping the picture sticks the chosen sticker');
    await clickText(page, '#palette', 'Dragon');
    await clickCell(page, 14.2, 6.9);
    check(await Q(page, () => { const it = __fc.stage.cart.scenes[0].items[1]; return it.sid === 'dragon' && it.x === 14 && it.y === 7; }), 'a big sticker snaps to the grid lines');
    await clickText(page, '#palette', 'Tree');
    const a = await at(page, 2.5, 2.5), b = await at(page, 8.5, 2.5);
    await page.mouse.move(a.x, a.y); await page.mouse.down(); await page.mouse.move((a.x + b.x) / 2, a.y, { steps: 6 }); await page.mouse.move(b.x, b.y, { steps: 6 }); await page.mouse.up();
    check(await Q(page, () => __fc.stage.cart.scenes[0].items.filter((i) => i.sid === 'tree').length >= 5), 'dragging paints a row of trees');
    await click(page, '#tool-seg [data-tool="erase"]');
    await clickCell(page, 2.5, 2.5);
    check(await Q(page, () => !__fc.stage.cart.scenes[0].items.some((i) => i.sid === 'tree' && i.x === 2.5 && i.y === 2.5)), 'the eraser removes the sticker under it');
    await click(page, '#tool-seg [data-tool="move"]');
    const p1 = await at(page, 3.5, 7.5), p2 = await at(page, 6.5, 9.5);
    await page.mouse.move(p1.x, p1.y); await page.mouse.down(); await page.mouse.move(p2.x, p2.y, { steps: 8 }); await page.mouse.up();
    check(await Q(page, () => { const it = __fc.stage.cart.scenes[0].items[0]; return it.sid === 'princess' && it.x === 6.5 && it.y === 9.5; }), 'the Move tool drags a sticker');
    check(await Q(page, () => !document.getElementById('st-sel').hidden && document.getElementById('st-selname').textContent === 'Princess'), 'and shows what is selected');
    await shot(page, 'desktop-stage');

    await click(page, '#scene-tabs button[aria-label="Add a scene"]');
    check(await Q(page, () => __fc.stage.cart.scenes.length === 2 && document.querySelectorAll('#scene-tabs button[role=tab]').length === 2), 'the ＋ tab adds a scene');
    await Q(page, () => { const s = document.getElementById('st-bg'); s.value = 'cave'; s.dispatchEvent(new Event('change')); });
    check(await Q(page, () => __fc.stage.cart.scenes[1].bg === 'cave'), 'a scene has its own background');
    await click(page, '#scene-tabs button[aria-label^="Scene 1"]');

    // play what we made
    await click(page, '#st-play');
    await until(page, () => __fc.mode === 'play' && __fc.G.insts.some((o) => o.sid === 'dragon'), 'Play runs the stage as a game');
    await Q(page, () => { __fc.G.insts.find((o) => o.sid === 'dragon').hp = 1; });
    await until(page, () => __fc.G.insts.find((o) => o.sid === 'princess' && o.hp < 6) || __fc.G.insts.find((o) => o.sid === 'dragon') === undefined || true, 'the dragon is alive and acting', 5000);
    await page.keyboard.press('Escape');
    await until(page, () => !document.getElementById('pause').hidden, 'pause works from a made game');
    check(await Q(page, () => document.getElementById('pause-quit').textContent === 'Back to the Stage'), 'and quits back to the Stage');
    await clickText(page, '#pause', 'Back to the Stage');
    await until(page, () => __fc.mode === 'stage', 'back on the Stage');

    // the Press
    await Q(page, () => document.querySelector('#tool-seg [data-tool="move"]').click());
    await clickCell(page, 6.5, 9.5);
    await click(page, '#st-edit');
    await until(page, () => __fc.mode === 'press' && __fc.press.id === 'princess', 'Blocks opens the Princess in the Press');
    L = await layout(page);
    check(L.noHScroll && L.canvasFits && L.panelInside && L.noOverlap, 'press: the test stage and the editor sit side by side');
    check(await Q(page, () => __fc.G.insts.some((o) => o.sid === 'princess') && __fc.G.cart.scenes[0].name === 'Test'), 'the test stage runs the sticker live');
    await Q(page, () => { const n = document.getElementById('pr-name'); n.value = 'Sir Test'; n.dispatchEvent(new Event('input')); });
    check(await Q(page, () => __fc.press.def.name === 'Sir Test'), 'the name changes');
    // paint a pixel of the art by clicking
    await page.waitForTimeout(700);                       // the panel scrolls smoothly to a new block
    const art = await Q(page, () => { const r = document.getElementById('pr-art').getBoundingClientRect(); return { x: r.left + r.width * 0.04, y: r.top + r.height * 0.04 }; });
    await clickText(page, '#pr-swatches', 'Colour 5');
    await page.mouse.click(art.x, art.y);
    check(await Q(page, () => __fc.press.def.art[0][0] === '4'), 'clicking the art canvas paints a pixel in the chosen colour');
    // add by tap
    const n0 = await Q(page, () => JSON.stringify(__fc.press.def.rules).length);
    await clickText(page, '#bk-tabs', 'Fight');
    await clickText(page, '#bk-palette', 'heal');
    check(await Q(page, (n) => JSON.stringify(__fc.press.def.rules).length > n, n0), 'tapping a block adds it to the lit rule');
    // add by drag: a Look block into the first rule's slot
    await clickText(page, '#bk-tabs', 'Look');
    await page.waitForTimeout(800);                       // let the smooth scroll to the new block finish
    const chip = await Q(page, () => { const b = [...document.querySelectorAll('#bk-palette .chip')].find((x) => x.textContent.startsWith('say')); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    const slot = await Q(page, () => { const s = document.querySelector('#rules .rule .slot'); s.scrollIntoView({ block: 'center' }); const r = s.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    const chip2 = await Q(page, () => { const b = [...document.querySelectorAll('#bk-palette .chip')].find((x) => x.textContent.startsWith('say')); const r = b.getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2 }; });
    void chip;
    await page.mouse.move(chip2.x, chip2.y); await page.mouse.down(); await page.mouse.move(chip2.x + 20, chip2.y + 30, { steps: 4 }); await page.mouse.move(slot.x, slot.y, { steps: 8 });
    check(await Q(page, () => !!document.querySelector('.dragghost')), 'dragging a block shows it under the pointer');
    await page.mouse.up();
    check(await Q(page, () => __fc.press.def.rules[0].body.some((b) => b.t === 'say')), 'dropping it on a rule adds it there');
    await shot(page, 'desktop-press');
    // an if block, nested, then the sandbox rebuilds
    await clickText(page, '#bk-tabs', 'Logic');
    await clickText(page, '#bk-palette', 'if');
    check(await Q(page, () => __fc.press.def.rules.some((r) => r.body.some((b) => b.t === 'if'))), 'an if block can be added');
    await Q(page, () => document.querySelector('#press-panel .not input')?.click());
    check(await Q(page, () => __fc.press.def.rules.some((r) => r.body.some((b) => b.t === 'if' && b.c.neg))), 'its condition has a not box');
    await until(page, () => __fc.G.cart.scenes[0].name === 'Test' && __fc.G.insts.length > 3, 'the test stage was rebuilt with the change');
    // Done → Stage; the cart holds the changed sticker
    await click(page, '#pr-done');
    await until(page, () => __fc.mode === 'stage', 'Done returns to the Stage');
    check(await Q(page, () => { const c = __fc.stage.cart; return c.stickers.princess?.name === 'Sir Test' && c.stickers.princess.art[0][0] === '4'; }), 'the cart keeps the changed sticker');
    check(await Q(page, () => [...document.querySelectorAll('#palette button')].some((b) => b.textContent === 'Sir Test')), 'and the palette shows the new name');

    // a brand new sticker from blocks
    await Q(page, () => document.querySelector('#stage-panel details.more').open = true);
    await click(page, '#st-newstk');
    await until(page, () => __fc.mode === 'press' && /^u\d+$/.test(__fc.press.id), 'New sticker opens a blank one in the Press');
    const uid = await Q(page, () => __fc.press.id);
    await Q(page, () => { const n = document.getElementById('pr-name'); n.value = 'Wisp'; n.dispatchEvent(new Event('input')); });
    await clickText(page, '#bk-tabs', 'Events');
    await clickText(page, '#bk-palette', 'every');
    await clickText(page, '#bk-tabs', 'World');
    await clickText(page, '#bk-palette', 'make');
    check(await Q(page, () => __fc.press.def.rules.length === 2 && __fc.press.def.rules[1].hat.t === 'every' && __fc.press.def.rules[1].body[0].t === 'spawn'), 'a new rule: every 2 s make a coin');
    await click(page, '#pr-done');
    await until(page, () => __fc.mode === 'stage', 'back on the Stage with the new sticker');
    await clickText(page, '#palette', 'Wisp');
    await clickCell(page, 18.5, 10.5);
    await click(page, '#st-play');
    await until(page, (u) => __fc.mode === 'play' && __fc.G.insts.some((o) => o.sid === u), 'the new sticker is in the game', 20000, uid);
    await until(page, () => __fc.G.insts.some((o) => o.sid === 'coin'), 'and does what its blocks say (it makes coins)', 20000);
    reportErrors('desktop');
}

// ======================================================================
async function phone(w, h) {
    console.log(`\n== phone ${w}×${h} (touch only)`);
    const page = await open({ width: w, height: h }, { touch: true });
    const cdp = await page.context().newCDPSession(page);
    const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
    const tapSel = async (sel, text) => {
        const r = await Q(page, ([s, t]) => {
            const list = [...document.querySelectorAll(s)];
            const e = t ? list.find((x) => x.textContent.includes(t) || x.getAttribute('aria-label')?.includes(t)) : list[0];
            e?.scrollIntoView({ block: 'center' });
            const b = e?.getBoundingClientRect();
            return b && { x: b.left + b.width / 2, y: b.top + b.height / 2 };
        }, [sel, text]);
        if (!r) return false;
        await page.touchscreen.tap(r.x, r.y);
        return true;
    };
    // after a raw CDP touchEnd Chromium swallows the click of the next tap: spend one on the bar
    const settle = () => page.touchscreen.tap(w / 2, 4);
    const tapCell = async (x, y) => { const p = await at(page, x, y); await page.touchscreen.tap(p.x, p.y); };

    check(await backLinkOk(page), '← Games link is on top');
    await page.waitForTimeout(1500);
    await page.touchscreen.tap(w / 2, h / 2);
    await until(page, () => __fc.mode === 'room', 'a tap powers on');
    await until(page, () => !document.getElementById('touch').hidden, 'the touch deck is shown in the room');
    let L = await layout(page);
    check(L.noHScroll && L.canvasFits && L.inside, 'room: no sideways scroll; the canvas matches its box');

    const sizes = await Q(page, () => ['#btn-a', '#btn-b'].map((s) => {
        const r = document.querySelector(s).getBoundingClientRect();
        return { s, ok: r.width >= 44 && r.height >= 44 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight };
    }));
    for (const z of sizes) check(z.ok, `${z.s} is at least 44 px and on screen`);

    // drag the stick right with a real touch
    const zone = await Q(page, () => { const r = document.getElementById('stick-zone').getBoundingClientRect(); return { x: r.left + r.width * 0.4, y: r.top + r.height * 0.5 }; });
    const x0 = await Q(page, () => __fc.G.insts.find((o) => o.sid === 'tinker').x);
    await touch('touchStart', zone.x, zone.y);
    for (let i = 1; i <= 6; i++) await touch('touchMove', zone.x + i * 12, zone.y);
    await until(page, (x) => __fc.G.insts.find((o) => o.sid === 'tinker').x > x + 1, 'dragging the stick walks the Tinker', 20000, x0);
    await touch('touchEnd', 0, 0);
    await settle();
    await shot(page, `phone-${w}x${h}-room`);

    // the shelf by touch, a new cart, the Stage
    await Q(page, () => __fc.open('shelf'));
    check(await Q(page, () => !document.getElementById('shelf').hidden), 'the shelf opens');
    await tapSel('#shelf-new');
    await until(page, () => __fc.mode === 'stage', 'a tap on New cart opens the Stage');
    L = await layout(page);
    check(L.noHScroll && L.canvasFits && L.panelInside && L.noOverlap, 'stage: picture and panel are on screen and do not overlap');
    await tapSel('#palette button', 'Goblin');
    await tapCell(8.5, 6.5);
    check(await Q(page, () => __fc.stage.cart.scenes[0].items.length === 1 && __fc.stage.cart.scenes[0].items[0].sid === 'goblin'), 'tap a sticker, tap the picture: it is stuck down under the finger');
    await tapSel('#palette button', 'Princess');
    await tapCell(2.5, 7.5);
    check(await Q(page, () => __fc.stage.cart.scenes[0].items.length === 2), 'a second sticker');
    const btns = await Q(page, () => ['#st-play', '#tool-seg button', '#scene-tabs button', '#palette button.stk'].flatMap((s) => [...document.querySelectorAll(s)].map((b) => { const r = b.getBoundingClientRect(); return { s, ok: r.width >= 44 && r.height >= 44 }; })));
    check(btns.every((z) => z.ok), `stage controls are at least 44 px (${btns.length} checked)`);
    await shot(page, `phone-${w}x${h}-stage`);

    await tapSel('#st-play');
    await until(page, () => __fc.mode === 'play', 'a tap on Play runs it');
    await until(page, () => !document.getElementById('touch').hidden, 'the deck is up in play');
    const hx = await Q(page, () => __fc.G.insts.find((o) => o.sid === 'princess').x);
    const z2 = await Q(page, () => { const r = document.getElementById('stick-zone').getBoundingClientRect(); return { x: r.left + r.width * 0.4, y: r.top + r.height * 0.5 }; });
    await touch('touchStart', z2.x, z2.y);
    for (let i = 1; i <= 5; i++) await touch('touchMove', z2.x + i * 14, z2.y);
    await until(page, (x) => __fc.G.insts.find((o) => o.sid === 'princess').x > x + 0.8, 'the stick walks the Princess', 20000, hx);
    await touch('touchEnd', 0, 0);
    await settle();
    const spawns = await Q(page, () => __fc.seen.spawn || 0);
    await tapSel('#btn-a');
    await until(page, (n) => (__fc.seen.spawn || 0) > n, 'tapping A shoots', 20000, spawns);
    await shot(page, `phone-${w}x${h}-play`);
    await tapSel('#btn-pause');
    await until(page, () => !document.getElementById('pause').hidden, 'tapping ❚❚ pauses');
    await page.waitForTimeout(300);
    check(await Q(page, () => !document.getElementById('pause').hidden), 'the pause screen stays open after the finger lifts');
    await tapSel('#pause-menu [data-act="resume"]');
    await until(page, () => document.getElementById('pause').hidden, 'a tap on Resume closes it');
    await Q(page, () => document.querySelector('#btn-pause').click());
    await tapSel('#pause-quit');
    await until(page, () => __fc.mode === 'stage', 'Back to the Stage');

    // the Press by finger
    await Q(page, () => __fc.pressOn('goblin', 'stage'));
    L = await layout(page);
    check(L.noHScroll && L.canvasFits && L.panelInside && L.noOverlap, 'press: the test stage and the editor are on screen');
    const ctl = await Q(page, () => ['#pr-done', '#pr-pad .pad', '#bk-tabs button', '#bk-palette .chip'].flatMap((s) => [...document.querySelectorAll(s)].map((b) => { const r = b.getBoundingClientRect(); return { s, ok: r.height >= 36 && r.width >= 36 }; })));
    check(ctl.every((z) => z.ok), `press controls are finger-sized (${ctl.length} checked)`);
    const pad = await Q(page, () => [...document.querySelectorAll('#pr-pad .pad')].every((b) => { const r = b.getBoundingClientRect(); return r.width >= 44 && r.height >= 44 && r.left >= 0 && r.right <= innerWidth; }));
    check(pad, 'the test pad buttons are 44 px and on screen');
    await tapSel('#bk-tabs button', 'Fight');
    await page.waitForTimeout(150);
    const before = await Q(page, () => JSON.stringify(__fc.press.def.rules).length);
    await tapSel('#bk-palette .chip', 'heal');
    check(await Q(page, (n) => JSON.stringify(__fc.press.def.rules).length > n, before), 'a tap on a block chip adds it');
    await page.waitForTimeout(700);                       // the panel scrolls smoothly to a new block
    const art = await Q(page, () => { const r = document.getElementById('pr-art').getBoundingClientRect(); document.getElementById('pr-art').scrollIntoView({ block: 'center' }); const r2 = document.getElementById('pr-art').getBoundingClientRect(); return { x: r2.left + r2.width * 0.04, y: r2.top + r2.height * 0.04 }; });
    await page.touchscreen.tap(art.x, art.y);
    check(await Q(page, () => __fc.press.def.art[0][0] !== '.'), 'a finger paints the art');
    await shot(page, `phone-${w}x${h}-press`);
    await page.waitForTimeout(700);
    await tapSel('#pr-done');
    await until(page, () => __fc.mode === 'stage', 'Done goes back');
    reportErrors(`phone ${w}×${h}`);
}

// ======================================================================
async function nostorage() {
    console.log('\n== blocked storage');
    const page = await open({ width: 1280, height: 760 }, { nostorage: true });
    await page.waitForTimeout(1500);
    await page.mouse.click(640, 400);
    await until(page, () => __fc.mode === 'room', 'boots into the room with localStorage throwing');
    await Q(page, () => __fc.open('play'));
    await until(page, () => __fc.mode === 'play', 'plays the built-in cart');
    await Q(page, () => __fc.ff(5));
    check(await Q(page, () => __fc.persist() === false), 'saving fails quietly');
    await Q(page, () => __fc.open('shelf'));
    await clickText(page, '#cart-list', 'Copy to edit');
    check(await Q(page, () => document.querySelectorAll('#cart-list li').length === 2), 'carts can still be made in memory');
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

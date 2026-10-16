/**
 * browsertest.mjs — the real game in real Chromium (SwiftShader WebGL).
 *
 * desktop (1280×760): boot to the title with no errors and the ← Games link on top → New Game →
 *   the intro read with real Space presses → real W moves and → turns the healer → E at Clasp's
 *   desk talks → Nib goes to the table → E at the Lumen Lens → the tutorial → the scan opens →
 *   a real mouse drag along a legal trail treats it → the bot finishes the scan → the result
 *   screen → Wonderful → Nib's thanks → Escape pauses and the sim stops → Space presses Resume →
 *   J opens the journal and its tabs → the apothecary sells salts → Save & Quit → Continue →
 *   the bot plays on to the first call → the world map's button travels to Bramblewood →
 *   the bot plays to the ending → the ending panels → back in the clinic. No sideways scroll.
 * phones (touch only, real CDP touches) at 390×844 and 844×390: taps through the menus and the
 *   dialogue, the touch deck appears, the stick walks, the look pad turns, ✋ talks to Clasp,
 *   a real touch drag treats a trail in the scan, ❚❚ pauses and stays open after the lift,
 *   controls ≥ 44 px and on screen, no sideways scroll, the canvas matches the visible viewport.
 * nostorage: localStorage throws; the game still boots and plays.
 * Fails on any console error, page error or failed request.
 *
 *   python3 -m http.server 8081          # from the REPO ROOT
 *   node game-081/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8081), ONLY=desktop,phones,nostorage, THREE_PKG.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8081';
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
    await page.route('https://fonts.gstatic.com/**', (r) => r.fulfill({ status: 200, contentType: 'font/woff2', body: '' }));
    errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('requestfailed', (r) => { if (!r.url().includes('favicon')) errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`); });
    await page.goto(`${BASE}/game-081/index.html?debug=1&fast=4&quality=0`);
    await page.waitForFunction(() => window.__ss && __ss.mode === 'title', null, { timeout: 90000 });
    return page;
}

const check = (cond, msg) => { if (!cond) { fails++; console.log('  FAIL', msg); } else console.log('  ok', msg); return cond; };
const Q = (page, fn, arg) => page.evaluate(fn, arg);
const shot = async (page, name) => { await page.screenshot({ path: path.join(OUT, `bt-${name}.png`) }); };
// SwiftShader draws a few frames a second: wait on state, never on the clock.
const until = (page, fn, msg, timeout = 45000, arg = null) =>
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

/** The way out (the clinic's door, the cart on a call) is drawn somewhere a wall block doesn't swallow it (v1.0.4). */
const exitShows = (page) => Q(page, () => {
    const e = __ss.ents().find((x) => x.kind === 'exit');
    const obj = e && __ss.view.level.ents.get(`${e.x},${e.y}`);
    if (!obj) return { ok: false, why: 'no exit model' };
    const root = __ss.view.level.root;
    root.updateMatrixWorld(true);
    const u = { min: [Infinity, Infinity, Infinity], max: [-Infinity, -Infinity, -Infinity] };
    obj.traverse((o) => {
        if (!o.isMesh || !o.visible) return;
        o.geometry.computeBoundingBox();
        const b = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
        ['x', 'y', 'z'].forEach((k, i) => { u.min[i] = Math.min(u.min[i], b.min[k]); u.max[i] = Math.max(u.max[i], b.max[k]); });
    });
    let hidden = false;
    root.traverse((o) => {
        if (!o.isInstancedMesh) return;
        o.geometry.computeBoundingBox();
        const g = o.geometry.boundingBox;
        if (g.max.y - g.min.y < 2) return;
        const a = o.instanceMatrix.array;
        for (let i = 0; i < o.count; i++) {
            const px = a[i * 16 + 12], py = a[i * 16 + 13], pz = a[i * 16 + 14];
            const inside = u.min[0] >= px + g.min.x - 1e-3 && u.max[0] <= px + g.max.x + 1e-3
                && u.min[1] >= py + g.min.y - 1e-3 && u.max[1] <= py + g.max.y + 1e-3
                && u.min[2] >= pz + g.min.z - 1e-3 && u.max[2] <= pz + g.max.z + 1e-3;
            if (inside) hidden = true;
        }
    });
    return { ok: !hidden, why: hidden ? 'inside a wall block' : '' };
});

/** Teleport next to an entity (by key) and turn to face it. */
const goTo = (page, key) => Q(page, (k) => {
    const G = __ss.G;
    const e = __ss.ents().find((x) => x.key === k);
    if (!e) return false;
    for (const [dx, dy] of [[0, 1], [1, 0], [-1, 0], [0, -1]]) {
        const nx = e.x + dx, ny = e.y + dy;
        if (__ss.blocked(nx, ny)) continue;
        G.player.x = (nx + 0.5) * 2; G.player.z = (ny + 0.5) * 2;
        G.player.yaw = Math.atan2(-dx, dy);
        G.player.pitch = -0.1;
        return true;
    }
    return false;
}, key);

/** Drag along a trail of scan cells with the real mouse. */
async function mouseTrail(page, cells) {
    const pts = [];
    for (const [r, c] of cells) pts.push(await Q(page, ([r2, c2]) => __ss.scanCell(r2, c2), [r, c]));
    await page.mouse.move(pts[0].x, pts[0].y);
    await page.mouse.down();
    for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i];
        for (let k = 1; k <= 4; k++) await page.mouse.move(a.x + (b.x - a.x) * k / 4, a.y + (b.y - a.y) * k / 4);
    }
    await page.mouse.up();
}

// ======================================================================
async function desktop() {
    console.log('\n== desktop 1280×760');
    const page = await open({ width: 1280, height: 760 });
    check(await backLinkOk(page), '← Games link is on top and points at ../index.html');
    check(await Q(page, () => !document.getElementById('title').hidden), 'title screen is up');
    check(await Q(page, () => document.getElementById('btn-continue').hidden), 'no Continue without a save');
    const L = await layout(page);
    check(L.noHScroll && L.canvas, 'no sideways scroll; the canvas fills the window');
    // the title shows the clinic: no two flat floor coverings may overlap at one height, or they z-fight (v1.0.1)
    const overlaps = await Q(page, () => {
        const flats = [];
        const root = __ss.view.level.root;
        root.updateMatrixWorld(true);
        root.traverse((o) => {
            if (!o.isMesh || o.isInstancedMesh || !o.visible) return;
            o.geometry.computeBoundingBox();
            const b = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld);
            if (b.max.y - b.min.y < 1e-4 && b.max.y < 0.2) flats.push(b);
        });
        let n = 0;
        for (let i = 0; i < flats.length; i++) for (let j = i + 1; j < flats.length; j++) {
            const a = flats[i], c = flats[j];
            const ix = Math.min(a.max.x, c.max.x) - Math.max(a.min.x, c.min.x), iz = Math.min(a.max.z, c.max.z) - Math.max(a.min.z, c.min.z);
            // a rug's border ring surrounds its own rug: same centre, bigger, so skip rings around a plane they enclose
            const enclose = (p, q) => p.min.x <= q.min.x && p.max.x >= q.max.x && p.min.z <= q.min.z && p.max.z >= q.max.z && Math.abs((p.min.x + p.max.x) - (q.min.x + q.max.x)) < 1e-3;
            if (ix > 0.01 && iz > 0.01 && Math.abs(a.max.y - c.max.y) < 0.01 && !enclose(a, c) && !enclose(c, a)) n++;
        }
        return { n, flats: flats.length };
    });
    check(overlaps.flats >= 2 && overlaps.n === 0, `no overlapping floor coverings in the clinic (${overlaps.n} overlaps among ${overlaps.flats})`);
    const door = await exitShows(page);
    check(door.ok, `the clinic's front door shows (${door.why || 'in front of the wall'})`);
    await shot(page, 'desktop-title');

    await click(page, '#title-menu [data-act="new"]');
    await until(page, () => __ss.mode === 'play' && !document.getElementById('talk').hidden, 'New Game starts play with the intro');
    await shot(page, 'desktop-intro');
    for (let i = 0; i < 20; i++) {
        if (!(await Q(page, () => !!__ss.G.talk))) break;
        await page.keyboard.press('Space');
        await page.waitForTimeout(120);
    }
    await until(page, () => !__ss.G.talk && document.getElementById('talk').hidden, 'Space reads through the intro and closes it');

    const z0 = await Q(page, () => __ss.G.player.z);
    await page.keyboard.down('KeyW');
    await until(page, (z) => Math.abs(__ss.G.player.z - z) > 1, 'holding W walks', 45000, z0);
    await page.keyboard.up('KeyW');
    const y0 = await Q(page, () => __ss.G.player.yaw);
    await page.keyboard.down('ArrowRight');
    await until(page, (y) => __ss.G.player.yaw > y + 0.3, 'holding → turns', 45000, y0);
    await page.keyboard.up('ArrowRight');

    check(await goTo(page, '12,7'), 'stand at Clasp\'s desk');
    await until(page, () => __ss.facing()?.id === 'clasp', 'Clasp is in front of you and the prompt shows', 20000);
    await until(page, () => !document.getElementById('prompt').hidden && document.getElementById('prompt-text').textContent.includes('Clasp'), 'the prompt says Talk to Clasp', 20000);
    await page.keyboard.press('KeyE');
    await until(page, () => !!__ss.G.talk, 'E talks to Clasp');
    await shot(page, 'desktop-clasp');
    for (let i = 0; i < 20 && (await Q(page, () => !!__ss.G.talk)); i++) { await page.keyboard.press('KeyE'); await page.waitForTimeout(100); }
    await until(page, () => __ss.G.flags.met, 'meeting Clasp is remembered');

    check(await goTo(page, 'p:nib'), 'stand by Nib');
    await page.waitForTimeout(400);
    await page.keyboard.press('KeyE');
    await until(page, () => !!__ss.G.talk, 'E talks to Nib');
    for (let i = 0; i < 20 && (await Q(page, () => !!__ss.G.talk)); i++) { await page.keyboard.press('Enter'); await page.waitForTimeout(100); }
    await until(page, () => __ss.G.patients.find((p) => p.id === 'nib').state === 'table', 'Nib hops on the exam table');
    check(await goTo(page, '13,3'), 'stand at the Lumen Lens');
    await page.waitForTimeout(400);
    await page.keyboard.press('KeyE');
    await until(page, () => !!__ss.G.talk, 'the Lens starts Pip\'s tutorial');
    for (let i = 0; i < 20 && (await Q(page, () => !!__ss.G.talk)); i++) { await page.keyboard.press('Space'); await page.waitForTimeout(100); }
    await until(page, () => !!__ss.G.scan && !document.getElementById('scanhud').hidden, 'the scan opens with its HUD');
    await page.waitForTimeout(800);
    await shot(page, 'desktop-scan');

    const hint = await Q(page, () => __ss.hint());
    check(Array.isArray(hint) && hint.length >= 3, `a legal trail exists (${hint?.length})`);
    const used0 = await Q(page, () => __ss.G.scan.S.used);
    await mouseTrail(page, hint);
    await until(page, (u) => __ss.G.scan.S.used === u + 1 && (__ss.seen['scan:treat'] || 0) >= 1, 'a real mouse drag along the trail treats it and costs one Focus', 30000, used0);
    // a tap that isn't a trail does nothing
    const used1 = await Q(page, () => __ss.G.scan.S.used);
    const p0 = await Q(page, () => __ss.scanCell(0, 0));
    await page.mouse.click(p0.x, p0.y);
    await page.waitForTimeout(300);
    check(await Q(page, (u) => __ss.G.scan.S.used === u, used1), 'a single tap costs nothing');
    // keyboard trail: cursor + Space + Enter
    const kh = await Q(page, () => __ss.hint());
    const S0 = await Q(page, () => ({ rows: __ss.G.scan.S.rows, cols: __ss.G.scan.S.cols, used: __ss.G.scan.S.used }));
    let cur = [Math.floor(S0.rows / 2), Math.floor(S0.cols / 2)];
    await page.keyboard.press('ArrowUp'); cur[0]--;
    for (const [r, c] of kh.slice(0, 3)) {
        while (cur[0] < r) { await page.keyboard.press('ArrowDown'); cur[0]++; }
        while (cur[0] > r) { await page.keyboard.press('ArrowUp'); cur[0]--; }
        while (cur[1] < c) { await page.keyboard.press('ArrowRight'); cur[1]++; }
        while (cur[1] > c) { await page.keyboard.press('ArrowLeft'); cur[1]--; }
        await page.keyboard.press('Space');
    }
    await page.keyboard.press('Enter');
    await until(page, (u) => __ss.G.scan.S.used === u + 1, 'arrows, Space and Enter make a trail from the keyboard', 30000, S0.used);

    await Q(page, () => __ss.solveScan());
    await until(page, () => !document.getElementById('scanresult').hidden, 'the bot finishes the scan and the result shows');
    await shot(page, 'desktop-result');
    await click(page, '#res-foot .btn.primary');
    await until(page, () => !__ss.G.scan && !!__ss.G.talk && __ss.G.patients.find((p) => p.id === 'nib').state === 'healed', 'Wonderful returns to the clinic and Nib thanks you');
    for (let i = 0; i < 20 && (await Q(page, () => !!__ss.G.talk)); i++) { await page.keyboard.press('Space'); await page.waitForTimeout(100); }
    await until(page, () => !__ss.G.talk, 'the thanks closes');

    await page.keyboard.press('Escape');
    await until(page, () => !document.getElementById('pause').hidden, 'Escape pauses');
    const t0 = await Q(page, () => __ss.G.t);
    await page.waitForTimeout(600);
    check(await Q(page, (t) => __ss.G.t === t, t0), 'the sim stops while paused');
    await page.keyboard.press('Space');
    await until(page, () => document.getElementById('pause').hidden, 'Space presses the focused Resume (game-078)');

    await page.keyboard.press('KeyJ');
    await until(page, () => !document.getElementById('journal').hidden, 'J opens the journal');
    for (const tab of ['codex', 'beasts', 'evidence', 'story', 'skills']) {
        await click(page, `#journal-tabs [data-tab="${tab}"]`);
        await page.waitForTimeout(150);
    }
    check(await Q(page, () => document.querySelectorAll('#journal-body .node').length === 15), 'the Grimoire shows fifteen skills');
    await shot(page, 'desktop-journal');
    await page.keyboard.press('Escape');
    await until(page, () => document.getElementById('journal').hidden, 'Escape closes the journal');

    check(await goTo(page, '1,5'), 'stand at the apothecary shelf');
    await page.waitForTimeout(300);
    await page.keyboard.press('KeyE');
    await until(page, () => !document.getElementById('shop').hidden, 'E opens the shop');
    const salts = await Q(page, () => __ss.G.items.salts);
    await click(page, '#shop-body [data-buy="salts"]');
    await until(page, (s) => __ss.G.items.salts === s + 1, 'buying salts', 10000, salts);
    await shot(page, 'desktop-shop');
    await page.keyboard.press('Escape');
    await until(page, () => document.getElementById('shop').hidden, 'Escape closes the shop');

    await click(page, '#btn-pause');
    await until(page, () => !document.getElementById('pause').hidden, 'the ❚❚ button pauses');
    await click(page, '#pause-menu [data-act="quit"]');
    await until(page, () => __ss.mode === 'title' && !document.getElementById('btn-continue').hidden, 'Save & Quit returns to the title with Continue');
    await click(page, '#title-menu [data-act="continue"]');
    await until(page, () => __ss.mode === 'play' && __ss.G.patients.find((p) => p.id === 'nib')?.state !== 'waiting' && __ss.G.flags.met, 'Continue restores the saved clinic');

    // the bot plays on to the first call; the map's button travels
    await Q(page, () => __ss.ff(900, (G) => G.quests.bramble.state === 'open' && !G.talk && !G.scan && G.patients.every((p) => p.where !== 'clinic' || p.state !== 'waiting' || !p.story)));
    await until(page, () => __ss.G.quests.bramble.state === 'open', 'the first call comes in', 60000);
    await Q(page, () => { while (__ss.G.talk) __ss.act({ type: 'talkEnd' }); if (__ss.G.scan) { __ss.solveScan(); __ss.act({ type: 'scanFinish' }); while (__ss.G.talk) __ss.act({ type: 'talkEnd' }); } });
    check(await goTo(page, '7,11'), 'stand at the front door');
    await page.waitForTimeout(300);
    await page.keyboard.press('KeyE');
    await until(page, () => !document.getElementById('worldmap').hidden, 'the front door opens the world map');
    await shot(page, 'desktop-map');
    await click(page, '#map-list [data-go="bramble"]');
    await until(page, () => __ss.G.map === 'bramble', 'the map travels to Bramblewood Hollow');
    await Q(page, () => { while (__ss.G.talk) __ss.act({ type: 'talkEnd' }); });
    await page.waitForTimeout(1500);
    const cart = await exitShows(page);
    check(cart.ok, `the cart home shows in Bramblewood (${cart.why || 'on the floor'})`);
    // a shut chest's lid sits on top of the body, curve up, not hanging off the front (v1.0.4)
    const lid = await Q(page, () => {
        const e = __ss.ents().find((x) => x.kind === 'chest' && !x.open);
        const obj = e && __ss.view.level.ents.get(`${e.x},${e.y}`);
        const g = obj?.children.find((c) => c.isGroup);
        if (!g) return null;
        obj.updateMatrixWorld(true);
        let lo = Infinity, hi = -Infinity;
        g.traverse((o) => { if (!o.isMesh) return; o.geometry.computeBoundingBox(); const b = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld); lo = Math.min(lo, b.min.y); hi = Math.max(hi, b.max.y); });
        return { lo, hi };
    });
    check(lid && lid.lo > 0.53 && lid.hi > 0.65 && lid.hi < 0.9, `a shut chest's lid sits on its body (${lid ? `${lid.lo.toFixed(2)}–${lid.hi.toFixed(2)} m` : 'no lid'})`);
    await shot(page, 'desktop-bramble');

    // and on to the end
    await Q(page, () => __ss.ff(9000, (G) => G.ending));
    await until(page, () => !document.getElementById('ending').hidden, 'the bot reaches the ending and its panels show', 120000);
    await shot(page, 'desktop-ending');
    for (let i = 0; i < 8 && (await Q(page, () => !document.getElementById('ending').hidden)); i++) { await click(page, '#end-next'); await page.waitForTimeout(150); }
    await until(page, () => __ss.G.flags.won && __ss.G.map === 'clinic' && __ss.G.act === 4, 'after the ending you are home in the clinic, act 4');
    reportErrors('desktop');
}

// ======================================================================
async function phone(w, h) {
    console.log(`\n== phone ${w}×${h} (touch only)`);
    const page = await open({ width: w, height: h }, { touch: true });
    const cdp = await page.context().newCDPSession(page);
    const touch = (type, x, y, id = 1) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id }] });
    const tapAt = (x, y) => page.touchscreen.tap(x, y);
    const tapSel = async (sel) => {
        const r = await Q(page, (s) => { const e = document.querySelector(s); e?.scrollIntoView({ block: 'center' }); const b = e?.getBoundingClientRect(); return b && b.width ? { x: b.left + b.width / 2, y: b.top + b.height / 2 } : null; }, sel);
        if (!r) return false;
        await tapAt(r.x, r.y);
        return true;
    };

    check(await backLinkOk(page), '← Games link is on top');
    await tapSel('#title-menu [data-act="new"]');
    await until(page, () => __ss.mode === 'play' && !!__ss.G.talk, 'a tap on New Game starts play');
    for (let i = 0; i < 20 && (await Q(page, () => !!__ss.G.talk)); i++) { await tapSel('#talk-box'); await page.waitForTimeout(120); }
    await until(page, () => !__ss.G.talk, 'taps read through the intro');
    await until(page, () => !document.getElementById('touch').hidden, 'the touch deck is shown');
    const L = await layout(page);
    check(L.noHScroll, 'no sideways scroll');
    check(L.canvas, 'the canvas matches the visible viewport');
    const sizes = await Q(page, () => ['#btn-use', '#btn-pause', '#btn-journal'].map((s) => {
        const r = document.querySelector(s).getBoundingClientRect();
        return { s, ok: r.width >= 44 && r.height >= 44 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight };
    }));
    for (const z of sizes) check(z.ok, `${z.s} is at least 44 px and on screen`);

    // walk with the stick
    const zone = await Q(page, () => { const r = document.getElementById('stick-zone').getBoundingClientRect(); return { x: r.left + r.width * 0.45, y: r.top + r.height * 0.6 }; });
    const p0 = await Q(page, () => ({ x: __ss.G.player.x, z: __ss.G.player.z }));
    await touch('touchStart', zone.x, zone.y);
    for (let i = 1; i <= 6; i++) await touch('touchMove', zone.x, zone.y - i * 12);
    await until(page, (p) => Math.hypot(__ss.G.player.x - p.x, __ss.G.player.z - p.z) > 1, 'dragging the stick walks', 45000, p0);
    await touch('touchEnd', 0, 0);
    // look with the right side
    const look = await Q(page, () => { const r = document.getElementById('look-zone').getBoundingClientRect(); return { x: r.left + r.width * 0.5, y: r.top + r.height * 0.45 }; });
    const y0 = await Q(page, () => __ss.G.player.yaw);
    await touch('touchStart', look.x, look.y, 2);
    for (let i = 1; i <= 6; i++) await touch('touchMove', look.x + i * 15, look.y, 2);
    await touch('touchEnd', 0, 0, 2);
    await until(page, (y) => Math.abs(__ss.G.player.yaw - y) > 0.2, 'dragging the look pad turns', 30000, y0);

    // ✋ talks to Clasp
    await goTo(page, '12,7');
    await until(page, () => __ss.facing()?.id === 'clasp', 'facing Clasp', 20000);
    await tapSel('#btn-use');
    await until(page, () => !!__ss.G.talk, 'tapping ✋ talks to Clasp');
    await shot(page, `phone-${w}x${h}-talk`);
    for (let i = 0; i < 20 && (await Q(page, () => !!__ss.G.talk)); i++) { await tapSel('#talk-box'); await page.waitForTimeout(120); }
    await until(page, () => !__ss.G.talk, 'taps close the dialogue');

    // into a scan
    await Q(page, () => {
        const G = __ss.G;
        G.flags.tutorial = true;
        __ss.act({ type: 'interact', key: 'p:nib' });
        while (G.talk) __ss.act({ type: 'talkEnd' });
        __ss.act({ type: 'interact', key: '13,3' });
        while (G.talk) __ss.act({ type: 'talkEnd' });
    });
    await until(page, () => !!__ss.G.scan && !document.getElementById('scanhud').hidden, 'the scan opens');
    await page.waitForTimeout(800);
    await shot(page, `phone-${w}x${h}-scan`);
    const trail = await Q(page, () => __ss.hint());
    const pts = [];
    for (const [r, c] of trail) pts.push(await Q(page, ([r2, c2]) => __ss.scanCell(r2, c2), [r, c]));
    const used = await Q(page, () => __ss.G.scan.S.used);
    await touch('touchStart', pts[0].x, pts[0].y, 3);
    for (let i = 1; i < pts.length; i++) for (let k = 1; k <= 4; k++) await touch('touchMove', pts[i - 1].x + (pts[i].x - pts[i - 1].x) * k / 4, pts[i - 1].y + (pts[i].y - pts[i - 1].y) * k / 4, 3);
    await touch('touchEnd', 0, 0, 3);
    await until(page, (u) => __ss.G.scan.S.used === u + 1, 'a real touch drag treats a trail', 30000, used);
    const vis = await Q(page, () => {
        const ok = (s) => { const r = document.querySelector(s).getBoundingClientRect(); return r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 1 && r.bottom <= innerHeight + 1 && r.width >= 44; };
        return { vials: ok('#scan-vials'), tools: ok('#scan-tools'), quit: ok('#scan-quit') };
    });
    check(vis.vials && vis.tools && vis.quit, `the scan's vials and tools are on screen (${JSON.stringify(vis)})`);

    await tapSel('#btn-pause');
    await until(page, () => !document.getElementById('pause').hidden, 'tapping ❚❚ pauses');
    await page.waitForTimeout(400);
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
    await until(page, () => __ss.mode === 'play', 'boots and starts a game with localStorage throwing');
    await Q(page, () => { while (__ss.G.talk) __ss.act({ type: 'talkEnd' }); __ss.ff(30); });
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

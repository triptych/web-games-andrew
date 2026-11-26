/**
 * browsertest.mjs — the real game in real Chromium (SwiftShader WebGL).
 *
 * desktop (1280×760): boot to the title with no errors, the ← Games link on top → Play → the
 *   room list → a brief → building. Real mouse: pick the gift bed off the shelf, put it on a
 *   tile, click it to select, R turns it. The Clay Bench: pick a lamp and a colour, pinch it,
 *   put it down; the lamp goal ticks. Escape pauses; Space on the focused Resume button resumes;
 *   Escape closes Settings with the slider focused. Z undoes. The bot decorates the rest, ✓
 *   finishes, the rating shows stars. Photo mode: night, a drag turns the room, the shutter makes
 *   a photo, it goes in the album, Copy link makes a link; that link opens the same diorama in a
 *   new page. Save & Quit, reload: the stars and the next room are still there. The ElevenLabs
 *   clips decode and a tune is playing.
 * phones (touch only, real CDP touches) at 390×844 and 844×390: taps through the menus, a tap
 *   picks a thing off the shelf, a tap moves its ghost, a second tap puts it down; controls are
 *   ≥ 44 px and on screen; no sideways scroll; the canvas matches the visible viewport; photo mode
 *   and the shutter by touch.
 * nostorage: localStorage throws; the game boots, builds and rates; the album says it can't save.
 * Fails on any console error, page error or failed request.
 *
 *   python3 -m http.server 8136          # from the REPO ROOT
 *   node game-136/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8136), ONLY=desktop,phones,nostorage, THREE_PKG.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8136';
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
async function newPage(viewport, { touch = false, nostorage = false, keep = false } = {}) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch, permissions: ['clipboard-read', 'clipboard-write'] });
    await ctx.addInitScript(([ns, keep]) => {
        if (ns) Object.defineProperty(window, 'localStorage', { get() { throw new DOMException('blocked', 'SecurityError'); } });
        else if (!keep && !sessionStorage.getItem('pp-cleared')) { try { localStorage.clear(); sessionStorage.setItem('pp-cleared', '1'); } catch { /* */ } }
    }, [nostorage, keep]);
    const page = await ctx.newPage();
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
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('requestfailed', (r) => { if (!r.url().includes('favicon') && !r.url().startsWith('blob:') && !r.url().endsWith('.mp3')) errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`); });
    return page;
}
async function open(viewport, opts = {}) {
    await launch();
    errors = [];
    const page = await newPage(viewport, opts);
    await page.goto(`${BASE}/game-136/index.html?debug=1${opts.hash || ''}`);
    await page.waitForFunction(() => window.__pp && (__pp.mode === 'title' || __pp.mode === 'visit'), null, { timeout: 90000 });
    return page;
}

const check = (cond, msg) => { if (!cond) { fails++; console.log('  FAIL', msg); } else console.log('  ok', msg); return cond; };
const Q = (page, fn, arg) => page.evaluate(fn, arg);
const shot = async (page, name) => { await page.screenshot({ path: path.join(OUT, `bt-${name}.png`) }); };
// SwiftShader draws a few frames a second: wait on state, never on the clock.
const until = (page, fn, msg, timeout = 30000, arg = null) =>
    page.waitForFunction(fn, arg, { timeout, polling: 100 }).then(() => check(true, msg), () => check(false, msg));
// finish any pop-in animation first, so a tap lands on the button and not the one it slides past (game-088)
const settle = (page) => Q(page, () => document.querySelectorAll('.sheet, .toast').forEach((e) => e.getAnimations().forEach((a) => a.finish())));
const centre = (page, sel) => Q(page, (s) => { const e = document.querySelector(s); if (!e) return null; e.scrollIntoView({ block: 'center', inline: 'center' }); const b = e.getBoundingClientRect(); return b.width ? { x: b.left + b.width / 2, y: b.top + b.height / 2 } : null; }, sel);
const clickSel = async (page, sel) => { await settle(page); const c = await centre(page, sel); if (!c) return false; await page.mouse.click(c.x, c.y); return true; };
/** Screen point of a floor tile's centre (or any world point). */
const tileAt = (page, x, y, h = 0) => Q(page, ([x, y, h]) => { const v = __pp.view; const p = v.cam.position.clone().set(x + 0.5, h, y + 0.5).project(v.cam); const r = v.canvas.getBoundingClientRect(); return { x: r.left + (p.x + 1) / 2 * r.width, y: r.top + (1 - p.y) / 2 * r.height }; }, [x, y, h]);
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
const visible = (page, id) => Q(page, (id) => !document.getElementById(id).hidden, id);

// ======================================================================
async function desktop() {
    console.log('\n== desktop 1280×760');
    const page = await open({ width: 1280, height: 760 });
    check(await backLinkOk(page), '← Games link is on top and points at ../index.html');
    check(await visible(page, 'title'), 'title screen is up');
    const L = await layout(page);
    check(L.noHScroll && L.canvas, 'no sideways scroll; the canvas fills the window');
    check(await Q(page, () => document.querySelectorAll('#title-title').length <= 1 && document.querySelectorAll('[id$="-title"]').length === document.querySelectorAll('.screen h1[id$="-title"], .screen h2[id$="-title"]').length), 'no button shares a screen heading\'s id (game-109)');
    await shot(page, 'desktop-title');

    await clickSel(page, '#title-menu [data-act="rooms"]');
    await until(page, () => !document.getElementById('rooms').hidden && document.querySelectorAll('.room-card').length === 9, 'Play opens the room list (8 rooms and the studio)');
    check(await Q(page, () => document.querySelectorAll('.room-card.locked').length === 7), 'only the first room and the studio are open');
    await clickSel(page, '.room-card[data-room="pip"]');
    await until(page, () => !document.getElementById('brief').hidden && document.getElementById('brief-name').textContent.includes('Pip'), "Pip's brief opens");
    await until(page, () => document.getElementById('brief-face').complete && document.getElementById('brief-face').naturalWidth > 0 && document.getElementById('brief-face').src.includes('por-pip'), 'with the fal portrait');
    await clickSel(page, '#brief-go');
    await until(page, () => __pp.mode === 'build' && !document.getElementById('hud').hidden, "Let's pinch! starts building");
    await until(page, () => document.querySelectorAll('.shelf-item').length === 1, 'the gift bed is on the shelf');

    // pick the bed up and put it down with the real mouse
    const camBefore = await Q(page, () => __pp.view.cam.top);
    await clickSel(page, '.shelf-item');
    await until(page, () => __pp.placing && __pp.placing.id === __pp.G.items[0].id, 'clicking the shelf picks the bed up');
    await page.waitForTimeout(400);
    check(await Q(page, (c) => __pp.view.cam.top === c, camBefore), 'the room does not move when a thing is picked up');
    const t = await tileAt(page, 2, 2);
    await page.mouse.move(t.x, t.y, { steps: 3 });
    await until(page, () => __pp.placing?.spec?.x === 2 && __pp.placing?.spec?.y === 2, 'the ghost follows the mouse to the tile');
    await page.mouse.click(t.x, t.y);
    await until(page, () => !__pp.placing && __pp.G.items[0].at?.x === 2 && __pp.seen.place >= 1, 'a click puts the bed down there');
    await page.mouse.click(t.x, t.y - 8);
    await until(page, () => __pp.selected === __pp.G.items[0].id, 'clicking the bed selects it');
    await page.keyboard.press('KeyR');
    await until(page, () => __pp.G.items[0].at.rot === 1, 'R turns it');
    await shot(page, 'desktop-placed');

    // the clay bench
    await clickSel(page, '#btn-make');
    await until(page, () => !document.getElementById('bench').hidden, '＋ opens the Clay Bench');
    await clickSel(page, '.kind-btn[data-kind="floorlamp"]');
    await clickSel(page, '#bench-c1 [data-c="tomato"]');
    await until(page, () => __pp.ui.recipe.kind === 'floorlamp' && __pp.ui.recipe.colors[1] === 'tomato', 'picking a kind and a colour sets the recipe');
    // every kind at every size stands on the turntable, never inside it (a large rug was buried in v1.0.0)
    const buried = await Q(page, async () => {
        const out = [];
        const tableTop = (b) => { b.table.updateMatrixWorld(true); const g = b.table.geometry; g.computeBoundingBox(); return g.boundingBox.max.y * b.table.scale.y + b.table.position.y; };
        for (const btn of document.querySelectorAll('.kind-btn')) {
            for (let size = 0; size < 3; size++) {
                __pp.bench.setRecipe({ ...__pp.ui.recipe, kind: btn.dataset.kind, size, variant: 0, motif: 0 });
                if (__pp.bench.wall) continue;
                const top = tableTop(__pp.bench);
                let modelTop = -Infinity;
                __pp.bench.model.updateMatrixWorld(true);
                __pp.bench.model.traverse((o) => { if (o.isMesh) { o.geometry.computeBoundingBox(); const bb = o.geometry.boundingBox.clone().applyMatrix4(o.matrixWorld); modelTop = Math.max(modelTop, bb.max.y); } });
                if (modelTop < top + 0.02) out.push(`${btn.dataset.kind} size ${size}: top ${modelTop.toFixed(3)} under the turntable ${top.toFixed(3)}`);
            }
        }
        __pp.bench.setRecipe(__pp.ui.recipe);
        return out;
    });
    check(buried.length === 0, `every floor thing at every size shows above the bench's turntable ${buried.slice(0, 3).join('; ')}`);
    await clickSel(page, '.kind-btn[data-kind="rug"]');
    await clickSel(page, '#bench-size .chip:nth-child(3)');
    await page.waitForTimeout(600);
    await shot(page, 'desktop-bench-rug');
    await clickSel(page, '.kind-btn[data-kind="floorlamp"]');
    await clickSel(page, '#bench-c1 [data-c="tomato"]');
    await page.waitForTimeout(600);
    await shot(page, 'desktop-bench');
    const clay0 = await Q(page, () => __pp.G.clay);
    await clickSel(page, '#bench-make');
    await until(page, (c) => __pp.G.clay < c && __pp.placing && __pp.G.items.find((i) => i.id === __pp.placing.id).kind === 'floorlamp', 'Pinch it! spends clay and puts the lamp in hand', 30000, clay0);
    const t2 = await tileAt(page, 4, 0);
    await page.mouse.move(t2.x, t2.y, { steps: 3 });
    await page.mouse.click(t2.x, t2.y);
    await until(page, () => __pp.G.items.some((i) => i.kind === 'floorlamp' && i.at), 'and a click puts it in the room');
    await until(page, () => [...document.querySelectorAll('#goals-list li')][1]?.classList.contains('ok'), 'the "Add a lamp" goal ticks');

    // keys: pause, Space on a focused button, Escape out of Settings with a slider focused
    await page.keyboard.press('Escape');
    await until(page, () => !document.getElementById('pause').hidden, 'Escape pauses');
    await Q(page, () => document.querySelector('#pause-menu [data-act="resume"]').focus());
    await page.keyboard.press('Space');
    await until(page, () => document.getElementById('pause').hidden, 'Space on the focused Resume button resumes (game-078)');
    await page.keyboard.press('Escape');
    await until(page, () => !document.getElementById('pause').hidden, 'Escape pauses again');
    await clickSel(page, '#pause-menu [data-act="settings"]');
    await until(page, () => !document.getElementById('settings').hidden, 'Settings opens');
    check(await Q(page, () => +getComputedStyle(document.getElementById('settings')).zIndex > +getComputedStyle(document.getElementById('pause')).zIndex), 'Settings sits on top of the pause menu (game-088)');
    await Q(page, () => document.getElementById('set-sfx').focus());
    await page.keyboard.press('Escape');
    await until(page, () => document.getElementById('settings').hidden, 'Escape closes Settings with the slider focused (game-117)');
    await page.keyboard.press('Escape');
    await until(page, () => document.getElementById('pause').hidden, 'and Escape closes the pause menu');

    const n = await Q(page, () => __pp.G.items.filter((i) => i.at).length);
    await page.keyboard.press('KeyZ');
    await until(page, (n) => __pp.G.items.filter((i) => i.at).length === n - 1, 'Z undoes the last placement', 30000, n);

    // the rest by the bot, then the rating
    await Q(page, () => __pp.ff());
    await clickSel(page, '#btn-finish');
    await until(page, () => !document.getElementById('results').hidden, '✓ shows the rating');
    await until(page, () => document.querySelectorAll('#res-stars .lit').length >= 1, 'with stars lighting up', 30000);
    check(await Q(page, () => __pp.G.progress.pip?.stars >= 1), 'the stars are kept');
    await shot(page, 'desktop-results');

    // audio: the ElevenLabs clips decode and a tune plays
    await until(page, () => Object.keys(__pp.audio.buffers).length >= 15, 'the ElevenLabs effects decode', 30000);
    await until(page, () => __pp.audio.playing(), 'a tune is playing', 30000);

    // photo mode
    await clickSel(page, '#res-photo');
    await until(page, () => __pp.mode === 'photo' && !document.getElementById('photo-ui').hidden, 'Photo opens photo mode');
    await clickSel(page, '#photo-time [data-v="night"]');
    await until(page, () => __pp.view.time === 'night', 'Night sets the light');
    const yaw0 = await Q(page, () => __pp.view.photo.yaw);
    await page.mouse.move(640, 300); await page.mouse.down(); await page.mouse.move(560, 290, { steps: 6 }); await page.mouse.up();
    await until(page, (y) => Math.abs(__pp.view.photo.yaw - y) > 0.1, 'dragging turns the room', 30000, yaw0);
    await page.waitForTimeout(500);
    await shot(page, 'desktop-photomode');
    await clickSel(page, '#photo-shutter');
    await until(page, () => !document.getElementById('snap').hidden && document.getElementById('snap-img').naturalWidth > 1000, 'the shutter takes a full-size photo', 60000);
    const lit = await Q(page, () => {
        const c = document.createElement('canvas'), img = document.getElementById('snap-img');
        c.width = 200; c.height = 150; const g = c.getContext('2d'); g.drawImage(img, 0, 0, 200, 150);
        const d = g.getImageData(0, 0, 200, 150).data; let lo = 255, hi = 0;
        for (let i = 0; i < d.length; i += 4) { const l = (d[i] + d[i + 1] + d[i + 2]) / 3; lo = Math.min(lo, l); hi = Math.max(hi, l); }
        return hi - lo;
    });
    check(lit > 80, `the photo is not blank (contrast ${Math.round(lit)})`);
    await shot(page, 'desktop-snap');
    await clickSel(page, '#snap-album');
    await until(page, () => JSON.parse(localStorage.getItem('pinch-and-place.album.v1') || '[]').length === 1, 'To album keeps it');
    await clickSel(page, '#snap-link');
    await until(page, () => /#d=/.test(__pp.lastLink || ''), 'Copy link makes a diorama link');
    const link = await Q(page, () => __pp.lastLink);
    const placedHere = await Q(page, () => __pp.G.items.filter((i) => i.at).length);
    await clickSel(page, '#snap [data-close]');
    await clickSel(page, '#photo-done');
    await until(page, () => __pp.mode === 'build', 'Back to building leaves photo mode');

    // the link opens the same diorama elsewhere
    const vis = await newPage({ width: 1000, height: 700 });
    await vis.goto(link.replace(/index\.html/, 'index.html?debug=1'));
    await vis.waitForFunction(() => window.__pp && __pp.mode === 'visit', null, { timeout: 90000 }).then(() => check(true, 'the link opens in visit mode'), () => check(false, 'the link opens in visit mode'));
    check(await vis.evaluate((n) => __pp.viewG.items.length === n, placedHere), `with all ${placedHere} things in their places`);
    check(await vis.evaluate(() => document.getElementById('title').hidden && !document.getElementById('visit').hidden), 'the visit card is up and the title screen is not over the diorama');
    await vis.waitForTimeout(800);
    await vis.screenshot({ path: path.join(OUT, 'bt-visit.png') });
    await vis.close();

    // save, quit, reload
    await page.keyboard.press('Escape');
    await until(page, () => !document.getElementById('pause').hidden, 'Escape pauses');
    await clickSel(page, '#pause-menu [data-act="quit"]');
    await until(page, () => __pp.mode === 'title', 'Save & Quit returns to the title');
    await page.reload();
    await page.waitForFunction(() => window.__pp && __pp.mode === 'title', null, { timeout: 90000 });
    await clickSel(page, '#title-menu [data-act="rooms"]');
    await until(page, () => document.querySelector('.room-card[data-room="mo"]') && !document.querySelector('.room-card[data-room="mo"]').classList.contains('locked'), 'after a reload the next room is open', 30000);
    check(await Q(page, () => { const st = document.querySelector('.room-card[data-room="pip"] .st'); return st && st.firstChild.nodeType === 3 && st.firstChild.textContent.length >= 1; }), 'and the first room keeps its stars');
    reportErrors('desktop');
}

// ======================================================================
async function phone(w, h) {
    console.log(`\n== phone ${w}×${h} (touch only)`);
    const page = await open({ width: w, height: h }, { touch: true });
    const tap = async (sel) => { await settle(page); const c = await centre(page, sel); if (!c) return false; await page.touchscreen.tap(c.x, c.y); return true; };
    check(await backLinkOk(page), '← Games link is on top');
    await tap('#title-menu [data-act="rooms"]');
    await until(page, () => !document.getElementById('rooms').hidden, 'a tap on Play opens the rooms');
    await tap('.room-card[data-room="pip"]');
    await until(page, () => !document.getElementById('brief').hidden, 'a tap on the first room opens its brief');
    await page.waitForTimeout(300);
    check(await visible(page, 'brief'), 'the brief stays open after the finger lifts');
    await tap('#brief-go');
    await until(page, () => __pp.mode === 'build', 'a tap starts building');
    const L = await layout(page);
    check(L.noHScroll, 'no sideways scroll');
    check(L.canvas, 'the canvas matches the visible viewport');
    const sizes = await Q(page, () => ['#btn-make', '.shelf-item', '#btn-undo', '#btn-photo', '#btn-finish', '#btn-pause', '#btn-zin'].map((s) => {
        const r = document.querySelector(s).getBoundingClientRect();
        return { s, ok: r.width >= 44 && r.height >= 44 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5, r: [r.left, r.top, r.width, r.height].map(Math.round) };
    }));
    for (const z of sizes) check(z.ok, `${z.s} is at least 44 px and on screen ${z.ok ? '' : JSON.stringify(z.r)}`);

    await tap('.shelf-item');
    await until(page, () => !!__pp.placing, 'a tap on the shelf picks the bed up');
    await until(page, () => !document.getElementById('ctx').hidden && !document.querySelector('[data-ctx="put"]').hidden, 'with a ✓ Put here button');
    const t = await tileAt(page, 1, 1);
    await page.touchscreen.tap(t.x, t.y);
    await until(page, () => __pp.placing?.spec?.x === 1 && __pp.placing?.spec?.y === 1, 'a tap on the floor moves the ghost there (and places nothing yet)');
    check(await Q(page, () => !__pp.G.items[0].at), 'the bed is still in hand after the first tap');
    await page.touchscreen.tap(t.x, t.y);
    await until(page, () => !__pp.placing && __pp.G.items[0].at?.x === 1, 'a second tap on the same spot puts it down');
    const ctxOk = await Q(page, () => { const r = document.getElementById('shelf').getBoundingClientRect(); return r.top > innerHeight * 0.5; });
    check(ctxOk, 'the shelf sits at the bottom');
    await shot(page, `phone-${w}x${h}`);

    await tap('#btn-photo');
    await until(page, () => __pp.mode === 'photo', 'a tap on 📷 opens photo mode');
    const panel = await Q(page, () => { const r = document.getElementById('photo-panel').getBoundingClientRect(); return r.left >= 0 && r.right <= innerWidth + 0.5 && r.bottom <= innerHeight + 0.5; });
    check(panel, 'the photo controls fit on screen');
    await page.waitForTimeout(400);
    await shot(page, `phone-${w}x${h}-photo`);
    await tap('#photo-shutter');
    await until(page, () => !document.getElementById('snap').hidden, 'a tap on the shutter takes a photo', 60000);
    await tap('#snap [data-close]');
    await tap('#photo-done');
    await until(page, () => __pp.mode === 'build', 'and back to building');
    await tap('#btn-pause');
    await until(page, () => !document.getElementById('pause').hidden, 'tapping ❚❚ pauses');
    await page.waitForTimeout(300);
    check(await visible(page, 'pause'), 'the pause menu stays open after the finger lifts');
    await tap('#pause-menu [data-act="resume"]');
    await until(page, () => document.getElementById('pause').hidden, 'a tap on Resume closes it');
    reportErrors(`phone ${w}×${h}`);
}

// ======================================================================
async function nostorage() {
    console.log('\n== blocked storage');
    const page = await open({ width: 1280, height: 760 }, { nostorage: true });
    await clickSel(page, '#title-menu [data-act="rooms"]');
    await clickSel(page, '.room-card[data-room="pip"]');
    await clickSel(page, '#brief-go');
    await until(page, () => __pp.mode === 'build', 'boots and starts a room with localStorage throwing');
    await Q(page, () => __pp.ff());
    await clickSel(page, '#btn-finish');
    await until(page, () => !document.getElementById('results').hidden, 'and rates it');
    check(await Q(page, () => __pp.save() === false), 'saving fails quietly');
    await clickSel(page, '#res-photo');
    await clickSel(page, '#photo-shutter');
    await until(page, () => !document.getElementById('snap').hidden, 'a photo can still be taken', 60000);
    await clickSel(page, '#snap-album');
    await until(page, () => [...document.querySelectorAll('.toast')].some((t) => /can.t be saved/.test(t.textContent)), 'the album says it can\'t save');
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

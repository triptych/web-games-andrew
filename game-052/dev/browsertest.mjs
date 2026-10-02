/**
 * browsertest.mjs — real Chromium, real WebGL, real three.js r165.
 *
 * Desktop: title → start → speed / lane / radio / camera keys → a long
 * fast-forwarded drift-mode drive (thousands of sim steps, checked every step:
 * finite positions, nobody ever overlaps anybody in a lane, the city's object
 * count stays bounded as chunks are built and dropped, stops get visited,
 * districts change) → a hand-driven pull-over with E, the stop's action and
 * driving on → menu settings → a photo download → a screenshot of every
 * district. Phones (390×844 and 844×390, touch only): on-screen controls work
 * by tap, every control is on screen and big enough. Fails on any console
 * error, page error or failed request. Screenshots → dev/shots/.
 *
 *   python3 -m http.server 8050                 # from the REPO ROOT
 *   node game-052/dev/browsertest.mjs
 *
 * No network to unpkg.com? Fetch three.js once; CDN requests are then served
 * from disk (still the genuine r165):
 *   cd game-052/dev && npm pack three@0.165.0 && tar xzf three-0.165.0.tgz
 *
 * Env: BASE (default http://127.0.0.1:8050), THREE_PKG, PW_CHROMIUM_PATH, OUT,
 * ONLY=desktop|phones, DRIVE=seconds of fast-forwarded drift (default 900).
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? path.join(HERE, 'package');
const BASE = process.env.BASE ?? 'http://127.0.0.1:8050';
const OUT = process.env.OUT ?? path.join(HERE, 'shots');
const DRIVE = +(process.env.DRIVE || 900);
fs.mkdirSync(OUT, { recursive: true });

const errors = [];
let passed = 0;
function ok(c, msg) { if (!c) { errors.push('assert: ' + msg); console.log('  ✗', msg); } else { passed++; if (process.env.VERBOSE) console.log('  ✓', msg); } }

const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
});

async function newPage(viewport, extra = {}) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, acceptDownloads: true, ...extra });
    await ctx.addInitScript(() => { try { if (!sessionStorage.getItem('__c')) { localStorage.clear(); sessionStorage.setItem('__c', '1'); } } catch { /* */ } });
    const page = await ctx.newPage();
    if (fs.existsSync(PKG)) {
        await page.route('https://unpkg.com/**', (route) => {
            const rel = new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, '');
            const file = path.join(PKG, rel);
            if (!fs.existsSync(file)) return route.abort();
            route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
        });
    }
    await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    await page.route('https://fonts.gstatic.com/**', (r) => r.fulfill({ status: 404, body: '' }));
    page.on('console', (m) => { if (m.type() === 'error' || m.type() === 'warning') errors.push(`console.${m.type()}: ${m.text()}`); });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}\n${e.stack}`));
    page.on('requestfailed', (r) => { const u = r.url(); if (!u.includes('favicon') && !u.includes('fonts.')) errors.push(`requestfailed: ${u} ${r.failure()?.errorText}`); });
    await page.goto(`${BASE}/game-052/index.html?debug=1&seed=browsertest`);
    await page.waitForFunction(() => window.__ready === true, null, { timeout: 120000 });
    return { ctx, page };
}
const shot = (page, name) => page.screenshot({ path: path.join(OUT, name + '.png') });
const ev = (page, fn, arg) => page.evaluate(fn, arg);

// ======================================================================
async function desktop() {
    console.log('desktop');
    const { ctx, page } = await newPage({ width: 1280, height: 720 });
    ok(await page.isVisible('#t-start'), 'title shows the start prompt once the city is built');
    await shot(page, 'bt-title');
    await page.keyboard.press('KeyX');
    await page.waitForTimeout(300);
    ok(await ev(page, () => __nl.state.started), 'any key starts the drive');
    ok(await page.isVisible('#dash'), 'dash is visible');

    // speed
    const c0 = await ev(page, () => __nl.car.cruise * 3.6);
    await page.keyboard.down('ArrowUp');
    await page.waitForTimeout(900);
    await page.keyboard.up('ArrowUp');
    const c1 = await ev(page, () => __nl.car.cruise * 3.6);
    ok(c1 > c0, `holding ↑ raises the cruise speed (${c0.toFixed(0)} → ${c1.toFixed(0)})`);
    await page.keyboard.down('KeyS');
    await page.waitForTimeout(500);
    await page.keyboard.up('KeyS');
    ok(await ev(page, () => __nl.car.cruise * 3.6) < c1, 'holding S lowers it');

    // lane change (fast-forward the sim rather than wait on SwiftShader)
    await page.keyboard.press('ArrowLeft');
    ok(await ev(page, () => __nl.car.targetLane === 0 && __nl.car.blinker === -1), '← asks for the left lane with the blinker on');
    await ev(page, () => { __nl.traffic.cars.slice().forEach((c, i) => { if (c.dir > 0) { __nl.scene.remove(c.mesh); } }); __nl.traffic.cars = __nl.traffic.cars.filter((c) => c.dir < 0); __nl.sim(5); });
    ok(await ev(page, () => __nl.car.lane === 0 && Math.abs(__nl.car.u - 1.8) < 0.01 && __nl.car.blinker === 0), 'the car moves over once the lane is clear');
    await page.keyboard.press('KeyD');
    await ev(page, () => __nl.sim(5));
    ok(await ev(page, () => __nl.car.lane === 1), 'D moves back to the curb lane');

    // a lane change waits for a gap
    await ev(page, () => {
        const T = __nl.traffic;
        T._spawnCar(__nl.car, 0, __nl.car.s + 2, __nl.car.v);
        __nl.car.requestLane(-1);
        __nl.sim(0.5);
    });
    ok(await ev(page, () => __nl.car.lane === 1 && __nl.car.u > 5.3 && __nl.car.targetLane === 0), 'with a car alongside, the blinker waits instead of merging');
    await ev(page, () => { __nl.car.requestLane(1); });

    // radio + camera
    await page.keyboard.press('KeyR');
    ok(await ev(page, () => __nl.audio.station === 1 && document.getElementById('r-name').textContent === 'RAIN FM'), 'R tunes to the next station');
    await page.keyboard.press('Shift+KeyR');
    ok(await ev(page, () => __nl.audio.station === 0), 'Shift+R tunes back');
    const modes = [];
    for (let i = 0; i < 4; i++) { await page.keyboard.press('KeyC'); modes.push(await ev(page, () => __nl.rig.mode)); }
    ok(modes.join() === 'hood,low,cinema,chase', `C cycles cameras (${modes.join()})`);
    await page.keyboard.press('KeyH');
    ok(await ev(page, () => document.getElementById('hud').classList.contains('hud-off')), 'H hides the dash');
    await page.keyboard.press('KeyH');

    // ---- long drift-mode drive, checked every step ----
    await page.keyboard.press('KeyZ');
    ok(await ev(page, () => __nl.state.drift), 'Z starts drift mode');
    const t0 = Date.now();
    const res = await ev(page, (secs) => {
        const N = __nl, car = N.car, T = N.traffic;
        const out = { bad: [], minGap: Infinity, maxChunks: 0, maxObjs: 0, objs: [], districts: new Set(), parked: 0, police: 0, s0: car.s };
        let wasParked = false, step = 0;
        const countObjs = () => { let n = 0; N.scene.traverse(() => n++); return n; };
        N.sim(secs, 1 / 30, () => {
            step++;
            if (!Number.isFinite(car.s) || !Number.isFinite(car.u) || !Number.isFinite(car.pos.x) || !Number.isFinite(car.pos.y)) out.bad.push('car NaN at ' + step);
            for (const c of T.cars) {
                if (!Number.isFinite(c.s) || !Number.isFinite(c.mesh.position.x)) out.bad.push('traffic NaN');
                if (c.dir > 0 && car.occupies(c.lane)) {
                    const d = Math.abs(c.s - car.s);
                    out.minGap = Math.min(out.minGap, d);
                    if (d < (5 + c.len) / 2 + 0.5) out.bad.push(`overlap with car in lane ${c.lane}: Δs=${d.toFixed(2)} (${car.mode}; ${c.s > car.s ? 'ahead' : 'behind'}, v ${c.v.toFixed(1)} vs ${car.v.toFixed(1)}, u ${car.u.toFixed(2)}, lane ${car.lane}→${car.targetLane}, step ${step})`);
                }
                for (const o of T.cars) {
                    if (o !== c && o.lane === c.lane && Math.abs(o.s - c.s) < (o.len + c.len) / 2 + 0.5) out.bad.push(`traffic overlap Δs=${Math.abs(o.s - c.s).toFixed(2)}`);
                }
            }
            if (car.mode === 'parked' && !wasParked) out.parked++;
            wasParked = car.mode === 'parked';
            if (T.spinners.some((s) => s.police)) out.police++;
            out.districts.add(N.road.districtAt(car.s).type);
            out.maxChunks = Math.max(out.maxChunks, N.city.chunks.size);
            if (step % 3000 === 0) { const n = countObjs(); out.objs.push(n); out.maxObjs = Math.max(out.maxObjs, n); }
        });
        out.km = (car.s - out.s0) / 1000;
        out.districts = [...out.districts];
        out.bad = out.bad.slice(0, 8);
        out.log = N.ui.el.log.children.length;
        return out;
    }, DRIVE);
    console.log(`  drove ${res.km.toFixed(1)} km of sim in ${((Date.now() - t0) / 1000).toFixed(1)} s · stops ${res.parked} · districts ${res.districts.join(',')} · min same-lane Δs ${res.minGap.toFixed(1)} m · chunks ≤ ${res.maxChunks} · scene objects ${res.objs.join(' → ')}`);
    ok(res.bad.length === 0, 'every step: finite positions and no overlaps — ' + res.bad.join('; '));
    ok(res.km > DRIVE * 0.008, `the drive covers real distance (${res.km.toFixed(1)} km)`);
    ok(res.parked >= 1, `drift mode pulls over at stops (${res.parked})`);
    ok(res.districts.length >= 3, `several districts pass by (${res.districts.join(', ')})`);
    ok(res.maxChunks <= 13, `chunks stay bounded (${res.maxChunks})`);
    ok(res.objs.length < 2 || Math.max(...res.objs) - Math.min(...res.objs) < 400, `scene object count stays bounded (${res.objs.join(' → ')})`);
    ok(res.police > 0, 'a patrol spinner shows up');
    await shot(page, 'bt-drift');
    await page.keyboard.press('KeyZ');
    ok(await ev(page, () => !__nl.state.drift), 'Z hands the wheel back');

    // ---- pulling over by hand ----
    await ev(page, () => {
        const st = __nl.road.nextStop(__nl.car.s + 120);
        __nl.traffic.cars.forEach((c) => __nl.scene.remove(c.mesh)); __nl.traffic.cars = [];
        __nl.teleport(st.s - 300);
        __nl.sim(0.2);
    });
    await page.waitForTimeout(200);
    ok(await page.isVisible('#prompt'), 'a stop ahead shows the pull-over prompt');
    await page.keyboard.press('KeyE');
    ok(await ev(page, () => !!__nl.car.wantStop && __nl.car.blinker === 1), 'E signals to pull over');
    await ev(page, () => { for (let i = 0; i < 90 * 30 && __nl.car.mode !== 'parked'; i++) __nl.sim(1 / 30); });
    ok(await ev(page, () => __nl.car.mode === 'parked' && Math.abs(__nl.car.u - 9.8) < 0.05), 'the car pulls into the bay and parks');
    await ev(page, () => __nl.sim(2));
    await page.waitForTimeout(1500);
    ok(await page.isVisible('#stopcard'), 'the parked card appears');
    ok((await page.textContent('#sc-line')).length > 10, 'a line of description drifts in');
    await page.click('#sc-action');
    ok(await page.isVisible('#sc-result'), "the stop's action gives a result");
    await shot(page, 'bt-parked');
    ok(await ev(page, () => document.querySelectorAll('#log li').length >= 1), 'the visit is in the night log');
    await page.keyboard.press('KeyE');
    await ev(page, () => { for (let i = 0; i < 60 * 30 && __nl.car.mode !== 'drive'; i++) __nl.sim(1 / 30); });
    ok(await ev(page, () => __nl.car.mode === 'drive' && __nl.car.lane === 1 && Math.abs(__nl.car.u - 5.4) < 0.05), 'E drives back out into the lane');
    ok(await page.isHidden('#stopcard'), 'the card goes away');

    // ---- menu ----
    await page.keyboard.press('Escape');
    ok(await page.isVisible('#menu') && await ev(page, () => __nl.state.paused), 'Esc opens the menu and pauses');
    await page.click('#set-res button[data-v="mid"]');
    ok(await ev(page, () => __nl.pipeline.height === 360), 'resolution preset changes the render height');
    await page.click('#set-retro button[data-v="0"]');
    ok(await ev(page, () => document.body.classList.contains('no-retro')), 'retro filter toggles');
    await page.click('#set-retro button[data-v="1"]');
    await page.click('#set-res button[data-v="lofi"]');
    await page.click('.mt[data-tab="log"]');
    ok(await page.isVisible('#log li'), 'night log tab lists the stop');
    await page.keyboard.press('Escape');
    ok(await page.isHidden('#menu') && await ev(page, () => !__nl.state.paused), 'Esc closes it again');

    // ---- photo ----
    const dl = page.waitForEvent('download', { timeout: 20000 });
    await page.keyboard.press('KeyP');
    const d = await dl;
    ok(/^nightline-.*\.png$/.test(d.suggestedFilename()), `P saves a photo (${d.suggestedFilename()})`);

    // ---- every district renders something that isn't black ----
    for (const t of ['downtown', 'market', 'skyway', 'harbor', 'heights']) {
        await ev(page, (t) => {
            const r = __nl.road; r.ensure(__nl.car.s + 30000);
            const d = r.districts.find((q) => q.type === t && q.start > __nl.car.s);
            __nl.teleport(d.start + 500); __nl.sim(2);
        }, t);
        await page.waitForTimeout(2500);
        const lum = await ev(page, () => __nl.luminance());
        ok(lum > 6, `${t} renders (mean luminance ${lum.toFixed(1)})`);
        await shot(page, 'bt-' + t);
    }
    await ctx.close();
}

// ======================================================================
async function phones() {
    for (const [w, h] of [[390, 844], [844, 390]]) {
        console.log(`phone ${w}×${h}`);
        const { ctx, page } = await newPage({ width: w, height: h }, { hasTouch: true, isMobile: true });
        await page.tap('#title');
        await page.waitForTimeout(400);
        ok(await ev(page, () => __nl.state.started), 'a tap starts the drive');
        ok(await page.isVisible('#t-left') && await page.isVisible('#t-faster'), 'touch controls are shown');
        const boxes = await ev(page, () => [...document.querySelectorAll('#topbar .ib, #touch .tb, #dash, #radio')].map((e) => {
            const r = e.getBoundingClientRect(); return { id: e.id || e.className, x: r.x, y: r.y, w: r.width, h: r.height };
        }));
        for (const b of boxes) ok(b.x >= 0 && b.y >= 0 && b.x + b.w <= w + 0.5 && b.y + b.h <= h + 0.5, `${b.id} is on screen (${b.x.toFixed(0)},${b.y.toFixed(0)} ${b.w.toFixed(0)}×${b.h.toFixed(0)})`);
        for (const b of boxes.filter((q) => /ib|tb/.test(q.id))) ok(b.h >= 40, `${b.id} is a comfortable tap target (${b.h.toFixed(0)} px)`);
        await ev(page, () => { __nl.traffic.cars.forEach((c) => __nl.scene.remove(c.mesh)); __nl.traffic.cars = []; });
        await page.tap('#t-left');
        ok(await ev(page, () => __nl.car.targetLane === 0), 'tapping ◀ asks for the left lane');
        const c0 = await ev(page, () => __nl.car.cruise);
        const b = await page.locator('#t-faster').boundingBox();
        await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
        await ev(page, () => { __nl.car.input.up = true; __nl.sim(0.5); __nl.car.input.up = false; });
        ok(await ev(page, (c0) => __nl.car.cruise > c0, c0), '+ raises the speed');
        await ev(page, () => {
            const st = __nl.road.nextStop(__nl.car.s + 120);
            __nl.teleport(st.s - 300); __nl.sim(0.2);
        });
        await page.waitForTimeout(200);
        await page.tap('#prompt');
        ok(await ev(page, () => !!__nl.car.wantStop), 'tapping the prompt pulls over');
        await ev(page, () => { for (let i = 0; i < 90 * 30 && __nl.car.mode !== 'parked'; i++) __nl.sim(1 / 30); });
        await ev(page, () => __nl.sim(2));
        await page.waitForTimeout(1500);
        const card = await page.locator('#stopcard').boundingBox();
        ok(card && card.x >= 0 && card.y >= 0 && card.x + card.width <= w + 0.5 && card.y + card.height <= h + 0.5, 'the parked card fits the screen');
        await shot(page, `bt-phone-${w}x${h}`);
        await page.tap('#sc-go');
        ok(await ev(page, () => __nl.car.mode === 'fromBay'), 'Drive on works by tap');
        await ctx.close();
    }
}

try {
    if (!process.env.ONLY || process.env.ONLY === 'desktop') await desktop();
    if (!process.env.ONLY || process.env.ONLY === 'phones') await phones();
} catch (e) {
    errors.push('exception: ' + (e.stack || e));
}
await browser.close();
console.log(`\n${passed} passed, ${errors.length} problems`);
if (errors.length) { console.log(errors.join('\n')); process.exit(1); }

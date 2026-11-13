/**
 * browsertest.mjs — the real game in real Chromium (SwiftShader WebGL).
 *
 * desktop (1280×760): boot to the title with no errors, the ← Games link on top → New Game → the mayor's welcome
 *   (the sim waits) → Enter → the job board → a job → its brief, spoken → Escape takes it → real keys drive, swap
 *   vehicles (keys and the toy box) and honk → Escape pauses and the sim stops → Settings opens on top of the pause
 *   menu and Escape closes it with a slider focused → Space presses Resume → J opens and closes the board → the
 *   last cell rolled by hand finishes the job: thank-you, stars, the board again → the crane's meter and a real
 *   press → Save & Quit → Continue restores → the last job and the Golden Hard Hat. All 14 models and the sound
 *   clips load; music plays; the master bus carries sound.
 * phones (touch only, real CDP touches) at 390×844 and 844×390: taps through the screens, the touch deck, the stick
 *   drives, the red button honks, a toy-box tap swaps, every control ≥ 44 px and on screen and not overlapping,
 *   no sideways scroll, the canvas matches the visible viewport, the truck is on screen.
 * nostorage: localStorage throws; the game still boots and plays.
 * Fails on any console error, page error or failed request.
 *
 *   python3 -m http.server 8135          # from the REPO ROOT
 *   node game-135/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8135), ONLY=desktop,phones,nostorage, THREE_PKG.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8135';
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
        else try { if (!sessionStorage.getItem('bt')) { localStorage.clear(); sessionStorage.setItem('bt', '1'); } } catch { /* */ }
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
    await page.goto(`${BASE}/game-135/index.html?debug=1&fast=4&q=low`);
    await page.waitForFunction(() => window.__hh && __hh.mode === 'title', null, { timeout: 60000 });
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
const shown = (id) => `!document.getElementById('${id}').hidden`;
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
const truckOnScreen = (page) => Q(page, () => { const s = __hh.view.screenOf(__hh.G.p.x, __hh.G.p.y, 1); return s.front && s.x > 20 && s.x < innerWidth - 20 && s.y > 60 && s.y < innerHeight - 60; });

// ======================================================================
async function desktop() {
    console.log('\n== desktop 1280×760');
    const page = await open({ width: 1280, height: 760 });
    check(await backLinkOk(page), '← Games link is on top and points at ../index.html');
    check(await Q(page, () => !document.getElementById('title').hidden), 'title screen is up');
    check(await Q(page, () => document.getElementById('btn-continue').hidden), 'no Continue without a save');
    const L = await layout(page);
    check(L.noHScroll && L.canvas, 'no sideways scroll; the canvas fills the window');
    check(await Q(page, () => document.querySelectorAll('#talk-title, #done-title, #jobs-title').length <= 3 && !document.querySelector('button#talk-title, button#done-title')), 'no control shares an id with a screen heading');
    await shot(page, 'desktop-title');

    await click(page, '#title-menu [data-act="new"]');
    await until(page, () => __hh.mode === 'play' && !document.getElementById('talk').hidden, 'New Game starts with the mayor saying hello');
    check(await Q(page, () => document.getElementById('talk-name').textContent === 'Mayor Maple' && document.getElementById('talk-face').src.includes('por-mayor')), 'with her name and her portrait');
    await page.waitForTimeout(400);
    check(await Q(page, () => __hh.G.t === 0), 'the sim waits while someone is talking');
    await shot(page, 'desktop-intro');
    await page.keyboard.press('Enter');
    await until(page, () => !document.getElementById('jobs').hidden && document.getElementById('talk').hidden, 'Enter answers her and opens the job board');
    check(await Q(page, () => document.querySelectorAll('#jobs-list .job').length === 10 && document.querySelectorAll('#jobs-list .job.locked').length === 9), 'ten jobs on the board, nine still locked');
    await shot(page, 'desktop-board');
    await click(page, '#jobs-list .job.locked');
    check(await Q(page, () => !document.getElementById('jobs').hidden && !__hh.pend.job), 'a locked job does nothing');
    await click(page, '#jobs-list .job[data-job="potholes"]');
    await until(page, () => !document.getElementById('talk').hidden && document.getElementById('jobs').hidden && document.querySelectorAll('#talk-steps li').length === 2, 'picking a job shows its brief and its steps');
    await until(page, () => __hh.audio.voicePlaying === 'vo-potholes-brief' || __hh.audio.played['vo-potholes-brief'] > 0, 'and the mayor reads it aloud');
    await shot(page, 'desktop-brief');
    await page.keyboard.press('Escape');
    await until(page, () => __hh.G.active === 'potholes' && document.getElementById('talk').hidden, 'Escape answers like the button: the job is taken');
    check(await Q(page, () => document.getElementById('clip-title').textContent === 'Pothole Patrol' && !document.getElementById('clip-bar').hidden), 'the clipboard shows the job and its progress');

    const o0 = await Q(page, () => __hh.G.odo);
    await page.keyboard.down('ArrowUp');
    await until(page, (o) => __hh.G.odo > o + 4, 'holding ↑ drives forward', 40000, o0);
    await page.keyboard.down('ArrowRight');
    const a0 = await Q(page, () => __hh.G.p.a);
    await until(page, (a) => Math.abs(__hh.G.p.a - a) > 0.3, 'holding → steers', 40000, a0);
    await page.keyboard.up('ArrowRight'); await page.keyboard.up('ArrowUp');
    check(await truckOnScreen(page), 'the truck is on screen');

    await page.keyboard.press('Digit2');
    await until(page, () => __hh.G.veh === 'dozer' && __hh.seen.switch >= 1, 'the 2 key climbs into the bulldozer');
    await until(page, () => document.getElementById('hint').classList.contains('wrong') && /Dump Truck/.test(document.getElementById('hint').textContent), 'the hint says which vehicle the job needs');
    await click(page, '#toybox .veh[data-veh="dump"]');
    await until(page, () => __hh.G.veh === 'dump', 'a click in the toy box climbs back into the dump truck');
    await page.keyboard.press('KeyE');
    await until(page, () => __hh.G.veh === 'dozer', 'E takes the next vehicle');
    await page.keyboard.press('KeyQ');
    await until(page, () => __hh.G.veh === 'dump', 'Q the one before');
    const h0 = await Q(page, () => __hh.seen.honk || 0);
    await page.keyboard.press('Space');
    await until(page, (h) => (__hh.seen.honk || 0) > h, 'Space honks (the press reaches a sim step)', 40000, h0);
    await until(page, () => __hh.audio.level() > 0.005, 'and sound comes out of the master bus');
    await until(page, () => __hh.audio.musicPlaying, 'the work music is playing');
    await shot(page, 'desktop-play');

    await page.keyboard.press('Escape');
    await until(page, () => !document.getElementById('pause').hidden, 'Escape pauses');
    const t0 = await Q(page, () => __hh.G.t);
    await page.waitForTimeout(500);
    check(await Q(page, (t) => __hh.G.t === t, t0), 'the sim stops while paused');
    await click(page, '#pause-menu [data-act="settings"]');
    await until(page, () => !document.getElementById('settings').hidden, 'Settings opens from the pause menu');
    check(await Q(page, () => { const r = document.getElementById('set-sfx').getBoundingClientRect(); const e = document.elementFromPoint(r.left + r.width / 2, r.top + r.height / 2); return !!e && !!e.closest('#settings'); }), 'and is drawn on top of it');
    await Q(page, () => document.getElementById('set-music').focus());
    await page.keyboard.press('Escape');
    await until(page, () => document.getElementById('settings').hidden && !document.getElementById('pause').hidden, 'Escape closes Settings even with a slider focused');
    await Q(page, () => document.querySelector('#pause-menu [data-act="resume"]').focus());
    await page.keyboard.press('Space');
    await until(page, () => document.getElementById('pause').hidden, 'Space presses the focused Resume button');
    await page.waitForTimeout(300);
    check(await Q(page, (h) => (__hh.seen.honk || 0) <= h + 1, h0 + 1), 'and that Space does not also honk in the game');
    await page.keyboard.press('KeyJ');
    await until(page, () => !document.getElementById('jobs').hidden, 'J opens the job board');
    check(await Q(page, () => document.querySelector('#jobs-list .job.active')?.dataset.job === 'potholes'), 'which marks the job in hand');
    await page.keyboard.press('KeyJ');
    await until(page, () => document.getElementById('jobs').hidden, 'J closes it again');

    // the bot hauls the asphalt; the last patch is rolled here, by the real loop
    await Q(page, () => __hh.ff(120, (G) => G.jobs.potholes.step === 1));
    check(await Q(page, () => __hh.G.jobs.potholes.step === 1 && __hh.G.jobs.potholes.st === 'open'), 'the asphalt is delivered');
    await page.keyboard.press('Digit4');
    await until(page, () => __hh.G.veh === 'roller', 'into the road roller');
    await Q(page, () => { const G = __hh.G, pr = G.jobs.potholes.prog; pr.cells.fill(1); pr.cells[0] = 0; pr.n = pr.cells.length - 1; G.p.x = 45; G.p.y = 46; G.p.v = 0; });
    await until(page, () => !document.getElementById('done').hidden, 'rolling the last patch finishes the job: the thank-you appears');
    check(await Q(page, () => { const n = __hh.G.jobs.potholes.stars; return __hh.G.jobs.potholes.st === 'done' && n >= 1 && __hh.G.stars === n && document.querySelector('#done-stars .off').textContent.length === 3 - n; }), 'with the stars it earned');
    await until(page, () => __hh.audio.played['vo-potholes-done'] > 0 && __hh.audio.played.fanfare > 0, 'a fanfare and the mayor saying thanks');
    await shot(page, 'desktop-done');
    await page.keyboard.press('Enter');
    await until(page, () => document.getElementById('done').hidden && !document.getElementById('jobs').hidden, 'Enter goes back to the board');
    check(await Q(page, () => document.querySelectorAll('#jobs-list .job.done').length === 1 && document.querySelectorAll('#jobs-list .job:not(.locked):not(.done)').length === 2), 'one job done, two new ones open');
    await page.keyboard.press('Escape');
    await until(page, () => document.getElementById('jobs').hidden, 'Escape leaves the board');

    // the crane: the bot gets as far as the roof beams, then a real press
    await Q(page, () => __hh.ff(400, (G) => G.active === 'school' && G.jobs.school.step === 1));
    await page.keyboard.press('Digit5');
    await until(page, () => __hh.G.veh === 'crane' && !document.getElementById('meter').hidden, 'parked at the school in the crane, the hook meter shows');
    await shot(page, 'desktop-crane');
    const pm = await Q(page, () => (__hh.seen.placed || 0) + (__hh.seen.miss || 0));
    await page.waitForFunction(() => Math.abs(Math.sin(__hh.G.hookT)) < 0.12, null, { timeout: 30000, polling: 'raf' }).catch(() => {});
    await page.keyboard.press('Space');
    await until(page, (n) => (__hh.seen.placed || 0) + (__hh.seen.miss || 0) > n, 'Space with the crane places a beam (or misses): it is not a honk', 40000, pm);

    const stars = await Q(page, () => __hh.G.stars);
    await page.keyboard.press('KeyP');
    await until(page, () => !document.getElementById('pause').hidden, 'P pauses');
    await click(page, '#pause-menu [data-act="quit"]');
    await until(page, () => __hh.mode === 'title' && !document.getElementById('btn-continue').hidden, 'Save & Quit returns to the title with Continue');
    await click(page, '#title-menu [data-act="continue"]');
    await until(page, (s) => __hh.mode === 'play' && __hh.G.stars === s && __hh.G.active === 'school' && __hh.G.veh === 'crane', 'Continue restores the saved game', 40000, stars);
    check(await Q(page, () => document.getElementById('talk').hidden), 'without the welcome speech');

    const m = await Q(page, () => ({ ...__hh.view.info.models }));
    check(m.loaded === 14 && m.failed === 0, `all 14 Meshy models loaded (${m.loaded} loaded, ${m.failed} failed)`);
    await Q(page, () => __hh.ff(3600, (G) => G.jobs.square.step === 3 && G.jobs.square.prog && G.jobs.square.prog.n === 2));
    check(await Q(page, () => Object.values(__hh.G.jobs).filter((j) => j.st === 'done').length === 9), 'the bot plays on to the last beam of the last job');
    await shot(page, 'desktop-late');
    await Q(page, () => { __hh.G.hookT = 0; __hh.G.missCd = 0; __hh.G.p.v = 0; });
    await page.keyboard.press('Space');
    await until(page, () => __hh.G.finished, 'a real press places the statue and finishes the town', 40000);
    await until(page, () => !document.getElementById('done').hidden, 'the last thank-you');
    await page.keyboard.press('Enter');
    await until(page, () => !document.getElementById('finale').hidden && /30|2\d of 30/.test(document.getElementById('finale-text').textContent), 'then the Golden Hard Hat, with the star count');
    await shot(page, 'desktop-finale');
    await page.keyboard.press('Enter');
    await until(page, () => document.getElementById('finale').hidden && __hh.mode === 'play', 'and the town can still be driven around');
    await shot(page, 'desktop-finished');
    reportErrors('desktop');
}

// ======================================================================
async function phone(w, h) {
    console.log(`\n== phone ${w}×${h} (touch only)`);
    const page = await open({ width: w, height: h }, { touch: true });
    const cdp = await page.context().newCDPSession(page);
    const touch = (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
    const tapSel = async (sel) => {
        const r = await Q(page, (s) => { const e = document.querySelector(s); e?.scrollIntoView({ block: 'center' }); const b = e?.getBoundingClientRect(); return b && { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, sel);
        if (!r) return false;
        await page.touchscreen.tap(r.x, r.y);
        return true;
    };

    check(await backLinkOk(page), '← Games link is on top');
    await shot(page, `phone-${w}x${h}-title`);
    await tapSel('#title-menu [data-act="new"]');
    await until(page, () => __hh.mode === 'play' && !document.getElementById('talk').hidden, 'a tap on New Game starts with the welcome');
    await page.waitForTimeout(300);
    check(await Q(page, () => !document.getElementById('talk').hidden), 'which stays open after the finger lifts');
    await tapSel('#talk-ok');
    await until(page, () => !document.getElementById('jobs').hidden, 'a tap on its button opens the job board');
    check(await Q(page, () => { const s = document.querySelector('#jobs .sheet').getBoundingClientRect(), b = document.getElementById('back-link').getBoundingClientRect(); return s.top >= b.bottom - 1 || s.left >= b.right; }), 'the board does not sit under the ← Games link');
    await shot(page, `phone-${w}x${h}-board`);
    await tapSel('#jobs-list .job[data-job="potholes"]');
    await until(page, () => !document.getElementById('talk').hidden && document.getElementById('jobs').hidden, 'a tap on a job shows its brief');
    await shot(page, `phone-${w}x${h}-brief`);
    await tapSel('#talk-ok');
    await until(page, () => __hh.G.active === 'potholes', 'a tap on "Let\'s go!" takes the job');
    await until(page, () => !document.getElementById('touch').hidden, 'the touch deck is shown');

    const L = await layout(page);
    check(L.noHScroll, 'no sideways scroll');
    check(L.canvas, 'the canvas matches the visible viewport');
    check(await truckOnScreen(page), 'the truck is on screen');

    const sizes = await Q(page, () => ['#btn-a', '#btn-pause', '#btn-jobs', ...[...document.querySelectorAll('#toybox .veh')].map((b) => `#toybox .veh[data-veh="${b.dataset.veh}"]`)].map((s) => {
        const r = document.querySelector(s).getBoundingClientRect();
        return { s, ok: r.width >= 44 && r.height >= 44 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight };
    }));
    check(sizes.every((z) => z.ok), `every control is at least 44 px and on screen${sizes.filter((z) => !z.ok).map((z) => ' ✗' + z.s).join('')}`);
    const overlap = await Q(page, () => {
        const r = (id) => document.getElementById(id).getBoundingClientRect(), hit = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
        const out = [];
        for (const [a, b] of [['clip', 'back-link'], ['clip', 'hud-right'], ['btn-a', 'toybox'], ['hint', 'toybox'], ['hint', 'btn-a'], ['clip', 'hint'], ['back-link', 'hud-right']]) if (hit(r(a), r(b))) out.push(`${a}/${b}`);
        return out;
    });
    check(overlap.length === 0, `nothing on the HUD overlaps${overlap.length ? ': ' + overlap.join(', ') : ''}`);

    // drive: push the stick up with a real touch
    const zone = await Q(page, () => { const r = document.getElementById('stick-zone').getBoundingClientRect(); return { x: r.left + r.width * 0.5, y: r.top + r.height * 0.7 }; });
    const o0 = await Q(page, () => __hh.G.odo);
    await touch('touchStart', zone.x, zone.y);
    for (let i = 1; i <= 6; i++) await touch('touchMove', zone.x, zone.y - i * 12);
    await until(page, (o) => __hh.G.odo > o + 3 && __hh.G.p.v > 0, 'pushing the stick up drives forward', 40000, o0);
    await touch('touchEnd', 0, 0);

    const honks = await Q(page, () => __hh.seen.honk || 0);
    await tapSel('#btn-a');
    await until(page, (n) => (__hh.seen.honk || 0) > n, 'tapping the red button honks', 40000, honks);
    await tapSel('#toybox .veh[data-veh="roller"]');
    await until(page, () => __hh.G.veh === 'roller', 'a tap in the toy box swaps vehicle');
    await until(page, () => /Dump Truck/.test(document.getElementById('hint').textContent), 'the hint asks for the dump truck back');
    await shot(page, `phone-${w}x${h}-play`);

    await tapSel('#btn-pause');
    await until(page, () => !document.getElementById('pause').hidden, 'tapping ❚❚ pauses');
    await page.waitForTimeout(300);
    check(await Q(page, () => !document.getElementById('pause').hidden), 'the pause screen stays open after the finger lifts');
    await tapSel('#pause-menu [data-act="resume"]');
    await until(page, () => document.getElementById('pause').hidden, 'a tap on Resume closes it');
    await tapSel('#btn-jobs');
    await until(page, () => !document.getElementById('jobs').hidden, 'tapping 📋 opens the job board');
    await tapSel('#jobs [data-close]');
    await until(page, () => document.getElementById('jobs').hidden, 'and its button closes it');

    // the crane meter fits the phone
    await Q(page, () => __hh.ff(400, (G) => G.active === 'school' && G.jobs.school.step === 1));
    await tapSel('#toybox .veh[data-veh="crane"]');
    await until(page, () => __hh.G.veh === 'crane' && !document.getElementById('meter').hidden, 'the crane meter shows');
    check(await Q(page, () => { const r = document.getElementById('meter').getBoundingClientRect(), a = document.getElementById('btn-a').getBoundingClientRect(), t = document.getElementById('toybox').getBoundingClientRect(); const hit = (p, q) => p.left < q.right && q.left < p.right && p.top < q.bottom && q.top < p.bottom; return r.left >= 0 && r.right <= innerWidth && !hit(r, t) && !hit(r, a) && document.getElementById('btn-a').textContent === 'LIFT'; }), 'on screen, clear of the toy box and the button, which now says LIFT');
    await shot(page, `phone-${w}x${h}-crane`);
    reportErrors(`phone ${w}×${h}`);
}

// ======================================================================
async function nostorage() {
    console.log('\n== blocked storage');
    const page = await open({ width: 1280, height: 760 }, { nostorage: true });
    await click(page, '#title-menu [data-act="new"]');
    await until(page, () => __hh.mode === 'play', 'boots and starts a game with localStorage throwing');
    await page.keyboard.press('Enter');
    await Q(page, () => __hh.ff(30));
    check(await Q(page, () => __hh.save() === false), 'saving fails quietly');
    check(await Q(page, () => __hh.G.t > 20), 'and the game plays on');
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

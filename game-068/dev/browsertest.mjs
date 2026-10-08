/**
 * browsertest.mjs — real Chromium, real WebGL (SwiftShader), real three.js r165, real input.
 *
 * Desktop (1280×760, mouse): title (back link on top and clickable) → the valley → briefing → level 1:
 * pick the Medic Tent and click a tile beside the road (built where clicked), a drag moves the camera
 * and builds nothing, a lantern by key 2, Space opens the gate, click a person (their card), click a
 * station (upgrade, pack up), speed / pause / sound buttons and keys, the pause menu, the bot plays the
 * level out → results with stars and letters → the next briefing; progress survives a reload; level 4:
 * the Volunteers tab, deploy a volunteer beside the road by clicking, the boss level played out →
 * results; journal (every tab) and settings.
 * Phones (390×844 and 844×390, touch only, real CDP touches): title and briefing fit, finger-sized
 * buttons, nothing covers the back link, the canvas is exactly the visible viewport (sized in px, not
 * 100vh), a tap on a tile's drawn position builds there, a one-finger drag pans and builds nothing,
 * a pinch zooms, tapping a person opens their card on screen, no sideways scroll.
 * Fails on any console error, page error or failed request. Screenshots go to dev/shots/.
 *
 *   python3 -m http.server 8068                 # from the REPO ROOT
 *   node game-068/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8068), ONLY=desktop|phones, THREE_PKG.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8068';
const OUT = path.join(HERE, 'shots');
const ONLY = process.env.ONLY ?? '';
fs.mkdirSync(OUT, { recursive: true });

const errors = [];
let fails = 0;
let browser = null;
const ok = (m) => console.log(`  ✓ ${m}`);
const fail = (m) => { fails++; console.log(`  ✗ ${m}`); };
const check = (cond, m) => (cond ? ok(m) : fail(m));

async function newPage(viewport, touch = false) {
    if (browser) await browser.close();
    browser = await chromium.launch({
        executablePath: process.env.PW_CHROMIUM_PATH || undefined,
        args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
    });
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: touch ? 2 : 1, hasTouch: touch, isMobile: touch });
    await ctx.addInitScript(() => {
        try {
            if (!sessionStorage.getItem('bt-init')) {
                sessionStorage.setItem('bt-init', '1');
                localStorage.clear();
                localStorage.setItem('haven-road.v1.settings', JSON.stringify({ music: 0, sfx: 0, muted: true, quality: 2, words: true }));
            }
        } catch { /* storage blocked */ }
    });
    const page = await ctx.newPage();
    if (PKG && fs.existsSync(PKG)) {
        await page.route('https://unpkg.com/**', (route) => {
            const rel = new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, '');
            const file = path.join(PKG, rel);
            if (!fs.existsSync(file)) return route.abort();
            route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
        });
    }
    await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message} @ ${(e.stack || '').split('\n').slice(1, 3).join(' ').trim()}`));
    page.on('requestfailed', (r) => { if (!r.url().includes('favicon')) errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`); });
    return { page, ctx };
}

const H = (page, js) => page.evaluate(`(() => { const hr = window.__hr, A = hr.app, W = hr.world; ${js} })()`);
const waitFor = (page, js, timeout = 90000) => page.waitForFunction(`(() => { const hr = window.__hr, A = hr && hr.app, W = hr && hr.world; return ${js}; })()`, null, { timeout, polling: 100 });
const shot = (page, name) => page.screenshot({ path: path.join(OUT, `${name}.png`) });
async function frames(page, n = 2) {
    const f0 = await H(page, 'return A.frameNo');
    await waitFor(page, `A.frameNo >= ${f0 + n}`);
}
async function boot(page) {
    await page.goto(`${BASE}/game-068/index.html?debug=1&q=2`);
    await waitFor(page, 'hr && A.frameNo > 2', 120000);
}

/** A free grass tile beside the road, around fraction `f` of the way along it. */
async function freeTile(page, f = 0.4, need = 'medic') {
    return H(page, `
        const m = W.map, occ = W.occ;
        const road = m.road;
        for (let k = 0; k < road.length; k++) {
            const r = road[Math.floor((${f} * road.length + k) % road.length)];
            for (const [dx, dz] of [[0, 1], [0, -1], [1, 0], [-1, 0]]) {
                const x = r[0] + dx, z = r[1] + dz;
                if (x < 0 || z < 0 || x >= 24 || z >= 15) continue;
                if (m.grid[z * 24 + x] === 0 && !occ[z * 24 + x]) return { x, z };
            }
        }
        return null;`);
}
/** Screen point of a tile's centre, after the layout has settled; null if a panel covers it. */
async function tilePoint(page, t) {
    await frames(page, 3);
    const p = await H(page, `return hr.tileScreen(${t.x}, ${t.z});`);
    if (!p) return null;
    const onCanvas = await page.evaluate(([x, y]) => document.elementFromPoint(x, y)?.id === 'gl', [p.x, p.y]);
    return onCanvas ? p : null;
}
async function focusTile(page, t) {
    await H(page, `hr.stage.rig.zoom = 0.6; hr.stage.rig.panX = ${t.x + 0.5} - 12; hr.stage.rig.panZ = ${t.z + 0.5} - 7.5; hr.stage.snapCamera();`);
    return tilePoint(page, t);
}
async function backLinkOk(page, label) {
    const r = await page.evaluate(() => {
        const a = document.getElementById('back-link');
        const b = a.getBoundingClientRect();
        const top = document.elementFromPoint(b.left + b.width / 2, b.top + b.height / 2);
        return { inView: b.top >= 0 && b.left >= 0 && b.right <= innerWidth, onTop: top === a || a.contains(top), href: a.getAttribute('href') };
    });
    check(r.inView && r.onTop && r.href === '../index.html', `${label}: ← Games link visible, on top, points at the launcher`);
}
async function noSideScroll(page, label) {
    const w = await page.evaluate(() => [document.documentElement.scrollWidth, innerWidth]);
    check(w[0] <= w[1] + 1, `${label}: no sideways scroll (${w[0]} ≤ ${w[1]})`);
}
async function playOut(page, maxSec = 3600) {
    // the balance bot plays the rest of the level (fast, in the page)
    await page.evaluate(async (maxSec) => {
        const { Bot } = await import('./js/sim/bot.js');
        const w = window.__hr.world;
        const b = new Bot(w);
        const t0 = w.time;
        while (w.state !== 'won' && w.state !== 'lost' && w.time - t0 < maxSec) b.step(1 / 30);
    }, maxSec);
}

// ------------------------------------------------------------------ desktop
async function desktop() {
    console.log('\n# desktop 1280×760');
    const { page } = await newPage({ width: 1280, height: 760 });
    await boot(page);
    await shot(page, 'd-title');
    await backLinkOk(page, 'title');
    check(await page.isVisible('#t-play'), 'title: Begin the Road');
    await page.click('#t-play');
    await page.waitForSelector('#valley:not(.hidden)');
    check((await page.$$('.node')).length === 12, 'valley: twelve roads');
    check(await page.$eval('.node[data-level="2"]', (e) => e.classList.contains('locked')), 'valley: road 2 locked at first');
    await page.click('.node[data-level="1"]');
    await page.waitForSelector('#brief:not(.hidden)');
    check((await page.textContent('#b-name')) === 'The First Morning', 'briefing: level 1');
    check((await page.$$('#b-new .card-mini')).length >= 3, 'briefing: new stations, ailments and dead');
    await page.click('#b-start');
    await page.waitForSelector('#hud:not(.hidden)');
    await frames(page, 4);
    await shot(page, 'd-play0');
    await backLinkOk(page, 'play');
    check(await page.isVisible('#hint'), 'level 1: a hint is showing');
    const cv = await page.evaluate(() => { const c = document.getElementById('gl'); const r = c.getBoundingClientRect(); return { w: r.width, h: r.height, sh: c.style.height }; });
    check(Math.abs(cv.w - 1280) < 1 && Math.abs(cv.h - 760) < 1 && /px$/.test(cv.sh), 'canvas is the viewport, sized in px');

    // build a Medic Tent by clicking
    await page.click('.slot[data-station="medic"]');
    await frames(page, 2);
    check(await page.$eval('.slot[data-station="medic"]', (e) => e.classList.contains('sel')), 'tray: medic selected');
    const t1 = await freeTile(page, 0.35);
    let p1 = await tilePoint(page, t1) || await focusTile(page, t1);
    await page.mouse.move(p1.x, p1.y);
    await frames(page, 2);
    check(await H(page, 'return !!(A.ghost && A.ghost.visible)'), 'a ghost tent follows the mouse');
    await page.mouse.click(p1.x, p1.y);
    await frames(page, 2);
    const built = await H(page, `return W.stations.map((s) => [s.type, s.tx, s.tz]);`);
    check(built.length === 1 && built[0][0] === 'medic' && built[0][1] === t1.x && built[0][2] === t1.z, `the tent stands on the tile clicked (${JSON.stringify(built)} vs ${JSON.stringify(t1)})`);
    check(await H(page, 'return A.tool === null'), 'the tool puts itself away after building');

    // a drag moves the camera and builds nothing, even with a tool selected
    await page.keyboard.press('2');
    check(await H(page, 'return A.tool && A.tool.station === "lantern"'), 'key 2 picks the lantern');
    const cam0 = await H(page, 'return [hr.stage.rig.panX, hr.stage.rig.panZ]');
    await page.mouse.move(640, 380); await page.mouse.down();
    for (let i = 1; i <= 8; i++) await page.mouse.move(640 + i * 25, 380 + i * 8);
    await page.mouse.up();
    await frames(page, 2);
    const cam1 = await H(page, 'return [hr.stage.rig.panX, hr.stage.rig.panZ]');
    check(Math.hypot(cam1[0] - cam0[0], cam1[1] - cam0[1]) > 0.5, 'a drag pans the camera');
    check(await H(page, 'return W.stations.length') === 1, 'a drag builds nothing');
    const t2 = await freeTile(page, 0.5);
    await H(page, 'hr.act.recentre(); hr.stage.snapCamera();');
    const p2 = await tilePoint(page, t2) || await focusTile(page, t2);
    await page.mouse.click(p2.x, p2.y);
    await frames(page, 2);
    check(await H(page, 'return W.stations.some((s) => s.type === "lantern")'), 'a lantern built by click');

    // open the gate with Space; people come down the road
    await page.keyboard.press('Space');
    check(await H(page, 'return W.state === "wave" && W.wave === 1'), 'Space opens the gate');
    await H(page, 'hr.step(30 * 14)');
    await H(page, 'hr.act.recentre(); hr.stage.snapCamera();');
    await frames(page, 3);
    await shot(page, 'd-wave1');
    const who = await H(page, `const p = W.people.find((q) => q.state === 'walk' && q.d > 3); if (!p) return null; const s = hr.stage.toScreen(p.x, 0.35, p.z); return s && { id: p.id, x: s.x, y: s.y };`);
    if (who) {
        await page.mouse.click(who.x, who.y);
        await frames(page, 2);
        const card = await page.evaluate(() => { const c = document.getElementById('card'); return c.classList.contains('hidden') ? null : c.querySelector('h3')?.textContent; });
        check(!!card, `clicking a person opens their card (${card})`);
    } else fail('nobody on the road to click');

    // a station's card: upgrade, pack up
    await H(page, 'W.supplies = 999');
    const sp = await H(page, `const s = W.stations[0]; return hr.tileScreen(s.tx, s.tz);`);
    await H(page, 'hr.act.escape()');
    await page.mouse.click(sp.x, sp.y);
    await frames(page, 2);
    const scard = await page.isVisible('#card [data-act="upgrade"]');
    check(scard, 'clicking a station opens its card');
    if (scard) {
        await page.click('#card [data-act="upgrade"]');
        check(await H(page, 'return W.stations[0].lv === 1'), 'Upgrade raises the station a level');
        await frames(page, 2);
        await shot(page, 'd-station-card');
        await page.click('#card [data-act="sell"]');
        check(await H(page, 'return W.stations.length === 1'), 'Pack up removes it');
    }

    // speed, pause, sound
    await page.click('#b-speed');
    check(await H(page, 'return A.speed === 2'), 'speed 2×');
    await page.keyboard.press('f');
    await page.keyboard.press('f');
    check(await H(page, 'return A.speed === 1'), 'F cycles the speed back to 1×');
    await page.click('#b-pause');
    check(await H(page, 'return A.paused'), 'pause button pauses');
    const t0 = await H(page, 'return W.time');
    await frames(page, 4);
    check(await H(page, `return W.time === ${t0}`), 'nothing moves while paused');
    await page.keyboard.press('p');
    check(await H(page, 'return !A.paused'), 'P resumes');
    await page.keyboard.press('m');
    check(await H(page, 'return A.settings.muted === false'), 'M toggles sound');
    await page.keyboard.press('m');
    await page.click('#b-menu');
    await page.waitForSelector('#modal:not(.hidden) [data-act="resume"]');
    check(await H(page, 'return A.paused'), 'the menu pauses');
    await page.click('[data-act="resume"]');
    check(await H(page, 'return !A.paused') && await page.isHidden('#modal'), 'Back to the road resumes');

    // play it out → results
    await playOut(page);
    check(await H(page, 'return W.state') === 'won', 'level 1 won');
    await page.waitForSelector('#modal:not(.hidden) .stars', { timeout: 30000 });
    await frames(page, 4);
    await shot(page, 'd-results');
    const stars = await page.$$eval('.stars .s.on', (e) => e.length);
    check(stars >= 1, `results: ${stars} stars`);
    check((await page.$$('.letter')).length >= 1, 'results: letters from people saved');
    check(await H(page, 'return A.progress.unlocked === 2 && A.progress.levels[1].stars >= 1'), 'progress: road 2 unlocked');
    await page.click('[data-act="next"]');
    await page.waitForSelector('#brief:not(.hidden)');
    check((await page.textContent('#b-name')) === 'Orchard Lane', 'Next road opens the next briefing');

    // progress survives a reload
    await page.reload();
    await waitFor(page, 'hr && A.frameNo > 2', 120000);
    check(await H(page, 'return A.progress.unlocked === 2 && A.progress.stats.saved > 0'), 'progress survives a reload');

    // a boss level: volunteers
    await H(page, 'A.progress.unlocked = 4; A.progress.roster = { firefighter: 3, nurse: 3, athlete: 2 }; hr.act.openBrief(4);');
    await page.waitForSelector('#brief:not(.hidden)');
    check((await page.$$('#b-new .roster div')).length >= 7, 'boss briefing: the roster');
    await page.click('#b-start');
    await page.waitForSelector('#tabs:not(.hidden)');
    await page.click('#tabs .tab[data-tab="vols"]');
    check((await page.$$('#tray .slot[data-vol]')).length === 8, 'Volunteers tab: eight trades');
    await page.click('#tray .slot[data-vol="firefighter"]');
    const t3 = await freeTile(page, 0.7);
    const p3 = await tilePoint(page, t3) || await focusTile(page, t3);
    await page.mouse.click(p3.x, p3.y);
    await frames(page, 2);
    check(await H(page, `return W.people.some((p) => p.role === 'vol' && p.trade === 'firefighter' && p.tx === ${t3.x} && p.tz === ${t3.z})`), 'a firefighter deployed where clicked');
    await shot(page, 'd-boss-deploy');
    await playOut(page);
    const bs = await H(page, 'return [W.state, W.bossCured, W.stats.cured]');
    check(bs[0] === 'won' && bs[1], `the boss level is won and the boss cured (${bs.join(', ')})`);
    await page.waitForSelector('#modal:not(.hidden) .stars', { timeout: 30000 });
    await shot(page, 'd-boss-results');
    await page.click('[data-act="valley"]');
    await page.waitForSelector('#valley:not(.hidden)');

    // journal and settings
    await page.click('#v-close');
    await page.click('#t-journal');
    await page.waitForSelector('#modal:not(.hidden) .tabs-row');
    for (const i of [1, 2, 3, 0]) {
        await page.click(`.tabs-row .tab >> nth=${i}`);
        await frames(page, 1);
    }
    check((await page.$$('#modal .letter')).length >= 1, 'journal: letters kept');
    await shot(page, 'd-journal');
    await page.keyboard.press('Escape');
    await page.click('#t-settings');
    await page.waitForSelector('#modal:not(.hidden) input[type=range]');
    await page.fill('#modal input[type=range] >> nth=0', '0.3');
    await page.dispatchEvent('#modal input[type=range] >> nth=0', 'input');
    check(await H(page, 'return Math.abs(A.settings.music - 0.3) < 0.01'), 'settings: music volume');
    await page.keyboard.press('Escape');
    check(await page.isHidden('#modal'), 'Esc closes settings');
}

// ------------------------------------------------------------------ phones
async function phone(vp) {
    const label = `${vp.width}×${vp.height}`;
    console.log(`\n# phone ${label} (touch only)`);
    const { page } = await newPage(vp, true);
    await boot(page);
    await backLinkOk(page, `${label} title`);
    await noSideScroll(page, `${label} title`);
    const btn = await page.$eval('#t-play', (b) => { const r = b.getBoundingClientRect(); return { h: r.height, bottom: r.bottom }; });
    check(btn.h >= 44 && btn.bottom <= vp.height, `${label}: Begin is finger-sized and on screen`);
    await page.tap('#t-play');
    await page.waitForSelector('#valley:not(.hidden)');
    await page.tap('.node[data-level="1"]');
    await page.waitForSelector('#brief:not(.hidden)');
    const bb = await page.$eval('#brief .panel', (e) => { const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }; });
    check(bb.top >= 0 && bb.bottom <= vp.height + 1 && bb.left >= 0 && bb.right <= vp.width + 1, `${label}: briefing fits`);
    const start = await page.$eval('#b-start', (b) => { const r = b.getBoundingClientRect(); return r.bottom <= innerHeight && r.height >= 44; });
    check(start, `${label}: Set out is reachable`);
    await page.tap('#b-start');
    await page.waitForSelector('#hud:not(.hidden)');
    await frames(page, 4);
    await backLinkOk(page, `${label} play`);
    await noSideScroll(page, `${label} play`);
    const cv = await page.evaluate(() => { const c = document.getElementById('gl'); const r = c.getBoundingClientRect(); return { w: r.width, h: r.height, iw: innerWidth, ih: innerHeight, sh: c.style.height }; });
    check(Math.abs(cv.w - cv.iw) < 1 && Math.abs(cv.h - cv.ih) < 1 && /px$/.test(cv.sh), `${label}: canvas is exactly the visible viewport, in px`);
    const small = await page.$$eval('#topbar button, #tray .slot, #b-gate', (els) => els.filter((e) => { const r = e.getBoundingClientRect(); return r.width < 44 || r.height < 44; }).length);
    check(small === 0, `${label}: every HUD button is at least 44 px`);
    const port = vp.height > vp.width;
    check(await H(page, `return hr.stage.rig.portrait === ${port}`), `${label}: camera ${port ? 'turns the road up the screen' : 'stays landscape'}`);
    await shot(page, `p-${label}-play`);

    // a tap builds where the finger is
    await page.tap('.slot[data-station="medic"]');
    const t = await freeTile(page, 0.4);
    const p = await tilePoint(page, t) || await focusTile(page, t);
    await page.touchscreen.tap(p.x, p.y);
    await frames(page, 2);
    const st = await H(page, 'return W.stations.map((s) => [s.tx, s.tz])');
    check(st.length === 1 && st[0][0] === t.x && st[0][1] === t.z, `${label}: a tap builds on the tile under the finger`);

    // one-finger drag pans and builds nothing (with a tool picked)
    await page.tap('.slot[data-station="lantern"]');
    const cdp = await page.context().newCDPSession(page);
    const cam0 = await H(page, 'return [hr.stage.rig.panX, hr.stage.rig.panZ, hr.stage.rig.zoom]');
    const cx = vp.width / 2, cy = vp.height / 2;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx, y: cy, id: 1 }] });
    for (let i = 1; i <= 8; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cx + i * 12, y: cy + i * 6, id: 1 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await frames(page, 2);
    const cam1 = await H(page, 'return [hr.stage.rig.panX, hr.stage.rig.panZ, hr.stage.rig.zoom]');
    check(Math.hypot(cam1[0] - cam0[0], cam1[1] - cam0[1]) > 0.3, `${label}: a one-finger drag pans`);
    check(await H(page, 'return W.stations.length') === 1, `${label}: the drag built nothing`);
    // pinch
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: cx - 30, y: cy, id: 1 }, { x: cx + 30, y: cy, id: 2 }] });
    for (let i = 1; i <= 8; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: cx - 30 - i * 10, y: cy, id: 1 }, { x: cx + 30 + i * 10, y: cy, id: 2 }] });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await frames(page, 2);
    const z2 = await H(page, 'return hr.stage.rig.zoom');
    check(z2 < cam1[2] - 0.05, `${label}: a pinch zooms in (${cam1[2].toFixed(2)} → ${z2.toFixed(2)})`);
    check(await H(page, 'return W.stations.length') === 1, `${label}: the pinch built nothing`);
    await H(page, 'hr.act.selectTool(null); hr.act.recentre(); hr.stage.snapCamera();');

    // tap a person → their card, on screen
    await page.tap('#b-gate');
    await H(page, 'hr.step(30 * 14)');
    await frames(page, 3);
    const who = await H(page, `const p = W.people.find((q) => q.state === 'walk' && q.d > 3); if (!p) return null; const s = hr.stage.toScreen(p.x, 0.35, p.z); return s;`);
    if (who) {
        await page.touchscreen.tap(who.x, who.y);
        await frames(page, 2);
        const card = await page.evaluate(() => { const c = document.getElementById('card'); if (c.classList.contains('hidden')) return null; const r = c.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }; });
        check(!!card && card.top >= 0 && card.bottom <= vp.height + 1 && card.left >= 0 && card.right <= vp.width + 1, `${label}: tapping a person opens their card on screen`);
    } else fail(`${label}: nobody to tap`);
    await shot(page, `p-${label}-card`);

    // results fit
    await playOut(page);
    await page.waitForSelector('#modal:not(.hidden) .stars', { timeout: 30000 });
    const rr = await page.$eval('#modal-panel', (e) => { const r = e.getBoundingClientRect(); return { top: r.top, bottom: r.bottom, left: r.left, right: r.right }; });
    check(rr.top >= 0 && rr.bottom <= vp.height + 1 && rr.left >= 0 && rr.right <= vp.width + 1, `${label}: results fit the screen`);
    await shot(page, `p-${label}-results`);
    await noSideScroll(page, `${label} results`);
}

try {
    if (!ONLY || ONLY === 'desktop') await desktop();
    if (!ONLY || ONLY === 'phones') { await phone({ width: 390, height: 844 }); await phone({ width: 844, height: 390 }); }
} catch (e) {
    fail(`crashed: ${e.message}`);
    console.log(e.stack);
} finally {
    if (browser) await browser.close();
}
const uniq = [...new Set(errors)];
check(uniq.length === 0, `no console errors, page errors or failed requests${uniq.length ? `:\n    ${uniq.slice(0, 10).join('\n    ')}` : ''}`);
console.log(`\n${fails ? `✗ ${fails} failed` : '✓ all passed'}`);
process.exit(fails ? 1 : 0);

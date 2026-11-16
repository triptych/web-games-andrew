/**
 * browsertest.mjs — the real game in real Chromium (SwiftShader WebGL).
 *
 * desktop (1280×760): boot to the title with no errors and the ← Games link on top → New Game
 *   plays the opening cinematic → Enter moves a shot, Escape skips it → the hangar → a sortie
 *   from the list → the briefing → Launch → real keys move the mech, hold Space for the magnet,
 *   E fires Overdrive → a level-up card picked with the 2 key → Escape pauses and the sim stops →
 *   Space presses the focused Resume → Escape closes Settings even with a slider focused → the
 *   bot wins the sortie → the debrief welcomes the rescued crew → the Crew tab collects their
 *   gifts after an hour → the Mech tab buys and fits a Scatter Cannon → Save & Quit → Continue
 *   restores it. Audio clips decode and a theme plays. No sideways scroll; the canvas fills the window.
 * phones (touch only, real CDP touches) at 390×844 and 844×390: tap New Game, tap Skip on the
 *   cinematic, tap a sortie and Launch, the touch deck appears, the stick moves the mech, holding
 *   🧲 pulls voxels, tapping OD fires Overdrive, controls ≥ 44 px and on screen, the canvas
 *   matches the visible viewport, the pause screen stays open after the finger lifts.
 * nostorage: localStorage throws; the game still boots and plays a sortie.
 * Fails on any console error, page error or failed request.
 *
 *   python3 -m http.server 8137          # from the REPO ROOT
 *   node game-137/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8137), ONLY=desktop,phones,nostorage, THREE_PKG.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8137';
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
    errors = [];
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('requestfailed', (r) => { if (!r.url().includes('favicon') && !r.url().includes('fonts.gstatic')) errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`); });
    await page.goto(`${BASE}/game-137/index.html?debug=1&fast=4&q=low`);
    await page.waitForFunction(() => window.__sf && __sf.mode === 'title', null, { timeout: 60000 });
    return page;
}

const check = (cond, msg) => { if (!cond) { fails++; console.log('  FAIL', msg); } else console.log('  ok', msg); return cond; };
const Q = (page, fn, arg) => page.evaluate(fn, arg);
const shot = async (page, name) => { await page.screenshot({ path: path.join(OUT, `bt-${name}.png`) }); };
// SwiftShader draws a few frames a second: wait on state, never on the clock.
const until = (page, fn, msg, timeout = 40000, arg = null) =>
    page.waitForFunction(fn, arg, { timeout, polling: 100 }).then(() => check(true, msg), () => check(false, msg));
// Playwright's click() waits for frames to settle, which SwiftShader never does; click from inside.
const click = (page, sel) => Q(page, (s) => { const e = document.querySelector(s); if (!e) return false; e.getAnimations?.({ subtree: true }).forEach((a) => a.finish()); e.click(); return true; }, sel);
const visible = (page, id) => Q(page, (i) => { const e = document.getElementById(i); return !!e && !e.hidden; }, id);
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
/** The canvas isn't one flat colour (the scene drew). */
const notBlank = (page) => Q(page, () => {
    const c = document.getElementById('view');
    // render and read in the same task, or the drawing buffer is already cleared
    __sf.view.renderer.render(__sf.view.scene, __sf.view.camera);
    const g = document.createElement('canvas'); g.width = 64; g.height = 40;
    const x = g.getContext('2d'); x.drawImage(c, 0, 0, 64, 40);
    const d = x.getImageData(0, 0, 64, 40).data, seen = new Set();
    for (let i = 0; i < d.length; i += 4) seen.add((d[i] >> 4) << 8 | (d[i + 1] >> 4) << 4 | (d[i + 2] >> 4));
    return seen.size;
});
const reportErrors = (label) => { check(errors.length === 0, `${label}: no console errors, page errors or failed requests`); for (const e of errors.slice(0, 8)) console.log('    ', e); };

// ======================================================================
async function desktop() {
    console.log('\n== desktop 1280×760');
    const page = await open({ width: 1280, height: 760 });
    check(await backLinkOk(page), '← Games link is on top and points at ../index.html');
    check(await visible(page, 'title'), 'title screen is up');
    check(await Q(page, () => document.getElementById('btn-continue').hidden), 'no Continue without a save');
    check(await Q(page, () => document.querySelectorAll('#title-title').length <= 1), 'no id clashes with the a11y heading');
    let L = await layout(page);
    check(L.noHScroll && L.canvas, 'no sideways scroll; the canvas fills the window');
    await shot(page, 'desktop-title');

    // ---- the opening cinematic
    await click(page, '#title-menu [data-act="new"]');
    await until(page, () => __sf.mode === 'intro' && !document.getElementById('intro').hidden, 'New Game plays the opening cinematic');
    await until(page, () => __sf.cin.i === 0 && document.getElementById('intro-sub').textContent.length > 10, 'the first shot has a subtitle');
    await page.keyboard.press('Enter');
    await until(page, () => __sf.cin.i === 1, 'Enter moves on a shot');
    await shot(page, 'desktop-intro');
    await page.keyboard.press('Escape');
    await until(page, () => __sf.mode === 'hangar' && document.getElementById('intro').hidden && !document.getElementById('hangar').hidden, 'Escape skips the cinematic to the hangar');
    await until(page, () => __sf.audio.playing(), 'a theme is playing');
    check(await Q(page, () => Object.keys(__sf.audio.buffers).length >= 20 && Object.keys(__sf.audio.voices).length >= 10), 'the ElevenLabs effects and voices decode');
    await shot(page, 'desktop-hangar');

    // ---- launch a sortie from the list
    await click(page, '#tab-sortie [data-mission="1"]');
    await until(page, () => !document.getElementById('briefing').hidden, 'a sortie opens its briefing');
    check(await Q(page, () => document.querySelector('[data-mission="2"]').disabled), 'later sorties are locked');
    await click(page, '#brief-launch');
    await until(page, () => __sf.mode === 'mission' && __sf.G.run && !document.getElementById('hud').hidden, 'Launch starts the sortie with the HUD up');
    await until(page, () => __sf.G.run.t > 0.5, 'the sortie runs');
    const blank = await notBlank(page);
    check(blank > 12, `the battlefield is drawn (${blank} colours)`);

    // ---- real keys
    const x0 = await Q(page, () => __sf.G.run.mech.x);
    await page.keyboard.down('ArrowRight');
    await until(page, (x) => __sf.G.run.mech.x > x + 1.5, 'holding → walks the mech right', 40000, x0);
    await page.keyboard.up('ArrowRight');
    await page.keyboard.down('Space');
    await until(page, () => __sf.G.run.mech.magnetOn === true, 'holding Space turns the magnet on');
    await page.keyboard.up('Space');
    await until(page, () => __sf.G.run.mech.magnetOn === false, 'letting go turns it off');
    await Q(page, () => { __sf.G.run.mech.od = 1; });
    await page.keyboard.press('KeyE');
    await until(page, () => (__sf.seen.overdrive || 0) >= 1 && __sf.G.run.mech.odT > 0, 'E fires Overdrive');
    await shot(page, 'desktop-overdrive');

    // ---- v1.1: objective arrows, the Shard Beam, click to focus, the danger edge
    await until(page, () => [...document.querySelectorAll('#arrows .arrow')].filter((a) => !a.hidden).length === 2, 'two arrows point at the two cages');
    await Q(page, () => { const M = __sf.G.run.mech; M.beam = 1; M.beamCd = 0; });
    await until(page, () => document.getElementById('hud-beam').classList.contains('ready'), 'a full gauge shows BEAM READY');
    await page.keyboard.press('KeyQ');
    await until(page, () => (__sf.seen.shard_beam || 0) >= 1 && __sf.G.run.mech.beamCd > 0, 'Q fires the Shard Beam and starts its cooldown');
    await shot(page, 'desktop-beam');
    const fid = await Q(page, () => __sf.spawn('brute', 4, -4));
    await page.waitForTimeout(300);
    const fp = await Q(page, (id) => { const e = __sf.G.run.enemies.find((x) => x.id === id); return __sf.view.project(e.x, e.y, 0.6); }, fid);
    await page.mouse.click(fp.x, fp.y);
    await until(page, (id) => __sf.G.run.focus?.id === id && !document.getElementById('reticle').hidden, 'clicking a monster focuses fire on it (reticle shown)', 40000, fid);
    await Q(page, (id) => { const e = __sf.G.run.enemies.find((x) => x.id === id); e.hp = 1; }, fid);
    await until(page, () => __sf.G.run.focus === null && document.getElementById('reticle').hidden, 'when it dies the focus clears');
    const hp0 = await Q(page, () => { const M = __sf.G.run.mech; const h = M.hp; M.hp = M.maxHp * 0.15; return h; });
    await until(page, () => document.getElementById('danger').classList.contains('on'), 'low HP lights the red danger edge');
    await until(page, () => (__sf.audio.last.alarm || 0) > 0, 'and sounds the klaxon');
    await shot(page, 'desktop-danger');
    await Q(page, (h) => { __sf.G.run.mech.hp = h; }, hp0);
    await until(page, () => !document.getElementById('danger').classList.contains('on'), 'healed, the edge goes out');

    // ---- a level-up card by key
    await Q(page, () => { const M = __sf.G.run.mech; M.xp = M.xpNext; });
    await until(page, () => !document.getElementById('levelup').hidden && document.querySelectorAll('#cards [data-pick]').length >= 1, 'a full XP bar opens the level-up cards');
    const t0 = await Q(page, () => __sf.G.run.t);
    await page.waitForTimeout(400);
    check(await Q(page, (t) => __sf.G.run.t === t, t0), 'the battle waits while the cards are up');
    const want2 = await Q(page, () => __sf.G.run.choice[1]);
    await page.keyboard.press('Digit2');
    await until(page, (k) => document.getElementById('levelup').hidden && (__sf.G.run.mods[k] || 0) === 1, 'the 2 key picks the second card', 40000, want2);

    // ---- pause, Space on a focused button, Escape out of Settings
    await page.keyboard.press('Escape');
    await until(page, () => !document.getElementById('pause').hidden, 'Escape pauses');
    const t1 = await Q(page, () => __sf.G.run.t);
    await page.waitForTimeout(400);
    check(await Q(page, (t) => __sf.G.run.t === t, t1), 'the sim stops while paused');
    await click(page, '#pause-menu [data-act="settings"]');
    await until(page, () => !document.getElementById('settings').hidden, 'Settings opens over the pause menu');
    check(await Q(page, () => +getComputedStyle(document.getElementById('settings')).zIndex > +getComputedStyle(document.getElementById('pause')).zIndex), 'and sits on top of it');
    await Q(page, () => document.getElementById('set-sfx').focus());
    await page.keyboard.press('Escape');
    await until(page, () => document.getElementById('settings').hidden && !document.getElementById('pause').hidden, 'Escape closes Settings even with a slider focused');
    await Q(page, () => document.querySelector('#pause-menu [data-act="resume"]').focus());
    await page.keyboard.press('Space');
    await until(page, () => document.getElementById('pause').hidden && __sf.mode === 'mission', 'Space presses the focused Resume');

    // ---- win it with the bot
    await Q(page, () => { __sf.G.run.mech.inv = 1e9; __sf.autoplay(true); });
    await Q(page, () => __sf.ff(260));
    await until(page, () => __sf.mode === 'debrief' && !document.getElementById('debrief').hidden, 'the sortie ends in a debrief', 60000);
    check(await Q(page, () => __sf.G.cleared[1] && document.querySelectorAll('#db-crew .joined').length === 2), 'mission 1 is won and two rescued people join the crew');
    await shot(page, 'desktop-debrief');
    await Q(page, () => __sf.autoplay(false));
    await click(page, '#db-ok');
    await until(page, () => __sf.mode === 'hangar' && !document.getElementById('hangar').hidden, 'back to the hangar');

    // ---- crew gifts after an hour
    await click(page, '.tab[data-tab="crew"]');
    await until(page, () => document.querySelectorAll('#tab-crew [data-crew]').length === 2, 'the Crew tab shows the two rescued');
    const gold0 = await Q(page, () => { __sf.G.events.length = 0; return __sf.G.hangar.gold; });
    await Q(page, () => { const G = __sf.G; for (const c of G.hangar.crew) c.t0 -= 3600; });
    await until(page, () => !document.getElementById('gift-badge').hidden, 'an hour later the gift badge shows');
    await click(page, '#collect-all');
    await until(page, (g) => __sf.G.hangar.gold > g && __sf.G.hangar.boosts.bento >= 1, 'Collect pays Old Gen\'s credits and stores Hana\'s bentos', 40000, gold0);
    await shot(page, 'desktop-crew');

    // ---- buy and fit a part
    await Q(page, () => { __sf.G.hangar.gold += 400; });
    await click(page, '.tab[data-tab="mech"]');
    await click(page, '[data-slot="armR"]');
    await until(page, () => !!document.querySelector('[data-do="buy"][data-part="scatter"]'), 'the right-arm parts list shows');
    await click(page, '[data-do="buy"][data-part="scatter"]');
    await until(page, () => __sf.G.hangar.loadout.armR === 'scatter', 'buying a Scatter Cannon fits it in the empty right arm');
    await shot(page, 'desktop-mech');

    // ---- save, quit, continue
    const gold1 = await Q(page, () => __sf.G.hangar.gold);
    await click(page, '#hg-menu');
    await until(page, () => !document.getElementById('pause').hidden, 'the ☰ opens the menu');
    check(await Q(page, () => document.getElementById('btn-abort').hidden), 'no Abort button in the hangar');
    await click(page, '#pause-menu [data-act="quit"]');
    await until(page, () => __sf.mode === 'title' && !document.getElementById('btn-continue').hidden, 'Save & Quit returns to the title with Continue');
    await click(page, '#title-menu [data-act="continue"]');
    await until(page, (g) => __sf.mode === 'hangar' && __sf.G.hangar.gold >= g && __sf.G.hangar.loadout.armR === 'scatter' && __sf.G.hangar.crew.length === 2, 'Continue restores credits, parts and crew', 40000, gold1);
    L = await layout(page);
    check(L.noHScroll && L.canvas, 'still no sideways scroll; the canvas fills the window');
    reportErrors('desktop');
}

// ======================================================================
async function phone(w, h) {
    console.log(`\n== phone ${w}×${h} (touch only)`);
    const page = await open({ width: w, height: h }, { touch: true });
    const cdp = await page.context().newCDPSession(page);
    const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
    const center = (sel) => Q(page, (s) => { const e = document.querySelector(s); e?.scrollIntoView({ block: 'center' }); e?.getAnimations?.({ subtree: true }).forEach((a) => a.finish()); const b = e?.getBoundingClientRect(); return b && { x: b.left + b.width / 2, y: b.top + b.height / 2 }; }, sel);
    const tapSel = async (sel) => { const r = await center(sel); if (!r) return false; await page.touchscreen.tap(r.x, r.y); return true; };

    check(await backLinkOk(page), '← Games link is on top');
    await tapSel('#title-menu [data-act="new"]');
    await until(page, () => __sf.mode === 'intro', 'a tap on New Game plays the cinematic');
    await tapSel('#intro-skip');
    await until(page, () => __sf.mode === 'hangar', 'a tap on Skip goes to the hangar');
    await shot(page, `phone-${w}x${h}-hangar`);
    await tapSel('#tab-sortie [data-mission="1"]');
    await until(page, () => !document.getElementById('briefing').hidden, 'a tap opens the briefing');
    await tapSel('#brief-launch');
    await until(page, () => __sf.mode === 'mission', 'a tap on Launch starts the sortie');
    await until(page, () => !document.getElementById('touch').hidden, 'the touch deck is shown');
    await Q(page, () => { __sf.G.run.mech.inv = 1e9; });

    const L = await layout(page);
    check(L.noHScroll, 'no sideways scroll');
    check(L.canvas, 'the canvas matches the visible viewport');
    const sizes = await Q(page, () => ['#btn-mag', '#btn-od', '#btn-beam', '#btn-pause'].map((s) => {
        const r = document.querySelector(s).getBoundingClientRect();
        return { s, ok: r.width >= 44 && r.height >= 44 && r.left >= 0 && r.top >= 0 && r.right <= innerWidth && r.bottom <= innerHeight };
    }));
    for (const z of sizes) check(z.ok, `${z.s} is at least 44 px and on screen`);
    check(await Q(page, () => {
        const a = document.getElementById('btn-mag').getBoundingClientRect(), b = document.getElementById('btn-od').getBoundingClientRect();
        return a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top;
    }), 'the 🧲 and OD buttons don\'t overlap');

    // drag the stick right with a real touch
    const zone = await Q(page, () => { const r = document.getElementById('stick-zone').getBoundingClientRect(); return { x: r.left + r.width * 0.4, y: r.top + r.height * 0.5 }; });
    const x0 = await Q(page, () => __sf.G.run.mech.x);
    await touch('touchStart', [{ x: zone.x, y: zone.y, id: 1 }]);
    for (let i = 1; i <= 6; i++) await touch('touchMove', [{ x: zone.x + i * 12, y: zone.y, id: 1 }]);
    await until(page, (x) => __sf.G.run.mech.x > x + 1, 'dragging the stick walks the mech', 40000, x0);
    // hold the magnet with a second finger
    const mag = await center('#btn-mag');
    await touch('touchStart', [{ x: zone.x + 72, y: zone.y, id: 1 }, { x: mag.x, y: mag.y, id: 2 }]);
    await until(page, () => __sf.G.run.mech.magnetOn === true, 'holding 🧲 with a second finger turns the magnet on');
    await touch('touchEnd', []);
    await until(page, () => __sf.G.run.mech.magnetOn === false, 'lifting the fingers lets go');

    await Q(page, () => { __sf.G.run.mech.od = 1; });
    await tapSel('#btn-od');
    await until(page, () => (__sf.seen.overdrive || 0) >= 1, 'tapping OD fires Overdrive');
    await Q(page, () => { const M = __sf.G.run.mech; M.beam = 1; M.beamCd = 0; });
    await tapSel('#btn-beam');
    await until(page, () => (__sf.seen.shard_beam || 0) >= 1, 'tapping BEAM fires the Shard Beam');
    // tap a monster up and to the right of the mech, away from the stick
    const fid = await Q(page, () => __sf.spawn('brute', 4, -5));
    await page.waitForTimeout(300);
    const fp = await Q(page, (id) => { const e = __sf.G.run.enemies.find((x) => x.id === id); return __sf.view.project(e.x, e.y, 0.6); }, fid);
    check(await Q(page, (p) => { const t = document.elementFromPoint(p.x, p.y); return t && t.id === 'view'; }, fp), 'the monster is tappable (nothing covers it)');
    await touch('touchStart', [{ x: fp.x, y: fp.y, id: 3 }]);
    await touch('touchEnd', []);
    await until(page, (id) => __sf.G.run.focus?.id === id, 'a tap on the monster focuses fire on it', 40000, fid);
    check(await Q(page, () => {
        const ids = ['#btn-mag', '#btn-od', '#btn-beam'].map((s) => document.querySelector(s).getBoundingClientRect());
        for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) { const a = ids[i], b = ids[j]; if (!(a.right <= b.left || b.right <= a.left || a.bottom <= b.top || b.bottom <= a.top)) return false; }
        return ids.every((r) => r.top >= 0 && r.bottom <= innerHeight && r.right <= innerWidth);
    }), 'the 🧲, OD and BEAM buttons are on screen and don\'t overlap');
    await shot(page, `phone-${w}x${h}`);

    await tapSel('#btn-pause');
    await until(page, () => !document.getElementById('pause').hidden, 'tapping ❚❚ pauses');
    await page.waitForTimeout(300);
    check(await visible(page, 'pause'), 'the pause screen stays open after the finger lifts');
    await tapSel('#pause-menu [data-act="resume"]');
    await until(page, () => document.getElementById('pause').hidden, 'a tap on Resume closes it');
    reportErrors(`phone ${w}×${h}`);
}

// ======================================================================
async function nostorage() {
    console.log('\n== blocked storage');
    const page = await open({ width: 1280, height: 760 }, { nostorage: true });
    await Q(page, () => { __sf.newGame(7); __sf.launch(2); });
    await until(page, () => __sf.mode === 'mission', 'boots and starts a sortie with localStorage throwing');
    await Q(page, () => __sf.ff(4));
    check(await Q(page, () => __sf.save() === false), 'saving fails quietly');
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

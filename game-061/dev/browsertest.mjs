/**
 * browsertest.mjs — real Chromium, real WebGL (SwiftShader), real three.js r165.
 *
 * Desktop (1280×760): boot → title (back link visible) → NEW VOYAGE with a typed seed → LAUNCH →
 * docked at Hearth → BUILD a Refinery through the UI → UNDOCK → throttle with W, steer with the mouse,
 * cycle targets with T → mine a rock with Q until ore lands in the hold → dock at Hearth with E and
 * UNLOAD ALL → fly to the Waypost, dock, SELL ALL RAW, accept a mission → galaxy map (G), select a
 * neighbour, ENGAGE WARP → arrive in a new system → pause (Esc), settings, resume → die and wake up
 * at Hearth → SAVE & QUIT → reload → CONTINUE.
 * Touch-only phones at 390×844 and 844×390: tap through to flight, touch controls ≥ 44 px and not
 * covering the HUD, the stick steers, FIRE fires, the rail sets throttle, ❚❚ pauses, menus scroll,
 * nothing scrolls sideways, the canvas isn't clipped.
 * Fails on any console error, page error or failed request. Screenshots go to dev/shots/.
 *
 *   python3 -m http.server 8061                 # from the REPO ROOT
 *   node game-061/dev/browsertest.mjs
 *
 * No network to unpkg.com? Unpack three@0.165.0 into dev/package (repo root) or point THREE_PKG at it.
 * Env: BASE (default http://127.0.0.1:8061), ONLY=desktop|phones.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? [path.join(HERE, 'package'), path.join(HERE, '../../dev/package')].find((p) => fs.existsSync(p));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8061';
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
            if (!sessionStorage.getItem('sw-init')) {
                sessionStorage.setItem('sw-init', '1');
                localStorage.clear();
                localStorage.setItem('starwright.v1.settings', JSON.stringify({ muted: true, quality: '3', tips: true }));
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
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('requestfailed', (r) => { if (!r.url().includes('favicon')) errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`); });
    return { page, ctx };
}

const S = (page, js) => page.evaluate(`(() => { const S = window.__sw; ${js} })()`);
const waitFor = (page, js, timeout = 60000) => page.waitForFunction(`(() => { const S = window.__sw; return ${js}; })()`, null, { timeout, polling: 100 });
const shot = (page, name) => page.screenshot({ path: path.join(OUT, `${name}.png`) });

// Steer the real player toward a world point by teleporting next to it facing it (SwiftShader runs
// far too slowly to fly every leg; flight itself is covered by dev/simtest.mjs).
const parkNear = (page, id, dist) => S(page, `
    const o = S.world.findNav('${id}'); const p = S.world.player;
    p.pos = { x: o.pos.x + ${dist}, y: o.pos.y + 20, z: o.pos.z + ${dist} };
    p.vel = { x: 0, y: 0, z: 0 }; p.throttle = 0; p.cruise.state = 'off';
    p.yaw = Math.atan2(o.pos.x - p.pos.x, o.pos.z - p.pos.z); p.pitch = 0;
    S.world.updateClusters(true); S.snap(); return true;`);

async function desktop() {
    console.log('\n== desktop 1280×760');
    const { page } = await newPage({ width: 1280, height: 760 });
    await page.goto(`${BASE}/game-061/index.html?debug=1`);
    await waitFor(page, 'S && S.world && S.mode === "title"');
    const back = await page.locator('#back-link').boundingBox();
    check(back && back.y >= 0 && back.x >= 0, 'back link visible on the title');
    await shot(page, 'bt-title');

    await page.click('text=NEW VOYAGE');
    await page.waitForSelector('input[aria-label=Seed]');
    await page.fill('input[aria-label=Seed]', 'browser-1');
    await page.waitForTimeout(400);
    check(await page.locator('.preview-sp img').count() === 8, 'species preview shows 8 portraits');
    await page.click('text=LAUNCH');
    await waitFor(page, 'S.mode === "docked" && S.menus.kind === "hearth"');
    check(await S(page, 'return S.game.s.seed') === 'BROWSER-1', 'seed normalised to BROWSER-1');
    check(!(await page.locator('#back-link').isVisible()), 'back link hidden while playing');

    // Build a Refinery through the UI.
    await S(page, `S.store('ferrite', 60); S.store('silicate', 40);`);
    await page.click('.tabs >> text=BUILD');
    await page.locator('.card', { hasText: 'REFINERY' }).locator('button', { hasText: 'BUILD' }).click();
    check(await S(page, 'return S.game.s.base.modules.some((m) => m.type === "refinery")'), 'built a Refinery from the BUILD tab');
    await page.click('.tabs >> text=SHIPYARD');
    check(await S(page, 'return S.view.showcase === true'), 'shipyard tab shows the ship showcase');
    await shot(page, 'bt-shipyard');

    // Undock and fly.
    await page.click('text=UNDOCK');
    await waitFor(page, 'S.mode === "flight"');
    check(await page.locator('#hud').isVisible(), 'HUD visible in flight');
    const thr0 = await S(page, 'return S.world.player.throttle');
    await page.keyboard.down('KeyW'); await page.waitForTimeout(1500); await page.keyboard.up('KeyW');
    check(await S(page, 'return S.world.player.throttle') > thr0, 'W raises the throttle');
    const yaw0 = await S(page, 'return S.world.player.yaw');
    await page.mouse.move(640, 380); await page.mouse.move(1100, 380, { steps: 8 });
    await page.waitForTimeout(1500);
    check(Math.abs((await S(page, 'return S.world.player.yaw')) - yaw0) > 0.02, 'the mouse steers the ship');
    await page.mouse.move(640, 380, { steps: 4 });
    const t0 = await S(page, 'return S.world.target');
    await page.keyboard.press('KeyT');
    await page.waitForTimeout(400);
    check(await S(page, 'return S.world.target') !== t0, 'T cycles the target');

    // Mine: park beside a soft rock, hold Q.
    await S(page, `S.world.setTarget(S.world.sys.belts[0].id);`);
    const rock = await S(page, `
        const b = S.world.sys.belts[0]; const c = b.clusters[0]; const p = S.world.player;
        p.pos = { x: c.pos.x + 900, y: c.pos.y, z: c.pos.z }; S.world.updateClusters(true);
        let best = null; for (const r of S.world.rocks()) if (r.hard <= 1 && (!best || r.radius > best.radius)) best = r;
        if (!best) return null;
        p.pos = { x: best.pos.x + best.radius + 40, y: best.pos.y, z: best.pos.z };
        p.vel = { x: 0, y: 0, z: 0 }; p.throttle = 0;
        p.yaw = Math.atan2(best.pos.x - p.pos.x, best.pos.z - p.pos.z); p.pitch = Math.atan2(best.pos.y - p.pos.y, Math.hypot(best.pos.x - p.pos.x, best.pos.z - p.pos.z));
        S.snap(); return best.id;`);
    check(!!rock, 'found a mineable rock in the inner belt');
    await page.mouse.move(640, 380);
    await S(page, 'S.input.settings.mouseSteer = false;');
    await page.keyboard.down('KeyQ');
    await waitFor(page, 'S.game.cargoUsed() >= 3', 60000).catch(() => {});
    await shot(page, 'bt-mining');
    await page.keyboard.up('KeyQ');
    check(await S(page, 'return S.game.cargoUsed()') >= 3, `mining with Q put ore in the hold (${await S(page, 'return JSON.stringify(S.game.s.cargo)')})`);

    // Dock at Hearth with E and unload.
    await S(page, `S.give('ferrite', 25);`);
    await parkNear(page, await S(page, 'return S.world.sys.stations[0].id'), 120);
    await waitFor(page, 'S.world.ctx && S.world.ctx.kind === "dock"', 20000).catch(() => {});
    await page.keyboard.press('KeyE');
    await waitFor(page, 'S.mode === "docked" && S.menus.kind === "hearth"', 20000).catch(() => {});
    check(await S(page, 'return S.menus.kind') === 'hearth', 'E docks at Hearth');
    await page.click('text=UNLOAD ALL');
    check(await S(page, 'return S.game.cargoUsed()') === 0, 'UNLOAD ALL empties the hold');
    await waitFor(page, 'S.game.s.story.stage >= 1', 10000).catch(() => {});
    check(await S(page, 'return S.game.s.story.stage') >= 1, 'story advanced past First Light');

    // The Waypost: sell and take a mission.
    await page.click('text=UNDOCK');
    await waitFor(page, 'S.mode === "flight"');
    await S(page, `S.give('silicate', 10); S.give('ferrite', 10);`);
    await parkNear(page, await S(page, 'return S.world.sys.stations[1].id'), 120);
    await waitFor(page, 'S.world.ctx && S.world.ctx.kind === "dock"', 20000).catch(() => {});
    await page.keyboard.press('KeyE');
    await waitFor(page, 'S.menus.kind === "station"', 20000).catch(() => {});
    check(await S(page, 'return S.menus.kind') === 'station', 'docked at the Waypost');
    const cr0 = await S(page, 'return S.game.s.credits');
    await page.click('text=SELL ALL RAW');
    check(await S(page, 'return S.game.s.credits') > cr0, 'SELL ALL RAW earns credits');
    await page.click('.tabs >> text=MISSIONS');
    await shot(page, 'bt-missions');
    const accepts = page.locator('button', { hasText: 'ACCEPT' });
    if (await accepts.count()) { await accepts.first().click(); check(await S(page, 'return S.game.s.quests.length') === 1, 'accepted a mission'); }
    else ok('no missions on the board right now (allowed)');

    // Galaxy map + warp.
    await S(page, `S.game.s.base.tech.push('warp'); S.game.s.ship.comps.warp = 1; S.game.s.ship.fuel = 4;`);
    await page.click('text=UNDOCK');
    await waitFor(page, 'S.mode === "flight"');
    await page.keyboard.press('KeyG');
    await waitFor(page, 'S.mode === "map"');
    const target = await S(page, `const g = S.game.galaxy; const H = g.systems[g.home]; const n = g.systems.filter((s) => s.id !== g.home && Math.hypot(s.x - H.x, s.y - H.y) < 7).sort((a, b) => Math.hypot(a.x - H.x, a.y - H.y) - Math.hypot(b.x - H.x, b.y - H.y))[0]; S.maps.sel = n.id; S.maps.renderSide(); return n.id;`);
    await shot(page, 'bt-galaxy');
    await page.click('text=ENGAGE WARP');
    await waitFor(page, 'S.world.warp || S.mode === "warp"', 20000);
    await waitFor(page, `S.mode === "flight" && S.game.s.location.system === ${target}`, 120000).catch(() => {});
    check(await S(page, 'return S.game.s.location.system') === target, 'warped to a neighbouring system');
    await shot(page, 'bt-arrive');

    // Pause, settings, resume.
    await page.keyboard.press('Escape');
    await waitFor(page, 'S.menus.kind === "pause"');
    await page.click('#panel >> text=SETTINGS');
    await page.locator('.setting', { hasText: 'Mouse steering' }).locator('button', { hasText: 'OFF' }).click();
    check(await S(page, 'return S.app.settings.mouseSteer') === false, 'settings: mouse steering off');
    await page.keyboard.press('Escape');
    await waitFor(page, 'S.mode === "flight"');
    ok('Esc resumes');

    // Death.
    await S(page, 'S.world.damagePlayer(99999, true);');
    await waitFor(page, 'S.menus.kind === "death"', 60000);
    await page.click('text=WAKE UP AT HEARTH');
    await waitFor(page, 'S.mode === "docked" && S.game.s.location.system === S.game.galaxy.home');
    ok('died and woke up at Hearth');

    // Save, quit, reload, continue.
    await page.keyboard.press('Escape');
    await waitFor(page, 'S.menus.kind === "pause"');
    await page.click('#panel >> text=SAVE & QUIT TO TITLE');
    await waitFor(page, 'S.mode === "title"');
    await page.reload();
    await waitFor(page, 'S && S.world && S.mode === "title"');
    await page.click('text=CONTINUE');
    await waitFor(page, 'S.mode === "docked" || S.mode === "flight"');
    check(await S(page, 'return S.game.s.seed') === 'BROWSER-1' && await S(page, 'return S.game.s.stats.deaths') === 1, 'CONTINUE restores the voyage');
}

async function phone(viewport, label) {
    console.log(`\n== touch phone ${label}`);
    const { page, ctx } = await newPage(viewport, true);
    const cdp = await ctx.newCDPSession(page);
    const tapAt = async (x, y) => {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x, y, id: 1 }] });
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    };
    const tap = async (locator) => {
        const b = await locator.boundingBox();
        if (!b) throw new Error('no box for tap target');
        const x = b.x + b.width / 2, y = b.y + b.height / 2;
        const top = await page.evaluate(([x, y]) => { const e = document.elementFromPoint(x, y); return e ? (e.id || e.className || e.tagName) : null; }, [x, y]);
        await tapAt(x, y);
        return top;
    };
    await page.goto(`${BASE}/game-061/index.html?debug=1`);
    await waitFor(page, 'S && S.world && S.mode === "title"');
    const t1 = await tap(page.locator('#title-menu >> text=NEW VOYAGE'));
    await page.waitForSelector('text=LAUNCH', { timeout: 15000 }).catch(() => fail(`NEW VOYAGE tap did nothing (top element: ${t1})`));
    await page.waitForFunction(() => document.querySelectorAll('.preview-sp img').length === 8, null, { timeout: 30000 });
    await page.waitForTimeout(500);
    const t2 = await tap(page.locator('text=LAUNCH'));
    await waitFor(page, 'S.mode === "docked"', 30000).catch(() => fail(`LAUNCH tap did nothing (top element: ${t2})`));
    await shot(page, `bt-phone-docked-${label}`);
    // The docked panel must scroll on a phone (touch-action pan-y).
    const scrollable = await page.evaluate(() => { const b = document.querySelector('.win-body'); return b && getComputedStyle(b).touchAction; });
    check(/pan-y|auto/.test(scrollable || ''), `menu body scrolls by touch (${scrollable})`);
    await tap(page.locator('text=UNDOCK'));
    await waitFor(page, 'S.mode === "flight"');
    check(await page.locator('#touch').isVisible(), 'touch controls visible');
    await shot(page, `bt-phone-${label}`);
    // Sizes
    const small = await page.evaluate(() => [...document.querySelectorAll('#tbtns button, #throttle-rail, .hbtns button')].filter((b) => { const r = b.getBoundingClientRect(); return r.width < 44 || r.height < 44; }).map((b) => b.id || b.textContent));
    check(!small.length, `touch targets ≥ 44 px ${small.length ? JSON.stringify(small) : ''}`);
    // Overlaps between controls and HUD readouts
    const overlaps = await page.evaluate(() => {
        const ctl = [...document.querySelectorAll('#tbtns button, #throttle-rail, .hbtns button')];
        const hud = ['#hud-tl', '#hud-br', '#ctx', '#hud-bc', '#tracker'].map((s) => document.querySelector(s)).filter((e) => e && e.offsetParent !== null && !e.classList.contains('hidden'));
        const out = [];
        for (const a of ctl) for (const b of hud) {
            const r1 = a.getBoundingClientRect(), r2 = b.getBoundingClientRect();
            if (r2.width === 0) continue;
            if (r1.left < r2.right && r1.right > r2.left && r1.top < r2.bottom && r1.bottom > r2.top) out.push(`${a.id || a.textContent} × ${b.id}`);
        }
        return out;
    });
    check(!overlaps.length, `controls don't cover the HUD ${overlaps.length ? JSON.stringify(overlaps) : ''}`);
    // Stick steers
    const yaw0 = await S(page, 'return S.world.player.yaw');
    const zone = await page.locator('#stick-zone').boundingBox();
    const sx = zone.x + zone.width * 0.4, sy = zone.y + zone.height * 0.6;
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: sx, y: sy, id: 2 }] });
    for (let i = 1; i <= 6; i++) await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: sx + i * 10, y: sy, id: 2 }] });
    await page.waitForTimeout(1500);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    check(Math.abs((await S(page, 'return S.world.player.yaw')) - yaw0) > 0.02, 'the relative stick steers');
    // Throttle rail
    const rail = await page.locator('#throttle-rail').boundingBox();
    await tapAt(rail.x + rail.width / 2, rail.y + 8);
    await page.waitForTimeout(400);
    check(await S(page, 'return S.world.player.throttle') > 0.8, 'tapping the top of the rail sets full throttle');
    // FIRE
    const fb = await page.locator('#tb-fire').boundingBox();
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: fb.x + fb.width / 2, y: fb.y + fb.height / 2, id: 3 }] });
    await waitFor(page, 'S.world.bolts.length > 0', 15000).catch(() => {});
    check(await S(page, 'return S.world.bolts.length') > 0, 'FIRE shoots');
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    // Layout sanity
    const sideways = await page.evaluate(() => document.documentElement.scrollWidth > innerWidth + 1);
    check(!sideways, 'no sideways scroll');
    const clipped = await page.evaluate(() => { const r = document.getElementById('gl').getBoundingClientRect(); return r.left < -1 || r.right > innerWidth + 1; });
    check(!clipped, 'canvas not clipped');
    // Pause
    await tap(page.locator('#btn-pause'));
    await waitFor(page, 'S.menus.kind === "pause"', 10000).catch(() => {});
    check(await S(page, 'return S.menus.kind') === 'pause', '❚❚ pauses');
    await tap(page.locator('text=RESUME'));
    await waitFor(page, 'S.mode === "flight"', 10000).catch(() => {});
    check(await S(page, 'return S.mode') === 'flight', 'RESUME returns to flight');
    // Maps open and close by touch
    await tap(page.locator('#btn-map'));
    await waitFor(page, 'S.mode === "map"', 10000).catch(() => {});
    check(await S(page, 'return S.mode') === 'map', 'MAP opens the galaxy map');
    await tap(page.locator('#map-close'));
    await waitFor(page, 'S.mode === "flight"', 10000).catch(() => {});
    check(await S(page, 'return S.mode') === 'flight', 'map closes');
}

try {
    if (!ONLY || ONLY === 'desktop') await desktop();
    if (!ONLY || ONLY === 'phones') { await phone({ width: 390, height: 844 }, '390x844'); await phone({ width: 844, height: 390 }, '844x390'); }
} catch (e) {
    fail(`exception: ${e.message}`);
}
if (browser) await browser.close();
if (errors.length) { fails += errors.length; console.log('\nErrors:\n' + errors.map((e) => '  ' + e).join('\n')); }
console.log(fails ? `\n${fails} FAILURE(S)` : '\nALL PASSED');
process.exit(fails ? 1 : 0);

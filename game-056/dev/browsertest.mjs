/**
 * browsertest.mjs — real Chromium, real WebGL, real three.js r165.
 *
 * Desktop (1280×760): title with the attract demo → New Defence → region
 * card → place an archer by clicking its card and a field square → Sound
 * the Horn → kills → tap a powerup orb and an ember mote → use the powerup
 * → open a unit and level it up → buy a tower in the Keep → clear the wave
 * → pick a relic → a boss wave per region → lose a wave and retry → the
 * Ember Tree (buy, rekindle) → bestiary, settings, help → every region's
 * battlefield. Then touch-only phones at 390×844 and 844×390: tap a card and
 * a square, start a wave, open the Keep, tap targets ≥ 44 px, nothing off
 * screen. Fails on any console error, page error or failed request.
 * Screenshots go to dev/shots/.
 *
 *   python3 -m http.server 8056                 # from the REPO ROOT
 *   node game-056/dev/browsertest.mjs
 *
 * No network to unpkg.com? Point THREE_PKG at an unpacked three@0.165.0:
 *   npm pack three@0.165.0 && tar xzf three-0.165.0.tgz     # -> ./package
 *   THREE_PKG=$PWD/package node game-056/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8056), OUT, ONLY=desktop|phones|regions, PW_CHROMIUM_PATH.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? path.join(HERE, 'package');
const BASE = process.env.BASE ?? 'http://127.0.0.1:8056';
const OUT = process.env.OUT ?? path.join(HERE, 'shots');
const ONLY = process.env.ONLY ?? '';
fs.mkdirSync(OUT, { recursive: true });

const errors = [];
let browser = null;
const launch = () => chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
});

async function newPage(viewport, extra = {}, quality = '1') {
    if (browser) await browser.close();
    browser = await launch();
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, ...extra });
    await ctx.addInitScript((q) => {
        window.confirm = () => true;
        try {
            if (localStorage.getItem('__keep')) return;
            localStorage.clear();
            localStorage.setItem('keepfire.save.v1', JSON.stringify({ v: 1, meta: { settings: { sound: false, music: false, quality: q, hints: true, autoStart: false } }, run: null, savedAt: 0 }));
        } catch { /* ignore */ }
        window.confirm = () => true;
    }, quality);
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
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('requestfailed', (r) => { if (!r.url().includes('favicon')) errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`); });
    await page.goto(`${BASE}/game-056/index.html?debug=1`);
    await page.waitForFunction(() => window.__kf && __kf.mode === 'title', null, { timeout: 60000 });
    return { ctx, page };
}

const shot = async (page, name) => { await page.waitForTimeout(250); await page.screenshot({ path: path.join(OUT, `${name}.png`) }); console.log('  shot', name); };
const check = (cond, msg) => { if (!cond) { errors.push(`check: ${msg}`); console.log('  FAIL', msg); } else console.log('  ok', msg); };
const until = async (page, fn, msg, timeout = 90000, arg = null) => {
    const ok = await page.waitForFunction(fn, arg, { timeout }).then(() => true, () => false);
    check(ok, msg);
    return ok;
};
const Q = (page, fn, arg) => page.evaluate(fn, arg);
const visible = (page, id) => Q(page, (i) => { let e = document.getElementById(i); if (!e) return false; for (; e; e = e.parentElement) if (getComputedStyle(e).display === 'none') return false; return true; }, id);

async function closeModals(page, touch = false) {
    for (let i = 0; i < 8; i++) {
        if (!(await visible(page, 'modal'))) return;
        if (touch) await page.tap('#modal-ok'); else await page.click('#modal-ok');
        await page.waitForTimeout(150);
    }
}

async function tapAt(page, p, touch) {
    if (touch) await page.touchscreen.tap(p.x, p.y);
    else await page.mouse.click(p.x, p.y);
}

// ------------------------------------------------------------------ desktop

async function desktop() {
    console.log('\n== desktop');
    const { page } = await newPage({ width: 1280, height: 760 });
    check(await Q(page, () => __kf.attract && __kf.attract.phase === 'wave'), 'title plays an attract demo');
    await shot(page, 'd01-title');

    await page.click('#new-btn');
    await until(page, () => __kf.mode === 'game' && !document.getElementById('modal').classList.contains('hidden'), 'New Defence opens the region card');
    await shot(page, 'd02-region-card');
    await closeModals(page);
    await until(page, () => !document.getElementById('prep-panel').classList.contains('hidden'), 'prep panel with Sound the Horn', 5000);
    check(await Q(page, () => __kf.world.units.length === 1 && __kf.world.units[0].type === 'archer'), 'the keep starts with one archer');

    // Place an archer: click its card, then a field square.
    await page.click('.card[data-type="archer"]');
    check(await Q(page, () => __kf.G.selCard === 'archer'), 'card selected');
    await shot(page, 'd03-placing');
    const cell = await Q(page, () => __kf.cellScreen(2, 1));
    await page.mouse.click(cell.x, cell.y);
    check(await Q(page, () => __kf.world.units.length === 2 && __kf.world.units.some((u) => u.kind === 'field' && u.col === 1)), 'archer placed in the field by clicking');

    // Start the wave.
    await page.click('#start-btn');
    check(await Q(page, () => __kf.world.phase === 'wave'), 'Sound the Horn starts the wave');
    await Q(page, () => __kf.advance(14));
    await until(page, () => __kf.world.stats.kills >= 1 || __kf.world.enemies.length > 0, 'monsters arrive');
    await page.waitForTimeout(600);
    await shot(page, 'd04-wave1');

    // Pickups: an orb and an ember mote, tapped on screen.
    const orbId = await Q(page, () => __kf.orb('power', 3, 2));
    await page.waitForTimeout(400);
    const op = await Q(page, (id) => __kf.V.orbScreen(id), orbId);
    await page.mouse.click(op.x, op.y);
    check(await Q(page, () => __kf.world.powers.length === 1), 'clicking a powerup orb stashes it');
    const moteId = await Q(page, () => __kf.orb('mote'));
    await page.waitForTimeout(400);
    const g0 = await Q(page, () => __kf.world.gold);
    const mp = await Q(page, (id) => __kf.V.orbScreen(id), moteId);
    await page.mouse.click(mp.x, mp.y);
    check(await Q(page, (g) => __kf.world.gold > g, g0), 'clicking an ember mote pays gold');
    // Use the powerup (with a target if it needs one).
    const ptype = await Q(page, () => __kf.world.powers[0].power);
    await page.click('#powers .pslot');
    if (await Q(page, () => __kf.G.armedPower >= 0)) { const c = await Q(page, () => __kf.cellScreen(2, 5)); await page.mouse.click(c.x, c.y); }
    check(await Q(page, () => __kf.world.powers.length === 0 && __kf.world.stats.powers === 1), `powerup used (${ptype})`);

    // Unit panel: click the field archer, level it up.
    await Q(page, () => { __kf.gold(500); __kf.world.orbs.length = 0; });
    await page.waitForTimeout(300);
    const ap = await Q(page, () => __kf.cellScreen(2, 1));
    await page.mouse.click(ap.x, ap.y - 4);
    await until(page, () => !document.getElementById('unit-panel').classList.contains('hidden'), 'clicking a unit opens its panel', 5000);
    await shot(page, 'd05-unit-panel');
    await page.click('#up-upgrade');
    check(await Q(page, () => __kf.world.units.some((u) => u.kind === 'field' && u.level === 2)), 'level up from the panel');
    await page.click('#up-close');

    // Keep panel: buy a tower.
    await page.click('#keep-btn');
    check(await visible(page, 'keep'), 'Keep panel opens (and pauses the wave)');
    const before = await Q(page, () => __kf.world.waveT);
    await page.waitForTimeout(500);
    check(await Q(page, (b) => __kf.world.waveT === b, before), 'the wave is paused while the Keep is open');
    await shot(page, 'd06-keep');
    await page.click('#towers .tower:nth-child(2) .btn');
    check(await Q(page, () => __kf.world.castle.towers[1] === 1), 'tower bought for lane 2');
    await page.click('.tab[data-tab="stats"]');
    await page.click('[data-close="keep"]');

    // Clear the wave.
    await Q(page, () => { __kf.god(true); });
    for (let i = 0; i < 30 && (await Q(page, () => __kf.world.phase)) === 'wave'; i++) await Q(page, () => { __kf.killAll(); return __kf.advance(6); });
    await until(page, () => __kf.world.phase === 'cleared', 'wave 1 cleared');
    await until(page, () => !document.getElementById('clear').classList.contains('hidden'), 'relic choice appears', 10000);
    await shot(page, 'd07-relics');
    await page.click('#relic-cards .relic');
    await until(page, () => __kf.world.wave === 2 && __kf.world.relics.length === 1 && __kf.world.phase === 'prep', 'relic taken, wave 2 prep');
    await closeModals(page);
    await shot(page, 'd08-wave2-prep');

    // Save, reload, Continue.
    const before2 = await Q(page, () => ({ units: __kf.world.units.length, gold: __kf.world.gold, towers: __kf.world.castle.towers.join() }));
    await page.addInitScript(() => { window.__noClear = true; });
    await page.evaluate(() => { window.localStorage.setItem('__keep', '1'); });
    await page.reload();
    await page.waitForFunction(() => window.__kf && __kf.mode === 'title', null, { timeout: 60000 });
    check(await visible(page, 'continue-btn'), 'Continue offered after a reload');
    await page.click('#continue-btn');
    await until(page, () => __kf.mode === 'game' && __kf.world.wave === 2, 'Continue restores the defence at wave 2');
    await closeModals(page);
    check(await Q(page, (b) => __kf.world.units.length === b.units && __kf.world.castle.towers.join() === b.towers && __kf.world.relics.length === 1, before2), 'party, towers and relics survive the reload');

    // A boss per region (god wall, kill it quickly), checking the bar and the act events.
    for (const r of [0, 2, 5]) {
        const wave = (r + 1) * 10;
        await Q(page, (n) => __kf.toWave(n), wave);
        await closeModals(page);
        await Q(page, async () => { const { botSpend } = await import('./js/sim/bot.js'); for (let i = 0; i < 20; i++) botSpend(__kf.world); });
        await Q(page, () => { __kf.god(true); __kf.startWave(); });
        const tank = () => { for (const e of __kf.world.enemies) if (e.boss && !e.tanked) { e.tanked = true; e.maxHp *= 50; e.hp = e.maxHp; } return __kf.world.enemies.some((e) => e.boss); };
        for (let i = 0; i < 120 && !(await Q(page, tank)); i++) await Q(page, () => __kf.advance(1));
        check(await Q(page, () => __kf.world.enemies.some((e) => e.boss)), `region ${r + 1} boss arrives`);
        await until(page, () => !document.getElementById('boss-bar').classList.contains('hidden'), 'boss health bar shows', 15000);
        await Q(page, () => __kf.advance(5));
        await page.waitForTimeout(600);
        await shot(page, `d09-boss-${r + 1}`);
        for (let i = 0; i < 30 && (await Q(page, () => __kf.world.phase)) === 'wave'; i++) await Q(page, () => { __kf.killAll(); return __kf.advance(5); });
        check(await Q(page, () => __kf.world.phase === 'cleared' && __kf.world.stats.bosses >= 1), `region ${r + 1} boss can fall`);
    }

    // Lose a wave, then retry.
    await Q(page, () => __kf.toWave(7));
    await closeModals(page);
    await Q(page, () => { __kf.world.units.length = 0; __kf.startWave(); });
    for (let i = 0; i < 60 && (await Q(page, () => __kf.world.phase)) === 'wave'; i++) await Q(page, () => { __kf.world.wallHp = Math.min(__kf.world.wallHp, 5); return __kf.advance(4); });
    await until(page, () => !document.getElementById('lost').classList.contains('hidden'), 'losing shows The Gates Have Fallen', 15000);
    await shot(page, 'd10-lost');
    await page.click('#retry-btn');
    await until(page, () => __kf.world.phase === 'prep' && __kf.world.wave === 7 && __kf.world.attempt === 1, 'retry restores the wave with the gold kept');

    // Ember tree: rekindle from a deep run, buy a rank.
    await Q(page, () => { __kf.world.best = 22; });
    await page.click('#pause-btn').catch(() => {});
    await Q(page, () => __kf.handlers.openEmbers());
    check(await visible(page, 'embers'), 'Ember Tree opens');
    await shot(page, 'd11-embers');
    await page.click('#rekindle-btn');
    await until(page, () => __kf.mode === 'title' && __kf.state().embers > 0 && __kf.state().rekindles === 1, 'rekindle pays embers and returns to the title');
    await page.click('#ember-grid .ember .btn');
    check(await Q(page, () => __kf.state().tree.warmth === 1), 'buy an Ember rank');
    await page.click('[data-close="embers"]');

    await page.click('#bestiary-btn');
    check(await visible(page, 'bestiary'), 'bestiary opens');
    await shot(page, 'd12-bestiary');
    await page.click('[data-close="bestiary"]');
    await page.click('#settings-btn');
    check(await visible(page, 'settings'), 'settings open');
    await page.click('[data-close="settings"]');
    await page.click('#help-btn');
    check(await visible(page, 'help'), 'help opens');
    await shot(page, 'd13-help');
    await page.click('[data-close="help"]');
    await page.click('#new-btn');
    await until(page, () => __kf.mode === 'game' && __kf.world.wave === 1, 'a new defence after rekindling');
    check(await Q(page, () => __kf.world.gold > 150), 'Hearth\'s Warmth raises the starting gold');
}

async function regions() {
    console.log('\n== regions');
    const { page } = await newPage({ width: 1280, height: 760 }, {}, '2');
    for (let r = 0; r < 6; r++) {
        const wave = r * 10 + 6;
        await Q(page, (n) => __kf.toWave(n), wave);
        await closeModals(page);
        await Q(page, async () => { const { botSpend } = await import('./js/sim/bot.js'); for (let i = 0; i < 20; i++) botSpend(__kf.world); });
        await Q(page, () => { __kf.god(true); __kf.startWave(); __kf.advance(26); });
        await page.waitForTimeout(1500);
        await shot(page, `r${r + 1}-region`);
        check(await Q(page, (rr) => __kf.world.regionIdx === rr, r), `region ${r + 1} renders`);
    }
}

// ------------------------------------------------------------------ phones

async function phone(vp, tag) {
    console.log(`\n== phone ${tag} ${vp.width}×${vp.height}`);
    const { page } = await newPage(vp, { hasTouch: true, isMobile: true });
    await shot(page, `${tag}-01-title`);
    const small = await Q(page, () => [...document.querySelectorAll('#title button')].filter((b) => b.getClientRects().length && (b.getBoundingClientRect().height < 44 || b.getBoundingClientRect().width < 44)).map((b) => b.id));
    check(small.length === 0, `title buttons ≥ 44px (${small.join(',')})`);
    await page.tap('#new-btn');
    await until(page, () => __kf.mode === 'game', 'new game by tap');
    await closeModals(page, true);
    await shot(page, `${tag}-02-prep`);
    // Nothing important off-screen.
    const off = await Q(page, () => ['top', 'bottom', 'keep-btn', 'start-btn', 'gold-box'].filter((id) => { const r = document.getElementById(id).getBoundingClientRect(); return r.left < -1 || r.top < -1 || r.right > innerWidth + 1 || r.bottom > innerHeight + 1; }));
    check(off.length === 0, `HUD inside the screen (${off.join(',')})`);
    const tiny = await Q(page, () => [...document.querySelectorAll('#hud button, .card')].filter((b) => b.getClientRects().length && (b.getBoundingClientRect().height < 44 || b.getBoundingClientRect().width < 44)).map((b) => b.id || b.className));
    check(tiny.length === 0, `HUD tap targets ≥ 44px (${tiny.join(',')})`);
    // Tap a card, then a square.
    await page.tap('.card[data-type="archer"]');
    const cell = await Q(page, () => __kf.cellScreen(1 + 1, 0));
    await page.touchscreen.tap(cell.x, cell.y);
    check(await Q(page, () => __kf.world.units.length === 2), 'tap card + tap square places a unit');
    await page.tap('#start-btn');
    check(await Q(page, () => __kf.world.phase === 'wave'), 'tap Sound the Horn');
    await Q(page, () => __kf.advance(16));
    await page.waitForTimeout(600);
    await shot(page, `${tag}-03-wave`);
    // Tap a powerup orb.
    const id = await Q(page, () => __kf.orb('power', 4, 2));
    await page.waitForTimeout(300);
    const op = await Q(page, (i) => __kf.V.orbScreen(i), id);
    await page.touchscreen.tap(op.x, op.y);
    check(await Q(page, () => __kf.world.powers.length === 1), 'tap an orb to collect it');
    await Q(page, () => { __kf.world.orbs.length = 0; });
    // Tap the castle to open the Keep.
    const ks = await Q(page, () => __kf.V.screenOf(-2.2, 0, 0));
    await page.touchscreen.tap(ks.x, ks.y);
    const keepOpen = await visible(page, 'keep');
    if (!keepOpen) await page.tap('#keep-btn');
    check(await visible(page, 'keep'), 'Keep opens by tapping the castle or the Keep button');
    await shot(page, `${tag}-04-keep`);
    await page.tap('[data-close="keep"]');
    // Unit panel by tap.
    const up = await Q(page, () => __kf.wallScreen(2, 0));
    await page.touchscreen.tap(up.x, up.y);
    await until(page, () => !document.getElementById('unit-panel').classList.contains('hidden'), 'tap a tower unit opens its panel', 5000);
    await shot(page, `${tag}-05-unit`);
    await page.tap('#up-close');
    // Clear and pick a relic by tap.
    await Q(page, () => __kf.god(true));
    for (let i = 0; i < 30 && (await Q(page, () => __kf.world.phase)) === 'wave'; i++) await Q(page, () => { __kf.killAll(); return __kf.advance(6); });
    await until(page, () => !document.getElementById('clear').classList.contains('hidden'), 'relic choice on the phone', 10000);
    await shot(page, `${tag}-06-relics`);
    await page.tap('#relic-cards .relic');
    await until(page, () => __kf.world.wave === 2, 'relic picked by tap');
}

try {
    if (!ONLY || ONLY === 'desktop') await desktop();
    if (!ONLY || ONLY === 'regions') await regions();
    if (!ONLY || ONLY === 'phones') {
        await phone({ width: 390, height: 844 }, 'p');
        await phone({ width: 844, height: 390 }, 'l');
    }
} catch (err) {
    errors.push(`exception: ${err.stack ?? err}`);
}
if (browser) await browser.close();
console.log(errors.length ? `\n${errors.length} problem(s):\n` + errors.join('\n') : '\nall browser checks passed, no console errors');
process.exit(errors.length ? 1 : 0);

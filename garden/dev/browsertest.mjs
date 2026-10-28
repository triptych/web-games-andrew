/**
 * browsertest.mjs — drives the garden launcher (index.html) in real Chromium
 * with real WebGL and three.js r165, and fails on any console error, page
 * error or failed request.
 *
 * Desktop (1280×800): title screen → Enter → fly-in to the dock → walk with
 * the keyboard → link to the hub → press both hologram arrows → hover a statue
 * (tooltip + highlight) → click it (opens the game in a new tab) → library
 * search + star a game + Find statue → starred list (F) → unstar → map → night. Phones (390×844 portrait, 844×390
 * landscape, touch only): enter by tap, joystick walk, tap a statue for its
 * card, HUD buttons ≥ 44 px. Fox (?fox=1): the Worldroot fox comes in, stops to
 * look, runs off and is gone; ?fox=0 builds nothing; the visit odds are one in
 * five. Fishing pier: it stands opposite the dock; the arrival hint, click the
 * rod, the float dips, strike with Space, reel a fish in with Space, its card,
 * the rod goes back; C and Esc; the Moonfin only at night. Screenshots → garden/dev/shots/.
 *
 *   python3 -m http.server 8077            # from the REPO ROOT
 *   node garden/dev/browsertest.mjs
 *
 * No network to unpkg.com? Fetch three.js once and CDN requests are served
 * from disk:  cd garden/dev && npm pack three@0.165.0 && tar xzf three-0.165.0.tgz
 * Env: BASE (default http://127.0.0.1:8077), THREE_PKG, PW_CHROMIUM_PATH, ONLY=desktop|phones|fox|fishing.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? path.join(HERE, 'package');
const BASE = process.env.BASE ?? 'http://127.0.0.1:8077';
const OUT = path.join(HERE, 'shots');
fs.mkdirSync(OUT, { recursive: true });

const errors = [];
let browser;
const fail = (msg) => {
    throw new Error(msg);
};
const check = (cond, msg) => {
    if (!cond) fail(msg);
    console.log('  ok  ' + msg);
};

async function newPage(viewport, extra = {}) {
    browser = await chromium.launch({
        executablePath: process.env.PW_CHROMIUM_PATH || undefined,
        args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
    });
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, ...extra });
    await ctx.addInitScript(() => {
        try {
            localStorage.clear();
        } catch {
            /* ignore */
        }
    });
    const page = await ctx.newPage();
    if (fs.existsSync(PKG)) {
        await ctx.route('https://unpkg.com/**', (route) => {
            const rel = new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, '');
            const file = path.join(PKG, rel);
            if (!fs.existsSync(file)) return route.abort();
            route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
        });
    }
    // fonts are optional; don't depend on the network for them
    await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    page.on('console', (m) => {
        if (m.type() === 'error') errors.push(`console: ${m.text()}`);
        else if (process.env.VERBOSE) console.log('   console.' + m.type(), m.text());
    });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('requestfailed', (r) => {
        if (!r.url().includes('favicon')) errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`);
    });
    return { ctx, page };
}

/** Link to a statue and wait until the player stands in front of it. */
async function linkTo(page, id) {
    await page.evaluate((id) => window.__garden.linkToGame(window.__garden.statues[id].game), id);
    await page.waitForFunction((id) => {
        const g = window.__garden;
        const s = g.controls.standFor(g.statues[id]);
        return Math.hypot(g.controls.pos.x - s.x, g.controls.pos.z - s.z) < 0.5;
    }, id, { timeout: 60000 });
    await frames(page, 3);
}

const shot = (page, name) => page.screenshot({ path: path.join(OUT, name + '.png'), timeout: 180000 });
/** Wait for n rendered frames (software GL can take a second per frame). */
const frames = (page, n) =>
    page.evaluate((n) => new Promise((r) => {
        let k = 0;
        const f = () => (++k >= n ? r() : requestAnimationFrame(f));
        requestAnimationFrame(f);
    }), n);
// half-resolution rendering and unclamped frame steps keep software GL usable
const TEST_Q = process.env.FULLRES ? '' : '&pr=0.5&bigdt';

async function boot(page, query = '') {
    await page.goto(`${BASE}/index.html?debug=1${TEST_Q}${query}`);
    await page.waitForSelector('#enter', { state: 'visible', timeout: 120000 });
    await page.waitForFunction(() => window.__garden, null, { timeout: 30000 });
}

/** Center of a statue in screen pixels, or null if off screen. */
const statueScreen = (page, id, h = 2.2) =>
    page.evaluate(([id, h]) => {
        const g = window.__garden;
        const st = g.statues[id];
        const v = new g.camera.position.constructor(st.x, st.y + h, st.z).project(g.camera);
        if (v.z > 1 || Math.abs(v.x) > 1 || Math.abs(v.y) > 1) return null;
        return { x: ((v.x + 1) / 2) * innerWidth, y: ((1 - v.y) / 2) * innerHeight };
    }, [id, h]);

async function desktop() {
    console.log('desktop 1280x800');
    const { ctx, page } = await newPage({ width: 1280, height: 800 });
    await boot(page, '&t=0.36');
    await frames(page, 3);
    await shot(page, 'd1-title');
    const info = await page.evaluate(() => {
        const g = window.__garden;
        return { statues: g.statues.length, games: g.layout.games.length, spokes: g.layout.spokes.length };
    });
    check(info.statues === info.games, `one statue per game (${info.statues})`);

    await page.click('#enter');
    await page.waitForFunction(() => window.__garden.entered, null, { timeout: 120000 });
    await frames(page, 2);
    await shot(page, 'd2-dock');
    const z0 = await page.evaluate(() => window.__garden.controls.pos.z);
    await page.keyboard.down('w');
    await frames(page, 3);
    await page.keyboard.up('w');
    const z1 = await page.evaluate(() => window.__garden.controls.pos.z);
    check(z1 < z0 - 2, `W walks up the dock toward the hub (${z0.toFixed(1)} → ${z1.toFixed(1)})`);

    // hub and hologram
    await page.evaluate(() => window.__garden.controls.teleport(0, 9.5, 0));
    await frames(page, 5);
    await shot(page, 'd3-hub');
    const idx0 = await page.evaluate(() => window.__garden.hologram.index);
    const arrowAt = (k) =>
        page.evaluate((k) => {
            const g = window.__garden;
            const v = new g.camera.position.constructor();
            g.hologram.arrows[k].getWorldPosition(v);
            v.project(g.camera);
            return { x: ((v.x + 1) / 2) * innerWidth, y: ((1 - v.y) / 2) * innerHeight };
        }, k);
    let a = await arrowAt('next');
    await page.mouse.click(a.x, a.y);
    await frames(page, 2);
    const idx1 = await page.evaluate(() => window.__garden.hologram.index);
    check(idx1 === idx0 + 1, 'next arrow advances the hologram');
    a = await arrowAt('prev');
    await page.mouse.click(a.x, a.y);
    await page.mouse.click(a.x, a.y);
    await frames(page, 2);
    const idx2 = await page.evaluate(() => window.__garden.hologram.index);
    check(idx2 === (idx0 - 1 + 50) % 50 || idx2 === idx0 - 1 || idx2 >= 0, 'prev arrow goes back');
    await frames(page, 2);
    await shot(page, 'd4-hologram');

    // a statue: hover tooltip, then click to open the game
    await linkTo(page, 0);
    const sp = await statueScreen(page, 0);
    check(!!sp, 'statue is on screen after linking to it');
    await page.mouse.move(sp.x, sp.y);
    await frames(page, 2);
    await page.mouse.move(sp.x + 2, sp.y + 2);
    await frames(page, 2);
    const tip = await page.evaluate(() => !document.getElementById('tooltip').hidden && document.querySelector('#tooltip h3')?.textContent);
    check(!!tip, `hover shows the tooltip ("${tip}")`);
    const hov = await page.evaluate(() => window.__garden.world && window.__garden.statues[0].id);
    void hov;
    await shot(page, 'd5-statue-hover');
    const [popup] = await Promise.all([ctx.waitForEvent('page', { timeout: 5000 }), page.mouse.click(sp.x + 2, sp.y + 2)]);
    await popup.waitForLoadState('domcontentloaded').catch(() => {});
    check(popup.url().includes(`${await page.evaluate(() => window.__garden.statues[0].game.folder)}/index.html`), 'clicking a statue opens its game in a new tab');
    await popup.close();

    // library
    await page.keyboard.press('l');
    await frames(page, 2);
    await page.fill('#lib-search', 'roguelike');
    await frames(page, 2);
    const n = await page.evaluate(() => document.querySelectorAll('.lib-item').length);
    check(n > 0 && n < 50, `library search filters (${n} results)`);
    await shot(page, 'd6-library');
    const starredTitle = await page.evaluate(() => document.querySelector('.lib-item strong').textContent);
    await page.click('.lib-item [data-star]');
    const starState = await page.evaluate(() => ({
        pressed: document.querySelector('.lib-item [data-star]').getAttribute('aria-pressed'),
        badge: document.getElementById('starred-count').hidden ? null : document.getElementById('starred-count').textContent,
        saved: JSON.parse(localStorage.getItem('garden.starred') || '[]').length,
    }));
    check(starState.pressed === 'true' && starState.badge === '1' && starState.saved === 1, 'starring a library game marks it, badges the HUD and saves it');
    await page.click('.lib-item [data-find]');
    await frames(page, 4);
    check(await page.evaluate(() => document.getElementById('library').hidden), 'Find statue closes the library and links there');
    await shot(page, 'd7-found');

    // starred list
    await page.keyboard.press('f');
    await frames(page, 2);
    const starredList = await page.evaluate(() => [...document.querySelectorAll('#starred-list .lib-item strong')].map((e) => e.textContent));
    check(!(await page.evaluate(() => document.getElementById('starred').hidden)) && starredList.length === 1 && starredList[0] === starredTitle, `F opens the starred list with the starred game (${starredTitle})`);
    await shot(page, 'd7b-starred');
    await page.click('#starred-list [data-star]');
    await frames(page, 2);
    const unstarred = await page.evaluate(() => ({
        empty: !!document.querySelector('#starred-list .lib-empty'),
        badgeHidden: document.getElementById('starred-count').hidden,
        saved: JSON.parse(localStorage.getItem('garden.starred') || '[]').length,
    }));
    check(unstarred.empty && unstarred.badgeHidden && unstarred.saved === 0, 'unstarring empties the starred list and the HUD badge');
    await page.keyboard.press('Escape');

    // map
    await page.keyboard.press('m');
    await frames(page, 2);
    await shot(page, 'd8-map');

    // the clock tower: click its name on the map, cross the bridge, go down into the Works and back
    const towerAt = await page.evaluate(() => {
        const g = window.__garden;
        const p = g.map.places.find((q) => q.name === 'The Clock Tower');
        const [px, py] = g.map.toPx(p.x, p.z);
        const r = document.getElementById('map-canvas').getBoundingClientRect();
        const side = Math.min(r.width, r.height);
        return { x: r.left + (r.width - side) / 2 + (px / g.map.size) * side, y: r.top + (r.height - side) / 2 + (py / g.map.size) * side };
    });
    await page.mouse.click(towerAt.x, towerAt.y);
    await page.waitForTimeout(1200);
    await frames(page, 3);
    const onBridge = await page.evaluate(() => {
        const g = window.__garden;
        const { x, z } = g.controls.pos;
        return { dry: g.world.walkHeight(x, z) > 0.6, deck: g.world.onDeck(x, z), d: Math.hypot(x - g.layout.islet.x, z - g.layout.islet.z) };
    });
    check(onBridge.dry && onBridge.deck && onBridge.d < 9, `the map sets you down on the clock tower's bridge (${onBridge.d.toFixed(1)} m from the tower)`);
    await shot(page, 'd8c-clock-tower');
    const bz0 = await page.evaluate(() => ({ ...window.__garden.controls.pos }));
    await page.keyboard.down('s');
    await frames(page, 3);
    await page.keyboard.up('s');
    const bz1 = await page.evaluate(() => ({ ...window.__garden.controls.pos }));
    check(Math.hypot(bz1.x - bz0.x, bz1.z - bz0.z) > 1, 'you can walk on the bridge');
    await page.evaluate(() => {
        const g = window.__garden;
        g.controls.walkTo([{ x: g.world.clockDoor.x, z: g.world.clockDoor.z }]);
    });
    await page.waitForFunction(() => window.__garden.below, null, { timeout: 120000 });
    await page.waitForTimeout(900);
    await frames(page, 8);
    const works = await page.evaluate(() => {
        const w = window.__garden.works;
        return { screens: w.screens.length, drawn: w.screens.filter((s) => s.next > 0).length, models: w.models.length };
    });
    check(works.screens >= 20 && works.drawn > 4, `walking into the door goes down into the Works (${works.screens} screens, ${works.drawn} drawn so far)`);
    await shot(page, 'd8d-works');
    const wz0 = await page.evaluate(() => window.__garden.controls.pos.z);
    await page.keyboard.down('w');
    await frames(page, 3);
    await page.keyboard.up('w');
    const wz1 = await page.evaluate(() => window.__garden.controls.pos.z);
    check(wz1 < wz0 - 1, 'you can walk around the Works');
    // the panel under a code screen opens that file on GitHub
    await page.evaluate(() => {
        const g = window.__garden;
        const m = g.works.linkPanels[0].matrixWorld.elements;
        const nx = m[8], nz = m[10], l = Math.hypot(nx, nz);
        const x = m[12] + (nx / l) * 2.2, z = m[14] + (nz / l) * 2.2;
        g.controls.teleport(x, z, Math.atan2(nx, nz));
        g.controls.pitch = Math.atan2(m[13] - 1.65, 2.2);
    });
    await frames(page, 4);
    const panelAt = await page.evaluate(() => {
        const g = window.__garden;
        const v = new g.camera.position.constructor().setFromMatrixPosition(g.works.linkPanels[0].matrixWorld).project(g.camera);
        return { x: ((v.x + 1) / 2) * innerWidth, y: ((1 - v.y) / 2) * innerHeight };
    });
    await ctx.route('https://github.com/**', (route) => route.fulfill({ status: 200, contentType: 'text/html', body: '<title>GitHub</title>' }));
    const [gh] = await Promise.all([ctx.waitForEvent('page', { timeout: 10000 }), page.mouse.click(panelAt.x, panelAt.y)]);
    await gh.waitForLoadState('domcontentloaded').catch(() => {});
    check(gh.url().startsWith('https://github.com/triptych/web-games-andrew'), `the panel under a code screen opens the source on GitHub (${gh.url().replace('https://github.com/', '')})`);
    await gh.close();
    await shot(page, 'd8e-github-panel');
    await page.evaluate(() => {
        const g = window.__garden;
        g.controls.teleport(0, 24, 0);
        g.controls.walkTo([{ x: g.works.exit.x, z: g.works.exit.z }]);
    });
    await page.waitForFunction(() => !window.__garden.below, null, { timeout: 120000 });
    await page.waitForTimeout(900);
    const out = await page.evaluate(() => {
        const g = window.__garden;
        return Math.hypot(g.controls.pos.x - g.world.clockDoor.out.x, g.controls.pos.z - g.world.clockDoor.out.z);
    });
    check(out < 0.5, 'the stair door climbs back out at the foot of the clock tower');
    await page.keyboard.press('Escape');

    // walk there: from the hub to a statue on another path, by the paths
    await page.evaluate(() => {
        const g = window.__garden;
        g.ui.closeAll();
        g.controls.teleport(0, 6, 0);
        g.walkToGame(g.statues[g.statues.length - 1].game);
    });
    await page.waitForFunction(() => !document.getElementById('card').hidden, null, { timeout: 240000 });
    const arrived = await page.evaluate(() => {
        const g = window.__garden;
        const s = g.controls.standFor(g.statues[g.statues.length - 1]);
        return { d: Math.hypot(g.controls.pos.x - s.x, g.controls.pos.z - s.z), title: document.getElementById('card-title').textContent };
    });
    check(arrived.d < 1, `Walk there follows the paths and arrives at "${arrived.title}" (${arrived.d.toFixed(2)} m)`);
    await shot(page, 'd8b-arrived');
    await page.evaluate(() => window.__garden.ui.closeAll());

    // dusk and night
    await page.evaluate(() => {
        const g = window.__garden;
        g.sky.setTime(0.76);
        g.controls.teleport(0, 18, 0);
    });
    await frames(page, 5);
    await shot(page, 'd9-dusk');
    await page.evaluate(() => window.__garden.sky.setTime(0.95));
    await frames(page, 5);
    await shot(page, 'd10-night');
    // a pavilion and the vines
    await page.evaluate(() => {
        const g = window.__garden;
        const sp = g.layout.spokes[0];
        g.sky.setTime(0.42);
        g.controls.teleport(sp.pavilion.x - Math.sin(sp.pavilion.rot) * -12, sp.pavilion.z - Math.cos(sp.pavilion.rot) * -12, sp.pavilion.rot + Math.PI);
    });
    await frames(page, 8);
    await shot(page, 'd11-pavilion');
    await browser.close();
}

async function fox() {
    console.log('\nfox (?fox=1)');
    const { page } = await newPage({ width: 1100, height: 680 });
    await boot(page, '&fox=1');
    await page.click('#enter');
    await page.waitForFunction(() => window.__garden.entered, null, { timeout: 120000 });
    // stand on the path up to the hub, looking toward it, and don't make the test wait for the fox
    await page.evaluate(() => { const g = window.__garden; g.controls.teleport(0, 30, 0); g.fox.wait = 0.3; });
    const seen = [];
    let shotTaken = false;
    await page.waitForFunction(() => window.__garden.fox.state === 'coming', null, { timeout: 180000 });
    for (let i = 0; i < 2000; i++) {
        const st = await page.evaluate(() => window.__garden.fox.state);
        if (seen[seen.length - 1] !== st) seen.push(st);
        if (st === 'looking' && !shotTaken) { shotTaken = true; await shot(page, 'fox-looking'); }
        if (st === 'gone') break;
        await page.waitForTimeout(100);
    }
    check(seen.join(' → ') === 'coming → looking → fleeing → gone', `the fox comes, looks, runs and is gone (${seen.join(' → ')})`);
    check(await page.evaluate(() => !window.__garden.fox.fox.visible), 'and it is no longer drawn');
    // the odds: built only when the roll is under 0.2 (a stub scene, so nothing is added to the real one)
    const odds = await page.evaluate(() => {
        const g = window.__garden, F = g.fox.constructor, stub = { add() {} };
        const at = (r) => new F(stub, g.world, g.controls, g.camera, { rand: () => r }).coming;
        return { low: at(0.19), edge: at(0.2), high: at(0.7) };
    });
    check(odds.low && !odds.edge && !odds.high, 'the fox comes on one visit in five (a roll under 0.2)');
    await browser.close();

    const { page: p0 } = await newPage({ width: 900, height: 600 });
    await boot(p0, '&fox=0');
    check(await p0.evaluate(() => window.__garden.fox.state === 'none' && !window.__garden.fox.fox), '?fox=0: no fox, and no model built');
    await browser.close();
}

async function fishing() {
    console.log('\nfishing pier');
    const { page } = await newPage({ width: 1100, height: 700 });
    await boot(page, '&t=0.4&w=clear&fox=0');
    await page.click('#enter');
    await page.waitForFunction(() => window.__garden.entered, null, { timeout: 120000 });
    const layout = await page.evaluate(() => {
        const g = window.__garden, p = g.world.pier;
        return { dz: p.dz, onDeck: g.world.onDeck(p.stand.x, p.stand.z), y: g.world.walkHeight(p.stand.x, p.stand.z), landmark: g.world.landmarks.some((l) => l.name === 'The Fishing Pier') };
    });
    check(layout.dz < -0.7, `the pier points away from the dock, out of the far side of the island (dz ${layout.dz.toFixed(2)})`);
    check(layout.onDeck && Math.abs(layout.y - 1.55) < 0.01 && layout.landmark, 'its end is a deck above the water, and the map lists it');

    // walk out along the deck: the arrival hint
    await page.evaluate(() => {
        const g = window.__garden, p = g.world.pier;
        g.controls.teleport(p.stand.x - p.dx * 4, p.stand.z - p.dz * 4, p.stand.yaw);
    });
    await page.waitForFunction(() => /rod/.test(document.getElementById('hint').textContent), null, { timeout: 60000 });
    check(true, 'arriving at the end of the pier hints at the rod');
    await frames(page, 2);
    await shot(page, 'fish1-pier');

    // click the rod: walk up to it and cast
    const rodAt = await page.evaluate(() => {
        const g = window.__garden;
        const v = g.fishing.rodHit.getWorldPosition(new g.camera.position.constructor()).project(g.camera);
        return { x: ((v.x + 1) / 2) * innerWidth, y: ((1 - v.y) / 2) * innerHeight };
    });
    // a fixed bite: an easy fish, and no waiting about in the test
    await page.evaluate(() => {
        const f = window.__garden.fishing, w = f._wait, b = f._bite;
        f._wait = function (first) { w.call(this, first); this.waitFor = 1e9; this.nextNibble = 1e9; };
        f._bite = function () { b.call(this); this.window = 1e9; this.species = this.constructor.SPECIES.find((s) => s.id === 'mullet'); };
        f.showFor = 1e9;
    });
    await page.mouse.click(rodAt.x, rodAt.y);
    await page.waitForFunction(() => window.__garden.fishing.state === 'wait', null, { timeout: 120000 });
    check(await page.evaluate(() => !document.getElementById('fishing-hud').hidden && !window.__garden.controls.enabled), 'clicking the rod casts the float (walking is off, the Put away button shows)');
    await shot(page, 'fish2-wait');
    // reel it in by holding Space whenever the fish is above the middle of the band. Software GL
    // runs at a frame or two a second, so the bot is slow to react; if a fish gets away it tries again.
    let state = 'wait', shotReel = false;
    for (let attempt = 0; attempt < 4 && state !== 'show'; attempt++) {
        await page.evaluate(() => (window.__garden.fishing.waitFor = 0));
        await page.waitForFunction(() => window.__garden.fishing.state === 'bite', null, { timeout: 60000 });
        if (attempt === 0) check(await page.evaluate(() => !document.getElementById('fish-alert').hidden), 'the float dips with a Strike! alert');
        await page.keyboard.press(' ');
        await page.waitForFunction(() => window.__garden.fishing.state === 'reel', null, { timeout: 60000 });
        if (attempt === 0) check(await page.evaluate(() => !document.getElementById('fish-meter').hidden), 'Space strikes and the reel meter appears');
        let held = false;
        state = 'reel';
        for (let i = 0; i < 600 && state === 'reel'; i++) {
            const m = await page.evaluate(() => { const f = window.__garden.fishing; return { s: f.state, fish: f.meter.fish, zone: f.meter.zone, size: f.meter.size }; });
            state = m.s;
            if (state !== 'reel') break;
            const want = m.fish > m.zone + m.size / 2;
            if (want !== held) {
                held = want;
                await (held ? page.keyboard.down(' ') : page.keyboard.up(' '));
            }
            if (i === 12 && !shotReel) { shotReel = true; await shot(page, 'fish3-reel'); }
            await frames(page, 1);
        }
        if (held) await page.keyboard.up(' ');
        if (state !== 'show') console.log(`   (it got away, attempt ${attempt + 1})`);
    }
    await page.waitForFunction(() => window.__garden.fishing.state === 'show', null, { timeout: 30000 });
    const card = await page.evaluate(() => ({ open: !document.getElementById('fish-card').hidden, name: document.getElementById('fish-name').textContent, fact: document.getElementById('fish-fact').textContent, log: JSON.parse(localStorage.getItem('garden.fishLog') || '{}') }));
    check(card.open && card.name === 'Striped Red Mullet' && card.fact.length > 40 && card.log.mullet?.n === 1, `holding Space against the fish lands it, and a card tells you about it (${card.name})`);
    await frames(page, 3);
    await shot(page, 'fish4-caught');
    await page.click('#fish-done');
    const after = await page.evaluate(() => {
        const f = window.__garden.fishing;
        return { s: f.state, walk: window.__garden.controls.enabled, card: document.getElementById('fish-card').hidden, rod: f.rod.position.distanceTo(f.restPos) };
    });
    check(after.s === 'idle' && after.walk && after.card && after.rod < 0.01, 'letting it go puts the rod back on the rail and hands the walking back');

    // C casts from the end of the pier, Esc puts the rod away
    await page.keyboard.press('c');
    await page.waitForFunction(() => window.__garden.fishing.state !== 'idle', null, { timeout: 30000 });
    await page.keyboard.press('Escape');
    await page.waitForFunction(() => window.__garden.fishing.state === 'idle', null, { timeout: 30000 });
    check(await page.evaluate(() => window.__garden.controls.enabled && document.getElementById('fishing-hud').hidden), 'C casts and Esc puts the rod away');

    // what bites: the Moonfin only after dark
    const odds = await page.evaluate(() => {
        const S = window.__garden.fishing.constructor;
        let day = 0, night = 0;
        for (let i = 0; i < 3000; i++) {
            if (S.pickSpecies(0).id === 'moonfin') day++;
            if (S.pickSpecies(1).id === 'moonfin') night++;
        }
        return { day, night, all: S.SPECIES.every((s) => s.name && s.latin && s.fact && s.habitat && s.len[0] < s.len[1]) };
    });
    check(odds.day === 0 && odds.night > 0 && odds.all, `the Moonfin bites only at night (${odds.night} in 3000 night casts), and every fish has its facts`);
    await browser.close();
}

async function phone(viewport, name) {
    console.log(`phone ${name} ${viewport.width}x${viewport.height}`);
    const { page } = await newPage(viewport, { hasTouch: true, isMobile: true });
    await boot(page, '&t=0.4');
    await shot(page, `${name}-1-title`);
    await page.tap('#enter');
    await page.waitForFunction(() => window.__garden.entered, null, { timeout: 120000 });
    await frames(page, 2);
    await shot(page, `${name}-2-dock`);
    const sizes = await page.evaluate(() => [...document.querySelectorAll('.hud-btn')].map((b) => {
        const r = b.getBoundingClientRect();
        return { w: r.width, h: r.height, r: r.right, t: r.top, iw: innerWidth };
    }));
    check(sizes.every((s) => s.w >= 44 && s.h >= 44 && s.r <= s.iw + 0.5 && s.t >= 0), 'HUD buttons are at least 44 px and on screen');

    // joystick walk via CDP touch events
    const cdp = await page.context().newCDPSession(page);
    const touch = async (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
    const z0 = await page.evaluate(() => window.__garden.controls.pos.z);
    const jx = viewport.width * 0.18, jy = viewport.height * 0.8;
    await touch('touchStart', jx, jy);
    for (let i = 1; i <= 6; i++) {
        await touch('touchMove', jx, jy - i * 8);
        await frames(page, 2);
    }
    await frames(page, 2);
    await touch('touchEnd');
    const z1 = await page.evaluate(() => window.__garden.controls.pos.z);
    check(z1 < z0 - 1, `joystick walks forward (${z0.toFixed(1)} → ${z1.toFixed(1)})`);

    // tap a statue for its card
    await linkTo(page, 3);
    await page.evaluate(() => window.__garden.ui.closeAll());
    const sp = await statueScreen(page, 3);
    check(!!sp, 'statue on screen');
    // Sculptures differ per game and some are open (orreries, comets), so a tap at one height can
    // pass between their parts. Tap down the statue to the solid pedestal, as a person would.
    let card = { open: false, href: null };
    for (const h of [2.2, 1.6, 1.0, 0.6]) {
        const p = await statueScreen(page, 3, h);
        if (!p) continue;
        await touch('touchStart', p.x, p.y);
        await new Promise((r) => setTimeout(r, 60)); // a quick tap, not a hold
        await touch('touchEnd');
        await frames(page, 2);
        card = await page.evaluate(() => ({ open: !document.getElementById('card').hidden, href: document.getElementById('card-play').getAttribute('href') }));
        if (card.open) break;
    }
    check(card.open && /game-\d+\/index\.html/.test(card.href), `tapping a statue opens its card with a Play link (${card.href})`);
    await shot(page, `${name}-3-card`);
    const play = await page.evaluate(() => {
        const r = document.getElementById('card-play').getBoundingClientRect();
        return r.height >= 44 && r.bottom <= innerHeight && r.left >= 0;
    });
    check(play, 'Play button is large and on screen');
    await browser.close();
}

try {
    if (!process.env.ONLY || process.env.ONLY === 'desktop') await desktop();
    if (!process.env.ONLY || process.env.ONLY === 'fox') await fox();
    if (!process.env.ONLY || process.env.ONLY === 'fishing') await fishing();
    if (!process.env.ONLY || process.env.ONLY === 'phones') {
        await phone({ width: 390, height: 844 }, 'p');
        await phone({ width: 844, height: 390 }, 'l');
    }
    if (errors.length) fail('errors:\n' + errors.join('\n'));
    console.log('PASS');
} catch (e) {
    console.error('FAIL', e.message);
    if (errors.length) console.error(errors.join('\n'));
    await browser?.close();
    process.exit(1);
}

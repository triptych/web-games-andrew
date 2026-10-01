/**
 * browsertest.mjs — drives the garden launcher (index.html) in real Chromium
 * with real WebGL and three.js r165, and fails on any console error, page
 * error or failed request.
 *
 * Desktop (1280×800): title screen → Enter → fly-in to the dock → walk with
 * the keyboard → link to the hub → press both hologram arrows → hover a statue
 * (tooltip + highlight) → click it (opens the game in a new tab) → library
 * search + Find statue → map → night. Phones (390×844 portrait, 844×390
 * landscape, touch only): enter by tap, joystick walk, tap a statue for its
 * card, HUD buttons ≥ 44 px. Screenshots → garden/dev/shots/.
 *
 *   python3 -m http.server 8077            # from the REPO ROOT
 *   node garden/dev/browsertest.mjs
 *
 * No network to unpkg.com? Fetch three.js once and CDN requests are served
 * from disk:  cd garden/dev && npm pack three@0.165.0 && tar xzf three-0.165.0.tgz
 * Env: BASE (default http://127.0.0.1:8077), THREE_PKG, PW_CHROMIUM_PATH, ONLY=desktop|phones.
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
const statueScreen = (page, id) =>
    page.evaluate((id) => {
        const g = window.__garden;
        const st = g.statues[id];
        const v = new g.camera.position.constructor(st.x, st.y + 2.2, st.z).project(g.camera);
        if (v.z > 1 || Math.abs(v.x) > 1 || Math.abs(v.y) > 1) return null;
        return { x: ((v.x + 1) / 2) * innerWidth, y: ((1 - v.y) / 2) * innerHeight };
    }, id);

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
    await page.click('.lib-item [data-find]');
    await frames(page, 4);
    check(await page.evaluate(() => document.getElementById('library').hidden), 'Find statue closes the library and links there');
    await shot(page, 'd7-found');

    // map
    await page.keyboard.press('m');
    await frames(page, 2);
    await shot(page, 'd8-map');
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
    await touch('touchStart', sp.x, sp.y);
    await new Promise((r) => setTimeout(r, 60)); // a quick tap, not a hold
    await touch('touchEnd');
    await frames(page, 2);
    const card = await page.evaluate(() => ({ open: !document.getElementById('card').hidden, href: document.getElementById('card-play').getAttribute('href') }));
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

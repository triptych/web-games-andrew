/**
 * browsertest.mjs — real Chromium, real WebGL, real three.js r165.
 *
 * Desktop (1280×800): title with the self-playing demo → map → level card →
 * a trail drawn with the mouse → harvest, gravity and refill match the sim →
 * a too-short trail spends nothing → pause/resume → Paint Pollen and Rainbow
 * Wings from their jars → a win with stars and Next → out of moves and +5 →
 * the Colour sense card → Picnic and packing up → album → settings persist.
 * Then touch-only phones at 390×844 and 844×390: taps through the menus, a
 * trail drawn by finger (CDP touch events), a Buzz Bomb from its jar, every
 * HUD element on screen, 44 px tap targets and the blanket clear of the HUD.
 * Fails on any console error, page error or failed request.
 *
 *   python3 -m http.server 8058                 # from the REPO ROOT
 *   node game-058/dev/browsertest.mjs
 *
 * No network to unpkg.com? Point THREE_PKG at an unpacked three@0.165.0:
 *   npm pack three@0.165.0 && tar xzf three-0.165.0.tgz     # -> ./package
 *   THREE_PKG=$PWD/package node game-058/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8058), OUT, ONLY=desktop|phones, PW_CHROMIUM_PATH.
 */
import fs from 'node:fs';
import path from 'node:path';
import { execSync } from 'node:child_process';
import { createRequire } from 'node:module';
import { fileURLToPath } from 'node:url';

async function loadPlaywright() {
    try { return await import('playwright'); } catch { /* fall back to a global install */ }
    const root = execSync('npm root -g').toString().trim();
    return createRequire(import.meta.url)(path.join(root, 'playwright'));
}
const { chromium } = await loadPlaywright();

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? path.join(HERE, 'package');
const BASE = process.env.BASE ?? 'http://127.0.0.1:8058';
const OUT = process.env.OUT ?? path.join(HERE, 'shots');
const ONLY = process.env.ONLY ?? '';
fs.mkdirSync(OUT, { recursive: true });

let passed = 0, failed = 0;
const errors = [];
function ok(cond, msg) {
    if (cond) { passed++; console.log('  ✓ ' + msg); return; }
    failed++;
    console.log('  ✗ ' + msg);
}

let browser = null;
async function newPage(viewport, { touch = false, save = null } = {}) {
    if (browser) await browser.close();
    browser = await chromium.launch({
        executablePath: process.env.PW_CHROMIUM_PATH || undefined,
        args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
    });
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, hasTouch: touch, isMobile: touch });
    await ctx.addInitScript((s) => {
        try {
            if (!sessionStorage.getItem('bb-test-init')) {
                sessionStorage.setItem('bb-test-init', '1');
                localStorage.clear();
                const base = { v: 1, settings: { sound: false, music: false, fancy: false, gentle: false } };
                localStorage.setItem('bumble-basket.save.v1', JSON.stringify({ ...base, ...(s ?? {}) }));
            }
        } catch { /* ignore */ }
    }, save);
    const page = await ctx.newPage();
    if (fs.existsSync(PKG)) {
        await page.route('https://unpkg.com/**', (route) => {
            const rel = new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, '');
            const file = path.join(PKG, rel);
            if (!fs.existsSync(file)) return route.abort();
            route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
        });
    }
    // Fonts are cosmetic; serve an empty stylesheet so an offline sandbox doesn't fail the run.
    await page.route('https://fonts.googleapis.com/**', (r) => r.fulfill({ status: 200, contentType: 'text/css', body: '' }));
    await page.route('https://fonts.gstatic.com/**', (r) => r.fulfill({ status: 200, body: '' }));
    page.on('console', (m) => {
        if (m.type() !== 'error') return;
        errors.push(`console: ${m.text()}`);
    });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('requestfailed', (r) => errors.push(`requestfailed: ${r.url()}`));
    await page.goto(`${BASE}/game-058/index.html?debug=1&seed=11`);
    await page.waitForFunction(() => window.__bb && document.getElementById('loading').classList.contains('hidden'), null, { timeout: 30000 });
    await page.waitForTimeout(600);
    return page;
}

const bb = (page, fn, arg) => page.evaluate(fn, arg);
const visible = (page, sel) => page.evaluate((s) => { const el = document.querySelector(s); return !!el && !el.classList.contains('hidden') && el.getBoundingClientRect().width > 0; }, sel);
async function waitFor(page, fn, arg, ms = 20000) {
    const t0 = Date.now();
    while (Date.now() - t0 < ms) {
        await page.evaluate(() => window.__bb.finish());
        if (await page.evaluate(fn, arg)) return true;
        await page.waitForTimeout(150);
    }
    return false;
}
async function shot(page, name) { await page.screenshot({ path: path.join(OUT, `${name}.png`) }); }

/** Screen points for a trail from the game's own search. */
async function trailPoints(page, maxLen = 6, goalWeight = 1) {
    const p = await bb(page, ([n, w]) => window.__bb.best(n, w), [maxLen, goalWeight]);
    const pts = [];
    for (const [r, c] of p) pts.push(await bb(page, ([r, c]) => window.__bb.cellScreen(r, c), [r, c]));
    return { p, pts };
}
async function mouseTrail(page, pts) {
    await page.mouse.move(pts[0].x, pts[0].y);
    await page.mouse.down();
    for (const q of pts.slice(1)) await page.mouse.move(q.x, q.y, { steps: 6 });
    await page.mouse.up();
}
async function touchTrail(page, cdp, pts) {
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: pts[0].x, y: pts[0].y }] });
    for (let i = 1; i < pts.length; i++) {
        for (let k = 1; k <= 5; k++) {
            const x = pts[i - 1].x + (pts[i].x - pts[i - 1].x) * k / 5, y = pts[i - 1].y + (pts[i].y - pts[i - 1].y) * k / 5;
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x, y }] });
        }
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
}
async function tapEl(page, sel) {
    const b = await page.locator(sel).first().boundingBox();
    await page.touchscreen.tap(b.x + b.width / 2, b.y + b.height / 2);
}
const clickEl = (page, sel) => page.click(sel, { force: true });

/** Views on the blanket must match the sim cell for cell. */
const viewsMatch = () => {
    const { game, board } = window.__bb;
    let n = 0, bad = 0;
    game.forEachFruit((f, r, c) => {
        n++;
        const v = board.views.get(f.id);
        if (!v || v.flying || v.r !== r || v.c !== c || !v.root.visible) bad++;
    });
    let flying = 0;
    for (const v of board.views.values()) if (v.flying) flying++;
    return { n, bad, views: board.views.size, flying };
};

// ============================================================
// Desktop
// ============================================================

async function desktop() {
    console.log('\nDesktop 1280×800');
    let page = await newPage({ width: 1280, height: 800 });
    ok(await visible(page, '#title-screen'), 'title screen shows');
    ok((await bb(page, () => window.__bb.board.views.size)) === 56, 'demo blanket has 56 fruit');
    await shot(page, 'd01-title');

    await clickEl(page, '#play-btn');
    await page.waitForTimeout(300);
    ok(await visible(page, '#map-screen'), 'map opens');
    ok((await page.locator('.node').count()) === 30, '30 level nodes');
    ok((await page.locator('.node.locked').count()) === 29, 'only level 1 unlocked');
    await shot(page, 'd02-map');

    await clickEl(page, '.node[data-level="0"]');
    await page.waitForTimeout(300);
    ok(await visible(page, '#intro-screen'), 'level card opens');
    ok((await page.textContent('#intro-title')) === 'First Pick', 'level card names the level');
    await clickEl(page, '#intro-go');
    await page.waitForTimeout(300);
    await bb(page, () => window.__bb.finish());
    ok(await visible(page, '#hud'), 'HUD shows');
    ok((await page.textContent('#moves-val')) === '10', 'moves counter reads 10');
    ok((await page.locator('.ticket').count()) === 1 && (await page.locator('.jar').count()) === 1, 'one ticket, one jar');
    await shot(page, 'd03-play');

    // Draw a real trail with the mouse.
    let { p, pts } = await trailPoints(page, 6);
    await mouseTrail(page, pts);
    await page.waitForTimeout(100);
    let st = await bb(page, () => ({ used: window.__bb.game.movesUsed, score: window.__bb.game.score }));
    ok(st.used === 1 && st.score >= 90, `mouse trail of ${p.length} harvested (moves used ${st.used}, score ${st.score})`);
    await waitFor(page, () => !window.__bb.busy);
    const vm = await bb(page, viewsMatch);
    ok(vm.bad === 0 && vm.n === 56 && vm.flying === 0, `views match the sim after gravity and refill (${JSON.stringify(vm)})`);
    ok((await page.textContent('#moves-val')) === '9', 'moves counter reads 9');
    await shot(page, 'd04-after-trail');

    // Mid-drag the trail is drawn as a rope with a count bubble.
    ({ pts } = await trailPoints(page, 4));
    await page.mouse.move(pts[0].x, pts[0].y);
    await page.mouse.down();
    for (const q of pts.slice(1)) await page.mouse.move(q.x, q.y, { steps: 6 });
    await page.waitForTimeout(150);
    const mid = await bb(page, () => ({
        rope: window.__bb.fx.ropeCore.visible && window.__bb.fx.ropeCore.geometry.attributes.position?.count > 0,
        bubble: !document.getElementById('chain-count').classList.contains('hidden') ? document.querySelector('#chain-count b').textContent : null,
        len: window.__bb.trail().length,
    }));
    ok(mid.rope && mid.bubble === String(mid.len) && mid.len === pts.length, `while dragging, the rope shows and the bubble counts ${mid.len} (${JSON.stringify(mid)})`);
    await shot(page, 'd04b-dragging');
    await page.mouse.up();
    await page.waitForTimeout(100);
    ok(await bb(page, () => !window.__bb.fx.ropeCore.visible && document.getElementById('chain-count').classList.contains('hidden')), 'releasing clears the rope and bubble');
    await waitFor(page, () => !window.__bb.busy);
    const usedBefore = await bb(page, () => window.__bb.game.movesUsed);

    // A trail of 2 spends nothing.
    ({ pts } = await trailPoints(page, 3));
    await mouseTrail(page, pts.slice(0, 2));
    await page.waitForTimeout(100);
    ok((await bb(page, () => window.__bb.game.movesUsed)) === usedBefore, 'a 2-fruit trail spends no move');

    // Pause and resume.
    await page.keyboard.press('p');
    await page.waitForTimeout(200);
    ok(await visible(page, '#pause-screen'), 'P pauses');
    await clickEl(page, '#pause-resume');
    await page.waitForTimeout(200);
    ok(!(await visible(page, '#pause-screen')) && (await bb(page, () => window.__bb.mode)) === 'play', 'resume');

    // Paint Pollen from its jar.
    await bb(page, () => window.__bb.start(9));
    await bb(page, () => window.__bb.give('paint'));
    await page.waitForTimeout(200);
    const jarIdx = await bb(page, () => window.__bb.game.jars.findIndex(j => j.power === 'paint'));
    await clickEl(page, `.jar >> nth=${jarIdx}`);
    await page.waitForTimeout(150);
    ok((await bb(page, () => window.__bb.armed)) === jarIdx, 'tapping a charged jar arms it');
    ok(await visible(page, '#power-hint'), 'power hint explains what to tap');
    // A fruit with all eight neighbours on the blanket (Paint Pot is hourglass-shaped).
    const target = await bb(page, () => {
        const g = window.__bb.game;
        for (let r = 1; r < 7; r++) for (let c = 1; c < 6; c++) {
            const f = g.cells[r][c].fruit;
            if (!f || f.golden || f.frost) continue;
            let full = true;
            for (let dr = -1; dr <= 1; dr++) for (let dc = -1; dc <= 1; dc++) if (!g.cells[r + dr][c + dc].fruit) full = false;
            if (full) return [r, c, f.colour];
        }
        return null;
    });
    const tp = await bb(page, ([r, c]) => window.__bb.cellScreen(r, c), target);
    await page.mouse.click(tp.x, tp.y);
    await page.waitForTimeout(100);
    await waitFor(page, () => !window.__bb.busy);
    const painted = await bb(page, ([r, c, colour]) => {
        const g = window.__bb.game; let n = 0;
        for (const [dr, dc] of [[-1, -1], [-1, 0], [-1, 1], [0, -1], [0, 1], [1, -1], [1, 0], [1, 1]]) { const f = g.cells[r + dr][c + dc].fruit; if (f && (f.colour === colour || f.golden || f.frost)) n++; }
        return { n, used: g.movesUsed, charges: g.jars.find(j => j.power === 'paint').charges };
    }, target);
    ok(painted.n === 8 && painted.used === 0 && painted.charges === 0, `Paint Pollen recoloured the neighbours for free (${JSON.stringify(painted)})`);
    await shot(page, 'd05-paint');

    // Rainbow Wings.
    await bb(page, () => window.__bb.start(25));
    await bb(page, () => window.__bb.give('rainbow'));
    await page.waitForTimeout(150);
    const rbIdx = await bb(page, () => window.__bb.game.jars.findIndex(j => j.power === 'rainbow'));
    await clickEl(page, `.jar >> nth=${rbIdx}`);
    await page.waitForTimeout(150);
    ok(await bb(page, () => window.__bb.game.wild), 'Rainbow Wings arm a wild trail');
    ({ p, pts } = await trailPoints(page, 5));
    await mouseTrail(page, pts);
    await page.waitForTimeout(100);
    ok(!(await bb(page, () => window.__bb.game.wild)), 'the wild trail is used up');
    await waitFor(page, () => !window.__bb.busy);

    // Win → stars → Next.
    await bb(page, () => window.__bb.start(0));
    await bb(page, () => window.__bb.win());
    ({ pts } = await trailPoints(page, 6, 20));
    await mouseTrail(page, pts);
    ok(await waitFor(page, () => window.__bb.mode === 'win'), 'finishing the goals shows the win card');
    await page.waitForTimeout(1300);
    const stars = await page.locator('#win-stars span.on').count();
    ok(stars >= 1 && stars === (await bb(page, () => window.__bb.game.stars)), `win card lights ${stars} star(s)`);
    ok((await bb(page, () => window.__bb.save.stars[0])) >= 1 && (await bb(page, () => window.__bb.save.unlocked)) >= 1, 'stars saved, level 2 unlocked');
    await shot(page, 'd06-win');
    await clickEl(page, '#win-next');
    await page.waitForTimeout(300);
    ok(await visible(page, '#intro-screen') && (await page.textContent('#intro-title')) === 'Two Baskets', 'Next opens level 2');

    // Out of moves → +5.
    await bb(page, () => window.__bb.start(1));
    await bb(page, () => window.__bb.setMoves(1));
    ({ pts } = await trailPoints(page, 4));
    await mouseTrail(page, pts);
    ok(await waitFor(page, () => window.__bb.mode === 'lose'), 'running out of moves shows the out-of-moves card');
    await shot(page, 'd07-lose');
    await clickEl(page, '#lose-more');
    await page.waitForTimeout(200);
    ok((await bb(page, () => [window.__bb.mode, window.__bb.game.movesLeft()].join())) === 'play,5', '+5 moves resumes play');

    // Sense card, picnic, album, settings — from a save with everything unlocked.
    page = await newPage({ width: 1280, height: 800 }, { save: { unlocked: 30, picnicOpen: true, sensesSeen: { kind: true }, album: { 'apple|red|M': 1, 'lime|green|S': 2 } } });
    await clickEl(page, '#play-btn');
    await page.waitForTimeout(300);
    await clickEl(page, '.node[data-level="7"]');
    await page.waitForTimeout(400);
    ok(await visible(page, '#sense-screen') && (await page.textContent('#sense-title')) === 'Colour sense', 'first Berry Patch level teaches Colour sense');
    await shot(page, 'd08-sense');
    await clickEl(page, '#sense-ok');
    await page.waitForTimeout(200);
    ok(await visible(page, '#intro-screen'), 'then the level card');
    await clickEl(page, '#intro-back');
    await page.waitForTimeout(200);
    await clickEl(page, '#map-back');
    await page.waitForTimeout(200);

    await clickEl(page, '#picnic-btn');
    await page.waitForTimeout(300);
    await bb(page, () => window.__bb.finish());
    ok((await bb(page, () => window.__bb.game.picnic)) && (await page.locator('.jar').count()) === 4, 'Picnic starts with all four jars');
    ({ pts } = await trailPoints(page, 6));
    await mouseTrail(page, pts);
    await waitFor(page, () => !window.__bb.busy);
    ok((await bb(page, () => window.__bb.game.basketFill)) > 0, 'picnic fills the basket');
    await shot(page, 'd09-picnic');
    await clickEl(page, '#pause-btn');
    await page.waitForTimeout(200);
    await clickEl(page, '#pause-map');
    await page.waitForTimeout(200);
    ok(await visible(page, '#picnic-screen') && (await bb(page, () => window.__bb.save.picnicBest)) > 0, 'packing up saves the best picnic');
    await clickEl(page, '#picnic-map');
    await page.waitForTimeout(200);
    await clickEl(page, '#map-album');
    await page.waitForTimeout(500);
    ok(/^\d+ \/ 81$/.test(await page.textContent('#album-count')), `album counts stamps (${await page.textContent('#album-count')})`);
    ok((await page.locator('.stamp img:not(.no)').count()) >= 2, 'found stamps are in colour');
    await shot(page, 'd10-album');
    await clickEl(page, '#album-back');
    await page.waitForTimeout(200);
    await clickEl(page, '#map-back');
    await page.waitForTimeout(200);
    await clickEl(page, '#settings-btn');
    await page.waitForTimeout(200);
    await clickEl(page, '#set-motion');
    const saved = await bb(page, () => JSON.parse(localStorage.getItem('bumble-basket.save.v1')).settings.gentle);
    ok(saved === true && (await page.evaluate(() => document.body.classList.contains('gentle'))), 'settings toggle and persist');
    await clickEl(page, '#set-close');
}

// ============================================================
// Phones (touch only)
// ============================================================

async function phone(viewport, tag) {
    console.log(`\nPhone ${viewport.width}×${viewport.height} (touch only)`);
    const page = await newPage(viewport, { touch: true });
    const cdp = await page.context().newCDPSession(page);
    await shot(page, `${tag}-01-title`);
    await tapEl(page, '#play-btn');
    await page.waitForTimeout(300);
    await tapEl(page, '.node[data-level="0"]');
    await page.waitForTimeout(300);
    await tapEl(page, '#intro-go');
    await page.waitForTimeout(300);
    await bb(page, () => window.__bb.finish());
    ok((await bb(page, () => window.__bb.mode)) === 'play', 'taps reach play');

    const { p, pts } = await trailPoints(page, 6);
    await touchTrail(page, cdp, pts);
    await page.waitForTimeout(100);
    ok((await bb(page, () => window.__bb.game.movesUsed)) === 1, `finger trail of ${p.length} harvested`);
    await waitFor(page, () => !window.__bb.busy);

    // Buzz Bomb on a size level, by touch.
    await bb(page, () => window.__bb.start(16));
    await bb(page, () => window.__bb.give('bomb'));
    await page.waitForTimeout(200);
    const bi = await bb(page, () => window.__bb.game.jars.findIndex(j => j.power === 'bomb'));
    await tapEl(page, `.jar >> nth=${bi}`);
    await page.waitForTimeout(150);
    const c = await bb(page, () => window.__bb.cellScreen(4, 3));
    await page.touchscreen.tap(c.x, c.y);
    await page.waitForTimeout(100);
    ok((await bb(page, () => window.__bb.game.stats.powers)) === 1, 'Buzz Bomb used by touch');
    await waitFor(page, () => !window.__bb.busy);
    await page.waitForTimeout(300);
    await shot(page, `${tag}-02-play`);

    // The canvas must be exactly the visible viewport: a 100vh canvas is taller
    // than innerHeight on phones with a URL bar, so taps land a fruit too low.
    const cv = await bb(page, () => { const r = document.getElementById('c').getBoundingClientRect(); const c = document.getElementById('c'); return { w: r.width, h: r.height, iw: innerWidth, ih: innerHeight, style: c.style.height }; });
    ok(Math.abs(cv.w - cv.iw) < 1 && Math.abs(cv.h - cv.ih) < 1 && cv.style === `${cv.ih}px`, `canvas is sized to the visible viewport (${JSON.stringify(cv)})`);
    // A tap on a fruit's drawn position picks that fruit.
    const pick = await bb(page, () => {
        const g = window.__bb.game;
        for (let r = 0; r < g.rows; r++) for (let c = 0; c < g.cols; c++) if (g.selectable(r, c)) return [r, c];
        return null;
    });
    const ps = await bb(page, ([r, c]) => window.__bb.cellScreen(r, c), pick);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: ps.x, y: ps.y }] });
    await page.waitForTimeout(80);
    const picked = await bb(page, () => window.__bb.trail());
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    ok(JSON.stringify(picked) === JSON.stringify([pick]), `a tap on a fruit picks that fruit (${JSON.stringify(picked)} vs ${JSON.stringify(pick)})`);

    const lay = await bb(page, () => {
        const vw = innerWidth, vh = innerHeight;
        const els = [...document.querySelectorAll('#pause-btn, #moves-box, .ticket, .jar, #score-pill')].map(el => {
            const r = el.getBoundingClientRect();
            return { id: el.id || el.className.split(' ')[0], l: r.left, t: r.top, r: r.right, b: r.bottom, w: r.width, h: r.height };
        });
        const fr = window.__bb.freeRect();
        const corners = [[0, 0], [0, 6], [7, 0], [7, 6]].map(([r, c]) => window.__bb.cellScreen(r, c));
        return { vw, vh, els, fr, corners };
    });
    ok(lay.els.every(e => e.l >= 0 && e.t >= 0 && e.r <= lay.vw && e.b <= lay.vh), 'every HUD element is on screen');
    ok(lay.els.filter(e => e.id === 'round-btn' || e.id === 'jar' || e.id === 'pause-btn').every(e => e.w >= 44 && e.h >= 44), 'buttons and jars are ≥ 44 px');
    ok(lay.corners.every(q => q.x > lay.fr.left && q.x < lay.fr.right && q.y > lay.fr.top && q.y < lay.fr.bottom), 'the blanket sits clear of the HUD');
    const cell = Math.abs(lay.corners[1].x - lay.corners[0].x) / 6;
    ok(cell >= 30, `fruit cells are finger-sized (${cell.toFixed(0)} px)`);

    await tapEl(page, '#pause-btn');
    await page.waitForTimeout(200);
    ok(await visible(page, '#pause-screen'), 'pause by tap');
    await shot(page, `${tag}-03-pause`);
}

// ============================================================

try {
    if (!ONLY || ONLY === 'desktop') await desktop();
    if (!ONLY || ONLY === 'phones') {
        await phone({ width: 390, height: 844 }, 'p-portrait');
        await phone({ width: 844, height: 390 }, 'p-landscape');
    }
} catch (e) {
    failed++;
    console.log('  ✗ threw: ' + (e.stack || e));
} finally {
    if (browser) await browser.close();
}
const real = errors.filter(e => !/GPU stall due to ReadPixels/.test(e));
ok(real.length === 0, `no console errors, page errors or failed requests${real.length ? ':\n    ' + real.join('\n    ') : ''}`);
console.log(`\n${passed} passed, ${failed} failed. Screenshots in ${path.relative(process.cwd(), OUT) || OUT}`);
process.exit(failed ? 1 : 0);

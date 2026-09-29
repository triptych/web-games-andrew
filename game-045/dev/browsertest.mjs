/**
 * browsertest.mjs — real Chromium, real WebGL, real three.js r165.
 *
 * Loads game-045/index.html?debug=1, walks title (attract demo) → start →
 * plunge → flippers → explosive chain → power-ups → pause → game over, then a
 * 390×844 phone viewport, screenshotting each step into dev/shots/ and
 * failing on any console error, page error or failed request.
 *
 *   python3 -m http.server 8045                 # from the REPO ROOT
 *   node game-045/dev/browsertest.mjs
 *
 * No network to unpkg.com? Fetch the package once and point THREE_PKG at it;
 * CDN requests are then fulfilled from disk (still the genuine r165):
 *   npm pack three@0.165.0 && tar xzf three-0.165.0.tgz     # -> ./package
 *   THREE_PKG=$PWD/package node game-045/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8045), PW_CHROMIUM_PATH, OUT.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? path.join(HERE, 'package');
const BASE = process.env.BASE ?? 'http://127.0.0.1:8045';
const OUT = process.env.OUT ?? path.join(HERE, 'shots');
fs.mkdirSync(OUT, { recursive: true });

const errors = [];
const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
});

async function newPage(viewport, extra = {}) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, ...extra });
    const page = await ctx.newPage();
    if (fs.existsSync(PKG)) {
        await page.route('https://unpkg.com/**', (route) => {
            const url = new URL(route.request().url());
            const rel = url.pathname.replace(/^\/three@0\.165\.0\//, '');
            const file = path.join(PKG, rel);
            if (!fs.existsSync(file)) return route.abort();
            route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
        });
    }
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('requestfailed', (r) => {
        if (!r.url().includes('favicon')) errors.push(`requestfailed: ${r.url()} ${r.failure()?.errorText}`);
    });
    return { ctx, page };
}

const shot = async (page, name) => {
    await page.screenshot({ path: path.join(OUT, `${name}.png`) });
    console.log('  shot', name);
};
const wait = (page, ms) => page.waitForTimeout(ms);
const check = (cond, msg) => { if (!cond) errors.push(`check: ${msg}`); else console.log('  ok', msg); };
// Software GL can run at a few fps, so wait on game state, never on wall-clock time.
const until = async (page, fn, msg, timeout = 90000) => {
    const ok = await page.waitForFunction(fn, null, { timeout }).then(() => true, () => false);
    check(ok, msg);
};

// ------------------------------------------------------------------ Desktop
{
    const { ctx, page } = await newPage({ width: 1280, height: 800 });
    await page.goto(`${BASE}/game-045/index.html?debug=1`);
    await page.waitForFunction(() => window.__pb, null, { timeout: 20000 });
    await wait(page, 2500);
    await shot(page, '01-title');
    check(await page.evaluate(() => window.__pb.mode === 'title'), 'boots into title / attract mode');
    await until(page, () => window.__pb.world.stats.launches > 0, 'attract-mode bot launches a ball');

    await page.click('#start-btn');
    await wait(page, 300);
    check(await page.evaluate(() => window.__pb.mode === 'playing'), 'INSERT COIN starts the game');
    check(await page.evaluate(() => window.__pb.world.balls.some((b) => b.held)), 'ball waits on the plunger');
    await page.keyboard.down('Space');
    await wait(page, 700);
    await shot(page, '02-plunger');
    await page.keyboard.up('Space');
    await until(page, () => window.__pb.world.stats.launches === 1 && window.__pb.world.balls.some((b) => !b.inLane), 'plunger launched the ball into the field');
    await shot(page, '03-launched');

    // Play: flip whenever a ball is near the flippers (driven through the real keyboard path).
    for (let i = 0; i < 40; i++) {
        const near = await page.evaluate(() => window.__pb.world.balls.map((b) => [b.x, b.y, b.vy, b.held]));
        for (const [x, y, vy, held] of near) {
            if (held) { await page.keyboard.down('Space'); await wait(page, 400); await page.keyboard.up('Space'); }
            else if (y < 5.5 && vy < 2) {
                const key = x < 0 ? 'KeyZ' : 'Slash';
                await page.keyboard.down(key); await wait(page, 150); await page.keyboard.up(key);
            }
        }
        await wait(page, 100);
    }
    await shot(page, '04-playing');

    // Explosive chain + power-ups.
    await page.evaluate(() => { const p = window.__pb; p.power('fire', 8); p.power('laser', 8); p.power('shield', 8); p.power('x2', 8); p.power('wide', 8); });
    await page.evaluate(() => window.__pb.blastAt(0, 21));
    await wait(page, 120);
    await shot(page, '05-blast');
    await page.keyboard.down('KeyZ'); await page.keyboard.down('Slash');
    await wait(page, 250);
    await shot(page, '06-lasers-powers');
    await page.keyboard.up('KeyZ'); await page.keyboard.up('Slash');
    check(await page.evaluate(() => window.__pb.world.stats.bricks > 0), 'bricks were destroyed');

    // Wave clear.
    await page.evaluate(() => window.__pb.clearBricks());
    await until(page, () => window.__pb.world.waveClearing, 'clearing every brick triggers WAVE CLEAR');
    await wait(page, 300);
    await shot(page, '07-wave-clear');
    await until(page, () => window.__pb.world.wave === 2 && window.__pb.world.bricksLeft > 20, 'next wave loads after a clear');
    await wait(page, 600);
    await shot(page, '08-wave-2');

    await page.keyboard.press('KeyP');
    await wait(page, 200);
    check(await page.evaluate(() => window.__pb.mode === 'paused'), 'P pauses');
    await shot(page, '09-paused');
    await page.keyboard.press('KeyP');
    await wait(page, 200);
    check(await page.evaluate(() => window.__pb.mode === 'playing'), 'P resumes');

    // Force game over: drain every ball with no lives left.
    await page.evaluate(() => { const w = window.__pb.world; w.lives = 1; w.ballSave = 0; for (const b of w.balls) { b.held = false; b.inLane = false; b.x = 0; b.y = -2; } });
    await until(page, () => window.__pb.mode === 'over', 'draining the last ball ends the game');
    await wait(page, 400);
    await shot(page, '10-game-over');

    // Frame-rate sample in the software renderer (not representative of a GPU).
    const fps = await page.evaluate(() => new Promise((res) => {
        let n = 0; const t0 = performance.now();
        const f = () => { n++; if (performance.now() - t0 < 2000) requestAnimationFrame(f); else res(n / ((performance.now() - t0) / 1000)); };
        requestAnimationFrame(f);
    }));
    console.log(`  swiftshader fps ≈ ${fps.toFixed(1)}`);
    await ctx.close();
}

// ------------------------------------------------------------------ Phone
for (const vp of [{ width: 390, height: 844 }, { width: 844, height: 390 }]) {
    const { ctx, page } = await newPage(vp, { hasTouch: true, isMobile: true });
    await page.goto(`${BASE}/game-045/index.html?debug=1`);
    await page.waitForFunction(() => window.__pb, null, { timeout: 20000 });
    await wait(page, 1500);
    await shot(page, `11-phone-title-${vp.width}x${vp.height}`);
    await page.tap('#start-btn');
    await wait(page, 300);
    check(await page.evaluate(() => window.__pb.mode === 'playing'), `tap starts the game at ${vp.width}x${vp.height}`);
    // Touch-and-hold anywhere pulls the plunger; lifting launches.
    const cdp = await ctx.newCDPSession(page);
    const touch = async (type, x, y) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: type === 'touchEnd' ? [] : [{ x, y, id: 1 }] });
    await touch('touchStart', vp.width * 0.7, vp.height * 0.6);
    await wait(page, 600);
    await touch('touchEnd');
    await until(page, () => window.__pb.world.stats.launches === 1, `touch plunger launches at ${vp.width}x${vp.height}`);
    await until(page, () => !window.__pb.world.balls.some((b) => b.held), 'ball has left the plunger');
    await touch('touchStart', vp.width * 0.2, vp.height * 0.8);
    await until(page, () => window.__pb.world.flippers[0].held && !window.__pb.world.flippers[1].held, 'left-half touch raises only the left flipper');
    await shot(page, `12-phone-play-${vp.width}x${vp.height}`);
    await touch('touchEnd');

    // HUD must not overlap the corner buttons or run off-screen.
    const overlap = await page.evaluate(() => {
        const r = (id) => document.getElementById(id).getBoundingClientRect();
        const hit = (a, b) => a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
        const hud = ['score-block', 'balls-block', 'wave-block'].map(r);
        const btn = ['mute-btn', 'pause-btn'].map(r);
        const bad = [];
        hud.forEach((h, i) => btn.forEach((b, j) => { if (hit(h, b)) bad.push(`hud${i}×btn${j}`); }));
        hud.forEach((h, i) => { if (h.right > innerWidth + 1 || h.left < 0) bad.push(`hud${i} off-screen`); });
        return bad;
    });
    check(overlap.length === 0, `HUD clear of buttons at ${vp.width}x${vp.height} ${overlap.join(' ')}`);
    await ctx.close();
}

await browser.close();
if (errors.length) {
    console.log('\nFAILURES:\n' + errors.map((e) => '  ' + e).join('\n'));
    process.exit(1);
}
console.log('\nBROWSER TEST PASSED');

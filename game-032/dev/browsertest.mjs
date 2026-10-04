/**
 * browsertest.mjs — Ironhollow Depths in real Chromium.
 *
 * Generated floors: 60 floors across all depths, each checked for full
 * connectivity, a reachable exit, walkers spawned on reachable tiles, the
 * right enemy types for its depth and a potion where one belongs.
 *
 * Desktop (1280×760): title → Space → floor 1 → walk with the arrows and
 * swing → kill the floor → the stairs open → step on them → floor 2 → jump
 * to floor 10 → clear it → claim the Hollow Crown → win screen → best run
 * saved → R restarts. Pause with P and by hiding the tab. Lose all lives →
 * game over screen.
 *
 * Phone (390×844 portrait and 844×390 landscape, touch only): tap to start,
 * the stick and sword button appear, ≥ 44 px, the stick moves the knight,
 * the sword button swings, the pause button pauses, the controls hide on
 * the end screen and a tap restarts.
 *
 * Fails on any console error, page error or failed request.
 *
 *   python3 -m http.server 8000                 # from the REPO ROOT
 *   node game-032/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8000), OUT (screenshots, default dev/shots), PW_CHROMIUM_PATH.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8000';
const OUT = process.env.OUT ?? path.join(HERE, 'shots');
fs.mkdirSync(OUT, { recursive: true });
const URL = `${BASE}/game-032/index.html?debug=1`;

let failures = 0, passes = 0;
const errors = [];
function check(cond, msg) {
    if (cond) passes++;
    else { failures++; console.log(`  FAIL ${msg}`); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    args: ['--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
});

async function open(viewport, extra = {}) {
    const ctx = await browser.newContext({ viewport, ...extra });
    await ctx.addInitScript(() => { if (!sessionStorage.getItem('__keep')) localStorage.clear(); });
    const page = await ctx.newPage();
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('requestfailed', (r) => errors.push(`requestfailed: ${r.url()}`));
    await page.goto(URL);
    await page.waitForFunction(() => window.__ih);
    return { ctx, page };
}
const ih = (page, fn, arg) => page.evaluate(fn, arg);
const waitFor = (page, fn, arg, timeout = 5000) => page.waitForFunction(fn, arg, { timeout }).then(() => true, () => false);

// ── Generated floors ─────────────────────────────────────────
{
    console.log('floors');
    const { ctx, page } = await open({ width: 1280, height: 760 });
    await ih(page, () => window.__ih.start());
    await waitFor(page, () => window.__ih.dungeon.player);
    for (let i = 0; i < 60; i++) {
        const floor = (i % 10) + 1;
        const c = await ih(page, (n) => { window.__ih.dungeon.toFloor(n); return window.__ih.dungeon.check(); }, floor);
        check(c.reachable === c.floorTiles, `floor ${floor}: ${c.floorTiles - c.reachable} unreachable tiles`);
        check(c.exitReachable, `floor ${floor}: exit unreachable`);
        check(c.walkersReachable, `floor ${floor}: a walker spawned somewhere it can't reach you`);
        check(c.enemies === c.foesLeft && c.enemies === Math.min(4 + floor, 13), `floor ${floor}: ${c.enemies} enemies, ${c.foesLeft} foes left`);
        if (floor === 1) check(c.types.join() === 'slime', `floor 1 should be slimes only, got ${c.types}`);
        if (floor < 3) check(!c.types.includes('skeleton'), `floor ${floor} has skeletons`);
        check(c.potions === ([3, 5, 7, 9].includes(floor) ? 1 : 0), `floor ${floor}: ${c.potions} potions`);
    }
    await ctx.close();
}

// ── Desktop ──────────────────────────────────────────────────
{
    console.log('desktop');
    const { ctx, page } = await open({ width: 1280, height: 760 });
    await sleep(500);
    await page.screenshot({ path: path.join(OUT, 'desktop-title.png') });
    await page.keyboard.press('Space');
    check(await waitFor(page, () => window.__ih.dungeon.player && window.__ih.state.level === 1), 'Space starts floor 1');
    check(await page.evaluate(() => !document.querySelector('#touch-controls')), 'no touch controls on desktop');

    // Walk and swing
    const before = await ih(page, () => ({ ...window.__ih.dungeon.player.pos }));
    await page.keyboard.down('ArrowLeft'); await sleep(400); await page.keyboard.up('ArrowLeft');
    const after = await ih(page, () => ({ ...window.__ih.dungeon.player.pos }));
    check(after.x < before.x - 10, `arrow keys move the knight (${before.x} → ${after.x})`);
    const swings = await ih(page, () => window.__ih.dungeon.swings);
    await page.keyboard.press('Space');
    check(await waitFor(page, (n) => window.__ih.dungeon.swings > n, swings, 2000), 'Space swings the sword');
    await page.screenshot({ path: path.join(OUT, 'desktop-floor1.png') });

    // Pause: P, and hiding the tab
    await page.keyboard.press('KeyP');
    check(await ih(page, () => window.__ih.state.isPaused), 'P pauses');
    await page.keyboard.press('KeyP');
    check(!(await ih(page, () => window.__ih.state.isPaused)), 'P resumes');
    await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
        document.dispatchEvent(new Event('visibilitychange'));
    });
    check(await ih(page, () => window.__ih.state.isPaused), 'hiding the tab pauses');
    await page.keyboard.press('KeyP');

    // Stairs: closed until the floor is clear
    await ih(page, () => window.__ih.dungeon.god(true));
    await ih(page, () => window.__ih.dungeon.toExit());
    await sleep(200);
    check(await ih(page, () => window.__ih.state.level) === 1, 'closed stairs do nothing');
    await ih(page, () => window.__ih.dungeon.killAll());
    check(await ih(page, () => window.__ih.dungeon.exitOpen && window.__ih.state.foesLeft === 0), 'killing every foe opens the stairs');
    await page.screenshot({ path: path.join(OUT, 'desktop-stairs-open.png') });
    await ih(page, () => window.__ih.dungeon.toExit());
    check(await waitFor(page, () => window.__ih.state.level === 2 && window.__ih.state.foesLeft > 0), 'open stairs lead to floor 2');

    // The final floor and the crown
    await ih(page, () => window.__ih.dungeon.toFloor(10));
    await sleep(300);
    await page.screenshot({ path: path.join(OUT, 'desktop-floor10.png') });
    await ih(page, () => window.__ih.dungeon.killAll());
    await ih(page, () => window.__ih.dungeon.toExit());
    check(await waitFor(page, () => window.__ih.state.isWon), 'claiming the crown wins');
    await sleep(300);
    await page.screenshot({ path: path.join(OUT, 'desktop-win.png') });
    const best = await page.evaluate(() => JSON.parse(localStorage.getItem('ironhollow_best')));
    check(best && best.won && best.floor === 10, `best run saved (${JSON.stringify(best)})`);
    await page.keyboard.press('KeyR');
    check(await waitFor(page, () => window.__ih.state.level === 1 && !window.__ih.state.isWon), 'R restarts after a win');

    // Game over
    await ih(page, () => { window.__ih.dungeon.god(false); window.__ih.state.lives = 1; window.__ih.state.damage(1000); });
    check(await ih(page, () => window.__ih.state.isGameOver), 'losing the last life ends the run');
    await sleep(200);
    await page.screenshot({ path: path.join(OUT, 'desktop-gameover.png') });
    await page.mouse.click(640, 380);
    check(await waitFor(page, () => !window.__ih.state.isGameOver && window.__ih.state.lives === 3), 'a click restarts after game over');
    await ctx.close();
}

// ── Phones, touch only ──────────────────────────────────────
for (const [name, viewport] of [['portrait', { width: 390, height: 844 }], ['landscape', { width: 844, height: 390 }]]) {
    console.log(`phone ${name}`);
    const { ctx, page } = await open(viewport, { isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    await sleep(400);
    await page.touchscreen.tap(viewport.width / 2, viewport.height / 2);
    check(await waitFor(page, () => window.__ih.dungeon.player), `${name}: a tap starts the game`);
    await ih(page, () => window.__ih.dungeon.god(true));

    const boxes = await page.evaluate(() => Object.fromEntries(['#stick-zone', '#attack-btn', '#pause-btn'].map((s) => {
        const el = document.querySelector(s);
        const r = el && el.getBoundingClientRect();
        return [s, r && getComputedStyle(el).display !== 'none' ? { x: r.x, y: r.y, w: r.width, h: r.height } : null];
    })));
    for (const [sel, b] of Object.entries(boxes)) {
        check(b && b.w >= 44 && b.h >= 44, `${name}: ${sel} visible and ≥ 44 px (${JSON.stringify(b)})`);
        if (b) check(b.x >= 0 && b.y >= 0 && b.x + b.w <= viewport.width + 1 && b.y + b.h <= viewport.height + 1, `${name}: ${sel} on screen`);
    }
    const back = await page.evaluate(() => {
        const a = document.querySelector('a[href="../index.html"]').getBoundingClientRect();
        const top = document.elementFromPoint(a.x + a.width / 2, a.y + a.height / 2);
        return top && top.closest('a') !== null;
    });
    check(back, `${name}: the Games link is not covered by the controls`);

    // Drag the stick right with a real touch (CDP), then the sword button
    const cdp = await ctx.newCDPSession(page);
    const sx = boxes['#stick-zone'].x + 80, sy = boxes['#stick-zone'].y + boxes['#stick-zone'].h - 120;
    const before = await ih(page, () => ({ ...window.__ih.dungeon.player.pos }));
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: sx, y: sy, id: 1 }] });
    for (let i = 1; i <= 6; i++) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: sx + i * 10, y: sy, id: 1 }] });
        await sleep(30);
    }
    await sleep(400);
    await page.screenshot({ path: path.join(OUT, `phone-${name}-stick.png`) });
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const after = await ih(page, () => ({ ...window.__ih.dungeon.player.pos }));
    check(after.x > before.x + 10, `${name}: dragging the stick moves the knight (${before.x} → ${after.x})`);

    const atk = boxes['#attack-btn'];
    const swings = await ih(page, () => window.__ih.dungeon.swings);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: atk.x + atk.w / 2, y: atk.y + atk.h / 2, id: 2 }] });
    check(await waitFor(page, (n) => window.__ih.dungeon.swings > n, swings, 2000), `${name}: the sword button swings`);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });

    const pb = boxes['#pause-btn'];
    await page.touchscreen.tap(pb.x + pb.w / 2, pb.y + pb.h / 2);
    check(await ih(page, () => window.__ih.state.isPaused), `${name}: the pause button pauses`);
    await page.screenshot({ path: path.join(OUT, `phone-${name}-paused.png`) });
    await page.touchscreen.tap(pb.x + pb.w / 2, pb.y + pb.h / 2);
    check(!(await ih(page, () => window.__ih.state.isPaused)), `${name}: and resumes`);

    await ih(page, () => { window.__ih.dungeon.god(false); window.__ih.state.lives = 1; window.__ih.state.damage(1000); });
    await sleep(200);
    check(await page.evaluate(() => document.querySelector('#touch-controls').classList.contains('hidden')), `${name}: controls hide on the end screen`);
    await page.screenshot({ path: path.join(OUT, `phone-${name}-gameover.png`) });
    await page.touchscreen.tap(viewport.width / 2, viewport.height / 2);
    check(await waitFor(page, () => !window.__ih.state.isGameOver && window.__ih.dungeon.player), `${name}: a tap restarts`);
    await ctx.close();
}

await browser.close();
for (const e of [...new Set(errors)]) { failures++; console.log(`  FAIL ${e}`); }
console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);

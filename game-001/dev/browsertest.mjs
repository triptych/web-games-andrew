/**
 * browsertest.mjs — Space Shooter in real Chromium.
 *
 * Desktop (1280×760): the title waits for input → Space starts → holding
 * the arrow moves the ship at the same speed whatever the frame rate →
 * holding Space keeps firing → P pauses and freezes everything → a hidden
 * tab pauses → a collision ends the run and saves the best score → Enter
 * restarts.
 *
 * Phones (touch only, 390×844 and 844×390): the canvas fits the screen →
 * a tap starts → dragging moves the ship by the drag distance (relative, not
 * to the finger) and fires while held → the restart button is ≥ 44 px.
 *
 * Fails on any console error, page error or failed request.
 *
 *   python3 -m http.server 8000                 # from the REPO ROOT
 *   node game-001/dev/browsertest.mjs
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

let failures = 0, passes = 0;
const errors = [];
function check(cond, msg) {
    if (cond) passes++;
    else { failures++; console.log(`  FAIL ${msg}`); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH || undefined, args: ['--no-sandbox'] });

async function open(opts) {
    const ctx = await browser.newContext(opts);
    const page = await ctx.newPage();
    page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
    page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));
    page.on('requestfailed', (r) => errors.push(`requestfailed: ${r.url()}`));
    await page.goto(`${BASE}/game-001/index.html`);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await sleep(300);
    return { ctx, page };
}
const get = (page, expr) => page.evaluate(expr);
// Keep enemies away while testing controls
const clearSky = (page) => page.evaluate(() => { enemies = []; lastEnemySpawn = performance.now() + 1e9; });

// ── Desktop ──────────────────────────────────────────────────
{
    console.log('desktop');
    const { ctx, page } = await open({ viewport: { width: 1280, height: 760 } });
    await sleep(600);
    check(await get(page, () => mode === 'ready' && enemies.length === 0), 'the title waits for input');
    await page.screenshot({ path: path.join(OUT, 'desktop-title.png') });
    await page.keyboard.press('Space');
    check(await get(page, () => mode === 'playing'), 'Space starts');
    await clearSky(page);

    const x0 = await get(page, () => player.x);
    const t0 = Date.now();
    await page.keyboard.down('ArrowLeft'); await sleep(500); await page.keyboard.up('ArrowLeft');
    const moved = x0 - await get(page, () => player.x);
    const expected = 300 * (Date.now() - t0) / 1000;
    check(moved > expected * 0.5 && moved < expected * 1.3, `ship moves ~300 px/s (${Math.round(moved)} px in ${Date.now() - t0} ms)`);

    await page.evaluate(() => { bullets = []; });
    await page.keyboard.down('Space'); await sleep(900); await page.keyboard.up('Space');
    const shots = await get(page, () => bullets.length);
    check(shots >= 3, `holding Space keeps firing (${shots} bullets in 0.9 s)`);

    await page.keyboard.press('KeyP');
    check(await get(page, () => mode === 'paused'), 'P pauses');
    const frozen = await get(page, () => bullets.map((b) => b.y).join());
    await sleep(300);
    check(frozen === await get(page, () => bullets.map((b) => b.y).join()), 'nothing moves while paused');
    await page.screenshot({ path: path.join(OUT, 'desktop-paused.png') });
    await page.keyboard.press('KeyP');
    check(await get(page, () => mode === 'playing'), 'P resumes');

    await page.evaluate(() => {
        Object.defineProperty(document, 'hidden', { configurable: true, get: () => true });
        document.dispatchEvent(new Event('visibilitychange'));
    });
    check(await get(page, () => mode === 'paused'), 'hiding the tab pauses');
    await page.keyboard.press('Space');
    check(await get(page, () => mode === 'playing'), 'Space resumes');

    // Score something, then crash
    await page.evaluate(() => { score = 120; enemies = [{ x: player.x, y: player.y, width: 40, height: 40 }]; });
    await sleep(200);
    check(await get(page, () => mode === 'over'), 'a collision ends the run');
    check(await page.evaluate(() => localStorage.getItem('spaceShooter_best')) === '120', 'best score saved');
    check(await page.isVisible('#restartBtn'), 'restart button shown');
    await page.screenshot({ path: path.join(OUT, 'desktop-over.png') });
    await page.keyboard.press('Enter');
    check(await get(page, () => mode === 'playing' && score === 0), 'Enter restarts');
    await page.reload();
    await sleep(300);
    check((await page.textContent('#best')).includes('120'), 'best score survives a reload');
    await ctx.close();
}

// ── Phones ───────────────────────────────────────────────────
for (const [name, viewport] of [['portrait', { width: 390, height: 844 }], ['landscape', { width: 844, height: 390 }]]) {
    console.log(`phone ${name}`);
    const { ctx, page } = await open({ viewport, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const r = await page.evaluate(() => { const b = gameCanvas.getBoundingClientRect(); return { x: b.x, y: b.y, w: b.width, h: b.height }; });
    check(r.x >= 0 && r.x + r.w <= viewport.width + 1, `${name}: canvas fits the width (${Math.round(r.x)}..${Math.round(r.x + r.w)})`);
    check(r.y >= 0 && r.y + r.h <= viewport.height + 1, `${name}: canvas fits the height (${Math.round(r.y)}..${Math.round(r.y + r.h)})`);
    check((await page.textContent('#controls')).includes('Drag'), `${name}: touch instructions shown`);

    await page.touchscreen.tap(r.x + r.w / 2, r.y + r.h / 2);
    check(await get(page, () => mode === 'playing'), `${name}: a tap starts`);
    await clearSky(page);
    await page.evaluate(() => { bullets = []; });

    // Drag 60 screen px right, starting far from the ship
    const cdp = await ctx.newCDPSession(page);
    const sx = r.x + r.w * 0.2, sy = r.y + r.h * 0.3;
    const x0 = await get(page, () => player.x);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: sx, y: sy, id: 1 }] });
    for (let i = 1; i <= 6; i++) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: sx + i * 10, y: sy, id: 1 }] });
        await sleep(40);
    }
    await sleep(400);
    const x1 = await get(page, () => player.x);
    const fired = await get(page, () => bullets.length);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    const expected = 60 * 800 / r.w;
    check(Math.abs((x1 - x0) - expected) < expected * 0.15, `${name}: the ship moves by the drag, not to the finger (${Math.round(x1 - x0)} vs ${Math.round(expected)} game px)`);
    check(fired >= 1, `${name}: holding fires (${fired} bullets)`);
    await page.screenshot({ path: path.join(OUT, `phone-${name}.png`) });

    await page.evaluate(() => { enemies = [{ x: player.x, y: player.y, width: 40, height: 40 }]; });
    await sleep(200);
    const btn = await page.evaluate(() => { const b = restartBtn.getBoundingClientRect(); return { w: b.width, h: b.height }; });
    check(btn.h >= 44, `${name}: restart button ≥ 44 px tall (${btn.h})`);
    await ctx.close();
}

await browser.close();
for (const e of [...new Set(errors)]) { failures++; console.log(`  FAIL ${e}`); }
console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);

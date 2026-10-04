/**
 * browsertest.mjs — Pixel Picross in real Chromium.
 *
 * Desktop (1280×760): a key starts puzzle 1 → right click marks a square →
 * X switches the tool and a left click then marks → every puzzle is solved
 * by clicking its solution squares → the win saves progress → a click goes
 * on → the last puzzle reaches the complete screen → after a reload the
 * title offers the first unsolved puzzle.
 *
 * Phones (touch only, 390×844 and 844×390): a tap starts → taps fill → a
 * drag fills a run of squares → the tool button switches to marking and a
 * tap marks → Restart clears the board → puzzle 1 is solved by tapping → a
 * tap goes on to puzzle 2 → taps still register after that scene change →
 * Menu returns to the title. Buttons are ≥ 44 px in landscape.
 *
 * Fails on any console error, page error or failed request.
 *
 *   python3 -m http.server 8000                 # from the REPO ROOT
 *   node game-017/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8000), OUT (screenshots, default dev/shots), PW_CHROMIUM_PATH.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { PUZZLES } from '../js/puzzles.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8000';
const OUT = process.env.OUT ?? path.join(HERE, 'shots');
fs.mkdirSync(OUT, { recursive: true });
const URL = `${BASE}/game-017/index.html?debug=1`;
const W = 900, H = 680;   // the game's own resolution

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
    await page.goto(URL);
    await page.evaluate(() => localStorage.clear());
    await page.reload();
    await page.waitForFunction(() => window.__px && window.__px.scene === 'splash');
    await sleep(300);
    return { ctx, page };
}
const px = (page, fn, arg) => page.evaluate(fn, arg);
const waitFor = (page, fn, arg, timeout = 5000) => page.waitForFunction(fn, arg, { timeout }).then(() => true, () => false);

/** Game coordinates → screen coordinates (Kaplay letterboxes the 900×680 game). */
function toScreen(vp, x, y) {
    const s = Math.min(vp.width / W, vp.height / H);
    return { x: (vp.width - W * s) / 2 + x * s, y: (vp.height - H * s) / 2 + y * s, s };
}
const cellScreen = async (page, vp, r, c) => { const g = await px(page, ([r, c]) => window.__px.cell(r, c), [r, c]); return toScreen(vp, g.x, g.y); };
const filledCells = (sol) => sol.flatMap((row, r) => row.flatMap((v, c) => (v ? [[r, c]] : [])));
const emptyCell = (sol) => { for (let r = 0; r < sol.length; r++) for (let c = 0; c < sol[r].length; c++) if (!sol[r][c]) return [r, c]; };

// ── Desktop ──────────────────────────────────────────────────
{
    console.log('desktop');
    const vp = { width: 1280, height: 760 };
    const { ctx, page } = await open({ viewport: vp });
    await page.keyboard.press('Enter');
    check(await waitFor(page, () => window.__px.scene === 'game' && window.__px.puzzle === 0), 'a key starts puzzle 1');

    const [er, ec] = emptyCell(PUZZLES[0].solution);
    let p = await cellScreen(page, vp, er, ec);
    await page.mouse.click(p.x, p.y, { button: 'right' });
    check(await px(page, ([r, c]) => window.__px.grid[r][c], [er, ec]) === 2, 'right click marks');
    await page.mouse.click(p.x, p.y, { button: 'right' });
    await page.keyboard.press('KeyX');
    check(await px(page, () => window.__px.markTool), 'X switches to the mark tool');
    await page.mouse.click(p.x, p.y);
    check(await px(page, ([r, c]) => window.__px.grid[r][c], [er, ec]) === 2, 'left click marks with the mark tool');
    await page.keyboard.press('KeyX');

    for (let i = 0; i < PUZZLES.length; i++) {
        await waitFor(page, (n) => window.__px.scene === 'game' && window.__px.puzzle === n, i);
        for (const [r, c] of filledCells(PUZZLES[i].solution)) {
            p = await cellScreen(page, vp, r, c);
            await page.mouse.click(p.x, p.y);
        }
        check(await waitFor(page, () => window.__px.won), `puzzle ${i + 1} (${PUZZLES[i].name}) solved by clicking`);
        check((await page.evaluate(() => JSON.parse(localStorage.getItem('pixelPicross_solved')))).includes(i), `puzzle ${i + 1} saved as solved`);
        if (i === 0) await page.screenshot({ path: path.join(OUT, 'desktop-solved.png') });
        await sleep(250);
        await page.mouse.click(vp.width / 2, vp.height / 2);
    }
    check(await waitFor(page, () => window.__px.scene === 'complete'), 'the last puzzle reaches the complete screen');

    await page.evaluate(() => localStorage.setItem('pixelPicross_solved', '[0,1]'));
    await page.reload();
    await page.waitForFunction(() => window.__px && window.__px.scene === 'splash');
    await sleep(300);
    await page.screenshot({ path: path.join(OUT, 'desktop-title-continue.png') });
    await page.keyboard.press('Enter');
    check(await waitFor(page, () => window.__px.scene === 'game' && window.__px.puzzle === 2), 'the title continues at the first unsolved puzzle');
    await ctx.close();
}

// ── Phones ───────────────────────────────────────────────────
for (const [name, vp] of [['portrait', { width: 390, height: 844 }], ['landscape', { width: 844, height: 390 }]]) {
    console.log(`phone ${name}`);
    const { ctx, page } = await open({ viewport: vp, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const tapGame = (x, y) => { const p = toScreen(vp, x, y); return page.touchscreen.tap(p.x, p.y); };
    const tapCell = async (r, c) => { const p = await cellScreen(page, vp, r, c); await page.touchscreen.tap(p.x, p.y); };
    const cdp = await ctx.newCDPSession(page);

    await tapGame(W / 2, H / 2);
    check(await waitFor(page, () => window.__px.scene === 'game'), `${name}: a tap starts`);
    const sol = PUZZLES[0].solution;
    const btnY = H - 12 - 40;

    const [r0, c0] = filledCells(sol)[0];
    await tapCell(r0, c0);
    check(await px(page, ([r, c]) => window.__px.grid[r][c], [r0, c0]) === 1, `${name}: a tap fills`);

    // Drag along row 0 from the first to the last column
    const a = await cellScreen(page, vp, 0, 0), b = await cellScreen(page, vp, 0, sol[0].length - 1);
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: a.x, y: a.y, id: 1 }] });
    for (let i = 1; i <= 10; i++) {
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: a.x + (b.x - a.x) * i / 10, y: a.y, id: 1 }] });
        await sleep(20);
    }
    await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
    await sleep(100);
    const row0 = await px(page, () => window.__px.grid[0].join(''));
    check(row0 === '1'.repeat(sol[0].length), `${name}: dragging fills a run of squares (${row0})`);

    await tapGame(W / 2 - 170, btnY);
    check(await px(page, () => window.__px.markTool), `${name}: the tool button switches to marking`);
    const [er, ec] = emptyCell(sol.slice(1)).map((v, i) => (i === 0 ? v + 1 : v));
    await tapCell(er, ec);
    check(await px(page, ([r, c]) => window.__px.grid[r][c], [er, ec]) === 2, `${name}: a tap marks with the mark tool`);
    await page.screenshot({ path: path.join(OUT, `phone-${name}-marking.png`) });
    await tapGame(W / 2 - 170, btnY);

    await tapGame(W / 2 + 20, btnY);   // Restart
    check(await waitFor(page, () => window.__px.grid.every((row) => row.every((v) => v === 0))), `${name}: Restart clears the board`);

    for (const [r, c] of filledCells(sol)) await tapCell(r, c);
    check(await waitFor(page, () => window.__px.won), `${name}: puzzle 1 solved by tapping`);
    await sleep(250);
    await tapGame(W / 2, H / 2);
    check(await waitFor(page, () => window.__px.scene === 'game' && window.__px.puzzle === 1), `${name}: a tap goes on to puzzle 2`);
    const [r1, c1] = filledCells(PUZZLES[1].solution)[0];
    await tapCell(r1, c1);
    check(await px(page, ([r, c]) => window.__px.grid[r][c], [r1, c1]) === 1, `${name}: taps still register after the scene change`);

    const s = toScreen(vp, 0, 0).s;
    if (name === 'landscape') check(80 * s >= 44, `${name}: buttons ≥ 44 px on screen (${Math.round(80 * s)})`);
    else console.log(`  note: portrait buttons are ${Math.round(80 * s)} px tall on screen (the game is landscape)`);

    await tapGame(W / 2 + 170, btnY);   // Menu
    check(await waitFor(page, () => window.__px.scene === 'splash'), `${name}: Menu returns to the title`);
    await ctx.close();
}

await browser.close();
for (const e of [...new Set(errors)]) { failures++; console.log(`  FAIL ${e}`); }
console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);

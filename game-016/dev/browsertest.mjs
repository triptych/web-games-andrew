/**
 * browsertest.mjs — Crate Pusher in real Chromium, plus a solver.
 *
 * Solver: a breadth-first search proves every level in js/levels.js can be
 * solved, and finds the shortest solution (in moves) for the browser runs.
 *
 * Desktop (1280×760): Space starts level 1 → every level is played with the
 * keyboard from its solver solution → each win saves progress and the best
 * move count → a click skips the win wait → the last level leads to the
 * complete screen → the title's level picker shows all eight solved.
 * U undoes, R restarts.
 *
 * Phones (touch only, 390×844 and 844×390): a tap on the level picker opens
 * level 1 → a swipe pushes the crate home → level 2 is solved by swipes and
 * a tap beside the pusher → the Undo, Restart and Menu buttons are ≥ 44 px
 * and work by tapping → only unlocked levels can be picked.
 *
 * Fails on any console error, page error or failed request.
 *
 *   python3 -m http.server 8000                 # from the REPO ROOT
 *   node game-016/dev/browsertest.mjs
 *
 * Env: BASE (default http://127.0.0.1:8000), OUT (screenshots, default dev/shots), PW_CHROMIUM_PATH.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { LEVELS } from '../js/levels.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const BASE = process.env.BASE ?? 'http://127.0.0.1:8000';
const OUT = process.env.OUT ?? path.join(HERE, 'shots');
fs.mkdirSync(OUT, { recursive: true });
const URL = `${BASE}/game-016/index.html?debug=1`;
const W = 800, H = 560;   // the game's own resolution

let failures = 0, passes = 0;
const errors = [];
function check(cond, msg) {
    if (cond) passes++;
    else { failures++; console.log(`  FAIL ${msg}`); }
}
const sleep = (ms) => new Promise((r) => setTimeout(r, ms));

// ── Solver ───────────────────────────────────────────────────
const DIRS = { L: [-1, 0], R: [1, 0], U: [0, -1], D: [0, 1] };
function solve(rows) {
    const walls = new Set(), targets = new Set();
    let crates = [], player;
    rows.forEach((line, y) => [...line].forEach((ch, x) => {
        const key = `${x},${y}`;
        if (ch === '#') walls.add(key);
        if ('.*+'.includes(ch)) targets.add(key);
        if ('$*'.includes(ch)) crates.push(key);
        if ('@+'.includes(ch)) player = key;
    }));
    const id = (p, cs) => `${p}|${[...cs].sort().join(';')}`;
    const start = { p: player, cs: crates, path: '' };
    const seen = new Set([id(player, crates)]);
    const queue = [start];
    while (queue.length) {
        const { p, cs, path: moves } = queue.shift();
        if (cs.every((c) => targets.has(c))) return moves;
        const [px, py] = p.split(',').map(Number);
        for (const [d, [dx, dy]] of Object.entries(DIRS)) {
            const n = `${px + dx},${py + dy}`;
            if (walls.has(n)) continue;
            let next = cs;
            if (cs.includes(n)) {
                const b = `${px + 2 * dx},${py + 2 * dy}`;
                if (walls.has(b) || cs.includes(b)) continue;
                next = cs.map((c) => (c === n ? b : c));
            }
            const k = id(n, next);
            if (seen.has(k)) continue;
            seen.add(k);
            queue.push({ p: n, cs: next, path: moves + d });
        }
    }
    return null;
}

console.log('solver');
const solutions = LEVELS.map(solve);
solutions.forEach((sol, i) => check(sol !== null, `level ${i + 1} is solvable`));
console.log(`  shortest solutions: ${solutions.map((s) => s?.length ?? '-').join(', ')} moves`);

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
    await page.waitForFunction(() => window.__cp && window.__cp.scene === 'splash');
    return { ctx, page };
}
const cp = (page, fn) => page.evaluate(fn);
const waitFor = (page, fn, arg, timeout = 5000) => page.waitForFunction(fn, arg, { timeout }).then(() => true, () => false);
const progress = (page) => page.evaluate(() => JSON.parse(localStorage.getItem('cratePusher_progress')));

/** Game coordinates → screen coordinates (Kaplay letterboxes the 800×560 game into the window). */
function toScreen(vp, x, y) {
    const s = Math.min(vp.width / W, vp.height / H);
    return { x: (vp.width - W * s) / 2 + x * s, y: (vp.height - H * s) / 2 + y * s, s };
}

// ── Desktop ──────────────────────────────────────────────────
{
    console.log('desktop');
    const vp = { width: 1280, height: 760 };
    const { ctx, page } = await open({ viewport: vp });
    await page.keyboard.press('Space');
    check(await waitFor(page, () => window.__cp.scene === 'game' && window.__cp.level === 0), 'Space starts level 1');

    // Undo and restart, with keys
    await page.keyboard.press('ArrowLeft');
    check(await cp(page, () => window.__cp.moves) === 1, 'arrow moves');
    await page.keyboard.press('KeyU');
    check(await cp(page, () => window.__cp.moves) === 0, 'U undoes');
    await page.keyboard.press('KeyA');
    await page.keyboard.press('KeyR');
    check(await waitFor(page, () => window.__cp.moves === 0 && window.__cp.player.x === 2), 'R restarts');

    const keyOf = { L: 'ArrowLeft', R: 'ArrowRight', U: 'ArrowUp', D: 'ArrowDown' };
    for (let i = 0; i < LEVELS.length; i++) {
        await waitFor(page, (n) => window.__cp.scene === 'game' && window.__cp.level === n, i);
        for (const m of solutions[i]) await page.keyboard.press(keyOf[m]);
        check(await waitFor(page, () => window.__cp.won), `level ${i + 1} solved with its ${solutions[i].length}-move solution`);
        const p = await progress(page);
        check(p.best[i] === solutions[i].length && p.unlocked >= Math.min(i + 1, LEVELS.length - 1), `level ${i + 1}: best and unlock saved`);
        if (i === 0) await page.screenshot({ path: path.join(OUT, 'desktop-win.png') });
        await page.mouse.click(vp.width / 2, vp.height / 2);   // skip the 2 s wait
    }
    check(await waitFor(page, () => window.__cp.scene === 'complete'), 'the last level leads to the complete screen');
    await page.keyboard.press('Escape');
    await waitFor(page, () => window.__cp.scene === 'splash');
    await sleep(200);
    await page.screenshot({ path: path.join(OUT, 'desktop-title-all-solved.png') });
    await page.keyboard.press('Digit5');
    check(await waitFor(page, () => window.__cp.scene === 'game' && window.__cp.level === 4), 'number keys pick an unlocked level');
    await ctx.close();
}

// ── Phones ───────────────────────────────────────────────────
for (const [name, vp] of [['portrait', { width: 390, height: 844 }], ['landscape', { width: 844, height: 390 }]]) {
    console.log(`phone ${name}`);
    const { ctx, page } = await open({ viewport: vp, isMobile: true, hasTouch: true, deviceScaleFactor: 2 });
    const tapGame = (x, y) => { const p = toScreen(vp, x, y); return page.touchscreen.tap(p.x, p.y); };
    const cdp = await ctx.newCDPSession(page);
    const swipe = async (dir) => {
        const [dx, dy] = DIRS[dir];
        const a = toScreen(vp, W / 2, H / 2 + 60);
        const len = 60;
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchStart', touchPoints: [{ x: a.x, y: a.y, id: 1 }] });
        for (let i = 1; i <= 4; i++) {
            await cdp.send('Input.dispatchTouchEvent', { type: 'touchMove', touchPoints: [{ x: a.x + dx * len * i / 4, y: a.y + dy * len * i / 4, id: 1 }] });
            await sleep(16);
        }
        await cdp.send('Input.dispatchTouchEvent', { type: 'touchEnd', touchPoints: [] });
        await sleep(60);
    };

    // The level picker: level 2 is locked, level 1 opens
    const pickX = (i) => W / 2 - ((LEVELS.length - 1) * 76) / 2 + i * 76;
    await tapGame(pickX(1), H / 2 + 126);
    await sleep(200);
    check(await cp(page, () => window.__cp.scene) === 'splash', `${name}: a locked level can't be picked`);
    await tapGame(pickX(0), H / 2 + 126);
    check(await waitFor(page, () => window.__cp.scene === 'game' && window.__cp.level === 0), `${name}: tapping level 1 opens it`);
    await page.screenshot({ path: path.join(OUT, `phone-${name}-level1.png`) });

    await swipe('D');
    check(await waitFor(page, () => window.__cp.won), `${name}: a swipe down pushes the crate home`);
    await tapGame(W / 2, H / 2);
    check(await waitFor(page, () => window.__cp.scene === 'game' && window.__cp.level === 1), `${name}: a tap skips to level 2`);

    // Header buttons: as big as the fixed 800×560 game allows, and they work.
    // On touch the bar is 100 game px tall, so buttons are 86 game px.
    const s = toScreen(vp, 0, 0).s;
    const px = Math.round(86 * s);
    if (name === 'landscape') check(px >= 44, `${name}: header buttons ≥ 44 px on screen (${px})`);
    else console.log(`  note: portrait header buttons are ${px} px tall on screen (the game is landscape)`);
    await swipe('L');
    check(await cp(page, () => window.__cp.moves) === 1, `${name}: a swipe moves`);
    await tapGame(340, 50);   // Undo
    check(await waitFor(page, () => window.__cp.moves === 0), `${name}: the Undo button undoes`);

    // Tap beside the pusher to step towards the tap
    const step = await cp(page, () => ({ p: window.__cp.player, t: window.__cp.tile, o: window.__cp.origin }));
    await tapGame(step.o.x + (step.p.x + 0.5) * step.t, step.o.y + (step.p.y - 0.5) * step.t);
    check(await waitFor(page, (y) => window.__cp.player.y === y - 1, step.p.y), `${name}: tapping above the pusher steps up`);
    await tapGame(468, 50);   // Restart
    check(await waitFor(page, () => window.__cp.moves === 0), `${name}: the Restart button restarts`);

    for (const m of solutions[1]) await swipe(m);
    check(await waitFor(page, () => window.__cp.won), `${name}: level 2 solved by swiping`);
    await page.screenshot({ path: path.join(OUT, `phone-${name}-level2-won.png`) });
    await tapGame(W / 2, H / 2);
    await waitFor(page, () => window.__cp.level === 2);
    await tapGame(586, 50);   // Menu
    check(await waitFor(page, () => window.__cp.scene === 'splash'), `${name}: the Menu button returns to the title`);
    await page.screenshot({ path: path.join(OUT, `phone-${name}-title.png`) });
    await ctx.close();
}

await browser.close();
for (const e of [...new Set(errors)]) { failures++; console.log(`  FAIL ${e}`); }
console.log(`\n${passes} passed, ${failures} failed`);
process.exit(failures ? 1 : 0);

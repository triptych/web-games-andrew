/**
 * mobiletest.mjs — the game as a phone sees it, driven ONLY by real touch input through CDP.
 *
 * Checks: tap title -> NEW GAME -> map; tapping a node enters the level; the D-pad walks Pip
 * right; A jumps; B shoots; the pause button pauses and RESUME resumes; EXIT returns to the map;
 * every control >= 44 css px, on screen, not overlapping each other or the game view (portrait);
 * the canvas scales by a whole number of device pixels; no console errors.
 *
 *   node dev/mobiletest.mjs              (portrait 390x844)
 *   LANDSCAPE=1 node dev/mobiletest.mjs  (landscape 844x390)
 * Needs a static server for the repo root at BASE (python3 -m http.server 8042).
 */
import { chromium, devices } from 'playwright';

const BASE = process.env.BASE ?? 'http://127.0.0.1:8042';
const LANDSCAPE = process.env.LANDSCAPE === '1';
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH, args: ['--no-sandbox'] });
const ctx = await browser.newContext({
    viewport: LANDSCAPE ? { width: 844, height: 390 } : { width: 390, height: 844 },
    deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: devices['iPhone 13'].userAgent,
});
const page = await ctx.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(String(e)));
const cdp = await ctx.newCDPSession(page);

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL', m); } };
const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
const tap = async (x, y) => { await touch('touchStart', [{ x, y, id: 1 }]); await page.waitForTimeout(60); await touch('touchEnd', []); await page.waitForTimeout(200); };
const rect = sel => page.evaluate(s => { const r = document.querySelector(s).getBoundingClientRect(); return { x: r.left, y: r.top, w: r.width, h: r.height }; }, sel);
const center = r => [r.x + r.w / 2, r.y + r.h / 2];
const st = () => page.evaluate(() => { const P = window.__pip; const g = P.game; return { screen: P.view.screen, overlay: P.view.overlay, px: g && g.player.x, py: g && g.player.y, shots: g && g.stats.shots, onGround: g && g.player.onGround, buttons: P.view.lastButtons, W: P.R.W, H: P.R.H, scale: P.view.scale }; });
// tap a canvas-drawn button by id
const tapButton = async id => {
    const s = await st();
    const b = s.buttons.find(b => b.id === id);
    if (!b) { ok(false, `button ${id} on screen (${s.screen})`); return; }
    const c = await rect('#screen');
    await tap(c.x + (b.x + b.w / 2) / s.W * c.w, c.y + (b.y + b.h / 2) / s.H * c.h);
};

await page.addInitScript(() => { try { localStorage.clear(); } catch {} });
await page.goto(`${BASE}/game-042/index.html`);
await page.waitForTimeout(800);
let s = await st();
ok(s.screen === 'title', 'boots to the title');
await tapButton('new');
await page.waitForTimeout(400);
s = await st();
ok(s.screen === 'map', 'NEW GAME opens the map');

// canvas scaling is a whole number of device pixels
const cv = await rect('#screen');
ok(Math.abs(cv.w * 3 / s.W - Math.round(cv.w * 3 / s.W)) < 0.01, `canvas is an integer multiple (${(cv.w * 3 / s.W).toFixed(3)}x)`);

await tapButton('node0');
await page.waitForTimeout(2600);
s = await st();
ok(s.screen === 'play', 'tapping the selected node enters the level');

// control geometry
const ids = ['#dpad', '#b-jump', '#b-fire', '#b-swap', '#b-pause'];
const rs = {};
for (const id of ids) rs[id] = await rect(id);
const vp = page.viewportSize();
for (const id of ids) {
    const r = rs[id];
    ok(r.w >= 44 && r.h >= 28 && (id === '#b-swap' || r.h >= 44), `${id} is big enough (${r.w.toFixed(0)}x${r.h.toFixed(0)})`);
    ok(r.x >= 0 && r.y >= 0 && r.x + r.w <= vp.width + 0.5 && r.y + r.h <= vp.height + 0.5, `${id} is on screen`);
}
const over = (a, b) => a.x < b.x + b.w && a.x + a.w > b.x && a.y < b.y + b.h && a.y + a.h > b.y;
for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) ok(!over(rs[ids[i]], rs[ids[j]]), `${ids[i]} and ${ids[j]} don't overlap`);
if (!LANDSCAPE) for (const id of ids) ok(!over(rs[id], cv), `${id} is below the game view in portrait`);

// walk right with the D-pad
s = await st();
const x0 = s.px;
const dp = rs['#dpad'];
await touch('touchStart', [{ x: dp.x + dp.w * 0.85, y: dp.y + dp.h / 2, id: 1 }]);
await page.waitForTimeout(700);
s = await st();
ok(s.px > x0 + 20, `D-pad right walks Pip (${x0.toFixed(0)} -> ${s.px.toFixed(0)})`);
// jump with A while still holding right (second finger)
const [ax, ay] = center(rs['#b-jump']);
await touch('touchMove', [{ x: dp.x + dp.w * 0.85, y: dp.y + dp.h / 2, id: 1 }, { x: ax, y: ay, id: 2 }]);
await page.waitForTimeout(120);
s = await st();
ok(!s.onGround, 'A jumps (with the D-pad still held)');
await touch('touchEnd', []);
await page.waitForTimeout(600);
// shoot
const shots0 = (await st()).shots;
const [bx, by] = center(rs['#b-fire']);
await touch('touchStart', [{ x: bx, y: by, id: 3 }]);
await page.waitForTimeout(500);
await touch('touchEnd', []);
s = await st();
ok(s.shots > shots0 + 1, `holding B autofires (${s.shots - shots0} shots)`);

// pause / resume / exit
await tap(...center(rs['#b-pause']));
s = await st();
ok(s.overlay === 'pause', 'pause button pauses');
const backVisible = await page.evaluate(() => getComputedStyle(document.getElementById('back')).display !== 'none');
ok(backVisible, 'the ← Games link is reachable while paused');
await tapButton('resume');
s = await st();
ok(s.overlay === null, 'RESUME resumes');
const backHidden = await page.evaluate(() => getComputedStyle(document.getElementById('back')).display === 'none');
ok(backHidden, 'the ← Games link is out of the way during play');
await tap(...center(rs['#b-pause']));
await tapButton('exit');
await page.waitForTimeout(300);
s = await st();
ok(s.screen === 'map', 'EXIT TO MAP returns to the map');

ok(errors.length === 0, 'no console errors: ' + errors.join(' | '));
console.log(`\n${LANDSCAPE ? 'landscape' : 'portrait'}: ${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);

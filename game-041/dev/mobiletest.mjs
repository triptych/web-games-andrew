/**
 * mobiletest.mjs — the game as a phone sees it: an emulated phone (touch, isMobile,
 * dpr 3) driven ONLY by real touch input through CDP. No keyboard, no mouse.
 *
 * Checks: tap starts the game; dragging the stick moves the miner; the tray enters
 * build mode and a tap on dirt builds; PUMP throws the harpoon; pause/resume work;
 * every control is >= 44 css px and no two controls overlap; no console errors.
 *
 *   node dev/mobiletest.mjs              (portrait 390x844)
 *   LANDSCAPE=1 node dev/mobiletest.mjs  (landscape 844x390)
 * Needs a static server for the repo root at BASE (python3 -m http.server 8041).
 */
import { chromium, devices } from 'playwright';

const BASE = process.env.BASE ?? 'http://127.0.0.1:8041';
const LANDSCAPE = process.env.LANDSCAPE === '1';
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH, args: ['--no-sandbox', '--use-gl=swiftshader', '--enable-unsafe-swiftshader'] });
const ctx = await browser.newContext({
    viewport: LANDSCAPE ? { width: 844, height: 390 } : { width: 390, height: 844 },
    deviceScaleFactor: 3, isMobile: true, hasTouch: true, userAgent: devices['iPhone 13'].userAgent,
});
// Pin FX: software GL in a sandbox is slow enough that auto-quality would drop to LOW
// mid-test, which changes the pixel ratio under the test's feet.
await ctx.addInitScript(() => { try { localStorage.setItem('burrowguard.fx', 'high'); } catch {} });
const page = await ctx.newPage();
const errors = [];
page.on('console', m => { if (m.type() === 'error') errors.push(m.text()); });
page.on('pageerror', e => errors.push(String(e)));
const cdp = await ctx.newCDPSession(page);

let pass = 0, fail = 0;
const ok = (c, m) => { if (c) pass++; else { fail++; console.log('  FAIL', m); } };
const touch = (type, pts) => cdp.send('Input.dispatchTouchEvent', { type, touchPoints: pts });
const tap = async (x, y, id = 1) => { await touch('touchStart', [{ x, y, id }]); await page.waitForTimeout(60); await touch('touchEnd', []); await page.waitForTimeout(120); };
const state = () => page.evaluate(() => {
    const { game: g, view, layout: L } = window.__burrowguard;
    return {
        screen: view.screen, paused: view.paused, phase: g.phase, buildType: g.buildType, towers: g.towers.length,
        px: g.player.x, py: g.player.y, throws: g.stats.throws, gold: g.gold,
        dpr: L.dpr, field: L.field, tray: L.tray, pump: L.pump, pause: L.pause, hud: L.hud,
        buttons: view.lastButtons.map(b => ({ id: b.id, x: b.x, y: b.y, w: b.w, h: b.h })),
    };
});
const css = (v, dpr) => v / dpr;

await page.goto(`${BASE}/game-041/index.html`);
await page.waitForTimeout(800);
await tap(200, 300);
await page.waitForTimeout(300);
let s = await state();
ok(s.screen === 'game', 'a tap on the title starts the game');

// Wait out READY, keep the wave away.
await page.evaluate(() => { const g = window.__burrowguard.game; g.phaseT = 0; g.countdown = 999; });
await page.waitForTimeout(300);
s = await state();
const d = s.dpr;

// --- control geometry
const rects = s.buttons.filter(b => b.id !== 'pump').map(b => ({ ...b, x: css(b.x, d), y: css(b.y, d), w: css(b.w, d), h: css(b.h, d) }));
const pr = css(s.pump.r, d);
ok(pr * 2 >= 44, `PUMP is ${Math.round(pr * 2)}px`);
for (const r of rects) ok(r.w >= 44 && r.h >= 44, `${r.id} is ${Math.round(r.w)}x${Math.round(r.h)} (>= 44)`);
const all = [...rects, { id: 'pump', x: css(s.pump.x, d) - pr, y: css(s.pump.y, d) - pr, w: pr * 2, h: pr * 2 },
    { id: 'field', x: css(s.field.x, d), y: css(s.field.y, d), w: css(s.field.w, d), h: css(s.field.h, d) },
    { id: 'link', x: 8, y: 8, w: 80, h: 31 }];
const vw = LANDSCAPE ? 844 : 390, vh = LANDSCAPE ? 390 : 844;
for (const a of all) ok(a.x >= 0 && a.y >= 0 && a.x + a.w <= vw + 0.5 && a.y + a.h <= vh + 0.5, `${a.id} is on screen`);
for (let i = 0; i < all.length; i++) for (let j = i + 1; j < all.length; j++) {
    const a = all[i], b = all[j];
    const hit = a.x < b.x + b.w - 0.5 && b.x < a.x + a.w - 0.5 && a.y < b.y + b.h - 0.5 && b.y < a.y + a.h - 0.5;
    ok(!hit, `${a.id} and ${b.id} do not overlap`);
}

// --- steer with the stick: thumb down in the stick zone, drag right, hold.
const stickX = LANDSCAPE ? 120 : 90, stickY = LANDSCAPE ? 300 : vh - 90;
const x0 = s.px;
await touch('touchStart', [{ x: stickX, y: stickY, id: 1 }]);
for (let k = 1; k <= 5; k++) { await touch('touchMove', [{ x: stickX + k * 8, y: stickY, id: 1 }]); await page.waitForTimeout(16); }
await page.waitForTimeout(700);
s = await state();
await touch('touchEnd', []);
ok(s.px > x0 + 0.5, `dragging right walks the miner right (${x0} -> ${s.px.toFixed(2)})`);
await page.waitForTimeout(200);
const stopped = (await state()).px;
await page.waitForTimeout(300);
ok(Math.abs((await state()).px - stopped) < 0.01, 'lifting the thumb stops him');

// --- build: tap BLASTER in the tray, then a dirt cell next to a tunnel.
const t0 = s.tray[0];
await tap(css(t0.x + t0.w / 2, d), css(t0.y + t0.h / 2, d));
s = await state();
ok(s.buildType === 'blaster', 'tapping the tray enters build mode');
const cell = await page.evaluate(() => {
    const { game: g } = window.__burrowguard; const w = g.world;
    for (let r = 2; r < 17; r++) for (let c = 0; c < 13; c++) if (g.canBuild(c, r, null) && [[1,0],[-1,0],[0,1],[0,-1]].some(([a,b]) => w.isTunnel(c+a, r+b))) return { c, r };
});
await tap(css(s.field.x + (cell.c + 0.5) * s.field.tile, d), css(s.field.y + (cell.r + 0.5) * s.field.tile, d));
s = await state();
ok(s.towers === 1 && s.buildType === null, 'a tap on dirt builds the tower and leaves build mode');

// --- tap the tower to select it, then SELL from the tray
await tap(css(s.field.x + (cell.c + 0.5) * s.field.tile, d), css(s.field.y + (cell.r + 0.5) * s.field.tile, d));
const sel = await page.evaluate(() => !!window.__burrowguard.game.selected);
ok(sel, 'tapping a tower selects it');
s = await state();
const sellBtn = s.buttons.find(b => b.id === 'sell');
ok(!!sellBtn, 'selected tower shows SELL');
if (sellBtn) { await tap(css(sellBtn.x + sellBtn.w / 2, d), css(sellBtn.y + sellBtn.h / 2, d)); }
ok((await state()).towers === 0, 'SELL removes it');

// --- pump: hold the button with a second finger while the first rests on the stick zone
await touch('touchStart', [{ x: stickX, y: stickY, id: 1 }, { x: css(s.pump.x, d), y: css(s.pump.y, d), id: 2 }]);
const throws0 = s.throws;
await page.waitForTimeout(120);
const thrown = (await state()).throws - throws0;
await touch('touchEnd', []);
ok(thrown >= 1, `PUMP throws the harpoon with two fingers down at once (${thrown})`);

// --- pause and resume
await tap(css(s.pause.x + s.pause.w / 2, d), css(s.pause.y + s.pause.h / 2, d));
s = await state();
ok(s.paused, 'pause button pauses');
const resume = s.buttons.find(b => b.id === 'resume');
ok(!!resume && css(resume.h, d) >= 44, 'pause menu has a thumb-sized RESUME');
if (resume) await tap(css(resume.x + resume.w / 2, d), css(resume.y + resume.h / 2, d));
ok(!(await state()).paused, 'RESUME resumes');

ok(errors.length === 0, 'no console errors: ' + errors.slice(0, 3).join(' | '));
console.log(`${LANDSCAPE ? 'landscape' : 'portrait'}: ${pass} passed, ${fail} failed`);
await browser.close();
process.exit(fail ? 1 : 0);

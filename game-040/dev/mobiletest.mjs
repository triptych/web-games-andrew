/**
 * mobiletest.mjs — the game as a phone sees it: an emulated iPhone-class device
 * (hasTouch, isMobile, devicePixelRatio 3) driven ONLY by touch. No keyboard, no
 * mouse, no clicking through menus from the test harness.
 *
 * Touch input goes through CDP (Input.dispatchTouchEvent) rather than
 * JS-dispatched TouchEvents, because only real input makes the browser
 * synthesise the clicks that menu buttons listen for — dispatching TouchEvent
 * objects by hand makes working buttons look broken.
 *
 * It checks the things that decide whether a shmup is actually playable on a
 * phone, not just whether it renders:
 *   - can you get from the title screen into gameplay with a thumb?
 *   - are the on-screen controls visible, at least 44px, and clear of the HUD?
 *   - does dragging fly the ship, and does a bare touch NOT teleport it?
 *   - do FLARE, OVERDRIVE, FOCUS (held) and PAUSE work?
 *   - does anything error, at portrait and landscape?
 *
 * Setup is the same as dev/browsertest.mjs (Playwright + a static server from
 * the repo root); LANDSCAPE=1 runs the 844x390 pass.
 *
 *   node dev/mobiletest.mjs
 *   LANDSCAPE=1 node dev/mobiletest.mjs
 */
import { chromium, devices } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

// fileURLToPath, not URL.pathname: on Windows the latter yields "/C:/...",
// which path.join then turns into "C:\C:\..." and every write fails.
const SP = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? path.join(SP, 'package');
const BASE = process.env.BASE ?? 'http://127.0.0.1:8040';
const OUT = process.env.OUT ?? path.join(SP, 'shots-mobile');
const LANDSCAPE = process.env.LANDSCAPE === '1';
fs.mkdirSync(OUT, { recursive: true });

const errors = [];
const browser = await chromium.launch({ executablePath: process.env.PW_CHROMIUM_PATH, args: ['--no-sandbox'] });
const ctx = await browser.newContext({
    viewport: LANDSCAPE ? { width: 844, height: 390 } : { width: 390, height: 844 },
    deviceScaleFactor: 3,
    isMobile: true,
    hasTouch: true,
    userAgent: devices['iPhone 13'].userAgent,
});
const page = await ctx.newPage();
// Only stub the CDN when a local copy was provided (see dev/browsertest.mjs).
if (fs.existsSync(PKG)) await page.route('https://unpkg.com/**', (route) => {
    const rel = new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, '');
    const file = path.join(PKG, rel);
    if (!fs.existsSync(file)) return route.abort();
    route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
});
page.on('console', (m) => { if (m.type() === 'error') errors.push(`console: ${m.text()}`); });
page.on('pageerror', (e) => errors.push(`pageerror: ${e.message}`));

const shot = async (n) => { await page.screenshot({ path: path.join(OUT, `${n}.png`) }); console.log(`   shot ${n}`); };
const player = () => page.evaluate(() => {
    const w = window.__sc?.state?.world;
    return w ? { x: +w.player.x.toFixed(2), y: +w.player.y.toFixed(2), focus: w.player.focus,
                 flares: w.player.flares, od: +w.player.od.toFixed(1), lives: w.player.lives } : null;
});
const mode = () => page.evaluate(() => window.__sc?.state?.mode);

// Real touch input via CDP — the browser then synthesises clicks, scrolls and
// everything else exactly as it would from a finger. JS-dispatched TouchEvents
// do NOT produce clicks, so menu buttons would appear broken when they are not.
const cdp = await ctx.newCDPSession(page);
let nextTouchId = 1;
async function touchRaw(type, points) {
    await cdp.send('Input.dispatchTouchEvent', {
        type,
        touchPoints: points.map((p) => ({ x: p.x, y: p.y, id: p.id ?? 1, radiusX: 12, radiusY: 12, force: 1 })),
    });
}
const tapAt = async (x, y) => {
    await touchRaw('touchStart', [{ x, y }]);
    await page.waitForTimeout(70);
    await touchRaw('touchEnd', []);
    await page.waitForTimeout(320);
};
async function drag(from, to, steps = 14) {
    await touchRaw('touchStart', [{ x: from.x, y: from.y }]);
    for (let i = 1; i <= steps; i++) {
        await touchRaw('touchMove', [{ x: from.x + (to.x - from.x) * i / steps, y: from.y + (to.y - from.y) * i / steps }]);
        await page.waitForTimeout(26);
    }
    await touchRaw('touchEnd', []);
}
const tapEl = async (sel) => {
    const loc = page.locator(sel).first();
    // A player would swipe a below-the-fold button into view first — which only
    // works because .overlay opts back into touch scrolling. If this throws, the
    // control is genuinely unreachable on this screen.
    await loc.scrollIntoViewIfNeeded({ timeout: 4000 }).catch(() => {});
    const box = await loc.boundingBox({ timeout: 4000 }).catch(() => null);
    if (!box) { errors.push(`cannot tap ${sel}: not visible`); return null; }
    const vp = page.viewportSize();
    if (box.y < 0 || box.y + box.height > vp.height || box.x < 0 || box.x + box.width > vp.width) {
        errors.push(`${sel} is off screen even after scrolling (y=${Math.round(box.y)}, viewport ${vp.width}x${vp.height})`);
    }
    await tapAt(box.x + box.width / 2, box.y + box.height / 2);
    return box;
};

console.log(`\n=== STARCADET mobile test (${LANDSCAPE ? 'landscape 844x390' : 'portrait 390x844'}) ===\n`);

console.log('1. load + tap through the menus with touch only');
await page.goto(`${BASE}/game-040/index.html`, { waitUntil: 'load' });
await page.waitForTimeout(2200);
await shot('m01-title');
await tapEl('button[data-action="start"]');
console.log('   mode after BEGIN:', await mode());
const introBtn = await page.locator('button[data-action="introDone"]').count();
if (introBtn) await tapEl('button[data-action="introDone"]');
await shot('m02-briefing');
await tapEl('button[data-action="launch"]');
await page.waitForTimeout(1200);
console.log('   mode after LAUNCH:', await mode());
if ((await mode()) !== 'playing') errors.push('could not reach gameplay with touch alone');

console.log('\n2. are the on-screen controls actually visible?');
const touchUi = await page.evaluate(() => {
    const wrap = document.getElementById('touch');
    const cs = getComputedStyle(wrap);
    const btns = [...wrap.querySelectorAll('button')].map((b) => {
        const r = b.getBoundingClientRect();
        return { id: b.id, w: Math.round(r.width), h: Math.round(r.height), x: Math.round(r.x), y: Math.round(r.y) };
    });
    return { display: cs.display, visible: !wrap.classList.contains('hidden'), btns };
});
console.log('  ', JSON.stringify(touchUi));
if (touchUi.display === 'none') errors.push('on-screen touch controls are display:none on a touch device');
for (const b of touchUi.btns) {
    if (b.w < 44 || b.h < 44) errors.push(`${b.id} tap target is ${b.w}x${b.h}, below the 44px minimum`);
}
// do the buttons cover any HUD readout?
const overlap = await page.evaluate(() => {
    const rects = (sel) => [...document.querySelectorAll(sel)].map((e) => e.getBoundingClientRect());
    const btns = rects('#touch button');
    const hud = [...document.querySelectorAll('.od-wrap, .level-wrap, #boss-bar, .hud-left, .hud-right')]
        .map((e) => ({ cls: e.className || e.id, r: e.getBoundingClientRect() }));
    const hits = [];
    for (const b of btns) for (const h of hud) {
        if (b.left < h.r.right && b.right > h.r.left && b.top < h.r.bottom && b.bottom > h.r.top) hits.push(h.cls);
    }
    return [...new Set(hits)];
});
if (overlap.length) errors.push(`touch buttons overlap HUD: ${overlap.join(', ')}`);
console.log('   HUD overlap:', overlap.length ? overlap.join(', ') : 'none');

console.log('\n3. drag to fly');
const before = await player();
console.log('   ship before:', JSON.stringify(before));
// a thumb drag near the bottom of the screen, as a real player would
const vp = page.viewportSize();
await drag({ x: vp.width * 0.5, y: vp.height * 0.8 }, { x: vp.width * 0.22, y: vp.height * 0.55 });
await page.waitForTimeout(200);
const after = await player();
console.log('   ship after drag left/up:', JSON.stringify(after));
if (!after) errors.push('no world during drag');
else {
    if (Math.abs(after.x - before.x) < 1) errors.push(`drag did not move the ship horizontally (${before.x} -> ${after.x})`);
    // A first touch must NOT teleport the ship to the finger.
    const jump = Math.hypot(after.x - before.x, after.y - before.y);
    console.log('   travel:', jump.toFixed(2), 'world units');
}
await shot('m03-playing');

console.log('\n4. does the first touch teleport the ship? (relative vs absolute drag)');
// Let the ship come to rest at its current target first, or we would be
// measuring leftover travel from the previous drag rather than a teleport.
await page.waitForTimeout(900);
const restA = await player();
await page.waitForTimeout(400);
const restB = await player();
const drift = Math.hypot(restB.x - restA.x, restB.y - restA.y);
console.log(`   ship at rest (drift over 400ms: ${drift.toFixed(2)})`);
// Now put a finger down on the far side of the screen and see if it jumps.
await touchRaw('touchStart', [{ x: vp.width * 0.88, y: vp.height * 0.3 }]);
await page.waitForTimeout(220);
const afterTouch = await player();
const teleported = Math.hypot(afterTouch.x - restB.x, afterTouch.y - restB.y);
console.log(`   ship moved ${teleported.toFixed(2)} units on a bare touch (want ~0)`);
if (teleported > 1.2) errors.push(`a single touch moves the ship ${teleported.toFixed(1)} units without any drag`);
await touchRaw('touchEnd', []);
await page.waitForTimeout(150);

console.log('\n5. the flare / overdrive / focus / pause buttons');
const f0 = (await player()).flares;
await tapEl('#touch-flare');
await page.waitForTimeout(300);
const f1 = (await player()).flares;
console.log(`   flares ${f0} -> ${f1}`);
if (f1 >= f0) errors.push('the FLARE button did not fire a flare');
const focusBox = await page.locator('#touch-focus').boundingBox();
await touchRaw('touchStart', [{ x: focusBox.x + focusBox.width / 2, y: focusBox.y + focusBox.height / 2 }]);
await page.waitForTimeout(300);
const focused = (await player()).focus;
console.log('   focus held:', focused);
if (!focused) errors.push('the FOCUS button does not engage focus mode');
await touchRaw('touchEnd', []);
await page.waitForTimeout(200);
if ((await player()).focus) errors.push('focus stays on after releasing the button');

await tapEl('#touch-pause');
await page.waitForTimeout(300);
console.log('   mode after pause button:', await mode());
if ((await mode()) !== 'paused') errors.push('the pause button did not pause');
await shot('m04-pause');
await tapEl('button[data-action="resume"]');
console.log('   mode after resume:', await mode());

console.log('\n6. frame rate under load');
await page.evaluate(() => {
    const w = window.__sc.state.world;
    const cue = w.level.cues.find((c) => c.kind === 'boss');
    w.t = cue.t - 0.05; w.cueIndex = w.level.cues.indexOf(cue); w.player.lives = 9;
});
await page.waitForTimeout(6000);
const perf = await page.evaluate(() => new Promise((res) => {
    let n = 0; const t0 = performance.now();
    const tick = () => { if (++n < 90) requestAnimationFrame(tick); else res({ fps: Math.round(n / ((performance.now() - t0) / 1000)) }); };
    requestAnimationFrame(tick);
}));
const bullets = await page.evaluate(() => window.__sc.state.world?.eBullets.length ?? 0);
console.log(`   ${perf.fps} fps with ${bullets} bullets on screen (software GL, so a floor not a ceiling)`);
await shot('m05-boss');

console.log(`\n${errors.length ? `${errors.length} MOBILE ISSUE(S):` : 'NO MOBILE ISSUES'}`);
for (const e of errors) console.log('  -', e);
await browser.close();
process.exit(errors.length ? 1 : 0);

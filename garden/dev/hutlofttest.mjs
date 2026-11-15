/**
 * hutlofttest.mjs — drives the Hut's loft in real Chromium: walk up the stair
 * (the floor changes on the way, and the window's name is announced), sit at
 * the old computer (it boots, the survey turns, the keys work, Esc puts you
 * back), play the flute (a learned song does its thing, a recorded tune is
 * kept), sleep in the bed (the clock jumps to evening or morning and the
 * twinkle lights follow), and come back down (the window finds a new picture).
 * Screenshots of each. Fails on any console error or page error. Needs ?debug.
 *
 *   python3 -m http.server 8077            # from the REPO ROOT
 *   node garden/dev/hutlofttest.mjs
 *
 * Env: BASE, THREE_PKG (see browsertest.mjs), SHOTS=0 to skip screenshots,
 * PHONE=1 to run on a touch phone viewport instead. Runs with ?bigdt so walks
 * and the sleep take a handful of frames on a slow software renderer.
 */
import { chromium } from 'playwright';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const PKG = process.env.THREE_PKG ?? path.join(HERE, 'package');
const BASE = process.env.BASE ?? 'http://127.0.0.1:8077';
const OUT = path.join(HERE, 'shots');
const SHOTS = process.env.SHOTS !== '0';
const PHONE = process.env.PHONE === '1';
fs.mkdirSync(OUT, { recursive: true });
const errors = [];
const check = (cond, msg) => {
    if (!cond) throw new Error('FAILED: ' + msg + (errors.length ? '\n  ' + errors.slice(0, 5).join('\n  ') : ''));
    console.log('  ok  ' + msg);
};
const browser = await chromium.launch({
    executablePath: process.env.PW_CHROMIUM_PATH || undefined,
    args: ['--use-gl=angle', '--use-angle=swiftshader', '--enable-unsafe-swiftshader', '--no-sandbox', '--autoplay-policy=no-user-gesture-required'],
});
const ctx = await browser.newContext(PHONE ? { viewport: { width: 390, height: 844 }, deviceScaleFactor: 1, isMobile: true, hasTouch: true } : { viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
await ctx.addInitScript(() => localStorage.clear());
const page = await ctx.newPage();
if (fs.existsSync(PKG)) {
    await ctx.route('https://unpkg.com/**', (route) => {
        const rel = new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, '');
        const file = path.join(PKG, rel);
        if (!fs.existsSync(file)) return route.abort();
        route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
    });
}
await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.fulfill({ status: 200, contentType: 'text/css', body: '' }));
page.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text()));
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message + '\n' + e.stack));

const G = (expr) => page.evaluate(`(() => { const g = window.__garden; return ${expr}; })()`);
const until = (expr, timeout = 600000) => page.waitForFunction(`(() => { const g = window.__garden; return ${expr}; })()`, null, { timeout, polling: 100 }).catch((e) => {
    throw new Error(`timed out waiting for ${expr}` + (errors.length ? '\n  ' + errors.slice(0, 5).join('\n  ') : ''), { cause: e });
});
const frames = (n) => page.evaluate((n) => new Promise((res) => { let k = 0; const f = () => (++k >= n ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
const shot = async (name) => {
    if (!SHOTS) return;
    await frames(4);
    await page.screenshot({ path: path.join(OUT, `loft-${PHONE ? 'phone-' : ''}${name}.png`), timeout: 180000 });
};
const project = (x, y, z) => page.evaluate(([x, y, z]) => {
    const g = window.__garden, v = g.camera.position.clone().set(x, y, z).project(g.camera);
    return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight, front: v.z < 1 && Math.abs(v.x) < 1 && Math.abs(v.y) < 1 };
}, [x, y, z]);
const click = async (p) => (PHONE ? page.touchscreen.tap(p.x, p.y) : page.mouse.click(p.x, p.y));
/** Stand at (x, z) on the floor you are on, looking at (tx, ty, tz). */
const stand = (x, z, tx, ty, tz) => G(`(() => {
    const c = g.controls, eye = g.hut.heightAt(${x}, ${z}) + 1.65;
    c.teleport(${x}, ${z}, Math.atan2(-(${tx} - ${x}), -(${tz} - ${z})));
    c.pitch = Math.atan2(${ty} - eye, Math.hypot(${tx} - ${x}, ${tz} - ${z}));
})()`);

// ------------------------------------------------------------------ in by day
await page.goto(`${BASE}/index.html?debug&enter&pr=${process.env.PR ?? 0.6}&t=0.45&bigdt${process.env.Q ? '&q=' + process.env.Q : ''}`);
await until('g?.entered', 900000);
// hold the clock still (with ?bigdt a day goes by in a few minutes); sleeping still moves it
await G('g.sky.paused = true');
const outside = await G('(() => { const h = g.world.hut; return { x: h.out.x, z: h.out.z, yaw: h.out.yaw, cx: h.cx, cz: h.cz }; })()');
// the dormer and its window, from the path
await G(`(() => { const h = g.world.hut; g.controls.teleport(h.x + (h.x - h.cx) * 3.2, h.z + (h.z - h.cz) * 3.2, Math.atan2(-(h.cx - h.x), -(h.cz - h.z))); g.controls.pitch = 0.12; })()`);
await frames(10);
await shot('0-outside');
await G('g.throughDoor(true, "hut")');
await until("g.roomKind === 'hut' && !!g.hut", 120000);
check(errors.length === 0, 'the hut builds with its loft');
check(await G('g.hut.level === 0'), 'you come in on the ground floor');
const name0 = await G('g.hut.loft.glass.name');
check(/^The \w+ \w+$/.test(name0), `the window has a design: ${name0}`);

// the stair from the room
await stand(-0.2, 0.6, 2.4, 1.0, 1.9);
await frames(6);
await shot('1-stair');
const sp = await project(2.7, 0.8, 1.6);
check(sp.front, 'the stair is on screen');
await click(sp);
await until('g.hut.level === 1 && !g.controls.route', 300000);
check(true, 'clicking the stair walks you up it, and you are on the loft floor');
check(await G('Math.abs(g.controls.pos.y - 3.1) < 0.01'), 'the loft floor is 3.1 m up');
check(await G("document.getElementById('banner').textContent.includes('" + name0 + "')"), 'the window is announced as you arrive');

// the loft by day
await stand(1.0, 1.4, 0, 5.2, -3);
await frames(20);
await shot('2-loft-day');
await stand(-0.3, -0.2, -2.3, 3.5, -2);
await frames(6);
await shot('3-bed');

// can't walk off the edge into the stairwell, nor out of the door below
await G('g.controls.teleport(1.6, 1.0, -Math.PI / 2)');
await G("g.controls.keys.add('w')");
await frames(8);
await G("g.controls.keys.delete('w')");
const edge = await G('({ x: g.controls.pos.x, y: g.controls.pos.y, z: g.controls.pos.z, level: g.hut.level })');
// you may slide along the rail to the strip of floor in front of it, but never into the stairwell
const inHole = edge.x > 2.2 && edge.z > -0.45 && edge.z < 2.2;
check(!inHole && edge.level === 1 && Math.abs(edge.y - 3.1) < 0.01, `the rail round the stairwell holds you (stopped at ${edge.x.toFixed(2)}, ${edge.z.toFixed(2)})`);
await G('g.controls.teleport(0, 2.5, 0)');
await frames(10);
check(await G("g.roomKind === 'hut'"), 'standing over the door upstairs does not take you outside');

// ------------------------------------------------------------------ the computer
await stand(1.84, -1.2, 1.84, 4.1, -2.5);
await frames(6);
await shot('4-desk');
const scr = await G('(() => { const p = g.hut.loft.screenPos; return { x: p.x, y: p.y, z: p.z }; })()');
await click(await project(scr.x, scr.y, scr.z));
await until("!document.getElementById('herc').hidden", 5000);
check(await G('g.hut.busy && !g.controls.enabled'), 'clicking the computer sits you down at it');
await until('g.hut.loft.terminal.booted', 20000);
check(true, 'it boots HUT-DOS and starts the survey');
await page.waitForTimeout(600);
await shot('5-computer');
await page.keyboard.down('ArrowRight');
await page.waitForTimeout(300);
await page.keyboard.up('ArrowRight');
await page.keyboard.press('v');
await page.waitForTimeout(400);
check(await G("g.hut.loft.terminal.view.mode === 'map'"), 'V flips to the contour map');
await page.keyboard.press('Tab');
await page.waitForTimeout(900);
check(await G('g.hut.loft.terminal.view.sel === 0'), 'Tab picks the first site');
await shot('6-computer-map');
await page.keyboard.press('Escape');
await until("document.getElementById('herc').hidden", 5000);
check(await G("!g.hut.busy && g.controls.enabled && g.roomKind === 'hut'"), 'Esc gets you up again, still in the loft');

// ------------------------------------------------------------------ the flute
const fl = await G('(() => { const p = g.hut.loft.flute.position; return { x: p.x, y: p.y, z: p.z }; })()');
await stand(fl.x + 0.2, fl.z + 1.0, fl.x, fl.y, fl.z);
await frames(4);
await click(await project(fl.x, fl.y, fl.z));
await until("!document.getElementById('flute-ui').hidden", 5000);
check(true, 'clicking the flute opens the songbook');
// learn the Lantern Waltz and play it: the lights dance
await page.click('[data-act="book"]');
await page.click('[data-learn="lanterns"]');
const waltz = ['a', 's', 'd', 'f', 'g', 'h', 'j', 'k'];
const notes = [4, 7, 6, 5, 4, 2, 4, 3, 5, 4, 3, 2];
for (const n of notes) {
    await page.keyboard.down(waltz[n]);
    await page.waitForTimeout(90);
    await page.keyboard.up(waltz[n]);
    await page.waitForTimeout(40);
}
await page.waitForTimeout(600);
await frames(2);
check(await G('g.hut.loft.danceUntil > g.hut.loft.time'), 'playing the Lantern Waltz sets the twinkle lights dancing');
// record a little tune
await page.keyboard.press('r');
for (const k of ['a', 'd', 'g', 'k', 'g']) {
    await page.keyboard.down(k);
    await page.waitForTimeout(120);
    await page.keyboard.up(k);
}
await page.keyboard.press('r');
check(await G('g.hut.loft.fluteUI.mine.length === 1 && g.hut.loft.fluteUI.mine[0].notes.length === 5'), 'a recorded tune is kept in the songbook');
check(await G("JSON.parse(localStorage.getItem('garden.fluteSongs')).length === 1"), 'and remembered in storage');
await shot('7-flute');
await page.keyboard.press('Escape');
await until("document.getElementById('flute-ui').hidden", 5000);
check(await G('!g.hut.busy && g.controls.enabled'), 'Esc puts the flute down');
await frames(3);
await stand(0.6, 1.2, -0.6, 5.6, -0.5);
await frames(4);
await shot('8-lights-dance');

// ------------------------------------------------------------------ sleep
const t0 = await G('g.sky.time');
await stand(-0.6, -0.8, -2.3, 3.6, -1.9);
await frames(4);
await click(await project(-2.5, 3.6, -1.0));
await until('g.hut.busy', 5000);
check(true, 'clicking the bed lies you down');
await until('!g.hut.busy', 300000);
const t1 = await G('g.sky.time');
check(t0 > 0.3 && t0 < 0.7 && Math.abs(t1 - 0.812) < 0.02, `a nap by day wakes you at dusk (${t0.toFixed(3)} → ${t1.toFixed(3)})`);
await G('g.sky.setTime(0.95)');
await frames(4);
check(await G('g.hut.loft.lightsOn > 0.4'), 'at night the twinkle lights are on');
await stand(0.8, 1.4, -0.4, 5.3, -1.6);
await frames(20);
await shot('9-loft-night');
await stand(-0.6, -0.8, -2.3, 3.6, -1.9);
await frames(4);
await click(await project(-2.5, 3.6, -1.0));
await until('g.hut.busy', 5000);
await until('!g.hut.busy', 300000);
check(Math.abs((await G('g.sky.time')) - 0.292) < 0.02, 'sleeping at night wakes you in the morning');
check(await G('g.hut.level === 1'), 'and you get up in the loft');

// ------------------------------------------------------------------ down again
await G('g.controls.teleport(1.6, -0.9, 0)');
await G('g.controls.walkTo(g.hut.stairRoute())');
await until('g.hut.level === 0 && !g.controls.route', 300000);
check(await G('Math.abs(g.controls.pos.y) < 0.01'), 'walking down puts you back on the ground floor');
const name1 = await G('g.hut.loft.glass.name');
const count = await G('g.hut.loft.glass.count');
check(count === 1, `coming down, the window finds a new picture for next time (${name0} → ${name1})`);
check(await G("Number(localStorage.getItem('garden.loftWindow')) === 1"), 'and it is remembered');
await G('g.controls.walkTo(g.hut.stairRoute())');
await until('g.hut.level === 1 && !g.controls.route', 300000);
await stand(1.0, 1.4, 0, 5.2, -3);
await frames(20);
await shot('10-new-window');
check(errors.length === 0, 'no errors' + (errors.length ? ':\n' + errors.join('\n') : ''));
await browser.close();
console.log('hutlofttest: all good');

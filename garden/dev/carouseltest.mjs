/**
 * carouseltest.mjs — drives the Starlight Carousel in real Chromium: it stands
 * on its plaza with eight creatures, hovering one shows its card, clicking one
 * walks you over and climbs you on, the bell rings and it turns to the organ
 * (the music plays and the ambient score steps back), the creatures rise and
 * fall, a click slows it down and steps you off on the outside, Esc works too,
 * and at night it lights up in colours and starts by itself for the midnight
 * fireworks. Screenshots along the way. Fails on any console or page error.
 * Needs ?debug (the harness handle).
 *
 *   python3 -m http.server 8077            # from the REPO ROOT
 *   node garden/dev/carouseltest.mjs
 *
 * Env: BASE, THREE_PKG (see browsertest.mjs), SHOTS=0 to skip screenshots,
 * PHONE=1 to run on a touch phone viewport instead.
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
const until = (expr, timeout = 600000) => page.waitForFunction(`(() => { const g = window.__garden; return ${expr}; })()`, null, { timeout, polling: 100 });
const frames = (n) => page.evaluate((n) => new Promise((res) => { let k = 0; const f = () => (++k >= n ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
const shot = async (name) => {
    if (!SHOTS) return;
    await frames(4);
    await page.screenshot({ path: path.join(OUT, `carousel-${PHONE ? 'phone-' : ''}${name}.png`), timeout: 180000 });
};
/** Screen position of a world point in the current view. */
const project = (x, y, z) => page.evaluate(([x, y, z]) => {
    const g = window.__garden, v = g.camera.position.clone().set(x, y, z).project(g.camera);
    return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight, front: v.z < 1 };
}, [x, y, z]);
const click = async (p) => (PHONE ? page.touchscreen.tap(p.x, p.y) : page.mouse.click(p.x, p.y));
/** World position of creature k's click box. */
const creatureAt = (k) => G(`(() => { const p = g.carousel.creatures[${k}].proxy; p.updateWorldMatrix(true, false); const v = p.getWorldPosition(p.position.clone()); return { x: v.x, y: v.y, z: v.z }; })()`);

await page.goto(`${BASE}/index.html?debug&enter&pr=0.6&t=0.4${process.env.Q ? '&q=' + process.env.Q : ''}${process.env.EXTRA ?? ''}`);
await until('g?.entered', 240000);
check(await G('g.carousel.ok && !!g.world.carouselSite'), 'the carousel is built on its plaza');
check(await G('g.carousel.creatures.length') === 8, 'eight creatures ride it');
check(await G("g.world.landmarks.some((l) => l.name === 'The Starlight Carousel')"), 'it is a landmark on the map');
const site = await G('({ ...g.world.carouselSite })');
check(await G(`g.world.inPlaza(${site.x + 8}, ${site.z})`), 'the ring round it is paved');
// nothing big stands on the plaza: no other set piece, statue or the hut
const clear = await G(`(() => { const s = g.world.carouselSite; const bad = [];
    for (const f of g.layout.features) if (f.type !== 'carousel' && f.type !== 'grove' && Math.hypot(f.x - s.x, f.z - s.z) < 22) bad.push(f.type);
    for (const st of g.statues) if (Math.hypot(st.x - s.x, st.z - s.z) < 11) bad.push('statue ' + st.game.title);
    if (g.world.hut && Math.hypot(g.world.hut.cx - s.x, g.world.hut.cz - s.z) < 16) bad.push('hut');
    return bad; })()`);
check(clear.length === 0, `the plaza is clear of other things (${clear.join(', ') || 'nothing'})`);

// stand off and look at it
const face = site.face;
const sx = site.x + Math.sin(face) * 14, sz = site.z + Math.cos(face) * 14;
await G(`(g.controls.teleport(${sx}, ${sz}, ${face}), g.controls.pitch = 0.1)`);
await frames(10);
await shot('0-day');

// hover a creature: its card
const c0 = await creatureAt(1);
let sp = await project(c0.x, c0.y, c0.z);
check(sp.front, 'a creature is in view');
if (!PHONE) {
    await page.mouse.move(sp.x, sp.y);
    await frames(6);
    check((await G(`g.pick(${sp.x}, ${sp.y})?.type`)) === 'carousel', 'the creature is picked under the pointer');
    check(await page.isVisible('#tooltip'), 'hovering shows its card');
    const tt = await page.textContent('#tooltip');
    check(/Starlight Carousel/.test(tt) && /ride/i.test(tt), `the card names it (${tt.replace(/\s+/g, ' ').trim().slice(0, 60)}…)`);
    await shot('1-hover');
}

// click it from afar: walk over, then climb on
const idx = await G(`g.pick(${sp.x}, ${sp.y})?.idx`);
await click(sp);
await until('g.carousel.busy', 300000);
check(true, `clicking ${await G(`g.carousel.info(${idx}).name`)} walks over and climbs on`);
check(await G('g.controls.seated'), 'the walker is seated');
await until("g.carousel.ride?.phase === 'ride'", 60000);
check(true, 'the climb ends in the saddle');
await until('g.carousel.running', 60000);
check(true, 'the carousel starts to turn');
await page.waitForTimeout(2500);
const ride = await G('({ speed: g.carousel.speed, beat: g.carousel.music?.beatPos ?? -1, level: g.carousel.music?.level ?? 0, y: g.camera.position.y })');
check(ride.beat > 1, `the organ is playing (beat ${ride.beat.toFixed(1)})`);
check(ride.level > 0.1, `and loud on board (${ride.level.toFixed(2)})`);
check(await G('g.carousel.duck > 0.3'), 'the garden score steps back for it');
const ys = [];
for (let i = 0; i < 8; i++) {
    ys.push(await G('g.camera.position.y'));
    await frames(3);
}
check(Math.max(...ys) - Math.min(...ys) > 0.08, `you rise and fall on the pole (${(Math.max(...ys) - Math.min(...ys)).toFixed(2)} m)`);
const pos0 = await G('({ x: g.camera.position.x, z: g.camera.position.z })');
await frames(8);
const pos1 = await G('({ x: g.camera.position.x, z: g.camera.position.z })');
check(Math.hypot(pos1.x - pos0.x, pos1.z - pos0.z) > 0.5, 'and go round');
const dc = await G(`Math.hypot(g.camera.position.x - ${site.x}, g.camera.position.z - ${site.z})`);
check(Math.abs(dc - 4.35) < 0.6, `in a circle round the middle (${dc.toFixed(2)} m)`);
// look to the side and up at the ceiling for the screenshot
await G('g.controls.yaw = 0.0, g.controls.pitch = -0.05');
await shot('2-ride');
await G('g.controls.yaw = 1.2, g.controls.pitch = 0.35');
await frames(3);
await shot('3-ride-look');
await G('g.controls.yaw = 0, g.controls.pitch = -0.08');

// a click asks to get off: it slows, then you step down outside it
await click({ x: PHONE ? 200 : 640, y: PHONE ? 400 : 360 });
await until("g.carousel.ride?.phase === 'leave'", 60000);
check(true, 'a click asks to get off');
await until('!g.carousel.busy', 120000);
check(!(await G('g.controls.seated')), 'you step off and can walk');
const off = await G(`Math.hypot(g.controls.pos.x - ${site.x}, g.controls.pos.z - ${site.z})`);
check(off > 6.6 && off < 8.5, `on the paving outside the plinth (${off.toFixed(2)} m out)`);
check(await G('!g.carousel.running'), 'the carousel has stopped');
await page.waitForTimeout(1600);
check(await G('g.carousel.music.level < 0.02'), 'and the organ is quiet');

// on again from close by, and Esc to get off
const near = await creatureAt(idx);
sp = await project(near.x, near.y, near.z);
check(sp.front, 'the creature is still in view');
await click(sp);
await until("g.carousel.ride?.phase === 'ride'", 60000);
check(true, 'from close by a click climbs straight on');
await page.waitForTimeout(1500);
await page.keyboard.press('Escape');
await until('!g.carousel.busy', 120000);
check(true, 'Esc gets you off as well');

// the map can take you away mid-ride
await click(sp);
await until("g.carousel.ride?.phase === 'ride'", 60000);
await G('g.linkToGame(g.layout.games[0])');
await until('!g.carousel.busy && !g.controls.seated', 30000);
check(true, 'linking to a statue mid-ride lifts you off first');
await page.waitForTimeout(800);

// night: the bulbs run in colours; the fireworks start it with no one aboard
await G(`(g.sky.setTime(0.97), g.controls.teleport(${sx}, ${sz}, ${face}), g.controls.pitch = 0.12)`);
await frames(12);
const idle = await G('(() => { const a = g.carousel.bulbMesh.instanceColor.array; let m = 0; for (const v of a) m = Math.max(m, v); return m; })()');
check(idle > 1.0, `after dark the bulbs glow (${idle.toFixed(2)})`);
check(await G('!g.carousel.running'), 'but it stays still until somebody rides');
await shot('4-night');
await G('g.fireworks.start()');
await until('g.carousel.running', 60000);
check(true, 'the midnight fireworks start it by itself');
await page.waitForTimeout(2500);
check(await G('g.carousel.music.beatPos > 1 && g.carousel.music.level > 0.1'), 'and the organ plays along');
const hues = await G('(() => { const a = g.carousel.bulbMesh.instanceColor.array, s = new Set(); for (let i = 0; i < a.length; i += 3) s.add([a[i], a[i + 1], a[i + 2]].map((v) => Math.round(v * 4)).join()); return s.size; })()');
check(hues > 3, `in many colours (${hues} distinct)`);
await shot('5-fireworks');
await G(`(g.controls.teleport(${site.x + Math.sin(face + 1.4) * 21}, ${site.z + Math.cos(face + 1.4) * 21}, ${face + 1.4}), g.controls.pitch = 0.3)`);
await page.waitForTimeout(2000);
await shot('6-fireworks-far');
await until('!g.fireworks.active', 120000);
await until('!g.carousel.running', 60000);
check(true, 'after the show it winds down');

await frames(10);
check(errors.length === 0, 'no console or page errors' + (errors.length ? ': ' + errors.join('\n') : ''));
console.log('carousel test passed');
await browser.close();

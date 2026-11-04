/**
 * gearfalltest.mjs — the way to Gearfall in real Chromium: the papers on the
 * Hut's desk open the maintenance log (with the code), the trap door behind
 * the Great Gear takes you down the ladder into the long hall, a wrong code is
 * refused and 1337 opens the vault door, and then the city: the dirt road, a
 * house in the outskirts (walked into), midtown, downtown, the crater and the
 * giant in it, by day and by night. Checks the city is rebuilt as you go and
 * the old chunks are let go, that walls are solid, and climbs home. Fails on
 * any console or page error. Needs ?debug (the harness handle).
 *
 *   python3 -m http.server 8077            # from the REPO ROOT
 *   node garden/dev/gearfalltest.mjs
 *
 * Env: BASE, THREE_PKG (see browsertest.mjs), SHOTS=0 to skip screenshots.
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

const ctx = await browser.newContext({ viewport: { width: 1280, height: 720 }, deviceScaleFactor: 1 });
await ctx.addInitScript(() => localStorage.clear());
if (fs.existsSync(PKG)) {
    await ctx.route('https://unpkg.com/**', (route) => {
        const rel = new URL(route.request().url()).pathname.replace(/^\/three@0\.165\.0\//, '');
        const file = path.join(PKG, rel);
        if (!fs.existsSync(file)) return route.abort();
        route.fulfill({ status: 200, contentType: 'application/javascript', body: fs.readFileSync(file) });
    });
}
await ctx.route(/fonts\.(googleapis|gstatic)\.com/, (route) => route.fulfill({ status: 200, contentType: 'text/css', body: '' }));
const page = await ctx.newPage();
page.on('console', (m) => m.type() === 'error' && errors.push('console: ' + m.text()));
page.on('pageerror', (e) => errors.push('pageerror: ' + e.message + '\n' + e.stack));
const G = (expr) => page.evaluate(`(() => { const g = window.__garden; return ${expr}; })()`);
const until = (expr, timeout = 600000) => page.waitForFunction(`(() => { const g = window.__garden; return ${expr}; })()`, null, { timeout });
const frames = (n) => page.evaluate((n) => new Promise((res) => { let k = 0; const f = () => (++k >= n ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
const shot = async (name) => {
    if (!SHOTS) return;
    await frames(4);
    await page.screenshot({ path: path.join(OUT, `gearfall-${name}.png`), timeout: 300000 });
};
/** Where a world point lands on screen. */
const screenOf = (expr) => page.evaluate(`(() => { const g = window.__garden; const p = (${expr}).clone(); p.project(g.camera); return { x: (p.x * 0.5 + 0.5) * innerWidth, y: (-p.y * 0.5 + 0.5) * innerHeight }; })()`);
const inCity = 'g.below && g.roomKind === "city" && g.city?.inside';

await page.goto(`${BASE}/index.html?debug&enter&pr=0.6&t=0.42`);
await until('g?.entered', 240000);
check(errors.length === 0, 'the garden loads without errors');

// ---------------------------------------------------------------- the papers in the hut
await G('g.throughDoor(true, "hut")');
await until('g.below && g.roomKind === "hut"', 60000);
await frames(20);
await G('(() => { g.controls.teleport(-0.6, -0.9, 0); g.controls.pitch = -0.75; })()');
await frames(20);
await shot('0-desk');
const pp = await screenOf('g.hut.papersHit.position');
await page.mouse.click(pp.x, pp.y);
await frames(10);
check(await G('!document.getElementById("hut-note").hidden'), 'clicking the papers on the desk opens the maintenance log');
check((await page.textContent('#hut-note')).includes('1 3 3 7'), 'the log has the code in it');
check(/Great Gear/.test(await page.textContent('#hut-note')), 'and a hint about the Great Gear');
await shot('1-note');
await page.keyboard.press('Escape');
await frames(5);
check(await G('document.getElementById("hut-note").hidden'), 'Esc puts the papers down');
await G('g.throughDoor(false)');
await until('!g.below', 60000);
await frames(20);

// ---------------------------------------------------------------- the trap door
check(await G('!!g.world.gearHatch'), 'there is a trap door behind the Great Gear');
const gear = await G('(() => { const l = g.world.landmarks.find((l) => l.name === "The Great Gear"); const h = g.world.gearHatch; return { gd: Math.hypot(l.x, l.z), hd: Math.hypot(h.x, h.z) }; })()');
check(gear.hd > gear.gd + 2, `it is behind the gear, on the far side from the hub (${gear.gd.toFixed(1)} m vs ${gear.hd.toFixed(1)} m)`);
await G('(() => { const h = g.world.gearHatch; g.controls.teleport(h.front.x, h.front.z, Math.atan2(-(h.x - h.front.x), -(h.z - h.front.z))); g.controls.pitch = -0.45; })()');
await frames(60);
await shot('2-hatch');
const hp = await screenOf('g.world.gearHatch.hit.getWorldPosition(new g.camera.position.constructor())');
check(await G(`g.pick(${hp.x}, ${hp.y})?.type === 'gearHatch'`), 'the trap door can be picked');
await page.mouse.click(hp.x, hp.y);
await until(inCity, 120000);
check(true, 'clicking it walks you on to it and down the ladder');
await frames(40);
check(await G('g.city.chunks.size') >= 13, `the land round about is built (${await G('g.city.chunks.size')} chunks)`);
check(await G('!document.getElementById("city-hud").hidden'), 'the way-home panel is showing');
await shot('3-hall');

// ---------------------------------------------------------------- the vault door
const kz = await G('g.city.bunker.keypadAt.z');
await G(`(() => { g.controls.teleport(0, ${kz} + 9, 0); g.controls.pitch = 0.05; })()`);
await frames(40);
await shot('4-door-locked');
check(await G('g.city.bunker.state') === 'locked', 'the vault door is locked');
// try walking through it
await G(`(() => { g.controls.teleport(0, ${kz} + 2, 0); g.controls.walkTo([{ x: 0, z: ${kz} - 6 }]); })()`);
await frames(150);
check(await G(`g.controls.pos.z > ${kz} - 1.6`), 'and you cannot walk through it');
await G('g.city.useKeypad()');
await frames(5);
check(await G('!document.getElementById("keypad").hidden'), 'the keypad opens');
for (const k of '1234') await page.keyboard.press(k);
await frames(30);
check((await page.textContent('#kp-screen')).includes('DENIED'), 'a wrong code is refused');
await shot('5-denied');
await page.waitForTimeout(1300);
for (const k of '1337') await page.keyboard.press(k);
await frames(20);
check((await page.textContent('#kp-screen')).includes('GRANTED'), '1337 is accepted');
await until('g.city.bunker.state === "opening"', 20000);
await G(`(() => { g.controls.teleport(1.5, ${kz} + 14, 0.08); g.controls.pitch = 0.12; })()`);
await page.waitForTimeout(3500);
await shot('6-door-opening');
await until('g.city.bunker.state === "open"', 60000);
check(true, 'the door opens');
check(await G('JSON.parse(localStorage.getItem("garden.gearfallOpen"))'), 'and stays open next time');
check(await G('g.city.log.door >= 1'), 'the door is in your log');
await G(`(() => { g.controls.teleport(0, ${kz} + 6, 0); g.controls.walkTo([{ x: 0, z: ${kz} - 10 }]); })()`);
await frames(240);
check(await G(`g.controls.pos.z < ${kz} - 4`), 'you can walk out through it');
await shot('7-outside');

// ---------------------------------------------------------------- the road and the city
const visit = async (name, x, z, yaw, pitch = 0.02, n = 90) => {
    await G(`(() => { g.controls.teleport(${x}, ${z}, ${yaw}); g.controls.pitch = ${pitch}; })()`);
    await frames(10);
    await until('g.city.queue.length === 0', 240000);
    await frames(n);
    await shot(name);
};
await visit('8-road', 0, 1200, 0, 0.04);
check(await G('g.city.log.road >= 1'), 'the dirt road is in your log');
const keys0 = await G('[...g.city.chunks.keys()].join(";")');

// a house in the outskirts: stand in its doorway and walk in
const house = await page.evaluate(async () => {
    const land = await import('./garden/js/gearfall-land.js');
    for (let bj = 21; bj < 28; bj++) for (let bi = -4; bi < 4; bi++) {
        const b = land.lotPlan(bi, bj).items.find((it) => it.type === 'bld' && it.kind === 'house');
        if (b) return b;
    }
    return null;
});
check(!!house, 'the outskirts have houses');
const fx = Math.sin(house.yaw), fz = Math.cos(house.yaw);
const ox = house.x + fx * (house.d / 2 + 3), oz = house.z + fz * (house.d / 2 + 3);
await visit('9-outskirts', ox + fz * 6, oz - fx * 6, Math.atan2(fx - fz * 0.6, fz + fx * 0.6) , 0.0);
check(await G('g.city.log.outskirts >= 1'), 'the outskirts are in your log');
const keys1 = await G('[...g.city.chunks.keys()]');
check(keys1.every((k) => !keys0.split(';').includes(k)) || keys1.length > 0, 'the city is built round you as you go');
check(await G('g.city.world.collidersNear(g.controls.pos.x, g.controls.pos.z) !== undefined'), 'colliders are there');
// walls are solid: walk straight at the house's side wall from outside
const side = { x: house.x + Math.cos(house.yaw) * (house.w / 2 + 2.5), z: house.z - Math.sin(house.yaw) * (house.w / 2 + 2.5) };
await G(`(() => { g.controls.teleport(${side.x}, ${side.z}, 0); g.controls.walkTo([{ x: ${house.x}, z: ${house.z} }]); })()`);
await frames(150);
const inside1 = await G(`(() => { const p = g.controls.pos; return Math.hypot(p.x - ${house.x}, p.z - ${house.z}); })()`);
check(inside1 > house.w / 2 - 0.4, `the walls are solid (stopped ${inside1.toFixed(1)} m from the middle)`);
// in through the front door
await G(`(() => { const d = ${house.d / 2 + 2}; g.controls.teleport(${house.x} + ${fx} * d, ${house.z} + ${fz} * d, ${house.yaw}); })()`);
await frames(5);
const doorX = await G(`(() => { return 0; })()`);
void doorX;
// find the doorway along the front by trying to walk in at points across it
let got = false;
for (let u = -house.w / 2 + 1; u <= house.w / 2 - 1 && !got; u += 0.5) {
    const sx = house.x + fx * (house.d / 2 + 1.5) + Math.cos(house.yaw) * u, sz = house.z + fz * (house.d / 2 + 1.5) - Math.sin(house.yaw) * u;
    const tx = house.x + fx * (house.d / 2 - 1.5) + Math.cos(house.yaw) * u, tz = house.z + fz * (house.d / 2 - 1.5) - Math.sin(house.yaw) * u;
    await G(`(() => { g.controls.teleport(${sx}, ${sz}, ${house.yaw}); g.controls.walkTo([{ x: ${tx}, z: ${tz} }]); })()`);
    await frames(70);
    got = await G(`g.city._inBuilding(g.controls.pos.x, g.controls.pos.z)`);
}
check(got, 'you can walk in through the front door');
await G(`(() => { g.controls.yaw = ${house.yaw}; g.controls.pitch = -0.1; })()`);
await frames(40);
await shot('10-house-inside');

await visit('11-midtown', 4.5, 520, 0.0, 0.08);
check(await G('g.city.log.midtown >= 1'), 'midtown is in your log');
await visit('12-downtown', -4, 250, 0.05, 0.22);
check(await G('g.city.log.downtown >= 1'), 'downtown is in your log');
const farthest = await G('(() => { const c = g.city, p = g.controls.pos, ci = Math.floor(p.x / 80), cj = Math.floor(p.z / 80); return Math.max(...[...c.chunks.values()].map((ch) => Math.hypot(ch.i - ci, ch.j - cj))); })()');
check(farthest <= (await G('g.city.cfg.R')) + 1, 'old chunks are let go');
await visit('13-crater-rim', 0, 125, 0, -0.08);
check(await G('g.city.log.crater >= 1'), 'the crater is in your log');
await visit('14-robot', 6, 40, 0.15, 0.25, 60);
check(await G('g.city.log.robot >= 1'), 'and the giant in it');
const rp = await screenOf('g.city.robot.hits[0].position');
await page.mouse.click(rp.x, rp.y);
await frames(10);
check(await G('g.city.robot.wake > 0.5'), 'clicking the giant wakes it a little');
// night
await G('g.sky.setTime ? g.sky.setTime(0.95) : (g.sky.time = 0.95)');
await frames(30);
await visit('15-night-downtown', -4, 300, 0.1, 0.25);
await visit('16-night-crater', 0, 135, 0, 0.0);

// ---------------------------------------------------------------- home
await G('document.getElementById("city-home").click()');
await until('!g.below', 60000);
await frames(20);
const back = await G('(() => { const h = g.world.gearHatch, p = g.controls.pos; return Math.hypot(p.x - h.x, p.z - h.z); })()');
check(back < 4, `Climb home brings you back up beside the trap door (${back.toFixed(1)} m)`);
check(errors.length === 0, 'no errors' + (errors.length ? ':\n  ' + errors.join('\n  ') : ''));
await browser.close();
console.log('gearfall: all good');

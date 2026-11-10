/**
 * foundrytest.mjs — the Robot Foundry in real Chromium: down the stair into the
 * Works, walk into the lift at the far end, ride it down into the Foundry, and
 * walk the main line from the head shop past the body shop, the arm line and
 * the leg line to the test rig, the paint booth and the release plate, out on
 * to the catwalk over the pit to watch a unit set off for the exit and walk
 * into the gap where the gangway broke away; then back into the lift and up
 * to the Works. Checks the lines are really building robots (parts appear
 * station by station), that finished units stand up, walk into the gap and
 * burn, that the walls and the fences
 * hold, and fails on any console or page error. Needs ?debug.
 *
 *   python3 -m http.server 8077            # from the REPO ROOT
 *   node garden/dev/foundrytest.mjs
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
    await page.screenshot({ path: path.join(OUT, `foundry-${name}.png`), timeout: 300000 });
};
const stand = async (x, z, yaw, pitch = 0, n = 12) => {
    await G(`(() => { g.controls.teleport(${x}, ${z}, ${yaw}); g.controls.pitch = ${pitch}; })()`);
    await frames(n);
};

await page.goto(`${BASE}/index.html?debug&enter&pr=0.6&t=0.42`);
await until('g?.entered', 900000);
check(errors.length === 0, 'the garden loads without errors');

// ---------------------------------------------------------------- the Works and its lift
await G('g.throughDoor(true)');
await until('g.below && g.roomKind === "works"', 300000);
await frames(20);
check(await G('!!g.works.lift && !!g.works.liftHit'), 'the Works has a lift');
const lift = await G('g.works.lift');
check(Math.abs(lift.x) < 0.01 && lift.z < -24, `at the far end of the hall from the stair (${lift.z.toFixed(1)})`);
await stand(0, -12, 0, 0.12, 15);
await shot('0-works-lift');
// walk in
await G(`(() => { g.controls.teleport(0, ${lift.z} + 5, 0); g.controls.walkTo([{ x: 0, z: ${lift.z} }]); })()`);
await until('g.roomKind === "foundry"', 300000);
check(true, 'walking into the lift takes you down');
check(await G('g.foundry.busy'), 'and you ride the car down the shaft');
await frames(30);
await shot('1-ride-top');
check(await G('!document.getElementById("foundry-hud").hidden'), 'the Foundry panel is showing');

// the lines are building robots
const census = await G(`(() => {
    const f = g.foundry, L = f.lines;
    const main = L.robots.filter((r) => r.line.id === 0);
    const counts = {}; for (const [k, i] of Object.entries(L.inst)) counts[k] = i.mesh.count;
    return { robots: L.robots.length, post: L.robots.filter((r) => r.post).length, onLine: main.filter((r) => !r.post).length, walking: main.filter((r) => r.post).length, counts, arms: L.arms.length };
})()`);
console.log('    ', JSON.stringify(census));
check(census.onLine >= 26, `the main line has a unit at every station (${census.onLine})`);
check(census.walking >= 4, `and finished units walking off (${census.walking})`);
// on the lines (finished units have everything), most units have a head but only the last few have feet
const headsOnLines = census.counts.cranium - census.post, feetOnLines = (census.counts.foot - 2 * census.post) / 2;
check(headsOnLines > 2 * feetOnLines, `heads come first: on the lines, ${headsOnLines} units have heads and about ${Math.round(feetOnLines)} have feet`);
check(census.arms > 150, `${census.arms} arms are at work`);

await G('(g.foundry.ride.t = 4.5)');
await frames(10);
await shot('1b-ride-mid');
// (software rendering is slow: run the rest of the ride on)
await G('(g.foundry.ride.t = 9.9)');
await until('!g.foundry.busy', 300000);
check(await G('g.controls.seated === false && g.controls.enabled'), 'the gate opens and you can walk out');
await frames(20);
await shot('2-arrive');

// ---------------------------------------------------------------- along the main line
const PI = Math.PI;
// looking across at the line (yaw π/2 faces -x)
await stand(7, 0, PI / 2 - 0.25, 0.08, 15);
await shot('3-head-shop');
check(await G('g.foundry.zone') === 'heads' || await G('g.foundry.log.heads'), 'the head shop is found');
// the heads at each station are given parts in order: compare a unit at station 1 with one at station 4
const parts = await G(`(() => {
    const L = g.foundry.lines;
    const at = (k) => L.robots.find((r) => r.line.id === 0 && !r.post && r.k === k);
    return { s1: !!at(1), s4: !!at(4), s20: !!at(20) };
})()`);
check(parts.s1 && parts.s4 && parts.s20, 'units hang at stations 1, 4 and 20');
await stand(7, -45, PI / 2 - 0.2, 0.08, 15);
await shot('4-body-shop');
await stand(7, -88, PI / 2 - 0.2, 0.05, 15);
await shot('5-arm-line');
await stand(7, -130, PI / 2 - 0.2, 0.0, 15);
await shot('6-leg-line');
await stand(8, -165, PI / 2 - 0.35, 0.02, 15);
await shot('7-test-paint');
await stand(6.5, -170, PI / 2 + 0.6, 0.02, 15);
await shot('8-release');
check(await G('g.foundry.log.finish && g.foundry.log.legs && g.foundry.log.arms && g.foundry.log.bodies'), 'every shop is found on the way');
// the units cross the apron in single file per line: none of them overlap
const tight = await G(`(() => { const L = g.foundry.lines; let min = 99; for (let s = 0; s < 12; s += 0.25) { L.update(g.foundry.clock + s, null); const w = L.robots.filter((r) => r.post && r.feetY > -0.5); for (let i = 0; i < w.length; i++) for (let j = i + 1; j < w.length; j++) min = Math.min(min, Math.hypot(w[i].x - w[j].x, w[i].z - w[j].z)); } return min; })()`);
check(tight > 1.3, `finished units never overlap (closest pair ${tight.toFixed(2)} m apart)`);

// the fence holds: try to walk across the line
await G('(() => { g.controls.teleport(7, -60, PI); g.controls.walkTo([{ x: -3, z: -60 }]); })()'.replace('PI', String(PI / 2)));
await frames(120);
check(await G('g.controls.pos.x > 5'), 'the fence keeps you off the line');
// and the edge of the pit
await G('(() => { g.controls.teleport(20, -195, 0); g.controls.walkTo([{ x: 20, z: -210 }]); })()');
await frames(150);
check(await G('g.controls.pos.z > -200'), 'the railing at the ledge holds');

// ---------------------------------------------------------------- the pit
// wait for a main-line unit to be near the gap, then watch from the catwalk
const fallAt = await G(`(() => {
    const f = g.foundry;
    for (let s = 0; s < 6.5; s += 0.05) {
        f.skip(0.05);
        f.lines.update(f.clock, g.camera.position);
        const r = f.lines.robots.find((r) => r.post && r.feetY > -0.5 && r.z < -240);
        if (r) return { tp: r.tp, z: r.z };
    }
    return null;
})()`);
check(!!fallAt, 'a finished unit walks out along the gangway towards the exit, as far as the gap');
check(await G('g.foundry.lines.lines.length === 3 && !!g.foundry.lines.sarge'), 'three lines feed one walkway, and the quartermaster stands beside it');
check(await G('g.foundry.lines.rifleBody.mesh.count >= 5'), `units past the quartermaster carry laser rifles (${await G('g.foundry.lines.rifleBody.mesh.count')})`);
const lanes = await G(`(() => { const ids = new Set(g.foundry.lines.robots.filter((r) => r.post && r.z < -200 && r.feetY > -0.5).map((r) => r.line.id)); return ids.size; })()`);
check(lanes === 3, 'units from all three lines share the walkway');
await stand(6.5, -206, 0.12, -0.08, 10);
await shot('9-gangway');
await page.waitForTimeout(1500);
await frames(40);
await shot('10-falling');
await page.waitForTimeout(2500);
await frames(30);
await stand(4.0, -242, 0.67, -0.75, 10);
await frames(10);
await shot('11-lava');
check(await G('g.foundry.log.pit'), 'the pit is found');
const burned = await G(`(() => g.foundry.lines.robots.some((r) => r.post && r.y < -10))()`);
check(burned, 'and units are burning in the lava below');
const count = await G('Number(document.getElementById("fd-count").textContent.replace(/[^0-9]/g, ""))');
check(count > 30000, `the counter counts the units completed (${count})`);

// hover a robot for its card
await stand(7, -10, PI / 2, 0.05, 20);
const sp = await page.evaluate(() => {
    const g = window.__garden;
    const r = g.foundry.lines.robots.find((r) => r.line.id === 0 && r.k === 3);
    const p = new g.camera.position.constructor(r.x, r.y, r.z).project(g.camera);
    return { x: (p.x * 0.5 + 0.5) * innerWidth, y: (-p.y * 0.5 + 0.5) * innerHeight };
});
await page.mouse.move(sp.x, sp.y);
await frames(10);
const note = await page.evaluate(() => document.querySelector('#tooltip')?.textContent ?? '');
check(/Unit RX-/.test(note), `hovering a unit shows its card (${note.slice(0, 60)}…)`);

// a performance snapshot
const perf = await G('(() => ({ calls: g.renderer.info.render.calls, tris: g.renderer.info.render.triangles, progs: g.renderer.info.programs.length }))()');
console.log('     render:', JSON.stringify(perf));

// ---------------------------------------------------------------- back up
await G('(() => { const f = g.foundry; g.controls.teleport(12, 14, 0); g.controls.walkTo([{ x: 12, z: 19.3 }]); })()');
await until('g.roomKind === "works"', 300000);
check(true, 'walking back into the lift takes you up to the Works');
await frames(30);
check(await G('Math.hypot(g.controls.pos.x - g.works.liftOut.x, g.controls.pos.z - g.works.liftOut.z) < 0.5'), 'and you step out in front of it');
check(await G('document.getElementById("foundry-hud").hidden'), 'the Foundry panel is put away');
await shot('12-back');
// and down again with the button the other way: the HUD's button
await G('g.rideLift(true)');
await until('g.roomKind === "foundry"', 300000);
await G('(g.foundry.ride.t = 9.9)');
await until('!g.foundry.busy', 300000);
await G('document.getElementById("fd-up").click()');
await frames(5);
await until('g.roomKind === "works"', 300000);
check(true, 'the Ride up button takes you up');
check(errors.length === 0, 'no errors' + (errors.length ? ': ' + errors.join('\n') : ''));
await browser.close();
console.log('foundry: all ok');

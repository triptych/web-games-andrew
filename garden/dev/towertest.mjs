/**
 * towertest.mjs — drives the Observatory tower in real Chromium: through the
 * door, every floor by the lift, a look into every room (with a screenshot),
 * a click on each room's things, a long walk down the Infinite Library, and the
 * Great Telescope's view (turning the dial a few times). Fails on any console
 * error or page error. Needs ?debug (the harness handle).
 *
 *   python3 -m http.server 8077            # from the REPO ROOT
 *   node garden/dev/towertest.mjs
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
const until = (expr, timeout = 600000) => page.waitForFunction(`(() => { const g = window.__garden; return ${expr}; })()`, null, { timeout });
const frames = (n) => page.evaluate((n) => new Promise((res) => { let k = 0; const f = () => (++k >= n ? res() : requestAnimationFrame(f)); requestAnimationFrame(f); }), n);
const shot = async (name) => {
    if (!SHOTS) return;
    await frames(4);
    await page.screenshot({ path: path.join(OUT, `tower-${name}.png`) });
};

await page.goto(`${BASE}/index.html?debug&enter&pr=0.6&t=0.4${process.env.Q ? '&q=' + process.env.Q : ''}`);
await until('g?.entered', 240000);
check(await G('!!g.world.observatory'), 'the observatory has a door');
await G('g.throughDoor(true, "tower")');
await until("g.roomKind === 'tower' && !!g.tower", 120000);
check(errors.length === 0, 'the tower builds without errors');
await frames(10);
await shot('0-hall');

const floors = await G('g.tower.floors.length');
check(floors === 5, 'five floors');
const F0 = Number(process.env.F0 || 0);
for (let f = 0; f < floors; f++) {
    if (f < F0) continue;
    if (f > 0) {
        await G(`(g.tower.controls.teleport(3.3, -3.3, 0), g.tower.rideTo(${f}))`);
        await until(`!g.tower.ride && g.tower.floor === ${f}`, 120000);
        check(true, `the lift rides to floor ${f + 1}`);
    }
    // look across the rotunda
    await G(`(() => { const t = g.tower; const R = t.cur.HR; t.controls.teleport(0, R - 1.6, 0); t.controls.pitch = 0.05; })()`);
    await frames(6);
    await shot(`${f + 1}-hub`);
    const rooms = await G('g.tower.cur.rooms.length');
    check(rooms >= 3, `floor ${f + 1} has ${rooms} rooms`);
    for (let i = 0; i < rooms; i++) {
        const kind = await G(`(() => { const t = g.tower, rm = t.cur.rooms[${i}], d = rm.def; const p = rm.ctx.toFloor(0, d.D / 2 - 0.9); t.controls.teleport(p.x, p.z, rm.frame.ry); t.controls.pitch = 0.08; return d.kind; })()`);
        await frames(8);
        // click every thing in the room
        const n = await G(`(() => { const t = g.tower; const hits = t.cur.hits.filter((m) => m.userData.hit.ctx === t.cur.rooms[${i}].ctx); let k = 0; for (const m of hits) { try { m.userData.hit.onClick?.({ mesh: m, point: m.getWorldPosition(new m.position.constructor()).setY(1), local: { x: 0, z: 0 }, instanceId: 0 }); k++; } catch (e) { console.error('click ' + e.message); } } return k; })()`);
        await frames(30);
        await shot(`${f + 1}-${kind}`);
        check(errors.length === 0, `floor ${f + 1}: ${kind} (${n} things clicked)`);
    }
}

// the Infinite Library: walk a long way down the stacks
await G('(g.tower.controls.teleport(3.3, -3.3, 0), g.tower.rideTo(2))');
await until('!g.tower.ride && g.tower.floor === 2', 120000);
const lib = await G("g.tower.cur.rooms.findIndex((r) => r.def.kind === 'library')");
for (const depth of [3, 40, 200, 1300]) {
    await G(`(() => { const t = g.tower, rm = t.cur.rooms[${lib}]; const p = rm.ctx.toFloor(0, -rm.def.D / 2 - ${depth}); t.controls.teleport(p.x, p.z, rm.frame.ry); t.controls.pitch = 0.04; })()`);
    await frames(10);
    check(await G('g.tower.walkable(g.tower.controls.pos.x, g.tower.controls.pos.z)'), `the stacks go on at ${depth} m`);
}
await shot('3-stacks-deep');
check(errors.length === 0, 'the library recycles its bays without errors');

// the telescope
await G('(g.tower.controls.teleport(3.3, -3.3, 0), g.tower.rideTo(4))');
await until('!g.tower.ride && g.tower.floor === 4', 120000);
const st = await G('g.tower.scopeStand');
await G(`g.tower.controls.teleport(${st.x}, ${st.z}, ${st.yaw})`);
await frames(5);
await shot('5-telescope');
await G('(g.tower.controls.teleport(0, 8.5, 0), g.tower.controls.pitch = 0.35)');
await frames(5);
await shot('5-telescope-wide');
await G('g.startScope()');
await until("g.scoping?.phase === 'view'", 60000);
await page.waitForTimeout(1500);
await shot('5-scope-0');
for (let k = 1; k <= 6; k++) {
    await G('g.scope.next()');
    await page.waitForTimeout(1300);
    const kind = await G('g.scope.cur.kind.id');
    await shot(`5-scope-${k}-${kind}`);
    check(await G("!document.getElementById('sky-card').hidden"), `the telescope shows a ${kind}, with its card`);
}
// one of each, for the record
for (const id of ['blackhole', 'galaxy', 'nebula', 'ringneb', 'pulsar', 'binary', 'ringed', 'lava', 'bluegiant', 'crystal']) {
    await G(`(() => { const s = g.scope; const pk = s.constructor; s.__force = '${id}'; })()`);
}
await G('g.leaveScope()');
await until('!g.scoping', 20000);
check(await G('g.controls.enabled'), 'stepping back from the eyepiece');
// and out of the tower
await G('(g.tower.controls.teleport(3.3, -3.3, 0), g.tower.rideTo(0))');
await until('!g.tower.ride && g.tower.floor === 0', 120000);
await G('g.throughDoor(false)');
await until("g.roomKind === null && !g.below", 20000);
check(true, 'back out into the garden');
check(errors.length === 0, 'no console errors' + (errors.length ? ': ' + errors.slice(0, 3).join(' | ') : ''));
await browser.close();

/**
 * arcadetest.mjs — drives the Lighthouse Arcade in real Chromium: the lighthouse
 * has a door, walking through it opens the arcade, there is a cabinet for every
 * game and clicking one shows that game's card, the screens fetch their demo
 * stills, a bowling lane plays a whole ten-frame game by real key presses (and
 * the score sheet adds up), the jukebox plays a record and the dance floor
 * follows the beat, a click on the floor walks you round the islands, and the
 * exit door takes you back out to the lighthouse. Screenshots along the way.
 * Fails on any console error or page error. Needs ?debug (the harness handle).
 *
 *   python3 -m http.server 8077            # from the REPO ROOT
 *   node garden/dev/arcadetest.mjs
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
    await page.screenshot({ path: path.join(OUT, `arcade-${PHONE ? 'phone-' : ''}${name}.png`), timeout: 180000 });
};
/** Screen position of a world point in the current view. */
const project = (x, y, z) => page.evaluate(([x, y, z]) => {
    const g = window.__garden, v = g.camera.position.clone().set(x, y, z).project(g.camera);
    return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight, front: v.z < 1 };
}, [x, y, z]);
const click = async (p) => (PHONE ? page.touchscreen.tap(p.x, p.y) : page.mouse.click(p.x, p.y));

await page.goto(`${BASE}/index.html?debug&enter&pr=0.6&t=0.4${process.env.Q ? '&q=' + process.env.Q : ''}`);
await until('g?.entered', 240000);
check(await G('!!g.world.lighthouse && !!g.world.lighthouse.mesh'), 'the lighthouse has a door');

// walk up to the lighthouse door and click it: the walk ends by going through
const lh = await G('({ ...g.world.lighthouse.out, cx: g.world.lighthouse.cx, cz: g.world.lighthouse.cz })');
await G(`g.controls.teleport(${lh.x}, ${lh.z}, ${lh.yaw + Math.PI})`);
await frames(8);
await shot('0-door');
const dp = await project(lh.cx + (lh.x - lh.cx) * 0.4, 1.6 + (await G(`g.world.walkHeight(${lh.x}, ${lh.z})`)), lh.cz + (lh.z - lh.cz) * 0.4);
check(dp.front && (await G(`g.pick(${dp.x}, ${dp.y})?.type`)) === 'lhDoor', 'the door is picked under the pointer');
await click(dp);
await until("g.roomKind === 'arcade' && !!g.arcade", 120000);
check(errors.length === 0, 'walking through the door builds the arcade without errors');
await frames(10);
await shot('1-entrance');

const info = await G('({ cabs: g.arcade.plan.cabinets.length, games: g.layout.games.length, lanes: g.arcade.plan.bowling.lanes.length, ids: new Set(g.arcade.plan.cabinets.map((c) => c.game.id)).size })');
check(info.cabs === info.games && info.ids === info.games, `a cabinet for every game (${info.cabs})`);
check(info.lanes >= 2, `${info.lanes} bowling lanes`);
await until('g.arcade.atl.loaded >= Math.min(20, g.arcade.plan.cabinets.length)', 60000);
check(true, 'the screens fetch their demo stills');

// look down an aisle at a cabinet and click it
const cab = await G('(() => { const c = g.arcade.plan.cabinets[3]; return { x: c.x, z: c.z, sx: c.stand.x, sz: c.stand.z, yaw: c.stand.yaw, title: c.game.title, id: c.game.id }; })()');
await G(`(g.controls.teleport(${cab.sx}, ${cab.sz + (cab.yaw === 0 ? 1.4 : -1.4)}, ${cab.yaw}), g.controls.pitch = -0.08)`);
await frames(12);
await shot('2-cabinet');
const sp = await project(cab.x, 1.36, cab.z + (cab.yaw === 0 ? 0.12 : -0.12));
await click(sp);
await frames(3);
check(await G(`g.ui.cardGame?.id === ${JSON.stringify(cab.id)}`), `clicking a cabinet shows its game card (${cab.title})`);
check(await page.isVisible('#card'), 'the card is on screen');
await shot('3-card');
await G('g.ui.closeAll()');

// a long look down the hall for the screenshot
await G(`(() => { const p = g.arcade.plan; g.controls.teleport(p.spawn.x, p.spawn.z, 0); g.controls.pitch = 0.02; })()`);
await page.waitForTimeout(1500);
await shot('4-hall');

// the bowling lane: step up, and bowl ten frames by keys
const lane = await G('(() => { const L = g.arcade.plan.bowling.lanes[0]; return { x: L.x, z: L.stand.z, fz: L.foulZ }; })()');
await G(`g.controls.teleport(${lane.x}, ${lane.z}, 0)`);
await frames(8);
await shot('5-alley');
const lp = await project(lane.x, 0.03, lane.fz - 6);
await click(lp);
await until('g.arcade.bowling.active', 10000);
check(true, 'clicking a lane steps you up to bowl');
await page.waitForTimeout(500);
await shot('6-aim');
let balls = 0;
for (let guard = 0; guard < 40 && !(await G('g.arcade.bowling.game.done')); guard++) {
    await until("g.arcade.bowling.state === 'aim'", 60000);
    await page.waitForTimeout(150);
    // aim near the pocket: lock when the sweeping arrow is near the middle
    await until('Math.abs(g.arcade.bowling.aim) < 0.006', 20000);
    await page.keyboard.press('Space');
    await until("g.arcade.bowling.state === 'power'", 5000);
    await until('g.arcade.bowling.power > 0.75', 20000);
    await page.keyboard.press('Space');
    await until("g.arcade.bowling.state === 'roll'", 5000);
    balls++;
    if (balls === 1) {
        await page.waitForTimeout(900);
        await shot('7-roll');
    }
    await until("g.arcade.bowling.state !== 'roll'", 60000);
    if (balls === 1) await shot('8-result');
}
const game = await G('({ rolls: g.arcade.bowling.game.rolls, total: g.arcade.bowling.game.total, done: g.arcade.bowling.game.done, sheet: document.getElementById("bowl-sheet").textContent })');
check(game.done, `a whole game is bowled in ${balls} balls`);
const sum = game.rolls.reduce((a, b) => a + b, 0);
check(game.total >= sum && game.total <= 300, `the score adds up (rolls ${game.rolls.join(',')} → ${game.total})`);
check(game.sheet.includes(String(game.total)), 'the score sheet shows the total');
await until("g.arcade.bowling.state === 'over'", 30000);
await shot('9-over');
await page.keyboard.press('Escape');
await until('!g.arcade.bowling.active && g.controls.enabled', 5000);
check(true, 'Esc steps off the lane');
check(await G('localStorage.getItem("garden.bowlBest") !== null || Object.keys(localStorage).some((k) => /bowlBest/.test(k))'), 'the best score is kept');

// the jukebox and the dance floor
const juke = await G('(() => { const j = g.arcade.plan.jukebox, d = g.arcade.plan.disco; return { x: j.x, z: j.z, dx: d.x, dz: d.z }; })()');
await G(`g.controls.teleport(${juke.x - 2.2}, ${juke.z}, ${-Math.PI / 2})`);
await frames(8);
const jp = await project(juke.x - 0.32, 1.0, juke.z);
await click(jp);
await until('g.arcade.jukeboxOpen', 5000);
check(true, 'clicking the jukebox opens it');
await page.click('[data-song="0"]');
await until('g.arcade.sound.song !== null', 5000);
await page.waitForTimeout(1500);
const beat = await G('g.arcade.lastBeat');
check(beat.playing && beat.beat > 1, `a record plays (${beat.bpm} bpm, beat ${beat.beat.toFixed(1)})`);
await shot('10-jukebox');
await G('g.arcade.closeJukebox()');
await G(`(g.controls.teleport(${juke.dx}, ${juke.dz + 4.5}, 0), g.controls.pitch = 0.15)`);
await page.waitForTimeout(1200);
await shot('11-disco');
const lit = await G('(() => { const c = g.arcade.disco.tiles.instanceColor.array; let s = 0; for (const v of c) s += v; return s / c.length; })()');
check(lit > 0.05, `the dance floor is lit (${lit.toFixed(2)})`);

// walk somewhere far by a click on the carpet, round the islands
const far = await G('(() => { const p = g.arcade.plan, c = p.cabinets[p.cabinets.length - 1]; return { x: c.stand.x, z: c.stand.z }; })()');
const route = await G(`g.arcade.path(g.controls.pos.x, g.controls.pos.z, ${far.x}, ${far.z})`);
check(Array.isArray(route) && route.length >= 1, `a path through the aisles (${route?.length} legs)`);
await G(`g.arcade.walkTo(${far.x}, ${far.z})`);
await until(`Math.hypot(g.controls.pos.x - ${far.x}, g.controls.pos.z - ${far.z}) < 0.6`, 120000);
check(true, 'the walk arrives');

// out of the door again
const ex = await G('g.arcade.exit');
await G(`g.controls.teleport(${ex.x}, ${ex.z - 2.4}, ${Math.PI})`);
await frames(3);
await G(`g.controls.walkTo([{ x: ${ex.x}, z: ${ex.z} }])`);
await until("!g.below && g.roomKind === null", 30000);
const pos = await G('({ x: g.controls.pos.x, z: g.controls.pos.z })');
check(Math.hypot(pos.x - lh.x, pos.z - lh.z) < 1.5, 'the exit door leads back out to the lighthouse');
check(await G('g.arcade.sound.song === null'), 'the music stops when you leave');
await frames(10);
check(errors.length === 0, 'no console or page errors');
console.log('arcade test passed');
await browser.close();

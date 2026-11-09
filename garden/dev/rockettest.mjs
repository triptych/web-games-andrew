/**
 * rockettest.mjs — the Silver Comet, the crashed rocket past the grove, in real
 * Chromium: finds the ship (on dry land, off the paths, on its own headland),
 * clicks it and walks up the ramp and aboard, checks the ship (the rooms, the
 * walls, the panel), presses Energize (it walks you onto the pad and the
 * transporter charges), arrives on a made-up world (sky, ground, plants,
 * animals, the recall beacon, the air running down), finds the pilot by the
 * radio ping and reads their log (the air waits while you read), clicks the
 * beacon home, dials the pilot's world again (the same world, the pilot still
 * there), runs out of air and is recalled, visits every kind of world once,
 * checks that a seed makes the same world twice and that the pilot never turns
 * up again once found, and walks out through the hatch; then a touch-only phone
 * boards, beams out and back by tapping. Fails on any console or page error.
 * Needs ?debug (the harness handle).
 *
 *   python3 -m http.server 8077            # from the REPO ROOT
 *   node garden/dev/rockettest.mjs
 *
 * Env: BASE, THREE_PKG (see browsertest.mjs), SHOTS=0 to skip screenshots,
 * Q=low|medium|high for the garden's quality tier (default low), ONLY=desktop|phone.
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
const ONLY = process.env.ONLY;
const Q = process.env.Q ?? 'low';
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

async function open(viewport, opts = {}) {
    const ctx = await browser.newContext({ viewport, deviceScaleFactor: 1, ...opts });
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
        await page.screenshot({ path: path.join(OUT, `rocket-${name}.png`), timeout: 300000 });
    };
    // where a point in the world appears on screen
    const screen = (x, y, z) => page.evaluate(([x, y, z]) => {
        const g = window.__garden;
        const v = g.camera.position.clone().set(x, y, z).project(g.camera);
        return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight, front: v.z < 1 };
    }, [x, y, z]);
    const click = async (id) => {
        const b = await page.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, w: r.width }; }, id);
        await page.mouse.click(b.x, b.y);
        return b;
    };
    return { ctx, page, G, until, frames, shot, screen, click };
}

const url = (extra = '') => `${BASE}/index.html?debug&enter&pr=0.5&t=0.4&q=${Q}${extra}`;
const aboard = 'g.below && g.roomKind === "rocket" && g.rocket?.inside';

// ---------------------------------------------------------------- desktop
if (!ONLY || ONLY === 'desktop') {
    const { ctx, page, G, until, frames, shot, screen, click } = await open({ width: 1000, height: 560 });
    await page.goto(url());
    await until('g?.entered', 900000);

    // ---- the ship on its headland
    const site = await G(`(() => {
        const r = g.world.rocket;
        const pts = [...g.layout.spokes.flatMap((s) => s.pts), ...g.layout.dock.pts];
        const path = Math.min(...pts.map((q) => Math.hypot(q.x - r.x, q.z - r.z)));
        const hull = [-9, -4, 0, 4, 9].map((lx) => r.toWorld(lx, 0));
        return { ok: !!r, path, shore: Math.max(...hull.map((p) => g.island.shoreAt(p.x, p.z))), ramp: g.island.shoreAt(r.front.x, r.front.z),
            solid: hull.every((p) => g.world.collidersNear(p.x, p.z).some((c) => Math.hypot(c.x - p.x, c.z - p.z) < c.r)),
            landmark: g.world.landmarks.some((l) => l.name === 'The Silver Comet') };
    })()`);
    check(site.ok, 'there is a crashed rocket');
    check(site.shore < -5 && site.ramp < -5, `its hull and ramp are on dry land (${site.shore.toFixed(1)} m from the shore at worst)`);
    check(site.path > 8, `clear of the paths (${site.path.toFixed(1)} m from the nearest)`);
    check(site.solid, 'the hull is solid all along');
    check(site.landmark, 'it is a named landmark');

    // ---- look at it, click it
    // (from the crater floor in front of the ramp: the rim round it hides the ship from further back)
    await G('(() => { const r = g.world.rocket; const p = r.toWorld(-1, 9.4); g.controls.teleport(p.x, p.z, Math.atan2(-(r.x - p.x), -(r.z - p.z))); g.controls.pitch = 0.05; })()');
    await frames(30);
    await shot('0-outside');
    const xy = await G(`(() => { const r = g.world.rocket; const p = r.toWorld(-3, 0); const v = g.camera.position.clone().set(p.x, r.y + 2.2, p.z).project(g.camera); return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight }; })()`);
    check(await G(`g.pick(${xy.x}, ${xy.y})?.type === 'rocket'`), 'the ship can be picked');
    await page.mouse.click(xy.x, xy.y);
    await until(aboard, 180000);
    check(true, 'clicking the ship walks you up the ramp and aboard');
    await frames(20);
    check(await G('g.rocket.state === "ship" && g.controls.enabled'), 'you are in the airlock, free to walk');
    check(await page.evaluate(() => !document.getElementById('rocket-hud').hidden), 'the panel is up');
    await shot('1-airlock');

    // ---- the ship: walls hold, every room is reachable
    const walls = await G(`(() => {
        const w = g.rocket.shipWorld;
        const open = (x, z) => w.island.heightAt(x, z) > 0;
        return { airlock: open(2, 3.5), corridor: open(0, 0), wall: !open(0, -1.5), outside: !open(20, 0), rooms: [[-12, 2.5], [-4.5, -4], [5, -4], [7.5, 3.5], [13, 0]].every(([x, z]) => open(x, z)) };
    })()`);
    check(walls.airlock && walls.corridor && walls.rooms, 'the airlock, the corridor and the five rooms can be stood in');
    check(walls.wall && walls.outside, 'the walls and the hull are solid');
    const route = await G('JSON.stringify(g.rocket.shipWorld.nav.find(2, 3.5, 13, 0)?.length ?? 0)');
    check(Number(route) > 0, 'there is a way from the airlock to the cockpit');
    await G('g.controls.teleport(2, 0, -Math.PI / 2)');
    await frames(15);
    await shot('2-corridor');
    await G('g.controls.teleport(11.6, 0, -Math.PI / 2); g.controls.pitch = -0.05');
    await frames(15);
    await shot('3-cockpit');

    // ---- Energize: it walks you to the pad and charges
    await G('g.rocket.forcePilot = true; g.controls.teleport(0, 0, Math.PI / 2)');
    await frames(5);
    await click('rk-go');
    await until('g.rocket.state === "charge"', 120000);
    check(true, 'Energize walks you onto the pad and the transporter charges');
    check(await G('Math.hypot(g.controls.pos.x + 4.5, g.controls.pos.z + 4.0) < 0.8'), 'you are standing on the pad');
    await shot('4-charge');
    await until('g.rocket.state === "planet"', 300000);
    const info = JSON.parse(await G('JSON.stringify(g.rocket.info)'));
    check(true, `you arrive on ${info.name}, a ${info.label} (${info.temp} °C, ${info.gravity}g, ${info.o2} s of air)`);
    const world = await G(`(() => {
        const P = g.rocket.planet, c = g.controls;
        return { scene: g.rocket.scene === P.scene, walk: P.walkable(c.pos.x, c.pos.z), y: g.camera.position.y - P.groundAt(c.pos.x, c.pos.z), creatures: P.creatures.length, species: P.species.length,
            plants: P.plants.length, sky: !!P.sky, bodies: P.bodies.length, gravity: c.gravity, pilot: !!P.pilot, signal: !document.getElementById('rk-signal').hidden };
    })()`);
    check(world.scene && world.sky, 'the world has its own scene and sky');
    check(world.walk && world.y > 1.2 && world.y < 2.2, 'you stand on dry ground at eye height');
    check(world.plants > 0, `things grow there (${world.plants} kinds)`);
    check(world.species === 0 || world.creatures > 0, `animals live there (${world.creatures} of ${world.species} species)`);
    check(Math.abs(world.gravity - info.gravity) < 1e-6, 'its gravity is yours while you are there');
    check(world.pilot && world.signal, 'the pilot is out there, and the suit radio has a signal');
    const o2a = await G('g.rocket.o2');
    await page.waitForTimeout(1500);
    const o2b = await G('g.rocket.o2');
    check(o2b < o2a, `the air runs down (${o2a.toFixed(1)} → ${o2b.toFixed(1)} s)`);
    for (const a of [0, 2.1, 4.2]) {
        await G(`g.controls.yaw += ${a}`);
        await frames(8);
        await shot(`5-world-${a}`);
    }

    // ---- the pilot
    await G(`(() => { const p = g.rocket.planet.pilot; const a = p.group.rotation.y; const x = p.x + Math.sin(a) * 4.2, z = p.z + Math.cos(a) * 4.2; g.controls.teleport(x, z, Math.atan2(-(p.x - x), -(p.z - z))); g.controls.pitch = -0.28; })()`);
    await frames(12);
    await shot('6-pilot');
    check(await G('!g.rocket.planet.pilot.found'), 'four metres off, they are not found yet');
    await G('(() => { const p = g.rocket.planet.pilot; g.controls.teleport(p.x + 2.2, p.z + 2.2, 0); })()');
    await until('g.rocket.planet.pilot.found', 60000);
    const bound = JSON.parse(await G('JSON.stringify(g.rocket.save.pilot)'));
    check(bound.seed === info.seed && bound.name === info.name, `walking up to them finds them, and binds them to ${bound.name}`);
    check(JSON.parse(await page.evaluate(() => localStorage.getItem('garden.rocketLog') || 'null'))?.pilot?.seed === info.seed, 'and it is saved');
    await until('g.rocket.logOpen', 60000);
    check(await page.evaluate(() => !document.getElementById('pilot-note').hidden && document.getElementById('pilot-note-body').textContent.includes('toaster')), 'their flight log opens');
    const o2c = await G('g.rocket.o2');
    await page.waitForTimeout(1200);
    check((await G('g.rocket.o2')) === o2c, 'the air waits while you read');
    await shot('7-log');
    await page.keyboard.press('Escape');
    check(await G('!g.rocket.logOpen && g.controls.enabled'), 'Esc closes it and you can walk again');

    // ---- the beacon home
    await G('g.controls.teleport(0, 7, 0); g.controls.pitch = -0.2');
    await frames(15);
    const pb = await screen(1.0, (await G('g.rocket.planet.padY')) + 1.2, 0.3);
    check(pb.front, 'the beacon is in view');
    await page.mouse.click(pb.x, pb.y);
    await until('g.rocket.state === "recall"', 60000);
    check(true, 'clicking the beacon beams you back');
    await until('g.rocket.state === "ship"', 120000);
    check(await G('g.rocket.scene === g.rocket.shipScene && Math.hypot(g.controls.pos.x + 4.5, g.controls.pos.z + 4.0) < 0.5 && g.controls.gravity === 1'), 'back on the pad aboard, at the garden’s gravity');
    check(await page.evaluate(() => !document.getElementById('rk-pilot').hidden && document.getElementById('rk-pilot').textContent.includes(' ')), 'the console can dial the pilot’s world now');

    // ---- the pilot's world again: the same world, the pilot still there
    await click('rk-pilot');
    await until('g.rocket.state === "planet"', 300000);
    const again = JSON.parse(await G('JSON.stringify({ seed: g.rocket.info.seed, name: g.rocket.info.name, pilot: !!g.rocket.planet.pilot, found: g.rocket.planet.pilot?.found, x: g.rocket.planet.pilot?.x })'));
    check(again.seed === info.seed && again.name === info.name, `Dial goes back to ${again.name}`);
    check(again.pilot && again.found, 'and the pilot is still there');
    await shot('8-again');

    // ---- out of air
    await G('g.rocket.o2 = 0.4');
    await until('g.rocket.state === "faint"', 60000);
    check(true, 'when the air runs out you faint');
    await until('g.rocket.state === "ship"', 120000);
    check(true, 'and the recall pulls you home');

    // ---- never another pilot, once found
    const later = await G(`(() => {
        const R = g.rocket; R.forcePilot = null;
        const out = [];
        for (let i = 0; i < 25; i++) { R.dest = 'random'; R._makeWorld(); out.push(!!R.planet.pilot); }
        R.planet.dispose();
        return out.filter(Boolean).length;
    })()`);
    check(later === 0, 'once found, the pilot never turns up on another world (25 tried)');

    // ---- the same seed makes the same world
    const same = await G(`(() => {
        const P = g.rocket.planet;
        const a = P.build(12345, { biome: 'ice', pilot: true }); const ac = P.creatures.length, ap = [P.pilot.x, P.pilot.z], ah = P.groundAt(10, 10);
        const b = P.build(12345, { biome: 'ice', pilot: true }); const same = a.name === b.name && ac === P.creatures.length && ap[0] === P.pilot.x && ap[1] === P.pilot.z && ah === P.groundAt(10, 10);
        P.dispose();
        return same;
    })()`);
    check(same, 'a seed makes the same world every time');

    // ---- every kind of world
    for (const key of ['verdant', 'desert', 'ice', 'ocean', 'lava', 'jungle', 'crystal', 'moon']) {
        await G(`g.rocket.forceBiome = '${key}'; g.rocket.energize('random')`);
        await until('g.rocket.state === "planet"', 300000);
        const w = JSON.parse(await G('JSON.stringify({ key: g.rocket.info.key, name: g.rocket.info.name, walk: g.rocket.planet.walkable(g.controls.pos.x, g.controls.pos.z), dry: !g.rocket.planet.liquidType || g.rocket.planet.groundAt(0, 0) > g.rocket.planet.level })'));
        check(w.key === key && w.walk && w.dry, `a ${key} world (${w.name}): you arrive dry and can walk`);
        await frames(10);
        await shot(`9-${key}`);
        await G('g.rocket.recall("early")');
        await until('g.rocket.state === "ship"', 120000);
    }
    await G('g.rocket.forceBiome = null');

    // ---- out through the hatch
    await click('rk-leave');
    await until('!g.below && g.roomKind === null', 120000);
    const outP = await G('JSON.stringify({ d: Math.hypot(g.controls.pos.x - g.world.rocket.out.x, g.controls.pos.z - g.world.rocket.out.z) })');
    check(JSON.parse(outP).d < 0.5, 'Leave the ship walks you out of the hatch and down the ramp');
    await frames(20);
    await shot('10-out');
    check(!errors.length, 'no console or page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
    await ctx.close();
}

// ---------------------------------------------------------------- phone
if (!ONLY || ONLY === 'phone') {
    const { ctx, page, G, until, frames, shot } = await open({ width: 390, height: 780 }, { hasTouch: true, isMobile: true });
    await page.goto(url());
    await until('g?.entered', 900000);
    await G('(() => { const r = g.world.rocket; const p = r.toWorld(-1, 9.4); g.controls.teleport(p.x, p.z, Math.atan2(-(r.x - p.x), -(r.z - p.z))); g.controls.pitch = 0.05; })()');
    await frames(30);
    const xy = await G(`(() => { const r = g.world.rocket; const p = r.toWorld(-1, 0); const v = g.camera.position.clone().set(p.x, r.y + 2.2, p.z).project(g.camera); return { x: (v.x * 0.5 + 0.5) * innerWidth, y: (-v.y * 0.5 + 0.5) * innerHeight }; })()`);
    await page.touchscreen.tap(xy.x, xy.y);
    await until(aboard, 180000);
    check(true, 'tapping the ship takes you aboard');
    await frames(20);
    const box = await page.evaluate(() => { const r = document.getElementById('rocket-hud').getBoundingClientRect(); return { l: r.left, t: r.top, r: r.right, b: r.bottom, w: innerWidth, h: innerHeight }; });
    check(box.l >= 0 && box.r <= box.w && box.t >= 0 && box.b < box.h * 0.45, 'the panel fits the top of a phone');
    await shot('phone-0-aboard');
    const tap = async (id) => {
        const b = await page.evaluate((id) => { const r = document.getElementById(id).getBoundingClientRect(); return { x: r.left + r.width / 2, y: r.top + r.height / 2, h: r.height }; }, id);
        check(b.h >= 40, `${id} is big enough to tap (${b.h.toFixed(0)} px)`);
        await page.touchscreen.tap(b.x, b.y);
    };
    await tap('rk-go');
    await until('g.rocket.state === "planet"', 400000);
    check(true, 'tapping Energize takes you to a world');
    await frames(20);
    await shot('phone-1-world');
    await tap('rk-recall');
    await until('g.rocket.state === "ship"', 200000);
    check(true, 'tapping Beam back brings you home');
    await tap('rk-leave');
    await until('!g.below && g.roomKind === null', 120000);
    check(true, 'tapping Leave the ship takes you out');
    check(!errors.length, 'no console or page errors' + (errors.length ? ': ' + errors.join(' | ') : ''));
    await ctx.close();
}

await browser.close();
console.log('rockettest: all good');

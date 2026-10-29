/**
 * simtest.mjs — headless checks of Kaiju Roll's simulation. No browser.
 *
 *   node game-107/dev/simtest.mjs            # everything
 *   ONLY=purity,rules node game-107/dev/simtest.mjs
 *   SEEDS=20 VERBOSE=1 node game-107/dev/simtest.mjs
 *
 * 1. purity: js/sim, js/rng.js and js/config.js never touch the DOM, a renderer, storage,
 *    Math.random or the clock, and never import the view, the UI or the audio.
 * 2. city: every generated city, on many seeds, fits its plate, has no overlapping buildings, starts
 *    the monster in open ground and can be reached everywhere by a ball of the starting size.
 * 3. rules: steering, the sea wall, bouncing off and crushing buildings, floors and rubble, eating,
 *    the pounce and its slam, the army, power-ups, dying, clearing a city, perks, winning.
 * 4. determinism: the same seed and inputs give the same game; a save round trip mid-fight plays on
 *    identically; an unknown save is refused.
 * 5. bot: a perfect, a decent and a sloppy bot play whole games on SEEDS seeds with per-step
 *    invariants; the balance table is printed.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const ROOT = path.join(HERE, '..');
const ONLY = (process.env.ONLY || '').split(',').filter(Boolean);
const SEEDS = +(process.env.SEEDS || 8);
const want = (name) => !ONLY.length || ONLY.includes(name);

const C = await import('../js/config.js');
const D = await import('../js/sim/data.js');
const City = await import('../js/sim/city.js');
const Gm = await import('../js/sim/game.js');
const Bt = await import('../js/sim/bot.js');

let fails = 0, checks = 0;
const ok = (cond, msg) => {
    checks++;
    if (!cond) { fails++; console.log('  FAIL', msg); } else if (process.env.VERBOSE) console.log('  ok', msg);
    return cond;
};
const section = (name) => console.log(`\n== ${name}`);
const DT = C.STEP;
const NONE = { x: 0, y: 0, a: false };
const run = (G, inp, secs) => { for (let t = 0; t < secs; t += DT) Gm.step(G, typeof inp === 'function' ? inp(G) : inp, DT); };
const evs = (G, type) => G.events.filter((e) => e.type === type);
const quiet = (G) => { G.foes.length = 0; G.shots.length = 0; G.bombs.length = 0; G.mil.tankT = G.mil.heliT = G.mil.jetT = 1e9; G.ball.inv = 0; G.events.length = 0; };
const place = (G, x, y, vx = 0, vy = 0) => { Object.assign(G.ball, { x, y, vx, vy, z: 0, vz: 0, air: false }); };
const sp = (G) => Math.hypot(G.ball.vx, G.ball.vy);
const find = (G, t) => G.buildings.find((b) => b.t === t && !b.dead);

if (want('purity')) {
    section('purity');
    const files = ['js/rng.js', 'js/config.js', ...fs.readdirSync(path.join(ROOT, 'js/sim')).map((f) => 'js/sim/' + f)];
    for (const f of files) {
        const src = fs.readFileSync(path.join(ROOT, f), 'utf8').replace(/\/\*[\s\S]*?\*\/|\/\/.*$/gm, '');
        ok(!/\bdocument\.|\bwindow\.|from 'three'|Math\.random|localStorage|performance\.now|Date\.now|requestAnimationFrame|setTimeout/.test(src), `${f} is pure`);
        ok(!/from '\.\.?\/(view|ui|audio|music|input|save|main)/.test(src), `${f} never imports the view, UI, audio, input or storage`);
    }
    console.log(`  ${files.length} files checked`);
}

if (want('city')) {
    section('city');
    let built = 0;
    for (let seed = 1; seed <= SEEDS; seed++) {
        for (let li = 0; li < D.LEVELS.length; li++) {
            const { layout: L, buildings, things } = City.genLevel(seed * 7919, li);
            built++;
            const tag = `seed ${seed} city ${li + 1}`;
            // everything inside the plate
            let inside = true;
            for (const b of buildings) {
                const hw = b.shape === 'circle' ? b.r : b.w / 2, hd = b.shape === 'circle' ? b.r : b.d / 2;
                if (b.x - hw < 0 || b.x + hw > L.W || b.y - hd < 0 || b.y + hd > L.roadEnd + 0.01) inside = false;
            }
            ok(inside, `${tag}: every building is on the plate and north of the plaza`);
            // no overlaps (a bridge's own deck and pylons are allowed to touch)
            let overlap = null;
            for (let i = 0; i < buildings.length && !overlap; i++) {
                for (let j = i + 1; j < buildings.length; j++) {
                    const a = buildings[i], b = buildings[j];
                    if ((a.t === 'deck' || a.t === 'pylon') && (b.t === 'deck' || b.t === 'pylon')) continue;
                    const ax = a.shape === 'circle' ? a.r : a.w / 2, ay = a.shape === 'circle' ? a.r : a.d / 2;
                    const bx = b.shape === 'circle' ? b.r : b.w / 2, by = b.shape === 'circle' ? b.r : b.d / 2;
                    if (Math.abs(a.x - b.x) < ax + bx - 0.05 && Math.abs(a.y - b.y) < ay + by - 0.05) { overlap = `${a.t}#${a.id} ${b.t}#${b.id}`; break; }
                }
            }
            ok(!overlap, `${tag}: no buildings overlap ${overlap || ''}`);
            // buildings sit on lots, never on a street
            let onStreet = null;
            for (const b of buildings) {
                if (b.t === 'deck' || b.t === 'pylon') continue;
                const hw = b.shape === 'circle' ? b.r : b.w / 2, hd = b.shape === 'circle' ? b.r : b.d / 2;
                if (!L.blocks.some((k) => b.x - hw >= k.x && b.x + hw <= k.x + k.w && b.y - hd >= k.y && b.y + hd <= k.y + k.h)) { onStreet = `${b.t}#${b.id}`; break; }
            }
            ok(!onStreet, `${tag}: every building is inside a block ${onStreet || ''}`);
            ok(buildings.every((b) => b.fl >= 1 && b.hp > 0 && Number.isFinite(b.hp)), `${tag}: every building has floors and strength`);
            ok(things.every((t) => t.x >= -3 && t.x <= L.W + 3 && t.y >= -3 && t.y <= L.H + 1), `${tag}: every thing is on or beside the plate`);
            ok(L.start.y > L.plaza.y && L.start.y < L.H - 2, `${tag}: the monster starts in the plaza`);
            ok(buildings.length >= 20 + li * 4, `${tag}: a proper city (${buildings.length} buildings)`);
            // the ball of the starting size can reach every building
            const r0 = D.LEVELS[li].r0, cell = 0.5;
            const nx = Math.ceil(L.W / cell), ny = Math.ceil(L.H / cell);
            const free = new Uint8Array(nx * ny);
            for (let j = 0; j < ny; j++) {
                for (let i = 0; i < nx; i++) {
                    const x = (i + 0.5) * cell, y = (j + 0.5) * cell;
                    let f = x > r0 && x < L.W - r0 && y > r0 && y < L.H - r0 ? 1 : 0;
                    if (f) {
                        for (const b of buildings) {
                            if (b.t === 'deck') continue;              // decks are rolled over
                            if (b.shape === 'circle') { if (Math.hypot(x - b.x, y - b.y) < b.r + r0) { f = 0; break; } }
                            else if (Math.abs(x - b.x) < b.w / 2 + r0 && Math.abs(y - b.y) < b.d / 2 + r0) { f = 0; break; }
                        }
                    }
                    free[j * nx + i] = f;
                }
            }
            const seen = new Uint8Array(nx * ny), stack = [[Math.floor(L.start.x / cell), Math.floor(L.start.y / cell)]];
            seen[stack[0][1] * nx + stack[0][0]] = 1;
            while (stack.length) {
                const [i, j] = stack.pop();
                for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
                    const a = i + di, b = j + dj;
                    if (a < 0 || b < 0 || a >= nx || b >= ny || seen[b * nx + a] || !free[b * nx + a]) continue;
                    seen[b * nx + a] = 1; stack.push([a, b]);
                }
            }
            let unreachable = 0;
            for (const b of buildings) {
                if (b.t === 'deck' || b.t === 'pylon') continue;
                const hw = (b.shape === 'circle' ? b.r : b.w / 2) + r0 + 0.8, hd = (b.shape === 'circle' ? b.r : b.d / 2) + r0 + 0.8;
                let reach = false;
                for (let j = Math.max(0, Math.floor((b.y - hd) / cell)); j <= Math.min(ny - 1, Math.floor((b.y + hd) / cell)) && !reach; j++) {
                    for (let i = Math.max(0, Math.floor((b.x - hw) / cell)); i <= Math.min(nx - 1, Math.floor((b.x + hw) / cell)); i++) if (seen[j * nx + i]) { reach = true; break; }
                }
                if (!reach) unreachable++;
            }
            ok(unreachable === 0, `${tag}: a ball of radius ${r0} can reach every building (${unreachable} cannot)`);
        }
    }
    // the same seed builds the same city
    const a = City.genLevel(77, 2), b = City.genLevel(77, 2);
    ok(JSON.stringify(a) === JSON.stringify(b), 'a seed and a level rebuild the same city');
    ok(JSON.stringify(City.genLevel(77, 2).buildings) !== JSON.stringify(City.genLevel(78, 2).buildings), 'a different seed builds a different city');
    console.log(`  ${built} cities checked`);
}

if (want('rules')) {
    section('rules');
    let G = Gm.newGame(1);
    quiet(G);
    const b0 = G.ball;
    ok(G.phase === 'play' && G.lives === C.LIVES && b0.hp === C.BALL.hp, 'a new game starts playing with full lives and health');
    ok(Math.abs(b0.r - D.LEVELS[0].r0) < 1e-9 && Math.abs(b0.V - b0.r ** 3) < 1e-9, 'the ball starts at the city\'s radius, volume = r³');

    // steering and the minimum speed
    run(G, NONE, 3);
    ok(sp(G) >= C.BALL.minSpeed - 0.05, `a ball with no input keeps rolling (speed ${sp(G).toFixed(2)})`);
    place(G, 20, 70, 0, 0);
    G.ball.hx = 0; G.ball.hy = -1;
    run(G, { x: 1, y: 0, a: false }, 0.6);
    ok(G.ball.vx > 5, `steering right turns the roll (vx ${G.ball.vx.toFixed(1)})`);
    place(G, 20, 70, 20, 0);
    run(G, { x: 1, y: 0, a: false }, 2);
    ok(sp(G) <= C.BALL.maxSpeed + 1, `the ball never exceeds its top speed (${sp(G).toFixed(1)})`);

    // the sea wall
    G = Gm.newGame(2); quiet(G);
    place(G, G.layout.W - 3, G.layout.H - 3, 10, 0);
    run(G, NONE, 0.8);
    ok(G.ball.vx < 0 && G.ball.x <= G.layout.W - G.ball.r + 1e-6, 'the sea wall bounces the ball back');
    ok(G.events.some((e) => e.type === 'bounce' && e.what === 'wall'), 'and says so');

    // a building: bounce, damage, floors, rubble
    G = Gm.newGame(3); quiet(G);
    const blk = G.buildings.find((b) => b.t === 'block' || b.t === 'shop');
    const hp0 = blk.hp, fl0 = blk.fl, hpLeft0 = G.hpLeft;
    place(G, blk.x - blk.w / 2 - G.ball.r - 0.4, blk.y, 12, 0);
    run(G, NONE, 0.5);
    ok(blk.hp < hp0, 'ramming a building hurts it');
    ok(G.ball.vx < 3, `and bounces the ball back (vx ${G.ball.vx.toFixed(1)})`);
    const be = evs(G, 'bounce').find((e) => e.what === 'building');
    ok(be && be.id === blk.id, 'the bounce event names the building');
    ok(Math.abs((hpLeft0 - G.hpLeft) - (hp0 - blk.hp)) < 1e-6, 'the city\'s strength falls by exactly the damage done');
    // a hard-enough hit drops floors and throws rubble
    G.events.length = 0;
    const rub0 = G.rubble.length, sc0 = G.score;
    Gm.hurtBuilding(G, blk, blk.fhp * 1.2, blk.x, blk.y);
    ok(blk.fl < fl0 || blk.hp <= hp0 - blk.fhp, 'enough damage takes a floor');
    ok(evs(G, 'floors').length >= 1 && G.rubble.length > rub0 && G.score > sc0, 'floors falling throw rubble and score');
    Gm.hurtBuilding(G, blk, 1e9, blk.x, blk.y);
    ok(blk.dead && blk.fl === 0 && blk.hp === 0, 'enough damage collapses it');
    ok(evs(G, 'collapse').length === 1, 'with exactly one collapse event');
    Gm.hurtBuilding(G, blk, 100, 0, 0);
    ok(evs(G, 'collapse').length === 1, 'a dead building takes no more damage');
    ok(G.hpLeft >= -1e-6 && G.hpLeft <= G.totalHp, 'the city\'s strength stays within bounds');

    // a big ball rolls over a house instead of bouncing
    G = Gm.newGame(4); quiet(G);
    const house = G.buildings.find((b) => b.t === 'house');
    Gm.hurtBuilding(G, house, 0, 0, 0);
    G.ball.r = 3.2; G.ball.V = 3.2 ** 3;
    place(G, house.x - house.w / 2 - 2, house.y, 8, 0);
    const hh = house.hp;
    run(G, NONE, 0.6);
    ok(house.hp < hh || house.dead, 'a ball taller than a house crushes it');
    ok(G.ball.vx > 2, 'without bouncing off');

    // eating
    G = Gm.newGame(5); quiet(G);
    G.things.length = 0;
    G.things.push({ id: 9001, k: 'person', x: 30, y: 60, a: 0, size: 0.2, c: 0, mv: null });
    place(G, 30, 60, 0, -4);
    const V0 = G.ball.V;
    run(G, NONE, 0.1);
    ok(G.things.length === 0 && G.ball.V > V0, 'rolling over a person swallows them and grows the ball');
    ok(G.ball.stuck.length === 1, 'they stick to the ball');
    ok(evs(G, 'eat').length === 1, 'and an eat event goes out');
    G.things.push({ id: 9002, k: 'oak', x: 30, y: 50, a: 0, size: 1.5, c: 0, mv: null });
    place(G, 30, 53.2, 0, -4);
    run(G, NONE, 0.5);
    ok(G.things.length === 1 && G.ball.vy > 0, 'a tree bigger than the ball is too big to swallow: it bounces off slowly');
    place(G, 30, 53.2, 0, -9);
    run(G, NONE, 0.3);
    ok(G.things.length === 0, 'and gets flattened at speed');
    // a pickup of food heals
    G.things.push({ id: 9003, k: 'pizza', x: 30, y: 40, a: 0, size: 0.8, c: 0, mv: null });
    G.ball.hp = 40;
    place(G, 30, 40, 0, -4);
    run(G, NONE, 0.1);
    ok(G.ball.hp > 40, 'a pizza truck heals');

    // the pounce
    G = Gm.newGame(6); quiet(G);
    const tgt = G.buildings.find((b) => b.t === 'block' || b.t === 'shop');
    const th0 = tgt.hp;
    place(G, tgt.x, tgt.y + tgt.d / 2 + G.ball.r + 0.2, 0, 0);
    Gm.step(G, { x: 0, y: 0, a: true }, DT);
    ok(G.ball.air && G.ball.vz > 0 && evs(G, 'pounce').length === 1, 'the pounce takes the ball into the air');
    ok(G.ball.cd > 0, 'and starts the cooldown');
    Gm.step(G, { x: 0, y: 0, a: true }, DT);
    ok(evs(G, 'pounce').length === 1, 'a second press in the air does nothing');
    let t = 0, peak = 0;
    while (G.ball.air && t < 3) { Gm.step(G, NONE, DT); peak = Math.max(peak, G.ball.z); t += DT; }
    ok(!G.ball.air && t > 0.6 && t < 1.6, `it lands after about a second (${t.toFixed(2)} s, peak ${peak.toFixed(1)})`);
    ok(evs(G, 'slam').length === 1, 'landing makes a slam');
    ok(tgt.hp < th0 || tgt.dead, 'which hurts the buildings it lands beside');
    quiet(G);
    Gm.step(G, { x: 0, y: 0, a: true }, DT);
    ok(evs(G, 'pounce').length === 0, 'the cooldown stops another pounce straight away');
    // jumping clear
    G = Gm.newGame(6); quiet(G);
    const low = G.buildings.find((b) => b.t === 'house' && b.fl === 1) || G.buildings.find((b) => b.t === 'house');
    place(G, low.x - low.w / 2 - 0.2, low.y, 4, 0);
    G.ball.z = 4; G.ball.vz = 0; G.ball.air = true;
    const lh = low.hp;
    Gm.step(G, NONE, DT);
    ok(low.hp === lh, 'a ball high above a roof does not hit the wall');

    // the army
    G = Gm.newGame(7); quiet(G);
    place(G, G.layout.start.x, G.layout.start.y, 0, 0);
    G.ball.hp = 100; G.ball.inv = 0;
    G.shots.push({ id: 1, k: 'shell', x: G.ball.x + 0.2, y: G.ball.y, z: 0.8, vx: 0, vy: 0, life: 2, dmg: 13 });
    Gm.step(G, NONE, DT);
    ok(G.ball.hp < 100 && evs(G, 'hurt').length === 1, 'a shell that reaches the ball hurts it');
    G.shots.push({ id: 2, k: 'shell', x: G.ball.x + 0.2, y: G.ball.y, z: 0.8, vx: 0, vy: 0, life: 2, dmg: 13 });
    const hpAfter = G.ball.hp;
    Gm.step(G, NONE, DT);
    ok(G.ball.hp === hpAfter, 'and the grace period stops a second hit at once');
    quiet(G);
    G.ball.z = 3; G.ball.vz = 0; G.ball.air = true;
    G.shots.push({ id: 3, k: 'shell', x: G.ball.x + 0.1, y: G.ball.y, z: 0.8, vx: 0, vy: 0, life: 2, dmg: 13 });
    const hp3 = G.ball.hp;
    Gm.step(G, NONE, DT);
    ok(G.ball.hp === hp3, 'a shell passes under a jumping ball');
    quiet(G); place(G, G.layout.start.x, G.layout.start.y, 0, 0);
    G.power.shield = 5;
    G.shots.push({ id: 4, k: 'shell', x: G.ball.x + 0.1, y: G.ball.y, z: 0.8, vx: 0, vy: 0, life: 2, dmg: 13 });
    const hp4 = G.ball.hp;
    Gm.step(G, NONE, DT);
    ok(G.ball.hp === hp4 && evs(G, 'shield').length === 1, 'a shield soaks a shell');
    // tanks are flattened by a fast roll
    G = Gm.newGame(8); quiet(G);
    G.foes.push({ id: 5, k: 'tank', x: 30, y: 40, a: 0, ta: 0, hp: 3, cd: 99, mv: { ax: 'x', fixed: 40, lo: 1, hi: 60, spd: 0, dir: 1 } });
    place(G, 30, 43, 0, -9);
    run(G, NONE, 0.5);
    ok(G.foes.length === 0 && G.stats.smashed >= 1, 'a ball at speed flattens a tank');
    // a helicopter is swatted by a jump
    G.foes.push({ id: 6, k: 'heli', x: 30, y: 30, z: 4.4, a: 0, hp: 1, cd: 99, orbit: 0, dir: 1, rad: 0.001 });
    place(G, 30, 30.0, 0, 0);
    G.ball.z = 2.8; G.ball.vz = 0.1; G.ball.air = true; G.ball.cd = 1;
    G.foes[0].orbit = 0;
    Gm.step(G, NONE, DT);
    ok(!G.foes.some((f) => f.k === 'heli'), 'a pouncing ball swats a helicopter out of the sky');
    // the military shows up on its own timetable
    G = Gm.newGame(9);
    G.ball.inv = 1e9;
    run(G, { x: 0, y: 0, a: false }, D.LEVELS[0].mil.tank[0] + 1);
    ok(G.foes.some((f) => f.k === 'tank'), 'the first tank arrives on time');
    ok(G.events.some((e) => e.type === 'wave'), 'with a wave event');
    // a jet makes a bombing run
    G = Gm.newGame(9, 2); quiet(G);
    G.mil.jetT = 0.01; G.mil.heliT = G.mil.tankT = 1e9;
    G.ball.inv = 1e9;
    run(G, NONE, 6);
    ok(G.events.some((e) => e.type === 'warn') && G.events.some((e) => e.type === 'drop'), 'a bomber warns, then drops bombs');
    ok(G.events.some((e) => e.type === 'boom'), 'and they explode');

    // power-ups
    G = Gm.newGame(10); quiet(G);
    place(G, G.layout.start.x, G.layout.start.y, 0, 0);
    G.pickups.push({ x: G.ball.x, y: G.ball.y, k: 'fire', life: 10 });
    Gm.step(G, NONE, DT);
    ok(G.power.fire > 10 && G.pickups.length === 0 && evs(G, 'power').length === 1, 'a power-up is collected by touching it');
    const hb = G.buildings.find((b) => !b.dead && (b.t === 'block' || b.t === 'shop'));
    place(G, hb.x, hb.y + hb.d / 2 + G.ball.r + 0.6, 0, 3);
    const hbhp = hb.hp;
    G.ball.vy = 0; G.ball.vx = 0;
    run(G, NONE, 0.3);
    ok(hb.hp < hbhp, 'the fire burns buildings the ball only passes near');
    G.pickups.push({ x: G.ball.x, y: G.ball.y, k: 'meal', life: 10 });
    const Vm = G.ball.V;
    Gm.step(G, NONE, DT);
    ok(G.ball.V > Vm * 1.15, 'a mega meal makes the ball bigger');
    // an unattended power-up goes away
    G.pickups.push({ x: 1, y: 1, k: 'heart', life: 0.05 });
    run(G, NONE, 0.2);
    ok(G.pickups.length === 0, 'an uncollected power-up expires');

    // dying
    G = Gm.newGame(11); quiet(G);
    G.ball.hp = 1;
    Gm.hurtBall(G, 50, 0, 0);
    ok(G.phase === 'dead' && G.lives === C.LIVES - 1 && evs(G, 'die').length === 1, 'running out of health costs a life');
    const Vd = G.ball.V = 2.5; Gm.step(G, NONE, DT);
    run(G, NONE, 2.2);
    ok(G.phase === 'play' && G.ball.hp === G.ball.maxHp && G.ball.inv > 1, 'then the monster comes back with full health and a grace period');
    ok(G.ball.V < Vd + 1e-9 && G.ball.V >= D.LEVELS[0].r0 ** 3 - 1e-9, 'and loses some of its size');
    G.lives = 1; G.ball.hp = 1; G.ball.inv = 0;
    Gm.hurtBall(G, 50, 0, 0);
    ok(G.over && G.phase === 'over' && evs(G, 'over').length === 1, 'the last life ends the game');
    const tt = G.t; Gm.step(G, NONE, DT);
    ok(G.t === tt, 'and the sim stops');

    // clearing a city, a perk and the next city
    G = Gm.newGame(12); quiet(G);
    const goal = D.LEVELS[0].goal;
    G.hpLeft = G.totalHp * (1 - goal) + 1e-6; Gm.step(G, NONE, DT);
    ok(G.phase === 'play', 'just short of the goal, the city stands');
    G.hpLeft = G.totalHp * (1 - goal) - 1; Gm.step(G, NONE, DT);
    ok(G.phase === 'clear' && evs(G, 'clear').length === 1, 'reaching the goal clears the city');
    ok(G.clear.stars >= 1 && G.clear.stars <= 3, `with a star rating (${G.clear.stars})`);
    const sc = G.score, lv = G.lives;
    ok(!Gm.nextLevel(Object.assign(Gm.newGame(1), {})), 'you cannot skip a city that is not cleared');
    ok(Gm.choosePerk(G, 'hp') && G.perks.hp === 1, 'a perk can be chosen');
    ok(!Gm.choosePerk(Gm.newGame(1), 'hp'), 'but only on the clear screen');
    ok(Gm.nextLevel(G) && G.level === 1 && G.phase === 'play', 'the next city loads');
    ok(G.score === sc && G.lives === lv, 'keeping score and lives');
    ok(G.ball.maxHp === C.BALL.hp + 25 && G.ball.hp <= G.ball.maxHp, 'and applying the perk');
    ok(Math.abs(G.ball.r - D.LEVELS[1].r0) < 1e-9 && G.ball.stuck.length === 0, 'the monster starts the new city at its size, with nothing stuck on');
    ok(G.things.length > 0 && G.buildings.every((b) => !b.dead), 'a fresh city is built');
    // winning
    G = Gm.newGame(13, D.LEVELS.length - 1); quiet(G);
    G.hpLeft = 0; Gm.step(G, NONE, DT);
    ok(G.phase === 'won' && G.won && evs(G, 'win').length === 1, 'clearing the last city wins the game');
}

if (want('determinism')) {
    section('determinism');
    const play = (seed, secs) => { const G = Gm.newGame(seed); const b = Bt.makeBot(); run(G, (g) => Bt.botInput(g, b), secs); return G; };
    const a = play(42, 25), b = play(42, 25);
    ok(JSON.stringify(Gm.serialize(a)) === JSON.stringify(Gm.serialize(b)), 'same seed and inputs, same game');
    ok(JSON.stringify(Gm.serialize(play(43, 25))) !== JSON.stringify(Gm.serialize(a)), 'a different seed plays differently');

    // a save in the middle of a fight, with a tank, shots and a bomb about, plays on identically
    const G = Gm.newGame(7, 2);
    const bot = Bt.makeBot();
    G.mil.tankT = 1; G.mil.heliT = 3; G.mil.jetT = 5;
    run(G, (g) => Bt.botInput(g, bot), 20);
    ok(G.foes.length > 0, `there is an army about when we save (${G.foes.map((f) => f.k).join(',')})`);
    const copy = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(G))));
    ok(JSON.stringify(Gm.serialize(copy)) === JSON.stringify(Gm.serialize(G)), 'a save loads back to the same state');
    const b1 = Bt.makeBot(), b2 = Bt.makeBot();
    run(G, (g) => Bt.botInput(g, b1), 15);
    run(copy, (g) => Bt.botInput(g, b2), 15);
    ok(JSON.stringify(Gm.serialize(G)) === JSON.stringify(Gm.serialize(copy)), 'a save round trip plays on identically');
    ok(JSON.stringify(copy.layout) === JSON.stringify(G.layout), 'the street layout comes back with it');
    const fresh = Gm.newGame(5);
    ok(JSON.stringify(Gm.serialize(Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(fresh)))))) === JSON.stringify(Gm.serialize(fresh)), 'a brand-new game round-trips exactly (the RNG state is stored the same way before and after its first call)');
    let threw = false;
    try { Gm.deserialize({ v: 999 }); } catch { threw = true; }
    ok(threw, 'an unknown save version is rejected, not half-loaded');
    threw = false;
    try { Gm.deserialize({ v: 1, level: 99 }); } catch { threw = true; }
    ok(threw, 'so is a save from a city that does not exist');
    ok(JSON.stringify(Gm.serialize(G)).length < 400000, `a save stays small (${JSON.stringify(Gm.serialize(G)).length} bytes)`);
}

if (want('bot')) {
    section('bot');
    const rows = [];
    const SKILLS = [1, 0.6, 0.3];
    for (let s = 1; s <= SEEDS; s++) {
        for (const skill of SKILLS) {
            const G = Gm.newGame(s * 7919);
            const bot = Bt.makeBot({ skill });
            const per = [];
            let bad = null, steps = 0, perks = 0;
            const MAXSTEPS = 120 * 60 * 14;
            while (!G.over && !G.won && steps < MAXSTEPS && !bad) {
                Gm.step(G, Bt.botInput(G, bot), DT);
                steps++;
                G.events.length = 0;
                const p = G.ball;
                if (![p.x, p.y, p.z, p.vx, p.vy, p.r, p.V, p.hp].every(Number.isFinite)) bad = 'non-finite ball';
                else if (p.x < 0 || p.y < 0 || p.x > G.layout.W || p.y > G.layout.H) bad = `ball outside the plate (${p.x.toFixed(1)}, ${p.y.toFixed(1)})`;
                else if (p.hp < 0 || p.hp > p.maxHp) bad = 'health out of range';
                else if (G.hpLeft < -1e-6 || G.hpLeft > G.totalHp + 1e-6) bad = 'city strength out of range';
                else if (p.r > C.BALL.maxR + 1e-9) bad = 'ball too big';
                else if (G.rubble.length > 260) bad = 'too much rubble';
                else if (G.score < 0) bad = 'negative score';
                if (G.phase === 'clear') {
                    per.push({ t: G.levelT, hp: G.stats.hpLost, d: G.stats.deaths, r: G.ball.r, eaten: G.stats.eaten });
                    Gm.choosePerk(G, ['hp', 'cd', 'size', 'dmg', 'pow'][perks++ % 5]);
                    Gm.nextLevel(G);
                    bot.target = null;
                }
            }
            if (G.won) per.push({ t: G.levelT, hp: G.stats.hpLost, d: G.stats.deaths, r: G.ball.r, eaten: G.stats.eaten });
            ok(!bad, `seed ${s} skill ${skill}: ${bad || 'invariants hold'}`);
            rows.push({ seed: s, skill, won: G.won, over: G.over, level: G.level, score: G.score, t: G.t, per, lives: G.lives });
        }
    }
    const of = (k) => rows.filter((r) => r.skill === k);
    const avg = (arr, f) => arr.reduce((a, r) => a + f(r), 0) / Math.max(1, arr.length);
    ok(of(1).every((r) => r.won), `the perfect bot wins every game (${of(1).filter((r) => r.won).length}/${SEEDS})`);
    ok(of(0.6).filter((r) => r.won).length >= SEEDS * 0.6, `a decent bot usually wins (${of(0.6).filter((r) => r.won).length}/${SEEDS})`);
    ok(avg(of(1), (r) => r.score) > avg(of(0.6), (r) => r.score) && avg(of(0.6), (r) => r.score) > avg(of(0.3), (r) => r.score), 'a better bot scores more');
    ok(of(0.3).some((r) => r.lives < C.LIVES || r.over), 'a sloppy bot does lose lives: the army is a real threat');
    ok(avg(of(1), (r) => r.t) > 150 && avg(of(1), (r) => r.t) < 900, `a whole game takes a sensible time (${avg(of(1), (r) => r.t).toFixed(0)} s for the perfect bot)`);
    // per-city numbers for the perfect bot
    const line = (k) => {
        const ps = of(k).map((r) => r.per).filter((p) => p.length);
        return D.LEVELS.map((_, i) => {
            const xs = ps.map((p) => p[i]).filter(Boolean);
            return xs.length ? `${avg(xs, (x) => x.t).toFixed(0)}s/${avg(xs, (x) => x.hp).toFixed(0)}hp` : '-';
        }).join('  ');
    };
    console.log('  seconds / health lost per city');
    console.log(`  perfect  ${line(1)}`);
    console.log(`  decent   ${line(0.6)}`);
    console.log(`  sloppy   ${line(0.3)}`);
    console.log(`  ${rows.length} games · average score: perfect ${Math.round(avg(of(1), (r) => r.score))}, decent ${Math.round(avg(of(0.6), (r) => r.score))}, sloppy ${Math.round(avg(of(0.3), (r) => r.score))} · sloppy wins ${of(0.3).filter((r) => r.won).length}/${SEEDS}`);
}

if (want('chaos')) {
    section('chaos');
    // random steering and random pounces in every city, with the army forced on, checking invariants and
    // that a save taken now plays on identically
    const { makeRng } = await import('../js/rng.js');
    let runs = 0, bad = null;
    for (let seed = 1; seed <= Math.max(4, SEEDS) && !bad; seed++) {
        for (let li = 0; li < D.LEVELS.length && !bad; li++) {
            const G = Gm.newGame(seed * 31, li), r = makeRng(seed * 977 + li);
            G.mil.tankT = 1; G.mil.heliT = 2; G.mil.jetT = 3;
            let ix = 0, iy = 0;
            for (let s = 0; s < 120 * 40 && !bad; s++) {
                if (s % 30 === 0) { ix = r() * 2 - 1; iy = r() * 2 - 1; if (r() < 0.3) ix = iy = 0; }
                Gm.step(G, { x: ix, y: iy, a: r() < 0.01 }, DT);
                G.events.length = 0;
                const b = G.ball;
                if (![b.x, b.y, b.z, b.vx, b.vy, b.vz, b.r, b.V, b.hp].every(Number.isFinite)) bad = `seed ${seed} city ${li + 1} step ${s}: non-finite ball`;
                else if (b.x < -0.01 || b.y < -0.01 || b.x > G.layout.W + 0.01 || b.y > G.layout.H + 0.01) bad = `seed ${seed} city ${li + 1} step ${s}: ball off the plate`;
                else if (G.phase === 'clear') Gm.nextLevel(G);
                else if (s % 600 === 0) {
                    const c = Gm.deserialize(JSON.parse(JSON.stringify(Gm.serialize(G))));
                    if (JSON.stringify(Gm.serialize(c)) !== JSON.stringify(Gm.serialize(G))) bad = `seed ${seed} city ${li + 1} step ${s}: save does not round trip`;
                }
                if (G.over || G.won) break;
            }
            runs++;
        }
    }
    ok(!bad, `${runs} random-input runs: ${bad || 'invariants hold and saves round trip'}`);
}

console.log(`\n${fails ? `${fails} FAILED` : 'all passed'} (${checks} checks)`);
process.exit(fails ? 1 : 0);

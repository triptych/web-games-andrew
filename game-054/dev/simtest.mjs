/**
 * simtest.mjs — headless checks on the level generator and the collision
 * model. No browser, no three.js (gen.js and world.js are pure).
 *
 *  1. Purity: js/level/gen.js and js/game/world.js never import three.js,
 *     touch the DOM or call Math.random.
 *  2. Every campaign level on SEEDS seeds, and Endless Descent floors
 *     1..FLOORS, generate and pass validate(): exit, every key, every
 *     pickup and every terminal reachable in key order.
 *  3. Determinism: the same seed gives a byte-identical level.
 *  4. A bot walks each level with the *real* collision code (World.move,
 *     player-sized box, STEP, headroom, doors that open and close), going
 *     start → each key in order → the exit switch. If it ever stalls for
 *     4 simulated seconds the level fails — that's how mismatches between
 *     what the generator thinks is walkable and what the body can actually
 *     pass get caught.
 *
 *   node game-054/dev/simtest.mjs            (SEEDS=6 FLOORS=20 by default)
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { generateLevel, validate, canStep } from '../js/level/gen.js';
import { World } from '../js/game/world.js';
import { LEVELS } from '../js/story.js';
import { arsenalFor, descentSpec, descentArsenal } from '../js/campaign.js';
import { DIFFICULTIES, CELL, PLAYER, STEP, KEY_ORDER } from '../js/config.js';

const HERE = path.dirname(fileURLToPath(import.meta.url));
const SEEDS = +(process.env.SEEDS ?? 6);
const FLOORS = +(process.env.FLOORS ?? 20);
let fails = 0;
let walked = 0, walkTime = 0;
const fail = (msg) => { fails++; console.log('  FAIL', msg); };

// ------------------------------------------------------------------ 1. purity
for (const f of ['../js/level/gen.js', '../js/game/world.js', '../js/game/bestiary.js', '../js/rng.js']) {
    const src = fs.readFileSync(path.join(HERE, f), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/.*$/gm, '');
    if (/from 'three'/.test(src)) fail(`${f} imports three`);
    if (/Math\.random/.test(src)) fail(`${f} uses Math.random`);
    if (/document\.|window\./.test(src)) fail(`${f} touches the DOM`);
}
console.log('purity checked');

// ------------------------------------------------------------------ helpers
function bfsPath(L, from, to, keys) {
    const { W } = L;
    const prev = new Int32Array(L.W * L.H).fill(-1);
    prev[from] = from;
    const q = [from];
    while (q.length) {
        const a = q.shift();
        if (a === to) break;
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const b = a + dx + dy * W;
            if (prev[b] >= 0 || !canStep(L, a, b)) continue;
            const d = L.door[b];
            if (d >= 0 && L.doors[d].key && !keys.has(L.doors[d].key)) continue;
            prev[b] = a; q.push(b);
        }
    }
    if (prev[to] < 0) return null;
    const out = [];
    for (let c = to; c !== from; c = prev[c]) out.push(c);
    out.reverse();
    return out;
}

/** Walk the real collision model along a cell path. */
function walk(L, world, body, cells, keys, label) {
    const dt = 1 / 60;
    let stall = 0, t = 0;
    for (const c of cells) {
        const tx = ((c % L.W) + 0.5) * CELL, tz = (((c / L.W) | 0) + 0.5) * CELL;
        for (;;) {
            const dx = tx - body.x, dz = tz - body.z;
            const d = Math.hypot(dx, dz);
            if (d < 0.35) break;
            const sp = 7 * dt;
            const ox = body.x, oz = body.z;
            const res = world.move(body, (dx / d) * Math.min(sp, d), (dz / d) * Math.min(sp, d), STEP, false);
            if (res.bumped !== null && res.bumped >= 0 && L.door[res.bumped] >= 0) world.openDoor(res.bumped, 'player', keys);
            // open any door we're next to, like the game does
            const here = world.cellAt(body.x + (dx / d) * 0.9, body.z + (dz / d) * 0.9);
            if (here >= 0 && L.door[here] >= 0) world.openDoor(here, 'player', keys);
            world.updateDoors(dt, () => false);
            // ground follow (step up / fall)
            const g = world.groundUnder(body.x, body.z, body.r);
            if (g > body.y && g - body.y <= STEP + 0.01) body.y = g;
            else if (g < body.y) body.y = Math.max(g, body.y - 0.3);
            const moved = Math.hypot(body.x - ox, body.z - oz);
            walked += moved; walkTime += dt;
            stall = moved < 0.002 ? stall + dt : 0;
            t += dt;
            if (stall > 4) { fail(`${label}: bot stuck at cell ${world.cellAt(body.x, body.z)} heading for ${c} (${(t).toFixed(1)}s)`); return false; }
            if (t > 900) { fail(`${label}: bot timed out`); return false; }
        }
    }
    return true;
}

function botRun(L, label) {
    const world = new World(L);
    const body = { x: L.start.x * CELL, z: L.start.z * CELL, y: L.floor[L.start.cell], r: PLAYER.radius, h: PLAYER.height };
    const keys = new Set();
    let at = L.start.cell;
    const keyThings = KEY_ORDER.map((k) => L.things.find((t) => t.type === 'pickup' && t.id === 'key_' + k)).filter(Boolean);
    for (const kt of keyThings) {
        const p = bfsPath(L, at, kt.cell, keys);
        if (!p) { fail(`${label}: no path to ${kt.id}`); return false; }
        if (!walk(L, world, body, p, keys, label)) return false;
        keys.add(kt.id.slice(4));
        at = kt.cell;
    }
    const p = bfsPath(L, at, L.exit.cell, keys);
    if (!p) { fail(`${label}: no path to the exit`); return false; }
    return walk(L, world, body, p, keys, label);
}

function check(spec, seed, opts, label) {
    let L;
    try { L = generateLevel(spec, seed, opts); } catch (e) { fail(`${label}: ${e.message}`); return null; }
    const v = validate(L);
    if (!v.ok) fail(`${label}: ${v.reason}`);
    // things on sensible cells
    for (const t of L.things) {
        if (!L.open[t.cell]) fail(`${label}: ${t.type} in a wall`);
    }
    if (L.stats.monsters < 4 && !spec.arena) fail(`${label}: only ${L.stats.monsters} monsters`);
    // nothing solid may stand in front of a terminal or the exit switch
    const fronts = new Set([L.exit.cell, ...L.things.filter((t) => t.type === 'terminal').map((t) => t.cell)]);
    for (const t of L.things) {
        if ((t.type === 'barrel' || (t.type === 'decor' && t.solid > 0)) && fronts.has(t.cell)) fail(`${label}: ${t.d ?? t.type} blocks a switch or terminal`);
    }
    botRun(L, label);
    return L;
}

// ------------------------------------------------------------------ 2+4. campaign
const t0 = Date.now();
const attempts = [];
for (let s = 0; s < SEEDS; s++) {
    const seed = 1000 + s * 7919;
    for (const [i, spec] of LEVELS.entries()) {
        for (const diff of [DIFFICULTIES[1], DIFFICULTIES[3]]) {
            const L = check(spec, seed, { depth: i + 1, difficulty: diff, arsenal: arsenalFor(i) }, `${spec.id} seed ${seed} ${diff.id}`);
            if (L) attempts.push(L.attempt);
        }
    }
}
console.log(`campaign: ${LEVELS.length} levels × ${SEEDS} seeds × 2 difficulties, mean attempt ${(attempts.reduce((a, b) => a + b, 0) / attempts.length).toFixed(2)}, max ${Math.max(...attempts)}`);

// ------------------------------------------------------------------ descent
for (let n = 1; n <= FLOORS; n++) {
    const seed = 424242;
    check(descentSpec(n, seed), seed, { depth: n, difficulty: DIFFICULTIES[2], arsenal: descentArsenal(n) }, `descent ${n}`);
}
console.log(`descent: floors 1..${FLOORS}`);
console.log(`bot walked ${(walked / 1000).toFixed(1)} km in ${(walkTime / 60).toFixed(0)} simulated minutes`);

// ------------------------------------------------------------------ collision regressions
{
    // a body overlapping a wall (after a teleport or a shove) must not be snapped through it
    const L = generateLevel(LEVELS[0], 858243, { depth: 1, difficulty: DIFFICULTIES[1], arsenal: arsenalFor(0) });
    const w = new World(L);
    const t = L.things.find((q) => q.type === 'terminal');
    const body = { x: t.x * CELL, z: t.z * CELL, y: t.floor, r: PLAYER.radius, h: PLAYER.height };
    const x0 = body.x, z0 = body.z;
    w.move(body, -t.nx * 1e-6 + 1e-7, -t.nz * 1e-6 + 1e-7, STEP, false);
    w.move(body, -1e-9, -1e-9, STEP, false);
    if (Math.hypot(body.x - x0, body.z - z0) > 0.01) fail(`a body overlapping a wall jumped ${Math.hypot(body.x - x0, body.z - z0).toFixed(2)} m`);
    else console.log('collision regression ok');
}

// ------------------------------------------------------------------ 3. determinism
{
    const a = generateLevel(LEVELS[4], 777, { depth: 5, difficulty: DIFFICULTIES[1], arsenal: arsenalFor(4) });
    const b = generateLevel(LEVELS[4], 777, { depth: 5, difficulty: DIFFICULTIES[1], arsenal: arsenalFor(4) });
    const sig = (L) => JSON.stringify([Array.from(L.open), Array.from(L.floor), L.things.map((t) => [t.type, t.cell, t.id ?? t.arch])]);
    if (sig(a) !== sig(b)) fail('generation is not deterministic');
    else console.log('determinism ok');
}

console.log(`${fails ? 'FAILED' : 'PASSED'} — ${fails} failure(s) in ${((Date.now() - t0) / 1000).toFixed(1)}s`);
process.exit(fails ? 1 : 0);

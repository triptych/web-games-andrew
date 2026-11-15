// Voxel physics. Everything that breaks (monsters, rock, hives) bursts into little cubes that fly,
// bounce off walls and the ground, and settle in stacks on the grid. A settled cube is a
// temporary obstacle: monsters and their shots can't pass it, the mech wades through. It fades
// after VOXEL.life seconds. The coloured ones (red, blue, green, gold) can be collected by
// walking into them or pulled in from range with the MAGNET; grey rubble can't.
// Pure: randomness from the run's rng.

import { VOXEL, COLORS, COLLECTIBLE, MAP } from '../config.js';
import { idx, inMap, cellOf } from './world.js';

export const C = Object.fromEntries(COLORS.map((c, i) => [c, i]));
const FLY = 0, SET = 1, PULL = 2;
export const VSTATE = { FLY, SET, PULL };

/** Pick a colour from weights like { red: 7, gold: 1 }. */
function pickColor(rng, mix) {
    let tot = 0;
    for (const k in mix) tot += mix[k];
    let r = rng() * tot;
    for (const k in mix) { r -= mix[k]; if (r <= 0) return C[k]; }
    return C.red;
}

/** Throw n voxels out of (x, y, z). */
export function burst(R, x, y, z, n, mix, power = 1) {
    const rng = R.rng;
    for (let k = 0; k < n; k++) {
        const a = rng() * Math.PI * 2, s = rng.range(1.5, 5.5) * power;
        R.voxels.push({
            x, y, z: z + rng.range(0, 0.4),
            vx: Math.cos(a) * s, vy: Math.sin(a) * s, vz: rng.range(4, 9) * Math.sqrt(power),
            c: typeof mix === 'number' ? mix : pickColor(rng, mix), s: FLY, life: VOXEL.life, i: -1,
        });
    }
    // too many: drop the oldest settled ones first, then the oldest of any
    if (R.voxels.length > VOXEL.cap) {
        let extra = R.voxels.length - VOXEL.cap;
        for (let k = 0; k < R.voxels.length && extra > 0; k++) {
            const v = R.voxels[k];
            if (v.s === SET) { unsettle(R, v); v.dead = true; extra--; }
        }
        for (let k = 0; k < R.voxels.length && extra > 0; k++) if (!R.voxels[k].dead) { R.voxels[k].dead = true; extra--; }
        R.voxels = R.voxels.filter((v) => !v.dead);
    }
}

/** Take a settled voxel off its stack; the ones above it drop a layer. */
function unsettle(R, v) {
    if (v.s !== SET || v.i < 0) return;
    const W = R.W;
    W.debris[v.i] = Math.max(0, W.debris[v.i] - 1);
    for (const o of R.voxels) if (o !== v && o.s === SET && o.i === v.i && o.z > v.z) o.z -= 1;
    W.ffDirty = true;
    v.i = -1;
}

/** Eat the top voxel of a stack (a monster chewing through a pile). Returns true if one went. */
export function chew(R, cell) {
    let top = null;
    for (const v of R.voxels) if (v.s === SET && v.i === cell && (!top || v.z > top.z)) top = v;
    if (!top) return false;
    unsettle(R, top);
    top.dead = true;
    R.events.push({ type: 'chew', x: (cell % MAP.w) + 0.5, y: ((cell / MAP.w) | 0) + 0.5, c: top.c });
    return true;
}

/** An explosion throws settled voxels near it back into the air. */
export function scatter(R, x, y, radius, power = 1) {
    const r2 = radius * radius;
    for (const v of R.voxels) {
        if (v.s === PULL) continue;
        const dx = v.x - x, dy = v.y - y, d2 = dx * dx + dy * dy;
        if (d2 > r2) continue;
        if (v.s === SET) unsettle(R, v);
        const d = Math.sqrt(d2) || 0.1, k = (1 - d / radius) * 7 * power + 1.5;
        v.vx += (dx / d) * k; v.vy += (dy / d) * k; v.vz = Math.max(v.vz, 3 + k);
        v.s = FLY;
        v.life = Math.max(v.life, VOXEL.life * 0.5);
    }
}

/**
 * Advance every voxel. M is the mech; magnet = the MAGNET button is held.
 * collect(colourIndex) is called for each voxel the mech picks up.
 */
export function stepVoxels(R, dt, M, magnet, collect) {
    const W = R.W;
    const reach = magnet ? M.magnet : M.pickup;
    const reach2 = reach * reach;
    let removed = false;
    for (const v of R.voxels) {
        if (v.dead) { removed = true; continue; }
        const collectible = COLLECTIBLE[COLORS[v.c]];
        if (collectible && v.s !== PULL && M.hp > 0) {
            const dx = v.x - M.x, dy = v.y - M.y;
            if (dx * dx + dy * dy < reach2 && (v.s === SET || v.vz <= 0)) {
                if (v.s === SET) unsettle(R, v);
                v.s = PULL;
            }
        }
        if (v.s === PULL) {
            const dx = M.x - v.x, dy = M.y - v.y, d = Math.hypot(dx, dy);
            const sp = 16 * dt + d * 4 * dt;
            if (d <= 0.55 || d <= sp) { v.dead = true; removed = true; collect(v.c); continue; }
            v.x += (dx / d) * sp; v.y += (dy / d) * sp;
            v.z += (1.2 - v.z) * Math.min(1, 6 * dt);
            continue;
        }
        if (v.s === SET) {
            v.life -= dt;
            if (v.life <= 0) { unsettle(R, v); v.dead = true; removed = true; }
            continue;
        }
        // flying
        v.life -= dt * 0.25;
        v.vz -= VOXEL.gravity * dt;
        const ox = v.x, oy = v.y;
        v.x += v.vx * dt; v.y += v.vy * dt; v.z += v.vz * dt;
        let cx = cellOf(v.x), cy = cellOf(v.y);
        if (!inMap(cx, cy)) { v.x = ox; v.y = oy; v.vx = -v.vx * VOXEL.bounce; v.vy = -v.vy * VOXEL.bounce; cx = cellOf(v.x); cy = cellOf(v.y); }
        let i = idx(cx, cy);
        // a wall taller than the voxel: bounce off it sideways
        if (W.h[i] > v.z) {
            const ocx = cellOf(ox), ocy = cellOf(oy);
            if (ocx !== cx) v.vx = -v.vx * VOXEL.bounce;
            if (ocy !== cy) v.vy = -v.vy * VOXEL.bounce;
            if (ocx === cx && ocy === cy) { v.vx = -v.vx; v.vy = -v.vy; }
            v.x = ox; v.y = oy;
            cx = cellOf(v.x); cy = cellOf(v.y); i = idx(cx, cy);
        }
        const floor = W.h[i] + W.debris[i];
        if (v.z <= floor) {
            v.z = floor;
            if (v.vz < 0) v.vz = -v.vz * VOXEL.bounce;
            v.vx *= VOXEL.friction; v.vy *= VOXEL.friction;
            const sp = Math.hypot(v.vx, v.vy);
            if (v.vz < VOXEL.settleSpeed * 2 && sp < VOXEL.settleSpeed) {
                if (W.h[i] === 0 && W.debris[i] < VOXEL.maxStack) {
                    v.s = SET; v.i = i; v.z = W.debris[i]; W.debris[i]++;
                    v.x = cx + 0.5; v.y = cy + 0.5; v.vx = v.vy = v.vz = 0;
                    v.life = Math.min(v.life, VOXEL.life);
                    W.ffDirty = true;
                } else {
                    // the stack is full or it landed on rock: roll off towards open ground
                    const a = R.rng() * Math.PI * 2;
                    v.vx = Math.cos(a) * 2.5; v.vy = Math.sin(a) * 2.5; v.vz = 2;
                }
            }
        }
        if (v.life <= 0) { v.dead = true; removed = true; }
    }
    if (removed) R.voxels = R.voxels.filter((v) => !v.dead);
}

/** Recount debris from the settled voxels (used by tests to check the bookkeeping). */
export function countDebris(R) {
    const n = new Array(MAP.w * MAP.h).fill(0);
    for (const v of R.voxels) if (v.s === SET) n[v.i]++;
    return n;
}
export { idx };

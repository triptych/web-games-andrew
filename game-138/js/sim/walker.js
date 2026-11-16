// The first-person walker. Pure: step(G, inp, dt) moves the explorer through G.d (the generated dungeon).
//
// World units are metres: micro cell (mx, my) spans x ∈ [mx·MICRO, (mx+1)·MICRO), z likewise. yaw 0 looks along −z
// (north); forward = (sin yaw, −cos yaw). The explorer is a circle of WALK.radius that slides along walls (each axis
// is tried on its own), wades slower through water, and can't pass rock, wells or anything that blocks.
//
// inp = { fx, sx, yaw, pitch, run }: forward and strafe in [-1, 1], yaw and pitch as deltas in radians.

import { MICRO, WALK } from '../config.js';
import { ELEMENTS } from './data/elements.js';

const SOLID = new Set(['#', 'o']);

/** Blocking feature circles of a level, cached on the level (they never move). */
function blockers(L) {
    if (!L._blk) {
        L._blk = L.features.filter((f) => f.block).map((f) => ({
            f, x: (f.mx + 0.5) * MICRO, z: (f.my + 0.5) * MICRO, r: Math.min(0.85, (ELEMENTS[f.kind]?.size ?? 1) * 0.42 + 0.1),
        }));
    }
    return L._blk;
}

export function blockedAt(L, x, z, r = WALK.radius) {
    const x0 = Math.floor((x - r) / MICRO), x1 = Math.floor((x + r) / MICRO);
    const z0 = Math.floor((z - r) / MICRO), z1 = Math.floor((z + r) / MICRO);
    for (let my = z0; my <= z1; my++) {
        for (let mx = x0; mx <= x1; mx++) {
            const ch = my < 0 || mx < 0 || my >= L.mh || mx >= L.mw ? '#' : L.grid[my][mx];
            if (!SOLID.has(ch)) continue;
            // circle against the cell's square
            const cx = Math.max(mx * MICRO, Math.min(x, (mx + 1) * MICRO));
            const cz = Math.max(my * MICRO, Math.min(z, (my + 1) * MICRO));
            if ((cx - x) ** 2 + (cz - z) ** 2 < r * r) return true;
        }
    }
    for (const b of blockers(L)) if ((b.x - x) ** 2 + (b.z - z) ** 2 < (b.r + r) ** 2) return true;
    return false;
}

export const microOf = (v) => Math.floor(v / MICRO);
export const centre = (m) => (m + 0.5) * MICRO;

/** Put the explorer on level `lv`, on a free cell beside its stairs (up when arriving from above). */
export function placeAt(G, lv, from = 'up') {
    const L = G.d.levels[lv];
    const s = from === 'down' && L.down ? L.down : L.up;
    G.lv = lv;
    // the free neighbour with the most open floor in front of it, facing away from the stairs
    let best = null, bs = -1;
    for (let d = 0; d < 4; d++) {
        const dx = [0, 1, 0, -1][d], dy = [-1, 0, 1, 0][d];
        let open = 0;
        for (let k = 1; k <= 4; k++) {
            const ch = L.grid[s.my + dy * k]?.[s.mx + dx * k];
            if (!ch || SOLID.has(ch) || ch === 'v' || ch === '^') break;
            if (blockedAt(L, centre(s.mx + dx * k), centre(s.my + dy * k), 0.2)) break;
            open++;
        }
        if (open > bs) { bs = open; best = { dx, dy }; }
    }
    G.x = centre(s.mx + best.dx);
    G.z = centre(s.my + best.dy);
    G.yaw = Math.atan2(best.dx, -best.dy);
    G.pitch = 0;
    if (!G.visited.includes(lv)) G.visited.push(lv);
    G.stairCool = 0.6;
}

export function stepWalker(G, inp, dt) {
    const L = G.d.levels[G.lv];
    G.yaw = (G.yaw + (inp.yaw || 0)) % (Math.PI * 2);
    G.pitch = Math.max(-WALK.pitchMax, Math.min(WALK.pitchMax, G.pitch + (inp.pitch || 0)));
    const fx = Math.max(-1, Math.min(1, inp.fx || 0)), sx = Math.max(-1, Math.min(1, inp.sx || 0));
    const len = Math.hypot(fx, sx), k = len > 1 ? 1 / len : 1;
    const inWater = L.grid[microOf(G.z)]?.[microOf(G.x)] === '~';
    const speed = (inp.run ? WALK.run : WALK.speed) * (inWater ? WALK.waterMul : 1);
    const s = Math.sin(G.yaw), c = Math.cos(G.yaw);
    const vx = (s * fx + c * sx) * k * speed, vz = (-c * fx + s * sx) * k * speed;
    const ox = G.x, oz = G.z;
    if (vx && !blockedAt(L, G.x + vx * dt, G.z)) G.x += vx * dt;
    if (vz && !blockedAt(L, G.x, G.z + vz * dt)) G.z += vz * dt;
    const moved = Math.hypot(G.x - ox, G.z - oz);
    G.dist += moved;
    G.stepAcc += moved;
    if (G.stepAcc > 1.7) {
        G.stepAcc = 0;
        G.events.push({ type: 'step', water: inWater });
    }
    const nowWater = L.grid[microOf(G.z)]?.[microOf(G.x)] === '~';
    if (nowWater && !G.wet) G.events.push({ type: 'splash', x: G.x, z: G.z });
    G.wet = nowWater;

    // friends and treasure within reach
    for (const f of L.features) {
        if (G.found[f.id] || !f.block) continue;
        const e = ELEMENTS[f.kind];
        if (!e || (e.cat !== 'monsters' && e.cat !== 'hoards')) continue;
        if (Math.hypot(centre(f.mx) - G.x, centre(f.my) - G.z) > WALK.reach + (e.size > 1.5 ? 0.5 : 0)) continue;
        G.found[f.id] = 1;
        if (e.cat === 'monsters') {
            G.friends++;
            G.events.push({ type: 'befriend', id: f.id, kind: f.kind, x: centre(f.mx), z: centre(f.my) });
        } else {
            G.gold += e.value;
            G.events.push({ type: 'loot', id: f.id, kind: f.kind, value: e.value, x: centre(f.mx), z: centre(f.my) });
        }
    }

    // stairs: step into the stairwell's cell
    G.stairCool = Math.max(0, G.stairCool - dt);
    const ch = L.grid[microOf(G.z)]?.[microOf(G.x)];
    if (G.stairCool <= 0 && (ch === 'v' || ch === '^')) {
        const from = G.lv;
        if (ch === 'v' && G.lv < G.d.levels.length - 1) {
            placeAt(G, G.lv + 1, 'up');
            G.events.push({ type: 'stairs', from, to: G.lv, name: G.d.levels[G.lv].name });
        } else if (ch === '^' && G.lv > 0) {
            placeAt(G, G.lv - 1, 'down');
            G.events.push({ type: 'stairs', from, to: G.lv, name: G.d.levels[G.lv].name });
        } else if (ch === '^') {
            // the way out, at the top: turn the explorer round instead of leaving
            G.events.push({ type: 'exit' });
            placeAt(G, 0, 'up');
        }
    }
}

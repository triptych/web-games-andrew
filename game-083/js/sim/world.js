// The plain the dragon walks across: endless, with at most one obstacle per grid cell placed by
// hashing the cell with the seed. Nothing here is stored: the same seed rebuilds the same plain,
// so the sim, the view and a loaded save all agree.

import { GROUND } from '../config.js';
import { hash3 } from '../rng.js';

export const OB_KINDS = ['menhir', 'cairn', 'ruin', 'pine', 'barrow'];
const OB_R = { menhir: 1.3, cairn: 2.8, ruin: 3.0, pine: 1.5, barrow: 2.6 };
const DENSITY = 0.4;

/** The obstacle in cell (cx, cz), or null. */
export function cellObstacle(seed, cx, cz) {
    if (cx === 0 && cz === 0) return null;            // the dragon starts here
    const s = seed | 0;
    if (hash3(cx, cz, s) > DENSITY) return null;
    const u = hash3(cx, cz, s + 101), v = hash3(cx, cz, s + 202);
    const k = hash3(cx, cz, s + 303), w = hash3(cx, cz, s + 404);
    const kind = OB_KINDS[Math.floor(k * OB_KINDS.length)];
    const C = GROUND.cell;
    return {
        kind,
        x: (cx + (u - 0.5) * 0.6) * C,
        z: (cz + (v - 0.5) * 0.6) * C,
        r: OB_R[kind] * (0.8 + w * 0.5),
        rot: w * Math.PI * 2,
        cx, cz,
    };
}

/** Every obstacle whose cell is within `range` of (x, z). */
export function obstaclesNear(seed, x, z, range, out = []) {
    out.length = 0;
    const C = GROUND.cell;
    const n = Math.ceil(range / C) + 1;
    const cx0 = Math.round(x / C), cz0 = Math.round(z / C);
    for (let i = -n; i <= n; i++) {
        for (let j = -n; j <= n; j++) {
            const o = cellObstacle(seed, cx0 + i, cz0 + j);
            if (o && Math.abs(o.x - x) < range + o.r && Math.abs(o.z - z) < range + o.r) out.push(o);
        }
    }
    return out;
}

/** The obstacle a point is inside (distance < its radius + pad), or null. Checks the 3×3 cells around it. */
export function obstacleAt(seed, x, z, pad = 0) {
    const C = GROUND.cell;
    const cx0 = Math.round(x / C), cz0 = Math.round(z / C);
    for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
            const o = cellObstacle(seed, cx0 + i, cz0 + j);
            if (o && Math.hypot(o.x - x, o.z - z) < o.r + pad) return o;
        }
    }
    return null;
}

/** Push a circle (body with x, z) out of every obstacle it overlaps. Returns true if it touched one. */
export function pushOut(seed, body, radius) {
    const C = GROUND.cell;
    const cx0 = Math.round(body.x / C), cz0 = Math.round(body.z / C);
    let hit = false;
    for (let i = -1; i <= 1; i++) {
        for (let j = -1; j <= 1; j++) {
            const o = cellObstacle(seed, cx0 + i, cz0 + j);
            if (!o) continue;
            const dx = body.x - o.x, dz = body.z - o.z;
            const d = Math.hypot(dx, dz), min = o.r + radius;
            if (d < min) {
                const k = d > 1e-6 ? (min - d) / d : 0;
                body.x += d > 1e-6 ? dx * k : min;
                body.z += dz * k;
                hit = true;
            }
        }
    }
    return hit;
}

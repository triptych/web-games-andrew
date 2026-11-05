// The battlefield: a seeded heightfield, rubble and wreckage that blocks (or does not, depending on
// your legs), hazard pools, enemy camps, colonist pods and the boss arena. Pure.
//
// Conventions: the walker starts at z = 0 and the Hive is at z = -length. x is screen-right.
// Reachability is proved for the weakest walker (tier-0 legs, starting size) at generation time.

import { makeRng, hash3 } from '../rng.js';
import { GRID, MECH } from '../config.js';
import { LEVELS, ENEMIES, LEGS } from './data.js';

const smooth = (a, b, x) => { const t = Math.min(1, Math.max(0, (x - a) / (b - a))); return t * t * (3 - 2 * t); };
const lerp = (a, b, t) => a + (b - a) * t;

function vnoise(x, y, s) {
    const x0 = Math.floor(x), y0 = Math.floor(y), tx = x - x0, ty = y - y0;
    const sx = tx * tx * (3 - 2 * tx), sy = ty * ty * (3 - 2 * ty);
    const a = hash3(x0, y0, s), b = hash3(x0 + 1, y0, s), c = hash3(x0, y0 + 1, s), d = hash3(x0 + 1, y0 + 1, s);
    const top = a + (b - a) * sx, bot = c + (d - c) * sx;
    return top + (bot - top) * sy;
}
function fbm(x, y, s, oct = 5) {
    let a = 1, f = 1, sum = 0, n = 0;
    for (let i = 0; i < oct; i++) { sum += vnoise(x * f, y * f, s + i * 17) * a; n += a; a *= 0.5; f *= 2.03; }
    return sum / n;
}

export function makeWorld(li, seed) {
    let w = null;
    for (let attempt = 0; attempt < 8; attempt++) {
        w = buildWorld(li, seed, attempt);
        if (w.ok) break;
    }
    return w;
}

export function buildWorld(li, seed, attempt = 0) {
    const lv = LEVELS[li];
    const rng = makeRng((seed * 977 + li * 131 + attempt * 7919 + 11) >>> 0);
    const L = lv.length;
    const gw = GRID.w, gh = L + 91, x0 = GRID.x0, zTop = GRID.zTop;
    const s1 = (seed * 31 + li * 7 + attempt) | 0;
    const p1 = rng() * 6.28, p2 = rng() * 6.28, p3 = rng() * 6.28;

    const cx = (z) => {
        const t = -z;
        const a = 17 * Math.sin(t / 61 + p1) + 9 * Math.sin(t / 27 + p2);
        return Math.max(-30, Math.min(30, a)) * smooth(0, 45, t);
    };
    const hwAt = (z) => lv.hw + 5 * Math.sin(-z / 41 + p3);

    // ---- layout first (flat zones need to be known before heights)
    const flats = [{ x: 0, z: -4, r: 16, kind: 'start' }];
    const camps = [];
    const n = lv.camps;
    for (let i = 0; i < n; i++) {
        const f = 0.1 + 0.58 * (n === 1 ? 0 : i / (n - 1)) + rng.range(-0.015, 0.015);
        const t = f * L, z = -t;
        const x = cx(z) + rng.range(-0.3, 0.3) * lv.hw;
        const budget = lerp(lv.budget[0], lv.budget[1], n === 1 ? 0 : i / (n - 1));
        camps.push({ i, x, z, t, r: 15, budget });
        flats.push({ x, z, r: 15, kind: 'camp' });
    }
    const arena = lv.boss ? { x: cx(-(L - 48)), z: -(L - 48), r: 32 } : null;
    if (arena) flats.push({ x: arena.x, z: arena.z, r: arena.r, kind: 'arena' });

    const craters = [];
    for (let i = 0; i < lv.craters; i++) {
        const z = -rng.range(20, L - 20), x = cx(z) + rng.range(-0.9, 0.9) * lv.hw, r = rng.range(3.5, 11), d = rng.range(0.8, 3.2);
        if (flats.some((f) => Math.hypot(f.x - x, f.z - z) < f.r + r)) continue;
        craters.push({ x, z, r, d });
    }

    // ---- heights
    const grid = new Float32Array(gw * gh);
    const terr = lv.terrace || 0;
    for (let j = 0; j < gh; j++) {
        const z = zTop - j, t = -z;
        const c = cx(z), hw = hwAt(z);
        for (let i = 0; i < gw; i++) {
            const x = x0 + i;
            let b = (fbm(x * 0.04, z * 0.04, s1) - 0.5) * 2 * lv.amp;
            if (terr) { const q = b / terr, f = Math.floor(q); b = (f + smooth(0.3, 0.7, q - f)) * terr; }
            b += (fbm(x * 0.21, z * 0.21, s1 + 99, 3) - 0.5) * 0.7;
            const d = Math.abs(x - c);
            const wall = smooth(hw * 0.85, hw * 1.35, d) * (16 + 26 * fbm(x * 0.03, z * 0.03, s1 + 55, 3));
            let h = b + wall;
            h += smooth(8, 26, z) * 30;                    // back wall behind the start
            h += smooth(L + 6, L + 28, t) * 30;            // far wall past the gate
            grid[j * gw + i] = h;
        }
    }
    const at = (x, z) => {
        const fi = Math.min(gw - 1.001, Math.max(0, x - x0)), fj = Math.min(gh - 1.001, Math.max(0, zTop - z));
        const i = fi | 0, j = fj | 0, tx = fi - i, ty = fj - j;
        const a = grid[j * gw + i], b = grid[j * gw + i + 1], c = grid[(j + 1) * gw + i], d = grid[(j + 1) * gw + i + 1];
        const top = a + (b - a) * tx, bot = c + (d - c) * tx;
        return top + (bot - top) * ty;
    };
    const forCells = (cxp, czp, rad, fn) => {
        const i0 = Math.max(0, Math.floor(cxp - rad - x0)), i1 = Math.min(gw - 1, Math.ceil(cxp + rad - x0));
        const j0 = Math.max(0, Math.floor(zTop - czp - rad)), j1 = Math.min(gh - 1, Math.ceil(zTop - czp + rad));
        for (let j = j0; j <= j1; j++) for (let i = i0; i <= i1; i++) fn(i, j, x0 + i, zTop - j);
    };
    for (const c of craters) {
        forCells(c.x, c.z, c.r * 1.35, (i, j, x, z) => {
            const d = Math.hypot(x - c.x, z - c.z) / c.r;
            if (d < 1) grid[j * gw + i] -= c.d * (1 - d * d);
            else if (d < 1.3) grid[j * gw + i] += c.d * 0.28 * Math.sin((1.3 - d) / 0.3 * Math.PI);
        });
    }
    for (const f of flats) {
        const target = at(f.x, f.z);
        forCells(f.x, f.z, f.r * 1.4, (i, j, x, z) => {
            const d = Math.hypot(x - f.x, z - f.z);
            const k = 1 - smooth(f.r * 0.7, f.r * 1.3, d);
            if (k > 0) grid[j * gw + i] = lerp(grid[j * gw + i], target, k);
        });
    }
    if (attempt >= 4) {      // last resorts: carve a gentle lane down the middle
        forCells(0, -L / 2, L, (i, j, x, z) => {
            const d = Math.abs(x - cx(z));
            if (d < 5) grid[j * gw + i] = lerp(grid[j * gw + i], lv.amp * 0.15 * Math.sin(-z / 30), 0.9 * (1 - smooth(2.5, 5, d)));
        });
    }

    const slopeGrid = new Float32Array(gw * gh);
    for (let j = 1; j < gh - 1; j++) for (let i = 1; i < gw - 1; i++) {
        const gx = (grid[j * gw + i + 1] - grid[j * gw + i - 1]) / 2, gz = (grid[(j + 1) * gw + i] - grid[(j - 1) * gw + i]) / 2;
        slopeGrid[j * gw + i] = Math.hypot(gx, gz);
    }
    const slope = (x, z) => {
        const i = Math.min(gw - 1, Math.max(0, Math.round(x - x0))), j = Math.min(gh - 1, Math.max(0, Math.round(zTop - z)));
        return slopeGrid[j * gw + i];
    };

    // ---- blockers
    const blockers = [];
    const slopeOk = (x, z) => slope(x, z) < 0.85;
    const place = (kind, count, mk) => {
        let tries = 0;
        while (count > 0 && tries++ < count * 40 + 200) {
            const t = rng.range(22, L - 4), z = -t;
            const x = cx(z) + rng.range(-1, 1) * hwAt(z) * 0.95;
            const o = mk(x, z);
            if (flats.some((f) => f.kind === 'camp' && Math.hypot(f.x - x, f.z - z) < 5 + o.r)) continue;
            if (arena && Math.hypot(arena.x - x, arena.z - z) < arena.r - 4 && !(kind === 'wreck' && Math.hypot(arena.x - x, arena.z - z) > arena.r * 0.6)) continue;
            if (!slopeOk(x, z)) continue;
            if (blockers.some((b) => Math.hypot(b.x - x, b.z - z) < b.r + o.r + 0.8)) continue;
            blockers.push({ kind, x, z, y: at(x, z), rot: rng() * 6.28, seed: (rng() * 1e6) | 0, ...o });
            count--;
        }
    };
    place('rock', lv.rocks, () => { const big = rng() < 0.12; const r = big ? rng.range(3, 4.5) : rng.range(0.7, 2.6); return { r, h: big ? rng.range(3.5, 6) : r * rng.range(0.5, 1.5) }; });
    place('wreck', lv.wrecks, () => { const r = rng.range(1.8, 4); return { r, h: rng.range(1.8, 4) }; });
    place('spire', lv.spires, () => ({ r: rng.range(0.45, 1.1), h: rng.range(4, 11) }));
    const BK = 16;
    const buckets = new Map();
    const key = (bx, bz) => bx * 4096 + bz;
    for (const b of blockers) {
        for (let bx = Math.floor((b.x - b.r) / BK); bx <= Math.floor((b.x + b.r) / BK); bx++)
            for (let bz = Math.floor((b.z - b.r) / BK); bz <= Math.floor((b.z + b.r) / BK); bz++) {
                const k = key(bx, bz);
                if (!buckets.has(k)) buckets.set(k, []);
                buckets.get(k).push(b);
            }
    }
    const NONE = [];
    const near = (x, z) => buckets.get(key(Math.floor(x / BK), Math.floor(z / BK))) || NONE;

    // ---- hazards (never inside camps, never in the start pad)
    const hazards = [];
    for (let i = 0, tries = 0; i < lv.hazN && tries < 200; tries++) {
        const t = rng.range(30, L - 60), z = -t, r = lv.hazard === 'fire' ? rng.range(2, 4.5) : rng.range(3, 8);
        const x = cx(z) + rng.range(-0.8, 0.8) * hwAt(z);
        if (flats.some((f) => f.kind !== 'start' && Math.hypot(f.x - x, f.z - z) < f.r * 0.6 + r)) continue;
        if (blockers.some((b) => Math.hypot(b.x - x, b.z - z) < b.r + r * 0.7)) continue;
        hazards.push({ x, z, r, type: lv.hazard, y: at(x, z) });
        i++;
    }

    // ---- units, pods, ambushes
    const mixKeys = Object.keys(lv.mix);
    const pickType = (allow) => {
        const keys = (allow || mixKeys).filter((k) => lv.mix[k]);
        let tot = 0; for (const k of keys) tot += lv.mix[k];
        let r = rng() * tot;
        for (const k of keys) { r -= lv.mix[k]; if (r <= 0) return k; }
        return keys[0];
    };
    const spawns = [];
    for (const c of camps) {
        let b = c.budget, guard = 0, heavy = 0;
        const heavyCap = 1 + (li >= 2 ? 1 : 0) + (li >= 4 ? 1 : 0);
        while (b >= 3 && guard++ < 60) {
            const type = pickType();
            const cost = ENEMIES[type].cost;
            if (cost > b) continue;
            if (cost >= 12) { if (heavy >= heavyCap) continue; heavy++; }
            const ang = rng() * 6.28, rr = type === 'turret' ? rng.range(8, 12) : rng.range(2, 11);
            spawns.push({ type, x: c.x + Math.cos(ang) * rr, z: c.z + Math.sin(ang) * rr, camp: c.i });
            b -= cost;
        }
    }
    const pods = [];
    for (let k = 0; k < lv.pods; k++) {
        const c = camps[Math.min(n - 1, Math.floor((k + 0.5) * n / lv.pods))];
        pods.push({ x: c.x + rng.range(-5, 5), z: c.z + rng.range(-5, 5), n: rng.int(3, 6), camp: c.i });
    }
    const ambushes = [];
    for (let k = 0; k < lv.ambush; k++) {
        const t = (0.2 + 0.5 * (k + rng.range(0.2, 0.8)) / lv.ambush) * L;
        const units = []; const cnt = 3 + k + (li > 2 ? 1 : 0);
        for (let q = 0; q < cnt; q++) units.push(pickType(mixKeys.filter((m) => m !== 'turret' && m !== 'bulwark')));
        ambushes.push({ t, units });
    }

    const world = {
        li, seed, attempt, L, hw: hwAt, cx, grid, gw, gh, x0, zTop, h: at, slope, near, blockers, hazards, craters, flats, camps, spawns, pods, ambushes,
        arena, gate: { x: cx(-(L - 2)), z: -(L - 2) }, start: { x: 0, z: 0 }, ok: false,
        hazardAt(x, z) { for (const h of hazards) { const d = (x - h.x) ** 2 + (z - h.z) ** 2; if (d < h.r * h.r) return h; } return null; },
    };
    world.ok = reachable(world, lv);
    return world;
}

/** Flood fill over the field at 2 m for the weakest walker. Returns true when the gate end and every pod can be reached. */
export function reachable(w, lv = LEVELS[w.li]) {
    const S = 2, L = w.L;
    const nx = 101, nz = Math.ceil((L + 20) / S) + 1;     // x in [-100, 100]
    const seen = new Uint8Array(nx * nz);
    // the worst case over a campaign: the smallest legs, the biggest hull (scale 2.3, feet at 0.55 of the radius)
    const clearance = LEGS[0].clear * MECH.baseScale, rad = MECH.radius * 2.3 * 0.55;
    const lim = LEGS[0].climb * 0.92;
    const free = (x, z) => {
        if (Math.abs(x - w.cx(z)) > w.hw(z) * 0.98) return false;
        if (w.slope(x, z) > lim) return false;
        for (const b of w.near(x, z)) if (b.h > clearance && Math.hypot(b.x - x, b.z - z) < b.r + rad) return false;
        const hz = w.hazardAt(x, z);
        if (hz && hz.type === 'lava') return false;
        return true;
    };
    const idx = (ix, iz) => iz * nx + ix;
    const px = (ix) => -100 + ix * S, pz = (iz) => 6 - iz * S;
    const q = [idx(50, 3)];
    seen[q[0]] = 1;
    let best = 0;
    const podHit = w.pods.map(() => false);
    while (q.length) {
        const cur = q.pop();
        const ix = cur % nx, iz = (cur / nx) | 0;
        const x = px(ix), z = pz(iz);
        best = Math.max(best, -z);
        for (let k = 0; k < w.pods.length; k++) if (Math.hypot(w.pods[k].x - x, w.pods[k].z - z) < 4) podHit[k] = true;
        for (let dz = -1; dz <= 1; dz++) for (let dx = -1; dx <= 1; dx++) {
            if (!dx && !dz) continue;
            const jx = ix + dx, jz = iz + dz;
            if (jx < 0 || jx >= nx || jz < 0 || jz >= nz) continue;
            const id = idx(jx, jz);
            if (seen[id]) continue;
            const X = px(jx), Z = pz(jz);
            if (!free(X, Z)) continue;
            if (Math.abs(w.h(X, Z) - w.h(x, z)) / (S * Math.hypot(dx, dz)) > lim) continue;
            seen[id] = 1;
            q.push(id);
        }
    }
    return best >= L - 14 && podHit.every(Boolean);
}

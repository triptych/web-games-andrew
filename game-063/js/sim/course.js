// A hole definition → everything the physics needs: a height grid, a surface grid, a distance-to-
// playable-ground grid, static colliders and triggers. The renderer builds its meshes from the same
// grids and the same signed-distance functions, so what you see is what the ball hits.
//
// A hole is painted as ordered layers. Each layer is a shape (ellipse, path or square) with a surface
// and optional height operations; later layers paint over earlier ones, so an island green listed after
// its lake rises out of the water, and an open-water hole listed after an ice sheet breaks through it.

import { REALMS, SURF, SURF_PHYS } from './realms.js';
import { fbm, hashStr } from '../rng.js';

export const CELL = 0.5;
export const VOID_H = -80;
export const BALL_R = 0.2;
export const CUP_R = 0.34;

// ---------------------------------------------------------------- layer helpers for holes.js
export const E = (surf, x, z, rx, rz = rx, rot = 0, o = {}) => ({ surf, shape: 'ellipse', x, z, rx, rz, rot, ...o });
export const P = (surf, pts, w = 10, o = {}) => ({ surf, shape: 'path', pts: pts.map((p) => [p[0], p[1], p[2] ?? w]), ...o });
export const Q = (surf, x, z, half, rot = 0, o = {}) => ({ surf, shape: 'square', x, z, half, rot, ...o });
// A ring path (closed) with an optional gap, e.g. quicksand round a green.
export function ring(surf, x, z, r, w, gapAt = null, gapWidth = 0, o = {}) {
    const pts = [];
    const n = 28;
    for (let i = 0; i <= n; i++) {
        const a = (i / n) * Math.PI * 2;
        if (gapAt !== null) {
            let d = Math.abs(((a - gapAt + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
            if (d < gapWidth / 2) { if (pts.length) { pts.push(null); } continue; }
        }
        pts.push([x + Math.sin(a) * r, z + Math.cos(a) * r, w]);
    }
    // split at the gap into separate paths
    const out = [];
    let cur = [];
    for (const p of pts) { if (p === null) { if (cur.length > 1) out.push(cur); cur = []; } else cur.push(p); }
    if (cur.length > 1) out.push(cur);
    return out.map((pp) => ({ surf, shape: 'path', pts: pp, ...o }));
}

const smooth = (e0, e1, x) => { const t = Math.min(1, Math.max(0, (x - e0) / (e1 - e0))); return t * t * (3 - 2 * t); };

// ---------------------------------------------------------------- signed distance
export function layerSd(L, x, z) {
    if (L.shape === 'ellipse') {
        let dx = x - L.x, dz = z - L.z;
        if (L.rot) { const c = Math.cos(L.rot), s = Math.sin(L.rot); const u = dx * c + dz * s; dz = -dx * s + dz * c; dx = u; }
        const k = Math.sqrt((dx / L.rx) ** 2 + (dz / L.rz) ** 2);
        return (k - 1) * Math.min(L.rx, L.rz);
    }
    if (L.shape === 'square') {
        let dx = x - L.x, dz = z - L.z;
        if (L.rot) { const c = Math.cos(L.rot), s = Math.sin(L.rot); const u = dx * c + dz * s; dz = -dx * s + dz * c; dx = u; }
        return Math.max(Math.abs(dx), Math.abs(dz)) - L.half;
    }
    // path: distance to the polyline minus the interpolated half-width
    let best = Infinity;
    const p = L.pts;
    for (let i = 0; i < p.length - 1; i++) {
        const ax = p[i][0], az = p[i][1], bx = p[i + 1][0], bz = p[i + 1][1];
        const vx = bx - ax, vz = bz - az;
        const l2 = vx * vx + vz * vz || 1e-9;
        let t = ((x - ax) * vx + (z - az) * vz) / l2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        const qx = ax + vx * t - x, qz = az + vz * t - z;
        const d = Math.sqrt(qx * qx + qz * qz) - (p[i][2] + (p[i + 1][2] - p[i][2]) * t) / 2;
        if (d < best) best = d;
    }
    return best;
}

function layerBounds(L) {
    if (L.shape === 'ellipse') { const r = Math.max(L.rx, L.rz); return [L.x - r, L.z - r, L.x + r, L.z + r]; }
    if (L.shape === 'square') { const r = L.half * 1.42; return [L.x - r, L.z - r, L.x + r, L.z + r]; }
    let b = [Infinity, Infinity, -Infinity, -Infinity];
    for (const p of L.pts) { const r = p[2] / 2; b = [Math.min(b[0], p[0] - r), Math.min(b[1], p[1] - r), Math.max(b[2], p[0] + r), Math.max(b[3], p[1] + r)]; }
    return b;
}

function layerCentre(L) {
    if (L.shape !== 'path') return [L.x, L.z];
    const m = L.pts[Math.floor(L.pts.length / 2)];
    return [m[0], m[1]];
}

// ---------------------------------------------------------------- build
export function buildCourse(hole) {
    const realm = REALMS[hole.realm];
    const sky = realm.hazard === 'void';
    const seed = hashStr(hole.id);
    const roughW = hole.roughW ?? (sky ? 0 : 16);
    const edge = hole.edge ?? 1.6;
    const tee = { x: hole.tee[0], z: hole.tee[1] };
    const cupXZ = { x: hole.cup[0], z: hole.cup[1] };
    const layers = hole.layers.map((L) => ({ ...L, sid: SURF[L.surf] }));
    layers.push({ surf: 'tee', sid: SURF.tee, shape: 'ellipse', x: tee.x, z: tee.z, rx: 2.4, rz: 2.4, rot: 0, teePad: true });
    for (const L of layers) if (L.sid === undefined) throw new Error(`hole ${hole.id}: unknown surface ${L.surf}`);

    // --- base terrain (everywhere, before layers)
    const noiseAmp = hole.noise ?? 1.6;
    const slope = hole.slope ?? [0, 0];
    const hills = hole.hills ?? [];
    const baseH = hole.baseH ?? 0;
    const base = (x, z) => {
        let h = baseH + slope[0] * x + slope[1] * z + fbm(x * 0.028, z * 0.028, seed, 3) * noiseAmp * 2;
        for (const [hx, hz, r, hh] of hills) { const d2 = (x - hx) ** 2 + (z - hz) ** 2; if (d2 < r * r * 9) h += hh * Math.exp(-d2 / (r * r)); }
        return h;
    };

    // --- per-layer constants: water levels, green planes
    let lastWater = null;
    for (const L of layers) {
        const [cx, cz] = layerCentre(L);
        if (L.sid === SURF.water || L.sid === SURF.lava) {
            if (L.inherit && lastWater) L.level = lastWater.level;
            if (L.level === undefined) {
                // the lowest base height round the rim, a little below it
                let lo = Infinity;
                for (let i = 0; i < 32; i++) {
                    const a = (i / 32) * Math.PI * 2;
                    let px, pz;
                    if (L.shape === 'path') { const p = L.pts[Math.floor((i / 32) * L.pts.length)]; px = p[0] + Math.sin(a) * p[2] * 0.5; pz = p[1] + Math.cos(a) * p[2] * 0.5; }
                    else { const r = L.shape === 'square' ? L.half : 1; px = cx + Math.sin(a) * (L.rx ?? r) ; pz = cz + Math.cos(a) * (L.rz ?? r); }
                    lo = Math.min(lo, base(px, pz));
                }
                L.level = lo - 0.55;
            }
            lastWater = L;
        }
        if (L.flat && lastWater) L.flatLevel = lastWater.level + 0.02;
        if (L.sid === SURF.green || L.teePad) {
            L.planeH = (L.h !== undefined ? L.h : base(cx, cz)) + (L.raise ?? 0.35);
            L.tilt = L.tilt ?? [0, 0];
            L.cx = cx; L.cz = cz;
        }
    }

    // --- bounds and grids
    let bx0 = Infinity, bz0 = Infinity, bx1 = -Infinity, bz1 = -Infinity;
    for (const L of layers) { const b = layerBounds(L); bx0 = Math.min(bx0, b[0]); bz0 = Math.min(bz0, b[1]); bx1 = Math.max(bx1, b[2]); bz1 = Math.max(bz1, b[3]); }
    const margin = sky ? 16 : roughW + 22;
    bx0 = Math.floor(bx0 - margin); bz0 = Math.floor(bz0 - margin); bx1 = Math.ceil(bx1 + margin); bz1 = Math.ceil(bz1 + margin);
    const nx = Math.round((bx1 - bx0) / CELL) + 1, nz = Math.round((bz1 - bz0) / CELL) + 1;
    const H = new Float32Array(nx * nz);
    const S = new Uint8Array(nx * nz);
    const D = new Float32Array(nx * nz);   // distance to playable ground (negative inside)
    const LAYER = new Int16Array(nx * nz); // which layer painted the cell (-1 = none)
    const roughSid = SURF[realm.rough];

    const sds = new Float32Array(layers.length);
    for (let j = 0; j < nz; j++) {
        const z = bz0 + j * CELL;
        for (let i = 0; i < nx; i++) {
            const x = bx0 + i * CELL;
            let dPlay = Infinity;
            for (let k = 0; k < layers.length; k++) { const d = layerSd(layers[k], x, z); sds[k] = d; if (d < dPlay) dPlay = d; }
            const b = base(x, z);
            let h = b;
            // fairways and greens are smoother than the land round them
            let calm = 0;
            for (let k = 0; k < layers.length; k++) {
                const L = layers[k];
                if (L.sid === SURF.fairway || L.sid === SURF.green || L.sid === SURF.tee) calm = Math.max(calm, smooth(5, -2, sds[k]));
            }
            if (calm > 0) h = b - (b - smoothBase(base, x, z)) * calm * 0.75;
            // land holes: a gentle bowl so balls in the rough drift back toward play
            if (!sky && hole.mound !== 0) h += (hole.mound ?? 2.2) * smooth(roughW * 0.35, roughW * 1.25, dPlay);

            let sid = -1, li = -1;
            for (let k = 0; k < layers.length; k++) {
                const L = layers[k], sd = sds[k];
                if (L.sid === SURF.water || L.sid === SURF.lava) {
                    if (sd < 0) h = Math.min(h, L.level - 0.25 - 1.6 * smooth(0, -5, sd));
                    else if (sd < 3) h = Math.min(h, L.level + 0.15 + sd * 0.7);
                } else if (L.planeH !== undefined) {
                    const w = smooth(L.teePad ? 3 : 5, L.teePad ? 0 : -1, sd);
                    if (w > 0) { const ph = L.planeH + L.tilt[0] * (x - L.cx) + L.tilt[1] * (z - L.cz); h += (ph - h) * w; }
                } else if (L.sid === SURF.sand && !L.noDip) {
                    h -= (L.depth ?? 0.9) * smooth(0.6, -2.5, sd);
                }
                if (L.raise && L.planeH === undefined) h += L.raise * smooth(3, -3, sd);
                if (L.plateau) h += L.plateau * smooth(0.8, -0.8, sd);
                if (L.flatLevel !== undefined) { const w = smooth(1.5, -0.5, sd); h += (L.flatLevel - h) * w; }
                if (L.pyramid && L.shape === 'square') { const ph = Math.max(0, -sd) * L.pyramid; if (ph > 0) h += ph; }
                if (sd < 0) { sid = L.sid; li = k; }
            }
            if (sid < 0) {
                if (sky) sid = dPlay < edge ? roughSid : SURF.void;
                else sid = dPlay < roughW ? roughSid : SURF.oob;
            }
            if (sid === SURF.void) h = VOID_H;
            const idx = j * nx + i;
            H[idx] = h; S[idx] = sid; D[idx] = dPlay; LAYER[idx] = li;
        }
    }

    const course = {
        hole, realm, sky, seed, layers, base,
        x0: bx0, z0: bz0, nx, nz, cell: CELL, H, S, D, LAYER,
        gravity: 18 * realm.gravity,
        roughSid,
    };
    course.heightAt = (x, z) => sampleH(course, x, z);
    course.surfAt = (x, z) => sampleS(course, x, z);
    course.dAt = (x, z) => sampleGrid(course, D, x, z);
    course.normalAt = (x, z, out) => normalAt(course, x, z, out);
    course.waterLevelAt = (x, z) => {
        for (let k = layers.length - 1; k >= 0; k--) { const L = layers[k]; if ((L.sid === SURF.water || L.sid === SURF.lava) && layerSd(L, x, z) < 0.5) return L.level; }
        return -Infinity;
    };
    course.tee = { x: tee.x, y: course.heightAt(tee.x, tee.z), z: tee.z };
    course.cup = { x: cupXZ.x, y: course.heightAt(cupXZ.x, cupXZ.z), z: cupXZ.z };
    course.teeYaw = Math.atan2((hole.aim ?? hole.cup)[0] - tee.x, (hole.aim ?? hole.cup)[1] - tee.z);
    buildStatics(course);
    return course;
}

// A wider-scale smoothing of the base terrain (for calm fairways): the average of four samples.
function smoothBase(base, x, z) {
    const r = 6;
    return (base(x + r, z) + base(x - r, z) + base(x, z + r) + base(x, z - r)) * 0.25;
}

// ---------------------------------------------------------------- sampling
export function sampleGrid(c, G, x, z) {
    let fx = (x - c.x0) / c.cell, fz = (z - c.z0) / c.cell;
    if (fx < 0) fx = 0; else if (fx > c.nx - 1.001) fx = c.nx - 1.001;
    if (fz < 0) fz = 0; else if (fz > c.nz - 1.001) fz = c.nz - 1.001;
    const i = fx | 0, j = fz | 0, tx = fx - i, tz = fz - j;
    const k = j * c.nx + i;
    const a = G[k], b = G[k + 1], d = G[k + c.nx], e = G[k + c.nx + 1];
    return (a + (b - a) * tx) * (1 - tz) + (d + (e - d) * tx) * tz;
}

function sampleH(c, x, z) {
    const fx = (x - c.x0) / c.cell, fz = (z - c.z0) / c.cell;
    if (fx < 0 || fz < 0 || fx > c.nx - 1 || fz > c.nz - 1) return c.sky ? VOID_H : sampleGrid(c, c.H, x, z);
    if (!c.sky) return sampleGrid(c, c.H, x, z);
    // floating islands: a sharp edge at the cell boundary. Over the void it's the void; over land,
    // void corners take the land height so the edge never interpolates into a fake cliff.
    if (c.S[Math.round(fz) * c.nx + Math.round(fx)] === 14) return VOID_H;
    const i = Math.min(c.nx - 2, fx | 0), j = Math.min(c.nz - 2, fz | 0), tx = fx - i, tz = fz - j;
    const k = j * c.nx + i, H = c.H;
    let a = H[k], b = H[k + 1], d = H[k + c.nx], e = H[k + c.nx + 1];
    if (a <= VOID_H || b <= VOID_H || d <= VOID_H || e <= VOID_H) {
        let sum = 0, n = 0;
        for (const v of [a, b, d, e]) if (v > VOID_H) { sum += v; n++; }
        const m = n ? sum / n : VOID_H;
        if (a <= VOID_H) a = m; if (b <= VOID_H) b = m; if (d <= VOID_H) d = m; if (e <= VOID_H) e = m;
    }
    return (a + (b - a) * tx) * (1 - tz) + (d + (e - d) * tx) * tz;
}

function sampleS(c, x, z) {
    const i = Math.round((x - c.x0) / c.cell), j = Math.round((z - c.z0) / c.cell);
    if (i < 0 || j < 0 || i >= c.nx || j >= c.nz) return c.sky ? SURF.void : SURF.oob;
    return c.S[j * c.nx + i];
}

function normalAt(c, x, z, out = { x: 0, y: 1, z: 0 }) {
    const e = c.cell;
    const hx = sampleH(c, x + e, z) - sampleH(c, x - e, z);
    const hz = sampleH(c, x, z + e) - sampleH(c, x, z - e);
    let nx = -hx, ny = 2 * e, nz = -hz;
    const l = Math.hypot(nx, ny, nz);
    out.x = nx / l; out.y = ny / l; out.z = nz / l;
    return out;
}

// ---------------------------------------------------------------- static colliders and triggers
// Shapes: sphere {c, r}, capsule {a, b, r}, box {c, hx, hy, hz, yaw}. Every collider carries a
// bounding sphere (bx, by, bz, br) for a cheap reject, a restitution e, and a tag.
export function sphereC(x, y, z, r, e, tag, extra = {}) { return { kind: 'sphere', x, y, z, r, e, tag, bx: x, by: y, bz: z, br: r, ...extra }; }
export function capsuleC(ax, ay, az, bx, by, bz, r, e, tag, extra = {}) {
    const mx = (ax + bx) / 2, my = (ay + by) / 2, mz = (az + bz) / 2;
    return { kind: 'capsule', ax, ay, az, bx: mx, by: my, bz: mz, cx: bx, cy: by, cz: bz, r, e, tag, br: Math.hypot(bx - ax, by - ay, bz - az) / 2 + r, ...extra };
}
export function boxC(x, y, z, hx, hy, hz, yaw, e, tag, extra = {}) {
    return { kind: 'box', x, y, z, hx, hy, hz, yaw, cs: Math.cos(yaw), sn: Math.sin(yaw), e, tag, bx: x, by: y, bz: z, br: Math.hypot(hx, hy, hz), ...extra };
}

export const TREE_SHAPES = {
    oak: (x, y, z, s) => [capsuleC(x, y - 0.5, z, x, y + 3.2 * s, z, 0.35 * s, 0.45, 'trunk'), sphereC(x, y + 4.0 * s, z, 2.3 * s, 0, 'canopy', { soft: true })],
    palm: (x, y, z, s) => [capsuleC(x, y - 0.5, z, x + 0.6 * s, y + 5.6 * s, z, 0.3 * s, 0.45, 'trunk'), sphereC(x + 0.6 * s, y + 5.8 * s, z, 2.0 * s, 0, 'canopy', { soft: true })],
    pine: (x, y, z, s) => [capsuleC(x, y - 0.5, z, x, y + 1.2 * s, z, 0.3 * s, 0.45, 'trunk'), sphereC(x, y + 2.4 * s, z, 1.7 * s, 0, 'canopy', { soft: true }), sphereC(x, y + 4.3 * s, z, 1.1 * s, 0, 'canopy', { soft: true })],
    cactus: (x, y, z, s) => [capsuleC(x, y - 0.5, z, x, y + 3.0 * s, z, 0.45 * s, 0.5, 'cactus')],
    spire: (x, y, z, s) => [capsuleC(x, y - 0.5, z, x, y + 4.6 * s, z, 0.7 * s, 0.5, 'spire')],
    column: (x, y, z, s) => [capsuleC(x, y - 0.5, z, x, y + 6 * s, z, 0.8 * s, 0.55, 'column')],
};

function buildStatics(c) {
    const h = c.hole;
    const col = [];
    const gy = (x, z) => c.heightAt(x, z);
    for (const t of h.trees ?? []) {
        const [x, z, s = 1, style] = t;
        col.push(...TREE_SHAPES[style ?? c.realm.tree](x, gy(x, z), z, s));
    }
    for (const [x, z, r] of h.rocks ?? []) col.push(sphereC(x, gy(x, z) + r * 0.35, z, r, 0.5, 'rock'));
    for (const [x1, z1, x2, z2, hh = 2, t = 0.8, tag = 'wall'] of h.walls ?? []) {
        const mx = (x1 + x2) / 2, mz = (z1 + z2) / 2;
        const len = Math.hypot(x2 - x1, z2 - z1);
        const yaw = Math.atan2(x2 - x1, z2 - z1);
        const y = Math.min(gy(x1, z1), gy(x2, z2), gy(mx, mz));
        col.push(boxC(mx, y + hh / 2 - 0.4, mz, t / 2, hh / 2 + 0.4, len / 2, yaw, 0.55, tag));
    }
    for (const [x, z, s = 1] of h.springs ?? []) {
        const y = gy(x, z);
        col.push(capsuleC(x, y - 0.3, z, x, y + 0.8 * s, z, 0.35 * s, 0.4, 'stalk'));
        col.push(sphereC(x, y + 1.0 * s, z, 1.15 * s, 1.3, 'spring', { minUp: 13 }));
    }
    for (const [x, z, y, r = 1.4] of h.bumpers ?? []) col.push(sphereC(x, gy(x, z) + y, z, r, 1.25, 'bumper', { minOut: 14 }));
    for (const w of h.windmills ?? []) {
        const y = gy(w.x, w.z);
        col.push(capsuleC(w.x, y - 0.5, w.z, w.x, y + 7.5, w.z, 2.0, 0.45, 'mill'));
    }
    c.statics = col;
    c.windmills = (h.windmills ?? []).map((w) => ({ ...w, y: gy(w.x, w.z) }));
    c.geysers = (h.geysers ?? []).map(([x, z, period = 4, phase = 0]) => ({ x, z, y: gy(x, z), period, phase }));
    c.runes = (h.runes ?? []).map(([ax, az, bx, bz]) => ({ ax, az, ay: gy(ax, az), bx, bz, by: gy(bx, bz) }));

    // pickups
    const pk = [];
    const add = (kind, x, z, y = 0.55, extra = {}) => pk.push({ kind, x, z, y: gy(x, z) + y, ...extra });
    for (const [x, z, y] of h.coins ?? []) add('coin', x, z, y);
    for (const [x1, z1, x2, z2, n, y = 0.55, arc = 0] of h.coinLines ?? []) {
        for (let i = 0; i < n; i++) { const t = n === 1 ? 0.5 : i / (n - 1); add('coin', x1 + (x2 - x1) * t, z1 + (z2 - z1) * t, y + Math.sin(t * Math.PI) * arc); }
    }
    for (const [x, z, y] of h.gems ?? []) add('gem', x, z, y ?? 0.7);
    for (const [x, z, y] of h.orbs ?? []) add('orb', x, z, y ?? 0.8);
    for (const [x, z, item, y] of h.crystals ?? []) add('crystal', x, z, y ?? 1.0, { item });
    c.pickups = pk;
    c.monsters = (h.monsters ?? []).map(([x, z, r = 4, kind]) => ({ x, z, r, kind: kind ?? c.realm.monster }));
}

export function surfPhys(sid) { return SURF_PHYS[sid]; }

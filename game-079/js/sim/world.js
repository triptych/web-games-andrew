// Grid queries over a level and its live door state: collision, ray casts, line of sight, flow
// fields. Pure. A body is a vertical cylinder {x, y (feet), z, r, h}; against the grid it is
// treated as its bounding square, so moving x and z separately slides along walls.

import { CELL, STEP_UP } from '../config.js';

const DIR8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

export function cellAt(L, x, z) {
    const cx = Math.floor(x / CELL), cz = Math.floor(z / CELL);
    if (cx < 0 || cz < 0 || cx >= L.W || cz >= L.H) return -1;
    return cz * L.W + cx;
}
export const cellX = (L, i) => (i % L.W + 0.5) * CELL;
export const cellZ = (L, i) => (((i / L.W) | 0) + 0.5) * CELL;

/** Solid for everything: walls and closed doors. */
export function isWall(G, i) {
    if (i < 0) return true;
    const L = G.L;
    if (L.solid[i]) return true;
    const d = L.door[i];
    return d >= 0 && G.doorOpen[d] < 0.9;
}

/** Does cell i block a body with feet at y, height h, that can climb `step` (fly: hovering)? */
export function blocks(G, i, y, h, step, fly) {
    if (isWall(G, i)) return true;
    const L = G.L;
    const f = L.floor[i];
    if (fly ? f > y + 0.05 : f - y > step + 1e-4) return true;
    return L.ceil[i] - Math.max(y, f) < h;
}

function boxBlocked(G, x, z, b, step, fly) {
    const L = G.L;
    const x0 = Math.floor((x - b.r) / CELL), x1 = Math.floor((x + b.r) / CELL);
    const z0 = Math.floor((z - b.r) / CELL), z1 = Math.floor((z + b.r) / CELL);
    for (let cz = z0; cz <= z1; cz++) for (let cx = x0; cx <= x1; cx++) {
        if (cx < 0 || cz < 0 || cx >= L.W || cz >= L.H) return true;
        if (blocks(G, cz * L.W + cx, b.y, b.h, step, fly)) return true;
    }
    return false;
}

/** Move a body by (dx, dz). Returns { hitX, hitZ }. */
export function moveBody(G, b, dx, dz, step = STEP_UP, fly = false) {
    const out = { hitX: false, hitZ: false };
    const n = Math.max(1, Math.ceil(Math.max(Math.abs(dx), Math.abs(dz)) / (CELL * 0.3)));
    const sx = dx / n, sz = dz / n;
    for (let k = 0; k < n; k++) {
        if (sx) { if (!boxBlocked(G, b.x + sx, b.z, b, step, fly)) b.x += sx; else out.hitX = true; }
        if (sz) { if (!boxBlocked(G, b.x, b.z + sz, b, step, fly)) b.z += sz; else out.hitZ = true; }
    }
    return out;
}

/** Highest floor and lowest ceiling under a body's square. */
export function supportAt(G, x, z, r) {
    const L = G.L;
    let floor = -1e9, ceil = 1e9;
    const x0 = Math.floor((x - r) / CELL), x1 = Math.floor((x + r) / CELL);
    const z0 = Math.floor((z - r) / CELL), z1 = Math.floor((z + r) / CELL);
    for (let cz = z0; cz <= z1; cz++) for (let cx = x0; cx <= x1; cx++) {
        if (cx < 0 || cz < 0 || cx >= L.W || cz >= L.H) continue;
        const i = cz * L.W + cx;
        if (isWall(G, i)) continue;
        if (L.floor[i] > floor) floor = L.floor[i];
        if (L.ceil[i] < ceil) ceil = L.ceil[i];
    }
    return { floor, ceil };
}

/** Is a body's centre over liquid (the cell under its centre, at floor level)? */
export function inLiquid(G, b) {
    const i = cellAt(G.L, b.x, b.z);
    return i >= 0 && G.L.liquid[i] && b.y <= G.L.floor[i] + 0.05;
}

/**
 * Ray against the grid: walls, floors and ceilings. Direction need not be unit; t is in units of
 * the direction's length. Returns { t, nx, ny, nz, cell } or null within maxT.
 */
export function rayGrid(G, x0, y0, z0, dx, dy, dz, maxT) {
    const L = G.L;
    let cx = Math.floor(x0 / CELL), cz = Math.floor(z0 / CELL);
    const stepX = dx > 0 ? 1 : -1, stepZ = dz > 0 ? 1 : -1;
    const tDX = dx !== 0 ? Math.abs(CELL / dx) : Infinity;
    const tDZ = dz !== 0 ? Math.abs(CELL / dz) : Infinity;
    let tMX = dx !== 0 ? ((dx > 0 ? (cx + 1) * CELL - x0 : x0 - cx * CELL) / Math.abs(dx)) : Infinity;
    let tMZ = dz !== 0 ? ((dz > 0 ? (cz + 1) * CELL - z0 : z0 - cz * CELL) / Math.abs(dz)) : Infinity;
    let tA = 0, nx = 0, nz = 0;
    for (let guard = 0; guard < 400; guard++) {
        if (cx < 0 || cz < 0 || cx >= L.W || cz >= L.H) return { t: tA, nx, ny: 0, nz, cell: -1 };
        const i = cz * L.W + cx;
        if (isWall(G, i)) return { t: tA, nx, ny: 0, nz, cell: i };
        const f = L.floor[i], c = L.ceil[i];
        const yA = y0 + dy * tA;
        // entering this cell through a step face or a lintel
        if (tA > 0 && (yA < f - 1e-4 || yA > c + 1e-4)) return { t: tA, nx, ny: 0, nz, cell: i };
        const tB = Math.min(tMX, tMZ, maxT);
        const yB = y0 + dy * tB;
        if (yB < f) { const t = (f - y0) / dy; return { t: Math.max(tA, t), nx: 0, ny: 1, nz: 0, cell: i }; }
        if (yB > c) { const t = (c - y0) / dy; return { t: Math.max(tA, t), nx: 0, ny: -1, nz: 0, cell: i }; }
        if (tB >= maxT) return null;
        if (tMX < tMZ) { tA = tMX; tMX += tDX; cx += stepX; nx = -stepX; nz = 0; }
        else { tA = tMZ; tMZ += tDZ; cz += stepZ; nz = -stepZ; nx = 0; }
    }
    return null;
}

/** Clear line between two points? */
export function los(G, ax, ay, az, bx, by, bz) {
    return !rayGrid(G, ax, ay, az, bx - ax, by - ay, bz - az, 1);
}

/** Ray against a vertical cylinder (centre x, z, feet y, radius r, height h). Returns t or -1. */
export function rayCylinder(x0, y0, z0, dx, dy, dz, cx, cy, cz, r, h) {
    const ox = x0 - cx, oz = z0 - cz;
    const a = dx * dx + dz * dz;
    let t;
    if (a < 1e-9) {
        if (ox * ox + oz * oz > r * r) return -1;
        t = 0;
    } else {
        const b = 2 * (ox * dx + oz * dz), c = ox * ox + oz * oz - r * r;
        const disc = b * b - 4 * a * c;
        if (disc < 0) return -1;
        const sq = Math.sqrt(disc);
        t = (-b - sq) / (2 * a);
        if (t < 0) { t = (-b + sq) / (2 * a); if (t < 0) return -1; t = 0; }
    }
    const y = y0 + dy * t;
    if (y >= cy && y <= cy + h) return t;
    // could still enter through the top or bottom cap
    for (const py of [cy, cy + h]) {
        if (Math.abs(dy) < 1e-9) continue;
        const tc = (py - y0) / dy;
        if (tc < 0) continue;
        const px = ox + dx * tc, pz = oz + dz * tc;
        if (px * px + pz * pz <= r * r) return tc;
    }
    return -1;
}

/**
 * Breadth-first distances (in cells) to `target` for walkers (step rule, doors) or fliers.
 * 8-way with no corner cutting. Returned as an Int16Array; -1 = unreachable.
 */
export function flowField(G, target, fly = false, out = null) {
    const L = G.L;
    const d = out || new Int16Array(L.N);
    d.fill(-1);
    if (target < 0) return d;
    const q = new Int32Array(L.N);
    let qh = 0, qt = 0;
    q[qt++] = target; d[target] = 0;
    while (qh < qt) {
        const i = q[qh++], x = i % L.W, y = (i / L.W) | 0;
        for (const [ox, oy] of DIR8) {
            const nx = x + ox, ny = y + oy;
            if (nx < 0 || ny < 0 || nx >= L.W || ny >= L.H) continue;
            const j = ny * L.W + nx;
            if (d[j] >= 0 || isWall(G, j)) continue;
            if (ox && oy && (isWall(G, y * L.W + nx) || isWall(G, ny * L.W + x))) continue;
            // the field runs from target outward; a walker moves j → i, so it must be able to step up into i
            if (!fly && (L.floor[i] - L.floor[j] > STEP_UP + 1e-4)) continue;
            if (!fly && ox && oy && (Math.abs(L.floor[y * L.W + nx] - L.floor[j]) > STEP_UP || Math.abs(L.floor[ny * L.W + x] - L.floor[j]) > STEP_UP)) continue;
            if (L.ceil[j] - L.floor[j] < 2) continue;
            d[j] = d[i] + 1;
            q[qt++] = j;
        }
    }
    return d;
}

/** The neighbour of i one step closer to the field's target, or -1. */
export function flowNext(G, field, i) {
    const L = G.L;
    if (i < 0 || field[i] <= 0) return -1;
    const x = i % L.W, y = (i / L.W) | 0;
    let best = -1, bd = field[i];
    for (const [ox, oy] of DIR8) {
        const nx = x + ox, ny = y + oy;
        if (nx < 0 || ny < 0 || nx >= L.W || ny >= L.H) continue;
        const j = ny * L.W + nx;
        if (field[j] < 0 || field[j] >= bd) continue;
        if (ox && oy && (field[y * L.W + nx] < 0 || field[ny * L.W + x] < 0)) continue;
        bd = field[j]; best = j;
    }
    return best;
}

// ==================================================================== walking routes

/** Walking route BFS from `goal` (the bot and the HUD's arrow and minimap share it): walls block; doors pass if we hold the key and they aren't locked. */
export function routeField(G, goal) {
    const L = G.L, p = G.player;
    const d = new Int16Array(L.N).fill(-1);
    if (goal < 0) return d;
    const pass = (i) => {
        if (L.solid[i]) return false;
        const dr = L.door[i];
        if (dr >= 0 && (G.doorLock[dr] || !(p.keys & (1 << L.doors[dr].key))) && G.doorOpen[dr] < 0.9) return false;
        return L.ceil[i] - L.floor[i] >= 2;
    };
    const q = new Int32Array(L.N);
    let h = 0, t = 0;
    q[t++] = goal; d[goal] = 0;
    while (h < t) {
        const i = q[h++], x = i % L.W, y = (i / L.W) | 0;
        for (const [ox, oy] of DIR8) {
            const nx = x + ox, ny = y + oy;
            if (nx < 0 || ny < 0 || nx >= L.W || ny >= L.H) continue;
            const j = ny * L.W + nx;
            if (d[j] >= 0 || !pass(j)) continue;
            // corners: both orthogonal cells must be walkable and dry, the same rule nextCell() follows
            if (ox && oy && (!pass(y * L.W + nx) || !pass(ny * L.W + x) || L.liquid[y * L.W + nx] || L.liquid[ny * L.W + x])) continue;
            if (L.floor[i] - L.floor[j] > STEP_UP + 1e-4) continue;
            if (ox && oy && (L.floor[y * L.W + nx] - L.floor[j] > STEP_UP || L.floor[ny * L.W + x] - L.floor[j] > STEP_UP)) continue;
            if (L.liquid[i] && !L.liquid[j] && L.floor[j] > L.floor[i]) continue;   // j → i: don't route down into pits
            d[j] = d[i] + 1;
            q[t++] = j;
        }
    }
    return d;
}

/** One step along a route field from cell i (no corner cutting), or -1. */
export function routeNext(G, field, i) {
    const L = G.L;
    const x = i % L.W, y = (i / L.W) | 0;
    let best = -1, bd = field[i];
    for (const [ox, oy] of DIR8) {
        const nx = x + ox, ny = y + oy;
        if (nx < 0 || ny < 0 || nx >= L.W || ny >= L.H) continue;
        const j = ny * L.W + nx;
        if (field[j] < 0 || field[j] >= bd) continue;
        if (ox && oy && (field[y * L.W + nx] < 0 || field[ny * L.W + x] < 0)) continue;
        bd = field[j]; best = j;
    }
    return best;
}

/** A straight walk that stays on the field and out of liquid (line of sight passes over pits). */
export function routeClear(G, field, x0, z0, x1, z1) {
    const L = G.L;
    const n = Math.ceil(Math.hypot(x1 - x0, z1 - z0) / 0.5);
    for (let k = 1; k <= n; k++) {
        const t = k / n;
        for (const o of [-0.45, 0.45]) {
            const dx = z1 - z0, dz = x0 - x1, l = Math.hypot(dx, dz) || 1;
            const c = cellAt(L, x0 + (x1 - x0) * t + dx / l * o, z0 + (z1 - z0) * t + dz / l * o);
            if (c < 0 || field[c] < 0 || L.liquid[c] || L.crate[c]) return false;
        }
    }
    return true;
}

/**
 * Where the objective arrow should point: walk the route from (x, z) and return the farthest cell
 * along it that can be reached in a straight line, plus the route's length in metres.
 */
export function routeAhead(G, field, x, z, maxSteps = 16) {
    const L = G.L;
    let c = cellAt(L, x, z);
    if (c < 0 || field[c] < 0) return null;
    const dist = field[c] * CELL;
    // always at least one step along the route (pointing at your own cell spins the arrow round
    // you), then as far ahead as a straight walk stays on the route
    let best = routeNext(G, field, c);
    if (best < 0) best = c;
    c = best;
    for (let k = 1; k < maxSteps; k++) {
        const nx = routeNext(G, field, c);
        if (nx < 0) break;
        c = nx;
        if (routeClear(G, field, x, z, cellX(L, c), cellZ(L, c))) best = c;
        else break;
    }
    return { x: cellX(L, best), z: cellZ(L, best), dist };
}


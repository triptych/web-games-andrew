// GIANT'S VAULT: area generation, the walkable grid, collision, line of sight and flow fields. Pure.
//
// An area is a grid of cells, 1 m each: 0 wall, 1 floor. Positions are continuous (x, y) in metres; cell (cx, cy)
// covers [cx, cx+1) × [cy, cy+1). Generators: 'town' (hand-laid), 'wilds' (cellular caves), 'rooms' (rooms joined by
// 3-wide corridors), 'rift' (rooms with a mixed look). Every generator is checked by reach(): the start must reach the
// exit and every spawn point, or the seed is rejected and the next one tried (dev/simtest.mjs proves it on 60 seeds).

import { makeRng } from '../rng.js';
import { TOWN } from './data/world.js';

export const WALL = 0, FLOOR = 1;

export const cellAt = (A, x, y) => {
    const cx = Math.floor(x), cy = Math.floor(y);
    return cx < 0 || cy < 0 || cx >= A.w || cy >= A.h ? WALL : A.grid[cy * A.w + cx];
};
export const isFloor = (A, x, y) => cellAt(A, x, y) === FLOOR;

/** A circle of radius r fits at (x, y): its bounding box corners and centre are on floor. */
export function fits(A, x, y, r) {
    return isFloor(A, x, y) && isFloor(A, x - r, y - r) && isFloor(A, x + r, y - r) && isFloor(A, x - r, y + r) && isFloor(A, x + r, y + r);
}

/** Move a body by (dx, dy), axis by axis, so it slides along walls. Returns true if it moved at all. */
export function moveBody(A, b, dx, dy, r) {
    let moved = false;
    if (dx && fits(A, b.x + dx, b.y, r)) { b.x += dx; moved = true; }
    if (dy && fits(A, b.x, b.y + dy, r)) { b.y += dy; moved = true; }
    return moved;
}

/** Grid line of sight between two points (walls block). Samples every 0.25 m. */
export function los(A, x0, y0, x1, y1) {
    const d = Math.hypot(x1 - x0, y1 - y0), n = Math.ceil(d / 0.25);
    for (let i = 1; i < n; i++) if (!isFloor(A, x0 + ((x1 - x0) * i) / n, y0 + ((y1 - y0) * i) / n)) return false;
    return true;
}

/** Line of sight wide enough for a body of radius r to walk straight along it (three parallel lines). */
export function clearPath(A, x0, y0, x1, y1, r) {
    const d = Math.hypot(x1 - x0, y1 - y0) || 1, nx = (-(y1 - y0) / d) * r, ny = ((x1 - x0) / d) * r;
    return los(A, x0, y0, x1, y1) && los(A, x0 + nx, y0 + ny, x1 + nx, y1 + ny) && los(A, x0 - nx, y0 - ny, x1 - nx, y1 - ny);
}

/** The furthest point along the ray from (x0,y0) toward (x1,y1) that a body of radius r can stand on. */
export function lastFit(A, x0, y0, x1, y1, r) {
    const d = Math.hypot(x1 - x0, y1 - y0), n = Math.max(1, Math.ceil(d / 0.2));
    let bx = x0, by = y0;
    for (let i = 1; i <= n; i++) {
        const x = x0 + ((x1 - x0) * i) / n, y = y0 + ((y1 - y0) * i) / n;
        if (!isFloor(A, x, y)) break;
        if (fits(A, x, y, r)) { bx = x; by = y; }
    }
    return { x: bx, y: by };
}

/** Breadth-first distances (in cells, 8-way without cutting corners) from a cell. Int32Array, -1 = unreachable. */
export function flow(A, cx, cy) {
    const { w, h, grid } = A;
    const dist = new Int32Array(w * h).fill(-1);
    if (cx < 0 || cy < 0 || cx >= w || cy >= h || grid[cy * w + cx] !== FLOOR) return dist;
    const q = new Int32Array(w * h);
    let qh = 0, qt = 0;
    dist[cy * w + cx] = 0; q[qt++] = cy * w + cx;
    while (qh < qt) {
        const i = q[qh++], x = i % w, y = (i / w) | 0, d = dist[i] + 1;
        for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
            if (!ox && !oy) continue;
            const nx = x + ox, ny = y + oy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            const j = ny * w + nx;
            if (grid[j] !== FLOOR || dist[j] >= 0) continue;
            if (ox && oy && (grid[y * w + nx] !== FLOOR || grid[ny * w + x] !== FLOOR)) continue;   // no corner cutting
            dist[j] = d; q[qt++] = j;
        }
    }
    return dist;
}

/** The direction to walk from (x, y) to go down a flow field (toward its source). null if there is no way. */
export function downhill(A, dist, x, y) {
    const cx = Math.floor(x), cy = Math.floor(y), w = A.w;
    const here = dist[cy * w + cx];
    if (here < 0) return null;
    if (here === 0) return { cx: cx + 0.5, cy: cy + 0.5 };
    let best = here, bx = cx, by = cy;
    for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) {
        const nx = cx + ox, ny = cy + oy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= A.h) continue;
        const d = dist[ny * w + nx];
        if (d >= 0 && d < best) { best = d; bx = nx; by = ny; }
    }
    return { cx: bx + 0.5, cy: by + 0.5 };
}

// ------------------------------------------------------------------------------------------------------ generators

function blank(w, h) { return { w, h, grid: new Array(w * h).fill(WALL) }; }
function carve(A, x0, y0, x1, y1) {
    for (let y = Math.max(1, y0); y <= Math.min(A.h - 2, y1); y++) for (let x = Math.max(1, x0); x <= Math.min(A.w - 2, x1); x++) A.grid[y * A.w + x] = FLOOR;
}

function genTown() {
    const A = blank(TOWN.w, TOWN.h);
    carve(A, 2, 2, A.w - 3, A.h - 3);
    // a few buildings and wells as blocks to walk around
    for (const [x0, y0, x1, y1] of [[3, 3, 7, 6], [28, 3, 32, 7], [3, 21, 7, 24], [29, 21, 32, 24]]) {
        for (let y = y0; y <= y1; y++) for (let x = x0; x <= x1; x++) A.grid[y * A.w + x] = WALL;
    }
    // the road north to the gate
    carve(A, 16, 1, 20, 3);
    const [sx, sy] = TOWN.spawn;
    return { ...A, start: { x: sx + 0.5, y: sy + 0.5 }, rooms: [], exit: null, spawns: [] };
}

function genRooms(rng, w, h) {
    const A = blank(w, h);
    const rooms = [];
    for (let t = 0; t < 400 && rooms.length < 14; t++) {
        const rw = rng.int(7, 14), rh = rng.int(7, 13);
        const x = rng.int(2, w - rw - 3), y = rng.int(2, h - rh - 3);
        if (rooms.some((r) => x < r.x + r.w + 3 && x + rw + 3 > r.x && y < r.y + r.h + 3 && y + rh + 3 > r.y)) continue;
        rooms.push({ x, y, w: rw, h: rh, cx: x + rw / 2, cy: y + rh / 2 });
    }
    for (const r of rooms) carve(A, r.x, r.y, r.x + r.w - 1, r.y + r.h - 1);
    // join each room to its nearest earlier room (a spanning tree), then add two loops
    const join = (a, b) => {
        const ax = Math.floor(a.cx), ay = Math.floor(a.cy), bx = Math.floor(b.cx), by = Math.floor(b.cy);
        if (rng() < 0.5) { carve(A, Math.min(ax, bx) - 1, ay - 1, Math.max(ax, bx) + 1, ay + 1); carve(A, bx - 1, Math.min(ay, by) - 1, bx + 1, Math.max(ay, by) + 1); }
        else { carve(A, ax - 1, Math.min(ay, by) - 1, ax + 1, Math.max(ay, by) + 1); carve(A, Math.min(ax, bx) - 1, by - 1, Math.max(ax, bx) + 1, by + 1); }
    };
    for (let i = 1; i < rooms.length; i++) {
        let best = 0, bd = Infinity;
        for (let j = 0; j < i; j++) { const d = Math.hypot(rooms[i].cx - rooms[j].cx, rooms[i].cy - rooms[j].cy); if (d < bd) { bd = d; best = j; } }
        join(rooms[i], rooms[best]);
    }
    for (let k = 0; k < 2 && rooms.length > 4; k++) join(rng.pick(rooms), rng.pick(rooms));
    return { ...A, rooms };
}

function genWilds(rng, w, h) {
    let grid = new Array(w * h);
    for (let y = 0; y < h; y++) for (let x = 0; x < w; x++) grid[y * w + x] = x < 2 || y < 2 || x >= w - 2 || y >= h - 2 || rng() < 0.43 ? WALL : FLOOR;
    for (let it = 0; it < 5; it++) {
        const g2 = grid.slice();
        for (let y = 2; y < h - 2; y++) for (let x = 2; x < w - 2; x++) {
            let walls = 0;
            for (let oy = -1; oy <= 1; oy++) for (let ox = -1; ox <= 1; ox++) if (grid[(y + oy) * w + x + ox] === WALL) walls++;
            g2[y * w + x] = walls >= 5 ? WALL : FLOOR;
        }
        grid = g2;
    }
    const A = { w, h, grid };
    // clearings: a few round open spaces where packs gather and big fights read well
    const rooms = [];
    for (let i = 0; i < 9; i++) {
        const cx = rng.int(8, w - 9), cy = rng.int(8, h - 9), r = rng.int(3, 5);
        for (let y = cy - r; y <= cy + r; y++) for (let x = cx - r; x <= cx + r; x++) if (Math.hypot(x - cx, y - cy) <= r) A.grid[y * w + x] = FLOOR;
        rooms.push({ x: cx - r, y: cy - r, w: 2 * r, h: 2 * r, cx, cy });
    }
    // keep the largest connected region; everything else becomes wall
    let bestSeen = null, bestN = 0;
    const done = new Uint8Array(w * h);
    for (let i = 0; i < w * h; i++) {
        if (A.grid[i] !== FLOOR || done[i]) continue;
        const d = flow(A, i % w, (i / w) | 0);
        let n = 0;
        for (let j = 0; j < w * h; j++) if (d[j] >= 0) { done[j] = 1; n++; }
        if (n > bestN) { bestN = n; bestSeen = d; }
    }
    for (let i = 0; i < w * h; i++) if (!bestSeen || bestSeen[i] < 0) A.grid[i] = WALL;
    return { ...A, rooms: rooms.filter((r) => A.grid[Math.floor(r.cy) * w + Math.floor(r.cx)] === FLOOR) };
}

/** Floor cells far enough from walls for a body of radius r. */
function openCells(A, r = 0.6) {
    const out = [];
    for (let y = 1; y < A.h - 1; y++) for (let x = 1; x < A.w - 1; x++) if (fits(A, x + 0.5, y + 0.5, r)) out.push(y * A.w + x);
    return out;
}

/**
 * Build an area. Returns { w, h, grid, start, exit, bossAt, waystone, spawns: [{x,y}], lore: [{x,y}], rooms }.
 * kind: 'town' | 'wilds' | 'rooms' | 'rift'. Retries up to 30 seeds until the layout is proved (start reaches all).
 */
export function generateArea(kind, seed, w = 60, h = 60, { boss = false } = {}) {
    if (kind === 'town') return { ...genTown(), kind, seed, waystone: { x: TOWN.waystone[0] + 0.5, y: TOWN.waystone[1] + 0.5 } };
    for (let attempt = 0; attempt < 30; attempt++) {
        const rng = makeRng(seed + attempt * 7919);
        const A = kind === 'wilds' ? genWilds(rng, w, h) : genRooms(rng, w, h);
        const open = openCells(A);
        if (open.length < w * h * 0.18) continue;
        // start: the open cell nearest the bottom-left corner; exit: the open cell furthest from it by walking
        let s = open[0], sd = Infinity;
        for (const i of open) { const x = i % w, y = (i / w) | 0, d = x + (h - y); if (d < sd) { sd = d; s = i; } }
        const sx = s % w, sy = (s / w) | 0;
        const dist = flow(A, sx, sy);
        let e = s, ed = -1;
        for (const i of open) if (dist[i] > ed) { ed = dist[i]; e = i; }
        if (ed < 25) continue;
        const ex = e % w, ey = (e / w) | 0;
        // spawn points: open cells at least 9 cells' walk from the start, spread out, by the seed
        const cand = open.filter((i) => dist[i] >= 9 && Math.hypot((i % w) - ex, ((i / w) | 0) - ey) > (boss ? 8 : 3));
        const spawns = [];
        for (let k = 0; k < cand.length * 3 && spawns.length < 400; k++) {
            const i = rng.pick(cand), x = (i % w) + 0.5, y = ((i / w) | 0) + 0.5;
            if (spawns.every((p) => Math.hypot(p.x - x, p.y - y) > 5)) spawns.push({ x, y, d: dist[i] });
        }
        // lore tablets: dead-end-ish open cells (few open neighbours), not near the start
        const lore = [];
        for (const i of open) {
            if (dist[i] < 12 || lore.length >= 3) continue;
            const x = i % w, y = (i / w) | 0;
            let n = 0;
            for (let oy = -2; oy <= 2; oy++) for (let ox = -2; ox <= 2; ox++) if (A.grid[(y + oy) * w + x + ox] === FLOOR) n++;
            if (n <= 14 && rng() < 0.3 && lore.every((p) => Math.hypot(p.x - x, p.y - y) > 15)) lore.push({ x: x + 0.5, y: y + 0.5 });
        }
        // the waystone stands a few steps in from the start
        let ws = s;
        for (const i of open) if (dist[i] === 4) { ws = i; break; }
        const out = {
            ...A, kind, seed: seed + attempt * 7919, rooms: A.rooms,
            start: { x: sx + 0.5, y: sy + 0.5 }, exit: { x: ex + 0.5, y: ey + 0.5 },
            waystone: { x: (ws % w) + 0.5, y: ((ws / w) | 0) + 0.5 },
            spawns: spawns.filter((p) => dist[Math.floor(p.y) * w + Math.floor(p.x)] >= 0), lore,
        };
        if (boss) out.bossAt = { ...out.exit };
        return out;
    }
    throw new Error('no layout for seed ' + seed);
}

/** The proof the tests run: every spawn, lore stone, the waystone and the exit are reachable from the start. */
export function proveArea(A) {
    const d = flow(A, Math.floor(A.start.x), Math.floor(A.start.y));
    const ok = (p) => !p || d[Math.floor(p.y) * A.w + Math.floor(p.x)] >= 0;
    return ok(A.exit) && ok(A.waystone) && (A.spawns || []).every(ok) && (A.lore || []).every(ok);
}

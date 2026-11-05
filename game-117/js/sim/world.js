// The asteroid: a maze on a sphere. Pure, seeded, rebuilt from (level, seed) and never saved.
//
// The sphere is cut into a cube-sphere grid: six faces of N×N cells, equiangular so the cells come
// out nearly the same size. Each cell knows its four neighbours (across face seams too, found by
// stepping past the edge and looking the point up again), the maze is carved on that graph, and
// every closed edge becomes a wall: a great-circle arc between two grid corners, with a thickness.
// Everything that moves is a unit vector; collision is distance to those arcs.

import * as V from './vec.js';
import { makeRng } from '../rng.js';
import { WALL } from '../config.js';

const Q = Math.PI / 4;
// normal, then the two tangent axes U and V of each cube face
const FACES = [
    { n: [1, 0, 0],  u: [0, 0, -1], v: [0, 1, 0] },
    { n: [-1, 0, 0], u: [0, 0, 1],  v: [0, 1, 0] },
    { n: [0, 1, 0],  u: [1, 0, 0],  v: [0, 0, -1] },
    { n: [0, -1, 0], u: [1, 0, 0],  v: [0, 0, 1] },
    { n: [0, 0, 1],  u: [1, 0, 0],  v: [0, 1, 0] },
    { n: [0, 0, -1], u: [-1, 0, 0], v: [0, 1, 0] },
];

function facePoint(f, U, W) {
    const F = FACES[f];
    const a = Math.tan(U * Q), b = Math.tan(W * Q);
    return V.norm([F.n[0] + a * F.u[0] + b * F.v[0], F.n[1] + a * F.u[1] + b * F.v[1], F.n[2] + a * F.u[2] + b * F.v[2]]);
}

function faceOf(p) {
    const ax = Math.abs(p[0]), ay = Math.abs(p[1]), az = Math.abs(p[2]);
    if (ax >= ay && ax >= az) return p[0] > 0 ? 0 : 1;
    if (ay >= az) return p[1] > 0 ? 2 : 3;
    return p[2] > 0 ? 4 : 5;
}

/** The index of the cell that contains unit vector p. */
export function cellOf(W, p) {
    const f = faceOf(p), F = FACES[f], N = W.N;
    const dn = V.dot(p, F.n);
    const U = Math.atan(V.dot(p, F.u) / dn) / Q, Vv = Math.atan(V.dot(p, F.v) / dn) / Q;
    const i = Math.min(N - 1, Math.max(0, Math.floor((U + 1) * 0.5 * N)));
    const j = Math.min(N - 1, Math.max(0, Math.floor((Vv + 1) * 0.5 * N)));
    return f * N * N + j * N + i;
}

/** Distances (in cells, through open edges) from one cell to every other; -1 = unreachable. */
export function bfs(W, from) {
    const dist = new Int16Array(W.cells.length).fill(-1);
    const q = new Int32Array(W.cells.length);
    let h = 0, t = 0;
    dist[from] = 0; q[t++] = from;
    while (h < t) {
        const c = W.cells[q[h++]];
        for (let k = 0; k < 4; k++) {
            if (!c.open[k]) continue;
            const n = c.nb[k];
            if (dist[n] < 0) { dist[n] = dist[c.id] + 1; q[t++] = n; }
        }
    }
    return dist;
}

/** The same, ignoring walls: plain grid distance. */
function gridDist(W, from) {
    const dist = new Int16Array(W.cells.length).fill(-1);
    const q = [from];
    dist[from] = 0;
    for (let h = 0; h < q.length; h++) {
        const c = W.cells[q[h]];
        for (const n of c.nb) if (dist[n] < 0) { dist[n] = dist[c.id] + 1; q.push(n); }
    }
    return dist;
}

function openEdge(W, a, k) {
    const c = W.cells[a];
    c.open[k] = true;
    W.cells[c.nb[k]].open[c.back[k]] = true;
}

/** Open every edge between cells within grid distance r of a centre cell: a clearing. */
function clearing(W, centre, r) {
    const d = gridDist(W, centre);
    for (const c of W.cells) {
        if (d[c.id] < 0 || d[c.id] > r) continue;
        for (let k = 0; k < 4; k++) {
            const n = c.nb[k];
            if (d[n] >= 0 && d[n] <= r) openEdge(W, c.id, k);
        }
    }
}

/**
 * Build the asteroid for a level row and a seed. A layout whose beacons ended up too close to
 * the start (the clearings can open shortcuts) is thrown away and the next sub-seed is tried,
 * so every seed still gives one fixed asteroid.
 */
export function buildWorld(def, seed) {
    for (let k = 0; k < 40; k++) {
        const W = attempt(def, (seed + k * 7777) | 0);
        const d = bfs(W, W.start);
        if (W.turretCells.length === def.turrets && W.turretCells.every((c) => d[c] >= 3) && d[W.exit] >= 4) return W;
    }
    return attempt(def, seed);
}

function attempt(def, seed) {
    const rng = makeRng(seed ^ 0x5eed);
    const N = def.N, R = def.R;
    const W = { R, N, cells: [], walls: [], cellArc: Math.PI / 2 / N, start: 0, exit: 0, turretCells: [], bossCell: -1 };

    for (let f = 0; f < 6; f++) {
        for (let j = 0; j < N; j++) {
            for (let i = 0; i < N; i++) {
                const U = -1 + (2 * i + 1) / N, Vv = -1 + (2 * j + 1) / N;
                W.cells.push({ id: W.cells.length, f, i, j, U, V: Vv, c: facePoint(f, U, Vv), nb: [0, 0, 0, 0], back: [0, 0, 0, 0], open: [false, false, false, false], near: [] });
            }
        }
    }
    // neighbours: step one cell past each edge, then look the point up (works across the seams)
    const step = 2 / N;
    for (const c of W.cells) {
        c.nb[0] = cellOf(W, facePoint(c.f, c.U + step, c.V));
        c.nb[1] = cellOf(W, facePoint(c.f, c.U, c.V + step));
        c.nb[2] = cellOf(W, facePoint(c.f, c.U - step, c.V));
        c.nb[3] = cellOf(W, facePoint(c.f, c.U, c.V - step));
    }
    for (const c of W.cells) for (let k = 0; k < 4; k++) c.back[k] = W.cells[c.nb[k]].nb.indexOf(c.id);

    // a perfect maze by depth-first carving, from the cell at the north pole
    W.start = cellOf(W, [0, 1, 0]);
    const seen = new Uint8Array(W.cells.length);
    const stack = [W.start];
    seen[W.start] = 1;
    while (stack.length) {
        const c = W.cells[stack[stack.length - 1]];
        const opts = [];
        for (let k = 0; k < 4; k++) if (!seen[c.nb[k]]) opts.push(k);
        if (!opts.length) { stack.pop(); continue; }
        const k = rng.pick(opts);
        openEdge(W, c.id, k);
        seen[c.nb[k]] = 1;
        stack.push(c.nb[k]);
    }
    // braid: knock out some walls so there are loops to circle and flank through
    for (const c of W.cells) {
        for (let k = 0; k < 4; k++) {
            if (!c.open[k] && c.id < c.nb[k] && rng() < def.braid) openEdge(W, c.id, k);
        }
    }

    clearing(W, W.start, 1);
    // the exit is as far from the start as the maze allows; beacons spread out between
    const fromStart = bfs(W, W.start);
    const grid = gridDist(W, W.start);
    let far = W.start;
    for (const c of W.cells) if (fromStart[c.id] > fromStart[far]) far = c.id;
    W.exit = far;
    if (def.boss) W.bossCell = far;
    const taken = [W.start, W.exit];
    const minD = new Float64Array(W.cells.length).fill(1e9);
    const relax = (from) => { const d = bfs(W, from); for (let i = 0; i < d.length; i++) minD[i] = Math.min(minD[i], d[i] < 0 ? 1e9 : d[i]); };
    relax(W.start); relax(W.exit);
    for (let t = 0; t < def.turrets; t++) {
        let best = -1, bs = -1;
        for (const c of W.cells) {
            if (taken.includes(c.id) || fromStart[c.id] < 4 || grid[c.id] < 3) continue;
            const s = minD[c.id] + rng() * 0.9;
            if (s > bs) { bs = s; best = c.id; }
        }
        if (best < 0) break;
        taken.push(best);
        W.turretCells.push(best);
        relax(best);
    }
    // clearings around the start, each beacon and the exit (bigger for the boss)
    for (const c of W.turretCells) clearing(W, c, 1);
    clearing(W, W.exit, def.boss ? 2 : 1);

    // walls from the closed edges
    for (const c of W.cells) {
        const U0 = -1 + 2 * c.i / N, U1 = -1 + 2 * (c.i + 1) / N;
        const V0 = -1 + 2 * c.j / N, V1 = -1 + 2 * (c.j + 1) / N;
        const corners = [[[U1, V0], [U1, V1]], [[U0, V1], [U1, V1]], [[U0, V0], [U0, V1]], [[U0, V0], [U1, V0]]];
        for (let k = 0; k < 4; k++) {
            if (c.open[k] || c.id > c.nb[k]) continue;
            const a = facePoint(c.f, corners[k][0][0], corners[k][0][1]);
            const b = facePoint(c.f, corners[k][1][0], corners[k][1][1]);
            W.walls.push({ a, b, n: V.norm(V.cross(a, b)), cells: [c.id, c.nb[k]] });
        }
    }
    // each cell keeps the walls an entity inside it could touch: its own and its neighbours'
    const sets = W.cells.map(() => new Set());
    W.walls.forEach((w, wi) => {
        for (const ci of w.cells) {
            sets[ci].add(wi);
            for (const n of W.cells[ci].nb) sets[n].add(wi);
        }
    });
    W.cells.forEach((c, i) => { c.near = [...sets[i]]; });
    return W;
}

const tmp = [0, 0, 0];
/** Chord distance (unit sphere) from p to wall w; the closest point is left in `out`. */
export function wallDist(w, p, out = tmp) {
    const s = V.dot(p, w.n);
    const qx = p[0] - w.n[0] * s, qy = p[1] - w.n[1] * s, qz = p[2] - w.n[2] * s;
    const q = [qx, qy, qz];
    if (V.dot(V.cross(w.a, q), w.n) >= 0 && V.dot(V.cross(q, w.b), w.n) >= 0) {
        const l = Math.hypot(qx, qy, qz) || 1;
        out[0] = qx / l; out[1] = qy / l; out[2] = qz / l;
    } else {
        const e = V.chord(p, w.a) < V.chord(p, w.b) ? w.a : w.b;
        out[0] = e[0]; out[1] = e[1]; out[2] = e[2];
    }
    return V.chord(p, out);
}

/** Push p out of every wall it overlaps (rad in world units, the wall's half thickness added here). Returns [p, hit]. */
export function collideWalls(W, p, rad) {
    const r = (rad + WALL.half) / W.R;
    let hit = false;
    const c = [0, 0, 0];
    for (let it = 0; it < 2; it++) {
        const near = W.cells[cellOf(W, p)].near;
        let moved = false;
        for (const wi of near) {
            const w = W.walls[wi];
            const d = wallDist(w, p, c);
            if (d >= r) continue;
            let dir = V.tangent(p, [p[0] - c[0], p[1] - c[1], p[2] - c[2]]);
            if (V.len(dir) < 1e-9) dir = V.tangent(p, V.scale(w.n, V.dot(p, w.n) >= 0 ? 1 : -1));
            dir = V.norm(dir);
            p = V.norm(V.madd(p, dir, r - d));
            hit = moved = true;
        }
        if (!moved) break;
    }
    return [p, hit];
}

/** Does a point at p touch a wall (with an extra radius in world units)? */
export function inWall(W, p, rad) {
    const r = (rad + WALL.half) / W.R;
    for (const wi of W.cells[cellOf(W, p)].near) if (wallDist(W.walls[wi], p) < r) return true;
    return false;
}

/** Is the great-circle line from p to q clear of walls, and no longer than maxWorld? */
export function los(W, p, q, maxWorld = Infinity) {
    const ang = V.arc(p, q);
    const dist = ang * W.R;
    if (dist > maxWorld) return false;
    const n = Math.ceil(dist / 0.4);
    if (n <= 1) return true;
    const d = V.toward(p, q);
    for (let i = 1; i < n; i++) {
        const t = (ang * i) / n;
        const c = Math.cos(t), s = Math.sin(t);
        const pt = [p[0] * c + d[0] * s, p[1] * c + d[1] * s, p[2] * c + d[2] * s];
        if (inWall(W, pt, -0.02)) return false;
    }
    return true;
}

// Route finding over the island for the bot (and the tests that prove a place is or isn't
// reachable). A 2 m grid of where a body can stand, with up-slopes limited the way the real
// mover limits them, rebuilt whenever a gate, a bridge or a wall changes. Pure.

import { PLAYER } from '../config.js';
import { worldOf } from './util.js';
import { supportAt, collide } from './body.js';

export const CELL = 2;
const N = 214;                       // cells per side, centred on the origin
const OFF = (N * CELL) / 2;
const FLAGS = ['bridge', 'iceWall', 'thornGap', 'gate', 'door'];

const cache = new Map();

export function navGrid(G) {
    const sig = G.seed + ':' + FLAGS.map((f) => (G.flags[f] ? 1 : 0)).join('');
    if (cache.has(sig)) return cache.get(sig);
    const W = worldOf(G);
    const h = new Float32Array(N * N);
    const ok = new Uint8Array(N * N);
    for (let j = 0; j < N; j++) for (let i = 0; i < N; i++) {
        const x = i * CELL - OFF + CELL / 2, z = j * CELL - OFF + CELL / 2;
        const t = W.height(x, z);
        const g = supportAt(G, x, z, t + 3.0, false);   // low platforms (the bridge) count; the gallery doesn't
        h[j * N + i] = g;
        const w = W.water(x, z, W.height(x, z));
        if (w && w.level - g > PLAYER.wade - 0.15) continue;
        const c = collide(G, x, z, PLAYER.radius + 0.12, g);
        if (Math.hypot(c.x - x, c.z - z) > 0.05) continue;
        ok[j * N + i] = 1;
    }
    const grid = { h, ok, sig };
    cache.set(sig, grid);
    if (cache.size > 12) cache.delete(cache.keys().next().value);
    return grid;
}

export const toCell = (x, z) => [Math.floor((x + OFF) / CELL), Math.floor((z + OFF) / CELL)];
export const cellCentre = (i, j) => ({ x: i * CELL - OFF + CELL / 2, z: j * CELL - OFF + CELL / 2 });
const inside = (i, j) => i >= 0 && j >= 0 && i < N && j < N;

function canStep(grid, a, b, d) {
    if (!grid.ok[b]) return false;
    const rise = grid.h[b] - grid.h[a];
    return rise <= Math.max(PLAYER.stepUp, PLAYER.maxSlope * d * 0.85);
}

/** The nearest standable cell to (x, z) within r cells. */
function nearestOk(grid, x, z, r = 4) {
    const [ci, cj] = toCell(x, z);
    let best = -1, bd = Infinity;
    for (let dj = -r; dj <= r; dj++) for (let di = -r; di <= r; di++) {
        const i = ci + di, j = cj + dj;
        if (!inside(i, j) || !grid.ok[j * N + i]) continue;
        const d = di * di + dj * dj;
        if (d < bd) { bd = d; best = j * N + i; }
    }
    return best;
}

/** A* from (x0, z0) to (x1, z1). Returns a list of {x, z} waypoints, or null. */
export function findPath(G, x0, z0, x1, z1) {
    const grid = navGrid(G);
    const s = nearestOk(grid, x0, z0), t = nearestOk(grid, x1, z1);
    if (s < 0 || t < 0) return null;
    const ti = t % N, tj = Math.floor(t / N);
    const gsc = new Float32Array(N * N).fill(Infinity);
    const from = new Int32Array(N * N).fill(-1);
    const heap = [];
    const push = (n, f) => {
        heap.push([f, n]);
        let k = heap.length - 1;
        while (k > 0) { const p = (k - 1) >> 1; if (heap[p][0] <= heap[k][0]) break; [heap[p], heap[k]] = [heap[k], heap[p]]; k = p; }
    };
    const pop = () => {
        const top = heap[0], last = heap.pop();
        if (heap.length) {
            heap[0] = last;
            let k = 0;
            for (;;) {
                const l = 2 * k + 1, r = l + 1;
                let m = k;
                if (l < heap.length && heap[l][0] < heap[m][0]) m = l;
                if (r < heap.length && heap[r][0] < heap[m][0]) m = r;
                if (m === k) break;
                [heap[m], heap[k]] = [heap[k], heap[m]]; k = m;
            }
        }
        return top;
    };
    const hEst = (n) => Math.hypot((n % N) - ti, Math.floor(n / N) - tj);
    gsc[s] = 0; push(s, hEst(s));
    const closed = new Uint8Array(N * N);
    const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
    let found = false, iter = 0;
    while (heap.length && iter++ < 200000) {
        const [, n] = pop();
        if (closed[n]) continue;
        closed[n] = 1;
        if (n === t) { found = true; break; }
        const i = n % N, j = Math.floor(n / N);
        for (const [di, dj, c] of DIRS) {
            const ni = i + di, nj = j + dj;
            if (!inside(ni, nj)) continue;
            const m = nj * N + ni;
            if (closed[m] || !canStep(grid, n, m, c * CELL)) continue;
            if (di && dj && (!grid.ok[j * N + ni] || !grid.ok[nj * N + i])) continue;
            const g = gsc[n] + c;
            if (g < gsc[m]) { gsc[m] = g; from[m] = n; push(m, g + hEst(m)); }
        }
    }
    if (!found) return null;
    const cells = [];
    for (let n = t; n >= 0; n = from[n]) cells.push(n);
    cells.reverse();
    // string-pull: skip waypoints while a straight walk between cells stays on standable ground
    const pts = cells.map((n) => cellCentre(n % N, Math.floor(n / N)));
    const out = [pts[0]];
    let a = 0;
    while (a < pts.length - 1) {
        let b = Math.min(pts.length - 1, a + 12);
        while (b > a + 1 && !straight(grid, cells[a], cells[b])) b--;
        out.push(pts[b]);
        a = b;
    }
    out.push({ x: x1, z: z1 });
    return out;
}

function straight(grid, a, b) {
    const ai = a % N, aj = Math.floor(a / N), bi = b % N, bj = Math.floor(b / N);
    const steps = Math.max(Math.abs(bi - ai), Math.abs(bj - aj)) * 2;
    let prev = a;
    for (let k = 1; k <= steps; k++) {
        const i = Math.round(ai + ((bi - ai) * k) / steps), j = Math.round(aj + ((bj - aj) * k) / steps);
        const n = j * N + i;
        if (n === prev) continue;
        if (!canStep(grid, prev, n, CELL)) return false;
        prev = n;
    }
    return true;
}

/** Every cell reachable on foot from (x, z): for the tests that prove the gates hold. */
export function reachable(G, x, z) {
    const grid = navGrid(G);
    const s = nearestOk(grid, x, z);
    const seen = new Uint8Array(N * N);
    const q = [s]; seen[s] = 1;
    while (q.length) {
        const n = q.pop();
        const i = n % N, j = Math.floor(n / N);
        for (const [di, dj] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const ni = i + di, nj = j + dj;
            if (!inside(ni, nj)) continue;
            const m = nj * N + ni;
            if (!seen[m] && canStep(grid, n, m, CELL)) { seen[m] = 1; q.push(m); }
        }
    }
    return (px, pz) => { const [i, j] = toCell(px, pz); return inside(i, j) && !!seen[j * N + i]; };
}

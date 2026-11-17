// lib/core/grid.js — searches over a w×h tile grid: flood fill, BFS distance fields, A*.
// Pure. Cells are indices i = y * w + x; the caller says which are passable.
//
// About twenty games carry their own BFS "reachable" proof and sixteen their own A*; these are the
// shared shapes of those (game-062's heap A*, game-106's flow field, the reachability tests).
//
//   import { distanceField, astar } from '../../lib/core/grid.js';
//   const field = distanceField(w, h, (x, y) => map[y * w + x] !== WALL, [[px, py]]);

export const DIRS4 = [[1, 0], [-1, 0], [0, 1], [0, -1]];
export const DIRS8 = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

/** A binary min-heap of values with numeric priorities. */
export class MinHeap {
    constructor() { this.v = []; this.p = []; }
    get size() { return this.v.length; }
    push(value, priority) {
        const v = this.v, p = this.p;
        v.push(value); p.push(priority);
        let i = v.length - 1;
        while (i > 0) {
            const j = (i - 1) >> 1;
            if (p[j] <= p[i]) break;
            [v[i], v[j]] = [v[j], v[i]]; [p[i], p[j]] = [p[j], p[i]]; i = j;
        }
    }
    pop() {
        const v = this.v, p = this.p;
        const top = v[0];
        const lv = v.pop(), lp = p.pop();
        if (v.length) {
            v[0] = lv; p[0] = lp;
            let i = 0;
            for (;;) {
                const l = i * 2 + 1, r = l + 1;
                let m = i;
                if (l < v.length && p[l] < p[m]) m = l;
                if (r < v.length && p[r] < p[m]) m = r;
                if (m === i) break;
                [v[i], v[m]] = [v[m], v[i]]; [p[i], p[m]] = [p[m], p[i]]; i = m;
            }
        }
        return top;
    }
}

const dirsOf = (diagonal) => (diagonal ? DIRS8 : DIRS4);
/** A diagonal step may not cut the corner of a blocked tile. */
const cornerOk = (passable, x, y, dx, dy) => !dx || !dy || (passable(x + dx, y) && passable(x, y + dy));

/**
 * Breadth-first steps from every start to every cell. Returns an Int32Array with -1 where a cell
 * can't be reached. Use it as a flow field (step downhill) or as a reachability proof.
 */
export function distanceField(w, h, passable, starts, { diagonal = false } = {}) {
    const dist = new Int32Array(w * h).fill(-1);
    const queue = new Int32Array(w * h);
    let head = 0, tail = 0;
    for (const [x, y] of starts) {
        if (x < 0 || y < 0 || x >= w || y >= h) continue;
        const i = y * w + x;
        if (dist[i] < 0) { dist[i] = 0; queue[tail++] = i; }
    }
    const dirs = dirsOf(diagonal);
    while (head < tail) {
        const c = queue[head++], x = c % w, y = (c - x) / w;
        for (const [dx, dy] of dirs) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            const n = ny * w + nx;
            if (dist[n] >= 0 || !passable(nx, ny) || (diagonal && !cornerOk(passable, x, y, dx, dy))) continue;
            dist[n] = dist[c] + 1;
            queue[tail++] = n;
        }
    }
    return dist;
}

/** Can (tx, ty) be reached from (sx, sy)? */
export function reachable(w, h, passable, sx, sy, tx, ty, opts) {
    return distanceField(w, h, passable, [[sx, sy]], opts)[ty * w + tx] >= 0;
}

/** Every cell connected to (sx, sy), as a Uint8Array mask, plus its size. */
export function floodFill(w, h, passable, sx, sy, opts) {
    const dist = distanceField(w, h, passable, [[sx, sy]], opts);
    const mask = new Uint8Array(w * h);
    let count = 0;
    for (let i = 0; i < dist.length; i++) if (dist[i] >= 0) { mask[i] = 1; count++; }
    return { mask, count };
}

/** The neighbour of (x, y) that is one step closer on a distance field, or null at a start/dead end. */
export function downhill(field, w, h, x, y, { diagonal = false } = {}) {
    const here = field[y * w + x];
    let best = null, bd = here < 0 ? Infinity : here;
    for (const [dx, dy] of dirsOf(diagonal)) {
        const nx = x + dx, ny = y + dy;
        if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
        const d = field[ny * w + nx];
        if (d >= 0 && d < bd) { bd = d; best = [nx, ny]; }
    }
    return best;
}

/**
 * A* from (sx, sy) to (tx, ty). Returns [[x, y], ...] excluding the start, [] when already there,
 * or null when no path exists. With `nearest`, an unreachable goal paths to the closest reachable cell.
 * `cost(x, y)` is the price of entering a cell (default 1); diagonal steps cost √2 times that.
 */
export function astar(w, h, passable, sx, sy, tx, ty, { diagonal = false, cost = null, maxNodes = 20000, nearest = false } = {}) {
    if (sx === tx && sy === ty) return [];
    const g = new Float64Array(w * h).fill(Infinity);
    const from = new Int32Array(w * h).fill(-1);
    const closed = new Uint8Array(w * h);
    const si = sy * w + sx, ti = ty * w + tx;
    const H = diagonal
        ? (x, y) => { const dx = Math.abs(x - tx), dy = Math.abs(y - ty); return Math.max(dx, dy) + (Math.SQRT2 - 1) * Math.min(dx, dy); }
        : (x, y) => Math.abs(x - tx) + Math.abs(y - ty);
    const open = new MinHeap();
    g[si] = 0;
    open.push(si, H(sx, sy));
    let best = si, bestH = H(sx, sy), n = 0, found = false;
    const dirs = dirsOf(diagonal);
    while (open.size && n++ < maxNodes) {
        const i = open.pop();
        if (closed[i]) continue;
        closed[i] = 1;
        if (i === ti) { found = true; break; }
        const x = i % w, y = (i - x) / w;
        const hh = H(x, y);
        if (hh < bestH) { bestH = hh; best = i; }
        for (const [dx, dy] of dirs) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            const j = ny * w + nx;
            if (closed[j] || !passable(nx, ny) || (diagonal && !cornerOk(passable, x, y, dx, dy))) continue;
            const step = (cost ? cost(nx, ny) : 1) * (dx && dy ? Math.SQRT2 : 1);
            const ng = g[i] + step;
            if (ng < g[j]) { g[j] = ng; from[j] = i; open.push(j, ng + H(nx, ny)); }
        }
    }
    const end = found ? ti : nearest && best !== si ? best : -1;
    if (end < 0) return null;
    const out = [];
    for (let i = end; i !== si; i = from[i]) out.push([i % w, (i / w) | 0]);
    return out.reverse();
}

/** Cells on the line from (x0, y0) to (x1, y1), both ends included (Bresenham). */
export function lineCells(x0, y0, x1, y1) {
    const out = [];
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy;
    for (;;) {
        out.push([x0, y0]);
        if (x0 === x1 && y0 === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x0 += sx; }
        if (e2 <= dx) { err += dx; y0 += sy; }
    }
    return out;
}

/** Is there a clear line of sight between two cells? `opaque(x, y)` blocks it; the ends never do. */
export function lineOfSight(opaque, x0, y0, x1, y1) {
    const cells = lineCells(x0, y0, x1, y1);
    for (let k = 1; k < cells.length - 1; k++) if (opaque(cells[k][0], cells[k][1])) return false;
    return true;
}

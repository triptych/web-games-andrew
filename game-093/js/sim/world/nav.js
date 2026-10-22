// Pathfinding on a map grid. Used by world generation (roads), by the quest hints and by the bot.

import { blockedAt, hgtAt } from './tiles.js';

class Heap {
    constructor() { this.a = []; }
    get size() { return this.a.length; }
    push(item, pri) {
        const a = this.a; a.push([pri, item]);
        let i = a.length - 1;
        while (i > 0) { const p = (i - 1) >> 1; if (a[p][0] <= a[i][0]) break; [a[p], a[i]] = [a[i], a[p]]; i = p; }
    }
    pop() {
        const a = this.a, top = a[0], last = a.pop();
        if (a.length) {
            a[0] = last; let i = 0;
            for (;;) {
                const l = i * 2 + 1, r = l + 1; let m = i;
                if (l < a.length && a[l][0] < a[m][0]) m = l;
                if (r < a.length && a[r][0] < a[m][0]) m = r;
                if (m === i) break;
                [a[m], a[i]] = [a[i], a[m]]; i = m;
            }
        }
        return top[1];
    }
}

/**
 * Generic A*. cost(x, y, fx, fy) returns the price of stepping into (x, y) from (fx, fy), or Infinity.
 * Moves are 8-way (diagonals only when both neighbours are open) unless opts.four is set.
 */
export function astar(w, h, sx, sy, gx, gy, cost, opts = {}) {
    const N = w * h, g = new Float32Array(N).fill(Infinity), from = new Int32Array(N).fill(-1), closed = new Uint8Array(N);
    const heap = new Heap();
    const si = sy * w + sx, gi = gy * w + gx;
    g[si] = 0; heap.push(si, 0);
    const dirs = opts.four ? [[1, 0], [-1, 0], [0, 1], [0, -1]] : [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];
    let guard = 0;
    while (heap.size && guard++ < N * 8) {
        const ci = heap.pop();
        if (closed[ci]) continue;
        closed[ci] = 1;
        if (ci === gi) break;
        const cx = ci % w, cy = (ci / w) | 0;
        for (const [dx, dy] of dirs) {
            const nx = cx + dx, ny = cy + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            const ni = ny * w + nx;
            if (closed[ni]) continue;
            let c = cost(nx, ny, cx, cy);
            if (!(c < Infinity)) continue;
            if (dx && dy) {
                if (!(cost(cx + dx, cy, cx, cy) < Infinity) || !(cost(cx, cy + dy, cx, cy) < Infinity)) continue;
                c *= 1.4142;
            }
            const ng = g[ci] + c;
            if (ng < g[ni]) {
                g[ni] = ng; from[ni] = ci;
                const hh = Math.hypot(nx - gx, ny - gy);
                heap.push(ni, ng + hh);
            }
        }
    }
    if (!closed[gi] && from[gi] < 0 && si !== gi) return null;
    const path = [];
    for (let i = gi; i >= 0; i = from[i]) { path.push([i % w, (i / w) | 0]); if (i === si) break; }
    return path.reverse();
}

/** Can a walker step between two adjacent tiles? (height steps of more than one level are cliffs) */
export function canStep(map, fx, fy, tx, ty, locks) {
    if (blockedAt(map, tx, ty)) return false;
    if (Math.abs(hgtAt(map, tx, ty) - hgtAt(map, fx, fy)) > 1) return false;
    if (locks && locks[ty * map.w + tx]) return false;
    return true;
}

/** A path for walking, honouring cliffs, props and closed gates. */
export function walkPath(map, sx, sy, gx, gy, locks) {
    sx |= 0; sy |= 0;
    const near = (x, y) => (blockedAt(map, x + 1, y) ? 0.5 : 0) + (blockedAt(map, x - 1, y) ? 0.5 : 0) + (blockedAt(map, x, y + 1) ? 0.5 : 0) + (blockedAt(map, x, y - 1) ? 0.5 : 0);
    const cost = (x, y, fx, fy) => (canStep(map, fx, fy, x, y, locks) ? 1 + near(x, y) : (x === gx && y === gy && !blockedAt(map, x, y) ? 1 : Infinity));
    return astar(map.w, map.h, sx, sy, gx, gy, cost, { four: true });
}

/** Flood fill reachable tiles from a start (4-way over canStep). */
export function reach(map, sx, sy, locks) {
    const seen = new Uint8Array(map.w * map.h);
    const q = [[sx | 0, sy | 0]]; seen[(sy | 0) * map.w + (sx | 0)] = 1;
    for (let i = 0; i < q.length; i++) {
        const [x, y] = q[i];
        for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= map.w || ny >= map.h || seen[ny * map.w + nx]) continue;
            if (!canStep(map, x, y, nx, ny, locks)) continue;
            seen[ny * map.w + nx] = 1; q.push([nx, ny]);
        }
    }
    return seen;
}

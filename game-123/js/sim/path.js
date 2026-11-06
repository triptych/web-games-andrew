// A* over the cell grid. Pure. Used to generate commissions, to let a client follow the chart,
// and to let the bot explore. costFn(i) is the price of entering cell i (≥ 1, or Infinity).

export const SQRT2 = Math.SQRT2;

class Heap {
    constructor() { this.f = []; this.v = []; }
    get size() { return this.v.length; }
    push(f, v) {
        let i = this.v.length;
        this.f.push(f); this.v.push(v);
        while (i > 0) {
            const p = (i - 1) >> 1;
            if (this.f[p] <= f) break;
            this.f[i] = this.f[p]; this.v[i] = this.v[p];
            i = p;
        }
        this.f[i] = f; this.v[i] = v;
    }
    pop() {
        const top = this.v[0];
        const lf = this.f.pop(), lv = this.v.pop();
        const n = this.v.length;
        if (n) {
            let i = 0;
            for (;;) {
                let c = i * 2 + 1;
                if (c >= n) break;
                if (c + 1 < n && this.f[c + 1] < this.f[c]) c++;
                if (this.f[c] >= lf) break;
                this.f[i] = this.f[c]; this.v[i] = this.v[c];
                i = c;
            }
            this.f[i] = lf; this.v[i] = lv;
        }
        return top;
    }
}

const DIRS = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

/**
 * Cheapest path from (sx, sy) to (gx, gy) on a w×h grid, eight ways, never squeezing diagonally past
 * an impassable cell. The start and goal cells are always enterable. Returns { path: [[x, y], …], cost } or null.
 */
export function astar(w, h, costFn, sx, sy, gx, gy) {
    const N = w * h;
    const start = sy * w + sx, goal = gy * w + gx;
    const g = new Float32Array(N).fill(Infinity);
    const from = new Int32Array(N).fill(-1);
    const closed = new Uint8Array(N);
    const heap = new Heap();
    const cost = (i) => (i === goal || i === start ? 1 : costFn(i));
    const hh = (x, y) => {
        const dx = Math.abs(x - gx), dy = Math.abs(y - gy);
        return (dx + dy) + (SQRT2 - 2) * Math.min(dx, dy);
    };
    g[start] = 0;
    heap.push(hh(sx, sy), start);
    while (heap.size) {
        const cur = heap.pop();
        if (closed[cur]) continue;
        closed[cur] = 1;
        if (cur === goal) break;
        const cx = cur % w, cy = (cur / w) | 0;
        for (const [dx, dy] of DIRS) {
            const nx = cx + dx, ny = cy + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            const ni = ny * w + nx;
            if (closed[ni]) continue;
            const c = cost(ni);
            if (c === Infinity) continue;
            if (dx && dy && (cost(cy * w + nx) === Infinity || cost(ny * w + cx) === Infinity)) continue;
            const ng = g[cur] + c * (dx && dy ? SQRT2 : 1);
            if (ng < g[ni]) {
                g[ni] = ng; from[ni] = cur;
                heap.push(ng + hh(nx, ny), ni);
            }
        }
    }
    if (g[goal] === Infinity) return null;
    const path = [];
    for (let i = goal; i !== -1; i = from[i]) path.push([i % w, (i / w) | 0]);
    path.reverse();
    return { path, cost: g[goal] };
}

/** The price of walking an existing path (not counting the first cell), by the same rules as astar. */
export function pathCost(w, costFn, path) {
    let total = 0;
    for (let k = 1; k < path.length; k++) {
        const [x, y] = path[k], [px, py] = path[k - 1];
        const c = costFn(y * w + x);
        if (c === Infinity) return Infinity;
        total += c * (x !== px && y !== py ? SQRT2 : 1);
    }
    return total;
}

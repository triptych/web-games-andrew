// ============================================================
// Grid helpers: a binary heap A*, flood fill.
// ============================================================

class Heap {
    constructor() { this.a = []; this.p = []; }
    push(v, pri) {
        const a = this.a, p = this.p;
        a.push(v); p.push(pri);
        let i = a.length - 1;
        while (i > 0) {
            const j = (i - 1) >> 1;
            if (p[j] <= p[i]) break;
            [a[i], a[j]] = [a[j], a[i]]; [p[i], p[j]] = [p[j], p[i]];
            i = j;
        }
    }
    pop() {
        const a = this.a, p = this.p;
        const top = a[0];
        const lv = a.pop(), lp = p.pop();
        if (a.length) {
            a[0] = lv; p[0] = lp;
            let i = 0;
            for (;;) {
                const l = i * 2 + 1, r = l + 1;
                let m = i;
                if (l < a.length && p[l] < p[m]) m = l;
                if (r < a.length && p[r] < p[m]) m = r;
                if (m === i) break;
                [a[i], a[m]] = [a[m], a[i]]; [p[i], p[m]] = [p[m], p[i]];
                i = m;
            }
        }
        return top;
    }
    get size() { return this.a.length; }
}

/**
 * A* on a W×H grid. cost(i) returns the cost to ENTER tile i, or Infinity.
 * Returns an array of tile indices from start to goal (inclusive) or null.
 */
export function astar(W, H, start, goal, cost, maxNodes = 200000) {
    const N = W * H;
    const g = new Float64Array(N).fill(Infinity);
    const from = new Int32Array(N).fill(-1);
    const closed = new Uint8Array(N);
    const gx = goal % W, gy = (goal / W) | 0;
    const h = i => Math.abs((i % W) - gx) + Math.abs(((i / W) | 0) - gy);
    const open = new Heap();
    g[start] = 0; open.push(start, h(start));
    let n = 0;
    while (open.size && n++ < maxNodes) {
        const cur = open.pop();
        if (cur === goal) break;
        if (closed[cur]) continue;
        closed[cur] = 1;
        const cx = cur % W, cy = (cur / W) | 0;
        for (let d = 0; d < 4; d++) {
            const nx = cx + (d === 0 ? 1 : d === 1 ? -1 : 0), ny = cy + (d === 2 ? 1 : d === 3 ? -1 : 0);
            if (nx < 0 || ny < 0 || nx >= W || ny >= H) continue;
            const ni = ny * W + nx;
            if (closed[ni]) continue;
            const c = ni === goal ? 1 : cost(ni);
            if (!isFinite(c)) continue;
            const ng = g[cur] + c;
            if (ng < g[ni]) { g[ni] = ng; from[ni] = cur; open.push(ni, ng + h(ni)); }
        }
    }
    if (from[goal] < 0 && goal !== start) return null;
    const path = [];
    for (let i = goal; i >= 0; i = from[i]) { path.push(i); if (i === start) break; }
    return path.reverse();
}

/** 4-neighbour flood fill from start. pass(i) → boolean. Returns Uint8Array of reached tiles. */
export function flood(W, H, starts, pass) {
    const seen = new Uint8Array(W * H);
    const q = [];
    for (const s of [].concat(starts)) { if (!seen[s]) { seen[s] = 1; q.push(s); } }
    for (let qi = 0; qi < q.length; qi++) {
        const cur = q[qi];
        const x = cur % W, y = (cur / W) | 0;
        if (x > 0) tryAdd(cur - 1);
        if (x < W - 1) tryAdd(cur + 1);
        if (y > 0) tryAdd(cur - W);
        if (y < H - 1) tryAdd(cur + W);
    }
    function tryAdd(i) { if (!seen[i] && pass(i)) { seen[i] = 1; q.push(i); } }
    return seen;
}

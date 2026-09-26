/**
 * walk.js — where Rowan can stand, and how to get from here to there.
 *
 * A scene describes its floor as polygons (areas) minus polygons (blockers).
 * Those are rasterised into a 2px grid once, and paths are found with A* on
 * the grid and then string-pulled (line-of-sight smoothing) so Rowan walks in
 * straight lines rather than staircase steps.
 */

export const CELL = 2;
const GW = 320 / CELL, GH = 200 / CELL;

export function pointInPoly(x, y, pts) {
    let inside = false;
    for (let i = 0, j = pts.length - 1; i < pts.length; j = i++) {
        const [xi, yi] = pts[i], [xj, yj] = pts[j];
        if ((yi > y) !== (yj > y) && x < (xj - xi) * (y - yi) / (yj - yi) + xi) inside = !inside;
    }
    return inside;
}

/** Hotspot shape test. A shape is {rect:[x,y,w,h]} or {poly:[[x,y],...]}. */
export function inShape(x, y, s) {
    if (s.rect) {
        const [rx, ry, rw, rh] = s.rect;
        return x >= rx && x < rx + rw && y >= ry && y < ry + rh;
    }
    if (s.poly) return pointInPoly(x, y, s.poly);
    if (s.circle) {
        const [cx, cy, r] = s.circle;
        return (x - cx) ** 2 + (y - cy) ** 2 <= r * r;
    }
    return false;
}

export class WalkMap {
    constructor(areas, blockers = []) {
        this.grid = new Uint8Array(GW * GH);
        for (let gy = 0; gy < GH; gy++) {
            for (let gx = 0; gx < GW; gx++) {
                const x = gx * CELL + CELL / 2, y = gy * CELL + CELL / 2;
                let ok = areas.some(p => pointInPoly(x, y, p));
                if (ok && blockers.some(p => pointInPoly(x, y, p))) ok = false;
                this.grid[gy * GW + gx] = ok ? 1 : 0;
            }
        }
    }

    ok(gx, gy) {
        return gx >= 0 && gy >= 0 && gx < GW && gy < GH && this.grid[gy * GW + gx] === 1;
    }

    walkable(x, y) { return this.ok((x / CELL) | 0, (y / CELL) | 0); }

    /** Closest walkable cell centre to (x, y), searching outward in rings. */
    nearest(x, y) {
        const cx = Math.max(0, Math.min(GW - 1, (x / CELL) | 0));
        const cy = Math.max(0, Math.min(GH - 1, (y / CELL) | 0));
        if (this.ok(cx, cy)) return [x, y];
        let best = null, bd = Infinity;
        for (let r = 1; r < Math.max(GW, GH); r++) {
            for (let dy = -r; dy <= r; dy++) {
                for (let dx = -r; dx <= r; dx++) {
                    if (Math.abs(dx) !== r && Math.abs(dy) !== r) continue;
                    const gx = cx + dx, gy = cy + dy;
                    if (!this.ok(gx, gy)) continue;
                    const d = dx * dx + dy * dy;
                    if (d < bd) { bd = d; best = [gx * CELL + CELL / 2, gy * CELL + CELL / 2]; }
                }
            }
            if (best) return best;
        }
        return [x, y];
    }

    /** Straight segment stays on walkable cells? */
    clear(x1, y1, x2, y2) {
        const steps = Math.ceil(Math.hypot(x2 - x1, y2 - y1)) + 1;
        for (let i = 0; i <= steps; i++) {
            const t = i / steps;
            if (!this.walkable(x1 + (x2 - x1) * t, y1 + (y2 - y1) * t)) return false;
        }
        return true;
    }

    /** Waypoints from `from` to (the nearest walkable point to) `to`. */
    path(from, to) {
        const start = this.nearest(from[0], from[1]);
        const goal = this.nearest(to[0], to[1]);
        if (this.clear(start[0], start[1], goal[0], goal[1])) return [goal];

        const sx = (start[0] / CELL) | 0, sy = (start[1] / CELL) | 0;
        const tx = (goal[0] / CELL) | 0, ty = (goal[1] / CELL) | 0;
        const N = GW * GH;
        const gScore = new Float32Array(N).fill(Infinity);
        const came = new Int32Array(N).fill(-1);
        const closed = new Uint8Array(N);
        const heap = new MinHeap();
        const s = sy * GW + sx, t = ty * GW + tx;
        gScore[s] = 0;
        heap.push(s, 0);
        const DIRS = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.414], [1, -1, 1.414], [-1, 1, 1.414], [-1, -1, 1.414]];
        let found = false;
        // If the goal is walkable but unreachable (something blocks the way),
        // settle for the explored cell closest to it rather than walking
        // straight through the obstacle.
        let best = s, bestH = Infinity;
        while (heap.size) {
            const cur = heap.pop();
            if (cur === t) { found = true; break; }
            if (closed[cur]) continue;
            closed[cur] = 1;
            const cx = cur % GW, cy = (cur / GW) | 0;
            const hh = Math.hypot(tx - cx, ty - cy);
            if (hh < bestH) { bestH = hh; best = cur; }
            for (const [dx, dy, cost] of DIRS) {
                const nx = cx + dx, ny = cy + dy;
                if (!this.ok(nx, ny)) continue;
                // No corner-cutting through a blocked diagonal.
                if (dx && dy && (!this.ok(cx + dx, cy) || !this.ok(cx, cy + dy))) continue;
                const n = ny * GW + nx;
                const g = gScore[cur] + cost;
                if (g < gScore[n]) {
                    gScore[n] = g;
                    came[n] = cur;
                    const h = Math.hypot(tx - nx, ty - ny);
                    heap.push(n, g + h);
                }
            }
        }
        const end = found ? t : best;
        const cells = [];
        for (let c = end; c !== -1; c = came[c]) cells.push(c);
        cells.reverse();
        const pts = cells.map(c => [(c % GW) * CELL + CELL / 2, ((c / GW) | 0) * CELL + CELL / 2]);
        if (found) pts[pts.length - 1] = goal;
        if (pts.length < 2) return pts.length ? [pts[0]] : [];

        // String-pull: from each anchor, jump to the furthest visible point.
        const out = [];
        let anchor = start, i = 0;
        while (i < pts.length - 1) {
            let j = pts.length - 1;
            while (j > i + 1 && !this.clear(anchor[0], anchor[1], pts[j][0], pts[j][1])) j--;
            out.push(pts[j]);
            anchor = pts[j];
            i = j;
        }
        if (!out.length) out.push(goal);
        return out;
    }
}

class MinHeap {
    constructor() { this.k = []; this.p = []; }
    get size() { return this.k.length; }
    push(k, p) {
        this.k.push(k); this.p.push(p);
        let i = this.k.length - 1;
        while (i > 0) {
            const q = (i - 1) >> 1;
            if (this.p[q] <= this.p[i]) break;
            this._swap(i, q); i = q;
        }
    }
    pop() {
        const top = this.k[0];
        const lk = this.k.pop(), lp = this.p.pop();
        if (this.k.length) {
            this.k[0] = lk; this.p[0] = lp;
            let i = 0;
            for (;;) {
                const l = i * 2 + 1, r = l + 1;
                let m = i;
                if (l < this.k.length && this.p[l] < this.p[m]) m = l;
                if (r < this.k.length && this.p[r] < this.p[m]) m = r;
                if (m === i) break;
                this._swap(i, m); i = m;
            }
        }
        return top;
    }
    _swap(a, b) {
        [this.k[a], this.k[b]] = [this.k[b], this.k[a]];
        [this.p[a], this.p[b]] = [this.p[b], this.p[a]];
    }
}

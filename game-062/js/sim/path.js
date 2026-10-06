// A* for the hero's click-to-move, and a Dijkstra flow field toward the hero that every
// chasing monster reads (one field per hero tile change instead of one search per monster).

import { walkable, opaque, T } from './tiles.js';

const SQ2 = Math.SQRT2;
const NB = [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, SQ2], [1, -1, SQ2], [-1, 1, SQ2], [-1, -1, SQ2]];

class Heap {
    constructor() { this.a = []; this.p = []; }
    get size() { return this.a.length; }
    push(v, pr) {
        const a = this.a, p = this.p;
        a.push(v); p.push(pr);
        let i = a.length - 1;
        while (i > 0) {
            const j = (i - 1) >> 1;
            if (p[j] <= p[i]) break;
            [a[i], a[j]] = [a[j], a[i]]; [p[i], p[j]] = [p[j], p[i]]; i = j;
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
                [a[i], a[m]] = [a[m], a[i]]; [p[i], p[m]] = [p[m], p[i]]; i = m;
            }
        }
        return top;
    }
}

/** Can an actor step diagonally from (x,y) by (dx,dy) without clipping a corner? */
const diagOk = (map, x, y, dx, dy) => !dx || !dy || (walkable(map.at(x + dx, y)) && walkable(map.at(x, y + dy)));

/**
 * A* from tile (sx,sy) to tile (tx,ty). `blocked(x,y)` adds dynamic obstacles (objects).
 * If the goal is not walkable, paths to the closest reachable tile. Returns [[x,y],...] tile
 * centres excluding the start, or null.
 */
export function findPath(map, sx, sy, tx, ty, blocked = null, maxNodes = 4000) {
    const { w, h } = map;
    if (sx === tx && sy === ty) return [];
    const open = new Heap();
    const g = new Float32Array(w * h).fill(Infinity);
    const from = new Int32Array(w * h).fill(-1);
    const si = sy * w + sx, ti = ty * w + tx;
    g[si] = 0;
    const H = (x, y) => { const dx = Math.abs(x - tx), dy = Math.abs(y - ty); return Math.max(dx, dy) + (SQ2 - 1) * Math.min(dx, dy); };
    open.push(si, H(sx, sy));
    let best = si, bestH = H(sx, sy), n = 0;
    const closed = new Uint8Array(w * h);
    while (open.size && n++ < maxNodes) {
        const i = open.pop();
        if (closed[i]) continue;
        closed[i] = 1;
        if (i === ti) { best = i; break; }
        const x = i % w, y = (i / w) | 0;
        const hh = H(x, y);
        if (hh < bestH) { bestH = hh; best = i; }
        for (const [dx, dy, c] of NB) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            const j = ny * w + nx;
            if (closed[j] || !walkable(map.t[j]) || !diagOk(map, x, y, dx, dy)) continue;
            if (blocked && j !== ti && blocked(nx, ny)) continue;
            const cost = map.t[j] === T.JAM ? c * 2.2 : c;
            const ng = g[i] + cost;
            if (ng < g[j]) { g[j] = ng; from[j] = i; open.push(j, ng + H(nx, ny)); }
        }
    }
    if (best === si) return null;
    const out = [];
    for (let i = best; i !== si && i >= 0; i = from[i]) out.push([i % w + 0.5, ((i / w) | 0) + 0.5]);
    out.reverse();
    return smoothPath(map, sx + 0.5, sy + 0.5, out);
}

/** Drop waypoints that a straight walk can skip (string pulling with a clearance check). */
function smoothPath(map, sx, sy, pts) {
    if (pts.length < 3) return pts;
    const out = [];
    let ax = sx, ay = sy, i = 0;
    while (i < pts.length) {
        let j = pts.length - 1;
        for (; j > i; j--) if (clearLine(map, ax, ay, pts[j][0], pts[j][1], 0.3)) break;
        out.push(pts[j]);
        ax = pts[j][0]; ay = pts[j][1];
        i = j + 1;
    }
    return out;
}

/** Walk the segment in small steps; every sample (and its ±r offsets) must be walkable. */
export function clearLine(map, x0, y0, x1, y1, r = 0) {
    const d = Math.hypot(x1 - x0, y1 - y0);
    const steps = Math.ceil(d / 0.25);
    for (let s = 0; s <= steps; s++) {
        const t = steps ? s / steps : 0;
        const x = x0 + (x1 - x0) * t, y = y0 + (y1 - y0) * t;
        if (!walkable(map.at(Math.floor(x), Math.floor(y)))) return false;
        if (r > 0 && (!walkable(map.at(Math.floor(x + r), Math.floor(y))) || !walkable(map.at(Math.floor(x - r), Math.floor(y)))
            || !walkable(map.at(Math.floor(x), Math.floor(y + r))) || !walkable(map.at(Math.floor(x), Math.floor(y - r))))) return false;
    }
    return true;
}

/**
 * Line of sight for vision and shots: an exact grid traversal (Amanatides–Woo DDA) of every tile
 * the segment crosses, blocked only by opaque tiles (punch and jam don't block). Sampling at
 * fixed steps skipped wall corners that projectiles then hit, so a ranged hero would shoot a
 * corner forever.
 */
export function los(map, x0, y0, x1, y1) {
    let tx = Math.floor(x0), ty = Math.floor(y0);
    const ex = Math.floor(x1), ey = Math.floor(y1);
    const dx = x1 - x0, dy = y1 - y0;
    const sx = dx > 0 ? 1 : -1, sy = dy > 0 ? 1 : -1;
    const tdx = dx !== 0 ? Math.abs(1 / dx) : Infinity, tdy = dy !== 0 ? Math.abs(1 / dy) : Infinity;
    let tmx = dx !== 0 ? (dx > 0 ? tx + 1 - x0 : x0 - tx) * tdx : Infinity;
    let tmy = dy !== 0 ? (dy > 0 ? ty + 1 - y0 : y0 - ty) * tdy : Infinity;
    for (let guard = 0; guard < 400; guard++) {
        if (tx === ex && ty === ey) return true;
        if (Math.min(tmx, tmy) > 1) return true;
        if (Math.abs(tmx - tmy) < 1e-9) {
            // Passing exactly through a corner: both neighbours must be clear.
            if (opaque(map.at(tx + sx, ty)) || opaque(map.at(tx, ty + sy))) return false;
            tx += sx; ty += sy; tmx += tdx; tmy += tdy;
        } else if (tmx < tmy) { tx += sx; tmx += tdx; }
        else { ty += sy; tmy += tdy; }
        if ((tx !== ex || ty !== ey) && opaque(map.at(tx, ty))) return false;
    }
    return true;
}

/** Dijkstra distance field from (sx,sy) out to maxD. Float32Array, Infinity where unreached. */
export function flowField(map, sx, sy, maxD = 34, out = null) {
    const { w, h } = map;
    const d = out && out.length === w * h ? out : new Float32Array(w * h);
    d.fill(Infinity);
    if (sx < 0 || sy < 0 || sx >= w || sy >= h) return d;
    const open = new Heap();
    d[sy * w + sx] = 0;
    open.push(sy * w + sx, 0);
    while (open.size) {
        const i = open.pop();
        const x = i % w, y = (i / w) | 0, di = d[i];
        if (di > maxD) continue;
        for (const [dx, dy, c] of NB) {
            const nx = x + dx, ny = y + dy;
            if (nx < 0 || ny < 0 || nx >= w || ny >= h) continue;
            const j = ny * w + nx;
            if (!walkable(map.t[j]) || !diagOk(map, x, y, dx, dy)) continue;
            const nd = di + c;
            if (nd < d[j]) { d[j] = nd; open.push(j, nd); }
        }
    }
    return d;
}

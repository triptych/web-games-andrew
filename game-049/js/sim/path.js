/**
 * path.js — breadth-first distance maps, travel paths and auto-explore.
 * All 8-directional; diagonal steps may not cut wall corners.
 */

import { DIRS8, TP, T } from './tiles.js';

/** Can an actor step diagonally from (x,y) by (dx,dy)? Not if both orthogonal neighbours are walls. */
export function cornerOk(lv, x, y, dx, dy) {
    if (dx === 0 || dy === 0) return true;
    const a = lv.tiles[y * lv.w + x + dx], b = lv.tiles[(y + dy) * lv.w + x];
    return !(TP[a].opaque && TP[b].opaque);
}

/**
 * Distance map from sources over tiles where ok(i) is true. Unreached = -1.
 * Returns an Int32Array. maxD stops the flood early.
 */
export function distanceMap(lv, sources, ok, maxD = 9999) {
    const { w, h } = lv;
    const D = new Int32Array(w * h).fill(-1);
    const q = new Int32Array(w * h);
    let qh = 0, qt = 0;
    for (const [x, y] of sources) { const i = y * w + x; if (D[i] === -1) { D[i] = 0; q[qt++] = i; } }
    while (qh < qt) {
        const i = q[qh++];
        const d = D[i];
        if (d >= maxD) continue;
        const x = i % w, y = (i / w) | 0;
        for (const [dx, dy] of DIRS8) {
            const X = x + dx, Y = y + dy;
            if (X < 0 || Y < 0 || X >= w || Y >= h) continue;
            const j = Y * w + X;
            if (D[j] !== -1 || !ok(j)) continue;
            if (!cornerOk(lv, x, y, dx, dy)) continue;
            D[j] = d + 1;
            q[qt++] = j;
        }
    }
    return D;
}

/** Walk down a distance map from (x,y): the path of indices to its source (excluding the start). */
export function descend(lv, D, x, y, blockedAt) {
    const path = [];
    let cx = x, cy = y;
    let guard = lv.w * lv.h;
    while (D[cy * lv.w + cx] > 0 && guard-- > 0) {
        let best = null, bd = D[cy * lv.w + cx];
        for (const [dx, dy] of DIRS8) {
            const X = cx + dx, Y = cy + dy;
            if (X < 0 || Y < 0 || X >= lv.w || Y >= lv.h) continue;
            const d = D[Y * lv.w + X];
            if (d < 0 || d >= bd) continue;
            if (!cornerOk(lv, cx, cy, dx, dy)) continue;
            if (blockedAt && path.length === 0 && blockedAt(X, Y)) continue;
            // Prefer orthogonal steps on ties: paths look less zig-zaggy.
            if (d < bd || (best && (dx === 0 || dy === 0))) { bd = d; best = [X, Y]; }
        }
        if (!best) break;
        path.push(best);
        [cx, cy] = best;
    }
    return path;
}

/** Path from (sx,sy) to (tx,ty) through tiles where ok(i); [] if none. */
export function findPath(lv, sx, sy, tx, ty, ok) {
    const D = distanceMap(lv, [[tx, ty]], (i) => ok(i) || i === sy * lv.w + sx);
    if (D[sy * lv.w + sx] < 0) return [];
    return descend(lv, D, sx, sy);
}

/** Is there a straight, unobstructed line of fire (Bresenham) between two tiles? */
export function lineOfFire(lv, x0, y0, x1, y1, blocked) {
    const pts = bresenham(x0, y0, x1, y1);
    for (let k = 1; k < pts.length - 1; k++) {
        const [x, y] = pts[k];
        if (TP[lv.tiles[y * lv.w + x]].opaque || lv.tiles[y * lv.w + x] === T.PILLAR) return false;
        if (blocked && blocked(x, y)) return false;
    }
    return true;
}

export function bresenham(x0, y0, x1, y1) {
    const pts = [];
    const dx = Math.abs(x1 - x0), dy = -Math.abs(y1 - y0);
    const sx = x0 < x1 ? 1 : -1, sy = y0 < y1 ? 1 : -1;
    let err = dx + dy, x = x0, y = y0;
    for (let guard = 0; guard < 200; guard++) {
        pts.push([x, y]);
        if (x === x1 && y === y1) break;
        const e2 = 2 * err;
        if (e2 >= dy) { err += dy; x += sx; }
        if (e2 <= dx) { err += dx; y += sy; }
    }
    return pts;
}

/** A full-length ray from (x0,y0) in direction (dx,dy) until a wall: indices. */
export function ray(lv, x0, y0, dx, dy, maxLen = 99) {
    const out = [];
    let x = x0 + dx, y = y0 + dy;
    for (let k = 0; k < maxLen; k++) {
        if (x < 0 || y < 0 || x >= lv.w || y >= lv.h) break;
        const t = lv.tiles[y * lv.w + x];
        if (TP[t].opaque || t === T.PILLAR) break;
        out.push(y * lv.w + x);
        x += dx; y += dy;
    }
    return out;
}

/**
 * grid.js — the room's tile grid: lookups, circle collision, line of sight
 * and the breadth-first flow field ground enemies follow.
 *
 * Cell (c, r) covers x ∈ [c − 5.5, c − 4.5], y ∈ [r, r + 1].
 * Everything outside the grid reads as ROCK, which makes the room edge a
 * wall for free — except the door gap above the top row once it is open.
 */

import { ROOM } from '../config.js';

export const FLOOR = 0, ROCK = 1, PIT = 2, SPIKE = 3;
const DOOR_C0 = 4, DOOR_C1 = 6;             // columns under the door opening

export function makeGrid(cols, rows) {
    return { cols, rows, cells: new Uint8Array(cols * rows), doorOpen: false };
}

export function cellAt(g, c, r) {
    if (c < 0 || c >= g.cols || r < 0) return ROCK;
    if (r >= g.rows) return (g.doorOpen && r <= g.rows + 2 && c >= DOOR_C0 && c <= DOOR_C1) ? FLOOR : ROCK;
    return g.cells[r * g.cols + c];
}

export const setCell = (g, c, r, v) => { g.cells[r * g.cols + c] = v; };
export const colOf = (x) => Math.floor(x + ROOM.half);
export const rowOf = (y) => Math.floor(y);
export const cellX = (c) => c - ROOM.half + 0.5;
export const cellY = (r) => r + 0.5;

export const walkable = (t) => t === FLOOR || t === SPIKE;
export const blocksShot = (t) => t === ROCK;

/** Is the tile under (x, y) blocking for this mover? */
export function blockedAt(g, x, y, fly) {
    if (fly) return Math.abs(x) > ROOM.half || y < 0 || y > g.rows;
    return !walkable(cellAt(g, colOf(x), rowOf(y)));
}

/**
 * Push a circle (ent.x, ent.y, r) out of every blocking tile it overlaps.
 * Walkers are blocked by rock and pits; flyers only by rock (they cross
 * water and chasms); phasing flyers (ent.phase) only by the room walls.
 */
export function resolveCircle(g, ent, r, fly) {
    if (fly) {
        const lim = ROOM.half - r;
        ent.x = Math.max(-lim, Math.min(lim, ent.x));
        ent.y = Math.max(r, Math.min(g.rows - r, ent.y));
        if (ent.phase) return;              // wraiths drift through walls
    }
    // Never leave the room rectangle (the door gap is the one way out).
    const lim = ROOM.half - r;
    const inDoor = g.doorOpen && Math.abs(ent.x) < 1.5;
    ent.x = Math.max(-lim, Math.min(lim, ent.x));
    ent.y = Math.max(r, Math.min(inDoor ? g.rows + 2 : g.rows - r, ent.y));
    const solid = fly ? (t) => t === ROCK : (t) => !walkable(t);
    for (let pass = 0; pass < 3; pass++) {
        let moved = false;
        const c0 = colOf(ent.x - r), c1 = colOf(ent.x + r);
        const r0 = rowOf(ent.y - r), r1 = rowOf(ent.y + r);
        for (let rr = r0; rr <= r1; rr++) {
            for (let cc = c0; cc <= c1; cc++) {
                if (!solid(cellAt(g, cc, rr))) continue;
                const minX = cc - ROOM.half, minY = rr;
                const px = Math.max(minX, Math.min(ent.x, minX + 1));
                const py = Math.max(minY, Math.min(ent.y, minY + 1));
                let dx = ent.x - px, dy = ent.y - py;
                const d2 = dx * dx + dy * dy;
                if (d2 >= r * r) continue;
                if (d2 > 1e-10) {
                    const d = Math.sqrt(d2), push = r - d;
                    ent.x += (dx / d) * push;
                    ent.y += (dy / d) * push;
                } else {
                    // Centre inside the tile: leave along the shallowest axis.
                    const l = ent.x - minX, rgt = minX + 1 - ent.x, b = ent.y - minY, t = minY + 1 - ent.y;
                    const m = Math.min(l, rgt, b, t);
                    if (m === l) ent.x = minX - r; else if (m === rgt) ent.x = minX + 1 + r;
                    else if (m === b) ent.y = minY - r; else ent.y = minY + 1 + r;
                }
                moved = true;
            }
        }
        if (!moved) break;
    }
}

/** True when a straight segment crosses no tile for which `blocks(tile)` holds. */
export function lineClear(g, x0, y0, x1, y1, blocks = blocksShot) {
    // Exact grid traversal (Amanatides & Woo): visits every tile the segment touches.
    let c = colOf(x0), r = rowOf(y0);
    const c1 = colOf(x1), r1 = rowOf(y1);
    const dx = x1 - x0, dy = y1 - y0;
    const sc = dx > 0 ? 1 : -1, sr = dy > 0 ? 1 : -1;
    const tdx = dx !== 0 ? Math.abs(1 / dx) : Infinity, tdy = dy !== 0 ? Math.abs(1 / dy) : Infinity;
    const gx = x0 + ROOM.half, gy = y0;
    let tmx = dx !== 0 ? (dx > 0 ? (Math.floor(gx) + 1 - gx) : (gx - Math.floor(gx))) * tdx : Infinity;
    let tmy = dy !== 0 ? (dy > 0 ? (Math.floor(gy) + 1 - gy) : (gy - Math.floor(gy))) * tdy : Infinity;
    for (let i = 0; i < 64; i++) {
        if (c === c1 && r === r1) return true;
        if (tmx < tmy) { c += sc; tmx += tdx; } else { r += sr; tmy += tdy; }
        if ((c !== c1 || r !== r1) && blocks(cellAt(g, c, r))) return false;
        if (tmx > 1 && tmy > 1) return true;
    }
    return true;
}

/** Distance a ray travels before entering a rock tile or leaving the room (≤ maxLen). */
export function rayLength(g, x, y, ang, maxLen) {
    const cx = Math.cos(ang), cy = Math.sin(ang);
    for (let d = 0.1; d < maxLen; d += 0.1) {
        const px = x + cx * d, py = y + cy * d;
        if (Math.abs(px) > ROOM.half || py < 0 || py > g.rows) return d;
        if (cellAt(g, colOf(px), rowOf(py)) === ROCK) return d;
    }
    return maxLen;
}

const NB = [[1, 0], [-1, 0], [0, 1], [0, -1], [1, 1], [1, -1], [-1, 1], [-1, -1]];

/**
 * Breadth-first distances (in steps) from (tc, tr) over walkable tiles,
 * 8-connected without cutting corners. Unreached tiles hold 9999.
 * `allow` (optional mask) restricts which tiles may be entered — used for
 * the wide-body field, so big enemies never path into gaps they can't fit.
 */
export const flyable = (t) => t !== ROCK;

export function flowField(g, tc, tr, out, allow = null, pass = walkable) {
    const N = g.cols * g.rows;
    const dist = out && out.length === N ? out : new Int16Array(N);
    dist.fill(9999);
    if (tc < 0 || tc >= g.cols || tr < 0 || tr >= g.rows) return dist;
    const q = new Int32Array(N);
    let head = 0, tail = 0;
    dist[tr * g.cols + tc] = 0;
    q[tail++] = tr * g.cols + tc;
    while (head < tail) {
        const i = q[head++];
        const c = i % g.cols, r = (i / g.cols) | 0;
        const d = dist[i] + 1;
        for (const [dc, dr] of NB) {
            const nc = c + dc, nr = r + dr;
            if (nc < 0 || nc >= g.cols || nr < 0 || nr >= g.rows) continue;
            const j = nr * g.cols + nc;
            if (dist[j] <= d || !pass(g.cells[j]) || (allow && !allow[j])) continue;
            if (dc && dr && (!pass(g.cells[r * g.cols + nc]) || !pass(g.cells[nr * g.cols + c]))) continue;
            dist[j] = d;
            q[tail++] = j;
        }
    }
    return dist;
}

/**
 * Next waypoint (tile centre) downhill on a flow field from (x, y), or null
 * when already at the bottom / off the field.
 */
export function flowStep(g, dist, x, y, pass = walkable) {
    const c = colOf(x), r = rowOf(y);
    if (c < 0 || c >= g.cols || r < 0 || r >= g.rows) return null;
    let best = dist[r * g.cols + c], bc = -1, br = -1;
    for (const [dc, dr] of NB) {
        const nc = c + dc, nr = r + dr;
        if (nc < 0 || nc >= g.cols || nr < 0 || nr >= g.rows) continue;
        const d = dist[nr * g.cols + nc];
        if (dc && dr && (!pass(cellAt(g, c + dc, r)) || !pass(cellAt(g, c, r + dr)))) continue;
        if (d < best) { best = d; bc = nc; br = nr; }
    }
    return bc < 0 ? null : { x: cellX(bc), y: cellY(br) };
}

/**
 * Tiles a wide body (radius over half a tile) can stand on: the tile and all
 * eight neighbours walkable (the room wall counts as fine to lean on).
 */
export function wideTiles(g) {
    const m = new Uint8Array(g.cols * g.rows);
    for (let r = 0; r < g.rows; r++) for (let c = 0; c < g.cols; c++) {
        let ok = true;
        for (let dr = -1; dr <= 1 && ok; dr++) for (let dc = -1; dc <= 1; dc++) {
            const nc = c + dc, nr = r + dr;
            if (nc < 0 || nc >= g.cols || nr < 0) continue;
            if (!walkable(cellAt(g, nc, nr))) { ok = false; break; }
        }
        m[r * g.cols + c] = ok ? 1 : 0;
    }
    return m;
}

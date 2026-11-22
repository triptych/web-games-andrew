// The hex grid the ornaments hang in, and the path of a shot through it. Pure.
//
// Rows alternate: an even row holds COLS ornaments centred at x = c + 0.5, an odd row COLS - 1 centred at x = c + 1.
// "Even" and "odd" are relative to G.par, so endless mode can push a new row in at the top without the rows below
// changing shape. The ceiling sits G.ceil rows down from the top of the field (it drops when the player misses).

import { COLS, ROWS, R, ROW_H, FIELD, HIT_DIST, SHOOTER, AIM_MIN } from '../config.js';

export const odd = (G, r) => ((r + G.par) & 1) === 1;
export const rowLen = (G, r) => (odd(G, r) ? COLS - 1 : COLS);
export const top = (G) => G.ceil * ROW_H;
export const cellX = (G, r, c) => c + (odd(G, r) ? 1 : 0.5);
export const cellY = (G, r) => top(G) + R + r * ROW_H;
export const inside = (G, r, c) => r >= 0 && r < ROWS && c >= 0 && c < rowLen(G, r);
export const at = (G, r, c) => (inside(G, r, c) ? G.grid[r][c] : null);
export const clampAim = (a) => Math.max(AIM_MIN, Math.min(Math.PI - AIM_MIN, a));

export function emptyGrid() {
    return Array.from({ length: ROWS }, () => Array(COLS).fill(null));
}

export function neighbors(G, r, c) {
    const d = odd(G, r) ? [c, c + 1] : [c - 1, c];
    const out = [[r, c - 1], [r, c + 1], [r - 1, d[0]], [r - 1, d[1]], [r + 1, d[0]], [r + 1, d[1]]];
    return out.filter(([a, b]) => inside(G, a, b));
}

/** The grid cell whose centre is nearest (x, y). */
export function cellAt(G, x, y) {
    const r = Math.max(0, Math.min(ROWS - 1, Math.round((y - top(G) - R) / ROW_H)));
    const c = Math.max(0, Math.min(rowLen(G, r) - 1, Math.round(x - (odd(G, r) ? 1 : 0.5))));
    return [r, c];
}

/** Every ball on the board as { r, c, b, x, y }. */
export function balls(G) {
    const out = [];
    for (let r = 0; r < ROWS; r++) {
        const row = G.grid[r];
        for (let c = 0; c < COLS; c++) if (row[c]) out.push({ r, c, b: row[c], x: cellX(G, r, c), y: cellY(G, r) });
    }
    return out;
}

/** Can a ball rest at (r, c)? Empty, and on the ceiling or touching another ball. */
export function canRest(G, r, c) {
    if (!inside(G, r, c) || G.grid[r][c]) return false;
    if (r === 0) return true;
    return neighbors(G, r, c).some(([a, b]) => G.grid[a][b]);
}

/** Where a shot that stopped at (x, y) settles: the nearest cell it can rest in. */
export function snapCell(G, x, y, hit) {
    const [r0, c0] = cellAt(G, x, y);
    const cand = [[r0, c0], ...neighbors(G, r0, c0)];
    if (hit) cand.push(...neighbors(G, hit.r, hit.c));
    let best = null, bd = Infinity;
    const consider = (r, c) => {
        if (!canRest(G, r, c)) return;
        const d = (cellX(G, r, c) - x) ** 2 + (cellY(G, r) - y) ** 2;
        if (d < bd) { bd = d; best = [r, c]; }
    };
    for (const [r, c] of cand) consider(r, c);
    if (!best) for (let r = 0; r < ROWS; r++) for (let c = 0; c < rowLen(G, r); c++) consider(r, c);
    return best;
}

/**
 * The path of a shot fired at `angle` (radians from +x, upward): straight lines, mirrored off the side walls,
 * until it touches a ball or the ceiling. Exact (ray against circle), so the bot, the aim guide and the real
 * flight all agree. With `pierce` (the candy cane) it passes through every ball to the ceiling and lists them.
 */
export function traceShot(G, angle, pierce = false) {
    let x = SHOOTER.x, y = SHOOTER.y;
    let dx = Math.cos(angle), dy = -Math.sin(angle);
    const pts = [{ x, y }];
    const all = balls(G);
    const hits = [];
    const seen = new Set();
    const ceilY = top(G) + R;
    const H2 = HIT_DIST * HIT_DIST;
    let dist = 0;
    for (let seg = 0; seg < 60; seg++) {
        const tw = dx < -1e-12 ? (R - x) / dx : dx > 1e-12 ? (FIELD.w - R - x) / dx : Infinity;
        const tc = dy < -1e-12 ? (ceilY - y) / dy : Infinity;
        let tb = Infinity, hit = null;
        for (const b of all) {
            const fx = x - b.x, fy = y - b.y;
            const bq = fx * dx + fy * dy;
            const cq = fx * fx + fy * fy - H2;
            if (bq > 0 && cq > 0) continue;                  // moving away and outside
            const disc = bq * bq - cq;
            if (disc < 0) continue;
            const t = -bq - Math.sqrt(disc);
            if (pierce) {
                const key = b.r * 64 + b.c;
                if (t > -1e-9 && t < Math.min(tw, tc) && !seen.has(key)) hits.push({ r: b.r, c: b.c, id: b.b.id, d: dist + Math.max(0, t), key });
            } else if (t > -1e-9 && t < tb) { tb = t; hit = b; }
        }
        if (pierce) for (const h of hits) seen.add(h.key);
        const t = Math.max(0, Math.min(tw, tc, tb));
        x += dx * t; y += dy * t; dist += t;
        pts.push({ x, y });
        if (!pierce && hit && tb <= tw && tb <= tc) {
            return { pts, dist, hit: { r: hit.r, c: hit.c }, cell: snapCell(G, x, y, hit), x, y };
        }
        if (tc <= tw) {
            if (pierce) { hits.sort((a, b) => a.d - b.d); return { pts, dist, hits, cell: null, x, y }; }
            return { pts, dist, hit: null, cell: snapCell(G, x, y, null), x, y };
        }
        dx = -dx;                                           // a side wall
        x = Math.max(R, Math.min(FIELD.w - R, x));
    }
    // a near-horizontal shot that never got anywhere (cannot happen with AIM_MIN, but never loop forever)
    return { pts, dist, hit: null, cell: snapCell(G, x, y, null), hits, x, y };
}

/** Position along a traced path, distance s from its start. */
export function pathPos(pts, s) {
    for (let i = 1; i < pts.length; i++) {
        const a = pts[i - 1], b = pts[i];
        const l = Math.hypot(b.x - a.x, b.y - a.y);
        if (s <= l || i === pts.length - 1) {
            const k = l > 0 ? Math.min(1, s / l) : 1;
            return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, seg: i - 1 };
        }
        s -= l;
    }
    return { ...pts[pts.length - 1], seg: pts.length - 2 };
}

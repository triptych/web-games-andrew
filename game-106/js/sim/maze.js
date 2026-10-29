// The electrified maze. Pure. Berzerk built every room the same way: a grid of posts, and from each
// interior post one wall segment running a cell's length in a random direction. Four doors in the
// outer wall are where the robots pour in.

import { FIELD, MAZE } from '../config.js';

const DIRS = [[0, -1], [0, 1], [-1, 0], [1, 0]];

/** Outer walls with a door gap in the middle of each side. */
function outer() {
    const { w: W, h: H } = FIELD;
    const t = MAZE.thick, d = MAZE.door / 2;
    return [
        { x: 0, y: 0, w: W / 2 - d, h: t }, { x: W / 2 + d, y: 0, w: W / 2 - d, h: t },
        { x: 0, y: H - t, w: W / 2 - d, h: t }, { x: W / 2 + d, y: H - t, w: W / 2 - d, h: t },
        { x: 0, y: 0, w: t, h: H / 2 - d }, { x: 0, y: H / 2 + d, w: t, h: H / 2 - d },
        { x: W - t, y: 0, w: t, h: H / 2 - d }, { x: W - t, y: H / 2 + d, w: t, h: H / 2 - d },
    ].map((r) => ({ ...r, outer: true }));
}

/** Build a room. keepClear: circles { x, y, r } no wall may touch (the player, mostly).
 *  A room that seals off a door from the first keepClear point is thrown away and rolled again. */
export function makeMaze(rng, keepClear = []) {
    for (let tries = 0; tries < 12; tries++) {
        const walls = roll(rng, keepClear);
        if (!keepClear.length || allDoorsReachable(walls, keepClear[0].x, keepClear[0].y)) return walls;
    }
    return outer();
}

function roll(rng, keepClear) {
    const walls = outer();
    const cw = FIELD.w / MAZE.cols, ch = FIELD.h / MAZE.rows, t = MAZE.thick;
    for (let j = 1; j < MAZE.rows; j++) {
        for (let i = 1; i < MAZE.cols; i++) {
            const px = i * cw, py = j * ch;
            // try the directions in a seeded order; skip the post if every one would trap someone
            const order = DIRS.slice();
            for (let k = order.length - 1; k > 0; k--) { const m = Math.floor(rng() * (k + 1)); [order[k], order[m]] = [order[m], order[k]]; }
            for (const [dx, dy] of order) {
                const len = dx ? cw : ch;
                const r = dx
                    ? { x: dx > 0 ? px - t / 2 : px - len, y: py - t / 2, w: len + t / 2, h: t }
                    : { x: px - t / 2, y: dy > 0 ? py - t / 2 : py - len, w: t, h: len + t / 2 };
                if (keepClear.some((c) => circleRect(c.x, c.y, c.r, r))) continue;
                walls.push(r);
                break;
            }
        }
    }
    return walls;
}

/** Flood fill on a half-unit grid with a player-sized body: can (sx, sy) reach all four doors? */
export function allDoorsReachable(walls, sx, sy, body = 0.6) {
    const g = 0.5, W = Math.ceil(FIELD.w / g), H = Math.ceil(FIELD.h / g);
    const free = new Uint8Array(W * H);
    for (let j = 0; j < H; j++) for (let i = 0; i < W; i++) {
        const x = (i + 0.5) * g, y = (j + 0.5) * g;
        free[j * W + i] = walls.some((w) => circleRect(x, y, body, w)) ? 0 : 1;
    }
    const seen = new Uint8Array(W * H);
    const start = Math.floor(sy / g) * W + Math.floor(sx / g);
    if (!free[start]) return false;
    const q = [start];
    seen[start] = 1;
    while (q.length) {
        const c = q.pop(), i = c % W, j = (c - i) / W;
        for (const [a, b] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
            const ni = i + a, nj = j + b, n = nj * W + ni;
            if (ni < 0 || nj < 0 || ni >= W || nj >= H || seen[n] || !free[n]) continue;
            seen[n] = 1; q.push(n);
        }
    }
    const at = (x, y) => seen[Math.floor(y / g) * W + Math.floor(x / g)] === 1;
    return at(FIELD.w / 2, 1.25) && at(FIELD.w / 2, FIELD.h - 1.25) && at(1.25, FIELD.h / 2) && at(FIELD.w - 1.25, FIELD.h / 2);
}

/** The four door mouths, just inside the room. */
export function doors() {
    const { w: W, h: H } = FIELD;
    return [{ x: W / 2, y: 0.7, side: 0 }, { x: W / 2, y: H - 0.7, side: 1 }, { x: 0.7, y: H / 2, side: 2 }, { x: W - 0.7, y: H / 2, side: 3 }];
}

// ------------------------------------------------------------------ geometry
export function circleRect(cx, cy, cr, r) {
    const nx = Math.max(r.x, Math.min(cx, r.x + r.w)), ny = Math.max(r.y, Math.min(cy, r.y + r.h));
    return (cx - nx) ** 2 + (cy - ny) ** 2 < cr * cr;
}

/** Push a circle out of a rect. Returns the push { x, y } or null when they don't touch. */
export function pushOut(cx, cy, cr, r) {
    const nx = Math.max(r.x, Math.min(cx, r.x + r.w)), ny = Math.max(r.y, Math.min(cy, r.y + r.h));
    let dx = cx - nx, dy = cy - ny;
    const d2 = dx * dx + dy * dy;
    if (d2 >= cr * cr) return null;
    if (d2 > 1e-9) {
        const d = Math.sqrt(d2), k = (cr - d) / d;
        return { x: dx * k, y: dy * k };
    }
    // centre inside the rect: leave by the nearest side
    const l = cx - r.x, rt = r.x + r.w - cx, tp = cy - r.y, bt = r.y + r.h - cy;
    const m = Math.min(l, rt, tp, bt);
    if (m === l) return { x: -(l + cr), y: 0 };
    if (m === rt) return { x: rt + cr, y: 0 };
    if (m === tp) return { x: 0, y: -(tp + cr) };
    return { x: 0, y: bt + cr };
}

export function pointInRect(x, y, r) { return x >= r.x && x <= r.x + r.w && y >= r.y && y <= r.y + r.h; }

/** Does the segment a→b cross the rect? (slab test) */
export function segRect(ax, ay, bx, by, r) {
    let t0 = 0, t1 = 1;
    const dx = bx - ax, dy = by - ay;
    for (const [p, q] of [[-dx, ax - r.x], [dx, r.x + r.w - ax], [-dy, ay - r.y], [dy, r.y + r.h - ay]]) {
        if (p === 0) { if (q < 0) return false; continue; }
        const u = q / p;
        if (p < 0) { if (u > t1) return false; if (u > t0) t0 = u; } else { if (u < t0) return false; if (u < t1) t1 = u; }
    }
    return true;
}

export function lineOfSight(walls, ax, ay, bx, by) {
    for (const w of walls) if (segRect(ax, ay, bx, by, w)) return false;
    return true;
}

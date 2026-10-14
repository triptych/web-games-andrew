// Billiard physics on a tile grid. Pure: no DOM, no three.js, no randomness.
//
// Bodies are circles { x, y, vx, vy, r, m }. The world is a grid of tiles
// (walls, glass, rails, water…), static circles (palms, pillars, bumpers,
// terminals) and oriented boxes (parked cars, traffic). Every collision is
// reported through the `hooks` object so the world can turn impacts into
// takedowns, noise and broken glass.

import { PHYS, SURFACE } from '../config.js';

export const T = {
    FLOOR: 0, WALL: 1, WALL2: 2, GLASS: 3, CRACK: 4, CRATE: 5, RAIL: 6, WATER: 7, VOID: 8, DOOR: 9, HEDGE: 10, OIL: 11,
};
const SOLID = new Uint8Array(16);
for (const t of [T.WALL, T.WALL2, T.GLASS, T.CRACK, T.CRATE, T.RAIL, T.VOID, T.DOOR]) SOLID[t] = 1;
const OPAQUE = new Uint8Array(16);
for (const t of [T.WALL, T.WALL2, T.CRACK, T.CRATE, T.VOID, T.DOOR]) OPAQUE[t] = 1;

export const isSolid = (t) => SOLID[t] === 1;
export const isOpaque = (t) => OPAQUE[t] === 1;

export function tileAt(S, x, y) {
    const tx = Math.floor(x), ty = Math.floor(y);
    if (tx < 0 || ty < 0 || tx >= S.w || ty >= S.h) return T.VOID;
    return S.tiles[ty * S.w + tx];
}

/** Walkable for guards' pathfinding (not solid, not water, not a hole). */
export function walkable(S, L, tx, ty) {
    if (tx < 0 || ty < 0 || tx >= S.w || ty >= S.h) return false;
    const t = S.tiles[ty * S.w + tx];
    if (SOLID[t] || t === T.WATER) return false;
    if (L.holeAt[ty * S.w + tx]) return false;
    if (L.blockAt[ty * S.w + tx]) return false;
    return true;
}

export function frictionAt(S, L, x, y) {
    const tx = Math.floor(x), ty = Math.floor(y);
    if (tx < 0 || ty < 0 || tx >= S.w || ty >= S.h) return 1;
    const i = ty * S.w + tx;
    const t = S.tiles[i];
    if (t === T.OIL) return SURFACE.oil;
    if (t === T.HEDGE) return SURFACE.hedge;
    return SURFACE[L.floor[i]] ?? 1;
}

// ------------------------------------------------------------------ helpers
function resolveCircleStatic(b, cx, cy, cr, rest, hooks, tag) {
    const dx = b.x - cx, dy = b.y - cy;
    const d2 = dx * dx + dy * dy, rr = b.r + cr;
    if (d2 >= rr * rr || d2 < 1e-12) return false;
    const d = Math.sqrt(d2), nx = dx / d, ny = dy / d;
    b.x = cx + nx * rr; b.y = cy + ny * rr;
    const vn = b.vx * nx + b.vy * ny;
    if (vn < 0) {
        b.vx -= (1 + rest) * vn * nx;
        b.vy -= (1 + rest) * vn * ny;
        if (hooks) hooks.circle?.(b, tag, -vn, nx, ny);
    }
    return true;
}

/** Push a body out of the solid tiles around it. Returns true if it touched any. */
function collideTiles(S, b, hooks) {
    let touched = false;
    for (let iter = 0; iter < 3; iter++) {
        let best = null, bestPen = 0;
        const x0 = Math.floor(b.x - b.r), x1 = Math.floor(b.x + b.r);
        const y0 = Math.floor(b.y - b.r), y1 = Math.floor(b.y + b.r);
        for (let ty = y0; ty <= y1; ty++) {
            for (let tx = x0; tx <= x1; tx++) {
                const t = (tx < 0 || ty < 0 || tx >= S.w || ty >= S.h) ? T.VOID : S.tiles[ty * S.w + tx];
                if (!SOLID[t]) continue;
                const cx = Math.max(tx, Math.min(b.x, tx + 1));
                const cy = Math.max(ty, Math.min(b.y, ty + 1));
                let dx = b.x - cx, dy = b.y - cy;
                let d = Math.hypot(dx, dy), pen, nx, ny;
                if (d < 1e-9) {
                    // centre inside the tile: push out along the shallowest axis
                    const l = b.x - tx, r = tx + 1 - b.x, u = b.y - ty, dn = ty + 1 - b.y;
                    const m = Math.min(l, r, u, dn);
                    if (m === l) { nx = -1; ny = 0; } else if (m === r) { nx = 1; ny = 0; } else if (m === u) { nx = 0; ny = -1; } else { nx = 0; ny = 1; }
                    pen = m + b.r;
                } else {
                    if (d >= b.r) continue;
                    nx = dx / d; ny = dy / d; pen = b.r - d;
                }
                if (pen > bestPen) { bestPen = pen; best = { tx, ty, t, nx, ny, pen }; }
            }
        }
        if (!best) break;
        touched = true;
        const vn = b.vx * best.nx + b.vy * best.ny;
        // A hook may break the tile (glass, cracks, crates) and let the body through.
        if (vn < 0 && hooks?.wall && hooks.wall(b, best.tx, best.ty, best.t, -vn, best.nx, best.ny) === 'break') continue;
        b.x += best.nx * best.pen;
        b.y += best.ny * best.pen;
        if (vn < 0) {
            const rest = PHYS.restWall;
            b.vx -= (1 + rest) * vn * best.nx;
            b.vy -= (1 + rest) * vn * best.ny;
        }
    }
    return touched;
}

/** Circle vs oriented box (cars). Box: { x, y, a, hw, hh, vx, vy }. */
function collideBox(b, box, hooks) {
    const c = Math.cos(box.a), s = Math.sin(box.a);
    const rx = b.x - box.x, ry = b.y - box.y;
    const lx = rx * c + ry * s, ly = -rx * s + ry * c;
    const qx = Math.max(-box.hw, Math.min(box.hw, lx));
    const qy = Math.max(-box.hh, Math.min(box.hh, ly));
    let dx = lx - qx, dy = ly - qy;
    let d = Math.hypot(dx, dy), nlx, nly, pen;
    if (d < 1e-9) {
        const px = box.hw - Math.abs(lx), py = box.hh - Math.abs(ly);
        if (px < py) { nlx = Math.sign(lx) || 1; nly = 0; pen = px + b.r; } else { nlx = 0; nly = Math.sign(ly) || 1; pen = py + b.r; }
    } else {
        if (d >= b.r) return false;
        nlx = dx / d; nly = dy / d; pen = b.r - d;
    }
    const nx = nlx * c - nly * s, ny = nlx * s + nly * c;
    b.x += nx * pen; b.y += ny * pen;
    const bvx = box.vx || 0, bvy = box.vy || 0;
    const vn = (b.vx - bvx) * nx + (b.vy - bvy) * ny;
    if (vn < 0) {
        b.vx -= (1 + PHYS.restWall) * vn * nx;
        b.vy -= (1 + PHYS.restWall) * vn * ny;
        hooks?.box?.(b, box, -vn, nx, ny);
    }
    return true;
}

function collidePair(a, b, hooks) {
    const dx = b.x - a.x, dy = b.y - a.y;
    const rr = a.r + b.r;
    const d2 = dx * dx + dy * dy;
    if (d2 >= rr * rr) return;
    let d = Math.sqrt(d2), nx, ny;
    if (d < 1e-9) { nx = 1; ny = 0; d = 0; } else { nx = dx / d; ny = dy / d; }
    const ima = a.pinned ? 0 : 1 / a.m, imb = b.pinned ? 0 : 1 / b.m;
    const imSum = ima + imb;
    if (imSum === 0) return;
    const pen = rr - d;
    a.x -= nx * pen * (ima / imSum); a.y -= ny * pen * (ima / imSum);
    b.x += nx * pen * (imb / imSum); b.y += ny * pen * (imb / imSum);
    const rv = (b.vx - a.vx) * nx + (b.vy - a.vy) * ny;
    if (rv >= 0) return;
    const j = -(1 + PHYS.restBall) * rv / imSum;
    a.vx -= j * ima * nx; a.vy -= j * ima * ny;
    b.vx += j * imb * nx; b.vy += j * imb * ny;
    hooks?.pair?.(a, b, -rv, nx, ny);
}

/**
 * Advance every body one fixed step.
 * S: mutable state (tiles, bodies, cars). L: static level (circles, holes, floor).
 */
export function stepPhysics(S, L, dt, hooks) {
    const bodies = S.bodies;
    for (const b of bodies) {
        if (b.gone || b.pinned) continue;
        // AI-driven walkers set their own velocity; everything else slides.
        if (!b.ctl) {
            const sp = Math.hypot(b.vx, b.vy);
            if (sp > 0) {
                const f = frictionAt(S, L, b.x, b.y);
                const dec = (PHYS.friction * f + PHYS.drag * sp) * dt;
                const ns = sp - dec;
                if (ns <= PHYS.stopSpeed) { b.vx = 0; b.vy = 0; }
                else { b.vx *= ns / sp; b.vy *= ns / sp; }
            }
        }
        b.x += b.vx * dt;
        b.y += b.vy * dt;
    }
    // static circles (palms, pillars, bumpers, terminals)
    for (const b of bodies) {
        if (b.gone || b.pinned) continue;
        for (const c of L.circles) {
            if (c.gone) continue;
            if (Math.abs(b.x - c.x) > b.r + c.r || Math.abs(b.y - c.y) > b.r + c.r) continue;
            if (c.kind === 'bumper') {
                if (resolveCircleStatic(b, c.x, c.y, c.r, PHYS.restBumper, hooks, c)) {
                    const dx = b.x - c.x, dy = b.y - c.y, d = Math.hypot(dx, dy) || 1;
                    if (!b.ctl) { b.vx += (dx / d) * PHYS.bumperKick; b.vy += (dy / d) * PHYS.bumperKick; }
                }
            } else resolveCircleStatic(b, c.x, c.y, c.r, PHYS.restWall, hooks, c);
        }
        for (const box of S.cars) collideBox(b, box, hooks);
    }
    for (let i = 0; i < bodies.length; i++) {
        const a = bodies[i];
        if (a.gone || a.ghostPhys) continue;
        for (let j = i + 1; j < bodies.length; j++) {
            const b = bodies[j];
            if (b.gone || b.ghostPhys) continue;
            collidePair(a, b, hooks);
        }
    }
    for (const b of bodies) {
        if (b.gone || b.pinned) continue;
        collideTiles(S, b, hooks);
        // pockets: water tiles and round holes
        const tx = Math.floor(b.x), ty = Math.floor(b.y);
        if (tx >= 0 && ty >= 0 && tx < S.w && ty < S.h) {
            const i = ty * S.w + tx;
            if (S.tiles[i] === T.WATER) { hooks?.pocket?.(b, 'water'); continue; }
            if (L.holeAt[i]) {
                const hx = tx + 0.5, hy = ty + 0.5;
                if (Math.hypot(b.x - hx, b.y - hy) < 0.36) hooks?.pocket?.(b, 'hole');
            }
        }
    }
}

// ------------------------------------------------------------------ rays
/**
 * Distance from (x, y) along angle `a` until something opaque, capped at `max`.
 * Walks the grid with DDA, then checks opaque circles and parked cars.
 */
export function castRay(S, L, x, y, a, max) {
    const dx = Math.cos(a), dy = Math.sin(a);
    let tx = Math.floor(x), ty = Math.floor(y);
    const stepX = dx > 0 ? 1 : -1, stepY = dy > 0 ? 1 : -1;
    const tDX = Math.abs(1 / (dx || 1e-9)), tDY = Math.abs(1 / (dy || 1e-9));
    let tMX = dx > 0 ? (tx + 1 - x) * tDX : (x - tx) * tDX;
    let tMY = dy > 0 ? (ty + 1 - y) * tDY : (y - ty) * tDY;
    let dist = max, t = 0;
    for (let n = 0; n < 64; n++) {
        if (tMX < tMY) { t = tMX; tMX += tDX; tx += stepX; } else { t = tMY; tMY += tDY; ty += stepY; }
        if (t >= max) break;
        const tile = (tx < 0 || ty < 0 || tx >= S.w || ty >= S.h) ? T.VOID : S.tiles[ty * S.w + tx];
        if (OPAQUE[tile]) { dist = t; break; }
    }
    for (const c of L.circles) {
        if (!c.opaque || c.gone) continue;
        const ox = c.x - x, oy = c.y - y;
        const along = ox * dx + oy * dy;
        if (along <= 0 || along >= dist) continue;
        const perp = Math.abs(ox * dy - oy * dx);
        if (perp < c.r) dist = Math.max(0, along - Math.sqrt(c.r * c.r - perp * perp));
    }
    for (const box of S.cars) {
        if (box.traffic) continue;
        const hit = rayBox(x, y, dx, dy, box);
        if (hit >= 0 && hit < dist) dist = hit;
    }
    return dist;
}

function rayBox(x, y, dx, dy, box) {
    const c = Math.cos(box.a), s = Math.sin(box.a);
    const rx = x - box.x, ry = y - box.y;
    const ox = rx * c + ry * s, oy = -rx * s + ry * c;
    const ddx = dx * c + dy * s, ddy = -dx * s + dy * c;
    let tmin = -Infinity, tmax = Infinity;
    for (const [o, d, h] of [[ox, ddx, box.hw], [oy, ddy, box.hh]]) {
        if (Math.abs(d) < 1e-9) { if (Math.abs(o) > h) return -1; continue; }
        let t1 = (-h - o) / d, t2 = (h - o) / d;
        if (t1 > t2) [t1, t2] = [t2, t1];
        tmin = Math.max(tmin, t1); tmax = Math.min(tmax, t2);
        if (tmin > tmax) return -1;
    }
    return tmin >= 0 ? tmin : -1;
}

/** True if nothing opaque lies between the two points. */
export function lineOfSight(S, L, x0, y0, x1, y1) {
    const d = Math.hypot(x1 - x0, y1 - y0);
    if (d < 1e-6) return true;
    return castRay(S, L, x0, y0, Math.atan2(y1 - y0, x1 - x0), d) >= d - 0.05;
}

export function angleDiff(a, b) {
    let d = (b - a) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return d;
}

/** Segment (x1,y1)-(x2,y2) against circle. */
export function segCircle(x1, y1, x2, y2, cx, cy, r) {
    const dx = x2 - x1, dy = y2 - y1;
    const l2 = dx * dx + dy * dy || 1e-9;
    let t = ((cx - x1) * dx + (cy - y1) * dy) / l2;
    t = Math.max(0, Math.min(1, t));
    const px = x1 + dx * t, py = y1 + dy * t;
    return (px - cx) ** 2 + (py - cy) ** 2 < r * r;
}

// ------------------------------------------------------------------ paths
/** A* over walkable tiles. Returns [[x, y], …] tile centres, or null. */
export function findPath(S, L, x0, y0, x1, y1, maxNodes = 1400) {
    const w = S.w;
    const sx = Math.floor(x0), sy = Math.floor(y0);
    let gx = Math.floor(x1), gy = Math.floor(y1);
    if (!walkable(S, L, gx, gy)) {
        // nearest walkable tile to the goal
        let best = null, bd = 1e9;
        for (let oy = -2; oy <= 2; oy++) for (let ox = -2; ox <= 2; ox++) {
            if (walkable(S, L, gx + ox, gy + oy)) { const d = ox * ox + oy * oy; if (d < bd) { bd = d; best = [gx + ox, gy + oy]; } }
        }
        if (!best) return null;
        [gx, gy] = best;
    }
    const start = sy * w + sx, goal = gy * w + gx;
    if (start === goal) return [[gx + 0.5, gy + 0.5]];
    const g = new Map([[start, 0]]), came = new Map();
    const open = [[Math.abs(gx - sx) + Math.abs(gy - sy), start]];
    const closed = new Set();
    let n = 0;
    while (open.length && n++ < maxNodes) {
        let bi = 0;
        for (let i = 1; i < open.length; i++) if (open[i][0] < open[bi][0]) bi = i;
        const [, cur] = open.splice(bi, 1)[0];
        if (cur === goal) {
            const out = [];
            let c = cur;
            while (c !== start) { out.push([(c % w) + 0.5, Math.floor(c / w) + 0.5]); c = came.get(c); }
            return out.reverse();
        }
        if (closed.has(cur)) continue;
        closed.add(cur);
        const cx = cur % w, cy = Math.floor(cur / w);
        for (const [ox, oy, cost] of [[1, 0, 1], [-1, 0, 1], [0, 1, 1], [0, -1, 1], [1, 1, 1.41], [1, -1, 1.41], [-1, 1, 1.41], [-1, -1, 1.41]]) {
            const nx = cx + ox, ny = cy + oy;
            if (!walkable(S, L, nx, ny)) continue;
            if (ox && oy && (!walkable(S, L, cx + ox, cy) || !walkable(S, L, cx, cy + oy))) continue;
            const ni = ny * w + nx;
            const ng = g.get(cur) + cost;
            if (ng < (g.get(ni) ?? Infinity)) {
                g.set(ni, ng); came.set(ni, cur);
                open.push([ng + Math.hypot(gx - nx, gy - ny), ni]);
            }
        }
    }
    return null;
}

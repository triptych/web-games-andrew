// Tile queries and the platformer body mover shared by the player, the walkers, the loot and the
// bot's path finder. Pure.
//
// A body is { x, y, w, h, vx, vy, ground }: x is its centre, y its feet (y grows downwards).
// Blocks are Bubble Bobble platforms: a body rising passes up through them; a body falling lands
// on any block with space above it; a body on the ground or falling is stopped by blocks at its
// sides, unless it is already inside one (so a jump that ends inside a block can walk out).
// The side walls (columns 0–1 and 30–31) are always solid. The ceiling only bumps heads.

import { W, H, LEFT, RIGHT } from '../config.js';

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export function solid(L, c, r) {
    if (c < 0 || c >= W) return true;
    if (r < 0 || r >= H) return false;
    return L.tiles[r * W + c] === 1;
}

/** A block you can stand on: solid, with space above, and not the ceiling. */
export function surface(L, c, r) {
    return r >= 1 && r < H && c >= LEFT && c < RIGHT && solid(L, c, r) && !solid(L, c, r - 1);
}

/** The columns a body stands on: a little narrower than the body, so it hangs over edges. */
export function footCols(x, w) {
    return [Math.floor(x - w / 2 + 0.25), Math.floor(x + w / 2 - 0.25 - 1e-9)];
}

/** Is there something to stand on right under feet at y (an integer row) across [c0, c1]? */
export function supported(L, x, y, w) {
    const r = Math.round(y);
    if (Math.abs(y - r) > 1e-4) return false;
    const [c0, c1] = footCols(x, w);
    for (let c = c0; c <= c1; c++) if (surface(L, c, r)) return true;
    return false;
}

function bodyRows(y, h) {
    return [Math.floor(y - h + 0.15), Math.floor(y - 0.15)];
}

function overlapsSolid(L, x, y, w, h) {
    const [r0, r1] = bodyRows(y, h);
    const c0 = Math.floor(x - w / 2 + 0.02), c1 = Math.floor(x + w / 2 - 0.02);
    for (let r = r0; r <= r1; r++) for (let c = Math.max(LEFT, c0); c <= Math.min(RIGHT - 1, c1); c++) if (solid(L, c, r)) return true;
    return false;
}

/**
 * Move a body one step: horizontal, then vertical. Gravity is the caller's job. Sets b.ground,
 * b.hitWall (−1, 0, 1) and b.landed (true on the step it touched down). Wraps the bottom to the top.
 */
export function moveBody(L, b, dt) {
    b.hitWall = 0;
    b.landed = false;
    // ---- horizontal
    const lo = LEFT + b.w / 2, hi = RIGHT - b.w / 2;
    let nx = b.x + b.vx * dt;
    if (nx < lo) { nx = lo; b.hitWall = -1; }
    if (nx > hi) { nx = hi; b.hitWall = 1; }
    if (nx !== b.x) {
        const rising = b.vy < 0 && !b.ground;
        if (!rising && !overlapsSolid(L, b.x, b.y, b.w, b.h)) {
            const dir = nx > b.x ? 1 : -1;
            const lead = dir > 0 ? nx + b.w / 2 : nx - b.w / 2;
            const c = Math.floor(dir > 0 ? lead - 1e-9 : lead);
            const [r0, r1] = bodyRows(b.y, b.h);
            let block = false;
            for (let r = r0; r <= r1 && !block; r++) if (c >= LEFT && c < RIGHT && solid(L, c, r)) block = true;
            if (block) {
                nx = dir > 0 ? c - b.w / 2 - 1e-6 : c + 1 + b.w / 2 + 1e-6;
                b.hitWall = dir;
            }
        }
        b.x = nx;
    }
    if (b.ground && !supported(L, b.x, b.y, b.w)) b.ground = false;

    // ---- vertical
    if (b.ground) { b.vy = Math.max(0, b.vy); if (b.vy === 0) return; }
    const ny = b.y + b.vy * dt;
    if (b.vy < 0) {
        // only the ceiling row stops a head
        const top = ny - b.h;
        if (top < 1 && top > -0.5) {
            const [c0, c1] = [Math.floor(b.x - b.w / 2 + 0.2), Math.floor(b.x + b.w / 2 - 0.2)];
            let bump = false;
            for (let c = c0; c <= c1; c++) if (solid(L, c, 0)) bump = true;
            if (bump) { b.y = 1 + b.h; b.vy = 0; return; }
        }
        b.y = ny;
        b.ground = false;
        return;
    }
    const [c0, c1] = footCols(b.x, b.w);
    // crossing the top of a block
    for (let r = Math.ceil(b.y - 1e-6); r <= Math.floor(ny); r++) {
        for (let c = c0; c <= c1; c++) {
            if (surface(L, c, r)) { b.y = r; b.vy = 0; b.ground = true; b.landed = true; return; }
        }
    }
    // feet ended inside a block: step up onto it if its top is close (a jump that peaks inside one)
    const rIn = Math.floor(ny);
    for (let c = c0; c <= c1; c++) {
        if (!solid(L, c, rIn) || c < LEFT || c >= RIGHT) continue;
        let s = rIn;
        while (s > 1 && solid(L, c, s - 1)) s--;
        if (surface(L, c, s) && ny - s < 0.95 && ny - s > 0) { b.y = s; b.vy = 0; b.ground = true; b.landed = true; return; }
    }
    b.y = ny;
    b.ground = false;
    wrap(b);
}

/** Out of the bottom gap, back in at the top. */
export function wrap(b) {
    if (b.y - b.h > H + 0.2) { b.y -= H + b.h + 0.4; b.wrapped = (b.wrapped || 0) + 1; }
}

/** The highest surface row at or below feet y under x (for spawning loot). */
export function groundBelow(L, x, y, w = 1) {
    const [c0, c1] = footCols(x, w);
    for (let r = Math.max(1, Math.ceil(y)); r < H; r++) for (let c = c0; c <= c1; c++) if (surface(L, c, r)) return r;
    return null;
}

/** All runs of standing surface: { id, r, c0, c1 } (x range [c0, c1 + 1]). */
export function segments(L) {
    const out = [];
    for (let r = 1; r < H; r++) {
        let c = LEFT;
        while (c < RIGHT) {
            if (!surface(L, c, r)) { c++; continue; }
            const c0 = c;
            while (c < RIGHT && surface(L, c, r)) c++;
            out.push({ id: out.length, r, c0, c1: c - 1 });
        }
    }
    return out;
}

/** The segment a standing body is on, or null. */
export function segmentAt(segs, x, y, w) {
    const r = Math.round(y);
    if (Math.abs(y - r) > 1e-3) return null;
    const [c0, c1] = footCols(x, w);
    let best = null;
    for (const s of segs) {
        if (s.r !== r || s.c1 < c0 || s.c0 > c1) continue;
        if (!best || Math.abs((s.c0 + s.c1 + 1) / 2 - x) < Math.abs((best.c0 + best.c1 + 1) / 2 - x)) best = s;
    }
    return best;
}

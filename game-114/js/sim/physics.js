// Tile queries and the body mover shared by the player, the walkers and the bot's jump planner. Pure.
//
// y grows upwards. A body is { x, y, w, h, vx, vy, ground, drop }: x is its centre, y its feet.
// Tiles: 0 empty, 1 solid, 2 one-way platform (stands on it from above, jumps up through it,
// drops through with down + jump), 3 acid (not solid: it hurts, and the floor under it catches you).
// Outside the level the side columns are solid; below row 0 is open (a pit).

export const T_EMPTY = 0, T_SOLID = 1, T_PLAT = 2, T_ACID = 3;
const EPS = 1e-4;

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export function tile(L, c, r) {
    if (c < 0 || c >= L.w) return T_SOLID;
    if (r < 0 || r >= L.h) return T_EMPTY;
    return L.tiles[r * L.w + c];
}
export const solidAt = (L, c, r) => tile(L, c, r) === T_SOLID;

/** Is a world point inside a solid tile? (bullets) */
export const pointSolid = (L, x, y) => solidAt(L, Math.floor(x), Math.floor(y));

function cols(b) { return [Math.floor(b.x - b.w / 2 + 0.02), Math.floor(b.x + b.w / 2 - 0.02)]; }

/**
 * Move a body one step: horizontal, then vertical. The caller applies gravity first.
 * Sets b.ground (landed on something this step), b.hitWall (−1, 0, 1), b.bump (hit a ceiling).
 */
export function moveBody(L, b, dt) {
    b.hitWall = 0;
    b.bump = false;
    // ---- horizontal
    if (b.vx) {
        let nx = b.x + b.vx * dt;
        const r0 = Math.floor(b.y + 0.02), r1 = Math.floor(b.y + b.h - 0.02);
        if (b.vx > 0) {
            const c = Math.floor(nx + b.w / 2 - EPS);
            for (let r = r0; r <= r1; r++) if (solidAt(L, c, r)) { nx = c - b.w / 2 - EPS; b.hitWall = 1; break; }
        } else {
            const c = Math.floor(nx - b.w / 2 + EPS);
            for (let r = r0; r <= r1; r++) if (solidAt(L, c, r)) { nx = c + 1 + b.w / 2 + EPS; b.hitWall = -1; break; }
        }
        // never move backwards into the wall we started inside
        if (b.hitWall && Math.sign(nx - b.x) !== Math.sign(b.vx)) nx = b.x;
        b.x = nx;
    }
    // ---- vertical
    b.ground = false;
    let ny = b.y + b.vy * dt;
    const [c0, c1] = cols(b);
    if (b.vy <= 0) {
        // every row top crossed between y and ny, highest first
        const rStart = Math.floor(b.y - EPS), rEnd = Math.floor(ny);
        for (let r = rStart; r >= rEnd; r--) {
            const top = r + 1;
            if (top > b.y + EPS || top < ny - EPS) continue;
            let land = false;
            for (let c = c0; c <= c1 && !land; c++) {
                const t = tile(L, c, r);
                if (t === T_SOLID || (t === T_PLAT && !(b.drop > 0))) land = true;
            }
            if (land) { ny = top; b.vy = 0; b.ground = true; break; }
        }
    } else {
        const head = b.y + b.h, nhead = ny + b.h;
        for (let r = Math.floor(head - EPS) + 1; r <= Math.floor(nhead); r++) {
            let hit = false;
            for (let c = c0; c <= c1 && !hit; c++) if (solidAt(L, c, r)) hit = true;
            if (hit) { ny = r - b.h - EPS; b.vy = 0; b.bump = true; break; }
        }
    }
    b.y = ny;
    if (b.drop > 0) b.drop -= dt;
}

/** Is the body standing on a one-way platform (and so can drop through)? */
export function onPlatform(L, b) {
    if (!b.ground) return false;
    const r = Math.round(b.y) - 1;
    const [c0, c1] = cols(b);
    let plat = false;
    for (let c = c0; c <= c1; c++) {
        const t = tile(L, c, r);
        if (t === T_SOLID) return false;
        if (t === T_PLAT) plat = true;
    }
    return plat;
}

/** Does the body overlap acid? */
export function inAcid(L, b) {
    const [c0, c1] = cols(b);
    const r0 = Math.floor(b.y + 0.05), r1 = Math.floor(b.y + 0.6);
    for (let r = r0; r <= r1; r++) for (let c = c0; c <= c1; c++) if (tile(L, c, r) === T_ACID) return true;
    return false;
}

/** Is there something to stand on at column c just under height y (an integer top)? */
export function standable(L, c, y) {
    const t = tile(L, c, Math.round(y) - 1);
    return t === T_SOLID || t === T_PLAT;
}

/** The first standable top at or below y in column c, or -1. */
export function groundBelow(L, c, y) {
    for (let r = Math.min(L.h - 1, Math.floor(y)); r >= 0; r--) {
        const t = tile(L, c, r);
        if (t === T_SOLID || t === T_PLAT) return tile(L, c, r + 1) === T_SOLID ? -1 : r + 1;
        if (t === T_ACID) return -1;
    }
    return -1;
}

export const overlap = (a, b) =>
    Math.abs(a.x - b.x) * 2 < a.w + b.w && a.y < b.y + b.h && b.y < a.y + a.h;

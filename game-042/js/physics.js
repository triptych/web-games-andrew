// ============================================================
// Body-vs-tile collision and Pip's movement step. Pure: no DOM.
// The game and the level validator run exactly this code, so what the
// validator says is reachable is what a player can actually reach.
//
// env = {
//   kind(tx, ty) -> K.*          collision kind of a tile
//   rects: [{x,y,w,h, oneway, vx, vy, id}]   dynamic solids (ice, lifts)
//   w, h                          level size in tiles (off the sides is solid,
//                                 off the top is open, off the bottom is a pit)
// }
// ============================================================

import { TILE, PHYS } from './config.js';
import { K } from './tiles.js';

function kindAt(env, tx, ty) {
    if (tx < 0 || tx >= env.w) return K.SOLID;
    if (ty < 0 || ty >= env.h) return K.EMPTY;
    return env.kind(tx, ty);
}

/** Move horizontally; stops at solid tiles and solid rects. Returns -1/1 if blocked. */
export function moveX(b, dx, env) {
    if (dx === 0) return 0;
    const nx = b.x + dx;
    const top = Math.floor(b.y / TILE), bot = Math.floor((b.y + b.h - 0.01) / TILE);
    let hit = 0;
    if (dx > 0) {
        const edge = nx + b.w;
        const tx = Math.floor((edge - 0.01) / TILE);
        let limit = Infinity;
        for (let ty = top; ty <= bot; ty++) {
            const k = kindAt(env, tx, ty);
            if (k === K.SOLID || k === K.SPRING) { limit = Math.min(limit, tx * TILE); }
        }
        for (const r of env.rects) {
            if (r.oneway) continue;
            if (b.y + b.h > r.y && b.y < r.y + r.h && b.x + b.w <= r.x + 0.01 && edge > r.x) limit = Math.min(limit, r.x);
        }
        if (limit !== Infinity && edge > limit) { b.x = limit - b.w; hit = 1; }
        else b.x = nx;
    } else {
        const tx = Math.floor(nx / TILE);
        let limit = -Infinity;
        for (let ty = top; ty <= bot; ty++) {
            const k = kindAt(env, tx, ty);
            if (k === K.SOLID || k === K.SPRING) { limit = Math.max(limit, (tx + 1) * TILE); }
        }
        for (const r of env.rects) {
            if (r.oneway) continue;
            if (b.y + b.h > r.y && b.y < r.y + r.h && b.x >= r.x + r.w - 0.01 && nx < r.x + r.w) limit = Math.max(limit, r.x + r.w);
        }
        if (limit !== -Infinity && nx < limit) { b.x = limit; hit = -1; }
        else b.x = nx;
    }
    return hit;
}

/**
 * Move vertically. Returns { landed, ground (kind), rect, head: [tx...], headY } —
 * `head` lists the tile columns bumped from below (for ? blocks and bricks).
 */
export function moveY(b, dy, env, out) {
    out.landed = false; out.ground = K.EMPTY; out.rect = null; out.head = null; out.headY = 0; out.hidden = null;
    if (dy === 0) return out;
    const left = Math.floor(b.x / TILE), right = Math.floor((b.x + b.w - 0.01) / TILE);
    if (dy > 0) {
        const bottom = b.y + b.h, nb = bottom + dy;
        const ty = Math.floor((nb - 0.01) / TILE);
        let limit = Infinity, gk = K.EMPTY;
        if (ty >= 0 && ty * TILE >= bottom - 0.01) {
            for (let tx = left; tx <= right; tx++) {
                const k = kindAt(env, tx, ty);
                if (k === K.SOLID || k === K.ONEWAY || k === K.SPRING) {
                    if (ty * TILE < limit || (ty * TILE === limit && k === K.SPRING)) { limit = ty * TILE; gk = k; }
                }
            }
        }
        let rect = null;
        for (const r of env.rects) {
            if (b.x + b.w > r.x && b.x < r.x + r.w && bottom <= r.y + 0.5 && nb > r.y) {
                if (r.y < limit) { limit = r.y; gk = K.SOLID; rect = r; }
            }
        }
        if (limit !== Infinity) {
            b.y = limit - b.h;
            out.landed = true; out.ground = gk; out.rect = rect;
        } else b.y += dy;
    } else {
        const ny = b.y + dy;
        const ty = Math.floor(ny / TILE);
        let limit = -Infinity;
        const cols = [];
        let hidden = null;
        if (ty < env.h && (ty + 1) * TILE <= b.y + 0.01) {
            for (let tx = left; tx <= right; tx++) {
                const k = kindAt(env, tx, ty);
                if (k === K.SOLID || k === K.SPRING || k === K.HIDDEN) {
                    limit = Math.max(limit, (ty + 1) * TILE);
                    cols.push(tx);
                    if (k === K.HIDDEN) hidden = tx;
                }
            }
        }
        for (const r of env.rects) {
            if (r.oneway) continue;
            if (b.x + b.w > r.x && b.x < r.x + r.w && b.y >= r.y + r.h - 0.5 && ny < r.y + r.h) limit = Math.max(limit, r.y + r.h);
        }
        if (limit !== -Infinity) {
            b.y = limit;
            out.head = cols; out.headY = ty; out.hidden = hidden;
        } else b.y = ny;
    }
    return out;
}

/** Is there a wall touching the body on side `dir` (-1 / 1)? */
export function touchingWall(b, dir, env) {
    const x = dir > 0 ? b.x + b.w + 0.5 : b.x - 0.5;
    const tx = Math.floor(x / TILE);
    const top = Math.floor((b.y + 2) / TILE), bot = Math.floor((b.y + b.h - 3) / TILE);
    for (let ty = top; ty <= bot; ty++) {
        const k = kindAt(env, tx, ty);
        if (k === K.SOLID) return true;
    }
    for (const r of env.rects) {
        if (r.oneway) continue;
        if (b.y + b.h - 3 > r.y && b.y + 2 < r.y + r.h && x >= r.x && x <= r.x + r.w) return true;
    }
    return false;
}

/** Standing on something right now? (used after external pushes) */
export function groundBelow(b, env) {
    const y = b.y + b.h + 0.5;
    const ty = Math.floor(y / TILE);
    const left = Math.floor(b.x / TILE), right = Math.floor((b.x + b.w - 0.01) / TILE);
    for (let tx = left; tx <= right; tx++) {
        const k = kindAt(env, tx, ty);
        if ((k === K.SOLID || k === K.SPRING || k === K.ONEWAY) && Math.abs(ty * TILE - (b.y + b.h)) < 1) return true;
    }
    for (const r of env.rects) {
        if (b.x + b.w > r.x && b.x < r.x + r.w && Math.abs(r.y - (b.y + b.h)) < 1) return true;
    }
    return false;
}

export function newPlayerBody(x, y) {
    return {
        x, y, w: PHYS.w, h: PHYS.h, vx: 0, vy: 0,
        onGround: false, facing: 1,
        coyote: 0, buffer: 0, jumpHeld: false, rising: false,
        djUsed: false, wallDir: 0, wallLock: 0,
        pounding: 0,        // 0 = no, 1 = hanging, 2 = falling
        poundT: 0,
        ride: null,         // rect being ridden
    };
}

const yOut = { landed: false, ground: 0, rect: null, head: null, headY: 0, hidden: null };

/**
 * Advance Pip one fixed step.
 * inp = { left, right, up, down, jump (held), jumpPressed (edge) }
 * ab  = { boots, mitts }  (Set or object with those keys truthy)
 * opts = { run }            top speed override (Rainbow Star)
 * Returns an object of flags for the caller to react to (sounds, bumps).
 */
export function stepPlayer(p, inp, dt, env, ab, opts = {}) {
    const fx = { jumped: false, dj: false, wallJump: false, landed: false, head: null, headY: 0, hidden: null,
        spring: false, poundStart: false, poundLand: false, groundRect: null, wallSlide: false };
    const run = opts.run || PHYS.run;

    // ---- ride a moving platform
    if (p.ride && p.onGround) {
        moveX(p, p.ride.dx || 0, env);
        p.y = p.ride.y - p.h;
    }

    if (inp.jumpPressed) p.buffer = PHYS.buffer;
    else p.buffer = Math.max(0, p.buffer - dt);
    p.coyote = p.onGround ? PHYS.coyote : Math.max(0, p.coyote - dt);
    p.wallLock = Math.max(0, p.wallLock - dt);

    let dir = 0;
    if (inp.left) dir -= 1;
    if (inp.right) dir += 1;

    // ---- ground pound
    if (p.pounding) {
        dir = 0;
        if (p.pounding === 1) {
            p.vx = 0; p.vy = 0;
            p.poundT -= dt;
            if (p.poundT <= 0) { p.pounding = 2; p.vy = PHYS.poundV; }
        }
    } else if (inp.down && !p.onGround && inp.downPressed) {
        p.pounding = 1; p.poundT = PHYS.poundHang; p.vx = 0; p.vy = 0;
        fx.poundStart = true;
    }

    // ---- horizontal
    if (!p.pounding) {
        if (p.wallLock > 0) dir = 0;
        const target = dir * run;
        const acc = p.onGround ? (dir !== 0 ? PHYS.accGround : PHYS.decGround) : PHYS.accAir;
        if (dir === 0 && !p.onGround) {
            // keep momentum in the air, with a little drag
            p.vx *= Math.pow(0.35, dt);
        } else if (p.vx < target) p.vx = Math.min(target, p.vx + acc * dt);
        else if (p.vx > target) p.vx = Math.max(target, p.vx - acc * dt);
        if (dir !== 0 && p.wallLock <= 0) p.facing = dir;
    }

    // ---- wall contact (Sticky Mitts)
    p.wallDir = 0;
    if (ab.mitts && !p.onGround && !p.pounding) {
        if (dir !== 0 && touchingWall(p, dir, env)) p.wallDir = dir;
        else if (touchingWall(p, p.facing, env) && p.buffer > 0) p.wallDir = p.facing;
    }

    // ---- jumping
    if (p.buffer > 0 && !p.pounding) {
        if (p.onGround || p.coyote > 0) {
            p.vy = -PHYS.jumpV; p.onGround = false; p.coyote = 0; p.buffer = 0;
            p.rising = true; p.ride = null; fx.jumped = true;
        } else if (p.wallDir !== 0) {
            p.vx = -p.wallDir * PHYS.wallJumpVX; p.vy = -PHYS.wallJumpVY;
            p.facing = -p.wallDir; p.wallLock = PHYS.wallLock; p.buffer = 0;
            p.rising = true; p.djUsed = false; fx.wallJump = true;
        } else if (ab.boots && !p.djUsed) {
            p.vy = -PHYS.djV; p.djUsed = true; p.buffer = 0; p.rising = true; fx.dj = true;
        }
    }
    if (p.springT > 0) p.springT -= dt;
    if (!inp.jump && !(p.springT > 0)) p.rising = false;

    // ---- gravity
    if (p.pounding !== 1) {
        const g = (p.rising && p.vy < 0) ? PHYS.gravUp : PHYS.grav;
        p.vy += g * dt;
        let maxFall = p.pounding ? PHYS.poundV : PHYS.maxFall;
        if (p.wallDir !== 0 && p.vy > 0) { maxFall = PHYS.wallSlide; fx.wallSlide = true; }
        if (p.vy > maxFall) p.vy = maxFall;
    }

    // ---- move
    const hx = moveX(p, p.vx * dt, env);
    if (hx !== 0) p.vx = 0;
    const wasGround = p.onGround;
    moveY(p, p.vy * dt, env, yOut);
    p.onGround = false;
    if (yOut.landed) {
        if (yOut.ground === K.SPRING) {
            // a spring keeps its lift for a moment even if jump isn't held
            p.vy = -PHYS.springV;
            p.rising = true; p.springT = 0.3; p.djUsed = false; fx.spring = true;
            if (p.pounding) p.pounding = 0;
        } else {
            p.vy = 0; p.onGround = true; p.djUsed = false; p.ride = yOut.rect;
            if (p.pounding === 2) { fx.poundLand = true; p.pounding = 0; }
            if (!wasGround) fx.landed = true;
        }
    } else if (yOut.head) {
        if (p.vy < 0) p.vy = 0;
        p.rising = false;
        fx.head = yOut.head; fx.headY = yOut.headY; fx.hidden = yOut.hidden;
    }
    if (!p.onGround) p.ride = null;
    fx.groundRect = p.ride;
    return fx;
}

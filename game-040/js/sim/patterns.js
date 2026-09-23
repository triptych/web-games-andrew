/**
 * patterns.js — the shared bullet-pattern emitter library.
 *
 * PURE: no three.js, no DOM, no Math.random. `buildPattern()` takes an attack
 * spec plus a context and returns an array of plain bullet specs (or beam specs
 * for lasers). The world turns those into live entities. Keeping it pure is what
 * lets dev/simtest.mjs assert on the actual shapes the game fires.
 *
 * Angle convention: radians, 0 = +x (right), +PI/2 = up the screen.
 * Enemies therefore fire "down" at -PI/2.
 */

import { ARENA, COLORS } from '../core/config.js';

export const DOWN = -Math.PI / 2;
export const UP = Math.PI / 2;

const D2R = Math.PI / 180;

/** Every pattern name the game knows. Used by dev/check.mjs to validate specs. */
export const PATTERN_NAMES = [
    'aimed', 'fan', 'ring', 'spiral', 'whip', 'wall',
    'rain', 'homing', 'laser', 'nova', 'flower', 'cluster',
];

/**
 * Evenly spaced omitted arms — the "safe lanes" the Chorus Heart's final
 * pattern opens, one per named cadet rescued. Returns a Set of arm indices.
 */
function laneSkips(n, lanes) {
    const skip = new Set();
    if (!lanes || lanes <= 0) return skip;
    const count = Math.min(lanes, Math.max(0, n - 2));
    for (let i = 0; i < count; i++) skip.add(Math.round((i * n) / count) % n);
    return skip;
}

function bullet(x, y, ang, speed, a, extra = {}) {
    return {
        x, y, ang, speed,
        r: a.r ?? 0.24,
        kind: a.kind ?? 'orb',
        color: a.color ?? COLORS.enemyBullet,
        maxLife: a.maxLife ?? 12,
        turn: a.turn ?? 0,
        ...extra,
    };
}

/**
 * Density scaling: harder difficulties add an arm to radial patterns, easier
 * ones remove one. Never drops a pattern below 2 arms or it stops being the
 * pattern the designer wrote.
 */
function scaleCount(count, ctx, radial = true) {
    if (!radial) return count;
    const d = ctx.density ?? 0;
    return Math.max(2, Math.round(count + d * Math.max(1, Math.round(count / 6))));
}

function scaleSpeed(speed, ctx) {
    return speed * (ctx.bulletSpeed ?? 1);
}

/**
 * @param {object} a    attack spec: { pattern, count, speed, spread, ... }
 * @param {object} ctx  { x, y, aimAng, phase, rng, bulletSpeed, density, time }
 * @returns {Array} bullet specs; entries with `.beam` are laser beams
 */
export function buildPattern(a, ctx) {
    const fn = PATTERNS[a.pattern];
    if (!fn) throw new Error(`[patterns] unknown pattern "${a.pattern}"`);
    return fn(a, ctx);
}

const PATTERNS = {
    // n shots straight at the player, optionally slightly splayed
    aimed(a, ctx) {
        const n = a.count ?? 1;
        const spread = (a.spread ?? 8) * D2R;
        const out = [];
        for (let i = 0; i < n; i++) {
            const off = n === 1 ? 0 : (i - (n - 1) / 2) * spread;
            out.push(bullet(ctx.x, ctx.y, ctx.aimAng + off, scaleSpeed(a.speed ?? 7, ctx), a));
        }
        return out;
    },

    // n-way fan around a heading (the player's bearing if `aimed`)
    fan(a, ctx) {
        const n = scaleCount(a.count ?? 5, ctx);
        const total = (a.spread ?? 60) * D2R;
        const base = a.aimed === false ? (a.angle ?? DOWN) : ctx.aimAng;
        const out = [];
        for (let i = 0; i < n; i++) {
            const t = n === 1 ? 0.5 : i / (n - 1);
            out.push(bullet(ctx.x, ctx.y, base - total / 2 + t * total,
                scaleSpeed(a.speed ?? 6.5, ctx), a));
        }
        return out;
    },

    // evenly spaced full circle
    ring(a, ctx) {
        const n = scaleCount(a.count ?? 8, ctx);
        const off = (a.offset ?? 0) + (a.aimed ? ctx.aimAng : 0);
        const skip = laneSkips(n, a.lanes ?? 0);
        const out = [];
        for (let i = 0; i < n; i++) {
            if (skip.has(i)) continue;
            out.push(bullet(ctx.x, ctx.y, off + (i / n) * Math.PI * 2,
                scaleSpeed(a.speed ?? 5.5, ctx), a));
        }
        return out;
    },

    // ring whose offset advances every volley — the classic rotating spiral
    spiral(a, ctx) {
        const n = scaleCount(a.count ?? 6, ctx);
        const step = (a.spin ?? 14) * D2R;
        const off = (ctx.phase ?? 0) * step + (a.aimed ? ctx.aimAng : 0);
        const skip = laneSkips(n, a.lanes ?? 0);
        const out = [];
        for (let i = 0; i < n; i++) {
            if (skip.has(i)) continue;
            out.push(bullet(ctx.x, ctx.y, off + (i / n) * Math.PI * 2,
                scaleSpeed(a.speed ?? 5.2, ctx), a));
        }
        return out;
    },

    // a dense arc swept across an angle, each bullet slightly faster than the
    // last so the volley visibly cracks like a whip
    whip(a, ctx) {
        const n = scaleCount(a.count ?? 12, ctx);
        const arc = (a.arc ?? 110) * D2R;
        const dir = a.dir ?? 1;
        const base = (a.aimed === false ? (a.angle ?? DOWN) : ctx.aimAng) - dir * arc / 2;
        const s0 = a.speed ?? 4.2;
        const s1 = a.speedEnd ?? (s0 * 1.9);
        const out = [];
        for (let i = 0; i < n; i++) {
            const t = i / Math.max(1, n - 1);
            out.push(bullet(ctx.x, ctx.y, base + dir * arc * t,
                scaleSpeed(s0 + (s1 - s0) * t, ctx), a));
        }
        return out;
    },

    // a horizontal line across the whole arena with `gaps` openings
    wall(a, ctx) {
        const n = a.count ?? 18;
        const gaps = a.gaps ?? 1;
        const gapW = a.gapWidth ?? 2.6;
        const y = a.y ?? ctx.y;
        const rng = ctx.rng;
        const centres = [];
        for (let g = 0; g < gaps; g++) {
            const lo = ARENA.left + 2 + (ARENA.w - 4) * (g / gaps);
            const hi = ARENA.left + 2 + (ARENA.w - 4) * ((g + 1) / gaps);
            centres.push(rng ? rng.range(lo, hi) : (lo + hi) / 2);
        }
        const out = [];
        for (let i = 0; i < n; i++) {
            const x = ARENA.left + (ARENA.w * (i + 0.5)) / n;
            if (centres.some((c) => Math.abs(x - c) < gapW / 2)) continue;
            out.push(bullet(x, y, a.angle ?? DOWN, scaleSpeed(a.speed ?? 5, ctx), a));
        }
        return out;
    },

    // slow bullets falling from the top edge at random x
    rain(a, ctx) {
        const n = a.count ?? 5;
        const rng = ctx.rng;
        const out = [];
        for (let i = 0; i < n; i++) {
            const x = rng ? rng.range(ARENA.left + 0.6, ARENA.right - 0.6)
                          : ARENA.left + (ARENA.w * (i + 0.5)) / n;
            const y = a.fromTop === false ? ctx.y : ARENA.top + (rng ? rng.range(0, 2) : i * 0.4);
            out.push(bullet(x, y, DOWN + (rng ? rng.range(-0.12, 0.12) : 0),
                scaleSpeed(a.speed ?? 4, ctx), a));
        }
        return out;
    },

    // slow seekers with a capped turn rate: dodgeable by out-turning them
    homing(a, ctx) {
        const n = a.count ?? 2;
        const spread = (a.spread ?? 40) * D2R;
        const out = [];
        for (let i = 0; i < n; i++) {
            const off = n === 1 ? 0 : (i - (n - 1) / 2) * spread;
            out.push(bullet(ctx.x, ctx.y, (a.aimed === false ? DOWN : ctx.aimAng) + off,
                scaleSpeed(a.speed ?? 3.6, ctx), a, {
                    homing: a.turnRate ?? 1.7,
                    homingUntil: a.homingUntil ?? 3.2,
                }));
        }
        return out;
    },

    // telegraphed beam: the world draws the warning line for `warn` seconds,
    // then the beam is live for `duration`
    laser(a, ctx) {
        return [{
            beam: {
                x: ctx.x, y: ctx.y,
                ang: a.aimed === false ? (a.angle ?? DOWN) : ctx.aimAng,
                width: a.width ?? 0.9,
                length: a.length ?? 48,
                warn: a.warn ?? 0.8,
                duration: a.duration ?? 1.1,
                sweep: (a.sweep ?? 0) * D2R,      // radians/second while firing
                color: a.color ?? COLORS.enemyBulletHot,
                follow: a.follow ?? false,         // track the emitter's position
            },
        }];
    },

    // a ring that crawls, hangs, then snaps outward
    nova(a, ctx) {
        const n = scaleCount(a.count ?? 14, ctx);
        const off = (a.offset ?? 0) + (a.aimed ? ctx.aimAng : 0);
        const hang = a.hang ?? 0.75;
        const fast = scaleSpeed(a.speedAfter ?? 9, ctx);
        const slow = scaleSpeed(a.speed ?? 2.4, ctx);
        const out = [];
        for (let i = 0; i < n; i++) {
            out.push(bullet(ctx.x, ctx.y, off + (i / n) * Math.PI * 2, slow, a, {
                speedKeys: [[0, slow], [hang, slow * 0.15], [hang + 0.28, fast]],
            }));
        }
        return out;
    },

    // petals of `per` bullets that splay apart as they travel (a turn rate that
    // differs per bullet inside the petal)
    flower(a, ctx) {
        const petals = scaleCount(a.count ?? 6, ctx);
        const per = a.per ?? 3;
        const splay = (a.splay ?? 26) * D2R;
        const off = (ctx.phase ?? 0) * (a.spin ?? 9) * D2R + (a.aimed ? ctx.aimAng : 0);
        const out = [];
        for (let p = 0; p < petals; p++) {
            const base = off + (p / petals) * Math.PI * 2;
            for (let i = 0; i < per; i++) {
                const t = per === 1 ? 0 : (i - (per - 1) / 2) / ((per - 1) / 2 || 1);
                out.push(bullet(ctx.x, ctx.y, base, scaleSpeed(a.speed ?? 4.4, ctx),
                    { ...a, kind: a.kind ?? 'petal' }, { turn: t * splay }));
            }
        }
        return out;
    },

    // shells that fly out and burst into small rings on a timer
    cluster(a, ctx) {
        const n = a.count ?? 4;
        const spread = (a.spread ?? 70) * D2R;
        const out = [];
        for (let i = 0; i < n; i++) {
            const t = n === 1 ? 0.5 : i / (n - 1);
            out.push(bullet(ctx.x, ctx.y,
                (a.aimed === false ? DOWN : ctx.aimAng) - spread / 2 + t * spread,
                scaleSpeed(a.speed ?? 5, ctx), { ...a, kind: a.kind ?? 'mine', r: a.r ?? 0.34 }, {
                    burstAt: a.burstAt ?? 1.1,
                    burstSpec: {
                        pattern: 'ring',
                        count: a.burstCount ?? 8,
                        speed: a.burstSpeed ?? 4.6,
                        kind: 'orb',
                        r: 0.22,
                        color: a.burstColor ?? COLORS.enemyBulletHot,
                    },
                }));
        }
        return out;
    },
};

/** Angle from an emitter to the player, the value every `aimed` pattern uses. */
export function aimAt(fromX, fromY, toX, toY) {
    return Math.atan2(toY - fromY, toX - fromX);
}

/** Shortest signed angular difference, for homing and sweeping beams. */
export function angDiff(a, b) {
    let d = (b - a) % (Math.PI * 2);
    if (d > Math.PI) d -= Math.PI * 2;
    if (d < -Math.PI) d += Math.PI * 2;
    return d;
}

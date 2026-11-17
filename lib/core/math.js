// lib/core/math.js — the small numeric helpers nearly every game redefines. Pure.
//
//   import { clamp, lerp, damp } from '../../lib/core/math.js';

export const TAU = Math.PI * 2;

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);
export const clamp01 = (v) => (v < 0 ? 0 : v > 1 ? 1 : v);
export const lerp = (a, b, t) => a + (b - a) * t;
/** Where v sits between a and b, as 0..1 (not clamped). */
export const invLerp = (a, b, v) => (a === b ? 0 : (v - a) / (b - a));
/** Map v from [a0, a1] to [b0, b1] (not clamped). */
export const remap = (v, a0, a1, b0, b1) => lerp(b0, b1, invLerp(a0, a1, v));
export const smoothstep = (e0, e1, x) => { const t = clamp01((x - e0) / (e1 - e0)); return t * t * (3 - 2 * t); };

/** Frame-rate independent exponential approach: move `a` toward `b` at `rate` per second. */
export const damp = (a, b, rate, dt) => b + (a - b) * Math.exp(-rate * dt);
/** Move toward a target by at most `step`, landing on it exactly. */
export const approach = (v, target, step) => (v < target ? Math.min(target, v + step) : Math.max(target, v - step));

/** Wrap an angle into (-π, π]. */
export const wrapAngle = (a) => { a = (a + Math.PI) % TAU; if (a <= 0) a += TAU; return a - Math.PI; };
/** Shortest signed turn from angle a to angle b. */
export const angleDiff = (a, b) => wrapAngle(b - a);
/** Turn angle a toward b by at most `step`. */
export const turnToward = (a, b, step) => { const d = angleDiff(a, b); return Math.abs(d) <= step ? b : a + Math.sign(d) * step; };

/** Positive modulo: mod(-1, 4) === 3. */
export const mod = (n, m) => ((n % m) + m) % m;

export const dist = (ax, ay, bx, by) => Math.hypot(bx - ax, by - ay);
export const dist2 = (ax, ay, bx, by) => (bx - ax) ** 2 + (by - ay) ** 2;

/** Circle vs axis-aligned rect { x, y, w, h }. */
export function circleRect(cx, cy, r, rect) {
    const nx = clamp(cx, rect.x, rect.x + rect.w), ny = clamp(cy, rect.y, rect.y + rect.h);
    return (cx - nx) ** 2 + (cy - ny) ** 2 < r * r;
}

/** Closest distance² from point p to segment ab. */
export function segDist2(px, py, ax, ay, bx, by) {
    const dx = bx - ax, dy = by - ay, l2 = dx * dx + dy * dy;
    const t = l2 ? clamp(((px - ax) * dx + (py - ay) * dy) / l2, 0, 1) : 0;
    return dist2(px, py, ax + dx * t, ay + dy * t);
}

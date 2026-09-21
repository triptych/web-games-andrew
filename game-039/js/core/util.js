/** Small math helpers shared across modules. */

export const TAU = Math.PI * 2;

export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

export const lerp = (a, b, t) => a + (b - a) * t;

/** Shortest signed angular difference from a to b, in radians. */
export function angleDelta(a, b) {
    let d = (b - a) % TAU;
    if (d > Math.PI) d -= TAU;
    if (d < -Math.PI) d += TAU;
    return d;
}

export function dist2(ax, ay, bx, by) {
    const dx = bx - ax;
    const dy = by - ay;
    return dx * dx + dy * dy;
}

export function dist(ax, ay, bx, by) {
    return Math.sqrt(dist2(ax, ay, bx, by));
}

/** Clamp a vector's length, mutating nothing; returns [x, y]. */
export function limit(x, y, max) {
    const m2 = x * x + y * y;
    if (m2 <= max * max || m2 === 0) return [x, y];
    const m = Math.sqrt(m2);
    return [(x / m) * max, (y / m) * max];
}

export const now = () => (typeof performance !== 'undefined' ? performance.now() : Date.now());

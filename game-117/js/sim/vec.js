// Vectors on and around the unit sphere. Plain [x, y, z] arrays so a save is just JSON.
// Positions on the asteroid are unit vectors; a heading is a unit tangent at a position.

export const add = (a, b) => [a[0] + b[0], a[1] + b[1], a[2] + b[2]];
export const sub = (a, b) => [a[0] - b[0], a[1] - b[1], a[2] - b[2]];
export const scale = (a, s) => [a[0] * s, a[1] * s, a[2] * s];
export const madd = (a, b, s) => [a[0] + b[0] * s, a[1] + b[1] * s, a[2] + b[2] * s];
export const dot = (a, b) => a[0] * b[0] + a[1] * b[1] + a[2] * b[2];
export const cross = (a, b) => [a[1] * b[2] - a[2] * b[1], a[2] * b[0] - a[0] * b[2], a[0] * b[1] - a[1] * b[0]];
export const len = (a) => Math.hypot(a[0], a[1], a[2]);
export const chord = (a, b) => Math.hypot(a[0] - b[0], a[1] - b[1], a[2] - b[2]);
export function norm(a) {
    const l = Math.hypot(a[0], a[1], a[2]);
    return l > 1e-12 ? [a[0] / l, a[1] / l, a[2] / l] : [0, 0, 0];
}
/** The part of d that lies in the tangent plane at p. */
export function tangent(p, d) {
    const k = dot(p, d);
    return [d[0] - p[0] * k, d[1] - p[1] * k, d[2] - p[2] * k];
}
/** The unit heading at p that points at q along the shorter great circle. */
export function toward(p, q) {
    const t = tangent(p, q);
    const l = len(t);
    if (l < 1e-9) return anyTangent(p);
    return [t[0] / l, t[1] / l, t[2] / l];
}
export function anyTangent(p) {
    const a = Math.abs(p[0]) < 0.9 ? [1, 0, 0] : [0, 1, 0];
    return norm(tangent(p, a));
}
/** Great-circle angle between two unit vectors. */
export function arc(a, b) {
    return Math.acos(Math.max(-1, Math.min(1, dot(a, b))));
}
/** Move from p along heading d by ang radians. Returns the new position and the carried heading. */
export function walk(p, d, ang) {
    const c = Math.cos(ang), s = Math.sin(ang);
    return {
        p: [p[0] * c + d[0] * s, p[1] * c + d[1] * s, p[2] * c + d[2] * s],
        d: [d[0] * c - p[0] * s, d[1] * c - p[1] * s, d[2] * c - p[2] * s],
    };
}
/** Rotate a tangent d at p by ang radians, counter-clockwise seen from outside. */
export function turn(p, d, ang) {
    const c = Math.cos(ang), s = Math.sin(ang);
    const x = cross(p, d);
    return [d[0] * c + x[0] * s, d[1] * c + x[1] * s, d[2] * c + x[2] * s];
}
/** Signed angle from tangent a to tangent b at p (positive = counter-clockwise seen from outside). */
export function angleTo(p, a, b) {
    return Math.atan2(dot(cross(a, b), p), dot(a, b));
}
/**
 * Parallel-transport tangent t when p walks along heading u to p2 (u2 is u carried along).
 * The axis w = p × u is unchanged by the walk, so t = (t·u)u + (t·w)w becomes (t·u)u2 + (t·w)w.
 */
export function transport(t, p, u, u2) {
    const w = cross(p, u);
    const a = dot(t, u), b = dot(t, w);
    return [u2[0] * a + w[0] * b, u2[1] * a + w[1] * b, u2[2] * a + w[2] * b];
}
/** Re-tidy after float drift: p back to unit length, t back to a unit tangent at p. */
export function tidy(p, t) {
    const pn = norm(p);
    return [pn, norm(tangent(pn, t))];
}

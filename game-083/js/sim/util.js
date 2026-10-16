// Small pure helpers shared by the two acts and the bot.

export const TAU = Math.PI * 2;
export const clamp = (v, lo, hi) => (v < lo ? lo : v > hi ? hi : v);

/** Wrap an angle to (-π, π]. */
export function wrapA(a) {
    a %= TAU;
    if (a > Math.PI) a -= TAU;
    else if (a <= -Math.PI) a += TAU;
    return a;
}

/** Ground forward vector for heading h: h = 0 faces -z, h grows turning right. */
export const fwdX = (h) => Math.sin(h);
export const fwdZ = (h) => -Math.cos(h);

/** The heading that faces from (x0, z0) toward (x1, z1). */
export const headingTo = (x0, z0, x1, z1) => Math.atan2(x1 - x0, -(z1 - z0));

/** Bearing of (x, z) seen from (px, pz) facing h: 0 dead ahead, + to the right, ±π behind. */
export function bearing(px, pz, h, x, z) {
    const dx = x - px, dz = z - pz;
    const f = dx * Math.sin(h) - dz * Math.cos(h);
    const r = dx * Math.cos(h) + dz * Math.sin(h);
    return Math.atan2(r, f);
}

/** Turn angle a toward b by at most step. */
export function turnToward(a, b, step) {
    const d = wrapA(b - a);
    return wrapA(a + clamp(d, -step, step));
}

/** Does the segment p0→p1 (3D) pass within r of the point c? */
export function segHits(ax, ay, az, bx, by, bz, cx, cy, cz, r) {
    const dx = bx - ax, dy = by - ay, dz = bz - az;
    const L = dx * dx + dy * dy + dz * dz;
    let t = L > 0 ? ((cx - ax) * dx + (cy - ay) * dy + (cz - az) * dz) / L : 0;
    t = clamp(t, 0, 1);
    const qx = ax + dx * t - cx, qy = ay + dy * t - cy, qz = az + dz * t - cz;
    return qx * qx + qy * qy + qz * qz <= r * r;
}

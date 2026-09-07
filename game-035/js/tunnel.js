/**
 * tunnel.js — shared polar/perspective math for the ring-tunnel.
 *
 * Everything in the game lives in (angle, z) space:
 *   angle — position around the tunnel ring, radians, wraps at 2*PI
 *   z     — depth, 0 = at the camera/ship plane, 1 = far away at the vanishing point
 *
 * projectRadius(z) turns depth into an on-screen radius using a simple
 * perspective falloff, matching the classic tube-shooter "flying down a
 * drain" look (Tempest, N2O). Reads live viewport.js values so the tunnel
 * adapts to any canvas size (responsive/mobile-friendly).
 */

import { viewport } from './viewport.js';

// Perspective falloff: z=0 -> shipR (ship's orbit), z=1 -> vanishR (vanishing point).
// Uses a gentle power curve (not 1/(1+kz), which collapses almost everything
// into the first 10% of z) so enemies spend most of their approach clearly
// spread out across the tunnel's depth, only rushing to a point at the very end.
const EXP = 2.2;

export function projectRadius(z) {
    const clamped = Math.min(1, Math.max(0, z));
    const t = Math.pow(clamped, EXP);
    return viewport.shipR + (viewport.vanishR - viewport.shipR) * t;
}

export function toScreen(angle, z) {
    const r = projectRadius(z);
    return {
        x: viewport.centerX + Math.cos(angle) * r,
        y: viewport.centerY + Math.sin(angle) * r,
        r,
    };
}

// Scale factor for sprite sizes at a given depth (things shrink as they recede).
// Kept gentler than a linear falloff so enemies stay clearly visible/aimable
// for most of their approach, only shrinking sharply right at the vanishing point.
export function depthScale(z) {
    const clamped = Math.min(1, Math.max(0, z));
    return Math.max(0.35, 1 - Math.pow(clamped, 1.6) * 0.75);
}

export function wrapAngle(a) {
    const TWO_PI = Math.PI * 2;
    a = a % TWO_PI;
    if (a < 0) a += TWO_PI;
    return a;
}

// Shortest signed angular distance from a to b (both radians)
export function angleDiff(a, b) {
    let d = wrapAngle(b - a);
    if (d > Math.PI) d -= Math.PI * 2;
    return d;
}

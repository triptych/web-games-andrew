// Aiming: where the muzzle is, where a shot will go, and how to aim at a point.
// Pure. predict() integrates exactly like the physics step (same gravity, damping and step), so
// the dotted arc on screen is where the ball really flies until it first touches something.

import { CANNON, AMMO, STEP } from '../config.js';
import { PHYS, rayBody } from './physics.js';

export function aimDir(aim) {
    const cp = Math.cos(aim.pitch);
    return [Math.sin(aim.yaw) * cp, Math.sin(aim.pitch), Math.cos(aim.yaw) * cp];
}

export function muzzle(aim) {
    const d = aimDir(aim);
    const p = CANNON.pivot;
    return { p: [p[0] + d[0] * CANNON.barrel, p[1] + d[1] * CANNON.barrel, p[2] + d[2] * CANNON.barrel], d };
}

export function clampAim(a) {
    return {
        yaw: Math.max(-CANNON.yawMax, Math.min(CANNON.yawMax, a.yaw)),
        pitch: Math.max(CANNON.pitchMin, Math.min(CANNON.pitchMax, a.pitch)),
    };
}

/**
 * The flight of a shot from aim with ammo kind. Returns { pts, hit, body, t }:
 * pts every `every` steps, hit = first contact point (or null), body = what it hits (null = ground).
 */
export function predict(G, aim, kind, maxT = 7, every = 3) {
    const A = AMMO[kind];
    const { p: p0, d } = muzzle(aim);
    const p = [...p0];
    const v = [d[0] * A.speed, d[1] * A.speed, d[2] * A.speed];
    const pts = [[...p]];
    const ld = 1 - PHYS.linDamp * STEP;
    const bodies = G.W.bodies.filter((b) => b.kind !== 'ball');
    for (let i = 1, t = 0; t < maxT; i++, t += STEP) {
        v[1] -= PHYS.gravity * STEP;
        v[0] *= ld; v[1] *= ld; v[2] *= ld;
        const dx = v[0] * STEP, dy = v[1] * STEP, dz = v[2] * STEP;
        const dist = Math.hypot(dx, dy, dz);
        const dir = [dx / dist, dy / dist, dz / dist];
        let tHit = dist, hitB = undefined;
        if (dy < 0) { const tg = (p[1] - A.r) / -dir[1]; if (tg >= 0 && tg < tHit) { tHit = tg; hitB = null; } }
        for (const b of bodies) {
            const ex = b.shape === 'sphere' ? b.r : Math.hypot(b.h[0], b.h[1], b.h[2]);
            const ddx = b.p[0] - p[0], ddy = b.p[1] - p[1], ddz = b.p[2] - p[2];
            const reach = dist + A.r + ex;
            if (ddx * ddx + ddy * ddy + ddz * ddz > reach * reach) continue;
            const th = rayBody(b, p, dir, tHit, A.r);
            if (th < tHit) { tHit = th; hitB = b; }
        }
        if (hitB !== undefined) {
            const hp = [p[0] + dir[0] * tHit, p[1] + dir[1] * tHit, p[2] + dir[2] * tHit];
            pts.push(hp);
            return { pts, hit: hp, body: hitB, t };
        }
        p[0] += dx; p[1] += dy; p[2] += dz;
        if (i % every === 0) pts.push([...p]);
    }
    return { pts, hit: null, body: null, t: maxT };
}

/**
 * Aim at a world point with a shot of the given speed. Returns the low and the high arc
 * ({ yaw, pitch }), or [] if out of range. Ignores damping (the bot corrects with predict()).
 */
export function solveAim(target, speed) {
    const piv = CANNON.pivot;
    const yaw = Math.atan2(target[0] - piv[0], target[2] - piv[2]);
    const g = PHYS.gravity;
    const out = [];
    // iterate: the muzzle moves with pitch, so solve from the pivot and refine twice
    for (const high of [false, true]) {
        let pitch = high ? 0.9 : 0.1;
        let okk = true;
        for (let k = 0; k < 4; k++) {
            const m = muzzle({ yaw, pitch }).p;
            const dx = Math.hypot(target[0] - m[0], target[2] - m[2]);
            const dy = target[1] - m[1];
            const v2 = speed * speed;
            const disc = v2 * v2 - g * (g * dx * dx + 2 * dy * v2);
            if (disc < 0) { okk = false; break; }
            const r = Math.sqrt(disc);
            pitch = Math.atan((v2 + (high ? r : -r)) / (g * dx));
        }
        if (okk) out.push(clampAim({ yaw, pitch }));
    }
    return out;
}

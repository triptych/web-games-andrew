/**
 * physics.js — moving bodies through a space (the exterior or an interior cell).
 *
 * A space answers: ground(x, z, feet) → floor height, normal(x, z) → ground normal,
 * water(x, z) → water surface or −1000, colliders → static shapes, clamp(p) → world bounds.
 */
import { Colliders } from './colliders.js';
import { WORLD } from './geography.js';

export const PHYS = {
    gravity: 15,
    jump: 5.4,
    step: 0.45,
    slopeMax: 0.68,     // ground normal y below this is too steep to climb (~47°)
    swimDepth: 1.25,
};

export class ExteriorSpace {
    constructor(terrain, colliders = new Colliders()) {
        this.kind = 'ext';
        this.terrain = terrain;
        this.colliders = colliders;
        this._tmp = [];
        this._n = { x: 0, y: 1, z: 0 };
    }
    ground(x, z, feet) {
        const t = this.terrain.heightAt(x, z);
        const f = this.colliders.floorAt(x, z, feet, PHYS.step, this._tmp);
        return f > t ? f : t;
    }
    onPlatform(x, z, feet) { return this.colliders.floorAt(x, z, feet, PHYS.step, this._tmp) > this.terrain.heightAt(x, z) + 0.05; }
    normal(x, z) { return this.terrain.normalAt(x, z, this._n); }
    water(x, z) { return this.terrain.waterAt(x, z); }
    clamp(p) {
        const B = WORLD.BORDER;
        if (p.x < -B) p.x = -B; else if (p.x > B) p.x = B;
        if (p.z < -B) p.z = -B; else if (p.z > B) p.z = B;
    }
}

/**
 * body: { pos, vel, r, h, onGround, swim, airTime, fallStart }
 * wish: { x, z, jump, speed }
 * Returns { landed: fall height in m or 0 }.
 */
export function moveBody(body, wish, dt, space) {
    const p = body.pos, v = body.vel;
    const out = { landed: 0, bumped: false };
    const water = space.water(p.x, p.z);
    const depth = water - p.y;
    body.swim = depth > PHYS.swimDepth;
    body.wade = depth > 0.3 && !body.swim;
    const accel = body.swim ? 5 : body.onGround ? 16 : 2.2;
    const k = Math.min(1, accel * dt);
    v.x += (wish.x - v.x) * k;
    v.z += (wish.z - v.z) * k;

    // steep ground: no climbing, and a slide down the fall line
    if (body.onGround && !body.swim && space.kind === 'ext' && !space.onPlatform(p.x, p.z, p.y)) {
        const n = space.normal(p.x, p.z);
        if (n.y < PHYS.slopeMax) {
            const hl = Math.hypot(n.x, n.z) || 1;
            const dx = n.x / hl, dz = n.z / hl;          // downhill
            const up = -(v.x * dx + v.z * dz);            // speed uphill
            if (up > 0) { v.x += dx * up; v.z += dz * up; }
            const slide = (PHYS.slopeMax - n.y) * 28;
            v.x += dx * slide * dt; v.z += dz * slide * dt;
            body.sliding = true;
        } else body.sliding = false;
    } else body.sliding = false;

    // vertical
    if (body.swim) {
        const target = water - PHYS.swimDepth - 0.1;
        v.y += ((target - p.y) * 4 - v.y) * Math.min(1, 6 * dt);
        if (wish.jump) v.y = Math.max(v.y, 1.5);
    } else {
        if (wish.jump && body.onGround) { v.y = PHYS.jump; body.onGround = false; body.jumped = true; }
        v.y -= PHYS.gravity * dt;
        if (v.y < -55) v.y = -55;
    }

    const nx = p.x + v.x * dt, nz = p.z + v.z * dt;
    let ny = p.y + v.y * dt;
    const q = { x: nx, z: nz };
    if (space.colliders.resolve(q, body.r, ny, ny + body.h, PHYS.step, space._tmp)) out.bumped = true;
    space.clamp(q);
    if (space.blocked && space.blocked(q, body.r, ny)) out.bumped = true;

    const g = space.ground(q.x, q.z, Math.max(ny, p.y));
    const wasGround = body.onGround;
    if (ny <= g + 0.001 || (wasGround && v.y <= 0.01 && ny - g < 0.55 && !body.swim)) {
        if (!wasGround && body.fallStart != null) {
            const fall = body.fallStart - g;
            if (fall > 0.5) out.landed = fall;
        }
        ny = g;
        if (v.y < 0) v.y = 0;
        body.onGround = true;
        body.fallStart = null;
    } else {
        if (body.onGround) body.fallStart = p.y;
        body.onGround = false;
        if (body.fallStart == null || ny > body.fallStart) body.fallStart = Math.max(ny, body.fallStart ?? ny);
    }
    if (body.swim) { body.onGround = false; body.fallStart = null; }
    p.x = q.x; p.z = q.z; p.y = ny;
    return out;
}

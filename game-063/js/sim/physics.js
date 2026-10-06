// The ball. One integrator handles flight, bounces and rolling: gravity always pulls, contact with the
// heightfield removes the normal velocity (bouncing it if it is fast enough), and rolling friction acts
// while the ball is touching. Rolling over a crest therefore launches the ball again for free.
//
// Sub-steps keep every move under 0.18 units, so nothing tunnels through a 0.7-unit trunk.

import { SURF, SURF_PHYS } from './realms.js';
import { BALL_R, CUP_R } from './course.js';

const BOUNCE_MIN = 2.2;   // normal speed below which a landing becomes a roll
const REST_SPEED = 0.14;
const DRAG = 0.0016;      // quadratic air drag
const CUP_CAPTURE = 4.6;  // max speed for the ball to drop
const _n = { x: 0, y: 1, z: 0 };

export function newBall(x, y, z) {
    return { x, y, z, vx: 0, vy: 0, vz: 0, check: 1, state: 'rest', contact: true, spin: 0, air: 0, t: 0, landed: false, bounces: 0, surf: SURF.tee, inCanopy: 0 };
}

// fx: per-shot effects { ghost, fire, frost, seek, sticky, spring, windK, bounceK, rollK }
// env: { course, fx, wind:{x,z}, colliders (static), dyn (moving), patches, cup, sealed,
//        onHit(col, speed, ball) → 'pass' to ignore the bounce, onPickup, onTrigger, onBurn, emit }
export function stepBall(b, dt, env) {
    if (b.state !== 'moving') return;
    const sp = Math.hypot(b.vx, b.vy, b.vz);
    const n = Math.min(12, Math.max(1, Math.ceil((sp * dt) / 0.18)));
    const h = dt / n;
    for (let i = 0; i < n && b.state === 'moving'; i++) substep(b, h, env);
}

function substep(b, dt, env) {
    const c = env.course;
    const fx = env.fx;
    const g = c.gravity;
    b.t += dt;
    // ---- forces
    let ax = 0, ay = -g, az = 0;
    if (!b.contact) {
        b.air += dt;
        const sp = Math.hypot(b.vx, b.vy, b.vz);
        const drag = DRAG * sp * (b.inCanopy > 0 ? 40 : 1);
        ax -= b.vx * drag; ay -= b.vy * drag; az -= b.vz * drag;
        const wk = fx.windK;
        ax += env.wind.x * wk; az += env.wind.z * wk;
        if (b.spin) {
            const hs = Math.hypot(b.vx, b.vz) || 1;
            // right of travel is (-vz, vx); positive spin slices right
            ax += (-b.vz / hs) * b.spin * 6.5; az += (b.vx / hs) * b.spin * 6.5;
            b.spin *= Math.exp(-dt * 0.35);
        }
    }
    if (fx.seek && env.cup) {
        const dx = env.cup.x - b.x, dz = env.cup.z - b.z;
        const d = Math.hypot(dx, dz);
        if (d < 14 && d > 0.05) {
            const k = (1 - d / 14) * 26;
            // steer the horizontal velocity toward the cup without adding much speed
            const hs = Math.hypot(b.vx, b.vz);
            if (hs > 0.3) {
                const tx = (dx / d) * hs, tz = (dz / d) * hs;
                ax += (tx - b.vx) * k * 0.12; az += (tz - b.vz) * k * 0.12;
            }
        }
    }
    b.vx += ax * dt; b.vy += ay * dt; b.vz += az * dt;
    b.x += b.vx * dt; b.y += b.vy * dt; b.z += b.vz * dt;
    if (b.inCanopy > 0) b.inCanopy -= dt;

    // ---- world edges
    if (b.y < -30) { hazard(b, env, 'void'); return; }

    // ---- ground
    let gh = c.heightAt(b.x, b.z);
    let sid = c.surfAt(b.x, b.z);
    for (const p of env.patches) if ((b.x - p.x) ** 2 + (b.z - p.z) ** 2 < p.r * p.r && sid !== SURF.void) sid = p.sid;
    let wl = -Infinity;
    if (sid === SURF.water || sid === SURF.lava) {
        wl = c.waterLevelAt(b.x, b.z);
        if (fx.frost && b.y - BALL_R < wl + 0.05) { gh = Math.max(gh, wl); sid = SURF.ice; if (!b.frostFx) { b.frostFx = true; env.emit('frostSkate', { x: b.x, z: b.z }); } }
        else if (b.y < wl + BALL_R * 0.5) { hazard(b, env, sid === SURF.lava ? 'lava' : 'water'); return; }
    }
    const pen = gh + BALL_R - b.y;
    b.contact = false;
    if (pen > -0.025 && sid !== SURF.void) {
        const nrm = c.normalAt(b.x, b.z, _n);
        const phys = SURF_PHYS[sid];
        if (phys.hazard) { hazard(b, env, phys.hazard); return; }
        if (pen > 0) b.y = gh + BALL_R;
        const vn = b.vx * nrm.x + b.vy * nrm.y + b.vz * nrm.z;
        b.surf = sid;
        if (vn < 0) {
            if (!b.landed) { b.landed = true; b.firstLand = { x: b.x, z: b.z, sid }; env.emit('land', { surf: sid, x: b.x, y: b.y, z: b.z, speed: -vn }); }
            if (phys.stop || (fx.sticky && b.air > 0.15)) { b.vx = b.vy = b.vz = 0; rest(b, env); return; }
            const e = (phys.e ?? 0.3) * fx.bounceK * (fx.spring ? 2.1 : 1);
            if (-vn > BOUNCE_MIN && !(phys.plug && -vn > 3 && b.bounces < 4)) {
                // bounce: reflect the normal part, lose some tangential speed
                const tx = b.vx - vn * nrm.x, ty = b.vy - vn * nrm.y, tz = b.vz - vn * nrm.z;
                // backspin bites on the first landing: drivers release, wedges check up
                const keep = (1 - phys.ft) * (b.bounces === 0 && b.air > 0.3 ? b.check ?? 1 : 1);
                let out = -vn * Math.min(e, 1.4);
                if (phys.minUp && out > 1) out = Math.max(out, phys.minUp);
                b.vx = tx * keep + nrm.x * out; b.vy = ty * keep + nrm.y * out; b.vz = tz * keep + nrm.z * out;
                b.bounces++;
                if (out > 1) { b.air = 0; env.emit('bounce', { surf: sid, speed: -vn, x: b.x, y: b.y, z: b.z }); }
                else { b.vx -= nrm.x * out; b.vy -= nrm.y * out; b.vz -= nrm.z * out; }
            } else if (phys.plug && -vn > 3 && b.bounces < 4) {
                // plugged in sand or snow
                b.vx *= 0.08; b.vz *= 0.08; b.vy = 0;
                env.emit('plug', { surf: sid, x: b.x, y: b.y, z: b.z });
            } else {
                b.vx -= vn * nrm.x; b.vy -= vn * nrm.y; b.vz -= vn * nrm.z;
            }
        }
        b.contact = true;
        // rolling friction
        const mu = (phys.mu ?? 0.6) * fx.rollK;
        const vt = Math.hypot(b.vx, b.vy, b.vz);
        const dec = mu * g * nrm.y * dt;
        if (vt <= dec) { b.vx = b.vy = b.vz = 0; }
        else { const k = 1 - dec / vt; b.vx *= k; b.vy *= k; b.vz *= k; }
        // at rest? only if the slope can hold it
        if (Math.hypot(b.vx, b.vy, b.vz) < REST_SPEED) {
            const slope = Math.sqrt(Math.max(0, 1 - nrm.y * nrm.y));
            if (slope < Math.max(mu, 0.1) * 0.9 * nrm.y || b.t > 40) { b.vx = b.vy = b.vz = 0; rest(b, env); return; }
        }
    }

    // ---- cup
    if (env.cup) {
        const dx = b.x - env.cup.x, dz = b.z - env.cup.z;
        const d2 = dx * dx + dz * dz;
        if (env.sealed) {
            // the Bogey Seal: a dome over the cup that bounces the ball off
            const dy = b.y - env.cup.y;
            const d = Math.sqrt(d2 + dy * dy);
            const R = 1.3 + BALL_R;
            if (d < R && d > 1e-6) {
                const nx = dx / d, ny = dy / d, nz = dz / d;
                b.x = env.cup.x + nx * R; b.y = env.cup.y + ny * R; b.z = env.cup.z + nz * R;
                const vn = b.vx * nx + b.vy * ny + b.vz * nz;
                if (vn < 0) { b.vx -= 1.6 * vn * nx; b.vy -= 1.6 * vn * ny; b.vz -= 1.6 * vn * nz; env.emit('sealBounce', { x: b.x, y: b.y, z: b.z }); }
            }
        } else if (d2 < CUP_R * CUP_R && b.y - env.cup.y < BALL_R + 0.35) {
            const hs = Math.hypot(b.vx, b.vz);
            const vs = Math.hypot(hs, b.vy);
            if (vs < CUP_CAPTURE || (b.vy < 0 && hs < CUP_CAPTURE * 1.8 && b.y - env.cup.y < BALL_R + 0.2)) {
                b.state = 'holed'; b.vx = b.vz = 0; b.vy = 0; b.x = env.cup.x; b.z = env.cup.z; b.y = env.cup.y - 0.25;
                env.emit('holed', { speed: vs });
                return;
            }
            if (!b.lipped) {
                b.lipped = true;
                // lip out: kick the ball off the rim, rattle, lose speed
                const d = Math.sqrt(d2) || 0.01;
                const nx = dx / d, nz = dz / d;
                const vr = b.vx * nx + b.vz * nz;
                b.vx = (b.vx - 1.6 * Math.min(0, vr) * nx) * 0.62; b.vz = (b.vz - 1.6 * Math.min(0, vr) * nz) * 0.62;
                b.vy = Math.max(b.vy, 1.4);
                env.emit('lipout', { x: b.x, z: b.z });
            }
        } else if (d2 > (CUP_R + 0.3) ** 2) b.lipped = false;
    }

    // ---- colliders
    if (fx.ghost) { pickups(b, env); return; }
    for (let pass = 0; pass < 2; pass++) {
        const cols = pass ? env.dyn : env.colliders;
        for (let k = 0; k < cols.length; k++) {
            const C = cols[k];
            if (C.off) continue;
            const dx = b.x - C.bx, dy = b.y - C.by, dz = b.z - C.bz;
            const reach = C.br + BALL_R + 0.05;
            if (dx * dx + dy * dy + dz * dz > reach * reach) continue;
            collide(b, C, env, dt);
            if (b.state !== 'moving') return;
        }
    }
    pickups(b, env);
}

// Closest point on a collider to the ball centre → push out and reflect.
const _q = { x: 0, y: 0, z: 0 };
function collide(b, C, env, dt) {
    let qx, qy, qz, rr;
    if (C.kind === 'sphere') { qx = C.x; qy = C.y; qz = C.z; rr = C.r; }
    else if (C.kind === 'capsule') {
        const vx = C.cx - C.ax, vy = C.cy - C.ay, vz = C.cz - C.az;
        const l2 = vx * vx + vy * vy + vz * vz || 1e-9;
        let t = ((b.x - C.ax) * vx + (b.y - C.ay) * vy + (b.z - C.az) * vz) / l2;
        t = t < 0 ? 0 : t > 1 ? 1 : t;
        qx = C.ax + vx * t; qy = C.ay + vy * t; qz = C.az + vz * t; rr = C.r;
    } else {
        // box in its own yaw frame (x across, z along)
        const dx = b.x - C.x, dz = b.z - C.z;
        let u = dx * C.cs - dz * C.sn, w = dx * C.sn + dz * C.cs;
        let y = b.y - C.y;
        const inside = Math.abs(u) < C.hx && Math.abs(w) < C.hz && Math.abs(y) < C.hy;
        if (inside) {
            // push out along the axis of least penetration
            const pu = C.hx - Math.abs(u), pw = C.hz - Math.abs(w), py = C.hy - Math.abs(y);
            if (pu <= pw && pu <= py) u = Math.sign(u || 1) * C.hx; else if (pw <= py) w = Math.sign(w || 1) * C.hz; else y = Math.sign(y || 1) * C.hy;
        } else {
            u = Math.max(-C.hx, Math.min(C.hx, u)); w = Math.max(-C.hz, Math.min(C.hz, w)); y = Math.max(-C.hy, Math.min(C.hy, y));
        }
        qx = C.x + u * C.cs + w * C.sn; qz = C.z - u * C.sn + w * C.cs; qy = C.y + y; rr = 0;
        if (inside) {
            const nx = b.x - qx, ny = b.y - qy, nz = b.z - qz;
            const l = Math.hypot(nx, ny, nz) || 1;
            // centre was inside: flip so we push outward through the nearest face
            _q.x = qx; _q.y = qy; _q.z = qz;
            b.x = qx - (nx / l) * BALL_R; b.y = qy - (ny / l) * BALL_R; b.z = qz - (nz / l) * BALL_R;
            return resolve(b, C, env, -nx / l, -ny / l, -nz / l, 0);
        }
    }
    const dx = b.x - qx, dy = b.y - qy, dz = b.z - qz;
    const d = Math.hypot(dx, dy, dz);
    const R = rr + BALL_R;
    if (d >= R) return;
    if (C.soft) {
        // canopy: leaves soak up speed and nudge the ball sideways
        if (b.inCanopy <= 0) env.emit('leaves', { x: b.x, y: b.y, z: b.z, col: C });
        b.inCanopy = 0.08;
        if (env.fx.fire) { env.onBurn(C); return; }
        const k = Math.exp(-dt * 5.5);
        b.vx *= k; b.vz *= k; if (b.vy > 0) b.vy *= k;
        return;
    }
    const nx = d > 1e-6 ? dx / d : 0, ny = d > 1e-6 ? dy / d : 1, nz = d > 1e-6 ? dz / d : 0;
    b.x = qx + nx * R; b.y = qy + ny * R; b.z = qz + nz * R;
    resolve(b, C, env, nx, ny, nz, rr);
}

function resolve(b, C, env, nx, ny, nz) {
    const rvx = b.vx - (C.vx ?? 0), rvy = b.vy - (C.vy ?? 0), rvz = b.vz - (C.vz ?? 0);
    const vn = rvx * nx + rvy * ny + rvz * nz;
    if (vn >= 0) return;
    const speed = Math.hypot(rvx, rvy, rvz);
    // a hit callback may consume the collision (monsters, boss parts, ice walls)
    if (C.tag !== 'trunk' && C.tag !== 'rock' && env.onHit) {
        const r = env.onHit(C, speed, b);
        if (r === 'pass') return;
    }
    const e = C.e * (env.fx.spring ? 1.5 : 1);
    b.vx -= (1 + e) * vn * nx; b.vy -= (1 + e) * vn * ny; b.vz -= (1 + e) * vn * nz;
    if (C.minUp && b.vy < C.minUp) b.vy = C.minUp;
    if (C.minOut) {
        const out = b.vx * nx + b.vy * ny + b.vz * nz;
        if (out < C.minOut) { const k = C.minOut - out; b.vx += nx * k; b.vy += ny * k; b.vz += nz * k; }
    }
    b.contact = false; b.air = 0.01;
    if (speed > 1.5) env.emit('thunk', { tag: C.tag, speed, x: b.x, y: b.y, z: b.z });
}

function pickups(b, env) {
    const pk = env.pickups;
    for (let i = 0; i < pk.length; i++) {
        const p = pk[i];
        if (p.got) continue;
        const dx = b.x - p.x, dy = b.y - p.y, dz = b.z - p.z;
        if (dx * dx + dy * dy + dz * dz < 1.0) env.onPickup(p, i);
    }
    // triggers: geysers and runes
    if (env.onTrigger) env.onTrigger(b);
}

function rest(b, env) {
    b.state = 'rest';
    env.emit('rest', { x: b.x, y: b.y, z: b.z, surf: b.surf });
}

function hazard(b, env, kind) {
    b.state = 'hazard';
    b.hazard = kind;
    env.emit('hazard', { kind, x: b.x, y: b.y, z: b.z });
}

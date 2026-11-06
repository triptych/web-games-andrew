// Regular enemy behaviour: infantry, drones, light and heavy mechs, turrets. Pure.

import { ENEMY_WAKE_DIST } from '../config.js';
import { enemyDef, moveBody, shoot, lob, ev, yawOf, angDiff, clamp, lvOf } from './core.js';

const PI2 = Math.PI * 2;

export function muzzle(e, back = 0) {
    const s = Math.sin(e.yaw), c = -Math.cos(e.yaw);
    return { x: e.x + s * (e.r * 0.9 + back), y: e.y + (e.fly ? 0 : e.h * 0.62), z: e.z + c * (e.r * 0.9 + back) };
}

/** A bolt aimed at the walker, with lead and spread. */
export function fireAt(G, e, o = {}) {
    const p = G.player, m = muzzle(e);
    const speed = o.speed || 36, lead = o.lead ?? 0.35;
    const tx0 = p.x, tz0 = p.z, ty = p.y + G.st.eye * 0.55;
    const d0 = Math.hypot(tx0 - m.x, tz0 - m.z);
    const tt = d0 / speed * lead;
    const tx = tx0 + p.vx * tt, tz = tz0 + p.vz * tt;
    let dx = tx - m.x, dy = ty - m.y, dz = tz - m.z;
    const sp = o.spread ?? 0.05;
    dx += (G.rng() - 0.5) * sp * d0; dz += (G.rng() - 0.5) * sp * d0; dy += (G.rng() - 0.5) * sp * d0 * 0.5;
    const l = Math.hypot(dx, dy, dz) || 1;
    const lv = lvOf(G);
    shoot(G, { team: 'e', kind: o.kind || 'bolt', x: m.x, y: m.y, z: m.z, dx: dx / l, dy: dy / l, dz: dz / l, speed, dmg: (o.dmg || 4) * lv.dmgScale,
        splash: o.splash || 0, life: o.life ?? 2.4, r: o.r ?? 0.3, col: o.col || 0, grav: o.grav || 0, turn: o.turn || 0, tgt: o.tgt || 0 });
    ev(G, { type: 'shot', team: 'e', kind: e.type, x: m.x, y: m.y, z: m.z, id: e.id });
}

export function lobAt(G, e, o = {}) {
    const p = G.player, m = muzzle(e);
    const hv = o.hv || 24, g = o.g || 14;
    const d0 = Math.hypot(p.x - m.x, p.z - m.z);
    const tt = d0 / hv;
    const tx = p.x + p.vx * tt * 0.8 + (o.sx ? (G.rng() - 0.5) * o.sx : 0), tz = p.z + p.vz * tt * 0.8 + (o.sx ? (G.rng() - 0.5) * o.sx : 0);
    const a = lob(m.x, m.y, m.z, tx, G.world.h(tx, tz) + 0.5, tz, hv, g);
    shoot(G, { team: 'e', kind: o.kind || 'shell', x: m.x, y: m.y, z: m.z, dx: a.dx, dy: a.dy, dz: a.dz, speed: a.speed, dmg: (o.dmg || 26) * lvOf(G).dmgScale,
        splash: o.splash ?? 4, life: a.T + 1.5, r: 0.5, grav: g, fire: o.fire || 0 });
    ev(G, { type: 'shot', team: 'e', kind: e.type, x: m.x, y: m.y, z: m.z, id: e.id, heavy: true });
}

function walk(G, e, dt, tx, tz, speed, accel = 30) {
    const dx = tx - e.x, dz = tz - e.z, d = Math.hypot(dx, dz) || 1;
    const k = Math.min(1, d / 1.5);
    const wx = dx / d * speed * k, wz = dz / d * speed * k;
    const a = accel * dt;
    e.vx += clamp(wx - e.vx, -a, a); e.vz += clamp(wz - e.vz, -a, a);
}

function settle(G, e, dt) {
    const gy = G.world.h(e.x, e.z) + e.fly;
    e.y += (gy - e.y) * Math.min(1, (e.fly ? 3 : 14) * dt);
}

export function updateEnemy(G, e, dt) {
    const p = G.player, d = enemyDef(e.type);
    e.flash = Math.max(0, e.flash - dt);
    e.t += dt;
    const dx = p.x - e.x, dz = p.z - e.z, dist = Math.hypot(dx, dz);
    if (dist > ENEMY_WAKE_DIST) { settle(G, e, dt); return; }
    if (!e.awake) {
        if (dist < d.aggro) { e.awake = true; if (e.camp >= 0) G.alert[e.camp] = 1; }
        else if (e.camp >= 0 && G.alert[e.camp]) {            // the camp's alarm reaches its units a moment apart
            if (e.wakeT === undefined) e.wakeT = (e.id % 7) * 0.45;
            e.wakeT -= dt;
            if (e.wakeT <= 0) e.awake = true;
            settle(G, e, dt); return;
        } else { settle(G, e, dt); return; }
    }
    // knocked about by blasts
    if (e.kd > 0) {
        e.kd -= dt;
        e.x += e.vx * dt; e.z += e.vz * dt;
        e.vx *= 0.9; e.vz *= 0.9;
        moveBody(G, e, 0, e.r, 1, 0.5, false, true);
        settle(G, e, dt);
        return;
    }
    const want = yawOf(dx, dz);
    const turn = (e.type === 'turret' ? 3 : 4.5) * dt;
    e.yaw += clamp(angDiff(e.yaw, want), -turn, turn);
    e.cd -= dt; e.cd2 -= dt;
    if (e.st !== undefined) e.dirT = (e.dirT || 0) - dt;
    if (e.dirT <= 0) { e.dirT = 1.6 + (e.id % 5) * 0.4; e.dir = -e.dir; }
    const px = -dz / (dist || 1) * e.dir, pz = dx / (dist || 1) * e.dir;      // strafe direction
    const fx = dx / (dist || 1), fz = dz / (dist || 1);
    let spd = d.spd, goalX = e.x, goalZ = e.z, move = true;

    switch (e.type) {
        case 'trooper': {
            if (dist > 22) { goalX = e.x + fx * 10; goalZ = e.z + fz * 10; }
            else if (dist < 11) { goalX = e.x - fx * 10 + px * 3; goalZ = e.z - fz * 10 + pz * 3; }
            else { goalX = e.x + px * 8; goalZ = e.z + pz * 8; spd *= 0.7; }
            if (e.burst > 0 && e.cd2 <= 0) { fireAt(G, e, { speed: 34, dmg: 2.6, spread: 0.1, col: 0xffa040 }); e.burst--; e.cd2 = 0.13; }
            else if (e.burst <= 0 && e.cd <= 0 && dist < 34) { e.burst = 2; e.cd = 1.6 + (e.id % 7) * 0.15; e.cd2 = 0.2; }
            break;
        }
        case 'rocketeer': {
            if (dist > 36) { goalX = e.x + fx * 10; goalZ = e.z + fz * 10; }
            else if (dist < 20) { goalX = e.x - fx * 10; goalZ = e.z - fz * 10; }
            else { goalX = e.x + px * 8; goalZ = e.z + pz * 8; spd *= 0.5; }
            if (e.cd <= 0 && dist < 46) { fireAt(G, e, { kind: 'rocket', speed: 21, dmg: 10, splash: 3, life: 4, r: 0.4, lead: 0.7, spread: 0.03 }); e.cd = 3.6 + (e.id % 5) * 0.25; }
            break;
        }
        case 'wasp': {
            e.st += dt * 0.7 * e.dir;
            const R = 18 + Math.sin(e.t * 0.7 + e.id) * 5;
            goalX = p.x + Math.cos(e.st + e.id) * R; goalZ = p.z + Math.sin(e.st + e.id) * R;
            e.fly = 6 + Math.sin(e.t * 1.3 + e.id) * 1.6;
            if (e.burst > 0 && e.cd2 <= 0) { fireAt(G, e, { speed: 40, dmg: 4, spread: 0.07, col: 0x9cff5a }); e.burst--; e.cd2 = 0.1; }
            else if (e.burst <= 0 && e.cd <= 0 && dist < 42) { e.burst = 3; e.cd = 2.2 + (e.id % 6) * 0.15; }
            break;
        }
        case 'stalker': {
            if (dist > 27) { goalX = e.x + fx * 10; goalZ = e.z + fz * 10; }
            else if (dist < 13) { goalX = e.x - fx * 10 + px * 4; goalZ = e.z - fz * 10 + pz * 4; spd *= 1.1; }
            else { goalX = e.x + px * 8; goalZ = e.z + pz * 8; spd *= 0.6; }
            if (e.burst > 0 && e.cd2 <= 0) { fireAt(G, e, { speed: 38, dmg: 6, spread: 0.08, r: 0.35, col: 0xff5a3a }); e.burst--; e.cd2 = 0.11; }
            else if (e.burst <= 0 && e.cd <= 0 && dist < 38) { e.burst = 4; e.cd = 1.9 + (e.id % 4) * 0.2; }
            break;
        }
        case 'bulwark': {
            if (dist > 30) { goalX = e.x + fx * 10; goalZ = e.z + fz * 10; }
            else if (dist < 16) { goalX = e.x - fx * 10; goalZ = e.z - fz * 10; }
            else move = false;
            if (e.cd <= 0 && dist < 52) { lobAt(G, e, { hv: 24, g: 14, dmg: 26, splash: 4, sx: 3 }); e.cd = 3.4 + (e.id % 4) * 0.2; }
            if (e.burst > 0 && e.cd2 <= 0) { fireAt(G, e, { speed: 36, dmg: 3.5, spread: 0.08, col: 0xffaa33 }); e.burst--; e.cd2 = 0.09; }
            else if (e.burst <= 0 && dist < 30 && e.cd2 <= -1.6) { e.burst = 6; }
            break;
        }
        case 'turret': {
            move = false;
            if (e.burst > 0 && e.cd2 <= 0) { fireAt(G, e, { speed: 42, dmg: 3.6, spread: 0.06, col: 0xff4488 }); e.burst--; e.cd2 = 0.1; }
            else if (e.burst <= 0 && e.cd <= 0 && dist < 56) { e.burst = 4; e.cd = 2.8 + (e.id % 4) * 0.2; }
            break;
        }
        default: move = false;      // pylon
    }

    if (move && spd > 0) {
        walk(G, e, dt, goalX, goalZ, spd);
        moveBody(G, e, dt, e.r, d.inf ? 1.0 : 0.9, d.inf ? 0.7 : 1.2, !!e.fly, !!e.fly);
    } else { e.vx *= 0.8; e.vz *= 0.8; }
    // keep infantry from standing inside the walker
    const min = e.r + G.st.rad * 0.7;
    if (dist < min && !e.fly) { e.x -= fx * (min - dist) * 0.3; e.z -= fz * (min - dist) * 0.3; }
    settle(G, e, dt);
    void PI2;
}

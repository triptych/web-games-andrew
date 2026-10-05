// Enemy behaviour: approach, orbit-strafe with lead-aimed fire, break off when too close, flee when hurt.

import { forwardOf, yawPitchTo, wrapAngle, clamp, vdist, vlen } from './vec.js';

export function leadPoint(shooterPos, targetPos, targetVel, boltSpeed) {
    const dx = targetPos.x - shooterPos.x, dy = targetPos.y - shooterPos.y, dz = targetPos.z - shooterPos.z;
    const d = Math.hypot(dx, dy, dz);
    const t = Math.min(2.5, d / boltSpeed);
    return { x: targetPos.x + targetVel.x * t, y: targetPos.y + targetVel.y * t, z: targetPos.z + targetVel.z * t };
}

export function steerToward(e, aim, turn, dt) {
    const want = yawPitchTo(e.pos, aim);
    const dy = wrapAngle(want.yaw - e.yaw);
    const dp = want.pitch - e.pitch;
    const step = turn * dt;
    e.yaw = wrapAngle(e.yaw + clamp(dy, -step, step));
    e.pitch = clamp(e.pitch + clamp(dp, -step, step), -1.2, 1.2);
    e.bank = clamp((e.bank || 0) * 0.9 + clamp(dy, -1, 1) * 0.12, -0.9, 0.9);
    return Math.abs(dy) + Math.abs(dp);
}

export function stepEnemy(w, e, dt) {
    const p = w.player;
    const def = e.def;
    e.t += dt;
    e.fireCd -= dt;
    const d = vdist(e.pos, p.pos);
    let aim = p.pos;
    let speed = def.speed;
    const hurt = e.hp < e.maxHp * def.flee;

    if (p.dead || w.docked) {
        // Wander off.
        aim = { x: e.pos.x + Math.sin(e.t * 0.3 + e.id) * 500, y: e.pos.y, z: e.pos.z + Math.cos(e.t * 0.3 + e.id) * 500 };
    } else if (hurt) {
        e.state = 'flee';
        aim = { x: e.pos.x * 2 - p.pos.x, y: e.pos.y * 2 - p.pos.y, z: e.pos.z * 2 - p.pos.z };
        speed *= 1.2;
        if (d > 3200) e.gone = true;
    } else if (e.state === 'break') {
        aim = e.breakAim;
        speed *= 1.15;
        if (e.t > e.breakUntil) e.state = 'attack';
    } else if (d > 700) {
        e.state = 'approach';
        speed *= d > 1500 ? 1.45 : 1.15;
    } else {
        e.state = 'attack';
        // Orbit-strafe: aim at a point offset sideways from the player, rotating over time.
        const lead = leadPoint(e.pos, p.pos, p.vel, 620);
        const ang = e.t * 0.55 * e.strafe + e.id;
        const off = 160 + def.size * 50;
        aim = { x: lead.x + Math.cos(ang) * off, y: lead.y + Math.sin(ang * 0.7) * off * 0.4, z: lead.z + Math.sin(ang) * off };
        if (d < 120 + def.size * 30) {
            e.state = 'break';
            e.t = 0;
            e.breakUntil = 1.4;
            const f = forwardOf(e.yaw + e.strafe * 1.2, e.pitch * 0.3);
            e.breakAim = { x: e.pos.x + f.x * 800, y: e.pos.y + f.y * 800 + (e.id % 2 ? 200 : -200), z: e.pos.z + f.z * 800 };
        }
    }
    steerToward(e, aim, def.turn, dt);
    const f = forwardOf(e.yaw, e.pitch);
    const tv = { x: f.x * speed, y: f.y * speed, z: f.z * speed };
    const k = Math.min(1, dt * 2.2);
    e.vel.x += (tv.x - e.vel.x) * k; e.vel.y += (tv.y - e.vel.y) * k; e.vel.z += (tv.z - e.vel.z) * k;
    e.pos.x += e.vel.x * dt; e.pos.y += e.vel.y * dt; e.pos.z += e.vel.z * dt;

    // Fire when the lead point is near the nose.
    if (!p.dead && !w.docked && e.state !== 'flee' && d < def.range && e.fireCd <= 0) {
        const lead = leadPoint(e.pos, p.pos, p.vel, 620);
        const dir = { x: lead.x - e.pos.x, y: lead.y - e.pos.y, z: lead.z - e.pos.z };
        const L = vlen(dir) || 1;
        const dot = (dir.x * f.x + dir.y * f.y + dir.z * f.z) / L;
        if (dot > 0.965) {
            e.fireCd = 1 / def.rate * (0.8 + w.game.rng.next() * 0.5);
            // A little inaccuracy so bolts are dodgeable.
            const spread = 0.035;
            const r = w.game.rng;
            const nd = { x: dir.x / L + r.range(-spread, spread), y: dir.y / L + r.range(-spread, spread), z: dir.z / L + r.range(-spread, spread) };
            w.spawnBolt(e.pos, nd, 620, e.dmg, 'enemy', def.faction, e.def.size);
        }
    }
}

/**
 * dragon.js — how dragons fight: circle overhead, strafe and hover breathing fire or frost,
 * land when Skybroken or hurt, bite and tail-sweep on the ground, take off again.
 */
import { moveBody } from './physics.js';
import { breathCone } from './combat.js';
import { applyDamage } from './actor.js';
import { hostile } from './ai.js';
import { TEMPLATES } from './actors.js';
import { angDiff } from './rng.js';

const fwd = (a) => ({ x: -Math.sin(a.yaw), z: -Math.cos(a.yaw) });

export function initDragon(world, a, target, from = null) {
    a.fly = true;
    a.ai = { kind: 'dragon', state: 'arrive', t: 0, target: target?.id || null, think: 0, orbit: world.rng.chance(0.5) ? 1 : -1, alt: 34 };
    if (from) { a.pos.x = from.x; a.pos.y = from.y; a.pos.z = from.z; }
    a.breath = 0;
    a.grounded = 0;
    a.landings = 0;
    world.emit('dragonArrive', { actor: a });
}

function pickTarget(world, a) {
    let best = null, bd = 260;
    for (const t of world.actors) {
        if (t.dead || t === a || !hostile(a, t)) continue;
        const d = Math.hypot(t.pos.x - a.pos.x, t.pos.z - a.pos.z) + (t.kind === 'player' ? -60 : 0);
        if (d < bd) { bd = d; best = t; }
    }
    return best;
}

function flyToward(a, tx, ty, tz, speed, dt, turn = 1.2) {
    const dx = tx - a.pos.x, dy = ty - a.pos.y, dz = tz - a.pos.z;
    const want = Math.atan2(-dx, -dz);
    a.yaw += angDiff(a.yaw, want) * Math.min(1, dt * turn);
    const f = fwd(a);
    const hd = Math.hypot(dx, dz);
    const climb = Math.max(-10, Math.min(10, dy * 0.8));
    a.vel.x += (f.x * speed - a.vel.x) * Math.min(1, dt * 1.5);
    a.vel.z += (f.z * speed - a.vel.z) * Math.min(1, dt * 1.5);
    a.vel.y += (climb - a.vel.y) * Math.min(1, dt * 2);
    a.pos.x += a.vel.x * dt; a.pos.y += a.vel.y * dt; a.pos.z += a.vel.z * dt;
    a.bank = Math.max(-0.7, Math.min(0.7, angDiff(a.yaw, want) * 1.2));
    return hd;
}

export function updateDragon(world, a, dt) {
    const ai = a.ai;
    ai.t += dt;
    const T = TEMPLATES[a.tpl];
    let t = world.byId(ai.target);
    if (a.chained) {   // a captive on the summit: lies still, turns its head to follow you
        a.fly = false; a.hovering = false; a.vel.x = a.vel.z = 0; ai.state = 'ground';
        const p = world.player;
        a.yaw += angDiff(a.yaw, Math.atan2(-(p.pos.x - a.pos.x), -(p.pos.z - a.pos.z))) * Math.min(1, dt * 0.5);
        a.pos.y = world.space.ground(a.pos.x, a.pos.z, a.pos.y + 4);
        return;
    }
    if (a.flyby != null) {   // a scripted pass: sweep low over the player with a roar, then climb away
        a.flyby -= dt;
        const p = world.player, g0 = world.space.ground(a.pos.x, a.pos.z, 1e4);
        if (!a.leaving) {
            const d = flyToward(a, p.pos.x, p.pos.y + 38, p.pos.z, 30, dt, 1.4);
            if (d < 30 || a.flyby < 6) { a.leaving = true; world.emit('roar', { actor: a }); }
        } else flyToward(a, a.pos.x - Math.sin(a.yaw) * 300, g0 + 150, a.pos.z - Math.cos(a.yaw) * 300, 32, dt, 0.4);
        a.hovering = false; a.onGround = false;
        if (a.flyby <= 0) { a.flyby = null; world.despawn(a); }
        return;
    }
    if (!t || t.dead || !hostile(a, t)) { t = pickTarget(world, a); ai.target = t?.id || null; }
    if (a.grounded > 0) a.grounded -= dt;
    const g = world.space.ground(a.pos.x, a.pos.z, 1e4);
    const water = Math.max(world.space.water(a.pos.x, a.pos.z), -100);
    const floor = Math.max(g, water);
    a.breath = Math.max(0, a.breath - dt);
    const breathing = a.breath > 0;
    if (breathing && t) {
        const f = fwd(a);
        const head = { x: a.pos.x + f.x * 6 * a.scale, y: a.pos.y + (a.fly ? 1 : 3) * a.scale, z: a.pos.z + f.z * 6 * a.scale };
        const dx = t.pos.x - head.x, dy = t.pos.y + 1 - head.y, dz = t.pos.z - head.z, l = Math.hypot(dx, dy, dz) || 1;
        a.breathDir = { x: dx / l, y: dy / l, z: dz / l };
        a.breathOrigin = head;
        if (l < 34) breathCone(world, a, a.breathDir, head, 30, 0.86, T.breathDmg * 1.6, T.breath, dt);
    }
    if (!t) {   // nobody to fight: fly away
        flyToward(a, a.pos.x + Math.sin(ai.t) * 400, floor + 80, a.pos.z - 400, 24, dt);
        if (ai.t > 25) world.despawn(a);
        return;
    }
    const dx = t.pos.x - a.pos.x, dz = t.pos.z - a.pos.z, d = Math.hypot(dx, dz);
    const tg = t.pos.y;
    switch (ai.state) {
        case 'arrive':
            flyToward(a, t.pos.x, tg + 40, t.pos.z, T.speed * 1.2, dt);
            if (d < 90) { ai.state = 'circle'; ai.t = 0; world.emit('roar', { actor: a }); }
            break;
        case 'circle': {
            const ang = Math.atan2(a.pos.z - t.pos.z, a.pos.x - t.pos.x) + ai.orbit * 0.5;
            const R = 48;
            flyToward(a, t.pos.x + Math.cos(ang) * R, tg + ai.alt, t.pos.z + Math.sin(ang) * R, T.speed, dt, 1.6);
            if (a.grounded > 0) { ai.state = 'land'; ai.t = 0; break; }
            if (ai.t > 5 + world.rng.next() * 3) {
                ai.t = 0;
                const r = world.rng.next();
                if (a.hp < a.hpMax * 0.55 && a.landings < 3 && r < 0.45) ai.state = 'land';
                else if (r < 0.55) { ai.state = 'strafe'; ai.strafeFrom = { x: a.pos.x, z: a.pos.z }; }
                else ai.state = 'hover';
                if (world.rng.chance(0.3)) world.emit('roar', { actor: a });
            }
            break;
        }
        case 'strafe': {
            // a pass over the target: breathe when close in front
            const l = d || 1;
            const ox = t.pos.x + dx / l * 30, oz = t.pos.z + dz / l * 30;
            flyToward(a, ox, tg + 14, oz, T.speed * 1.05, dt, 1.1);
            const f = fwd(a);
            const ahead = (dx * f.x + dz * f.z) / l;
            if (ahead > 0.6 && d < 34 && d > 6 && !breathing && ai.t > 1) { a.breath = 1.8; world.emit('breath', { actor: a, elem: T.breath }); }
            if (a.grounded > 0) { ai.state = 'land'; ai.t = 0; }
            else if (ai.t > 7 || (ahead < -0.3 && d > 40)) { ai.state = 'circle'; ai.t = 0; }
            break;
        }
        case 'hover': {
            const l = d || 1;
            const hx = t.pos.x - dx / l * 22, hz = t.pos.z - dz / l * 22;
            a.yaw += angDiff(a.yaw, Math.atan2(-dx, -dz)) * Math.min(1, dt * 1.6);
            a.vel.x += ((hx - a.pos.x) * 0.8 - a.vel.x) * Math.min(1, dt * 1.5);
            a.vel.z += ((hz - a.pos.z) * 0.8 - a.vel.z) * Math.min(1, dt * 1.5);
            a.vel.y += (((tg + 11) - a.pos.y) * 0.9 - a.vel.y) * Math.min(1, dt * 1.5);
            a.pos.x += a.vel.x * dt; a.pos.y += a.vel.y * dt; a.pos.z += a.vel.z * dt;
            a.hovering = true;
            if (ai.t > 1.2 && ai.t < 1.3 && !breathing) { a.breath = 2.6; world.emit('breath', { actor: a, elem: T.breath }); }
            if (a.grounded > 0) { ai.state = 'land'; ai.t = 0; a.hovering = false; }
            else if (ai.t > 5) { ai.state = 'circle'; ai.t = 0; a.hovering = false; }
            break;
        }
        case 'land': {
            const l = d || 1;
            const lx = t.pos.x - dx / l * 14, lz = t.pos.z - dz / l * 14;
            const lg = world.space.ground(lx, lz, 1e4);
            flyToward(a, lx, lg + 1, lz, Math.min(T.speed, 4 + Math.hypot(lx - a.pos.x, lz - a.pos.z) * 0.6), dt, 2);
            a.hovering = true;
            if (a.pos.y < floor + 2.5 && Math.hypot(lx - a.pos.x, lz - a.pos.z) < 8 || ai.t > 9) {
                a.fly = false; a.hovering = false; a.landings++;
                a.pos.y = floor; a.vel.x = a.vel.y = a.vel.z = 0;
                ai.state = 'ground'; ai.t = 0; ai.cool = 1.2;
                world.emit('dragonLand', { actor: a });
            }
            break;
        }
        case 'ground': {
            ai.cool = (ai.cool || 0) - dt;
            const f = fwd(a);
            const l = d || 1;
            const facing = (dx * f.x + dz * f.z) / l;
            const want = Math.atan2(-dx, -dz);
            if (a.act.kind === 'idle' && !breathing) a.yaw += angDiff(a.yaw, want) * Math.min(1, dt * 0.9);
            const close = d < 7.5 * a.scale;
            let speed = 0;
            if (!close && !breathing && a.act.kind === 'idle') speed = 3.2;
            const res = moveBody(a, { x: f.x * speed, z: f.z * speed, jump: false }, dt, world.space);
            a.moving = Math.hypot(a.vel.x, a.vel.z);
            if (ai.cool <= 0 && a.act.kind === 'idle' && !breathing) {
                if (close && facing > 0.5) { a.act = { kind: 'bite', t: 0, dur: 1.0, hit: false }; ai.cool = 1.4 + world.rng.next(); }
                else if (close && facing < -0.2) { a.act = { kind: 'tail', t: 0, dur: 1.3, hit: false }; ai.cool = 1.8; }
                else if (d < 26 && facing > 0.7) { a.breath = 2.4; world.emit('breath', { actor: a, elem: T.breath }); ai.cool = 4 + world.rng.next() * 2; }
            }
            if (a.act.kind === 'bite' || a.act.kind === 'tail') {
                a.act.t += dt;
                if (!a.act.hit && a.act.t > (a.act.kind === 'bite' ? 0.45 : 0.6)) {
                    a.act.hit = true;
                    for (const o of world.actors) {
                        if (o === a || o.dead || !hostile(a, o)) continue;
                        const ox = o.pos.x - a.pos.x, oz = o.pos.z - a.pos.z, od = Math.hypot(ox, oz);
                        const fc = (ox * f.x + oz * f.z) / (od || 1);
                        if (a.act.kind === 'bite' && od < 9 * a.scale && fc > 0.5) applyDamage(world, o, { amount: a.tdmg, type: 'phys', source: a, stagger: true, power: true });
                        if (a.act.kind === 'tail' && od < 10 * a.scale && fc < 0.1) applyDamage(world, o, { amount: a.tdmg * 0.7, type: 'phys', source: a, knock: true, push: { x: ox / od * 8, y: 5, z: oz / od * 8 } });
                    }
                    world.emit('swing', { actor: a, power: true, dragon: a.act.kind });
                }
                if (a.act.t >= a.act.dur) a.act = { kind: 'idle', t: 0 };
            }
            if (ai.t > 18 && a.grounded <= 0 && a.act.kind === 'idle' && !breathing && world.rng.chance(dt * 0.5)) { ai.state = 'takeoff'; ai.t = 0; world.emit('dragonTakeoff', { actor: a }); }
            break;
        }
        case 'takeoff':
            a.fly = true;
            a.vel.x *= 0.9; a.vel.z *= 0.9;
            a.vel.y = Math.min(12, a.vel.y + dt * 10);
            a.pos.y += a.vel.y * dt;
            a.hovering = true;
            if (ai.t > 2.5) { ai.state = 'circle'; ai.t = 0; a.hovering = false; }
            if (a.grounded > 0) { ai.state = 'land'; ai.t = 0; }
            break;
    }
    if (a.fly) {
        // never fly into the ground
        if (a.pos.y < floor + 6 && ai.state !== 'land' && ai.state !== 'takeoff') { a.pos.y += (floor + 6 - a.pos.y) * Math.min(1, dt * 3); a.vel.y = Math.max(a.vel.y, 2); }
        a.onGround = false;
    }
}

/** A dead dragon falls out of the sky. */
export function updateDeadDragon(world, a, dt) {
    if (!a.fly) return;
    const g = world.space.ground(a.pos.x, a.pos.z, 1e4);
    a.vel.y -= 15 * dt;
    a.vel.x *= 0.99; a.vel.z *= 0.99;
    a.pos.x += a.vel.x * dt; a.pos.y += a.vel.y * dt; a.pos.z += a.vel.z * dt;
    if (a.pos.y <= g) { a.pos.y = g; a.fly = false; world.emit('dragonCrash', { actor: a }); }
}

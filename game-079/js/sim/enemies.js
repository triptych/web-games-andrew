// Enemy AI. Pure. Every enemy runs in "enemy time" (slowed during Overdrive).
//
// Idle until it sees you or hears a gun; then keep a preferred distance with line of sight
// (strafing), or follow the flow field from your cell without it. Every attack has a wind-up.

import { CELL, STEP_UP, PLAYER } from '../config.js';
import { ENEMIES } from './data.js';
import { cellAt, cellX, cellZ, moveBody, supportAt, los, flowNext, isWall } from './world.js';
import { ev, alert, hurtPlayer, spawnProj, stepStatus } from './combat.js';

export const PYLON = { name: 'Brain Pylon', hp: 420, speed: 0, radius: 0.7, height: 3.2, sight: 0, pref: [0, 0], attack: null, stagger: 0, score: 200, weight: 0, gunDrop: 0, bombDrop: 0 };

export function defOf(type, G) {
    if (type === 'pylon') return PYLON;
    return ENEMIES[type] || G?.bossDef;
}

export function spawnEnemy(G, type, x, z, opts = {}) {
    const def = ENEMIES[type];
    const L = G.L;
    const cell = cellAt(L, x, z);
    const hpScale = (1 + 0.1 * G.level) * (opts.hpScale || 1);
    const e = {
        id: G.nextId++, type, def,
        x, y: (cell >= 0 ? L.floor[cell] : 0) + (def.fly ? 2.5 : 0), z,
        vx: 0, vy: 0, vz: 0, yaw: G.rng() * Math.PI * 2,
        r: def.radius, h: def.height,
        hp: def.hp * hpScale, maxhp: def.hp * hpScale,
        alert: !!opts.alert, see: false, think: G.rng() * 0.3, cool: 0.6 + G.rng(), windupT: 0, burstN: 0, burstT: 0,
        state: 'move', stateT: 0, strafe: G.rng() < 0.5 ? 1 : -1, strafeT: 1 + G.rng() * 2,
        pain: 0, burn: 0, acidT: 0, cryo: 0, cryoT: 0, frozen: 0, teleT: 3, ground: true,
        ambush: !!opts.ambush, dead: false,
    };
    G.enemies.push(e);
    return e;
}

/** A walkable cell some distance from (x, z), for teleports and ambush spawns. */
export function findSpot(G, x, z, minD, maxD, tries = 30) {
    const L = G.L;
    for (let t = 0; t < tries; t++) {
        const a = G.rng() * Math.PI * 2, d = minD + G.rng() * (maxD - minD);
        const nx = x + Math.sin(a) * d, nz = z + Math.cos(a) * d;
        const c = cellAt(L, nx, nz);
        if (c < 0 || isWall(G, c) || L.liquid[c] || L.crate[c]) continue;
        if (Math.abs(L.floor[c] - L.floor[cellAt(L, x, z)] || 0) > 3) continue;
        return { x: cellX(L, c), z: cellZ(L, c), c };
    }
    return null;
}

/** Is this enemy in the middle of an attack (and so holding an attack token)? */
const attacking = (e) => e.windupT > 0 || e.burstN > 0 || e.state !== 'move';

export function stepEnemies(G, dt) {
    // attack tokens: only a few enemies may wind up or fire at once, so a crowd is a fight, not a firing squad
    G.attackers = 0;
    for (const e of G.enemies) if (!e.dead && !e.boss && attacking(e)) G.attackers++;
    G.maxAttackers = 3 + G.diffIndex;
    for (const e of G.enemies) {
        if (e.dead) continue;
        stepStatus(G, e, dt);
        if (e.dead || e.boss) continue;
        stepEnemy(G, e, dt);
    }
    separate(G);
}

function separate(G) {
    const list = G.enemies;
    const p = G.player;
    for (let a = 0; a < list.length; a++) {
        const e = list[a];
        if (e.dead || e.boss?.fixed) continue;
        for (let b = a + 1; b < list.length; b++) {
            const o = list[b];
            if (o.dead) continue;
            const dx = o.x - e.x, dz = o.z - e.z, rr = e.r + o.r;
            const d2 = dx * dx + dz * dz;
            if (d2 >= rr * rr || d2 < 1e-6) continue;
            if (Math.abs((o.y + o.h / 2) - (e.y + e.h / 2)) > (o.h + e.h) / 2) continue;
            const d = Math.sqrt(d2), push = (rr - d) * 0.5;
            const nx = dx / d, nz = dz / d;
            if (!e.boss) moveBody(G, e, -nx * push, -nz * push, STEP_UP, !!e.def.fly);
            if (!o.boss) moveBody(G, o, nx * push, nz * push, STEP_UP, !!o.def.fly);
        }
        // never stand inside the player
        const dx = e.x - p.x, dz = e.z - p.z, rr = e.r + PLAYER.radius;
        const d2 = dx * dx + dz * dz;
        if (d2 < rr * rr && d2 > 1e-6 && Math.abs(e.y - p.y) < 1.6 && !e.boss) {
            const d = Math.sqrt(d2);
            moveBody(G, e, dx / d * (rr - d), dz / d * (rr - d), STEP_UP, !!e.def.fly);
        }
    }
}

function stepEnemy(G, e, dt) {
    const def = e.def, p = G.player, L = G.L;
    const dx = p.x - e.x, dz = p.z - e.z;
    const dist = Math.hypot(dx, dz);
    const ux = dist > 1e-6 ? dx / dist : 0, uz = dist > 1e-6 ? dz / dist : 0;

    e.lostT = e.see ? 0 : (e.lostT || 0) + dt;
    e.think -= dt;
    if (e.think <= 0) {
        e.think = 0.15 + G.rng() * 0.1;
        e.see = dist < def.sight * 1.3 && !p.dead && los(G, e.x, e.y + e.h * 0.85, e.z, p.x, p.y + 1.4, p.z);
        // an idle enemy only notices you in front of it, or close by: you get the first shot
        if (!e.alert && e.see && dist < def.sight) {
            const fx = Math.sin(e.yaw), fz = -Math.cos(e.yaw);
            if (dist < 8 || (ux * fx + uz * fz) > 0.45) alert(G, e);
        }
        if (e.see) { e.lsx = p.x; e.lsz = p.z; }
    }
    const slow = 1 - 0.15 * e.cryo;
    let wantX = 0, wantZ = 0, speed = def.speed * slow;

    if (e.frozen > 0 || e.pain > 0) {
        e.pain -= dt;
        e.windupT = 0;
    } else if (e.alert && !p.dead) {
        e.cool -= dt;
        // ------------------------------------------------ special movement states
        if (e.state === 'leap' || e.state === 'charge') {
            e.stateT -= dt;
            const reach = e.r + PLAYER.radius + (e.state === 'charge' ? 0.4 : 0.35);
            if (!e.hitDone && dist < reach && Math.abs(p.y - e.y) < 1.6) {
                e.hitDone = true;
                hurtPlayer(G, def.attack.dmg, e.x, e.z);
                if (e.state === 'charge') {
                    p.vx += ux * 13; p.vz += uz * 13; p.vy = Math.max(p.vy, 4.5); p.ground = false;
                    e.state = 'move'; e.pain = 0.5; e.vx = e.vz = 0;
                }
            }
            if (e.state === 'leap' && e.stateT < 0.6 - 0.15 && e.ground) e.state = 'move';
            if (e.state === 'charge' && e.stateT <= 0) e.state = 'move';
        } else {
            // ------------------------------------------------ wind-up and attack
            const A = def.attack;
            if (e.windupT > 0) {
                e.windupT -= dt;
                if (e.windupT <= 0) startAttack(G, e, ux, uz, dist);
            } else if (e.burstN > 0) {
                e.burstT -= dt;
                if (e.burstT <= 0) { fireShot(G, e); e.burstN--; e.burstT = A.gap; }
            } else if (e.cool <= 0 && e.see && dist < A.range && G.attackers < G.maxAttackers) {
                const melee = A.kind === 'charge' && dist < A.melee;
                if (A.kind === 'leap' && (!e.ground || dist > A.range)) { /* wait */ }
                else {
                    G.attackers++;
                    e.windupT = melee ? 0.25 : A.windup;
                    e.melee = melee;
                    ev(G, 'windup', { id: e.id, etype: e.type });
                }
            }
            // ------------------------------------------------ where to go
            if (e.windupT > 0 && def.attack.kind !== 'bolt') { speed *= 0.2; }
            if (e.see) {
                const [lo, hi] = def.pref;
                e.strafeT -= dt;
                if (e.strafeT <= 0) { e.strafeT = 0.8 + G.rng() * 1.8; if (G.rng() < 0.6) e.strafe = -e.strafe; }
                if (dist > hi) { wantX = ux; wantZ = uz; }
                else if (dist < lo) { wantX = -ux * 0.8 - uz * e.strafe * 0.5; wantZ = -uz * 0.8 + ux * e.strafe * 0.5; }
                else { wantX = -uz * e.strafe; wantZ = ux * e.strafe; speed *= 0.75; }
            } else {
                const field = def.fly ? G.flowFly : G.flowWalk;
                const c = cellAt(L, e.x, e.z);
                const nxt = field ? flowNext(G, field, c) : -1;
                if (nxt >= 0) {
                    const tx = cellX(L, nxt) - e.x, tz = cellZ(L, nxt) - e.z, tl = Math.hypot(tx, tz) || 1;
                    wantX = tx / tl; wantZ = tz / tl;
                } else if (e.lsx !== undefined) {
                    const tx = e.lsx - e.x, tz = e.lsz - e.z, tl = Math.hypot(tx, tz);
                    if (tl > 1) { wantX = tx / tl; wantZ = tz / tl; }
                }
            }
            // brainstalkers blink away when cornered or hurt
            if (def.teleport) {
                e.teleT -= dt;
                if (e.teleT <= 0 && (e.hp < e.maxhp * 0.7 || dist < 5) && G.rng() < 0.02) teleport(G, e);
            }
        }
    }

    // ------------------------------------------------ physics
    if (e.state === 'move') {
        const k = Math.min(1, (e.ground || def.fly ? 9 : 1.5) * dt);
        e.vx += (wantX * speed - e.vx) * k;
        e.vz += (wantZ * speed - e.vz) * k;
    }
    const hit = moveBody(G, e, e.vx * dt, e.vz * dt, STEP_UP, !!def.fly);
    if ((hit.hitX || hit.hitZ) && e.state === 'charge') { e.state = 'move'; e.pain = 0.7; e.vx = e.vz = 0; ev(G, 'slam', { id: e.id, x: e.x, y: e.y, z: e.z }); }
    if (hit.hitX) e.vx *= -0.2;
    if (hit.hitZ) e.vz *= -0.2;
    const sup = supportAt(G, e.x, e.z, e.r);
    if (def.fly) {
        const want = Math.max(sup.floor + 1.2, Math.min(sup.ceil - e.h - 0.4, (e.alert ? p.y + 2.2 : sup.floor + 2.5) + Math.sin(G.t * 1.7 + e.id) * 0.6));
        e.vy += ((want - e.y) * 2.5 - e.vy) * Math.min(1, 4 * dt);
        e.y += e.vy * dt;
        e.y = Math.max(sup.floor + 0.3, Math.min(sup.ceil - e.h - 0.1, e.y));
    } else {
        e.vy -= 20 * dt;
        e.y += e.vy * dt;
        if (e.y <= sup.floor) { e.y = sup.floor; if (e.vy < 0) e.vy = 0; e.ground = true; }
        else if (e.ground && e.y - sup.floor < STEP_UP + 0.05 && e.vy <= 0) { e.y = sup.floor; e.vy = 0; }
        else e.ground = false;
        if (e.y + e.h > sup.ceil) { e.y = Math.max(sup.floor, sup.ceil - e.h); e.vy = Math.min(0, e.vy); }
    }
    // friction off the ground after knockback
    if (e.state !== 'move') { /* keep momentum */ } else if (!e.alert || e.frozen > 0 || e.pain > 0) { e.vx *= Math.max(0, 1 - 6 * dt); e.vz *= Math.max(0, 1 - 6 * dt); }
    // face the player when engaged, else the way we move
    const fx = e.alert && e.see ? ux : e.vx, fz = e.alert && e.see ? uz : e.vz;
    if (Math.abs(fx) + Math.abs(fz) > 0.05 && e.frozen <= 0) {
        const target = Math.atan2(fx, -fz);
        let d = target - e.yaw;
        d = Math.atan2(Math.sin(d), Math.cos(d));
        e.yaw += d * Math.min(1, 8 * dt);
    }
}

function startAttack(G, e, ux, uz, dist) {
    const A = e.def.attack;
    const p = G.player;
    if (A.kind === 'leap') {
        const up = 5.5;
        const t = 2 * up / 20;
        const sp = Math.min(A.leap, (dist + 0.5) / t);
        e.state = 'leap'; e.stateT = 0.6; e.hitDone = false; e.ground = false;
        e.vx = ux * sp; e.vz = uz * sp; e.vy = up;
        ev(G, 'attack', { id: e.id, etype: e.type });
        e.cool = A.cool * (0.8 + G.rng() * 0.5);
    } else if (A.kind === 'charge') {
        if (e.melee) {
            ev(G, 'attack', { id: e.id, etype: e.type, melee: true });
            if (dist < A.melee + 0.4 && Math.abs(p.y - e.y) < 2) {
                hurtPlayer(G, A.dmg * 0.6, e.x, e.z);
                p.vx += ux * 8; p.vz += uz * 8;
            }
            e.cool = 1.1;
        } else {
            e.state = 'charge'; e.stateT = 1.4; e.hitDone = false;
            e.vx = ux * A.chargeSpeed; e.vz = uz * A.chargeSpeed;
            ev(G, 'attack', { id: e.id, etype: e.type });
            e.cool = A.cool * (0.8 + G.rng() * 0.5);
        }
    } else {
        e.burstN = A.count; e.burstT = 0;
        ev(G, 'attack', { id: e.id, etype: e.type });
        e.cool = A.cool * (0.8 + G.rng() * 0.5);
    }
}

/** One projectile of a ranged burst, led a little toward where the player is going. */
export function fireShot(G, e, over = {}) {
    const A = { ...e.def.attack, ...over };
    const p = G.player;
    const ox = e.x + Math.sin(e.yaw) * e.r * 0.8, oy = e.y + e.h * 0.7, oz = e.z - Math.cos(e.yaw) * e.r * 0.8;
    const tx0 = p.x, ty = p.y + 1.0, tz0 = p.z;
    const d0 = Math.hypot(tx0 - ox, ty - oy, tz0 - oz);
    const lead = (d0 / A.speed) * (0.3 + G.rng() * 0.5);
    const tx = tx0 + p.vx * lead, tz = tz0 + p.vz * lead;
    let dx = tx - ox, dy = ty - oy, dz = tz - oz;
    const l = Math.hypot(dx, dy, dz) || 1;
    dx /= l; dy /= l; dz /= l;
    const s = A.spread || 0;
    dx += (G.rng() - 0.5) * 2 * s; dy += (G.rng() - 0.5) * 2 * s; dz += (G.rng() - 0.5) * 2 * s;
    const l2 = Math.hypot(dx, dy, dz);
    const kind = { bolt: 'bolt', laser: 'laser', psi: 'psi', rockets: 'erocket', spit: 'spit', orb: 'orb', missile: 'emissile' }[A.kind] || 'bolt';
    spawnProj(G, {
        x: ox, y: oy, z: oz, vx: dx / l2 * A.speed, vy: dy / l2 * A.speed, vz: dz / l2 * A.speed,
        owner: 'e', dmg: A.dmg, kind, homing: A.homing || 0, splash: A.splash || 0, r: kind === 'psi' || kind === 'orb' ? 0.3 : 0.18,
        life: A.homing ? 5 : 4, src: e.id,
    });
    ev(G, 'eshot', { id: e.id, etype: e.type, kind, x: ox, y: oy, z: oz });
}

function teleport(G, e) {
    const p = G.player;
    const spot = findSpot(G, p.x, p.z, 8, 16);
    if (!spot) return;
    const x0 = e.x, y0 = e.y, z0 = e.z;
    e.x = spot.x; e.z = spot.z; e.y = G.L.floor[spot.c];
    e.vx = e.vz = e.vy = 0;
    e.teleT = 4 + G.rng() * 3;
    e.cool = Math.min(e.cool, 0.6);
    ev(G, 'teleport', { id: e.id, x0, y0, z0, x1: e.x, y1: e.y, z1: e.z });
}

// Shared simulation helpers: derived stats, entities, bullets, explosions, damage, drops, movement.
// Pure: no DOM, no renderer, no Math.random, no clock.

import { MECH, GRAVITY } from '../config.js';
import { ENEMIES, BOSSES, WEAPONS, MISSILES, ARMOR, FUEL, LEGS, TRACKS, LEVELS } from './data.js';

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const lerp = (a, b, t) => a + (b - a) * t;
export const dist2 = (ax, az, bx, bz) => (ax - bx) ** 2 + (az - bz) ** 2;
export const angDiff = (a, b) => { let d = (b - a) % (Math.PI * 2); if (d > Math.PI) d -= Math.PI * 2; if (d < -Math.PI) d += Math.PI * 2; return d; };
/** Facing 0 looks down -z (forward). */
export const yawOf = (dx, dz) => Math.atan2(dx, -dz);
export const ev = (G, e) => { G.events.push(e); };
export const nid = (G) => ++G.nid;

export function computeStats(upg) {
    let n = 0;
    for (const t of TRACKS) n += upg[t];
    const scale = MECH.baseScale + MECH.perUpgrade * n;
    const a = ARMOR[upg.armor], f = FUEL[upg.fuel], l = LEGS[upg.legs];
    return {
        n, scale, rad: MECH.radius * scale, eye: MECH.eye * scale,
        maxHp: a.hp, dr: a.dr, fuelMax: f.cap, fuelRegen: f.regen,
        speed: l.speed * Math.pow(scale, 0.2), climb: l.climb, clear: l.clear * scale,
        stompDmg: l.stomp, stompR: (4 + 0.6 * upg.legs) * Math.sqrt(scale),
        gun: WEAPONS[upg.guns], msl: MISSILES[upg.missiles],
    };
}
export const refreshStats = (G) => { G.st = computeStats(G.upg); };
export const lvOf = (G) => LEVELS[G.level];

// ------------------------------------------------------------------ entities
export function enemyDef(type) {
    if (BOSSES[type]) { const b = BOSSES[type]; return { name: b.name, hp: b.hp, spd: b.spd, r: b.r, h: b.r * 2.4, aggro: 80, scrap: b.scrap, fly: 0, inf: false, armor: 1, boss: true }; }
    return ENEMIES[type];
}

export function addEnemy(G, type, x, z, o = {}) {
    const d = enemyDef(type), lv = lvOf(G);
    const hp = Math.round(d.hp * (d.boss ? 1 : lv.hpScale) * (d.boss ? (1 + 0.08 * G.level) : 1));
    const e = {
        id: nid(G), type, x, z, y: G.world.h(x, z) + d.fly, vx: 0, vz: 0, vy: 0, yaw: Math.PI, hp, maxhp: hp,
        r: d.r * (o.scale || 1), h: d.h * (o.scale || 1), fly: d.fly, awake: !!o.awake, t: 0, cd: 0.8 + (hash(x, z) * 1.6), cd2: 0, st: 0, dir: hash(z, x) < 0.5 ? 1 : -1,
        flash: 0, camp: o.camp ?? -1, fall: 0, burst: 0, owner: o.owner || 0, kd: 0,
    };
    if (d.boss) e.b = { ph: 0, trans: 0, act: null, cd: 2.5, stun: 0, under: false, shield: false, segs: [], dying: 0 };
    G.enemies.push(e);
    return e;
}
function hash(a, b) { const s = Math.sin(a * 12.9898 + b * 78.233) * 43758.5453; return s - Math.floor(s); }

export function spawnPickup(G, type, x, z, val = 0, o = {}) {
    G.pickups.push({ id: nid(G), type, x, z, y: G.world.h(x, z) + 0.8, val, t: 0, vx: o.vx || 0, vz: o.vz || 0, vy: o.vy ?? 6 });
}

/** Scrap and drops from something destroyed. */
export function dropLoot(G, x, z, scrap, o = {}) {
    const lv = lvOf(G);
    const total = Math.round(scrap * (1 + 0.05 * G.level));
    if (total > 0) {
        const parts = total > 40 ? 5 : total > 12 ? 3 : 1;
        for (let i = 0; i < parts; i++) {
            const a = G.rng() * 6.28, s = 3 + G.rng() * 5;
            spawnPickup(G, 'scrap', x, z, Math.ceil(total / parts), { vx: Math.cos(a) * s, vz: Math.sin(a) * s });
        }
    }
    const big = o.big ? 2 : 1;
    const r = G.rng();
    const pHp = (o.heavy ? 0.4 : 0.13) * big, pFuel = 0.06 * big, pAmmo = 0.16 * big;
    const a = G.rng() * 6.28;
    if (r < pHp) spawnPickup(G, 'hp', x, z, 0, { vx: Math.cos(a) * 4, vz: Math.sin(a) * 4 });
    else if (r < pHp + pFuel) spawnPickup(G, 'fuel', x, z, 0, { vx: Math.cos(a) * 4, vz: Math.sin(a) * 4 });
    else if (r < pHp + pFuel + pAmmo) spawnPickup(G, 'ammo', x, z, 0, { vx: Math.cos(a) * 4, vz: Math.sin(a) * 4 });
    void lv;
}

// ------------------------------------------------------------------ bullets
/**
 * team 'p' | 'e'. kind: bolt | rocket | shell | missile | emissile | shard | fireball | bomblet | slug.
 * dir is a unit vector.
 */
export function shoot(G, o) {
    const b = {
        id: nid(G), team: o.team, kind: o.kind || 'bolt', x: o.x, y: o.y, z: o.z,
        vx: o.dx * o.speed, vy: o.dy * o.speed, vz: o.dz * o.speed,
        dmg: o.dmg, splash: o.splash || 0, life: o.life ?? 2, r: o.r ?? 0.3, pierce: o.pierce || 0, grav: o.grav || 0,
        tgt: o.tgt || 0, turn: o.turn || 0, col: o.col || 0, hit: null, cluster: o.cluster || 0, fire: o.fire || 0,
    };
    G.bullets.push(b);
    return b;
}

/** Aim a ballistic lob at (tx,ty,tz) from (x,y,z) with horizontal speed hv under gravity g. Returns {dx,dy,dz,speed}. */
export function lob(x, y, z, tx, ty, tz, hv, g) {
    const dx = tx - x, dz = tz - z, hd = Math.hypot(dx, dz) || 0.001;
    const T = hd / hv;
    const vy = (ty - y + 0.5 * g * T * T) / T;
    const speed = Math.hypot(hv, vy);
    return { dx: dx / hd * hv / speed, dz: dz / hd * hv / speed, dy: vy / speed, speed, T };
}

// ------------------------------------------------------------------ damage
export function hurtPlayer(G, dmg, fx, fz, o = {}) {
    const p = G.player;
    if (G.phase !== 'play' || p.hp <= 0 || p.shieldT > 0) return;
    const d = dmg * (1 - G.st.dr);
    p.hp -= d;
    p.hurtT = 0.25; p.quiet = 0;
    G.stat.taken += d;
    ev(G, { type: 'hurt', dmg: d, fx, fz, big: d > 14 });
    if (p.hp <= 0) {
        p.hp = 0;
        G.phase = 'dead';
        G.deaths++;
        ev(G, { type: 'boom', x: p.x, y: p.y + G.st.eye * 0.6, z: p.z, r: 8, size: 4, big: true, col: 'mech' });
        ev(G, { type: 'dead' });
    }
}

export function hurtEnemy(G, e, dmg, o = {}) {
    if (e.hp <= 0) return 0;
    const d = enemyDef(e.type);
    let m = d.armor;
    if (o.small && d.armor < 1) m = d.armor; else if (!o.small) m = Math.min(1, d.armor + 0.25);
    dmg *= m;
    if (e.b) {
        const b = e.b;
        if (b.trans > 0 || b.dying > 0) { ev(G, { type: 'ping', x: o.x ?? e.x, y: o.y ?? e.y + e.h * 0.6, z: o.z ?? e.z }); return 0; }
        if (b.shield) { ev(G, { type: 'ping', x: o.x ?? e.x, y: o.y ?? e.y + e.h * 0.6, z: o.z ?? e.z, shield: true }); return 0; }
        if (b.under) return 0;
        const ph = BOSSES[e.type].phases[b.ph];
        if (ph.vuln) dmg *= ph.vuln;
        if (b.stun > 0) dmg *= 1.5;
    }
    e.hp -= dmg;
    e.flash = 0.12;
    e.awake = true;
    if (e.camp >= 0) G.alert[e.camp] = 1;
    G.stat.dealt += dmg;
    ev(G, { type: 'hit', id: e.id, x: o.x ?? e.x, y: o.y ?? e.y + e.h * 0.6, z: o.z ?? e.z, dmg, kind: e.type });
    if (e.hp <= 0) killEnemy(G, e, o);
    return dmg;
}

export function killEnemy(G, e, o = {}) {
    const d = enemyDef(e.type);
    if (e.b) {
        if (e.b.dying > 0) return;
        e.hp = 1;
        e.b.dying = 3.2; e.b.act = null; e.b.under = false; e.b.shield = false;
        G.bossAlive = false;
        ev(G, { type: 'bossDown', id: e.id, x: e.x, z: e.z, y: e.y });
        for (const q of G.enemies) if (q !== e && q.hp > 0 && (q.owner === e.id || q.type === 'pylon' || G.level >= 0)) {
            q.hp = 0; q.dead = 1;
            ev(G, { type: 'boom', x: q.x, y: q.y + q.h * 0.5, z: q.z, r: 4, size: 2, kind: q.type });
        }
        return;
    }
    e.hp = 0; e.dead = 1;
    G.kills++; G.stat.kills++;
    G.score += d.scrap * 10 + 20;
    const size = d.boss ? 5 : d.r > 2 ? 3 : d.r > 1 ? 2 : 1;
    ev(G, { type: 'boom', x: e.x, y: e.y + e.h * 0.5, z: e.z, r: d.r * 3, size, kind: e.type, dx: o.dx || 0, dz: o.dz || 0, inf: d.inf });
    if (d.scrap) dropLoot(G, e.x, e.z, d.scrap, { heavy: d.r > 1 });
}

/** Area damage. team is who is being protected: 'p' blasts hurt enemies, 'e' blasts hurt the player. */
export function boom(G, x, y, z, r, dmg, team, o = {}) {
    ev(G, { type: 'boom', x, y, z, r, size: o.size ?? (r > 4 ? 3 : r > 2 ? 2 : 1), kind: o.kind || 'blast', col: o.col || 0, quiet: !!o.quiet });
    if (o.crater) ev(G, { type: 'scorch', x, z, r: r * 0.9 });
    if (team === 'p' || o.both) {
        for (const e of G.enemies) {
            if (e.hp <= 0) continue;
            const d = Math.hypot(e.x - x, e.z - z) - e.r;
            const dy = e.fly ? Math.abs(e.y - y) : 0;
            if (d < r && dy < r + 1) {
                const f = 1 - clamp(d / r, 0, 1) * 0.55;
                const dd = Math.hypot(e.x - x, e.z - z) || 1;
                if (dmg > 0) hurtEnemy(G, e, dmg * f, { dx: (e.x - x) / dd, dz: (e.z - z) / dd, y: e.y + e.h * 0.5 });
                if (e.hp > 0 && enemyDef(e.type).inf) { e.vx += (e.x - x) / dd * 9 * f; e.vz += (e.z - z) / dd * 9 * f; e.kd = 0.4; }
            } else if (d < r) { /* flyer out of vertical reach */ }
        }
        for (const pod of G.pods) if (!pod.freed && Math.hypot(pod.x - x, pod.z - z) < r + 1.8) hurtPod(G, pod, dmg * 0.7);
    }
    if (team === 'e' || o.both) {
        const p = G.player;
        if (G.phase === 'play') {
            const d = Math.hypot(p.x - x, p.z - z) - G.st.rad * 0.7;
            const airborne = p.y - G.world.h(p.x, p.z) > 2.2 && y < p.y - 3 && r < 5;
            if (d < r && !airborne && dmg > 0) {
                hurtPlayer(G, dmg * (1 - clamp(d / r, 0, 1) * 0.5), x, z);
                const dd = Math.hypot(p.x - x, p.z - z) || 1;
                p.vx += (p.x - x) / dd * 3; p.vz += (p.z - z) / dd * 3;
            }
        }
    }
}

export function hurtPod(G, pod, dmg) {
    if (pod.freed) return;
    pod.hp -= dmg;
    ev(G, { type: 'podhit', id: pod.id, x: pod.x, z: pod.z });
    if (pod.hp <= 0) freePod(G, pod);
}
export function freePod(G, pod) {
    if (pod.freed) return;
    pod.freed = true; pod.hp = 0;
    G.rescued += pod.n; G.stat.rescued += pod.n; G.podsFreed++;
    G.score += pod.n * 100;
    ev(G, { type: 'rescue', x: pod.x, z: pod.z, n: pod.n, first: G.podsFreed === 1 });
    dropLoot(G, pod.x, pod.z, 30 + pod.n * 10, { big: true });
    spawnPickup(G, 'hp', pod.x + 2, pod.z, 0, {});
    spawnPickup(G, 'fuel', pod.x - 2, pod.z, 0, {});
    spawnPickup(G, 'ammo', pod.x, pod.z + 2, 0, {});        // the colonists leave a rocket crate behind
}

// ------------------------------------------------------------------ movement
/**
 * Move e by its velocity for dt, respecting the corridor, steep slopes (climb), blockers taller than
 * `clear` and the ground. Airborne bodies are stopped by terrain higher than they are.
 */
export function moveBody(G, e, dt, rad, climb, clear, air, ignoreSlope = false) {
    const w = G.world;
    const ox = e.x, oz = e.z, oh = w.h(ox, oz);
    const ok = (nx, nz) => {
        if (Math.abs(nx - w.cx(nz)) > w.hw(nz) * 1.04 || nz > 6 || nz < -w.L - 6) return false;
        if (ignoreSlope) return true;
        const nh = w.h(nx, nz), up = nh - oh;
        if (air) return nh <= e.y + 0.4;
        if (up > 0.08) { const run = Math.hypot(nx - ox, nz - oz) || 1e-6; if (up / run > climb) return false; }
        return true;
    };
    const dx = e.vx * dt, dz = e.vz * dt;
    let nx = ox + dx, nz = oz + dz;
    if (!ok(nx, nz)) {
        if (ok(ox + dx, oz)) { nz = oz; e.vz *= 0.2; }
        else if (ok(ox, oz + dz)) { nx = ox; e.vx *= 0.2; }
        else { nx = ox; nz = oz; e.vx *= 0.1; e.vz *= 0.1; }
    }
    if (clear < 90) {
        for (let pass = 0; pass < 2; pass++) {
            for (const b of w.near(nx, nz)) {
                if (b.h <= clear) continue;
                if (air && e.y - b.y > b.h) continue;
                const ddx = nx - b.x, ddz = nz - b.z, d = Math.hypot(ddx, ddz), min = b.r + rad;
                if (d < min) {
                    const k = d > 1e-5 ? 1 / d : 0;
                    nx = b.x + (k ? ddx * k : 1) * min; nz = b.z + (k ? ddz * k : 0) * min;
                }
            }
        }
        if (!ok(nx, nz)) { nx = ox; nz = oz; }
    }
    e.x = nx; e.z = nz;
}

export const progressOf = (G) => -G.player.z;

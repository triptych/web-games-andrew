// The three big fights. Each is a small state machine around the arena at the end of the level,
// and each can be won only by using the shell the world just taught: bounce coconuts back at
// Big Coco, pound the ground beside Sir Sandy, and spin Captain Squawk when she crashes.
// Pure.

import { PHYS } from '../config.js';
import { FWD, RGT } from './levels.js';
import { spawnShot, hurtPlayer, bindHooks } from './enemies.js';

const ev = (G, type, o) => { G.events.push(o ? { type, ...o } : { type }); };
const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));

export const BOSS = {
    coco: { name: 'Big Coco', hp: 3, r: 1.5, h: 1.8 },
    sandy: { name: 'Sir Sandy', hp: 3, r: 1.7, h: 3.2 },
    squawk: { name: 'Captain Squawk', hp: 4, r: 1.2, h: 1.4 },
};

/** World position from arena-local lateral a and forward b. */
export function arenaPt(G, a, b) {
    const A = G.level.arena, f = FWD[A.h], r = RGT[A.h];
    return [A.cx + r[0] * a + f[0] * b, A.cz + r[1] * a + f[1] * b];
}
/** Arena-local coordinates of a world point. */
export function arenaLocal(G, x, z) {
    const A = G.level.arena, f = FWD[A.h], r = RGT[A.h];
    const dx = x - A.cx, dz = z - A.cz;
    return [dx * r[0] + dz * r[1], dx * f[0] + dz * f[1]];
}

export function initBoss(G) {
    const spec = G.level.boss;
    G.rings = [];
    if (!spec) { G.boss = null; return; }
    const A = G.level.arena, def = BOSS[spec.kind];
    const [x, z] = arenaPt(G, 0, A.half * 0.62);
    G.boss = {
        kind: spec.kind, alive: 1, done: false, defeated: 0, hp: def.hp, maxHp: def.hp,
        x, y: A.y, z, la: 0, state: 'intro', t: 0, cd: 1.5, hitCool: 0, atk: 0, hurtT: 0,
        face: 0, aim: spec.kind === 'squawk' ? 1.3 : 1.4, started: 0,
    };
    if (spec.kind === 'squawk') G.boss.y = A.y + 5.5;
}

function ring(G, x, z, y, speed, max) { G.rings.push({ x, z, y, r: 1.2, speed, max, t: 0 }); ev(G, 'ring', { x, y, z }); }

function damage(G, B, how) {
    if (B.hitCool > 0 || !B.alive) return false;
    B.hp--; B.hitCool = 0.9; B.hurtT = 0.6; B.shockCool = B.kind === 'sandy' ? 3.4 : 2.6;
    ev(G, 'bossHit', { x: B.x, y: B.y + 1, z: B.z, hp: B.hp, how });
    if (B.hp <= 0) {
        B.alive = 0; B.state = 'defeated'; B.t = 0; B.defeated = 1;
        G.rings.length = 0; G.shots = G.shots.filter((s) => s.owner === 'p');
        ev(G, 'bossDefeat', { x: B.x, y: B.y, z: B.z, kind: B.kind });
    }
    return true;
}

/** Called for every shot the player owns (a reflected coconut). True: the boss took it. */
export function bossShotHit(G, s) {
    const B = G.boss;
    if (!B || !B.alive) return false;
    const def = BOSS[B.kind];
    const dist = Math.hypot(B.x - s.x, B.z - s.z);
    if (dist < def.r + s.r + 0.3 && s.y > B.y - 0.5 && s.y < B.y + def.h + 1.2) {
        if (B.kind === 'sandy') {
            if (B.state !== 'dazed') { B.state = 'dazed'; B.t = 0; ev(G, 'bossDaze', { x: B.x, y: B.y + 2, z: B.z }); }
        } else if (B.kind === 'coco') {
            if (B.state !== 'dizzy') { damage(G, B, 'reflect'); if (B.alive) { B.state = 'dizzy'; B.t = 0; } }
        } else if (B.kind === 'squawk') {
            if (B.state !== 'stuck' && B.hitCool <= 0) { damage(G, B, 'reflect'); if (B.alive) { B.state = 'hurtfly'; B.t = 0; } }
        }
        ev(G, 'smash', { x: s.x, y: s.y, z: s.z, kind: s.kind });
        return true;
    }
    return false;
}

/** A ground pound landed at (x, y, z) with radius r. */
export function bossShock(G, x, y, z, r) {
    const B = G.boss;
    if (!B || !B.alive) return;
    const d = Math.hypot(B.x - x, B.z - z);
    if (B.shockCool > 0) return;
    if (B.kind === 'sandy' && d < r + 1.6 && Math.abs(B.y - y) < 1.5 && (B.state === 'walk' || B.state === 'wind' || B.state === 'recover')) {
        B.state = 'dazed'; B.t = 0; B.hurtT = 0.4;
        ev(G, 'bossDaze', { x: B.x, y: B.y + 2, z: B.z });
    } else if (B.kind === 'squawk' && d < r + 2.2 && (B.state === 'volley' || B.state === 'fly' || B.state === 'mark')) {
        B.state = 'falling'; B.t = 0;
        ev(G, 'bossDaze', { x: B.x, y: B.y, z: B.z });
    } else if (B.kind === 'coco' && d < r + 1.8 && (B.state === 'wind')) {
        B.state = 'dizzy'; B.t = 0;                      // a pound mid-windup rattles him, but does no damage
    }
}

function touch(G, B, def) {
    const p = G.p;
    if (!B.alive || p.dead > 0 || p.launch) return;
    const harmless = B.state === 'dizzy' || B.state === 'dazed' || B.state === 'stuck' || B.state === 'falling' || B.state === 'intro';
    const d = Math.hypot(B.x - p.x, B.z - p.z);
    if (d < def.r + PHYS.radius && p.y < B.y + def.h && p.y + PHYS.height > B.y && !harmless) hurtPlayer(G, B.x, B.z);
}

function playerAttack(G) {
    const p = G.p;
    return p.spinT > 0 || p.rollT > 0 || p.slam === 2;
}

export function stepBoss(G, dt) {
    const B = G.boss, p = G.p;
    if (!B) return;
    const A = G.level.arena, def = BOSS[B.kind];
    B.t += dt; B.hitCool = Math.max(0, B.hitCool - dt); B.hurtT = Math.max(0, B.hurtT - dt); B.shockCool = Math.max(0, (B.shockCool || 0) - dt);

    // rings travel outward over the floor; hop them
    for (let i = G.rings.length - 1; i >= 0; i--) {
        const rg = G.rings[i];
        rg.t += dt; rg.r += rg.speed * dt;
        const d = Math.hypot(p.x - rg.x, p.z - rg.z);
        if (Math.abs(d - rg.r) < 0.75 + PHYS.radius * 0.6 && p.y < rg.y + 0.65 && p.dead <= 0) hurtPlayer(G, rg.x, rg.z);
        if (rg.r > rg.max) G.rings.splice(i, 1);
    }

    if (B.state === 'defeated') {
        if (B.t > 3.2) B.done = true;
        return;
    }
    const [pa, pb] = arenaLocal(G, p.x, p.z);
    B.face = Math.atan2(-(p.x - B.x), -(p.z - B.z));
    const half = A.half;
    const phase = B.hp >= B.maxHp ? 1 : B.hp <= 1 ? 3 : 2;

    if (B.state === 'intro') {
        if (G.p.y >= A.y - 0.1 && B.t > 0.8 && Math.hypot(p.x - B.x, p.z - B.z) < half * 2.2 && pb > -half) { B.state = B.kind === 'sandy' ? 'walk' : 'idle'; B.t = 0; B.cd = 1.4; if (B.kind === 'squawk') B.state = 'fly'; ev(G, 'bossStart', { kind: B.kind }); }
        return;
    }

    if (B.kind === 'coco') cocoStep(G, B, dt, p, pa, pb, half, phase);
    else if (B.kind === 'sandy') sandyStep(G, B, dt, p, pa, pb, half, phase);
    else squawkStep(G, B, dt, p, pa, pb, half, phase);
    touch(G, B, def);
}

// ---------------------------------------------------------------- Big Coco
function cocoStep(G, B, dt, p, pa, pb, half, phase) {
    const A = G.level.arena;
    const move = (speed) => { B.la += clamp(pa - B.la, -speed * dt, speed * dt); B.la = clamp(B.la, -half + 3, half - 3); [B.x, B.z] = arenaPt(G, B.la, half * 0.62); };
    switch (B.state) {
        case 'idle':
            move(2.6);
            B.cd -= dt;
            if (B.cd <= 0) {
                B.atk++;
                const pick = phase === 1 ? 0 : phase === 2 ? B.atk % 3 : 1 + (B.atk % 2);   // 0: throw  1: fan  2: stomp
                B.state = pick === 2 || (phase === 3 && B.atk % 3 === 0) ? 'stompwind' : 'wind'; B.t = 0; B.fan = pick === 1 || phase === 3;
                ev(G, 'windup', { x: B.x, y: B.y + 2, z: B.z, kind: 'coco' });
            }
            break;
        case 'wind':
            move(1.2);
            if (B.t > 0.85) {
                const n = B.fan ? 3 : 1;
                for (let i = 0; i < n; i++) {
                    const ang = (i - (n - 1) / 2) * 0.42;
                    const sx = B.x, sy = B.y + 1.9, sz = B.z;
                    const dist = Math.hypot(p.x - sx, p.z - sz), T = clamp(dist / 8.5, 0.6, 1.6);
                    const dx = p.x + p.vx * T * 0.3 - sx, dz = p.z + p.vz * T * 0.3 - sz, l = Math.hypot(dx, dz) || 1;
                    const c = Math.cos(ang), s = Math.sin(ang);
                    const ux = (dx / l) * c - (dz / l) * s, uz = (dx / l) * s + (dz / l) * c;
                    spawnShot(G, 'coconut', sx, sy, sz, ux * (l / T), (p.y + 0.7 - sy) / T + 0.5 * 15 * T, uz * (l / T), 'e', 'boss');
                }
                ev(G, 'throw', { x: B.x, y: B.y + 1.9, z: B.z, kind: 'coconut' });
                B.state = 'idle'; B.cd = phase === 3 ? 1.3 : 1.9; B.t = 0;
            }
            break;
        case 'stompwind':
            B.y = A.y + Math.sin(Math.min(1, B.t / 0.9) * Math.PI) * 3.2;
            if (B.t > 0.9) { B.y = A.y; ring(G, B.x, B.z, A.y, 7.5, half * 1.9); ev(G, 'bossStomp', { x: B.x, y: A.y, z: B.z }); B.state = 'idle'; B.cd = 1.5; B.t = 0; }
            break;
        case 'dizzy':
            B.y = A.y;
            if (B.t > 3.0) { B.state = 'idle'; B.cd = 1.0; B.t = 0; }
            break;
    }
}

// ---------------------------------------------------------------- Sir Sandy
function sandyStep(G, B, dt, p, pa, pb, half, phase) {
    const A = G.level.arena;
    const toward = (speed) => {
        const dx = p.x - B.x, dz = p.z - B.z, l = Math.hypot(dx, dz);
        if (l > 3) { B.x += (dx / l) * speed * dt; B.z += (dz / l) * speed * dt; }
        const [a, b] = arenaLocal(G, B.x, B.z);
        const ca = clamp(a, -half + 2.5, half - 2.5), cb = clamp(b, -half + 3, half - 2.5);
        [B.x, B.z] = arenaPt(G, ca, cb);
    };
    switch (B.state) {
        case 'walk': {
            toward(phase === 1 ? 1.9 : 2.5);
            B.cd -= dt;
            const d = Math.hypot(p.x - B.x, p.z - B.z);
            if (B.cd <= 0) {
                if (phase >= 2 && d > 6.5 && B.atk % 2 === 1) {
                    B.atk++; B.state = 'throw'; B.t = 0;
                    ev(G, 'windup', { x: B.x, y: B.y + 3, z: B.z, kind: 'sandy' });
                } else if (d < 7) {
                    B.atk++; B.state = 'wind'; B.t = 0;
                    ev(G, 'windup', { x: B.x, y: B.y + 3, z: B.z, kind: 'sandy' });
                } else B.cd = 0.3;
            }
            break;
        }
        case 'wind':
            if (B.t > 0.95) {
                const fxv = -Math.sin(B.face), fzv = -Math.cos(B.face);
                const sx = B.x + fxv * 2.2, sz = B.z + fzv * 2.2;
                ring(G, sx, sz, A.y, 8.5, 11);
                ev(G, 'bossSmash', { x: sx, y: A.y, z: sz });
                if (Math.hypot(p.x - sx, p.z - sz) < 1.8 && p.y < A.y + 1.2) hurtPlayer(G, sx, sz);
                B.state = 'recover'; B.t = 0;
            }
            break;
        case 'throw':
            if (B.t > 0.8) {
                const sx = B.x, sy = B.y + 3.2, sz = B.z;
                const dist = Math.hypot(p.x - sx, p.z - sz), T = clamp(dist / 8, 0.7, 1.8);
                spawnShot(G, 'rock', sx, sy, sz, (p.x - sx) / T, (p.y + 0.6 - sy) / T + 0.5 * 22 * T, (p.z - sz) / T, 'e', 'boss');
                ev(G, 'throw', { x: sx, y: sy, z: sz, kind: 'rock' });
                B.state = 'walk'; B.cd = 2.4; B.t = 0;
            }
            break;
        case 'recover':
            if (B.t > 1.1) { B.state = 'walk'; B.cd = phase === 3 ? 0.9 : 1.6; B.t = 0; }
            break;
        case 'dazed':
            // on one knee, crown in reach: a spin, a roll or a dive on it does the damage
            if (playerAttack(G) && Math.hypot(p.x - B.x, p.z - B.z) < 3.0 + 0.5 && p.y < B.y + 4) {
                if (damage(G, B, p.spinT > 0 ? 'spin' : p.rollT > 0 ? 'roll' : 'slam') && B.alive) { B.state = 'recover'; B.t = 0; }
            } else if (B.t > 4.5) { B.state = 'walk'; B.cd = 0.8; B.t = 0; }
            break;
    }
}

// ---------------------------------------------------------------- Captain Squawk
function squawkStep(G, B, dt, p, pa, pb, half, phase) {
    const A = G.level.arena;
    const orbit = (rad, speed, height) => {
        B.ang = (B.ang || 0) + speed * dt;
        const [x, z] = arenaPt(G, Math.cos(B.ang) * rad, Math.sin(B.ang) * rad * 0.6 + half * 0.1);
        const k = 1 - Math.exp(-3.5 * dt);
        B.x += (x - B.x) * k; B.z += (z - B.z) * k; B.y += (A.y + height - B.y) * k;
    };
    switch (B.state) {
        case 'fly':
            orbit(half * 0.55, 1.1, 5.5);
            B.cd -= dt;
            if (B.cd <= 0) {
                B.atk++;
                if (B.atk % 2 === 1) { B.state = 'mark'; B.t = 0; B.mx = p.x; B.mz = p.z; ev(G, 'windup', { x: B.x, y: B.y, z: B.z, kind: 'squawk' }); }
                else { B.state = 'volley'; B.t = 0; B.shots = 0; }
            }
            break;
        case 'mark': {
            // hover above the spot the shadow marks, then drop onto it
            B.mx += (p.x - B.mx) * (1 - Math.exp(-1.2 * dt));             // the mark drifts toward the player a little
            B.mz += (p.z - B.mz) * (1 - Math.exp(-1.2 * dt));
            const k = 1 - Math.exp(-5 * dt);
            B.x += (B.mx - B.x) * k; B.z += (B.mz - B.z) * k; B.y += (A.y + 6.5 - B.y) * k;
            if (B.t > 1.35) { B.state = 'dive'; B.t = 0; B.dx = B.mx; B.dz = B.mz; }
            break;
        }
        case 'dive': {
            const u = clamp(B.t / 0.42, 0, 1);
            B.x += (B.dx - B.x) * Math.min(1, dt * 12); B.z += (B.dz - B.z) * Math.min(1, dt * 12);
            B.y = A.y + (1 - u * u) * 6.2;
            if (u >= 1) {
                B.y = A.y; B.state = 'stuck'; B.t = 0;
                ev(G, 'bossSmash', { x: B.x, y: A.y, z: B.z });
                if (Math.hypot(p.x - B.x, p.z - B.z) < 2.2 && p.y < A.y + 1.4) hurtPlayer(G, B.x, B.z);
                if (phase >= 2) ring(G, B.x, B.z, A.y, 8, 10);
            }
            break;
        }
        case 'stuck':
            B.y = A.y;
            if (playerAttack(G) && Math.hypot(p.x - B.x, p.z - B.z) < 2.4 + 0.6 && p.y < A.y + 2.4) {
                if (damage(G, B, p.spinT > 0 ? 'spin' : p.rollT > 0 ? 'roll' : 'slam') && B.alive) { B.state = 'hurtfly'; B.t = 0; }
            } else if (B.t > 2.8) { B.state = 'hurtfly'; B.t = 0; B.hitCool = 0; }
            break;
        case 'hurtfly': {
            const k = 1 - Math.exp(-4 * dt);
            B.y += (A.y + 5.5 - B.y) * k;
            if (B.t > 0.9) { B.state = 'fly'; B.cd = phase === 3 ? 0.9 : 1.6; B.t = 0; }
            break;
        }
        case 'volley': {
            // swing out wide, hover low, and toss shiny fish
            const side = B.atk % 4 === 0 ? 1 : -1;
            const [tx, tz] = arenaPt(G, side * half * 0.55, half * 0.55);
            const k = 1 - Math.exp(-3 * dt);
            B.x += (tx - B.x) * k; B.z += (tz - B.z) * k; B.y += (A.y + 2.6 - B.y) * k;
            const n = phase === 3 ? 4 : 3;
            if (B.t > 0.9 + B.shots * 0.9 && B.shots < (phase === 1 ? 2 : 3)) {
                B.shots++;
                for (let i = 0; i < n; i++) {
                    const ang = (i - (n - 1) / 2) * 0.32;
                    const sx = B.x, sy = B.y + 0.7, sz = B.z;
                    const dist = Math.hypot(p.x - sx, p.z - sz), T = clamp(dist / 9, 0.6, 1.4);
                    const dx = p.x - sx, dz = p.z - sz, l = Math.hypot(dx, dz) || 1, c = Math.cos(ang), s = Math.sin(ang);
                    const ux = (dx / l) * c - (dz / l) * s, uz = (dx / l) * s + (dz / l) * c;
                    spawnShot(G, 'fish', sx, sy, sz, ux * (l / T), (p.y + 0.7 - sy) / T + 0.5 * 20 * T, uz * (l / T), 'e', 'boss');
                }
                ev(G, 'throw', { x: B.x, y: B.y, z: B.z, kind: 'fish' });
            }
            if (B.t > 0.9 + (phase === 1 ? 2 : 3) * 0.9 + 0.3) { B.state = 'fly'; B.cd = 1.2; B.t = 0; }
            break;
        }
        case 'falling': {
            // knocked out of the sky by a ground pound
            B.y += (A.y - B.y) * (1 - Math.exp(-6 * dt));
            if (B.t > 0.45) { B.y = A.y; B.state = 'stuck'; B.t = 0.4; B.hitCool = 0; ev(G, 'bossSmash', { x: B.x, y: A.y, z: B.z }); }
            break;
        }
    }
}

bindHooks({ bossShot: bossShotHit });

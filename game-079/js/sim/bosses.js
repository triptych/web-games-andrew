// The three bosses. Pure. A boss is an enemy with `boss` set and a pattern machine here.

import { CELL, STEP_UP, PLAYER } from '../config.js';
import { BOSSES } from './data.js';
import { cellX, cellZ, moveBody, supportAt, los } from './world.js';
import { ev, hurtPlayer, spawnProj } from './combat.js';
import { spawnEnemy, fireShot, findSpot, PYLON } from './enemies.js';

const TALK = {
    chompra: { intro: 'The Queen rises out of the fountain. She is mostly teeth.', half: 'Queen Chompra screeches. Her brood answers from the vents.' },
    vrask: { intro: 'VRASK: "The Colonel\'s cub. You have his eyes. I will keep them."', half: 'VRASK: "Fool. I never touched your father. The human gave him to us. The human pulled the trigger."' },
    rourke: { intro: 'ROURKE: "Roxy. Kiddo. Put the gun down and let Uncle Dell explain."', shield: 'ROURKE: "Jack wouldn\'t kneel. You don\'t have to make his mistake."', beam: 'ROURKE: "I\'m forever now, Roxy! FOREVER!"' },
};

export function spawnBoss(G, kind, room) {
    const L = G.L;
    const def = { ...BOSSES[kind], attack: null, stagger: 0, sight: 999, pref: [0, 0], weight: 10, gunDrop: 0, bombDrop: 0 };
    G.bossDef = def;
    const cx = (room.x + room.w / 2) * CELL, cz = (room.y + room.h / 2) * CELL;
    // chompra and vrask start on the far side from the player; rourke floats in the middle
    let x = cx, z = cz;
    if (kind !== 'rourke') {
        const p = G.player;
        const dx = cx - p.x, dz = cz - p.z, l = Math.hypot(dx, dz) || 1;
        x = cx + dx / l * room.w * CELL * 0.25; z = cz + dz / l * room.h * CELL * 0.25;
    }
    const hp = def.hp * (0.75 + 0.25 * G.diffIndex);
    const e = spawnEnemy(G, 'trooper', x, z, { alert: true });
    Object.assign(e, {
        type: kind, def, boss: kind, r: def.radius, h: def.height, hp, maxhp: hp,
        pat: 'intro', patT: 2, phase: 1, cool: 1, bite: 0, beamA: 0, beamOn: false, beamT: 0, summonT: 6,
        cx, cz, roomId: room.id,
    });
    if (kind === 'rourke') e.y = supportAt(G, x, z, 0.5).floor + 3;
    ev(G, 'boss', { id: e.id, kind, name: def.name, text: TALK[kind].intro });
    return e;
}

export function stepBosses(G, dt) {
    for (const e of G.enemies) if (e.boss && !e.dead && !e.pylon) {
        if (e.boss === 'chompra') chompra(G, e, dt);
        else if (e.boss === 'vrask') vrask(G, e, dt);
        else rourke(G, e, dt);
    }
    // shockwaves
    const p = G.player;
    for (let k = G.waves.length - 1; k >= 0; k--) {
        const w = G.waves[k];
        w.r += w.speed * dt;
        if (!w.hit && !p.dead) {
            const d = Math.hypot(p.x - w.x, p.z - w.z);
            if (Math.abs(d - w.r) < 0.9 && p.y - w.y < 0.5) {
                w.hit = true;
                hurtPlayer(G, w.dmg, w.x, w.z);
                const l = d || 1;
                p.vx += (p.x - w.x) / l * 8; p.vz += (p.z - w.z) / l * 8; p.vy = Math.max(p.vy, 4); p.ground = false;
            }
        }
        if (w.r > w.max) G.waves.splice(k, 1);
    }
}

function toPlayer(G, e) {
    const p = G.player;
    const dx = p.x - e.x, dz = p.z - e.z, d = Math.hypot(dx, dz) || 1;
    return { dx: dx / d, dz: dz / d, d };
}

function face(e, ux, uz, dt, rate = 6) {
    const target = Math.atan2(ux, -uz);
    let d = target - e.yaw;
    d = Math.atan2(Math.sin(d), Math.cos(d));
    e.yaw += d * Math.min(1, rate * dt);
}

/** Walker physics shared by the two walking bosses. */
function body(G, e, dt) {
    moveBody(G, e, e.vx * dt, e.vz * dt, STEP_UP + (e.vy > 0 || !e.ground ? 2 : 0), false);
    const sup = supportAt(G, e.x, e.z, e.r);
    e.vy -= 22 * dt;
    e.y += e.vy * dt;
    const wasAir = !e.ground;
    if (e.y <= sup.floor) { e.y = sup.floor; if (e.vy < 0) e.vy = 0; e.ground = true; }
    else if (e.ground && e.y - sup.floor < STEP_UP + 0.05 && e.vy <= 0) { e.y = sup.floor; e.vy = 0; }
    else e.ground = false;
    return wasAir && e.ground;
}

/** A ballistic jump that lands at (tx, tz) after `t` seconds. */
function leapTo(e, tx, tz, t, g = 22) {
    e.vx = (tx - e.x) / t; e.vz = (tz - e.z) / t;
    e.vy = g * t / 2;
    e.ground = false;
}

function wave(G, e, dmg, max = 18, speed = 13) {
    G.waves.push({ x: e.x, y: e.y, z: e.z, r: 0.5, speed, max, dmg, hit: false });
    ev(G, 'shockwave', { x: e.x, y: e.y, z: e.z, max, speed });
}

function talkAtHalf(G, e, key = 'half') {
    if (e.phase === 1 && e.hp < e.maxhp * 0.5) {
        e.phase = 2;
        ev(G, 'bossTalk', { id: e.id, text: TALK[e.boss][key] });
        ev(G, 'bossPhase', { id: e.id, phase: 2 });
    }
}

// ==================================================================== Queen Chompra
function chompra(G, e, dt) {
    const p = G.player;
    const { dx, dz, d } = toPlayer(G, e);
    talkAtHalf(G, e);
    const fast = e.phase === 2 ? 1.35 : 1;
    e.patT -= dt * fast;
    e.bite -= dt;
    let wantX = 0, wantZ = 0;
    if (e.pat === 'intro' || e.pat === 'stalk') {
        wantX = dx; wantZ = dz;
        if (d < e.r + PLAYER.radius + 0.6 && e.bite <= 0 && Math.abs(p.y - e.y) < 2) {
            e.bite = 1; hurtPlayer(G, 18, e.x, e.z); ev(G, 'attack', { id: e.id, etype: e.type, melee: true });
            p.vx += dx * 9; p.vz += dz * 9;
        }
        if (e.patT <= 0) {
            const r = G.rng();
            const brood = G.enemies.filter((o) => !o.dead && o.type === 'chomper').length;
            e.pat = r < 0.35 ? 'spit' : r < 0.7 ? 'leap' : brood < 8 ? 'brood' : 'spit';
            e.patT = e.pat === 'leap' ? 0.7 : 0.6;
            ev(G, 'windup', { id: e.id, etype: e.type, pat: e.pat });
        }
    } else if (e.pat === 'spit') {
        if (e.patT <= 0) {
            const base = Math.atan2(dx, dz);
            for (let k = -3; k <= 3; k++) {
                const a = base + k * 0.16;
                spawnProj(G, { x: e.x + Math.sin(a) * e.r, y: e.y + 2.2, z: e.z + Math.cos(a) * e.r, vx: Math.sin(a) * 17, vy: (p.y + 1 - e.y - 2.2) / Math.max(1, d) * 17, vz: Math.cos(a) * 17, owner: 'e', dmg: 9, kind: 'spit', r: 0.3, src: e.id, life: 4 });
            }
            ev(G, 'attack', { id: e.id, etype: e.type });
            e.pat = 'stalk'; e.patT = 1.8 + G.rng();
        }
    } else if (e.pat === 'leap') {
        if (e.patT <= 0 && e.ground) {
            leapTo(e, p.x, p.z, 1.1);
            e.pat = 'air'; e.patT = 3;
            ev(G, 'attack', { id: e.id, etype: e.type, leap: true });
        }
    } else if (e.pat === 'brood') {
        if (e.patT <= 0) {
            for (let k = 0; k < 3 + (e.phase === 2 ? 1 : 0); k++) {
                const s = findSpot(G, e.x, e.z, 2.5, 5);
                if (s) { spawnEnemy(G, 'chomper', s.x, s.z, { alert: true }).summoned = true; ev(G, 'spawn', { x: s.x, y: G.L.floor[s.c], z: s.z, etype: 'chomper' }); }
            }
            e.pat = 'stalk'; e.patT = 2.5;
        }
    }
    if (e.pat === 'air') {
        if (body(G, e, dt)) { wave(G, e, 20); e.pat = 'stalk'; e.patT = 1.5 + G.rng(); e.vx = e.vz = 0; }
        if (e.patT < 0) e.pat = 'stalk';
    } else {
        const sp = e.def.speed * fast * (e.pat === 'stalk' || e.pat === 'intro' ? 1 : 0.15);
        e.vx += (wantX * sp - e.vx) * Math.min(1, 6 * dt);
        e.vz += (wantZ * sp - e.vz) * Math.min(1, 6 * dt);
        body(G, e, dt);
    }
    face(e, dx, dz, dt, 4);
}

// ==================================================================== Warlord Vrask
function vrask(G, e, dt) {
    const p = G.player;
    const { dx, dz, d } = toPlayer(G, e);
    talkAtHalf(G, e);
    const fast = e.phase === 2 ? 1.3 : 1;
    e.patT -= dt * fast;
    let wantX = 0, wantZ = 0, sp = e.def.speed * fast;
    const see = los(G, e.x, e.y + 2.5, e.z, p.x, p.y + 1.4, p.z);
    if (e.pat === 'intro' || e.pat === 'strafe') {
        e.strafe = e.strafe || 1;
        if (G.rng() < dt * 0.5) e.strafe = -e.strafe;
        if (d > 16) { wantX = dx; wantZ = dz; } else if (d < 9) { wantX = -dx; wantZ = -dz; } else { wantX = -dz * e.strafe; wantZ = dx * e.strafe; }
        e.cool -= dt * fast;
        if (e.cool <= 0 && see && e.pat === 'strafe') { e.burstN = 6; e.burstT = 0; e.cool = 2.2; ev(G, 'attack', { id: e.id, etype: e.type }); }
        if (e.burstN > 0) {
            e.burstT -= dt;
            if (e.burstT <= 0) { e.burstN--; e.burstT = 0.09; fireShot(G, e, { kind: 'bolt', speed: 34, dmg: 8, spread: 0.04 }); }
        }
        if (e.patT <= 0) {
            const r = G.rng();
            e.pat = d < 6 ? 'pound' : r < 0.45 ? 'barrage' : r < 0.8 ? 'hop' : 'strafe';
            e.patT = e.pat === 'strafe' ? 3 : 0.7;
            if (e.pat !== 'strafe') ev(G, 'windup', { id: e.id, etype: e.type, pat: e.pat });
        }
    } else if (e.pat === 'barrage') {
        sp = 0;
        if (e.patT <= 0) {
            for (let k = 0; k < 8; k++) {
                const a = e.yaw + (k - 3.5) * 0.22;
                spawnProj(G, { x: e.x, y: e.y + 3, z: e.z, vx: Math.sin(a) * 9, vy: 9, vz: -Math.cos(a) * 9, owner: 'e', dmg: 16, kind: 'emissile', splash: 3, homing: 1.4 + k * 0.05, r: 0.25, src: e.id, life: 5 });
            }
            ev(G, 'attack', { id: e.id, etype: e.type, barrage: true });
            e.pat = 'strafe'; e.patT = 3 + G.rng();
        }
    } else if (e.pat === 'hop') {
        if (e.patT <= 0 && e.ground) {
            const s = findSpot(G, e.cx, e.cz, 4, 14) || { x: e.cx, z: e.cz };
            leapTo(e, s.x, s.z, 1.2);
            e.pat = 'air'; e.patT = 3;
            ev(G, 'attack', { id: e.id, etype: e.type, hop: true });
        }
    } else if (e.pat === 'pound') {
        sp = 0;
        if (e.patT <= 0) { wave(G, e, 24, 14, 15); e.pat = 'strafe'; e.patT = 2.5; }
    }
    if (e.pat === 'air') {
        if (body(G, e, dt)) { wave(G, e, 14, 10, 14); e.pat = 'strafe'; e.patT = 2.5 + G.rng(); e.vx = e.vz = 0; }
        if (e.patT < 0) e.pat = 'strafe';
    } else {
        e.vx += (wantX * sp - e.vx) * Math.min(1, 6 * dt);
        e.vz += (wantZ * sp - e.vz) * Math.min(1, 6 * dt);
        body(G, e, dt);
    }
    face(e, dx, dz, dt, 8);
}

// ==================================================================== Rourke, the Traitor King
function rourke(G, e, dt) {
    const p = G.player;
    const L = G.L;
    const { dx, dz, d } = toPlayer(G, e);
    const floor = supportAt(G, e.cx, e.cz, 0.5).floor;
    e.y = floor + 3 + Math.sin(G.t * 0.8) * 0.4;
    face(e, dx, dz, dt, 2);
    const frac = e.hp / e.maxhp;
    // phase changes
    if (e.phase === 1 && frac < 0.66) {
        e.phase = 2; e.invuln = true;
        ev(G, 'bossTalk', { id: e.id, text: TALK.rourke.shield });
        ev(G, 'bossPhase', { id: e.id, phase: 2 });
        const r = G.L.rooms[e.roomId];
        for (const [fx, fz] of [[0.18, 0.18], [0.82, 0.18], [0.18, 0.82], [0.82, 0.82]]) {
            const px = (r.x + r.w * fx) * CELL, pz = (r.y + r.h * fz) * CELL;
            const py = spawnEnemy(G, 'trooper', px, pz, { alert: true });
            const hp = PYLON.hp * (0.75 + 0.25 * G.diffIndex);
            Object.assign(py, { type: 'pylon', def: PYLON, pylon: true, r: PYLON.radius, h: PYLON.height, hp, maxhp: hp, boss: 'pylon' });
            ev(G, 'spawn', { x: px, y: py.y, z: pz, etype: 'pylon' });
        }
    }
    if (e.phase === 2 && e.invuln && !G.enemies.some((o) => o.pylon && !o.dead)) {
        e.invuln = false;
        ev(G, 'bossPhase', { id: e.id, phase: 2.5 });
    }
    if (e.phase === 2 && !e.invuln && frac < 0.33) {
        e.phase = 3;
        ev(G, 'bossTalk', { id: e.id, text: TALK.rourke.beam });
        ev(G, 'bossPhase', { id: e.id, phase: 3 });
        e.beamT = 2;
    }
    // summons in phase 2+
    if (e.phase >= 2) {
        e.summonT -= dt;
        const alive = G.enemies.filter((o) => !o.dead && !o.boss).length;
        if (e.summonT <= 0 && alive < 8) {
            e.summonT = e.phase === 3 ? 7 : 9;
            for (let k = 0; k < 2; k++) {
                const s = findSpot(G, e.cx, e.cz, 10, 20);
                if (!s) continue;
                const t = G.rng.pick(['trooper', 'drone', 'chomper', 'chomper']);
                spawnEnemy(G, t, s.x, s.z, { alert: true }).summoned = true;
                ev(G, 'spawn', { x: s.x, y: L.floor[s.c], z: s.z, etype: t });
            }
        }
    }
    // the beam (phase 3): sweeps round the arena at knee height. Jump it or hide.
    if (e.phase === 3) {
        e.beamT -= dt;
        if (e.beamOn) {
            e.beamA += dt * 1.0 * (e.beamDir || 1);
            const pa = Math.atan2(p.x - e.cx, p.z - e.cz);
            let da = pa - e.beamA;
            da = Math.atan2(Math.sin(da), Math.cos(da));
            e.beamTick = (e.beamTick || 0) - dt;
            if (Math.abs(da) < 0.09 && p.y - floor < 0.85 && e.beamTick <= 0 && los(G, e.cx, floor + 0.6, e.cz, p.x, p.y + 0.4, p.z)) {
                e.beamTick = 0.25;
                hurtPlayer(G, 8, e.cx, e.cz);
            }
            if (e.beamT <= 0) { e.beamOn = false; e.beamT = 3.5; ev(G, 'beam_off', { id: e.id }); }
        } else if (e.beamT <= 0) {
            e.beamOn = true; e.beamT = 6.5; e.beamDir = G.rng() < 0.5 ? 1 : -1;
            e.beamA = Math.atan2(p.x - e.cx, p.z - e.cz) + 1.2 * e.beamDir * -1;
            ev(G, 'beam_on', { id: e.id });
        }
    }
    // orb rings and homing missiles
    e.cool -= dt * (e.phase === 3 ? 1.25 : 1);
    if (e.cool <= 0 && !e.invuln) {
        e.ring = !e.ring;
        if (e.ring) {
            const n = 14, off = G.rng() * 6.28;
            const y = p.y + 1;
            for (let k = 0; k < n; k++) {
                const a = off + (k / n) * Math.PI * 2;
                spawnProj(G, { x: e.x + Math.sin(a) * 2, y, z: e.z + Math.cos(a) * 2, vx: Math.sin(a) * 9, vy: 0, vz: Math.cos(a) * 9, owner: 'e', dmg: 11, kind: 'orb', r: 0.35, src: e.id, life: 6 });
            }
        } else {
            for (let k = 0; k < 3; k++) {
                const a = Math.atan2(dx, dz) + (k - 1) * 0.6;
                spawnProj(G, { x: e.x, y: e.y + 1, z: e.z, vx: Math.sin(a) * 12, vy: 4, vz: Math.cos(a) * 12, owner: 'e', dmg: 14, kind: 'emissile', splash: 2.5, homing: 1.3, r: 0.25, src: e.id, life: 6 });
            }
        }
        ev(G, 'attack', { id: e.id, etype: e.type });
        e.cool = e.phase === 1 ? 2.2 : 1.9;
    }
    if (d < e.r + PLAYER.radius + 0.3) { p.vx += dx * 10; p.vz += dz * 10; }
}

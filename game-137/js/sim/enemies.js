// The Cubeborn: spawning, walking the flow field, chewing through voxel piles, biting, spitting,
// blowing up; hives that breed them; and the kaiju boss. Pure.

import { MAP, MECH, ENEMY_CAP, CHEW } from '../config.js';
import { ENEMIES, BOSSES, BOSS_ATTACK, HIVE } from './data/enemies.js';
import { blocked, solid, idx, inMap, cellOf, flowDir, collide, trace, FAR, MAT_ID } from './world.js';
import { hurtMech, hurtCell, killEnemy, explode } from './damage.js';
import { chew, scatter } from './voxels.js';
import { near } from './combat.js';

export function spawnEnemy(R, kind, x, y) {
    const def = ENEMIES[kind];
    const hpMul = R.hpScale * (1 + R.t / 150);
    const e = {
        id: R.nextId++, kind, x, y, vx: 0, vy: 0, kx: 0, ky: 0, r: def.r,
        hp: def.hp * hpMul, max: def.hp * hpMul, speed: def.speed * R.rng.range(0.9, 1.1),
        cd: 0, atk: R.rng.range(0.5, 1.5), fuse: 0, chewT: 0, flash: 0,
    };
    R.enemies.push(e);
    return e;
}

export function spawnBoss(R, kind) {
    const def = BOSSES[kind];
    const M = R.mech;
    // the far side of the map from the mech
    const x = M.x < MAP.w / 2 ? MAP.w - 6 : 6, y = M.y < MAP.h / 2 ? MAP.h - 6 : 6;
    const hp = def.hp * R.hpScale;
    const e = {
        id: R.nextId++, kind, boss: true, x, y, vx: 0, vy: 0, kx: 0, ky: 0, r: def.r,
        hp, max: hp, speed: def.speed, cd: 0, atk: 0, fuse: 0, chewT: 0, flash: 0,
        st: 'walk', stT: def.gap, ai: 0, act: null, dir: 0, spin: 0,
    };
    R.enemies.push(e);
    R.boss = e.id;
    R.events.push({ type: 'boss_in', kind, x, y });
    return e;
}

function pickKind(R) {
    const d = R.d, t = R.t;
    const w = {
        mite: 10,
        brute: d >= 1.1 ? 1.2 + t / 90 : 0.3 + t / 150,
        spitter: d >= 1.15 || t > 40 ? 1 + d * 0.6 + t / 110 : 0,
        boomer: d >= 1.3 || t > 60 ? 1 + t / 120 : 0,
    };
    let tot = 0;
    for (const k in w) tot += w[k];
    let r = R.rng() * tot;
    for (const k in w) { r -= w[k]; if (r <= 0) return k; }
    return 'mite';
}

/** A spot off-screen-ish, on open ground the monsters can walk from. */
function spawnSpot(R, near, far) {
    const M = R.mech, W = R.W;
    for (let k = 0; k < 14; k++) {
        const a = R.rng() * Math.PI * 2, d = R.rng.range(near, far);
        const x = M.x + Math.cos(a) * d, y = M.y + Math.sin(a) * d;
        const cx = cellOf(x), cy = cellOf(y);
        if (!inMap(cx, cy)) continue;
        const i = idx(cx, cy);
        if (blocked(W, i) || W.ff[i] >= FAR) continue;
        return { x: cx + 0.5, y: cy + 0.5 };
    }
    return null;
}

export function spawning(R, dt) {
    const alive = R.enemies.length;
    // ambient swarm
    R.spawnCd -= dt;
    if (R.spawnCd <= 0) {
        const rate = (2.2 + 1.1 * R.d) * (1 + R.t / 50) * R.spawnMul;
        R.spawnCd += 1 / rate;
        if (alive < ENEMY_CAP) {
            const p = spawnSpot(R, 12, 19);
            if (p) spawnEnemy(R, pickKind(R), p.x, p.y);
        }
    }
    // hives breed near themselves
    for (const h of R.hives) {
        if (h.dead) continue;
        h.flash = Math.max(0, h.flash - dt);
        h.cd -= dt;
        if (h.cd > 0) continue;
        h.cd += HIVE.spawnEvery / (0.8 + 0.2 * R.d);
        if (R.enemies.length >= ENEMY_CAP) continue;
        for (let k = 0; k < 8; k++) {
            const a = R.rng() * Math.PI * 2, d = R.rng.range(2.2, HIVE.spawnNear);
            const x = h.x + Math.cos(a) * d, y = h.y + Math.sin(a) * d;
            const cx = cellOf(x), cy = cellOf(y);
            if (!inMap(cx, cy) || blocked(R.W, idx(cx, cy))) continue;
            spawnEnemy(R, R.rng() < 0.7 ? 'mite' : pickKind(R), cx + 0.5, cy + 0.5);
            R.events.push({ type: 'hatch', x: cx + 0.5, y: cy + 0.5 });
            break;
        }
    }
}

const losClear = (R, x0, y0, x1, y1) => !trace(x0, y0, x1, y1, (i) => blocked(R.W, i)).hit;

export function stepEnemies(R, dt) {
    const M = R.mech, W = R.W;
    for (const e of R.enemies) {
        if (e.dead) continue;
        e.flash = Math.max(0, e.flash - dt);
        e.cd = Math.max(0, e.cd - dt);
        if (e.boss) { stepBoss(R, e, dt); continue; }
        const def = ENEMIES[e.kind];
        const dx = M.x - e.x, dy = M.y - e.y, d = Math.hypot(dx, dy) || 0.01;
        let dir = flowDir(W, e.x, e.y) || { x: dx / d, y: dy / d };
        // close enough with a clear line: go straight at the mech
        if (d < 3 && losClear(R, e.x, e.y, M.x, M.y)) dir = { x: dx / d, y: dy / d };
        let sp = e.speed;
        if (e.kind === 'spitter') {
            e.atk -= dt;
            const see = d < 10 && losClear(R, e.x, e.y, M.x, M.y);
            if (see && d < def.keep) { dir = { x: -dx / d * 0.6 - dy / d * 0.5, y: -dy / d * 0.6 + dx / d * 0.5 }; sp *= 0.7; }
            if (see && e.atk <= 0) {
                e.atk = 1 / def.shot.rate;
                const a = Math.atan2(dy, dx);
                R.shots.push({ k: 'e', x: e.x, y: e.y, vx: Math.cos(a) * def.shot.speed, vy: Math.sin(a) * def.shot.speed, dmg: def.shot.dmg * R.dmgScale, life: def.shot.life });
                R.events.push({ type: 'spit', x: e.x, y: e.y });
            }
        }
        if (e.kind === 'boomer') {
            if (!e.fuse && d < 1.3 + e.r) { e.fuse = def.boom.fuse; R.events.push({ type: 'fuse', x: e.x, y: e.y }); }
            if (e.fuse) {
                e.fuse -= dt; sp = 0;
                if (e.fuse <= 0) { killEnemy(R, e); continue; }
            }
        }
        e.vx = dir.x * sp + e.kx; e.vy = dir.y * sp + e.ky;
        e.kx *= Math.max(0, 1 - 6 * dt); e.ky *= Math.max(0, 1 - 6 * dt);
        e.x += e.vx * dt; e.y += e.vy * dt;
        // keep apart
        near(R, e.x, e.y, 1, (o) => {
            if (o === e || o.boss) return;
            const ox = e.x - o.x, oy = e.y - o.y, od = Math.hypot(ox, oy), min = e.r + o.r;
            if (od < min && od > 1e-4) { const p = (min - od) * 0.5; e.x += ox / od * p; e.y += oy / od * p; }
        });
        const hit = collide(W, e, e.r, blocked);
        if (hit >= 0 && W.h[hit] === 0 && W.debris[hit] > 0) {
            e.chewT += dt * (def.chew || 1);
            if (e.chewT >= CHEW) { e.chewT = 0; chew(R, hit); }
        }
        // bite
        if (d < e.r + MECH.radius + 0.05 && e.cd <= 0 && def.touch) {
            e.cd = 0.8;
            hurtMech(R, def.touch * R.dmgScale, 'bite');
        }
    }
    R.enemies = R.enemies.filter((e) => !e.dead);
}

// ------------------------------------------------------------------ the kaiju
function stepBoss(R, e, dt) {
    const M = R.mech, def = BOSSES[e.kind];
    const dx = M.x - e.x, dy = M.y - e.y, d = Math.hypot(dx, dy) || 0.01;
    const phase2 = e.hp < e.max * 0.5;
    e.stT -= dt;
    let vx = 0, vy = 0;
    if (e.st === 'walk') {
        vx = dx / d * def.speed * (phase2 ? 1.2 : 1); vy = dy / d * def.speed * (phase2 ? 1.2 : 1);
        if (e.stT <= 0) {
            e.act = def.attacks[e.ai++ % def.attacks.length];
            e.st = 'wind'; e.stT = BOSS_ATTACK[e.act].wind;
            e.dir = Math.atan2(dy, dx);
            R.events.push({ type: 'boss_wind', act: e.act, x: e.x, y: e.y });
        }
    } else if (e.st === 'wind') {
        if (e.stT <= 0) startAttack(R, e);
    } else if (e.st === 'act') {
        const A = BOSS_ATTACK[e.act];
        if (e.act === 'charge') { vx = Math.cos(e.dir) * def.speed * A.speed; vy = Math.sin(e.dir) * def.speed * A.speed; }
        if (e.act === 'spiral') {
            e.atk -= dt;
            while (e.atk <= 0) {
                e.atk += A.over / A.shots;
                e.spin += 0.55;
                for (const k of [0, Math.PI]) bossShot(R, e, e.spin + k, A);
            }
        }
        if (e.stT <= 0) { e.st = 'walk'; e.stT = def.gap * (phase2 ? 0.7 : 1); }
    }
    e.x += vx * dt; e.y += vy * dt;
    e.x = Math.max(1.5 + e.r * 0.5, Math.min(MAP.w - 1.5 - e.r * 0.5, e.x));
    e.y = Math.max(1.5 + e.r * 0.5, Math.min(MAP.h - 1.5 - e.r * 0.5, e.y));
    // it crushes rock and scatters voxel piles as it walks
    if (vx || vy) {
        const r = Math.ceil(e.r);
        for (let cy = cellOf(e.y) - r; cy <= cellOf(e.y) + r; cy++) for (let cx = cellOf(e.x) - r; cx <= cellOf(e.x) + r; cx++) {
            if (!inMap(cx, cy)) continue;
            const i = idx(cx, cy);
            if (R.W.h[i] > 0 && R.W.mat[i] !== MAT_ID.edge && R.W.mat[i] !== MAT_ID.hive && Math.hypot(cx + 0.5 - e.x, cy + 0.5 - e.y) < e.r + 0.4) hurtCell(R, i, 160 * dt);
        }
        if (R.rng() < dt * 4) scatter(R, e.x, e.y, e.r + 0.3, 0.6);
    }
    collide(R.W, e, e.r * 0.7, (W, i) => W.mat[i] === MAT_ID.edge);
    if (d < e.r + MECH.radius && e.cd <= 0) { e.cd = 1; hurtMech(R, def.touch * R.dmgScale, 'stomp'); }
}

function bossShot(R, e, a, A) {
    R.shots.push({ k: 'e', big: true, x: e.x + Math.cos(a) * e.r, y: e.y + Math.sin(a) * e.r, vx: Math.cos(a) * A.speed, vy: Math.sin(a) * A.speed, dmg: A.dmg * R.dmgScale, life: A.life });
}

function startAttack(R, e) {
    const A = BOSS_ATTACK[e.act];
    e.st = 'act';
    e.stT = 0.35;
    R.events.push({ type: 'boss_act', act: e.act, x: e.x, y: e.y });
    if (e.act === 'ring') {
        const off = R.rng() * Math.PI;
        for (let k = 0; k < A.shots; k++) bossShot(R, e, off + (k / A.shots) * Math.PI * 2, A);
    } else if (e.act === 'spiral') {
        e.stT = A.over; e.atk = 0;
    } else if (e.act === 'charge') {
        const M = R.mech;
        e.dir = Math.atan2(M.y - e.y, M.x - e.x);
        e.stT = A.time;
    } else if (e.act === 'stomp') {
        explode(R, e.x, e.y, A.radius, A.dmg * R.dmgScale, A.terrain, 'monster');
    } else if (e.act === 'summon') {
        for (let k = 0; k < A.count; k++) {
            const a = (k / A.count) * Math.PI * 2;
            const x = e.x + Math.cos(a) * (e.r + 1), y = e.y + Math.sin(a) * (e.r + 1);
            const cx = cellOf(x), cy = cellOf(y);
            if (inMap(cx, cy) && !solid(R.W, idx(cx, cy))) spawnEnemy(R, A.kind, x, y);
        }
    }
}

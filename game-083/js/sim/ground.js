// Act I: the march on foot, after Battlezone. The dragon turns and walks like a tank across an
// endless plain of standing stones and ruins; the kingdom's footmen, ballistae, lancers, wizards,
// trolls and war wagons come at it from every side, and the radar is the only warning.

import { GROUND } from '../config.js';
import { ENEMY, FOE, STAGES } from './data.js';
import { obstacleAt, pushOut } from './world.js';
import { clamp, wrapA, fwdX, fwdZ, headingTo, turnToward, TAU } from './util.js';
import { diff, hurt, damage, kill, newId, stageClear } from './common.js';

export function initGround(G, fresh) {
    const p = G.player;
    if (fresh) { p.x = 0; p.z = 0; p.h = 0; }
    p.speed = 0; p.cd = 0; p.inv = 0; p.bumpT = 0;
    G.spawnT = 0.6;
    G.firstSpawn = true;
    G.wispT = 28 + G.rng() * 25;
    const def = STAGES[G.stageIdx];
    if (def.boss) {
        const e = spawnEnemy(G, def.boss, true, 64);
        e.hp = e.maxHp = ENEMY[def.boss].hp + 4 * G.loop;
    }
}

function makeEnemy(G, kind, x, z) {
    const D = ENEMY[kind], p = G.player, rng = G.rng;
    const h = headingTo(x, z, p.x, p.z);
    return {
        id: newId(G), kind, x, z, y: D.fly || 0, h, ta: h,
        hp: D.hp, maxHp: D.hp, t: 0, cd: 1.6 + rng() * 1.6, hurtT: 0, speed: 0,
        mode: 'aim', modeT: 2 + rng() * 2, side: rng() < 0.5 ? -1 : 1, ph: rng() * TAU,
        tp: 4 + rng() * 3, summonT: 9, wander: rng() * TAU, wanderT: 0, life: 15,
    };
}

/** A new enemy somewhere around the dragon (ahead of it if `ahead`), clear of obstacles. */
export function spawnEnemy(G, kind, ahead = false, dist = 0) {
    const p = G.player, rng = G.rng, D = ENEMY[kind];
    let x = 0, z = 0;
    for (let k = 0; k < 10; k++) {
        const a = ahead ? p.h + (rng() - 0.5) * 0.9 : rng() * TAU;
        const r = dist || rng.range(GROUND.spawnMin, GROUND.spawnMax);
        x = p.x + Math.sin(a) * r;
        z = p.z - Math.cos(a) * r;
        if (!obstacleAt(G.seed, x, z, D.r + 1.5)) break;
    }
    const e = makeEnemy(G, kind, x, z);
    G.enemies.push(e);
    G.events.push({ type: 'spawn', kind, id: e.id, x, y: e.y, z });
    return e;
}

function pickKind(G, mix) {
    let total = 0;
    for (const k in mix) total += mix[k];
    let r = G.rng() * total;
    for (const k in mix) { r -= mix[k]; if (r < 0) return k; }
    return Object.keys(mix)[0];
}

/** Launch a missile from enemy e at the dragon. spread rotates the aim (rad). */
function throwFoe(G, kind, e, y, spread = 0, from = null) {
    const F = FOE[kind], p = G.player;
    const sp = F.speed * Math.min(diff(G), 1.8);
    const hh = from ?? e.h;
    const off = ENEMY[e.kind].r + 0.6;
    const sx = e.x + fwdX(hh) * off, sz = e.z + fwdZ(hh) * off;
    // later cycles lead the target
    const lead = clamp(G.loop * 0.5, 0, 1);
    const tt = Math.hypot(p.x - sx, p.z - sz) / sp;
    const tx = p.x + fwdX(p.h) * p.speed * tt * lead, tz = p.z + fwdZ(p.h) * p.speed * tt * lead;
    const a = headingTo(sx, sz, tx, tz) + spread;
    G.foes.push({ id: newId(G), kind, x: sx, y, z: sz, vx: fwdX(a) * sp, vy: 0, vz: fwdZ(a) * sp, life: F.life, r: F.r });
    G.events.push({ type: 'enemyFire', kind: e.kind, foe: kind, x: sx, y, z: sz });
}

function teleport(G, e) {
    const p = G.player, rng = G.rng;
    const x0 = e.x, z0 = e.z;
    for (let k = 0; k < 8; k++) {
        const a = rng() * TAU, r = rng.range(24, 40);
        const x = p.x + Math.sin(a) * r, z = p.z - Math.cos(a) * r;
        if (!obstacleAt(G.seed, x, z, 2.5)) { e.x = x; e.z = z; break; }
    }
    e.h = headingTo(e.x, e.z, p.x, p.z);
    G.events.push({ type: 'teleport', id: e.id, x0, z0, x: e.x, y: e.y, z: e.z });
}

function stepEnemy(G, e, dt) {
    const p = G.player, rng = G.rng, dm = diff(G);
    const dist = Math.hypot(p.x - e.x, p.z - e.z);
    const want = headingTo(e.x, e.z, p.x, p.z);
    const err = Math.abs(wrapA(want - e.h));
    e.t += dt;
    e.cd -= dt;
    e.hurtT = Math.max(0, e.hurtT - dt);
    const touch = ENEMY[e.kind].r + GROUND.radius + 0.4;

    switch (e.kind) {
        case 'footman':
            e.h = turnToward(e.h, want, 2.5 * dt);
            e.speed = dist > 21 ? 3.2 * dm : dist < 11 ? -2 : 0;
            if (dist < 32 && e.cd <= 0 && err < 0.2) { throwFoe(G, 'spear', e, 1.5); e.cd = (3.8 + rng() * 1.6) / dm; }
            break;

        case 'ballista':
        case 'juggernaut': {
            const jug = e.kind === 'juggernaut';
            e.modeT -= dt;
            if (e.modeT <= 0) {
                e.mode = e.mode === 'aim' ? 'strafe' : 'aim';
                e.modeT = e.mode === 'aim' ? 3 + rng() * 1.5 : 1.8 + rng() * 1.2;
                e.side = rng() < 0.5 ? -1 : 1;
            }
            const far = dist > (jug ? 44 : 52);
            const aim = far || e.mode === 'aim';
            e.h = turnToward(e.h, aim ? want : want + e.side * 1.3, (jug ? 1.5 : 0.95) * dm * dt);
            const sp = (jug ? 8 : 4.6) * dm;
            e.speed = dist < 18 ? -3 : far || e.mode === 'strafe' ? sp : 0;
            if (aim && dist < 72 && err < 0.07 && e.cd <= 0) {
                if (jug) { throwFoe(G, 'bolt', e, 1.4, -0.05); throwFoe(G, 'bolt', e, 1.4, 0.05); }
                else throwFoe(G, 'bolt', e, 1.4);
                e.cd = (jug ? 2.6 + rng() : 3.8 + rng() * 1.3) / dm;
            }
            break;
        }

        case 'lancer': {
            const zig = Math.sin(e.t * 2.6 + e.ph) * (dist > 14 ? 0.75 : 0.12);
            e.h = turnToward(e.h, want + zig, 2.4 * dt);
            e.speed = 15 * Math.min(dm, 1.5);
            if (dist < touch) {
                hurt(G, 'lancer', e.x, 1, e.z);
                kill(G, e, 0);
                G.events.push({ type: 'crash', kind: e.kind, x: e.x, y: 1, z: e.z });
            }
            break;
        }

        case 'wizard':
            e.h = turnToward(e.h, want, 3 * dt);
            e.speed = 0;
            e.y = ENEMY.wizard.fly + Math.sin(e.t * 2 + e.ph) * 0.4;
            e.tp -= dt;
            if (e.tp <= 0) { teleport(G, e); e.tp = 5.5 + rng() * 2.5; }
            if (dist < 62 && e.cd <= 0) { throwFoe(G, 'orb', e, 1.6); e.cd = (4.4 + rng() * 1.2) / dm; }
            break;

        case 'troll':
            e.h = turnToward(e.h, want, 2 * dt);
            e.speed = e.hurtT > 0 ? 0 : 5.8 * Math.min(dm, 1.5);
            if (dist < touch + 0.4 && e.cd <= 0) {
                hurt(G, 'troll', e.x, 1.5, e.z);
                G.events.push({ type: 'smash', x: e.x, y: 1, z: e.z });
                e.cd = 1.8;
                e.x -= fwdX(e.h) * 4; e.z -= fwdZ(e.h) * 4;
            }
            break;

        case 'wisp':
            e.wanderT -= dt;
            if (e.wanderT <= 0) { e.wander = rng() * TAU; e.wanderT = 1.5 + rng() * 2; }
            e.h = turnToward(e.h, e.wander, 1.2 * dt);
            e.speed = 7;
            e.y = ENEMY.wisp.fly + Math.sin(e.t * 3 + e.ph) * 0.8;
            e.life -= dt;
            if (e.life <= 0) { e.dead = true; G.events.push({ type: 'wispGone', id: e.id, x: e.x, y: e.y, z: e.z }); }
            break;

        case 'dragonbane': {
            const half = e.hp <= e.maxHp / 2;
            e.h = turnToward(e.h, dist > 36 ? want : want + 1.4 * e.side, 0.5 * dt);
            e.speed = (dist > 36 ? 4 : 3) * Math.min(dm, 1.5);
            e.ta = turnToward(e.ta, want, 0.9 * dm * dt);
            const terr = Math.abs(wrapA(want - e.ta));
            if (dist < 92 && terr < 0.12 && e.cd <= 0) {
                const n = half ? 5 : 3;
                for (let i = 0; i < n; i++) throwFoe(G, 'bolt', e, 3, (i - (n - 1) / 2) * 0.14, e.ta);
                e.cd = (half ? 2.4 : 3.2) / dm;
            }
            e.summonT -= dt;
            if (e.summonT <= 0) {
                e.summonT = half ? 9 : 12;
                const adds = G.enemies.filter((o) => o.add && !o.dead).length;
                for (let i = 0; i < 2 && adds + i < 4; i++) {
                    const s = i ? 1 : -1;
                    const a = makeEnemy(G, 'footman', e.x + Math.cos(e.h) * 7 * s, e.z + Math.sin(e.h) * 7 * s);
                    a.add = true;
                    G.enemies.push(a);
                    G.events.push({ type: 'spawn', kind: 'footman', id: a.id, x: a.x, y: 0, z: a.z, add: true });
                }
            }
            if (dist < ENEMY.dragonbane.r + GROUND.radius) {
                hurt(G, 'dragonbane', e.x, 2, e.z);
                const k = (ENEMY.dragonbane.r + GROUND.radius + 0.5) / Math.max(dist, 0.01);
                p.x = e.x + (p.x - e.x) * k; p.z = e.z + (p.z - e.z) * k;
            }
            break;
        }
    }

    if (e.speed) {
        e.x += fwdX(e.h) * e.speed * dt;
        e.z += fwdZ(e.h) * e.speed * dt;
    }
    if (!ENEMY[e.kind].fly) pushOut(G.seed, e, ENEMY[e.kind].r * 0.8);
}

function stepShots(G, dt) {
    for (let i = G.shots.length - 1; i >= 0; i--) {
        const s = G.shots[i];
        s.x += s.vx * dt; s.z += s.vz * dt; s.life -= dt;
        let gone = s.life <= 0;
        if (!gone && obstacleAt(G.seed, s.x, s.z, 0.1)) {
            gone = true;
            G.events.push({ type: 'shotHit', x: s.x, y: s.y, z: s.z });
        }
        if (!gone) {
            for (const e of G.enemies) {
                if (e.dead) continue;
                if (Math.hypot(e.x - s.x, e.z - s.z) < ENEMY[e.kind].r + 0.6) {
                    damage(G, e, 1);
                    gone = true;
                    break;
                }
            }
        }
        if (!gone) {
            for (const f of G.foes) {
                if (f.dead || !FOE[f.kind].shootable) continue;
                if (Math.hypot(f.x - s.x, f.z - s.z) < f.r + 0.8) {
                    f.dead = true;
                    gone = true;
                    G.score += FOE[f.kind].score;
                    G.events.push({ type: 'foeShot', kind: f.kind, x: f.x, y: f.y, z: f.z, score: FOE[f.kind].score });
                    break;
                }
            }
        }
        if (gone) G.shots.splice(i, 1);
    }
}

function stepFoes(G, dt) {
    const p = G.player;
    for (const f of G.foes) {
        if (f.dead) continue;
        const F = FOE[f.kind];
        if (F.homing) {
            const a = Math.atan2(f.vx, -f.vz);
            const sp = Math.hypot(f.vx, f.vz);
            const na = turnToward(a, headingTo(f.x, f.z, p.x, p.z), F.homing * dt);
            f.vx = fwdX(na) * sp; f.vz = fwdZ(na) * sp;
        }
        f.x += f.vx * dt; f.z += f.vz * dt;
        f.life -= dt;
        if (f.life <= 0) { f.dead = true; continue; }
        if (obstacleAt(G.seed, f.x, f.z, 0)) {
            f.dead = true;
            G.events.push({ type: 'foeHit', kind: f.kind, x: f.x, y: f.y, z: f.z });
            continue;
        }
        if (Math.hypot(f.x - p.x, f.z - p.z) < f.r + GROUND.radius) {
            f.dead = true;
            hurt(G, f.kind, f.x, f.y, f.z);
        }
    }
}

function spawner(G, dt) {
    const def = STAGES[G.stageIdx];
    if (def.boss) return;
    let alive = 0;
    for (const e of G.enemies) if (!e.dead && ENEMY[e.kind].quota) alive++;
    const maxAlive = def.maxAlive + Math.min(2, G.loop);
    if (alive < maxAlive && G.stageKills + alive < def.quota) {
        G.spawnT -= dt;
        if (G.spawnT <= 0) {
            // the first enemy of a march comes from in front, so a new player sees what they face
            spawnEnemy(G, pickKind(G, def.mix), G.firstSpawn);
            G.firstSpawn = false;
            G.spawnT = 1.4 + G.rng() * 2.2;
        }
    }
    G.wispT -= dt;
    if (G.wispT <= 0) {
        G.wispT = 40 + G.rng() * 30;
        if (!G.enemies.some((e) => e.kind === 'wisp' && !e.dead)) {
            spawnEnemy(G, 'wisp', false, 40);
            G.events.push({ type: 'wisp' });
        }
    }
}

export function stepGround(G, inp, dt) {
    const p = G.player;
    const live = G.phase !== 'dead' && G.phase !== 'ascend';
    p.inv = Math.max(0, p.inv - dt);
    p.cd -= dt;
    p.bumpT -= dt;

    if (live) {
        const fin = clamp(-inp.y, -1, 1), tin = clamp(inp.x, -1, 1);
        p.h = wrapA(p.h + tin * GROUND.turn * dt);
        p.speed = fin >= 0 ? fin * GROUND.speed : fin * GROUND.back;
        p.x += fwdX(p.h) * p.speed * dt;
        p.z += fwdZ(p.h) * p.speed * dt;
        if (pushOut(G.seed, p, GROUND.radius) && p.bumpT <= 0 && Math.abs(p.speed) > 1) {
            p.bumpT = 0.7;
            G.events.push({ type: 'bump' });
        }
        if (inp.a && p.cd <= 0 && G.shots.length < GROUND.maxShots) {
            const fx = fwdX(p.h), fz = fwdZ(p.h), sp = GROUND.shotSpeed;
            G.shots.push({ x: p.x + fx * 1.6, y: 1.2, z: p.z + fz * 1.6, vx: fx * sp, vz: fz * sp, life: GROUND.shotRange / sp });
            p.cd = GROUND.fireCd;
            G.events.push({ type: 'fire', mode: 'ground' });
        }
    } else p.speed = 0;

    stepShots(G, dt);
    if (G.phase === 'play') {
        for (const e of G.enemies) if (!e.dead) stepEnemy(G, e, dt);
        stepFoes(G, dt);
        spawner(G, dt);
        const def = STAGES[G.stageIdx];
        const bossDown = def.boss && !G.enemies.some((e) => e.kind === def.boss && !e.dead);
        if (bossDown) {
            // the engine's summoned footmen flee when it falls
            for (const e of G.enemies) if (!e.dead && e.add) { e.dead = true; G.events.push({ type: 'flee', id: e.id, x: e.x, y: 0, z: e.z }); }
            stageClear(G, 10000);
        } else if (!def.boss && G.stageKills >= def.quota) stageClear(G, 2000 * (G.stageIdx + 1));
    }
}

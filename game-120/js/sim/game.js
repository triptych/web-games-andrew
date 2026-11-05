// The simulation. Pure: no DOM, no rendering library, no Math.random, no clock.
// The view reads G and drains G.events; the tests and the bot drive step() directly.

import { STEP, GRAVITY, ENEMY_WAKE_DIST } from '../config.js';
import { makeRng } from '../rng.js';
import { LEVELS, COSTS, TRACKS, MAX_TIER, HAZARDS, BOSSES } from './data.js';
import { makeWorld } from './terrain.js';
import {
    clamp, angDiff, yawOf, ev, nid, refreshStats, addEnemy, spawnPickup, shoot, boom, hurtEnemy, hurtPlayer, hurtPod, freePod,
    moveBody, enemyDef, lvOf,
} from './core.js';
import { updateEnemy } from './enemies.js';
import { updateBoss, detonateMark, bossOf } from './boss.js';

const SAVE_V = 1;
export const LEG_FOOT = 0.55;           // rubble is stepped round by the legs, not the hull: blockers see this fraction of the radius
const NOT_SAVED = new Set(['world', 'st', 'events', 'rng']);

// ------------------------------------------------------------------ setup
export function newGame(seed = 1) {
    const G = {
        v: SAVE_V, seed, rng: makeRng(seed ^ 0x9e3779b9), t: 0, nid: 0, level: 0, phase: 'brief',
        upg: { guns: 0, missiles: 0, armor: 0, fuel: 0, legs: 0 }, scrap: 0, score: 0, rescued: 0, podsFreed: 0, kills: 0, deaths: 0,
        player: null, enemies: [], bullets: [], pickups: [], pods: [], marks: [], waves: [], fires: [], alert: {}, ambushDone: [], flags: {},
        bossAlive: false, bossActive: false, bossDone: false, storm: 0, stormT: 0, victoryT: 0,
        stat: { kills: 0, dealt: 0, taken: 0, rescued: 0, scrapGot: 0, time: 0 }, cp: null, report: null, levelSeed: 0,
        events: [],
    };
    refreshStats(G);
    startLevel(G, 0);
    return G;
}

export function startLevel(G, li) {
    const lv = LEVELS[li];
    G.level = li;
    G.levelSeed = ((G.seed * 13 + li * 1000 + 7) >>> 0);
    G.world = makeWorld(li, G.levelSeed);
    refreshStats(G);
    const w = G.world, st = G.st;
    G.enemies = []; G.bullets = []; G.pickups = []; G.pods = []; G.marks = []; G.waves = []; G.fires = [];
    G.alert = {}; G.ambushDone = w.ambushes.map(() => false); G.flags = {};
    G.bossAlive = false; G.bossActive = false; G.bossDone = false; G.storm = 0; G.victoryT = 0;
    G.stat = { kills: 0, dealt: 0, taken: 0, rescued: 0, scrapGot: 0, time: 0 };
    G.player = {
        x: 0, z: 0, y: w.h(0, 0), vx: 0, vz: 0, vy: 0, yaw: 0, hp: st.maxHp, fuel: st.fuelMax, missiles: st.msl.ammo,
        fireCd: 0, mslCd: 0, salvo: 0, salvoT: 0, barrel: 0, grounded: true, boosting: false, jetting: false, stride: 0,
        hurtT: 0, shieldT: 1.5, target: 0, iceT: 0, slow: 1, lastFall: 0, lowWarned: false,
    };
    for (const s of w.spawns) addEnemy(G, s.type, s.x, s.z, { camp: s.camp });
    for (const pd of w.pods) G.pods.push({ id: nid(G), x: pd.x, z: pd.z, n: pd.n, hp: Math.round(70 * lv.hpScale), maxhp: Math.round(70 * lv.hpScale), freed: false });
    if (lv.boss && w.arena) {
        addEnemy(G, lv.boss, w.arena.x, w.arena.z);
        G.bossAlive = true;
    }
    G.cp = { scrap: G.scrap, score: G.score, rescued: G.rescued, podsFreed: G.podsFreed, kills: G.kills };
    G.phase = 'brief';
}

/** Leave the briefing and start fighting. */
export function begin(G) {
    if (G.phase !== 'brief') return;
    G.phase = 'play';
    ev(G, { type: 'radio', id: `${lvOf(G).id}.start` });
}

/** Restart the level after being destroyed, with the loadout and scrap you had when it began. */
export function retry(G) {
    const c = G.cp;
    G.scrap = c.scrap; G.score = c.score; G.rescued = c.rescued; G.podsFreed = c.podsFreed; G.kills = c.kills;
    startLevel(G, G.level);
}

export function toHangar(G) { if (G.phase === 'complete' && G.level < LEVELS.length - 1) G.phase = 'hangar'; }
export function deploy(G) {
    if (G.phase !== 'hangar') return false;
    startLevel(G, G.level + 1);
    return true;
}

export const tierCost = (G, track) => (G.upg[track] >= MAX_TIER ? null : COSTS[track][G.upg[track]]);
export function buy(G, track) {
    if (!TRACKS.includes(track)) return { ok: false, reason: 'unknown' };
    if (G.upg[track] >= MAX_TIER) return { ok: false, reason: 'max' };
    const c = COSTS[track][G.upg[track]];
    if (G.scrap < c) return { ok: false, reason: 'scrap' };
    G.scrap -= c; G.upg[track]++;
    refreshStats(G);
    const p = G.player;
    p.fuel = G.st.fuelMax; p.missiles = G.st.msl.ammo;
    ev(G, { type: 'upgrade', track, tier: G.upg[track] });
    return { ok: true };
}
/** Hangar repairs: every level starts with a full hull; this keeps the player state in step with new stats. */
export function refit(G) {
    const p = G.player, st = G.st;
    p.hp = st.maxHp; p.fuel = st.fuelMax; p.missiles = st.msl.ammo;
}

// ------------------------------------------------------------------ the step
export function step(G, inp, dt) {
    if (G.events.length > 800) G.events.splice(0, 400);
    if (G.phase === 'complete' || G.phase === 'hangar' || G.phase === 'brief') return;
    G.t += dt;
    if (G.phase === 'play') G.stat.time += dt;
    const p = G.player;
    if (G.phase === 'play') {
        updatePlayer(G, inp, dt);
        triggers(G, dt);
    } else if (G.phase === 'victory') {
        G.victoryT += dt;
    }
    for (const e of G.enemies) { if (e.dead) continue; if (e.b) updateBoss(G, e, dt); else updateEnemy(G, e, dt); }
    if (G.enemies.some((e) => e.dead)) G.enemies = G.enemies.filter((e) => !e.dead);
    updateBullets(G, dt);
    updateMarks(G, dt);
    updateWaves(G, dt);
    updateFires(G, dt);
    updatePickups(G, dt);
    if (G.storm > 0) { G.storm -= dt; if (G.storm <= 0) ev(G, { type: 'storm', on: 0 }); }
    if (G.phase === 'play') checkEnd(G);
    void p;
}

// ------------------------------------------------------------------ the walker
function pickTarget(G, inp) {
    const p = G.player;
    const mv = Math.hypot(inp.x, inp.y);
    const base = inp.aim ? yawOf(inp.ax, inp.az) : (mv > 0.2 ? yawOf(inp.x, inp.y) : p.yaw);
    let best = null, bs = 1e9;
    for (const e of G.enemies) {
        if (e.hp <= 0 || (e.b && (e.b.under || e.b.dying > 0))) continue;
        const dx = e.x - p.x, dz = e.z - p.z, d = Math.hypot(dx, dz);
        if (d > 78 || (!e.awake && d > 46)) continue;
        const a = Math.abs(angDiff(base, yawOf(dx, dz)));
        const cone = inp.aim ? 0.15 + e.r / Math.max(d, 4) * 1.4 : 1.25;
        if (a > cone) continue;
        const s = a * 30 + d * 0.15 - (e.b ? 6 : 0);
        if (s < bs) { bs = s; best = e; }
    }
    return { e: best, base, mv };
}

function updatePlayer(G, inp, dt) {
    const p = G.player, st = G.st, w = G.world;
    p.quiet = (p.quiet || 0) + dt;      // nanite repair: a trickle of armour back once nothing has hit you for a while
    if (p.quiet > 4 && p.hp < G.st.maxHp * 0.7) p.hp = Math.min(G.st.maxHp * 0.7, p.hp + G.st.maxHp * 0.035 * dt);
    p.hurtT = Math.max(0, p.hurtT - dt); p.shieldT = Math.max(0, p.shieldT - dt); p.iceT = Math.max(0, p.iceT - dt);
    const gy = w.h(p.x, p.z);
    const air = p.y - gy > 0.35;
    p.grounded = !air;

    // aim: turn the whole walker; the guns follow its facing
    const { e: tgt, base, mv } = pickTarget(G, inp);
    p.target = tgt ? tgt.id : 0;
    let want = tgt ? yawOf(tgt.x - p.x, tgt.z - p.z) : (inp.aim ? base : (mv > 0.2 ? base : p.yaw));
    p.yaw += clamp(angDiff(p.yaw, want), -9 * dt, 9 * dt);

    // hazards
    let slow = 1, ice = p.iceT > 0 || G.storm > 0;
    if (!air) {
        const hz = w.hazardAt(p.x, p.z);
        if (hz) {
            const H = HAZARDS[hz.type];
            slow = Math.min(slow, H.slow);
            if (H.ice) ice = true;
            if (H.dps) { p.hazAcc = (p.hazAcc || 0) + H.dps * lvOf(G).dmgScale * 0.5 * dt; if (p.hazAcc > 3) { hurtPlayer(G, p.hazAcc, hz.x, hz.z); p.hazAcc = 0; } }
        }
    }
    p.slow = slow;

    // movement
    const len = Math.hypot(inp.x, inp.y), k = len > 1 ? 1 / len : 1;
    const mx = inp.x * k, mz = inp.y * k;
    p.boosting = !!inp.boost && p.fuel > 0 && len > 0.1;
    let speed = st.speed * slow * (p.boosting ? 1.75 : 1);
    if (p.boosting) p.fuel -= 24 * dt;
    const accel = ice ? 5 : (air ? 9 : 42);
    p.vx += clamp(mx * speed - p.vx, -accel * dt, accel * dt);
    p.vz += clamp(mz * speed - p.vz, -accel * dt, accel * dt);
    moveBody(G, p, dt, st.rad * LEG_FOOT, st.climb, st.clear, air);

    // jump jets
    p.jetting = false;
    if (inp.jump && !air && p.fuel >= 14) {
        p.vy = 13.5; p.fuel -= 14; p.y += 0.05;
        ev(G, { type: 'jump', x: p.x, z: p.z });
    } else if (air && inp.jet && p.fuel > 0 && p.vy < 9) {
        p.vy += 40 * dt; p.fuel -= 34 * dt; p.jetting = true;
    }
    const gy2 = w.h(p.x, p.z);
    if (p.vy !== 0 || p.y - gy2 > 0.35) {
        p.vy -= GRAVITY * dt;
        p.y += p.vy * dt;
        if (p.y <= gy2 && p.vy <= 0) {
            const fall = -p.vy;
            p.y = gy2; p.vy = 0;
            if (fall > 9) land(G, fall);
        }
    } else p.y = gy2;
    if (!p.boosting && !p.jetting) p.fuel = Math.min(st.fuelMax, p.fuel + st.fuelRegen * dt * (p.y - gy2 < 0.4 ? 1 : 0.3));
    p.fuel = clamp(p.fuel, 0, st.fuelMax);

    // stride events for audio/dust
    if (p.y - gy2 < 0.4) {
        p.stride += Math.hypot(p.vx, p.vz) * dt;
        if (p.stride > 2.6 * st.scale) { p.stride = 0; ev(G, { type: 'step', x: p.x, z: p.z }); }
    }

    // guns
    p.fireCd -= dt;
    const gun = st.gun;
    if (inp.fire) {
        if (p.fireCd <= 0) {
            fireGun(G, tgt, inp);
            p.fireCd += 1 / gun.rate;
            if (p.fireCd < -dt) p.fireCd = 0;
        }
    } else if (p.fireCd < 0) p.fireCd = 0;

    // missiles
    const ms = st.msl;
    p.missiles = Math.min(ms.ammo, p.missiles + dt / ms.reload);
    p.mslCd -= dt;
    if (inp.msl && p.mslCd <= 0 && p.salvo <= 0 && p.missiles >= 1) {
        p.salvo = Math.min(ms.salvo, Math.floor(p.missiles));
        p.missiles -= p.salvo;
        p.salvoT = 0; p.mslCd = 0.5;
    }
    if (p.salvo > 0) {
        p.salvoT -= dt;
        if (p.salvoT <= 0) { launchMissile(G, tgt, inp, ms.salvo - p.salvo); p.salvo--; p.salvoT = 0.09; }
    }

    // pickups are handled in updatePickups
    if (p.hp < st.maxHp * 0.3 && !p.lowWarned) { p.lowWarned = true; ev(G, { type: 'radio', id: 'lowhp' }); }
    if (p.hp > st.maxHp * 0.5) p.lowWarned = false;
}

function land(G, fall) {
    const p = G.player, st = G.st;
    const f = clamp(fall / 16, 0.4, 1.4);
    ev(G, { type: 'stomp', x: p.x, z: p.z, r: st.stompR, mine: 1 });
    ev(G, { type: 'land', x: p.x, z: p.z, fall });
    for (const e of G.enemies) {
        if (e.hp <= 0) continue;
        const d = Math.hypot(e.x - p.x, e.z - p.z) - e.r;
        if (d < st.stompR && !e.fly) {
            hurtEnemy(G, e, st.stompDmg * f * (1 - d / st.stompR * 0.5), { dx: (e.x - p.x) / (d + e.r + 1e-3), dz: (e.z - p.z) / (d + e.r + 1e-3) });
            if (e.hp > 0 && enemyDef(e.type).inf) { e.vx += (e.x - p.x) * 1.5; e.vz += (e.z - p.z) * 1.5; e.kd = 0.5; }
        }
    }
}

function muzzlePos(G, side, up, fwd) {
    const p = G.player, s = G.st.scale;
    const sy = Math.sin(p.yaw), cy = Math.cos(p.yaw);
    return { x: p.x + sy * fwd * s - (-cy) * 0 + cy * side * s, y: p.y + up * s, z: p.z - cy * fwd * s + sy * side * s };
}

function dirFor(G, tgt, inp, m, spread) {
    const p = G.player;
    let dist, ty;
    if (tgt) { dist = Math.max(3, Math.hypot(tgt.x - m.x, tgt.z - m.z)); ty = tgt.y + (tgt.fly ? 0 : tgt.h * 0.45); }
    else { dist = clamp(inp.ad || 26, 8, 60); const ax = m.x + Math.sin(p.yaw) * dist, az = m.z - Math.cos(p.yaw) * dist; ty = G.world.h(ax, az) + 1.0; }
    const pitch = Math.atan2(ty - m.y, dist);
    const yaw = p.yaw + (G.rng() - 0.5) * spread * 2, pit = pitch + (G.rng() - 0.5) * spread;
    const cp = Math.cos(pit);
    return { dx: Math.sin(yaw) * cp, dy: Math.sin(pit), dz: -Math.cos(yaw) * cp };
}

function fireGun(G, tgt, inp) {
    const p = G.player, g = G.st.gun;
    const nb = g.barrels;
    const idx = p.barrel % nb;
    p.barrel++;
    const side = (idx - (nb - 1) / 2) * 0.62;
    const m = muzzlePos(G, side, 2.0, 2.2);
    const d = dirFor(G, tgt, inp, m, g.spread);
    shoot(G, { team: 'p', kind: g.pierce >= 5 ? 'slug' : 'bolt', x: m.x, y: m.y, z: m.z, dx: d.dx, dy: d.dy, dz: d.dz, speed: g.speed, dmg: g.dmg, splash: g.splash, life: g.life, r: g.r, pierce: g.pierce, col: g.col });
    ev(G, { type: 'shot', team: 'p', tier: G.upg.guns, barrel: idx, x: m.x, y: m.y, z: m.z, dx: d.dx, dy: d.dy, dz: d.dz });
}

function launchMissile(G, tgt, inp, k) {
    const p = G.player, ms = G.st.msl;
    const side = (k % 2 ? 1 : -1) * (1.3 + 0.25 * Math.floor(k / 2));
    const m = muzzlePos(G, side, 3.0, 0.8);
    let t = tgt;
    if (ms.homing) {          // spread a salvo across nearby targets
        const near = G.enemies.filter((e) => e.hp > 0 && !(e.b && e.b.under) && Math.hypot(e.x - p.x, e.z - p.z) < 70 && Math.abs(angDiff(p.yaw, yawOf(e.x - p.x, e.z - p.z))) < 1.1)
            .sort((a, b) => Math.hypot(a.x - p.x, a.z - p.z) - Math.hypot(b.x - p.x, b.z - p.z));
        if (near.length) t = near[k % near.length];
    }
    const d = dirFor(G, t, inp, m, 0.05);
    const up = ms.homing ? 0.5 : 0.1;
    const l = Math.hypot(d.dx, d.dy + up, d.dz);
    shoot(G, { team: 'p', kind: 'missile', x: m.x, y: m.y, z: m.z, dx: d.dx / l, dy: (d.dy + up) / l, dz: d.dz / l, speed: 26, dmg: ms.dmg, splash: ms.splash, life: 4, r: 0.5,
        tgt: ms.homing && t ? t.id : 0, turn: ms.homing ? 3.2 : 0, cluster: ms.cluster, col: 0xffaa55 });
    ev(G, { type: 'shot', team: 'p', kind: 'missile', x: m.x, y: m.y, z: m.z });
}

// ------------------------------------------------------------------ bullets
function updateBullets(G, dt) {
    const w = G.world, p = G.player, st = G.st;
    const list = G.bullets;
    let n = 0;
    for (let i = 0; i < list.length; i++) {
        const b = list[i];
        b.life -= dt;
        let dead = b.life <= 0;
        // steering
        if (b.turn && !dead) {
            let tx, ty, tz, ok = false;
            if (b.tgt === -1) { tx = p.x; ty = p.y + st.eye * 0.5; tz = p.z; ok = true; }
            else if (b.tgt > 0) { const e = G.enemies.find((q) => q.id === b.tgt); if (e && e.hp > 0) { tx = e.x; ty = e.y + (e.fly ? 0 : e.h * 0.5); tz = e.z; ok = true; } }
            if (ok) {
                const sp = Math.hypot(b.vx, b.vy, b.vz) || 1;
                let dx = tx - b.x, dy = ty - b.y, dz = tz - b.z; const dl = Math.hypot(dx, dy, dz) || 1;
                dx /= dl; dy /= dl; dz /= dl;
                const k = Math.min(1, b.turn * dt);
                let nx = b.vx / sp + (dx - b.vx / sp) * k, ny = b.vy / sp + (dy - b.vy / sp) * k, nz = b.vz / sp + (dz - b.vz / sp) * k;
                const nl = Math.hypot(nx, ny, nz) || 1;
                b.vx = nx / nl * sp; b.vy = ny / nl * sp; b.vz = nz / nl * sp;
            }
        }
        if (b.grav) b.vy -= b.grav * dt;
        // sub-step fast bullets so they cannot skip a target
        const sp = Math.hypot(b.vx, b.vy, b.vz), steps = Math.max(1, Math.ceil(sp * dt / 1.2));
        const sdt = dt / steps;
        for (let s = 0; s < steps && !dead; s++) {
            b.x += b.vx * sdt; b.y += b.vy * sdt; b.z += b.vz * sdt;
            if (b.y < w.h(b.x, b.z) + 0.05) { dead = true; impact(G, b, 'ground'); break; }
            if (Math.abs(b.x - w.cx(b.z)) > w.hw(b.z) * 1.4 + 6) { dead = true; impact(G, b, 'ground'); break; }
            for (const k of w.near(b.x, b.z)) {
                if (k.h > 1.4 && b.y < k.y + k.h && Math.hypot(b.x - k.x, b.z - k.z) < k.r + b.r * 0.3) {
                    if (b.team === 'p' && b.pierce >= 6) continue;
                    dead = true; impact(G, b, 'cover'); break;
                }
            }
            if (dead) break;
            if (b.team === 'p') {
                for (const e of G.enemies) {
                    if (e.hp <= 0 || (e.b && e.b.under)) continue;
                    if (b.hit && b.hit.includes(e.id)) continue;
                    const dd = Math.hypot(e.x - b.x, e.z - b.z);
                    if (dd > e.r + b.r + (e.b ? 0.5 : 0)) continue;
                    const y0 = e.fly ? e.y - 1.6 : e.y - 0.8, y1 = e.fly ? e.y + 1.6 : e.y + e.h + 1.4;
                    if (b.y < y0 || b.y > y1) continue;
                    hurtEnemy(G, e, b.dmg, { small: b.kind !== 'missile', x: b.x, y: b.y, z: b.z, dx: b.vx / (sp || 1), dz: b.vz / (sp || 1) });
                    if (b.pierce > 0 && b.kind !== 'missile') { (b.hit = b.hit || []).push(e.id); b.pierce--; if (b.splash) impact(G, b, 'enemy', true); }
                    else { dead = true; impact(G, b, 'enemy'); break; }
                }
                if (!dead) for (const pod of G.pods) {
                    if (pod.freed) continue;
                    if (Math.hypot(pod.x - b.x, pod.z - b.z) < 2.2 + b.r && b.y < w.h(pod.x, pod.z) + 4.5) { hurtPod(G, pod, b.dmg); dead = true; impact(G, b, 'enemy'); break; }
                }
            } else if (G.phase === 'play') {
                const dd = Math.hypot(p.x - b.x, p.z - b.z);
                if (dd < st.rad + b.r && b.y > p.y - 0.6 && b.y < p.y + st.eye * 1.5) {
                    dead = true; impact(G, b, 'player');
                    if (!b.splash) hurtPlayer(G, b.dmg, b.x - b.vx, b.z - b.vz);
                }
            }
        }
        if (!dead && b.life <= 0) { dead = true; impact(G, b, 'expire'); }
        if (!dead) list[n++] = b;
    }
    list.length = n;
}

function impact(G, b, what, quiet = false) {
    const w = G.world;
    if (b.splash > 0) {
        boom(G, b.x, Math.max(b.y, w.h(b.x, b.z)), b.z, b.splash, b.dmg, b.team, { size: b.splash > 3.5 ? 3 : 2, kind: b.kind, crater: b.splash > 2.5 && what === 'ground' });
        if (b.fire) G.fires.push({ id: nid(G), x: b.x, z: b.z, r: 2.6, t: 4, dps: 8 * lvOf(G).dmgScale * 0.8, lava: false, grow: 0 });
        if (b.cluster) for (let i = 0; i < b.cluster; i++) {
            const a = (i / b.cluster) * 6.28 + G.rng(), sp = 7 + G.rng() * 4;
            shoot(G, { team: 'p', kind: 'bomblet', x: b.x, y: b.y + 0.5, z: b.z, dx: Math.cos(a) * 0.7, dy: 0.7, dz: Math.sin(a) * 0.7, speed: sp, dmg: 28, splash: 2.4, life: 1.5, r: 0.25, grav: 22, col: 0xffcc66 });
        }
    } else if (!quiet) {
        ev(G, { type: 'impact', x: b.x, y: b.y, z: b.z, what, team: b.team, kind: b.kind, col: b.col });
    }
}

// ------------------------------------------------------------------ marks, waves, fires
function updateMarks(G, dt) {
    let n = 0;
    const list = G.marks;
    for (let i = 0; i < list.length; i++) {
        const m = list[i];
        m.t -= dt;
        if (m.t <= 0) detonateMark(G, m); else list[n++] = m;
    }
    list.length = n;
}
function updateWaves(G, dt) {
    const p = G.player, st = G.st;
    let n = 0;
    for (let i = 0; i < G.waves.length; i++) {
        const wv = G.waves[i];
        wv.r += wv.speed * dt;
        if (!wv.hit && G.phase === 'play') {
            const d = Math.hypot(p.x - wv.x, p.z - wv.z);
            const low = p.y - G.world.h(p.x, p.z) < 0.9;
            if (low && Math.abs(d - wv.r) < wv.w * 0.5 + st.rad * 0.6) {
                wv.hit = true; hurtPlayer(G, wv.dmg, wv.x, wv.z);
                const dd = d || 1; p.vx += (p.x - wv.x) / dd * 5; p.vz += (p.z - wv.z) / dd * 5;
                if (wv.kind === 'fire') G.fires.push({ id: nid(G), x: p.x, z: p.z, r: 2, t: 2.5, dps: 6, lava: false, grow: 0 });
            }
        }
        if (wv.r < wv.max) G.waves[n++] = wv;
    }
    G.waves.length = n;
}
function updateFires(G, dt) {
    const p = G.player;
    let n = 0;
    for (let i = 0; i < G.fires.length; i++) {
        const f = G.fires[i];
        f.t -= dt;
        if (f.grow < 1) f.grow = Math.min(1, f.grow + dt * 2);
        if (G.phase === 'play' && p.y - G.world.h(p.x, p.z) < 0.8 && Math.hypot(p.x - f.x, p.z - f.z) < f.r + G.st.rad * 0.4) {
            f.acc = (f.acc || 0) + f.dps * dt;
            if (f.acc >= 3) { hurtPlayer(G, f.acc, f.x, f.z); f.acc = 0; }
        }
        if (f.t > 0) G.fires[n++] = f;
    }
    G.fires.length = n;
}

// ------------------------------------------------------------------ pickups and pods
function updatePickups(G, dt) {
    const p = G.player, st = G.st, w = G.world;
    let n = 0;
    for (let i = 0; i < G.pickups.length; i++) {
        const k = G.pickups[i];
        k.t += dt;
        // toss, then settle
        k.x += k.vx * dt; k.z += k.vz * dt; k.vx *= 0.96; k.vz *= 0.96;
        const gy = w.h(k.x, k.z) + 0.8;
        k.vy -= 22 * dt; k.y += k.vy * dt;
        if (k.y < gy) { k.y = gy; k.vy = k.vy < -3 ? -k.vy * 0.4 : 0; }
        let take = false;
        if (G.phase === 'play') {
            const d = Math.hypot(p.x - k.x, p.z - k.z);
            if (d < 9 + st.rad * 2 && k.t > 0.4) { const pull = 14 * dt; k.x += (p.x - k.x) / (d || 1) * pull; k.z += (p.z - k.z) / (d || 1) * pull; }
            if (d < 2.4 + st.rad) take = true;
        }
        if (take) {
            if (k.type === 'scrap') { G.scrap += k.val; G.stat.scrapGot += k.val; G.score += k.val; }
            else if (k.type === 'hp') p.hp = Math.min(st.maxHp, p.hp + st.maxHp * 0.3);
            else if (k.type === 'fuel') p.fuel = Math.min(st.fuelMax, p.fuel + st.fuelMax * 0.5);
            else if (k.type === 'ammo') p.missiles = Math.min(st.msl.ammo, p.missiles + Math.max(2, st.msl.ammo * 0.5));
            ev(G, { type: 'pickup', kind: k.type, val: k.val, x: k.x, z: k.z });
        } else if (k.t < 60) G.pickups[n++] = k;
    }
    G.pickups.length = n;
}

// ------------------------------------------------------------------ level flow
function triggers(G, dt) {
    const p = G.player, w = G.world, lv = lvOf(G);
    const prog = -p.z;
    // ambushes: drop pods ahead of the walker
    w.ambushes.forEach((a, i) => {
        if (G.ambushDone[i] || prog < a.t) return;
        G.ambushDone[i] = true;
        ev(G, { type: 'ambush', n: a.units.length });
        a.units.forEach((type, k) => {
            const z = p.z - 28 - G.rng() * 14, x = clamp(w.cx(z) + (G.rng() - 0.5) * w.hw(z) * 1.1, w.cx(z) - w.hw(z) * 0.85, w.cx(z) + w.hw(z) * 0.85);
            G.marks.push({ id: nid(G), kind: 'drop', type, x, z, r: 3, t: 1.8 + k * 0.3, tmax: 1.8 + k * 0.3, dmg: 14 * lv.dmgScale, from: null, owner: 0, col: 0 });
        });
    });
    // radio chatter by progress
    if (!G.flags.mid && prog > w.L * 0.45) { G.flags.mid = 1; ev(G, { type: 'radio', id: `${lv.id}.mid` }); }
    void dt;
}

function checkEnd(G) {
    const p = G.player, w = G.world, lv = lvOf(G);
    if (lv.boss) {
        // the boss's death animation ends with G.bossDone
        if (G.bossDone && G.level === LEVELS.length - 1 && G.phase === 'play') return finish(G, true);
        if (G.bossDone && -p.z >= w.L - 8) return finish(G, false);
    } else if (-p.z >= w.L - 8) return finish(G, false);
}

function finish(G, victory) {
    const lv = lvOf(G);
    const bonus = Math.max(0, Math.round((lv.length / 5 + 90 - G.stat.time)) * 5);
    G.score += bonus + 300 * (G.level + 1);
    G.report = {
        level: G.level, name: lv.name, time: G.stat.time, kills: G.stat.kills, rescued: G.stat.rescued, rescuedTotal: G.rescued, scrapGot: G.stat.scrapGot,
        taken: G.stat.taken, bonus, score: G.score, deaths: G.deaths,
    };
    if (victory) {
        for (const pod of G.pods) if (!pod.freed) freePod(G, pod);
        G.phase = 'victory';
        ev(G, { type: 'victory' });
    } else {
        G.phase = 'complete';
        ev(G, { type: 'levelComplete', level: G.level });
    }
    refit(G);
}

export { bossOf };

// ------------------------------------------------------------------ save and load
export function serialize(G) {
    const out = {};
    for (const k of Object.keys(G)) if (!NOT_SAVED.has(k)) out[k] = G[k];
    return JSON.parse(JSON.stringify({ ...out, rngState: G.rng.state() }));
}

export function deserialize(d) {
    if (!d || d.v !== SAVE_V) throw new Error('unknown save version');
    const { rngState, ...rest } = d;
    const G = { ...JSON.parse(JSON.stringify(rest)), rng: makeRng(0), events: [] };
    G.rng.setState(rngState);
    refreshStats(G);
    G.world = makeWorld(G.level, G.levelSeed);
    return G;
}

void STEP; void ENEMY_WAKE_DIST; void spawnPickup; void BOSSES;

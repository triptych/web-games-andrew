/**
 * bosses.js — the six region bosses (and the Rime Colossus's ice walls).
 *
 * Each boss is a monster with arch 'boss' and a behaviour here. update()
 * receives the world API from world.js (spawnEnemy, damageUnit, …) so this
 * file doesn't import world.js back.
 *
 * Pure: no three.js, no DOM, no Math.random (w.rng only).
 */

import { REGIONS, laneZ, activeLanes, dmgMul, SPAWN_X, WALL_HIT_X, FIELD_END } from '../config.js';

const anyLaneBut = (w, lane) => {
    const l = activeLanes(w.wave).filter((x) => x !== lane);
    return l.length ? w.rng.pick(l) : lane;
};

const randomFieldUnit = (w) => {
    const f = w.units.filter((u) => u.kind === 'field');
    return f.length ? w.rng.pick(f) : null;
};

/** Shared walking: crush blockers, batter the wall, else advance (unless held at stopX). */
function bossWalk(w, e, dt, api, opts = {}) {
    const v = api.effSpeed(w, e) * (e.enraged ? 1.3 : 1);
    if (!e.fly) {
        const b = api.blockerFor(w, e);
        if (b) { api.attackTarget(w, e, b, dt, 2.2); return; }
    }
    if (e.x <= WALL_HIT_X + e.r * 0.5) { api.attackTarget(w, e, 'wall', dt, opts.wallMul ?? 1.5); return; }
    if (opts.stopX !== undefined && e.x <= opts.stopX) { e.state = 'idle'; return; }
    e.state = 'walk';
    e.x -= v * dt;
}

function enrage(w, e, api) {
    if (!e.enraged && e.hp < e.maxHp * 0.5) {
        e.enraged = true;
        api.ev(w, 'bossAct', { id: e.id, boss: e.boss, act: 'enrage' });
        return true;
    }
    return false;
}

const act = (w, e, api, name, extra = {}) => api.ev(w, 'bossAct', { id: e.id, boss: e.boss, act: name, ...extra });

export const BOSSES = {
    warg: {
        hp: 1800, speed: 0.3, size: 2.3, dmg: 30, region: 0,
        init(w, e) { e.tA = 6; e.tB = 5; },
        update(w, e, dt, api) {
            enrage(w, e, api);
            if (e.x < FIELD_END) {
                if ((e.tA -= dt) <= 0) {
                    e.tA = 10;
                    e.atkAnim = 0.8;
                    for (let i = 0; i < 3; i++) api.spawnEnemy(w, 'runner', w.rng.pick(activeLanes(w.wave)), { regionIdx: 0, x: Math.min(SPAWN_X, e.x + 0.8 + i * 0.4) });
                    act(w, e, api, 'howl');
                }
                if ((e.tB -= dt) <= 0) {
                    e.tB = e.enraged ? 5 : 7;
                    e.lane = anyLaneBut(w, e.lane);
                    e.x = Math.max(1.2, e.x - 1.0);
                    act(w, e, api, 'lunge');
                }
            }
            bossWalk(w, e, dt, api);
        },
    },
    toad: {
        hp: 2600, speed: 0.16, size: 2.6, dmg: 34, region: 1,
        init(w, e) { e.tA = 3; e.tB = 13; e.tC = 7; e.sub = 0; },
        update(w, e, dt, api) {
            enrage(w, e, api);
            if (e.sub > 0) {
                e.sub -= dt;
                e.invuln = Math.max(e.invuln, 0.1);
                e.hp = Math.min(e.maxHp, e.hp + e.maxHp * 0.02 * dt);
                if (e.sub <= 0) { e.lane = anyLaneBut(w, e.lane); e.z = laneZ(e.lane); act(w, e, api, 'emerge'); }
                return;
            }
            if (e.x < FIELD_END) {
                if ((e.tA -= dt) <= 0) {
                    e.tA = e.enraged ? 2.2 : 3;
                    e.atkAnim = 0.5;
                    const t = randomFieldUnit(w) ?? 'wall';
                    api.enemyShoot(w, e, 'acid', t, e.dmg * 1.2);
                }
                if ((e.tB -= dt) <= 0) { e.tB = 13; e.sub = 3; act(w, e, api, 'submerge'); }
                if ((e.tC -= dt) <= 0) {
                    e.tC = 9;
                    for (let i = 0; i < 2; i++) api.spawnEnemy(w, 'splitter', w.rng.pick(activeLanes(w.wave)), { regionIdx: 1, x: Math.max(1, e.x - 0.5), child: true, hpMul: 0.35, sizeMul: 0.55 });
                    act(w, e, api, 'spawn');
                }
            }
            bossWalk(w, e, dt, api, { stopX: e.enraged ? undefined : 6.5 });
        },
    },
    warlord: {
        hp: 2500, speed: 0.2, size: 2.5, dmg: 40, region: 2,
        init(w, e) { e.tA = 4; e.tB = 9; e.tC = 8; },
        update(w, e, dt, api) {
            enrage(w, e, api);
            if (e.x < FIELD_END) {
                if ((e.tA -= dt) <= 0) {
                    e.tA = e.enraged ? 3 : 4.5;
                    e.atkAnim = 0.5;
                    api.enemyShoot(w, e, 'axe', randomFieldUnit(w) ?? 'wall', e.dmg * 1.4);
                }
                if ((e.tB -= dt) <= 0) { e.tB = 14; w.buffs.warcry = 5; act(w, e, api, 'warcry'); }
                if ((e.tC -= dt) <= 0) {
                    e.tC = 10;
                    e.atkAnim = 0.8;
                    for (const u of w.units.slice()) {
                        if (u.kind !== 'field' || Math.hypot(u.x - e.x, u.z - e.z) > 2.6) continue;
                        u.stunT = Math.max(u.stunT, 2);
                        api.damageUnit(w, u, e.dmg * 0.8, e);
                    }
                    act(w, e, api, 'stomp', { x: e.x, z: e.z });
                }
            }
            bossWalk(w, e, dt, api, { wallMul: 2.5 });
        },
    },
    colossus: {
        hp: 3600, speed: 0.15, size: 2.8, dmg: 52, region: 3,
        init(w, e) { e.tA = 6; e.tB = 9; e.tC = 5; },
        update(w, e, dt, api) {
            enrage(w, e, api);
            if (e.x < FIELD_END) {
                if ((e.tA -= dt) <= 0) {
                    e.tA = e.enraged ? 6 : 8;
                    const pool = w.rng.shuffle(w.units.slice()).slice(0, 3);
                    for (const u of pool) u.stunT = Math.max(u.stunT, 3);
                    act(w, e, api, 'freeze', { ids: pool.map((u) => u.id) });
                }
                if ((e.tB -= dt) <= 0) {
                    e.tB = 12;
                    const lanes = w.rng.shuffle(activeLanes(w.wave).slice()).slice(0, 2);
                    for (const l of lanes) api.spawnEnemy(w, 'icewall', l, { x: Math.max(1.5, e.x - 1.6) });
                    act(w, e, api, 'icewall');
                }
                if ((e.tC -= dt) <= 0) {
                    e.tC = 6;
                    e.atkAnim = 0.7;
                    api.enemyShoot(w, e, 'boulder', randomFieldUnit(w) ?? 'wall', e.dmg * 1.2);
                }
            }
            bossWalk(w, e, dt, api, { wallMul: 2 });
        },
    },
    lich: {
        hp: 3600, speed: 0.18, size: 2.2, dmg: 40, region: 4,
        init(w, e) { e.tA = 7; e.tB = 6; e.tC = 4; e.tD = 10; e.drain = null; },
        update(w, e, dt, api) {
            enrage(w, e, api);
            if (e.drain) {
                const u = w.units.find((v) => v.id === e.drain.uid);
                e.drain.t -= dt;
                if (!u || e.drain.t <= 0) e.drain = null;
                else {
                    const d = 22 * dmgMul(w.wave) * dt;
                    api.damageUnit(w, u, d, null);
                    e.hp = Math.min(e.maxHp, e.hp + d * 2);
                }
            }
            if (e.x < FIELD_END) {
                if ((e.tA -= dt) <= 0) {
                    e.tA = e.enraged ? 5 : 7;
                    e.lane = anyLaneBut(w, e.lane);
                    e.z = laneZ(e.lane);
                    e.x = Math.min(9, Math.max(2, e.x + w.rng.range(-0.8, 0.8)));
                    act(w, e, api, 'teleport');
                }
                if ((e.tB -= dt) <= 0) {
                    e.tB = 9;
                    e.atkAnim = 0.8;
                    for (let i = 0; i < 3; i++) {
                        const g = w.graves[w.graves.length - 1 - i];
                        const lane = g ? g.lane : w.rng.pick(activeLanes(w.wave));
                        const x = g ? Math.max(1.2, g.x) : Math.max(1.5, e.x - 1);
                        api.spawnEnemy(w, 'grunt', lane, { regionIdx: 4, x });
                    }
                    act(w, e, api, 'raise');
                }
                if ((e.tC -= dt) <= 0) { e.tC = 15; e.ward = e.maxHp * 0.15; act(w, e, api, 'ward'); }
                if ((e.tD -= dt) <= 0 && !e.drain) {
                    e.tD = 11;
                    const pool = w.units;
                    if (pool.length) { const u = w.rng.pick(pool); e.drain = { uid: u.id, t: 3 }; act(w, e, api, 'drain', { uid: u.id }); }
                }
            }
            bossWalk(w, e, dt, api, { stopX: e.enraged ? undefined : 6.8 });
        },
    },
    dragon: {
        hp: 4800, speed: 0.17, size: 3.0, dmg: 64, region: 5,
        init(w, e) { e.fly = true; e.y = 2.2; e.tA = 5; e.tB = 10; e.tC = 6; e.breath = null; },
        update(w, e, dt, api) {
            if (enrage(w, e, api)) { e.fly = false; act(w, e, api, 'land'); }
            if (!e.fly) e.y = Math.max(0, e.y - dt * 2);
            if (e.breath) {
                e.breath.t -= dt;
                if (e.breath.t <= 0 && !e.breath.done) {
                    e.breath.done = true;
                    const lane = e.breath.lane;
                    for (const u of w.units.slice()) {
                        if (u.lane !== lane) continue;
                        if (u.kind === 'field') api.damageUnit(w, u, e.dmg * 2.2, null);
                        else u.stunT = Math.max(u.stunT, 2.5);
                    }
                    api.damageWall(w, e.dmg * 0.6, null);
                    act(w, e, api, 'breath', { lane });
                }
                if (e.breath.t <= -0.8) e.breath = null;
            }
            if (e.x < FIELD_END) {
                if ((e.tA -= dt) <= 0 && !e.breath) {
                    e.tA = e.enraged ? 5 : 7;
                    e.atkAnim = 1.6;
                    e.breath = { lane: e.lane, t: 1.0 };
                    act(w, e, api, 'telegraph', { lane: e.lane });
                }
                if (e.fly && (e.tC -= dt) <= 0) { e.tC = 6; e.lane = anyLaneBut(w, e.lane); }
                if ((e.tB -= dt) <= 0) {
                    e.tB = 12;
                    for (let i = 0; i < 2; i++) api.spawnEnemy(w, 'flyer', w.rng.pick(activeLanes(w.wave)), { regionIdx: 5, x: Math.min(SPAWN_X, e.x + 0.5) });
                    act(w, e, api, 'summon');
                }
            }
            bossWalk(w, e, dt, api, { stopX: e.fly ? 7.2 : undefined, wallMul: 2 });
        },
    },
};

const NAMES = Object.fromEntries(REGIONS.map((r) => [r.boss.kind, r.boss]));

export function bossSpecies(kind) {
    const B = BOSSES[kind];
    const r = REGIONS[B.region];
    const meta = NAMES[kind];
    return {
        id: `boss:${kind}`, name: meta.name, title: meta.title, plan: 'boss', bossKind: kind, arch: 'boss',
        region: r.id, regionIdx: B.region, size: B.size, params: {}, resist: { ...r.resist }, undead: !!r.undead,
        voice: { kind: 'roar', pitch: 0.55 }, fly: kind === 'dragon',
    };
}

/** The Colossus's ice walls are monsters too, so projectiles stop on them. */
export const ICEWALL_SPECIES = {
    id: 'boss:icewall', name: 'Ice Wall', plan: 'icewall', arch: 'icewall', region: 'frostfell', regionIdx: 3,
    size: 1.2, params: {}, resist: { fire: 1.5, frost: 0.2 }, undead: false, voice: { kind: 'chime', pitch: 1 }, fly: false,
};

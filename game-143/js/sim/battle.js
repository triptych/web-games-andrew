// The castle-defence half: the wall on the left, the Crumb Horde from the right. Pure.
// Field x runs from 0 (the wall's face) to FIELD.w (the right edge); y in [0, 1] is depth (0 far, 1 near).

import { FIELD, DOILY, TOWER, KNIGHT, KING, QUEEN, BRACE, NAP_T, READY_BONUS, AIM_SPEED } from '../config.js';
import { ENEMIES, WAVES, EPI_POOL, ADVENTURERS, ABILITIES, ABILITY_ORDER, READY, BUILDINGS } from './data.js';
import { finished, levelsOf, countOf, wallArmor, advsHired, wallMax } from './town.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const advMult = (lvl) => 1 + 0.4 * (lvl - 1);

/** What the town has against what this invasion asks for. */
export function readiness(G, wave = G.phase) {
    const list = READY[Math.min(wave, READY.length - 1)] || [];
    return list.map(([k, v]) => {
        let have;
        if (k === 'wall') have = G.wall.lvl;
        else if (k === 'towers') have = countOf(G, 'tower');
        else if (k === 'advs') have = advsHired(G);
        else if (k === 'bake') have = Math.floor(G.bake.pct);
        else if (k === 'build') have = countOf(G, v) ? v : null;
        return { k, v, have, ok: k === 'build' ? have === v : have >= v };
    });
}

export function newBattle(G) {
    const epi = G.phase >= 4;
    const wi = epi ? null : G.phase;
    const n = epi ? G.epi.waves : 0;
    const sched = [];
    let hpMult = 1, king = null, name;
    if (!epi) {
        const W = WAVES[wi];
        name = W.name;
        // each group arrives in packs of 3 to 5, the packs spread evenly between t0 and t1
        for (const [kind, cnt, t0, t1] of W.groups) {
            const packs = Math.max(1, Math.round(cnt / 4));
            for (let i = 0; i < cnt; i++) {
                const p = i % packs, k = Math.floor(i / packs);
                const t = t0 + (t1 - t0) * (packs > 1 ? p / (packs - 1) : 0.5) + k * 0.5 + G.rng.range(-0.8, 0.8);
                sched.push({ t: Math.max(0, t), kind });
            }
        }
        if (W.king != null) king = W.king;
        // a lost wave comes back a little smaller, so a struggling town can climb out
        hpMult = (W.hp || 1) * (1 - Math.min(0.45, 0.15 * (G.retries || 0)));
    } else {
        name = `Leftovers #${n + 1}`;
        const total = Math.round(28 * (1 + 0.22 * n));
        const dur = 60 + 4 * Math.min(n, 10);
        for (let i = 0; i < total; i += 4) {
            const t = G.rng.range(0, dur), kind = G.rng.pick(EPI_POOL);
            for (let k = 0; k < 4 && i + k < total; k++) sched.push({ t: t + k * 0.5, kind });
        }
        if (n >= 2) for (let i = 0; i < Math.floor(n / 2); i++) sched.push({ t: G.rng.range(dur * 0.4, dur), kind: 'golem' });
        hpMult = 1 + 0.15 * n;
    }
    sched.sort((a, b) => a.t - b.t);

    const ready = epi ? [] : readiness(G, wi);
    const readyAll = ready.length > 0 && ready.every((r) => r.ok);
    const max = Math.round(wallMax(G) * (readyAll ? 1 + READY_BONUS : 1));
    const towers = finished(G).filter((b) => b.kind === 'tower').map((b) => ({ lvl: b.lvl, cd: G.rng.range(0, 1) }));
    const advs = {};
    for (const id in G.advs) if (G.advs[id].hired) advs[id] = { lvl: G.advs[id].lvl, cd: G.rng.range(0, 0.6) };
    const abil = {};
    for (const id of ABILITY_ORDER) if (G.staff[ABILITIES[id].staff]?.joined) abil[id] = { cd: 0 };
    const morale = 1 + levelsOf(G, 'bell') * BUILDINGS.bell.morale + (G.hope >= 70 ? 0.1 : 0)
        + (advs.lark ? ADVENTURERS.lark.buff * advMult(advs.lark.lvl) : 0);

    return {
        wave: wi, epi, n, name, t: -BRACE, sched, si: 0, hpMult,
        enemies: [], nextId: 1, shots: [],
        aim: 40, cd: 0,
        wall: { hp: max, max }, armor: wallArmor(G),
        doilyDmg: DOILY.dmg * (1 + DOILY.witchBonus * levelsOf(G, 'witch')),
        towers, towerMult: 1 + (G.staff.grizelda?.joined ? TOWER.grizelda : 0),
        advs, abil, webT: 0, morale,
        knight: advs.tobias ? { hp: KNIGHT.hp * advMult(advs.tobias.lvl), max: KNIGHT.hp * advMult(advs.tobias.lvl), down: 0, cd: 0 } : null,
        kingAt: king, king: null, kingStopT: null, queen: null, canQueen: false,
        result: null, resultT: 0, calmed: 0, loot: { gold: 0, sugar: 0 }, wallHits: 0,
        ready, readyAll,
    };
}

function spawn(G, B, kind, x = FIELD.spawn + G.rng.range(0, 4), y = G.rng.range(0.05, 0.95)) {
    const def = ENEMIES[kind];
    const hp = def.boss ? def.hp : Math.round(def.hp * B.hpMult);
    const e = { id: B.nextId++, kind, x, y, hp, max: hp, atk: G.rng.range(0, 1 / (def.rate || 1)), nap: 0, sit: false, block: false, push: 0 };
    B.enemies.push(e);
    if (def.boss) { B.king = e.id; G.events.push({ type: 'kingArrives' }); }
    return e;
}

const alive = (e) => e.nap <= 0 && !e.sit && e.hp > 0;

function hurt(G, B, e, dmg, by) {
    if (!alive(e)) return;
    const def = ENEMIES[e.kind];
    e.hp -= dmg;
    G.events.push({ type: 'hit', x: e.x, y: e.y, dmg: Math.round(dmg), by, fly: !!def.fly });
    if (def.boss) {
        const floor = e.max * KING.floor;
        if (e.hp < floor) e.hp = floor;    // the King can't be beaten; only something sweeter can stop him
        return;
    }
    if (e.hp <= 0) {
        e.hp = 0; e.nap = NAP_T;
        B.calmed++; G.stats.calmed++;
        B.loot.gold += def.gold; B.loot.sugar += 1;
        G.events.push({ type: 'calm', x: e.x, y: e.y, kind: e.kind });
        if (def.split) for (let i = 0; i < def.split; i++) spawn(G, B, 'slimelet', e.x + 1 + i * 1.5, clamp(e.y + (i ? 0.15 : -0.15), 0, 1));
    }
}

function nearest(B, range, groundOnly = false) {
    let best = null;
    for (const e of B.enemies) {
        if (!alive(e) || e.x > range) continue;
        if (groundOnly && ENEMIES[e.kind].fly) continue;
        if (!best || e.x < best.x) best = e;
    }
    return best;
}

function shoot(B, kind, target, dmg, dur, r = 0, tx = null) {
    B.shots.push({ kind, target: target ? target.id : null, tx: tx ?? target.x, ty: target ? target.y : 0.5, dmg, t: 0, dur, r });
}

/** Battle commands: abilities and the Queen. */
export function battleAct(G, c) {
    const B = G.battle;
    if (!B || B.result) return false;
    if (c.t === 'ability') {
        const a = B.abil[c.id], def = ABILITIES[c.id];
        if (!a || a.cd > 0 || B.t < 0 || B.queen) return false;
        a.cd = def.cd;
        if (c.id === 'web') B.webT = def.dur;
        else if (c.id === 'flare') for (const e of B.enemies) { if (Math.abs(e.x - B.aim) <= def.radius) hurt(G, B, e, def.dmg, 'flare'); }
        else if (c.id === 'stomp') for (const e of B.enemies) {
            if (alive(e) && !ENEMIES[e.kind].fly && !ENEMIES[e.kind].boss && e.x <= def.reach) { e.push = def.push; hurt(G, B, e, def.dmg, 'stomp'); }
        }
        else if (c.id === 'buns') {
            const live = B.enemies.filter(alive).sort((p, q) => p.x - q.x).slice(0, def.n);
            for (const e of live) shoot(B, 'bun', e, def.dmg, 0.5);
        }
        G.events.push({ type: 'ability', id: c.id, x: B.aim });
        return true;
    }
    if (c.t === 'queen') {
        if (!B.canQueen || B.queen) return false;
        B.queen = { x: 0, state: 'walk', t: 0 };
        for (const e of B.enemies) if (alive(e)) e.sit = true;
        B.si = B.sched.length;
        G.events.push({ type: 'queen' });
        return true;
    }
    return false;
}

/** One step. inp = { ax: -1..1 aim drift, aim: absolute x or null, fire: held }. */
export function stepBattle(G, inp, dt) {
    const B = G.battle;
    if (B.result) { B.resultT += dt; return; }
    B.t += dt;

    // aim and the Mayor's doilies
    if (inp.aim != null) B.aim = clamp(inp.aim, 4, DOILY.range);
    else if (inp.ax) B.aim = clamp(B.aim + inp.ax * AIM_SPEED * dt, 4, DOILY.range);
    B.cd -= dt * B.morale;
    if (inp.fire && B.cd <= 0 && B.t >= 0 && !B.queen) {
        B.cd = DOILY.cd;
        shoot(B, 'doily', null, B.doilyDmg, DOILY.flight, DOILY.radius, B.aim);
        G.events.push({ type: 'throw', x: B.aim });
    }
    if (B.t < 0) return;

    // spawns
    while (B.si < B.sched.length && B.sched[B.si].t <= B.t) { spawn(G, B, B.sched[B.si].kind); B.si++; }
    if (B.kingAt != null && B.king == null && B.t >= B.kingAt && !B.queen) spawn(G, B, 'king', FIELD.spawn, 0.55);

    // abilities cool down; the web wears off
    for (const id in B.abil) B.abil[id].cd = Math.max(0, B.abil[id].cd - dt);
    B.webT = Math.max(0, B.webT - dt);

    // the knight holds the line in front of the wall
    const K = B.knight;
    if (K) {
        if (K.down > 0) { K.down -= dt; if (K.down <= 0) { K.hp = K.max; G.events.push({ type: 'knightUp' }); } }
    }
    const knightUp = K && K.down <= 0;

    // enemies
    const slow = B.webT > 0 ? ABILITIES.web.slow : 1;
    for (const e of B.enemies) {
        const def = ENEMIES[e.kind];
        if (e.nap > 0) { e.nap -= dt; continue; }
        if (e.sit) continue;
        if (e.push > 0) { const p = Math.min(e.push, 40 * dt); e.x += p; e.push -= p; continue; }
        if (def.boss) {
            if (e.x > KING.stopX) e.x -= def.spd * slow * dt;
            else if (B.kingStopT == null) { B.kingStopT = B.t; G.events.push({ type: 'kingLooms' }); }
            e.hp = Math.max(e.max * KING.floor, Math.min(e.max, e.hp + KING.regen * dt));
            continue;
        }
        const blocked = knightUp && !def.fly && e.x <= KNIGHT.x + 1.6 && e.x >= KNIGHT.x - 1;
        e.block = blocked;
        const atWall = e.x <= FIELD.reach;
        if (blocked || atWall) {
            e.atk -= dt;
            if (e.atk <= 0) {
                e.atk = 1 / def.rate;
                if (blocked) {
                    K.hp -= def.dmg;
                    if (K.hp <= 0) { K.hp = 0; K.down = KNIGHT.respawn * (B.advs.fennel ? 0.5 : 1); G.events.push({ type: 'knightDown' }); }
                } else {
                    B.wall.hp -= def.dmg * (1 - B.armor);
                    B.wallHits++;
                    G.events.push({ type: 'wallHit', x: e.x, y: e.y });
                }
            }
        } else e.x -= def.spd * slow * dt;
    }
    // sleepy ones wander off
    if (B.enemies.length > 60 || B.enemies.some((e) => e.nap < 0)) B.enemies = B.enemies.filter((e) => !(e.hp <= 0 && e.nap <= 0));

    // the knight strikes the foremost enemy he is holding
    if (knightUp) {
        K.cd -= dt * B.morale;
        if (K.cd <= 0) {
            K.cd = 0.5;
            const t = B.enemies.find((e) => alive(e) && e.block);
            if (t) hurt(G, B, t, KNIGHT.dps * 0.5 * advMult(B.advs.tobias.lvl), 'knight');
        }
    }

    // towers and adventurers
    for (const tw of B.towers) {
        tw.cd -= dt * B.morale;
        if (tw.cd > 0) continue;
        const t = nearest(B, TOWER.range);
        if (!t) continue;
        tw.cd = 1;
        shoot(B, 'bolt', t, TOWER.dps * [1, 1.8, 2.8][tw.lvl - 1] * B.towerMult, TOWER.flight);
    }
    for (const id in B.advs) {
        const a = B.advs[id], def = ADVENTURERS[id];
        if (def.kind === 'archer' || def.kind === 'witch') {
            a.cd -= dt * B.morale;
            if (a.cd > 0) continue;
            const t = nearest(B, def.range);
            if (!t) continue;
            a.cd = 1 / def.rate;
            if (def.kind === 'archer') { shoot(B, 'arrow', t, def.dmg * advMult(a.lvl), 0.4); G.events.push({ type: 'arrow' }); }
            else { shoot(B, 'potion', t, def.dmg * advMult(a.lvl), 0.6, def.radius); }
        } else if (def.kind === 'healer') {
            B.wall.hp = Math.min(B.wall.max, B.wall.hp + def.heal * advMult(a.lvl) * dt);
        }
    }

    // shots land
    for (let i = B.shots.length - 1; i >= 0; i--) {
        const s = B.shots[i];
        s.t += dt;
        if (s.t < s.dur) continue;
        B.shots.splice(i, 1);
        if (s.r > 0) {
            for (const e of B.enemies) if (Math.abs(e.x - s.tx) <= s.r && Math.abs(e.y - s.ty) <= 0.7) hurt(G, B, e, s.dmg, s.kind);
            G.events.push({ type: 'splash', kind: s.kind, x: s.tx, y: s.ty });
        } else {
            const e = B.enemies.find((q) => q.id === s.target);
            if (e) hurt(G, B, e, s.dmg, s.kind);
        }
    }

    // the King and the Queen
    const king = B.king != null ? B.enemies.find((e) => e.id === B.king) : null;
    B.canQueen = !!king && B.kingStopT != null && G.bake.pct >= 100 && !B.queen;   // once he stands looming mid-field
    if (B.queen) {
        const Q = B.queen;
        Q.t += dt;
        if (Q.state === 'walk') {
            Q.x += QUEEN.speed * dt;
            if (king && Q.x >= king.x - 6.5) { Q.state = 'kiss'; Q.t = 0; G.events.push({ type: 'kiss', x: Q.x }); }
        } else if (Q.state === 'kiss' && Q.t >= QUEEN.kissT) {
            B.result = 'love';
            G.events.push({ type: 'battleOver', result: 'love' });
        }
        return;
    }
    if (king && B.kingStopT != null && B.t - B.kingStopT >= KING.patience) {
        B.result = 'retreat';
        G.events.push({ type: 'battleOver', result: 'retreat' });
        return;
    }

    // ends
    if (B.wall.hp <= 0) {
        B.wall.hp = 0;
        B.result = 'lose';
        G.events.push({ type: 'battleOver', result: 'lose' });
        return;
    }
    if (B.si >= B.sched.length && B.kingAt == null && !B.enemies.some(alive)) {
        B.result = 'win';
        G.events.push({ type: 'battleOver', result: 'win' });
    }
}

export const liveEnemies = (B) => B.enemies.filter(alive);
export const waveProgress = (B) => (B.sched.length ? B.si / B.sched.length : 1);

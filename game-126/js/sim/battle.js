// EMBERSPIRE — turn-based battles. Pure.
//
// Turn order is charge time: every unit fills a gauge by its speed and acts when it reaches CT_FULL, so a fast
// rogue can act twice before a slow golem acts once. The player chooses for a hero when it's that hero's turn
// (phase 'input'); enemies, and heroes while auto battle is on, act after a short delay (phase 'ai') that step()
// counts down, so the view can play each action before the next one happens.
//
// Every action is resolved whole in doAction() and leaves events in G.events:
//   { type: 'turn', uid } { type: 'act', uid, name, kind, tgts } { type: 'hit', uid, src, dmg, crit, weak, resist, el, hp }
//   { type: 'heal', uid, amt, hp } { type: 'miss', uid } { type: 'status', uid, id, on } { type: 'dot', uid, dmg, id, hp }
//   { type: 'down', uid } { type: 'revive', uid, hp } { type: 'stunned', uid } { type: 'mp', uid, mp } { type: 'enrage', uid }
//   { type: 'won', ... } { type: 'lost' } { type: 'fled' } { type: 'flee-fail' }

import { CT_FULL, CRIT_BASE, CRIT_MUL, WEAK_MUL, RESIST_MUL, BUFF_MUL, DEBUFF_MUL, AI_DELAY, FLEE_CHANCE, MAX_ROUNDS, DIFFICULTY } from '../config.js';
import { MONSTERS, biomeOf } from './data/biomes.js';
import { HERO, SKILLS, STATUS } from './data/heroes.js';
import { MONSTER_ACTS } from './data/acts.js';
import { GOODS } from './data/items.js';
import { heroStats, enemyStats, uniqueFx, enemyMult, rankOfFloor } from './stats.js';
import { battleRewards } from './loot.js';

const ATTACK = { id: 'attack', name: 'Attack', mp: 0, tgt: 'enemy', kind: 'phys', pow: 1.0, el: 'weapon', hits: 1 };

// ---------------------------------------------------------------- setup
export function makeEnemies(G, floor) {
    const rng = G.rng;
    const { biome, cycle } = biomeOf(floor);
    const rank = rankOfFloor(floor);
    const list = [];
    const eliteCh = floor < 4 ? 0 : Math.min(0.25, 0.03 + floor * 0.003);
    const pool = biome.monsters.map((m) => m.id);
    const wanderPool = floor > 10 ? MONSTER_WANDER(floor) : [];
    const normal = () => (wanderPool.length && rng.chance(0.12) ? rng.pick(wanderPool) : rng.pick(pool));
    if (rank === 'boss') {
        list.push({ id: biome.boss.id, elite: false });
        if (cycle > 0 || floor >= 60) { list.push({ id: normal(), elite: false }); }
    } else if (rank === 'mini') {
        list.push({ id: biome.mini.id, elite: false });
        const adds = floor < 15 ? 1 : 2;
        for (let i = 0; i < adds; i++) list.push({ id: normal(), elite: false });
    } else {
        const maxN = Math.min(4, 1 + Math.floor((floor + 4) / 8));
        const n = 1 + Math.floor(rng() * maxN);
        for (let i = 0; i < Math.max(1, n); i++) list.push({ id: normal(), elite: rng.chance(eliteCh) });
    }
    return list;
}

function MONSTER_WANDER(floor) {
    const out = [];
    const { idx } = biomeOf(floor);
    for (const m of Object.values(MONSTERS)) {
        if (m.rank !== 'normal') continue;
        const bi = ['undercroft', 'grotto', 'library', 'forge', 'frost', 'clockwork', 'garden', 'astral', 'abyss', 'summit'].indexOf(m.biome);
        if (bi >= 0 && bi < idx) out.push(m.id);
    }
    return out;
}

function heroUnit(G, id, slot) {
    const h = G.heroes[id];
    const s = heroStats(G, id);
    const fx = uniqueFx(G, h);
    return {
        uid: 'p' + slot, side: 'p', ref: id, name: HERO[id].name, lv: h.lv, slot,
        hp: Math.max(0, Math.min(h.hp ?? s.hp, s.hp)), mhp: s.hp, mp: Math.min(h.mp ?? s.mp, s.mp), mmp: s.mp,
        atk: s.atk, mag: s.mag, def: s.def, res: s.res, spd: s.spd, crit: s.crit,
        el: fx.attackEl || 'phys', weak: [], resist: fx.resist.slice(), st: {}, ct: 0, guard: false,
        alive: (h.hp ?? s.hp) > 0, fx, revived: false,
    };
}

function enemyUnit(G, e, floor, slot) {
    const m = MONSTERS[e.id];
    const s = enemyStats(e.id, floor, e.elite);
    const d = DIFFICULTY[G.difficulty] || DIFFICULTY.standard;
    s.hp = Math.max(1, Math.round(s.hp * d.hp));
    s.atk = Math.max(1, Math.round(s.atk * d.hit));
    s.mag = Math.max(1, Math.round(s.mag * d.hit));
    return {
        uid: 'e' + slot, side: 'e', ref: e.id, name: (e.elite ? 'Elite ' : '') + m.name, lv: floor, slot, rank: m.rank, elite: e.elite,
        hp: s.hp, mhp: s.hp, mp: 0, mmp: 0, atk: s.atk, mag: s.mag, def: s.def, res: s.res, spd: s.spd, crit: s.crit,
        el: m.el, weak: m.weak.slice(), resist: m.resist.slice(), acts: m.acts.slice(), st: {}, ct: 0, guard: false, alive: true,
        enraged: false,
    };
}

export function startBattle(G, floor) {
    const party = G.party.filter((id) => G.heroes[id]?.joined);
    const enemies = makeEnemies(G, floor);
    const units = [];
    party.forEach((id, i) => units.push(heroUnit(G, id, i)));
    enemies.forEach((e, i) => units.push(enemyUnit(G, e, floor, i)));
    // a ragged start: nobody acts in lock-step
    for (const u of units) u.ct = Math.floor(G.rng() * 300) + (u.side === 'p' ? 100 : 0);
    const B = {
        floor, rank: rankOfFloor(floor), units, turn: null, phase: 'ai', round: 0, actions: 0, wait: 0,
        used: {}, gold: 0, log: [],
    };
    G.battle = B;
    for (const id of enemies.map((e) => e.id)) G.seen[id] = true;
    // unique gear that starts a battle with a status
    for (const u of units) if (u.side === 'p' && u.alive) for (const st of u.fx.startSt) addStatus(G, u, st, 3);
    G.events.push({ type: 'battle', floor, rank: B.rank });
    advance(G);
    return B;
}

// ---------------------------------------------------------------- helpers
export const unit = (B, uid) => B.units.find((u) => u.uid === uid);
export const side = (B, s) => B.units.filter((u) => u.side === s);
export const alive = (B, s) => B.units.filter((u) => u.side === s && u.alive);
const foesOf = (B, u) => alive(B, u.side === 'p' ? 'e' : 'p');
const friendsOf = (B, u) => alive(B, u.side);
const fallenOf = (B, u) => side(B, u.side).filter((x) => !x.alive);

function effSpd(u) {
    let s = u.spd;
    if (u.st.haste) s *= 1.5;
    if (u.st.slow) s *= 0.6;
    if (u.enraged) s *= 1.35;
    return Math.max(1, s);
}

function addStatus(G, u, id, n) {
    if (!u.alive) return;
    // opposite statuses cancel instead of stacking
    const opp = { atkup: 'atkdown', atkdown: 'atkup', defup: 'defdown', defdown: 'defup', haste: 'slow', slow: 'haste' }[id];
    if (opp && u.st[opp]) { delete u.st[opp]; G.events.push({ type: 'status', uid: u.uid, id: opp, on: false }); return; }
    const had = !!u.st[id];
    u.st[id] = Math.max(u.st[id] || 0, n);
    if (!had) G.events.push({ type: 'status', uid: u.uid, id, on: true });
}

function statusChance(u, st) {
    // bosses shrug off most control
    let ch = st.ch;
    if (u.side === 'e' && u.rank === 'boss' && STATUS[st.id].bad) ch *= st.id === 'stun' ? 0.15 : 0.5;
    else if (u.side === 'e' && u.rank === 'mini' && STATUS[st.id].bad) ch *= st.id === 'stun' ? 0.4 : 0.75;
    return ch;
}

// ---------------------------------------------------------------- turn order
export function advance(G) {
    const B = G.battle;
    if (!B || B.phase === 'won' || B.phase === 'lost' || B.phase === 'fled') return;
    for (let guard = 0; guard < 50; guard++) {
        const live = B.units.filter((u) => u.alive);
        let best = null, bt = Infinity;
        for (const u of live) {
            const t = (CT_FULL - u.ct) / effSpd(u);
            if (t < bt) { bt = t; best = u; }
        }
        if (!best) return;
        for (const u of live) u.ct += effSpd(u) * Math.max(0, bt);
        best.ct = CT_FULL;
        B.turn = best.uid;
        B.actions++;
        if (B.actions % Math.max(1, live.length) === 0) B.round++;
        if (B.round > MAX_ROUNDS) { endBattle(G, 'lost'); return; }
        best.guard = false;
        G.events.push({ type: 'turn', uid: best.uid });
        // start of turn: damage over time and regeneration
        startOfTurn(G, best);
        if (checkEnd(G)) return;
        if (!best.alive) { best.ct = 0; continue; }
        if (best.st.stun) {
            G.events.push({ type: 'stunned', uid: best.uid });
            endTurn(G, best);
            if (checkEnd(G)) return;
            continue;
        }
        B.phase = best.side === 'e' || G.auto ? 'ai' : 'input';
        B.wait = 0;
        return;
    }
}

function startOfTurn(G, u) {
    const boss = u.side === 'e' && (u.rank === 'boss' || u.rank === 'mini');
    for (const id of ['poison', 'burn']) {
        if (!u.st[id]) continue;
        const pct = (id === 'poison' ? 0.06 : 0.05) * (boss ? 0.4 : 1);
        const dmg = Math.max(1, Math.round(u.mhp * pct));
        u.hp = Math.max(0, u.hp - dmg);
        G.events.push({ type: 'dot', uid: u.uid, id, dmg, hp: u.hp });
        if (u.hp <= 0) { down(G, u); return; }
    }
    let regen = 0;
    if (u.st.regen && !u.st.burn) regen += 0.08;
    if (u.side === 'p' && u.fx.regen) regen += u.fx.regen;
    if (regen > 0 && u.hp < u.mhp) {
        const amt = Math.max(1, Math.round(u.mhp * regen));
        u.hp = Math.min(u.mhp, u.hp + amt);
        G.events.push({ type: 'heal', uid: u.uid, amt, hp: u.hp, regen: true });
    }
    if (u.side === 'p' && u.fx.mpRegen && u.mp < u.mmp) {
        u.mp = Math.min(u.mmp, u.mp + Math.max(1, Math.round(u.mmp * u.fx.mpRegen)));
        G.events.push({ type: 'mp', uid: u.uid, mp: u.mp });
    }
}

function endTurn(G, u) {
    for (const id of Object.keys(u.st)) {
        u.st[id]--;
        if (u.st[id] <= 0) { delete u.st[id]; G.events.push({ type: 'status', uid: u.uid, id, on: false }); }
    }
    u.ct = 0;
}

function down(G, u) {
    if (!u.alive) return;
    if (u.side === 'p' && u.fx.autoRevive && !u.revived) {
        u.revived = true;
        u.hp = Math.round(u.mhp * u.fx.autoRevive);
        G.events.push({ type: 'revive', uid: u.uid, hp: u.hp, auto: true });
        return;
    }
    u.alive = false;
    u.hp = 0;
    u.st = {};
    u.ct = 0;
    G.events.push({ type: 'down', uid: u.uid });
    if (u.side === 'e') {
        G.stats.kills++;
        G.stats.killsBy[u.ref] = (G.stats.killsBy[u.ref] || 0) + 1;
        if (u.elite) G.stats.elites++;
        G.counters.kills++;
        if (u.elite) G.counters.elites++;
    }
}

function checkEnd(G) {
    const B = G.battle;
    if (!alive(B, 'e').length) { endBattle(G, 'won'); return true; }
    if (!alive(B, 'p').length) { endBattle(G, 'lost'); return true; }
    return false;
}

function endBattle(G, how) {
    const B = G.battle;
    B.phase = how;
    B.turn = null;
    // write hp and mp back to the heroes, and clear auto-revive flags
    for (const u of side(B, 'p')) {
        const h = G.heroes[u.ref];
        h.hp = u.alive ? u.hp : 0;
        h.mp = u.mp;
    }
    if (how === 'won') {
        const rw = battleRewards(G, B);
        B.rewards = rw;
        G.events.push({ type: 'won', floor: B.floor, rank: B.rank, ...rw });
    } else if (how === 'lost') {
        G.events.push({ type: 'lost', floor: B.floor });
    } else G.events.push({ type: 'fled' });
}

// ---------------------------------------------------------------- choosing
/** What a unit could do now: [{ act, label }] with mp and targets checked. */
export function options(G, u) {
    const B = G.battle;
    const out = [];
    if (u.side === 'p') {
        const h = G.heroes[u.ref];
        for (const sid of Object.keys(h.skills)) {
            const sk = skillFor(G, u, sid);
            if (sk && u.mp >= sk.mp && targetsFor(B, u, sk).length) out.push(sk);
        }
    }
    return out;
}

/** A hero's skill with rank bonuses applied. */
export function skillFor(G, u, sid) {
    const base = SKILLS[sid];
    if (!base) return null;
    const rank = G.heroes[u.ref].skills[sid] || 1;
    return { ...base, pow: base.pow * (1 + 0.15 * (rank - 1)), rank };
}

export function targetsFor(B, u, sk) {
    switch (sk.tgt) {
        case 'enemy': case 'enemies': return foesOf(B, u);
        case 'ally': case 'allies': return friendsOf(B, u);
        case 'self': return [u];
        case 'fallen': return fallenOf(B, u);
        default: return [];
    }
}

// ---------------------------------------------------------------- resolving
/**
 * The player's command for the hero whose turn it is.
 * cmd: { kind: 'attack' | 'skill' | 'item' | 'defend' | 'flee', id, target }
 * Returns true if it was accepted.
 */
export function command(G, cmd) {
    const B = G.battle;
    if (!B || B.phase !== 'input') return false;
    const u = unit(B, B.turn);
    if (!u || u.side !== 'p') return false;
    return doAction(G, u, cmd);
}

export function doAction(G, u, cmd) {
    const B = G.battle;
    let sk;
    if (cmd.kind === 'defend') {
        u.guard = true;
        const mpGain = Math.max(1, Math.round(u.mmp * 0.06));
        u.mp = Math.min(u.mmp, u.mp + mpGain);
        G.events.push({ type: 'act', uid: u.uid, name: 'Defend', kind: 'defend', tgts: [u.uid] });
        G.events.push({ type: 'mp', uid: u.uid, mp: u.mp });
        return finish(G, u);
    }
    if (cmd.kind === 'flee') {
        if (B.rank !== 'normal') return false;
        G.events.push({ type: 'act', uid: u.uid, name: 'Flee', kind: 'flee', tgts: [] });
        if (G.rng.chance(FLEE_CHANCE)) { endBattle(G, 'fled'); return true; }
        G.events.push({ type: 'flee-fail' });
        return finish(G, u);
    }
    if (cmd.kind === 'item') return useItem(G, u, cmd);
    if (cmd.kind === 'attack') {
        sk = { ...ATTACK, hits: u.side === 'p' ? u.fx.hits : 1 };
    } else if (cmd.kind === 'skill') {
        if (u.side === 'e') sk = { id: cmd.id, ...MONSTER_ACTS[cmd.id] };
        else {
            if (!(cmd.id in G.heroes[u.ref].skills)) return false;
            sk = skillFor(G, u, cmd.id);
        }
        if (!sk || u.mp < (sk.mp || 0)) return false;
    } else return false;
    const pool = targetsFor(B, u, sk);
    if (!pool.length) return false;
    let tgts;
    if (sk.tgt === 'enemies' || sk.tgt === 'allies') tgts = pool;
    else if (sk.tgt === 'self') tgts = [u];
    else {
        const t = pool.find((x) => x.uid === cmd.target) || null;
        if (!t) return false;
        tgts = [t];
    }
    if (sk.massRevive) tgts = side(B, u.side);
    u.mp -= sk.mp || 0;
    if (u.side === 'p' && sk.id !== 'attack') { G.counters.skills++; B.used[sk.id] = (B.used[sk.id] || 0) + 1; }
    G.events.push({ type: 'act', uid: u.uid, name: sk.name, kind: sk.kind, id: sk.id, el: elementOf(u, sk), tgts: tgts.map((t) => t.uid) });
    if (sk.mp) G.events.push({ type: 'mp', uid: u.uid, mp: u.mp });
    if (sk.selfCost) {
        const c = Math.round(u.mhp * sk.selfCost);
        u.hp = Math.max(1, u.hp - c);
        G.events.push({ type: 'hit', uid: u.uid, src: u.uid, dmg: c, hp: u.hp, el: 'dark' });
    }
    resolve(G, u, sk, tgts);
    return finish(G, u);
}

function finish(G, u) {
    const B = G.battle;
    if (checkEnd(G)) return true;
    if (u.alive) endTurn(G, u);
    else u.ct = 0;
    // a boss below half health flies into a rage, once
    for (const e of alive(B, 'e')) {
        if (e.rank === 'boss' && !e.enraged && e.hp < e.mhp * 0.5) { e.enraged = true; G.events.push({ type: 'enrage', uid: e.uid }); }
    }
    advance(G);
    return true;
}

function elementOf(u, sk) {
    if (sk.el === 'weapon') return u.side === 'p' ? (u.fx.attackEl || 'phys') : u.el;
    if (sk.el === 'base') return u.el;
    return sk.el || 'phys';
}

function stat(u, k) {
    let v = u[k];
    if ((k === 'atk') && u.st.atkup) v *= BUFF_MUL;
    if ((k === 'atk') && u.st.atkdown) v *= DEBUFF_MUL;
    if ((k === 'mag') && u.st.magup) v *= BUFF_MUL;
    if ((k === 'mag') && u.st.atkdown) v *= 0.85;
    if ((k === 'def' || k === 'res') && u.st.defup) v *= BUFF_MUL;
    if ((k === 'def' || k === 'res') && u.st.defdown) v *= DEBUFF_MUL;
    return v;
}

/** Expected damage of one hit, no randomness (the AI uses this too). */
export function estimate(src, dst, sk) {
    const el = elementOf(src, sk);
    let A, D;
    if (sk.kind === 'mag') { A = stat(src, 'mag'); D = stat(dst, 'res'); }
    else if (sk.mixed) { A = (stat(src, 'atk') + stat(src, 'mag')) / 2; D = (stat(dst, 'def') + stat(dst, 'res')) / 2; }
    else { A = stat(src, 'atk'); D = stat(dst, 'def'); }
    let d = sk.pow * A * A / (A + D);
    let weak = false, resist = false;
    if (el !== 'phys' || dst.weak.includes('phys') || dst.resist.includes('phys')) {
        if (dst.weak.includes(el)) { d *= WEAK_MUL; weak = true; }
        else if (dst.resist.includes(el)) { d *= RESIST_MUL; resist = true; }
    }
    if (src.side === 'p' && src.fx.elBoost[el]) d *= 1 + src.fx.elBoost[el];
    if (sk.exec && dst.hp < dst.mhp * sk.exec) d *= 2;
    if (dst.guard) d *= 0.5;
    if (dst.st.barrier) d *= 0.6;
    return { d, weak, resist, el };
}

function resolve(G, u, sk, tgts) {
    const B = G.battle;
    const rng = G.rng;
    if (sk.kind === 'phys' || sk.kind === 'mag') {
        let total = 0;
        for (const t of tgts) {
            for (let h = 0; h < (sk.hits || 1); h++) {
                if (!t.alive) break;
                const est = estimate(u, t, sk);
                let dmg = est.d * rng.range(0.92, 1.08);
                const critCh = (u.crit + CRIT_BASE) / 100 + (sk.crit || 0);
                const crit = rng.chance(critCh);
                if (crit) dmg *= CRIT_MUL + (u.side === 'p' ? u.fx.critMul : 0);
                dmg = Math.max(1, Math.round(dmg));
                t.hp = Math.max(0, t.hp - dmg);
                total += dmg;
                if (u.side === 'p' && est.weak) G.counters.weakHits++;
                G.events.push({ type: 'hit', uid: t.uid, src: u.uid, dmg, crit, weak: est.weak, resist: est.resist, el: est.el, hp: t.hp });
                if (t.hp <= 0) down(G, t);
            }
            if (t.alive) applyStatuses(G, u, t, sk);
            if (t.alive && u.side === 'p' && u.fx.onHit && sk.id === 'attack' && rng.chance(u.fx.onHit.ch)) addStatus(G, t, u.fx.onHit.id, u.fx.onHit.n);
            if (sk.steal && u.side === 'p') {
                const g = Math.round(3 * enemyMultGold(B.floor) * (sk.stealMul || 1));
                B.gold += g;
                G.events.push({ type: 'steal', uid: u.uid, gold: g });
            }
        }
        const leech = (sk.leech || 0) + (u.side === 'p' ? u.fx.leech : 0);
        if (leech > 0 && total > 0 && u.alive) healUnit(G, u, Math.round(total * leech), u);
        return;
    }
    if (sk.kind === 'heal') {
        for (const t of tgts) {
            if (!t.alive) continue;
            let amt;
            if (sk.pct) amt = t.mhp * sk.pct;
            else {
                const base = sk.useAtk ? stat(u, 'atk') : stat(u, 'mag');
                amt = sk.pow * base * 1.6 + t.mhp * 0.05;
            }
            if (u.side === 'p') amt *= 1 + u.fx.healBoost;
            healUnit(G, t, Math.round(amt), u);
            if (sk.cleanse) cleanse(G, t);
            applyStatuses(G, u, t, sk);
        }
        return;
    }
    if (sk.kind === 'revive') {
        for (const t of tgts) {
            if (t.alive) {
                if (sk.massRevive) healUnit(G, t, Math.round(t.mhp * sk.pow), u);
                continue;
            }
            revive(G, t, sk.pow);
        }
        return;
    }
    // buff / debuff
    for (const t of tgts) applyStatuses(G, u, t, sk);
}

function enemyMultGold(f) { return Math.max(1, enemyMult(f)); }

function applyStatuses(G, u, t, sk) {
    for (const key of ['st', 'st2', 'st3', 'st4']) {
        const st = sk[key];
        if (!st || !t.alive) continue;
        const enemyTarget = t.side !== u.side;
        const ch = enemyTarget ? statusChance(t, st) : st.ch;
        if (G.rng.chance(ch)) addStatus(G, t, st.id, st.n);
        else if (enemyTarget && STATUS[st.id].bad) G.events.push({ type: 'miss', uid: t.uid, id: st.id });
    }
}

function healUnit(G, t, amt, src) {
    if (!t.alive || amt <= 0) return;
    const before = t.hp;
    t.hp = Math.min(t.mhp, t.hp + amt);
    const done = t.hp - before;
    if (src && src.side === 'p') G.counters.healed += done;
    G.events.push({ type: 'heal', uid: t.uid, amt: done, hp: t.hp });
}

function cleanse(G, t) {
    for (const id of Object.keys(t.st)) if (STATUS[id].bad) { delete t.st[id]; G.events.push({ type: 'status', uid: t.uid, id, on: false }); }
}

function revive(G, t, pct) {
    t.alive = true;
    t.hp = Math.max(1, Math.round(t.mhp * pct));
    t.ct = 0;
    G.events.push({ type: 'revive', uid: t.uid, hp: t.hp });
}

function useItem(G, u, cmd) {
    const B = G.battle;
    const g = GOODS[cmd.id];
    if (!g || !(G.inv[cmd.id] > 0)) return false;
    const use = g.use;
    let tgts = [];
    if (g.tgt === 'ally') { const t = alive(B, 'p').find((x) => x.uid === cmd.target); if (!t) return false; tgts = [t]; }
    else if (g.tgt === 'fallen') { const t = side(B, 'p').find((x) => x.uid === cmd.target && !x.alive); if (!t) return false; tgts = [t]; }
    else if (g.tgt === 'allies') tgts = alive(B, 'p');
    else if (g.tgt === 'enemies') tgts = alive(B, 'e');
    if (use.flee && B.rank === 'boss') return false;
    G.inv[cmd.id]--;
    G.counters.items++;
    G.events.push({ type: 'act', uid: u.uid, name: g.name, kind: 'item', id: cmd.id, tgts: tgts.map((t) => t.uid) });
    if (use.flee) { endBattle(G, 'fled'); return true; }
    for (const t of tgts) {
        if (use.revive) revive(G, t, use.revive);
        if (use.heal) healUnit(G, t, Math.round(t.mhp * use.heal + (use.flat || 0)), u);
        if (use.mp) { t.mp = Math.min(t.mmp, t.mp + Math.round(t.mmp * use.mp + (use.flat || 0) * (use.heal ? 0 : 1))); G.events.push({ type: 'mp', uid: t.uid, mp: t.mp }); }
        if (use.cleanse) cleanse(G, t);
        if (use.st) addStatus(G, t, use.st, 3);
        if (use.dmg) {
            const est = { d: 14 * enemyMult(B.floor) * use.dmg };
            let d = est.d;
            const weak = t.weak.includes(use.el), resist = t.resist.includes(use.el);
            if (weak) d *= WEAK_MUL; else if (resist) d *= RESIST_MUL;
            d = Math.max(1, Math.round(d * G.rng.range(0.9, 1.1)));
            t.hp = Math.max(0, t.hp - d);
            if (weak) G.counters.weakHits++;
            G.events.push({ type: 'hit', uid: t.uid, src: u.uid, dmg: d, weak, resist, el: use.el, hp: t.hp });
            if (t.hp <= 0) down(G, t);
        }
    }
    return finish(G, u);
}

// ---------------------------------------------------------------- AI
/** Pick an action for any unit: enemies by their act list, heroes by the auto-battle brain. */
export function aiChoose(G, u) {
    return u.side === 'e' ? enemyChoose(G, u) : heroChoose(G, u);
}

function enemyChoose(G, u) {
    const B = G.battle;
    const rng = G.rng;
    const foes = foesOf(B, u);
    const friends = friendsOf(B, u);
    const pickTarget = () => {
        const taunt = foes.filter((f) => f.st.taunt);
        if (taunt.length && rng.chance(0.75)) return rng.pick(taunt).uid;
        // a little more likely to go for the wounded
        const w = foes.map((f) => 1 + (1 - f.hp / f.mhp));
        let r = rng() * w.reduce((a, b) => a + b, 0);
        for (let i = 0; i < foes.length; i++) { r -= w[i]; if (r <= 0) return foes[i].uid; }
        return foes[foes.length - 1].uid;
    };
    for (let tries = 0; tries < 4; tries++) {
        const id = rng.pick(u.acts);
        const a = MONSTER_ACTS[id];
        if (!a) continue;
        if (a.kind === 'heal') {
            if (a.tgt === 'self' && u.hp > u.mhp * 0.6) continue;
            const hurt = friends.filter((f) => f.hp < f.mhp * 0.6).sort((x, y) => x.hp / x.mhp - y.hp / y.mhp)[0];
            if (a.tgt === 'ally' && !hurt) continue;
            return { kind: 'skill', id, target: a.tgt === 'self' ? u.uid : hurt.uid };
        }
        if (a.kind === 'buff') {
            const sid = a.st.id;
            if (a.tgt === 'self' && u.st[sid]) continue;
            if (a.tgt === 'allies' && friends.every((f) => f.st[sid])) continue;
            return { kind: 'skill', id, target: u.uid };
        }
        if (a.kind === 'debuff' && a.tgt === 'enemy') {
            const t = foes.filter((f) => !f.st[a.st.id]);
            if (!t.length) continue;
            return { kind: 'skill', id, target: rng.pick(t).uid };
        }
        return { kind: 'skill', id, target: pickTarget() };
    }
    return { kind: 'attack', target: pickTarget() };
}

/**
 * The auto-battle brain, also used by the test bot. In order: raise the fallen, heal the hurt, set up buffs early,
 * then the best expected damage (skills against weaknesses and groups, MP permitting), else attack.
 */
export function heroChoose(G, u, opts = {}) {
    const B = G.battle;
    const foes = foesOf(B, u);
    const friends = friendsOf(B, u);
    const fallen = fallenOf(B, u);
    const sks = options(G, u);
    const by = (k) => sks.filter((s) => s.kind === k);
    const useItems = opts.items !== false;

    // 1. revive
    if (fallen.length) {
        const rv = by('revive').sort((a, b) => b.pow - a.pow)[0];
        if (rv) return { kind: 'skill', id: rv.id, target: fallen[0].uid };
        if (useItems && G.inv.phoenix > 0 && !friends.some((f) => f !== u && by('revive').length)) return { kind: 'item', id: 'phoenix', target: fallen[0].uid };
    }
    // 2. heal
    const ratio = (x) => x.hp / x.mhp;
    const hurt = friends.filter((f) => ratio(f) < 0.5).sort((a, b) => ratio(a) - ratio(b));
    const heals = by('heal').filter((s) => !s.pct || s.tgt === 'self');
    if (hurt.length) {
        const mass = heals.filter((s) => s.tgt === 'allies').sort((a, b) => b.pow - a.pow)[0];
        const single = heals.filter((s) => s.tgt === 'ally').sort((a, b) => b.pow - a.pow)[0];
        const selfHeal = heals.find((s) => s.tgt === 'self');
        if (mass && (hurt.length >= 2 || !single)) return { kind: 'skill', id: mass.id, target: u.uid };
        if (single) return { kind: 'skill', id: single.id, target: hurt[0].uid };
        if (selfHeal && hurt[0] === u) return { kind: 'skill', id: selfHeal.id, target: u.uid };
        if (useItems && ratio(hurt[0]) < 0.3) {
            const pot = ['hipotion', 'potion'].find((p) => G.inv[p] > 0);
            const healerAlive = friends.some((f) => f !== u && f.side === 'p' && options(G, f).some((s) => s.kind === 'heal' && s.tgt !== 'self'));
            if (pot && !healerAlive) return { kind: 'item', id: pot, target: hurt[0].uid };
        }
    }
    // cleanse a stunned or poisoned ally if we can
    const cleanser = heals.find((s) => s.cleanse);
    const sick = friends.find((f) => f.st.poison || f.st.burn || f.st.atkdown);
    if (cleanser && sick && ratio(sick) < 0.8) return { kind: 'skill', id: cleanser.id, target: sick.uid };

    // 3. buffs, once per battle each, while there's a fight worth buffing
    const tough = foes.reduce((a, f) => a + f.hp, 0) > friends.reduce((a, f) => a + stat(f, 'atk'), 0) * 3;
    if (tough) {
        for (const s of by('buff')) {
            if (B.used[s.id] >= (s.tgt === 'self' ? 2 : 1)) continue;
            const st = s.st.id;
            const tgts = s.tgt === 'allies' ? friends : s.tgt === 'self' ? [u] : [friends.slice().sort((a, b) => stat(b, 'atk') - stat(a, 'atk'))[0]];
            if (tgts.every((t) => t.st[st])) continue;
            if (st === 'taunt' && friends.length < 2) continue;
            return { kind: 'skill', id: s.id, target: tgts[0].uid };
        }
        for (const s of by('debuff')) {
            const t = foes.slice().sort((a, b) => b.hp - a.hp)[0];
            if (t.st[s.st.id] || B.used[s.id] >= 2) continue;
            return { kind: 'skill', id: s.id, target: t.uid };
        }
    }
    // 4. damage: score each option by expected damage, keep a healer's reserve
    const isHealer = sks.some((s) => s.kind === 'heal' || s.kind === 'revive');
    const reserve = isHealer ? u.mmp * 0.3 : 0;
    let best = { kind: 'attack', score: 0, target: null };
    const attackSk = { ...ATTACK, hits: u.fx ? u.fx.hits : 1 };
    const scoreOn = (sk, tgts) => tgts.reduce((a, t) => a + Math.min(t.hp, estimate(u, t, sk).d * (sk.hits || 1)), 0);
    const pickSingle = (sk) => {
        let bt = null, bs = -1;
        for (const t of foes) {
            const d = estimate(u, t, sk).d * (sk.hits || 1);
            const s = Math.min(t.hp, d) + (d >= t.hp ? t.mhp * 0.5 : 0);   // finishing a foe is worth extra
            if (s > bs) { bs = s; bt = t; }
        }
        return { t: bt, s: bs };
    };
    {
        const p = pickSingle(attackSk);
        best = { kind: 'attack', score: p.s, target: p.t.uid };
    }
    for (const s of sks) {
        if (s.kind !== 'phys' && s.kind !== 'mag') continue;
        if (u.mp - s.mp < reserve) continue;
        let sc, target;
        if (s.tgt === 'enemies') { sc = scoreOn(s, foes); target = foes[0].uid; }
        else { const p = pickSingle(s); sc = p.s; target = p.t.uid; }
        // mana is a resource: a skill must beat a plain attack by enough to be worth its cost
        sc -= s.mp * (u.mmp > 0 ? best.score / Math.max(20, u.mmp) : 0) * 0.5;
        if (sc > best.score) best = { kind: 'skill', id: s.id, score: sc, target };
    }
    // bombs when a group is weak to them and nobody else hits it
    if (useItems && foes.length >= 3) {
        for (const b of ['firebomb', 'frostbomb']) {
            if (!(G.inv[b] > 0)) continue;
            const el = GOODS[b].use.el;
            if (foes.filter((f) => f.weak.includes(el)).length >= 2) return { kind: 'item', id: b };
        }
    }
    return { kind: best.kind, id: best.id, target: best.target };
}

/** Pace the AI: called every fixed step. hold = the view is still animating. */
export function stepBattle(G, hold, dt) {
    const B = G.battle;
    if (!B || B.phase !== 'ai') return;
    if (hold) return;
    B.wait += dt;
    if (B.wait < AI_DELAY) return;
    const u = unit(B, B.turn);
    if (!u || !u.alive) { advance(G); return; }
    const choice = aiChoose(G, u);
    if (!doAction(G, u, choice)) doAction(G, u, { kind: 'defend' });
}

/** Resolve the current AI turn immediately (tests, fast-forward). */
export function runAiTurn(G) {
    const B = G.battle;
    if (!B || B.phase !== 'ai') return false;
    const u = unit(B, B.turn);
    if (!u || !u.alive) { advance(G); return true; }
    const choice = aiChoose(G, u);
    if (!doAction(G, u, choice)) doAction(G, u, { kind: 'defend' });
    return true;
}

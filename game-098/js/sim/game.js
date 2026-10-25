// The simulation root. Pure: no DOM, no rendering library, no Math.random, no clock.
//
// G = { v, seed, rng, events, meta, battle }. meta is the roost: gold, food, dragons, eggs,
// incubators, training rings, story progress. battle is the fight in progress (see battle.js).
// Everything goes through act(G, cmd); the UI, the bot and the tests all use it. Real time comes
// in as a command too ({ t: 'idle', sec }), so eggs hatch while you play or while you are away.

import { START, SHOP, LIMITS, IDLE, PARTY_MAX, AI_DELAY, LEVEL } from '../config.js';
import { SPECIES } from './data.js';
import { CHAPTERS, STARTERS } from './story.js';
import { makeRng } from '../rng.js';
import { makeDragon, makeEgg, giveXp, canBreed, breedEgg, randomSpecies, STATS } from './dragons.js';
import { buildChapter, buildWild, battleAct, startPhase, finish } from './battle.js';
import { stepSide } from './ai.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const EGG_CAP = 16;

export function newGame(seed = 1) {
    const G = {
        v: 1,
        seed,
        rng: makeRng(seed),
        events: [],
        meta: {
            started: false,
            gold: START.gold,
            food: { meat: 3, fish: 0, fruit: 1, ironroot: 0, coal: 1 },
            dragons: [],
            eggs: [],
            incub: Array(START.incubators).fill(null),
            training: Array(START.training).fill(null),
            stableN: START.stable,
            nextRid: 1,
            nextEid: 1,
            tamer: { lv: 1, xp: 0 },
            ch: 0,
            cleared: {},
            ranks: {},
            flags: { breed: false, wild: false },
            song: 1,
            party: [],
            hoard: 0,
            wall: 0,
            played: 0,
            hunts: 0,
            hatched: 0,
            bred: 0,
            dex: {},
        },
        battle: null,
    };
    return G;
}

/** Link a battle's event list to the game's (non-enumerable, so it is never saved). */
function link(G, B) {
    if (B) Object.defineProperty(B, 'events', { value: G.events, enumerable: false, writable: true, configurable: true });
    return B;
}

export const unlocked = (G, ci) => ci >= 0 && ci < CHAPTERS.length && ci <= G.meta.ch;
export const nextChapter = (G) => Math.min(G.meta.ch, CHAPTERS.length - 1);
export const dragon = (G, rid) => G.meta.dragons.find((d) => d.rid === rid) || null;
export const egg = (G, eid) => G.meta.eggs.find((e) => e.eid === eid) || null;

/** The price of a shop item now (upgrades get dearer). */
export function price(G, item) {
    const S = SHOP[item];
    const M = G.meta;
    if (item === 'nest') return Math.round(S.cost * S.scale ** (M.incub.length - START.incubators));
    if (item === 'ring') return Math.round(S.cost * S.scale ** (M.training.length - START.training));
    if (item === 'stall') return Math.round(S.cost * S.scale ** ((M.stableN - START.stable) / 4));
    return S.cost;
}

/** Suggested level for a Wild Hunt: about the party's strength. */
export function wildLevel(G) {
    const lv = G.meta.dragons.map((d) => d.lv).sort((a, b) => b - a).slice(0, 4);
    if (!lv.length) return 1;
    return Math.max(1, Math.round(lv.reduce((a, b) => a + b, 0) / lv.length));
}

function addDex(G, sp) { G.meta.dex[sp] = true; }

// ------------------------------------------------------------------ the roost
function roostAct(G, cmd) {
    const M = G.meta;
    switch (cmd.t) {
        case 'starter': {
            if (M.started) return { ok: false, err: 'already chosen' };
            if (!STARTERS.includes(cmd.sp)) return { ok: false, err: 'not a starter' };
            const d = makeDragon(G, cmd.sp, { lv: 2, bond: 2 });
            if (cmd.name) d.name = String(cmd.name).slice(0, 14);
            M.dragons.push(d);
            M.party = [d.rid];
            M.started = true;
            addDex(G, cmd.sp);
            G.events.push({ type: 'hatch', rid: d.rid, sp: d.sp, name: d.name, starter: true });
            return { ok: true, rid: d.rid };
        }
        case 'idle': {
            const sec = clamp(+cmd.sec || 0, 0, IDLE.offlineCap);
            if (cmd.wall) M.wall = cmd.wall;
            if (sec <= 0) return { ok: true };
            M.played += sec;
            for (const eid of M.incub) {
                const e = egg(G, eid);
                if (!e) continue;
                const was = e.prog < e.need;
                e.prog = Math.min(e.need, e.prog + sec);
                if (was && e.prog >= e.need) G.events.push({ type: 'ready', eid: e.eid, sp: e.sp });
            }
            for (const rid of M.training) {
                const d = dragon(G, rid);
                if (!d || d.lv >= LEVEL.max) continue;
                const ups = giveXp(d, sec * IDLE.trainXp * (d.traits.includes('loyal') ? 1.1 : 1));
                for (const up of ups) G.events.push({ type: 'grow', rid: d.rid, name: d.name, lv: up.lv, gains: up.gains, why: 'training' });
            }
            const hoardCap = IDLE.hoardCap + M.dragons.length * 40;
            M.hoard = Math.min(hoardCap, M.hoard + sec * IDLE.hoardRate * M.dragons.length);
            for (const d of M.dragons) if (d.breedCd > 0) d.breedCd = Math.max(0, d.breedCd - sec);
            return { ok: true };
        }
        case 'warm': {
            const e = egg(G, M.incub[cmd.slot]);
            if (!e) return { ok: false, err: 'empty' };
            if (e.prog >= e.need) return { ok: false, err: 'ready' };
            e.prog = Math.min(e.need, e.prog + IDLE.tapWarm);
            if (e.prog >= e.need) G.events.push({ type: 'ready', eid: e.eid, sp: e.sp });
            return { ok: true };
        }
        case 'coal': {
            if (M.food.coal <= 0) return { ok: false, err: 'no coal' };
            if (!M.incub.some((x) => x != null)) return { ok: false, err: 'no eggs warming' };
            M.food.coal--;
            for (const eid of M.incub) {
                const e = egg(G, eid);
                if (!e) continue;
                const was = e.prog < e.need;
                e.prog = Math.min(e.need, e.prog + 300);
                if (was && e.prog >= e.need) G.events.push({ type: 'ready', eid: e.eid, sp: e.sp });
            }
            return { ok: true };
        }
        case 'incubate': {
            const e = egg(G, cmd.eid);
            if (!e) return { ok: false, err: 'no egg' };
            if (M.incub.includes(e.eid)) return { ok: false, err: 'already warming' };
            const slot = cmd.slot ?? M.incub.indexOf(null);
            if (slot < 0 || slot >= M.incub.length || M.incub[slot] != null) return { ok: false, err: 'no free incubator' };
            M.incub[slot] = e.eid;
            return { ok: true };
        }
        case 'uncubate': {
            if (M.incub[cmd.slot] == null) return { ok: false, err: 'empty' };
            M.incub[cmd.slot] = null;
            return { ok: true };
        }
        case 'hatch': {
            const e = egg(G, M.incub[cmd.slot]);
            if (!e) return { ok: false, err: 'empty' };
            if (e.prog < e.need) return { ok: false, err: 'not ready' };
            if (M.dragons.length >= M.stableN) return { ok: false, err: 'stable full' };
            const d = makeDragon(G, e.sp, { lv: 1, genes: e.genes, traits: e.traits.slice(), hue: e.hue, gilded: e.gilded, gen: e.gen, parents: e.parents });
            M.dragons.push(d);
            M.eggs.splice(M.eggs.indexOf(e), 1);
            M.incub[cmd.slot] = null;
            M.hatched++;
            addDex(G, d.sp);
            if (M.party.length < PARTY_MAX) M.party.push(d.rid);
            G.events.push({ type: 'hatch', rid: d.rid, sp: d.sp, name: d.name, gilded: d.gilded });
            return { ok: true, rid: d.rid };
        }
        case 'breed': {
            if (!M.flags.breed) return { ok: false, err: 'locked' };
            const a = dragon(G, cmd.a), b = dragon(G, cmd.b);
            if (!a || !b || a === b) return { ok: false, err: 'pick two dragons' };
            if (!canBreed(a) || !canBreed(b)) return { ok: false, err: 'not ready to breed' };
            if (M.eggs.length >= EGG_CAP) return { ok: false, err: 'egg basket full' };
            const e = breedEgg(G, a, b);
            a.breedCd = b.breedCd = IDLE.breedCd;
            M.bred++;
            G.events.push({ type: 'laid', eid: e.eid, sp: e.sp, a: a.rid, b: b.rid });
            return { ok: true, eid: e.eid };
        }
        case 'feed': {
            const d = dragon(G, cmd.rid);
            const f = cmd.food;
            if (!d) return { ok: false, err: 'no dragon' };
            if (!M.food[f]) return { ok: false, err: 'none left' };
            if (f === 'meat' || f === 'fish') {
                if (d.lv >= LEVEL.max) return { ok: false, err: 'max level' };
                M.food[f]--;
                const ups = giveXp(d, f === 'meat' ? 30 : 100);
                d.bond = Math.min(10, d.bond + (G.rng() < 0.15 ? 1 : 0));
                for (const up of ups) G.events.push({ type: 'grow', rid: d.rid, name: d.name, lv: up.lv, gains: up.gains, why: 'food' });
            } else if (f === 'fruit') {
                if (d.bond >= 10) return { ok: false, err: 'bond full' };
                M.food[f]--;
                d.bond = Math.min(10, d.bond + (d.traits.includes('loyal') ? 2 : 1));
            } else if (f === 'ironroot') {
                const s = cmd.stat;
                if (!STATS.includes(s)) return { ok: false, err: 'pick a stat' };
                if (d.train[s] >= LIMITS.trainBonus) return { ok: false, err: 'trained to the limit' };
                M.food[f]--;
                d.train[s]++;
            } else return { ok: false, err: 'not food' };
            G.events.push({ type: 'fed', rid: d.rid, food: f });
            return { ok: true };
        }
        case 'buy': {
            const S = SHOP[cmd.item];
            if (!S) return { ok: false, err: 'no such thing' };
            const cost = price(G, cmd.item);
            if (M.gold < cost) return { ok: false, err: 'not enough gold' };
            if (cmd.item === 'nest' && M.incub.length >= LIMITS.incubators) return { ok: false, err: 'no room' };
            if (cmd.item === 'ring' && M.training.length >= LIMITS.training) return { ok: false, err: 'no room' };
            if (cmd.item === 'stall' && M.stableN >= LIMITS.stable) return { ok: false, err: 'no room' };
            if ((cmd.item === 'egg' || cmd.item === 'rareegg') && M.eggs.length >= EGG_CAP) return { ok: false, err: 'egg basket full' };
            M.gold -= cost;
            let got = null;
            if (cmd.item === 'nest') M.incub.push(null);
            else if (cmd.item === 'ring') M.training.push(null);
            else if (cmd.item === 'stall') M.stableN += 4;
            else if (cmd.item === 'egg') got = makeEgg(G, randomSpecies(G.rng, 1, G.rng() < 0.12 ? 3 : 2), { from: 'market' }).sp;
            else if (cmd.item === 'rareegg') got = makeEgg(G, randomSpecies(G.rng, 3, 4), { from: 'market' }).sp;
            else M.food[cmd.item] = (M.food[cmd.item] || 0) + 1;
            G.events.push({ type: 'bought', item: cmd.item, cost, got });
            return { ok: true, got };
        }
        case 'train': {
            const d = dragon(G, cmd.rid);
            if (!d) return { ok: false, err: 'no dragon' };
            if (M.training.includes(d.rid)) return { ok: false, err: 'already training' };
            const slot = cmd.slot ?? M.training.indexOf(null);
            if (slot < 0 || slot >= M.training.length || M.training[slot] != null) return { ok: false, err: 'no free ring' };
            M.training[slot] = d.rid;
            return { ok: true };
        }
        case 'untrain': {
            if (M.training[cmd.slot] == null) return { ok: false, err: 'empty' };
            M.training[cmd.slot] = null;
            return { ok: true };
        }
        case 'collect': {
            const g = Math.floor(M.hoard);
            if (g <= 0) return { ok: false, err: 'nothing yet' };
            M.gold += g; M.hoard -= g;
            G.events.push({ type: 'coins', amount: g });
            return { ok: true, gold: g };
        }
        case 'rename': {
            const d = dragon(G, cmd.rid);
            const n = String(cmd.name || '').replace(/[<>&"]/g, '').trim().slice(0, 14);
            if (!d || !n) return { ok: false, err: 'bad name' };
            d.name = n;
            return { ok: true };
        }
        case 'release': {
            const d = dragon(G, cmd.rid);
            if (!d) return { ok: false, err: 'no dragon' };
            if (M.dragons.length <= 1) return { ok: false, err: 'last dragon' };
            M.dragons.splice(M.dragons.indexOf(d), 1);
            M.party = M.party.filter((r) => r !== d.rid);
            M.training = M.training.map((r) => (r === d.rid ? null : r));
            const g = 20 * d.lv;
            M.gold += g;
            return { ok: true, gold: g };
        }
        case 'party': {
            const rids = [...new Set(cmd.rids || [])].filter((r) => dragon(G, r)).slice(0, PARTY_MAX);
            M.party = rids;
            return { ok: true };
        }
    }
    return null;
}

// ------------------------------------------------------------------ the dispatcher
export function act(G, cmd) {
    if (!cmd || !cmd.t) return { ok: false, err: 'no command' };
    if (cmd.t === 'start') {
        if (G.battle && !G.battle.over) return { ok: false, err: 'already fighting' };
        if (!G.meta.started) return { ok: false, err: 'choose a starter first' };
        const rids = (cmd.rids || G.meta.party).filter((r) => dragon(G, r));
        let B;
        if (cmd.wild) {
            if (!G.meta.flags.wild) return { ok: false, err: 'locked' };
            B = buildWild(G, rids, cmd.lvl || wildLevel(G));
        } else {
            if (!unlocked(G, cmd.ch)) return { ok: false, err: 'locked' };
            B = buildChapter(G, cmd.ch, rids);
        }
        G.battle = link(G, B);
        startPhase(G, B, 'p');
        return { ok: true };
    }
    if (cmd.t === 'leave') {
        const B = G.battle;
        if (!B) return { ok: false, err: 'no battle' };
        if (!B.over) finish(G, B, false, 'retreat');
        G.battle = null;
        return { ok: true };
    }
    const r = roostAct(G, cmd);
    if (r) return r;
    return battleAct(G, cmd);
}

/** Pace the Chain's phase: one action every AI_DELAY of sim time, held while the view animates. */
export function step(G, inp, dt) {
    const B = G.battle;
    if (!B || B.over || B.phase !== 'e') return;
    if (inp?.hold) return;
    B.aiT -= dt;
    if (B.aiT > 0) return;
    stepSide(G, B, 'e');
    B.aiT = AI_DELAY;
}

/** Run the whole enemy phase at once (tests and fast-forward). */
export function runEnemyPhase(G) {
    const B = G.battle;
    let n = 0;
    while (B && !B.over && B.phase === 'e' && n++ < 400) stepSide(G, B, 'e');
}

export function serialize(G) {
    const { rng, events, ...rest } = G;
    return JSON.parse(JSON.stringify({ ...rest, rngState: rng.state() }));
}

export function deserialize(d) {
    if (!d || d.v !== 1) throw new Error('unknown save version');
    const { rngState, ...rest } = d;
    const G = { ...JSON.parse(JSON.stringify(rest)), rng: makeRng(0), events: [] };
    G.rng.setState(rngState);
    if (!G.meta || !Array.isArray(G.meta.dragons)) throw new Error('bad save');
    link(G, G.battle);
    return G;
}

void SPECIES;

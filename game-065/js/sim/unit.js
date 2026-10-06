// A COM-bot you own (or meet): a plain, serialisable object.
//   { uid, sp, nick, lv, xp, hp, st, stT, moves: [{ id, pp }], cal: [6], temper, mod, sync, gilded, met }
// cal = calibration (0–31 per stat; the repair minigame raises it), temper = temperament (±10%).

import { SPECIES, movesLearned, defaultMoves } from './dex.js';
import { MOVES } from './data/moves.js';
import { PARTS } from './data/parts.js';
import { STATS, xpForLevel, MAX_LEVEL, MAX_MOVES, SYNC_MAX } from '../config.js';

const UP = ['atk', 'def', 'spa', 'spd', 'spe'];
const TEMPER_NAMES = [
    ['Steady', 'Brash', 'Gruff', 'Reckless', 'Lumbering'],
    ['Cautious', 'Square', 'Stubborn', 'Rigid', 'Bulky'],
    ['Bookish', 'Delicate', 'Even', 'Hasty-minded', 'Ponderous'],
    ['Patient', 'Gentle', 'Mild', 'Plain', 'Unhurried'],
    ['Restless', 'Jittery', 'Zippy', 'Skittish', 'Balanced'],
];
/** 25 temperaments: up[i] raises one stat 10% and lowers another (the diagonal is neutral). */
export const TEMPERS = [];
for (let i = 0; i < 5; i++) for (let j = 0; j < 5; j++) TEMPERS.push({ name: TEMPER_NAMES[i][j], up: i === j ? null : UP[i], down: i === j ? null : UP[j] });

export function makeUnit(rng, sp, lv, { uid = 0, cal = null, gilded = null, met = null, moves = null } = {}) {
    const S = SPECIES[sp];
    if (!S) throw new Error(`no species ${sp}`);
    const u = {
        uid, sp, nick: null, lv, xp: xpForLevel(lv),
        hp: 1, st: null, stT: 0,
        moves: (moves || defaultMoves(sp, lv)).map((id) => ({ id, pp: MOVES[id].pp })),
        cal: cal || STATS.map(() => rng.int(0, 31)),
        temper: rng.int(0, 24),
        mod: null, sync: 70,
        gilded: gilded !== null ? gilded : rng.next() < 1 / 512,
        met: met || null,
    };
    u.hp = maxHp(u);
    return u;
}

export function name(u) { return u.nick || SPECIES[u.sp].name; }

export function calcStats(u) {
    const S = SPECIES[u.sp];
    const T = TEMPERS[u.temper] || TEMPERS[0];
    const out = {};
    STATS.forEach((s, i) => {
        const core = Math.floor(((2 * S.base[s] + u.cal[i]) * u.lv) / 100);
        if (s === 'hp') out.hp = core + u.lv + 10;
        else {
            let v = core + 5;
            if (T.up === s) v = Math.floor(v * 1.1);
            if (T.down === s) v = Math.floor(v * 0.9);
            out[s] = v;
        }
    });
    if (S.traits.includes('prime-engine')) for (const s of STATS) if (s !== 'hp') out[s] = Math.floor(out[s] * 1.1);
    return out;
}
export function maxHp(u) { return calcStats(u).hp; }
export function traitsOf(u) { return SPECIES[u.sp].traits; }
export function typesOf(u) { return SPECIES[u.sp].types; }

export function healFull(u) {
    u.hp = maxHp(u);
    u.st = null; u.stT = 0;
    for (const m of u.moves) m.pp = MOVES[m.id].pp;
}

/** Add experience. Returns { levels: [{lv, learned:[ids], pending:[ids]}] } — techniques learned
 *  outright fill empty slots; the rest come back as pending, for the player to choose. */
export function gainXp(u, amount) {
    const out = { levels: [], learned: [], pending: [] };
    if (u.lv >= MAX_LEVEL) return out;
    u.xp += amount;
    while (u.lv < MAX_LEVEL && u.xp >= xpForLevel(u.lv + 1)) {
        const before = calcStats(u);
        u.lv++;
        const after = calcStats(u);
        u.hp = Math.min(after.hp, u.hp + (after.hp - before.hp));
        u.sync = Math.min(SYNC_MAX, u.sync + 4);
        const lvInfo = { lv: u.lv, learned: [], pending: [] };
        for (const m of movesLearned(u.sp, u.lv - 1, u.lv)) {
            if (u.moves.some((x) => x.id === m)) continue;
            if (u.moves.length < MAX_MOVES) { u.moves.push({ id: m, pp: MOVES[m].pp }); lvInfo.learned.push(m); out.learned.push(m); }
            else { lvInfo.pending.push(m); out.pending.push(m); }
        }
        out.levels.push(lvInfo);
    }
    if (u.lv >= MAX_LEVEL) u.xp = xpForLevel(MAX_LEVEL);
    return out;
}

/** Replace move slot i (or append if room) with a technique. */
export function learnMove(u, moveId, slot = -1) {
    if (u.moves.some((m) => m.id === moveId)) return false;
    if (slot < 0 || slot >= u.moves.length) {
        if (u.moves.length >= MAX_MOVES) return false;
        u.moves.push({ id: moveId, pp: MOVES[moveId].pp });
    } else u.moves[slot] = { id: moveId, pp: MOVES[moveId].pp };
    return true;
}

/** Which species this unit would evolve into right now, given an optional kit being used. */
export function evolutionTarget(u, kit = null) {
    const S = SPECIES[u.sp];
    const e = S.evolves;
    if (!e) return null;
    if (e.k === 'level' && u.lv >= e.lv && !kit) return e.to;
    if (e.k === 'sync' && u.sync >= 220 && !kit) return e.to;
    if (e.k === 'kit' && kit === e.item) return e.to;
    return null;
}

/** Evolve: swap species, install the new parts, gain the new trait, learn each new part's technique.
 *  Returns a summary for the evolution screen. */
export function evolve(u) {
    const from = SPECIES[u.sp];
    const to = SPECIES[from.evolves.to];
    const hpFrac = u.hp / maxHp(u);
    const wasNamed = !!u.nick;
    u.sp = to.id;
    u.hp = Math.max(1, Math.round(maxHp(u) * hpFrac));
    const parts = to.added.map(([slot, key]) => ({ slot, key, name: PARTS[slot] && PARTS[slot][key] ? PARTS[slot][key].name : key }));
    const learned = [], pending = [];
    for (const [slot, key] of to.added) {
        const mv = PARTS[slot] && PARTS[slot][key] && PARTS[slot][key].move;
        if (!mv || u.moves.some((m) => m.id === mv) || learned.includes(mv) || pending.includes(mv)) continue;
        if (u.moves.length < MAX_MOVES) { u.moves.push({ id: mv, pp: MOVES[mv].pp }); learned.push(mv); }
        else pending.push(mv);
    }
    // Techniques the new form learns at the current level.
    for (const m of movesLearned(u.sp, u.lv - 1, u.lv)) {
        if (u.moves.some((x) => x.id === m) || pending.includes(m)) continue;
        if (u.moves.length < MAX_MOVES) { u.moves.push({ id: m, pp: MOVES[m].pp }); learned.push(m); }
        else pending.push(m);
    }
    const newTraits = to.traits.filter((t) => !from.traits.includes(t));
    u.sync = Math.min(SYNC_MAX, u.sync + 10);
    return { from: from.id, to: to.id, parts, traits: newTraits, learned, pending, wasNamed };
}

/** Experience a defeated bot gives. */
export function xpYield(defeated, trainer) {
    const S = SPECIES[defeated.sp];
    return Math.max(1, Math.floor((S.xpYield * defeated.lv) / 7 * (trainer ? 1.5 : 1)));
}

export function isFainted(u) { return u.hp <= 0; }

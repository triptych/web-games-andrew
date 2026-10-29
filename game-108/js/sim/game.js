// The game: roster, party, the calling (summons), the campaign and every command. Pure.
//
// act(G, cmd) is the only way anything changes. The UI, the bot and the tests all go through it.
//   { t: 'battle', stage }      start a battle on an unlocked stage
//   { t: 'swap', i, j }         swap two adjacent tokens (grid indices)
//   { t: 'skill', k }           use party hero k's skill
//   { t: 'flee' }               give up the battle (heroes bound so far are kept)
//   { t: 'leave' }              back to camp once a battle is over
//   { t: 'summon', n }          call 1 or 5 heroes; they wait in the calling for your next board
//   { t: 'party', ids }         choose up to four bound heroes

import { PARTY, CALLS, SUMMON, START, LEVEL } from '../config.js';
import { rnd, rpick } from '../rng.js';
import { HEROES, HERO, STARTERS, STAGES } from './data.js';
import { startBattle, swap, useSkill, flee, heroStats, recruit } from './battle.js';

export { heroStats };

export function newGame(seed = 1) {
    const G = {
        v: 1,
        seed,
        r: seed | 0,
        nid: 1,
        roster: {},
        party: [],
        calls: [],
        crystals: START.crystals,
        pity: 0,
        cleared: {},
        progress: 0,                 // the highest stage index that is open
        B: null,
        done: false,
        stats: { moves: 0, recruits: 0, cleared: 0, skills: 0, pulls: 0, wins: 0, losses: 0 },
        events: [],                  // { type, ... } since the last drain; never saved
    };
    for (const id of STARTERS) {
        G.roster[id] = { lv: 1, xp: 0, rank: 0, at: 0 };
        G.party.push(id);
    }
    return G;
}

export const unlocked = (G, stage) => stage >= 0 && stage < STAGES.length && stage <= G.progress;

export function act(G, cmd) {
    const t = cmd?.t;
    let res;
    if (t === 'swap') res = swap(G, cmd.i, cmd.j);
    else if (t === 'skill') res = useSkill(G, cmd.k);
    else if (t === 'flee') res = flee(G);
    else if (t === 'battle') {
        if (G.B && !G.B.over) return { ok: false, why: 'in battle' };
        if (!unlocked(G, cmd.stage)) return { ok: false, why: 'locked' };
        if (!G.party.length) return { ok: false, why: 'no party' };
        startBattle(G, cmd.stage);
        res = { ok: true };
    } else if (t === 'leave') {
        if (!G.B || !G.B.over) return { ok: false, why: 'battle not over' };
        G.B = null;
        return { ok: true };
    } else if (t === 'summon') return summon(G, cmd.n);
    else if (t === 'party') return setParty(G, cmd.ids);
    else return { ok: false, why: 'unknown command' };
    if (G.B?.over && !G.B.reward) reward(G);
    return res;
}

// ------------------------------------------------------------------ the calling
export function summonCost(n) { return n >= 5 ? SUMMON.cost5 : SUMMON.cost1 * n; }

function summon(G, n) {
    n = n === 5 ? 5 : 1;
    if (G.B && !G.B.over) return { ok: false, why: 'in battle' };
    const cost = summonCost(n);
    if (G.crystals < cost) return { ok: false, why: 'crystals' };
    if (G.calls.length + n > CALLS.max) return { ok: false, why: 'calling full' };
    G.crystals -= cost;
    const got = [];
    for (let k = 0; k < n; k++) {
        G.pity++;
        G.stats.pulls++;
        let r = 3;
        const x = rnd(G);
        if (G.pity >= SUMMON.pity || x < SUMMON.rates[5]) r = 5;
        else if (x < SUMMON.rates[5] + SUMMON.rates[4]) r = 4;
        if (r === 5) G.pity = 0;
        const h = rpick(G, HEROES.filter((q) => q.r === r));
        got.push(h.id);
        G.calls.push(h.id);
    }
    G.events.push({ type: 'summon', got });
    return { ok: true, got };
}

function setParty(G, ids) {
    if (G.B && !G.B.over) return { ok: false, why: 'in battle' };
    if (!Array.isArray(ids)) return { ok: false, why: 'bad party' };
    const uniq = [...new Set(ids)].filter((id) => G.roster[id]).slice(0, PARTY.size);
    if (!uniq.length) return { ok: false, why: 'empty' };
    G.party = uniq;
    return { ok: true };
}

/** Party power by colour and HP, for the camp screens. */
export function partySummary(G, ids = G.party) {
    let hp = PARTY.baseHp, atk = 0;
    for (const id of ids) { const s = heroStats(G, id); hp += s.hp; atk += s.atk; }
    return { hp, atk };
}

// ------------------------------------------------------------------ rewards
export const xpToLevel = (lv) => lv * LEVEL.xpPer;

function reward(G) {
    const B = G.B, st = STAGES[B.stage];
    const win = B.over === 'win';
    const first = win && !G.cleared[B.stage];
    // a swift win pays more: up to half again the base for finishing well under par
    const par = 10 + 2 * B.stage;
    const swift = win ? Math.round(Math.max(0, 1 - B.turn / par) * (40 + 10 * B.stage)) : 0;
    const crystals = win ? 40 + 8 * B.stage + swift + (first ? 100 : 0) + (st.boss && first ? 100 : 0) : 10 + 2 * B.stage;
    G.crystals += crystals;
    const xp = Math.round((20 + 7 * B.stage) * (win ? 1 : 0.4));
    const levels = [];
    for (const p of B.party) {
        const e = G.roster[p.id];
        if (!e) continue;
        e.xp += xp;
        let up = 0;
        while (e.lv < LEVEL.max && e.xp >= xpToLevel(e.lv)) { e.xp -= xpToLevel(e.lv); e.lv++; up++; }
        if (e.lv >= LEVEL.max) e.xp = 0;
        if (up) levels.push({ id: p.id, lv: e.lv });
    }
    if (win) {
        G.cleared[B.stage] = (G.cleared[B.stage] || 0) + 1;
        G.progress = Math.min(STAGES.length - 1, Math.max(G.progress, B.stage + 1));
        G.stats.wins++;
        if (st.final) G.done = true;
    } else G.stats.losses++;
    B.reward = { win, first, crystals, swift, xp, levels, recruited: B.recruited.slice(), final: !!(win && st.final) };
}

// ------------------------------------------------------------------ saves
export function serialize(G) {
    const { events, ...rest } = G;
    return JSON.parse(JSON.stringify(rest));
}

export function deserialize(d) {
    if (!d || d.v !== 1) throw new Error('unknown save version');
    if (typeof d.r !== 'number' || !d.roster || !Array.isArray(d.party)) throw new Error('damaged save');
    return { ...JSON.parse(JSON.stringify(d)), events: [] };
}

export { recruit };

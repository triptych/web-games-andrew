// The numbers: effects, conditions, experience, the council vote and which ending a game has earned. Pure.

import { AFF_SOFT, XP_NEXT, RANKS, VOTE_AT, HEARTH_AFF } from '../config.js';

const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
const r1 = (v) => Math.round(v * 10) / 10;
export const TRUSTS = ['folk', 'crown', 'wild', 'fellow'];
export const TRUST_NAME = { folk: 'Townsfolk', crown: 'The Crown', wild: 'The Wild Folk', fellow: 'Fellowship' };
const PLAIN = ['gold', 'merit', 'renown', 'potions', 'charts', 'ap'];

export function bumpAff(G, id, amount) {
    if (!(id in G.aff)) throw new Error('unknown friend ' + id);
    const v = G.aff[id];
    const d = amount > 0 ? amount * Math.max(0.2, 1 - v / AFF_SOFT) : amount;
    G.aff[id] = r1(clamp(v + d, 0, 100));
    return r1(G.aff[id] - v);
}

/** Give an adventurer experience; they rise a rank (or several) when they have earned it. */
export function addXp(G, id, xp) {
    const a = G.advs.find((x) => x.id === id);
    if (!a) throw new Error('unknown adventurer ' + id);
    a.xp = Math.round(a.xp + xp);
    while (a.rank < 4 && a.xp >= XP_NEXT[a.rank]) {
        a.xp -= XP_NEXT[a.rank];
        a.rank++;
        G.merit += 1;
        G.renown += a.rank;
        G.trust.fellow = clamp(G.trust.fellow + 2, 0, 100);
        G.events.push({ type: 'rankup', adv: a.id, rank: a.rank, rankName: RANKS[a.rank] });
    }
    if (a.rank === 4) a.xp = 0;
}

/** Change one meter and return the real change. */
export function bump(G, key, amount) {
    if (key.startsWith('aff.')) return bumpAff(G, key.slice(4), amount);
    if (key.startsWith('xp.')) { addXp(G, key.slice(3), amount); return amount; }
    if (TRUSTS.includes(key)) { const v = G.trust[key]; G.trust[key] = clamp(Math.round(v + amount), 0, 100); return G.trust[key] - v; }
    if (key === 'integ') { const v = G.integ; G.integ = clamp(Math.round(v + amount), 0, 100); return G.integ - v; }
    if (PLAIN.includes(key)) { const v = G[key]; G[key] = Math.max(key === 'gold' ? -9999 : 0, Math.round(v + amount)); return G[key] - v; }
    throw new Error('unknown meter ' + key);
}

/**
 * Apply an effect string: 'gold+50 merit+2 folk+3 integ-5 aff.kael+5 xp.pip+20 flag:x !flag:y partner:kael phase:raid'.
 * Returns { key: change } and pushes an 'fx' event the UI turns into floating numbers.
 */
export function applyFx(G, fx) {
    const out = {};
    for (const tok of fx.trim().split(/\s+/)) {
        if (!tok) continue;
        if (tok.startsWith('flag:')) { G.flags[tok.slice(5)] = true; continue; }
        if (tok.startsWith('!flag:')) { delete G.flags[tok.slice(6)]; continue; }
        if (tok.startsWith('phase:')) { G.phase = tok.slice(6); continue; }
        if (tok.startsWith('partner:')) {
            const id = tok.slice(8);
            if (!G.partner) { G.partner = id; G.events.push({ type: 'partner', id }); }
            continue;
        }
        const m = tok.match(/^([a-z.]+)([+-])([\d.]+)$/);
        if (!m) throw new Error('bad fx token ' + tok);
        const got = bump(G, m[1], (m[2] === '-' ? -1 : 1) * +m[3]);
        out[m[1]] = (out[m[1]] || 0) + got;
    }
    if (Object.keys(out).length) G.events.push({ type: 'fx', fx: out });
    return out;
}

export const platCount = (G) => G.advs.filter((a) => a.rank === 4).length;

/** Who would vote for you as Guildmaster: four factions and Orla's own nod (for an honest ledger). */
export function votes(G) {
    return TRUSTS.filter((k) => G.trust[k] >= VOTE_AT).length + (G.integ >= VOTE_AT ? 1 : 0);
}

function val(G, key) {
    if (key in G.trust) return G.trust[key];
    if (key.startsWith('aff.')) return G.aff[key.slice(4)] ?? 0;
    if (key.startsWith('hearts.')) return G.hearts[key.slice(7)] ?? 0;
    if (key === 'plat') return platCount(G);
    if (key === 'votes') return votes(G);
    if (['day', 'rank', 'gold', 'merit', 'renown', 'integ', 'potions', 'charts'].includes(key)) return G[key];
    throw new Error('unknown condition key ' + key);
}

/** 'rank>=3 & wild>=50 & flag:x & !flag:y & partner & partner=kael & gender=f' */
export function evalCond(G, cond) {
    return cond.split('&').every((raw) => {
        const t = raw.trim();
        if (!t) return true;
        if (t === 'partner') return !!G.partner;
        if (t === '!partner') return !G.partner;
        if (t.startsWith('partner=')) return G.partner === t.slice(8);
        if (t.startsWith('gender=')) return G.gender === t.slice(7);
        if (t.startsWith('flag:')) return !!G.flags[t.slice(5)];
        if (t.startsWith('!flag:')) return !G.flags[t.slice(6)];
        const m = t.match(/^([a-z.]+)\s*(>=|<=|>|<|==)\s*(-?[\d.]+)$/);
        if (!m) throw new Error('bad condition ' + t);
        const v = val(G, m[1]), n = +m[3];
        return m[2] === '>=' ? v >= n : m[2] === '<=' ? v <= n : m[2] === '>' ? v > n : m[2] === '<' ? v < n : v === n;
    });
}

// ------------------------------------------------------------------ endings
// The first rule that holds wins. Each is written so a player can see why they got it.
export const ENDING_RULES = [
    ['disgrace', (G) => !!G.flags.disgraced],
    ['ruin', (G) => !!G.flags.raid_lost],
    ['foreclosed', (G) => !!G.flags.foreclosed],
    ['emissary', (G) => !!G.flags.emissary],
    ['road', (G) => !!G.flags.road],
    ['hearth', (G) => !!G.flags.hearth && !!G.partner && G.aff[G.partner] >= HEARTH_AFF],
    ['puppet', (G) => G.rank === 5 && !!G.flags.bribed],
    ['gilded', (G) => G.gold >= 1200 && G.integ < 45],
    ['golden', (G) => G.rank === 5 && !!G.flags.raid_won && !G.flags.raid_pyrrhic && G.trust.folk >= 50 && G.trust.crown >= 50 && G.trust.wild >= 50],
    ['academy', (G) => G.rank === 5 && platCount(G) >= 3],
    ['wild', (G) => G.rank === 5 && !!G.flags.dragon_ally && G.trust.wild >= 75],
    ['crown', (G) => G.rank === 5 && G.trust.crown >= 60],
    ['folk', (G) => G.rank === 5 && G.trust.folk >= 85],
    ['keeper', (G) => G.rank === 5],
    ['steady', (G) => G.rank === 4],
    ['quiet', () => true],
];

export function chooseEnding(G) {
    return ENDING_RULES.find(([, ok]) => ok(G))[0];
}

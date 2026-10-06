// Battle AI. Level 0 (wild) picks loosely; 1 (trainer) picks the best-looking technique with some
// noise; 2 (Forgemaster) and 3 (Furnace Four / champion) also set up, heal and switch out of bad
// matchups. The same scoring powers the player-side autopilot in js/sim/pilot.js.

import { MOVES } from './data/moves.js';
import { SPECIES } from './dex.js';
import { ITEMS } from './data/items.js';
import { effAgainst } from './data/types.js';
import { calcStats } from './unit.js';

/** Expected damage fraction of the target's current Hull for a technique (0…). */
export function expectedFrac(b, si, mv) {
    const ti = 1 - si;
    const t = b.act(ti);
    if (!t || t.hp <= 0) return 0;
    const eff = b.effectiveness(mv, t);
    if (eff.absorb || eff.m === 0) return 0;
    const saved = b.rng.st.s;                       // the damage roll must not consume battle randomness
    let { dmg } = b.calcDamage(si, mv, { eff: eff.m, roll: 0.925, noCrit: true });
    b.rng.st.s = saved;
    const multi = mv.fx.find((f) => f.k === 'multi');
    if (multi) dmg *= 3;
    const acc = mv.acc === 0 ? 1 : Math.min(1, mv.acc / 100);
    return (dmg * acc) / t.hp;
}

/** Score every usable technique. Returns [{ i, id, score }]. */
export function scoreMoves(b, si) {
    const u = b.act(si), s = b.side[si];
    const ti = 1 - si, t = b.act(ti), ts = b.side[ti];
    const out = [];
    const myMax = calcStats(u).hp, hpFrac = u.hp / myMax;
    const tFrac = t ? t.hp / calcStats(t).hp : 0;
    const iAmFaster = b.stat(si, 'spe') >= b.stat(ti, 'spe');
    u.moves.forEach((m, i) => {
        if (m.pp <= 0) return;
        const mv = MOVES[m.id];
        let score = 0;
        if (mv.cat !== 'U') {
            const f = expectedFrac(b, si, mv);
            if (f >= 1) score = 120 + (mv.pri > 0 && !iAmFaster ? 40 : 0) + (mv.acc === 0 ? 10 : mv.acc / 10);
            else score = f * 100;
            if (mv.fx.some((x) => x.k === 'recoil')) score *= hpFrac < 0.3 ? 0.6 : 0.9;
            if (mv.fx.some((x) => x.k === 'recharge') && f < 1) score *= 0.6;
            if (mv.fx.some((x) => x.k === 'boom')) score = f >= 1 && b.alive(si).length > 1 ? 60 : hpFrac < 0.2 ? 50 : 5;
            if (mv.fx.some((x) => x.k === 'self' && x.n < 0)) score *= 0.85;
            if (mv.pri > 0 && tFrac < 0.25) score += 15;
        } else {
            for (const f of mv.fx) {
                switch (f.k) {
                    case 'st': score += t && b.canHaveStatus(t, f.s) ? (f.s === 'pdn' ? 45 : f.s === 'shc' ? 38 : f.s === 'cor' ? 32 : 30) * (mv.acc ? mv.acc / 100 : 1) : 0; break;
                    case 'glitch': score += ts.vol.glitch > 0 ? 0 : 22; break;
                    case 'self': score += (s.stages[f.stat] || 0) < 2 && hpFrac > 0.6 ? 18 + 6 * s.ai : 0; break;
                    case 'foe': score += (ts.stages[f.stat] || 0) > -2 ? 14 : 0; break;
                    case 'heal': score += hpFrac < 0.45 ? 70 : hpFrac < 0.7 ? 15 : 0; break;
                    case 'rest': score += hpFrac < 0.35 && !u.st ? 55 : 0; break;
                    case 'protect': score += b.side[si].lastProtect ? 0 : 6; break;
                    case 'atm': {
                        const fav = { heat: 'blaze', rain: 'hydro', static: 'volt', smog: 'toxic', dust: 'grit' }[f.a];
                        score += b.atm && b.atm.k === f.a ? 0 : SPECIES[u.sp].types.includes(fav) ? 30 : 5;
                        break;
                    }
                    case 'shards': score += ts.shards < 3 && b.alive(ti).length > 1 ? 24 : 0; break;
                    case 'siphon': score += ts.vol.siphon || (t && SPECIES[t.sp].types.includes('moss')) ? 0 : 30; break;
                    case 'purge': { const sum = Object.values(ts.stages).reduce((a, x) => a + Math.max(0, x), 0); score += sum >= 2 ? 40 : 0; break; }
                }
            }
            // Setup is only worth it when not about to be knocked out.
            if (hpFrac < 0.4) score *= 0.5;
        }
        out.push({ i, id: m.id, score });
    });
    return out;
}

export function chooseAction(b, si) {
    const s = b.side[si], u = b.act(si);
    const scores = scoreMoves(b, si);
    if (!scores.length) return { k: 'move', i: 0 };            // sputter
    const lvl = s.ai;
    if (lvl === 0) {
        const r = b.rng.next() * scores.reduce((a, x) => a + x.score + 12, 0);
        let acc = 0;
        for (const x of scores) { acc += x.score + 12; if (r <= acc) return { k: 'move', i: x.i }; }
        return { k: 'move', i: scores[0].i };
    }
    // Heal with a carried item (Forgemasters and up).
    const frac = u.hp / calcStats(u).hp;
    if (lvl >= 2 && frac < 0.28 && b.alive(si).length >= 1) {
        const heal = Object.keys(s.items).filter((id) => s.items[id] > 0 && ITEMS[id] && ITEMS[id].heal).sort((a, c) => ITEMS[c].heal - ITEMS[a].heal)[0];
        if (heal && b.rng.chance(0.7)) return { k: 'item', id: heal };
    }
    let best = scores.reduce((a, x) => (x.score > a.score ? x : a), scores[0]);
    // Switch out of a hopeless matchup.
    if (lvl >= 2 && best.score < 22 && frac > 0.35 && s.spent < 2 && b.alive(si).length > 1) {
        const opp = b.act(1 - si);
        let pick = -1, ps = 0;
        s.units.forEach((m, i) => {
            if (i === s.active || m.hp <= 0) return;
            for (const mm of m.moves) {
                const mv = MOVES[mm.id];
                if (mv.cat === 'U') continue;
                const e = effAgainst(mv.type, SPECIES[opp.sp].types) * (SPECIES[m.sp].types.includes(mv.type) ? 1.5 : 1);
                if (e > ps) { ps = e; pick = i; }
            }
        });
        if (pick >= 0 && ps >= 2) { s.spent++; return { k: 'switch', i: pick }; }
    }
    if (lvl === 1 && b.rng.chance(0.2)) {
        const good = scores.filter((x) => x.score >= best.score * 0.6);
        best = good[b.rng.int(0, good.length - 1)];
    }
    return { k: 'move', i: best.i };
}

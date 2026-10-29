// An auto-player. It plays through act(), the same commands the player's taps make, so the tests,
// the balance table and the title screen's attract board all exercise the real rules.
// It only looks one swap ahead and never peeks at the stones that will fall: no better informed
// than a person staring at the board. Pure, like the rest of js/sim.

import { HERO, ENEMIES, STAGES, elemMult } from './data.js';
import { findClears, findMoves, neighbours4, W, Hh } from './board.js';
import { heroStats, summonCost } from './game.js';
import { TOKEN } from '../config.js';

export function makeBot({ skill = 1, seed = 7 } = {}) {
    return { skill, r: seed | 0, losses: {}, grind: 0 };
}

function brnd(bot) {
    let a = (bot.r = (bot.r + 0x6D2B79F5) | 0);
    let t = Math.imul(a ^ (a >>> 15), 1 | a);
    t = (t + Math.imul(t ^ (t >>> 7), 61 | t)) ^ t;
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
}

/**
 * How good is swapping i and j? Plays the clears and the falls that follow from the stones already
 * on the board; the stones that will fall in are unknown, so the gaps they leave stay empty.
 */
export function scoreSwap(B, i, j) {
    const g = B.g.slice();
    [g[i], g[j]] = [g[j], g[i]];
    const ec = B.enemy?.c ?? -1;
    let s = (Math.max(i, j) / g.length) * 3;      // lower on the board leaves more above to cascade
    for (let combo = 1; combo < 12; combo++) {
        const { clear } = findClears(g, combo);
        if (!clear.length) return combo === 1 ? -1 : s;
        const hit = new Set(clear);
        const k1 = 1 + 0.25 * (combo - 1);
        for (const k of clear) {
            const t = g[k];
            if (t.h) s += 400 * HERO[t.h].r;
            else s += ((TOKEN.base + (B.power[t.c] || 0)) * (t.o === 'wild' ? 1 : elemMult(t.c, ec)) + 2) * k1;
            for (const p of B.party) if (HERO[p.id].c === t.c) s += 1.5;
        }
        for (let k = 0; k < g.length; k++) {
            const t = g[k];
            if (!t || hit.has(k) || !neighbours4(k).some((q) => hit.has(q))) continue;
            if (t.o === 'vigil') s += 90;
            if (t.rb) { s += 6; hit.add(k); }
            if (t.fz) s += 4;
        }
        for (const k of hit) g[k] = null;
        for (let x = 0; x < W; x++) {
            let wy = Hh - 1;
            for (let y = Hh - 1; y >= 0; y--) {
                const t = g[y * W + x];
                if (!t) continue;
                if (wy !== y) { g[wy * W + x] = t; g[y * W + x] = null; }
                wy--;
            }
        }
    }
    return s;
}

function wantSkill(B, p) {
    const h = HERO[p.id];
    if (p.charge < h.skill.cost) return false;
    const healOnly = h.skill.fx.every(([k]) => k === 'mend' || k === 'ward');
    if (healOnly) return B.hp < B.maxHp * 0.55;
    if (h.skill.fx.some(([k]) => k === 'mend')) return B.hp < B.maxHp * 0.8 || B.enemy.hp > 200;
    return true;
}

/** The next command for the battle in G.B. */
export function battleCommand(G, bot) {
    const B = G.B;
    for (let k = 0; k < B.party.length; k++) if (wantSkill(B, B.party[k]) && brnd(bot) < 0.5 + bot.skill * 0.5) return { t: 'skill', k };
    const moves = findMoves(B.g);
    if (!moves.length) return null;
    if (brnd(bot) > bot.skill) {
        const [i, j] = moves[Math.floor(brnd(bot) * moves.length)];
        return { t: 'swap', i, j };
    }
    let best = moves[0], bs = -Infinity;
    for (const [i, j] of moves) {
        const s = scoreSwap(B, i, j) + brnd(bot) * 0.5;
        if (s > bs) { bs = s; best = [i, j]; }
    }
    return { t: 'swap', i: best[0], j: best[1] };
}

/** A party of the four strongest heroes, favouring colours that beat the next enemy. */
export function bestParty(G, stage) {
    const foe = ENEMIES[STAGES[stage].waves[0]];
    const val = (id) => {
        const s = heroStats(G, id), h = HERO[id];
        return s.atk * 3 * elemMult(h.c, foe.c) + s.hp * 0.15 + (h.skill.fx.some(([k]) => k === 'mend') ? 8 : 0);
    };
    return Object.keys(G.roster).sort((a, b) => val(b) - val(a)).slice(0, 4);
}

/** Between battles: summon, pick a party, choose a stage. */
export function campCommand(G, bot) {
    if (G.B?.over) return { t: 'leave' };
    if (G.crystals >= summonCost(5) && G.calls.length <= 5) return { t: 'summon', n: 5 };
    if (G.crystals >= summonCost(1) && G.calls.length < 3) return { t: 'summon', n: 1 };
    // the next stage, unless it keeps beating us: then grind the one before
    let stage = G.progress;
    if (bot.grind > 0 && stage > 0) { stage--; bot.grind--; }
    const party = bestParty(G, stage);
    if (party.join() !== G.party.join()) return { t: 'party', ids: party };
    return { t: 'battle', stage };
}

export function botCommand(G, bot) {
    return G.B && !G.B.over ? battleCommand(G, bot) : campCommand(G, bot);
}

/** Note a finished battle so campCommand can grind after repeated losses. */
export function botResult(G, bot) {
    const B = G.B;
    if (!B?.over) return;
    if (B.over !== 'loss') return;
    bot.losses[B.stage] = (bot.losses[B.stage] || 0) + 1;
    if (bot.losses[B.stage] % 2 === 0) bot.grind = 2;     // two losses in a row: level up on the stage before
}

// An auto-player. It plays through the same commands the player uses, so the tests, the balance table
// and the title screen's attract mode all exercise the real rules. Pure, like the rest of js/sim.
//
// A skilled bot follows the PDF's named strategies: it reads the active objectives before merging
// (Objective-First), never pushes past the tier anyone wants (Deliberate Bottleneck), keeps cells in
// reserve (board lock), and composts what nothing needs. A sloppy one (skill < 0.9) merges anything, taps
// at random and only clears the board when it is completely full.

import { makeRng } from '../rng.js';
import { GEN, MAX_TIER } from '../config.js';
import { CHAPTERS } from './data/chapters.js';
import { TABLES } from '../config.js';
import { freeCells, canMerge, servePlan, isOpen, refillCost } from './game.js';

export function makeBot({ skill = 1, seed = 1 } = {}) {
    return { skill, rng: makeRng(seed * 7919 + 13), cool: 0 };
}

/** What the active orders and the current course want: the highest tier per chain, and base items short. */
function demand(G) {
    const need = {}, base = {};
    const want = (c, t, n = 1) => { need[c] = Math.max(need[c] || 0, t); base[c] = (base[c] || 0) + n * 2 ** (t - 1); };
    for (const q of G.guests) if (q) for (const w of q.wants) want(w.c, w.t, w.n);
    const ch = CHAPTERS[G.chapter];
    if (ch) {
        ch.goals.forEach((g, i) => {
            if (g.type === 'make' && !G.goalDone[`${G.chapter}.${i}`] && (G.stats.maxTier[g.c] || 0) < g.t) want(g.c, g.t);
        });
    }
    return { need, base };
}

function pairs(G, ok) {
    const best = [];
    const seen = new Map();
    for (let i = 0; i < G.cells.length; i++) {
        const it = G.cells[i];
        if (!it || it.k !== 'item' || it.t >= MAX_TIER) continue;
        const key = it.c + it.t;
        const list = seen.get(key) || [];
        for (const j of list) if (canMerge(G.cells[j], it) && ok(it)) best.push({ a: j, b: i, t: it.t, c: it.c });
        list.push(i);
        seen.set(key, list);
    }
    return best;
}

export function botAct(G, bot, dt = STEP_DEFAULT) {
    bot.cool -= dt;
    if (bot.cool > 0) return null;
    const smart = bot.skill >= 0.9;
    const pace = 0.5 / bot.skill;
    const rng = bot.rng;
    if (!smart && rng() < (1 - bot.skill) * 0.6) { bot.cool = pace; return null; }
    const cmd = decide(G, bot, smart);
    bot.cool = cmd ? pace : 0.25;
    return cmd;
}
const STEP_DEFAULT = 0.25;

function decide(G, bot, smart) {
    const rng = bot.rng;
    const free = freeCells(G).length;

    // 1. an order that can be served right now
    for (const q of G.guests) if (q && servePlan(G, q)) return { t: 'serve', q: q.id };

    // 2. a bigger table
    const next = TABLES[G.table + 1];
    if (next && G.stars >= next.cost) return { t: 'upgrade' };

    const { need, base } = demand(G);

    // 3. merge: only up to the tier somebody wants (a smart bot), unless space is getting tight
    const crowded = free <= 2;
    const list = pairs(G, (it) => !smart || crowded || it.t + 1 <= (need[it.c] || 0));
    if (list.length) {
        list.sort((x, y) => (smart ? x.t - y.t : 0) || x.a - y.a);
        const m = smart ? list[0] : list[Math.floor(rng() * list.length)];
        return { t: 'move', from: m.a, to: m.b };
    }

    // 4. make more, keeping two cells in reserve
    const gens = [];
    G.cells.forEach((it, i) => { if (it && it.k === 'gen' && it.ch > 0 && isOpen(G, i)) gens.push({ it, i }); });
    if (gens.length && free >= (smart ? 2 : 1)) {
        let pick;
        if (smart) {
            const have = {};
            for (const it of G.cells) if (it && it.k === 'item' && it.t <= (need[it.c] || 0)) have[it.c] = (have[it.c] || 0) + 2 ** (it.t - 1);
            let bestDef = -Infinity;
            for (const g of gens) {
                const deficit = (base[g.it.c] || 0) - (have[g.it.c] || 0);
                if (deficit > bestDef) { bestDef = deficit; pick = g; }
            }
            if (bestDef <= 0 && free < 5) pick = null;   // nothing is short: let the cells breathe
        } else pick = gens[Math.floor(rng() * gens.length)];
        if (pick) return { t: 'tap', cell: pick.i };
    }

    // 5. all full and nothing to merge: compost the least useful item
    if (free === 0 || (smart && free <= 1 && !gens.length)) {
        let worst = -1, ws = Infinity;
        G.cells.forEach((it, i) => {
            if (!it || it.k !== 'item') return;
            const useful = it.t <= (need[it.c] || 0) ? 1 : 0;
            const score = (smart ? useful * 100 : 0) + it.t;
            if (score < ws) { ws = score; worst = i; }
        });
        if (worst >= 0) return { t: 'compost', cell: worst };
    }

    // 6. nothing left to tap: spend coins on a refill if the generators we need are dry
    if (smart && G.coins >= refillCost(G) && free >= 3 && !gens.some((g) => (need[g.it.c] || 0) > 0)) {
        const anyDry = G.cells.some((it) => it && it.k === 'gen' && it.ch < GEN.max / 2);
        if (anyDry) return { t: 'refill' };
    }
    return null;
}

// An auto-player. It plays through act() with the same commands a player has, and reads only what a player
// can see: the danger numbers on open tiles, marked and dowsed blocks, and (with the Lamp of Lumen) monster
// eyes. It never looks inside a block. Pure, like the rest of js/sim.
//
// skill in [0, 1]: the chance it uses what the numbers tell it instead of digging any exposed block it likes.

import { makeRng } from '../rng.js';
import { act, exposed, questDone, canLearn, solveLock, has, maxHp, maxSt, rank } from './game.js';
import { neighbours8, rotMask } from './floor.js';
import { SHOP } from '../config.js';

export function makeBot({ skill = 1, seed = 1 } = {}) {
    return { skill, rng: makeRng(seed * 2654435761 >>> 0) };
}

const WEIGHTS = { pick: 3, stamina: 3, vitality: 2, stone: 2, obsidian: 2, crystal: 2, armor: 1, crit: 1, dowse: 1, forage: 1, greed: 1, shock: 1, glyph: 0.5 };

function chooseSkill(G) {
    let best = null, score = Infinity;
    for (const [id, w] of Object.entries(WEIGHTS)) {
        if (canLearn(G, id) !== true) continue;
        if (id === 'obsidian' && G.n < 8) continue;
        if (id === 'crystal' && G.n < 11) continue;
        const s = (rank(G, id) + 1) / w;
        if (s < score) { score = s; best = id; }
    }
    return best;
}

/** What the numbers prove: a set of blocks that must hold danger, and a set that must be safe. */
export function deduce(G) {
    const F = G.F;
    const D = new Set(), S = new Set();
    F.cells.forEach((c, i) => {
        if (c.k !== 'b') return;
        if (c.seen || c.m) D.add(i);
        if (has(G, 'lamp') && c.c?.d === 'mon') D.add(i);     // the lamp shows sleeping monsters
    });
    let changed = true;
    for (let pass = 0; changed && pass < 20; pass++) {
        changed = false;
        F.cells.forEach((c, i) => {
            if (c.k !== 'o') return;
            const nb = neighbours8(F, i).filter((j) => F.cells[j].k === 'b');
            const unknown = nb.filter((j) => !D.has(j) && !S.has(j));
            if (!unknown.length) return;
            const d = nb.filter((j) => D.has(j)).length;
            if (d === c.n) { unknown.forEach((j) => S.add(j)); changed = true; }
            else if (d + unknown.length === c.n) { unknown.forEach((j) => D.add(j)); changed = true; }
        });
    }
    return { D, S };
}

/** Rough chance that an unproven block holds danger, from the numbers around it. */
function risk(G, i, D, S) {
    const F = G.F;
    let worst = -1;
    for (const j of neighbours8(F, i)) {
        const c = F.cells[j];
        if (c.k !== 'o') continue;
        const nb = neighbours8(F, j).filter((q) => F.cells[q].k === 'b');
        const unknown = nb.filter((q) => !D.has(q) && !S.has(q)).length;
        const d = nb.filter((q) => D.has(q)).length;
        if (unknown) worst = Math.max(worst, (c.n - d) / unknown);
    }
    return worst < 0 ? 0.15 : worst;
}

/** The next command the bot would give, or null if it is stuck (a bug: every floor can be finished). */
export function botCommand(G, bot) {
    if (G.mode === 'ending') return { t: 'continue' };
    const done = G.quests.findIndex((q) => questDone(G, q));
    if (done >= 0) return { t: 'claim', q: done };
    if (G.sp > 0) { const id = chooseSkill(G); if (id) return { t: 'learn', id }; }

    if (G.mode === 'camp') {
        const want = [['potion', 3], ['tonic', 2], ['ward', 1], ['hyper', 1], ['dowse', 1], ['blast', 1]];
        for (const [id, n] of want) {
            const s = SHOP[id];
            if (G.inv[id] >= n) continue;
            if (s.gold && G.gold >= s.gold + 20) return { t: 'buy', id };
            if (s.gems && G.gems >= s.gems) return { t: 'buy', id };
        }
        return { t: 'embark' };
    }

    const F = G.F;
    if (G.hp <= maxHp(G) * 0.4 && G.inv.potion > 0) return { t: 'use', id: 'potion' };

    // fight anything awake, weakest first
    let target = -1, low = Infinity;
    F.cells.forEach((c, i) => { if (c.o?.t === 'mon' && c.o.hp < low) { low = c.o.hp; target = i; } });
    if (target >= 0) {
        if (G.ward === 0 && G.inv.ward > 0 && F.cells[target].o.atk >= 5) return { t: 'use', id: 'ward' };
        return { t: 'dig', i: target };
    }

    // chests
    for (let i = 0; i < F.cells.length; i++) {
        const c = F.cells[i];
        if (c.k === 'o' && c.o?.t === 'chest' && !c.o.open) {
            const seq = solveLock(c.o.lock);
            if (seq?.length) return { t: 'press', i, k: seq[0] };
        }
    }

    // the sun conduit: turn each uncovered channel until it lines up with its neighbours on the path
    if (F.lens >= 0 && has(G, 'lens') && F.cells[F.panel].k === 'b' && F.cells[F.lens].k === 'o'
        && F.pipes.every((p) => F.cells[p].k === 'o')) {
        for (const p of F.pipes) {
            const o = F.cells[p].o;
            if (rotMask(o.m, o.r) !== o.m) return { t: 'rot', i: p };
        }
    }

    if (F.cleared) return { t: 'descend' };
    if (G.st <= 1 && G.inv.tonic > 0) return { t: 'use', id: 'tonic' };

    // runes, in order, as soon as the next one can be reached
    if (F.runeN && F.runeNext <= F.runeN && (!F.hidden || has(G, 'tablet'))) {
        const next = F.cells.findIndex((c) => c.k === 'b' && c.b === 'rune' && c.r === F.runeNext);
        if (next >= 0 && exposed(F, next)) return { t: 'dig', i: next };
    }

    const { D, S } = deduce(G);
    const cands = [];
    F.cells.forEach((c, i) => {
        if (!exposed(F, i)) return;
        if (c.b === 'panel' || c.b === 'rune') return;
        if (c.b === 'door' && G.keys <= 0) return;
        cands.push(i);
    });
    if (!cands.length) return null;

    const careful = bot.rng() < bot.skill;
    if (careful) {
        const unmarked = cands.find((i) => D.has(i) && !F.cells[i].m);
        if (unmarked !== undefined) return { t: 'mark', i: unmarked };
        const marked = cands.find((i) => F.cells[i].m);
        if (marked !== undefined) return { t: 'dig', i: marked };
        // a block already started on first, then the cheapest proven-safe one
        const safe = cands.filter((i) => S.has(i)).sort((a, b) => cost(G, a) - cost(G, b));
        if (safe.length) return { t: 'dig', i: safe[0] };
        const open = cands.filter((i) => !D.has(i)).sort((a, b) => risk(G, a, D, S) - risk(G, b, D, S) || cost(G, a) - cost(G, b));
        if (open.length) return { t: 'dig', i: open[0] };
        return { t: 'dig', i: cands[0] };
    }
    return { t: 'dig', i: cands[Math.floor(bot.rng() * cands.length)] };
}

const cost = (G, i) => { const c = G.F.cells[i]; return c.hp < c.mx ? -1 : c.hp; };

/** Run the bot until it reaches `until` (a predicate), a limit, or gets stuck. Returns { G, steps, stuck }. */
export function runBot(G, bot, until, limit = 200000) {
    let steps = 0;
    while (steps < limit && !until(G)) {
        const cmd = botCommand(G, bot);
        if (!cmd) return { G, steps, stuck: 'no command' };
        const ok = act(G, cmd);
        G.events.length = 0;
        if (!ok) return { G, steps, stuck: `refused ${JSON.stringify(cmd)}` };
        steps++;
    }
    return { G, steps, stuck: steps >= limit ? 'limit' : null };
}

export { maxSt };

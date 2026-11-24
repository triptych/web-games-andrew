// Auto-players for the tests, the balance table and the title-screen demo. They act through the same commands
// a player uses. Pure.
//
// - perfect: follows the solver's tightened line from wherever it is.
// - casual: plays like a person who doesn't plan ahead but remembers where they've been: it prefers a bloom, then
//   a pour onto a matching colour, picks among the rest at random (from its own seeded generator), never walks
//   back into a position it has already seen, undoes out of dead ends, asks a firefly now and then, and
//   restarts when a bloom has sealed it into a corner.

import { makeRng } from '../rng.js';
import { usefulMoves, pour, solve, tighten } from './rules.js';
import { SOLVER_BUDGET } from '../config.js';

export function makeBot({ skill = 'perfect', seed = 1 } = {}) {
    return { skill, rng: makeRng(seed), plan: null, seen: new Set(), stalls: 0 };
}

const keyOf = (tubes, blooms) => blooms + '|' + tubes.map((t) => (t.done ? '#' : t.s)).join(',');

export function botCommand(G, bot) {
    if (G.won) return null;
    if (bot.skill === 'perfect') {
        if (!bot.plan || !bot.plan.length) {
            const r = solve(G.tubes, G.blooms, SOLVER_BUDGET);
            bot.plan = r.path ? tighten(G.tubes, G.blooms, r.path) : null;
            if (!bot.plan) return { t: 'restart' };
        }
        const [from, to] = bot.plan.shift();
        return { t: 'pour', from, to };
    }
    // casual
    bot.seen.add(keyOf(G.tubes, G.blooms));
    const fresh = usefulMoves(G.tubes, G.blooms).filter(([f, t]) => {
        const r = pour(G.tubes, G.blooms, f, t);
        return !bot.seen.has(keyOf(r.tubes, r.blooms));
    });
    if (!fresh.length) {
        bot.stalls++;
        if (G.hist.length) return { t: 'undo' };
        if (!G.sprout && bot.stalls > 2) return { t: 'sprout' };
        if (G.hints > 0 && bot.stalls > 1) return { t: 'hint' };
        bot.seen.clear();
        return { t: 'restart' };
    }
    const blooms = fresh.filter((m) => m[2] >= 40);
    const good = fresh.filter((m) => m[2] >= 10);
    const pick = blooms.length ? blooms[0]
        : good.length && bot.rng() < 0.8 ? good[Math.floor(bot.rng() * good.length)]
            : fresh[Math.floor(bot.rng() * fresh.length)];
    return { t: 'pour', from: pick[0], to: pick[1] };
}

/** Use the last hint event (the casual bot takes the firefly's advice). */
export function followHint(G) {
    for (let i = G.events.length - 1; i >= 0; i--) {
        const e = G.events[i];
        if (e.type === 'hint' && e.from >= 0) return { t: 'pour', from: e.from, to: e.to };
    }
    return null;
}

// Starbase Spooky — an auto-player. It plays through act(), the same commands a child's taps make, so the tests and
// the balance table exercise the real rules. `skill` is the chance it knows an answer; the rest of the time it
// guesses (never the same wrong answer twice, like a child). It solves puzzles with a correct move, and at lower
// skill sometimes taps a wrong piece first. Pure, like the rest of js/sim.

import { makeRng } from '../rng.js';
import { front, objective, act, roomSpots } from './game.js';
import { QUESTION } from './data/questions.js';
import { DEDUCE } from './data/story.js';
import { solveMove } from './puzzles.js';
import { wayTo } from './data/rooms.js';

export function makeBot({ skill = 1, seed = 7, curious = 0, walk = false } = {}) {
    // walk: travel only through the doors at the sides of the rooms, never by the map
    return { skill, curious, walk, rng: makeRng(seed), acts: 0 };
}

/** Where the bot is heading: the room and spot of the current objective (the vent leads into the vents). */
export function target(G) {
    const o = objective(G);
    if (!o) return null;
    if (o.id === 'find' && G.room === 'vents') return { room: 'vents', spot: 'nest' };
    return { room: o.room, spot: o.spot, id: o.id };
}

/** One command for the current state, or null when the bot is waiting (Kit walking, lights playing). */
export function botCommand(G, bot) {
    const f = front(G);
    if (f) {
        if (f.say || f.night) return { t: 'next' };
        if (f.ask || f.ded !== undefined) {
            const q = f.ask ? QUESTION[f.ask] : DEDUCE[f.ded];
            if (bot.rng() < bot.skill) return { t: 'answer', i: q.ok };
            const left = q.a.map((_, i) => i).filter((i) => !G.wrong.includes(i));
            return { t: 'answer', i: left[Math.floor(bot.rng() * left.length)] };
        }
        if (f.puzzle && G.puzzle) {
            const m = solveMove(G.puzzle);
            if (!m) return null;
            if (bot.rng() > 0.5 + bot.skill / 2) return wrongMove(G.puzzle, bot) || { t: 'pick', ...m };
            return { t: 'pick', ...m };
        }
        return null;
    }
    if (G.kit.tx !== null) return null;
    // now and then a curious child taps something that isn't the job
    if (bot.curious && bot.rng() < bot.curious) {
        const spots = roomSpots(G).filter((s) => s.say);
        if (spots.length) return { t: 'tap', spot: spots[Math.floor(bot.rng() * spots.length)].id };
    }
    const tg = target(G);
    if (!tg) return null;
    if (tg.spot === 'notebook') return { t: 'solve' };
    if (tg.room !== G.room) return bot.walk ? { t: 'exit', dir: wayTo(G.room, tg.room) || -1 } : { t: 'go', room: tg.room };
    return { t: 'tap', spot: tg.spot };
}

function wrongMove(p, bot) {
    const r = (n) => Math.floor(bot.rng() * n);
    if (p.kind === 'planets') return { t: 'pick', i: r(p.tray.length) };
    if (p.kind === 'sequence' || p.kind === 'song') return p.show ? null : { t: 'pick', i: r(p.colors) };
    if (p.kind === 'battery') return { t: 'pick', i: r(p.cells.length) };
    if (p.kind === 'wires') return p.sel === null ? null : { t: 'pick', side: 'r', i: r(4) };
    return null;
}

/** Let the bot take one action if it has one; counts what it did. */
export function botAct(G, bot) {
    const c = botCommand(G, bot);
    if (!c) return false;
    const ok = act(G, c);
    if (ok) bot.acts++;
    return ok;
}

// An auto-player. It reads only the game's state and the plan, and plays through the same act()
// the player's taps use, so the tests, the hint system's promise ("there is always a next step")
// and an attract-mode demo all exercise the real rules. Pure, like the rest of js/sim.

import { firstPending } from './plan.js';

/** skill 1 always takes the first choice in the talk; lower skills take them at random. */
export function makeBot({ skill = 1, seed = 7 } = {}) {
    let s = Math.imul(seed ^ 0x9e3779b9, 2654435761) >>> 0;
    const rnd = () => { s = (Math.imul(s, 1664525) + 1013904223) >>> 0; return (s >>> 8) / 16777216; };
    for (let i = 0; i < 4; i++) rnd();           // a weak first output would always pick the first choice
    return { skill, rnd, queue: [], stepId: null, stuck: 0 };
}

/**
 * The next action: an object for act(), { type: 'wait' } (just let time pass), or
 * { type: 'done' } once the story has ended, or { type: 'stuck', step } if a step will not finish.
 */
export function botAct(G, bot) {
    if (G.ending) return { type: 'done' };
    if (G.talk) return { type: 'choose', i: bot.skill >= 1 ? 0 : Math.floor(bot.rnd() * 3) };
    const step = firstPending(G);
    if (!step) return { type: 'wait' };
    if (bot.stepId !== step.id) { bot.stepId = step.id; bot.queue = step.acts(G); bot.stuck = 0; }
    if (!bot.queue.length) {
        if (++bot.stuck > 4) return { type: 'stuck', step: step.id };
        bot.queue = step.acts(G);
    }
    const a = bot.queue.shift() || { type: 'wait' };
    if (a.type === 'wait') bot.stuck = 0;       // waiting for the oven is not being stuck
    return a;
}

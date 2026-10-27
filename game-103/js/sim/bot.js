// The auto-player: the enemy's brain, driving the player's party. `skill` below 1 adds mistakes:
// that fraction of turns it just ends the turn where it stands, so the balance table can show
// how forgiving each chapter is.

import { aiCommand } from './ai.js';

export function makeBot({ skill = 1 } = {}) {
    return { skill, turn: -1, dud: false };
}

/** The next command for the active player unit. `rng` is the caller's own, so the sim's stream is untouched. */
export function botCommand(G, bot, rng) {
    const u = G.B.units.find((o) => o.id === G.B.turn.id);
    if (bot.skill < 1) {
        if (bot.turn !== G.B.turnNo) { bot.turn = G.B.turnNo; bot.dud = rng() > bot.skill; }
        if (bot.dud) return { t: 'wait' };
    }
    return aiCommand(G, u);
}

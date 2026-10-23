// An auto-player. It reads the same choices the player does, so the tests, the balance table and
// the title screen's demo all exercise the real story. Pure, like the rest of js/sim.

import { makeRng } from '../rng.js';
import { choicesFor, choose, useItem, dropItem } from './game.js';
import { HEALTH_MAX, CLARITY_MAX } from '../config.js';

/**
 * goal: signature | edit | fire | leave, the ending it steers for at the Cradle.
 * force: 'pass' | 'fail' | null, decides every check (to test both branches).
 */
export function makeBot({ seed = 1, goal = 'edit', force = null } = {}) {
    return { rng: makeRng(seed), goal, force, seen: {} };
}

const GOAL_CHOICE = { signature: 'sign', edit: 'edit', fire: 'burn', leave: 'walk' };
// what to leave behind first when the pack is full and something better is on offer
const DROP_ORDER = ['mask', 'tabs', 'kit', 'uv', 'stim', 'sequencer', 'torch'];

/** One action: { kind: 'choose', i } | { kind: 'use', id } | { kind: 'drop', id }; or null at an ending. */
export function botAct(G, bot) {
    if (G.over) return null;
    // heal when it matters
    if (G.health <= HEALTH_MAX - 5 && G.inv.includes('stim')) return { kind: 'use', id: 'stim' };
    if (G.clarity <= CLARITY_MAX - 6 && G.inv.includes('tabs')) return { kind: 'use', id: 'tabs' };

    const list = choicesFor(G);
    const open = list.filter((c) => !c.locked);

    // the final choice: steer to the goal
    const goalId = GOAL_CHOICE[bot.goal];
    const atCradle = list.some((c) => c.id === 'sign');
    if (atCradle) {
        const free = open.find((c) => c.id === 'free');
        if (free && (bot.seen.free || 0) < 3) { bot.seen.free = (bot.seen.free || 0) + 1; return { kind: 'choose', i: free.i }; }
        const pick = open.find((c) => c.id === goalId);
        if (pick) return { kind: 'choose', i: pick.i };
    }
    if (G.node === 'cradle_fire') {
        const c = open.find((x) => x.id === (bot.goal === 'fire' ? 'light' : 'lower'));
        if (c) return { kind: 'choose', i: c.i };
    }

    // a full pack blocks a pickup: drop the least useful thing
    if (list.some((c) => c.locked && c.locked.startsWith('PACK FULL'))) {
        const id = DROP_ORDER.find((d) => G.inv.includes(d) && !(bot.goal === 'fire' && d === 'torch'));
        if (id) return { kind: 'drop', id };
    }

    // explore: least-tried non-advancing choices first, then the ones that move the story on
    const key = (c) => `${G.node}:${c.src.t}`;
    const tried = (c) => bot.seen[key(c)] || 0;
    const fresh = open.filter((c) => !c.adv && tried(c) < 3);
    const pool = fresh.length ? fresh : open;
    if (!pool.length) return null;
    const best = Math.min(...pool.map(tried));
    const cands = pool.filter((c) => tried(c) === best);
    const c = cands[Math.floor(bot.rng() * cands.length)];
    bot.seen[key(c)] = tried(c) + 1;
    return { kind: 'choose', i: c.i };
}

/** Apply an action to the game; returns false when it did nothing. */
export function botDo(G, bot, act) {
    if (!act) return false;
    if (act.kind === 'use') return useItem(G, act.id);
    if (act.kind === 'drop') return dropItem(G, act.id);
    return choose(G, act.i, { force: bot.force });
}

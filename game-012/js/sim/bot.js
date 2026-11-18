// The auto-player. It plays only through act(), with the same commands a tap makes, so whatever it can do a
// player can do. Three styles:
//   careful — ten-pulls, stars up every card it can, lets Auto build the line, arms charms for elites, reads wisely
//   casual  — single pulls, Auto, but never stars up or arms charms
//   random  — pulls, then fights with the first four cards it owns, in the order it pulled them
import { act, legal, omenFor, trialOf, canStarUp } from './game.js';
import { PULL_COST, TEN_COST } from '../config.js';
import { ENEMIES } from './data/enemies.js';

const READ_PREF = { wands: 3, swords: 2.6, cups: 2.4, pentacles: 2, major: 3.2 };

/** One command for the bot to play next, or null when the run is over. rng is a () => [0, 1) the caller owns. */
export function botCommand(G, style, rng) {
    switch (G.phase) {
        case 'won': case 'lost': return { t: 'next' };
        case 'reading': {
            if (style === 'random') return { t: 'pick', i: Math.floor(rng() * 3) };
            const cards = G.reading.cards;
            let best = 0;
            cards.forEach((id, i) => { if (score(id) > score(cards[best])) best = i; });
            return { t: 'pick', i: best };
        }
        case 'ending': case 'over': return null;
        default: break;
    }
    // hub
    if (style === 'careful') {
        if (G.dust >= TEN_COST) return { t: 'pull', n: 10 };
        if (G.dust >= PULL_COST) return { t: 'pull', n: 1 };
        for (const id of Object.keys(G.owned)) if (canStarUp(G, id)) return { t: 'starUp', id };
        if (G.items.includes('wheel_token')) return { t: 'arm', item: 'wheel_token' };
        const tough = trialOf(G).foes.some((f) => ENEMIES[f].elite || ENEMIES[f].boss);
        for (const it of G.items) {
            if (G.armed.includes(it)) continue;
            if (it === 'sun_sigil' || tough) return { t: 'arm', item: it };
        }
        if (!G._autoed) { G._autoed = true; return { t: 'auto' }; }
        G._autoed = false;
        return { t: 'fight' };
    }
    if (style === 'casual') {
        if (G.dust >= PULL_COST) return { t: 'pull', n: 1 };
        if (!G._autoed) { G._autoed = true; return { t: 'auto' }; }
        G._autoed = false;
        return { t: 'fight' };
    }
    // random
    if (G.dust >= PULL_COST && rng() < 0.9) return { t: 'pull', n: 1 };
    const order = Object.keys(G.owned);
    for (let s = 0; s < 4; s++) if (G.party[s] !== (order[s] ?? null)) return { t: 'place', slot: s, id: order[s] ?? null };
    return { t: 'fight' };
}

function score(id) {
    const o = omenFor(id);
    // an expected value with the 30% reversal; curses that halve stardust or freeze pity cost the most
    const curseCost = { weakened: 2.2, poisoned: 2.4, slowed: 2, hexed: 2.6, cursed: 1.4 }[o.down.id] || 2;
    const suit = id[0] === 'm' ? 'major' : { w: 'wands', c: 'cups', s: 'swords', p: 'pentacles' }[id[0]];
    return 0.7 * READ_PREF[suit] - 0.3 * curseCost;
}

/** Play a whole run (to the ending, or until the lives run out). Returns the final state and a few tallies. */
export function playRun(G, style, { maxSteps = 5000, rng, onStep } = {}) {
    let steps = 0;
    while (steps++ < maxSteps) {
        const c = botCommand(G, style, rng);
        if (!c) break;
        const ok = act(G, c);
        G.events.length = 0;
        onStep?.(G, c, ok);
        if (!ok && c.t === 'fight') break;
    }
    return { G, steps, won: G.phase === 'ending', trial: G.trial, lives: G.lives };
}

export { legal };

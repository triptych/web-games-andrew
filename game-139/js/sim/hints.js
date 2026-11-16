// Teaching hints: the one pair the tutorial points at. Pure (reads G, never changes it), so the simtest can prove
// every suggestion is a legal command.
//
// Preference: one of your own non-Blade cards with an open rival card (the thing a new player most needs to see),
// an exact 13 before a 12 or 14; then two rival cards that make 13; then a rival King alone.

import { legalMoves, cardInfo } from './game.js';

/** { cmd, kind: 'hand' | 'rival' | 'king', hand?, slots: [ids], sum } or null when there is nothing to pair. */
export function suggestPair(G) {
    const F = G.fight;
    if (!F || G.phase !== 'night') return null;
    const moves = legalMoves(G);
    let best = null, bestScore = -Infinity;
    for (const m of moves) {
        if (m.t === 'pair') {
            const hand = m.a.hand || m.b.hand;
            const slots = [m.a.slot, m.b.slot].filter((x) => x != null);
            if (hand) {
                const ci = cardInfo(F, hand);
                const sum = ci.fx.wild ? 13 : ci.rank + F.slots[slots[0]].rank;
                let score = 100 - Math.abs(sum - 13) * 5;
                if (ci.d.suit === 'blade') score -= 60;               // don't teach the old ways first
                if (ci.fx.wild) score -= 30;
                if (F.slots[slots[0]].taint && ci.d.suit !== 'hearth') score -= 20;
                if (score > bestScore) { bestScore = score; best = { cmd: m, kind: 'hand', hand, slots, sum }; }
            } else {
                const score = 60;
                if (score > bestScore) { bestScore = score; best = { cmd: m, kind: 'rival', slots, sum: 13 }; }
            }
        } else if (m.t === 'solo' && m.slot != null) {
            if (40 > bestScore) { bestScore = 40; best = { cmd: m, kind: 'king', slots: [m.slot], sum: 13 }; }
        }
    }
    return best;
}

/**
 * poker.js — five-card hand evaluation with wilds, and line scoring.
 *
 * Jokers are wild in rank and suit. A "Wild" enchantment makes only the suit
 * wild. Ash cards have no rank and no suit: they never pair, never straight,
 * never flush.
 */

import { HANDS, rankChips } from './rules.js';

/**
 * Evaluate five cards. Returns the key of the best hand in HANDS.
 * Works for fewer than five cards too (used by the bot to read partial lines),
 * but straights/flushes/full houses then require exactly five.
 */
export function evaluate(cards) {
    let jokers = 0, ash = 0;
    const counts = new Map();
    const fixedRanks = [];
    const suits = new Set();
    for (const c of cards) {
        if (c.kind === 'ash') { ash++; continue; }
        if (c.joker) { jokers++; continue; }
        counts.set(c.rank, (counts.get(c.rank) ?? 0) + 1);
        fixedRanks.push(c.rank);
        if (c.ench !== 'wild') suits.add(c.suit);
    }
    const n = cards.length;
    const groups = [...counts.values()].sort((a, b) => b - a);
    const c1 = groups[0] ?? 0, c2 = groups[1] ?? 0;
    const five = n === 5;

    const flush = five && ash === 0 && suits.size <= 1;
    let straight = false, royal = false;
    if (five && ash === 0 && groups.every((g) => g === 1)) {
        for (let lo = 10; lo >= 1; lo--) {
            const hi = lo + 4;
            const ok = fixedRanks.every((r) => (r >= lo && r <= hi) || (r === 14 && lo === 1));
            if (ok) { straight = true; royal = lo === 10; break; }
        }
    }

    const cands = ['high'];
    if (c1 + jokers >= 2) cands.push('pair');
    if (c1 >= 2 && c2 >= 2) cands.push('twoPair');
    if (c1 + jokers >= 3) cands.push('threeKind');
    if (straight) cands.push('straight');
    if (flush) cands.push('flush');
    if (five && ash === 0 && counts.size <= 2) {
        const need = Math.max(0, 3 - c1) + Math.max(0, 2 - c2);
        if (need <= jokers && counts.size >= 1) cands.push('fullHouse');
    }
    if (c1 + jokers >= 4) cands.push('fourKind');
    if (straight && flush) cands.push(royal ? 'royalFlush' : 'straightFlush');
    if (c1 + jokers >= 5 || (jokers === 5)) cands.push('fiveKind');

    let best = 'high';
    for (const k of cands) if (HANDS[k].mult > HANDS[best].mult) best = k;
    return best;
}

/** Which suit a joker's chips go to: the most common fixed suit in the line. */
export function majoritySuit(cards) {
    const tally = { S: 0, C: 0, D: 0, H: 0 };
    for (const c of cards) if (c.kind === 'play' && !c.joker && c.suit) tally[c.suit] += 1 + rankChips(c.rank) / 100;
    let best = 'S';
    for (const s in tally) if (tally[s] > tally[best]) best = s;
    return best;
}

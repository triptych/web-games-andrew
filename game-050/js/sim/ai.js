/**
 * ai.js — how monsters play the board.
 *
 * Spells first (a monster that can afford something useful usually casts it), otherwise
 * every legal move is scored from a cheap first-step preview: skulls by how hard they hit,
 * mana by whether its spells want that colour, coins (stealing your gold), extra turns and
 * specials. `e.sloppy` (0..1, falls with level) adds noise so early monsters blunder.
 */

import { G, MANA, SPELLS } from './data.js';
import { findMoves, previewMove } from './board.js';
import { canCast, skullDamage, spellPower } from './battle.js';

export function chooseMonsterAction(bt) {
    const e = bt.sides.e, p = bt.sides.p, rng = bt.rng;
    // ---- spells
    let best = -1, bestScore = 0;
    e.spells.forEach((sp, i) => {
        if (!canCast(bt, 'e', i)) return;
        const def = SPELLS[sp.id] || sp.def;
        const pw = spellPower(e, def, sp.rank);
        let sc = 18;
        for (const o of def.ops) {
            if (o.op === 'dmg') { sc += o.n * pw; if (o.n * pw >= p.hp + p.shield) sc += 1000; }
            if (o.op === 'heal') sc += e.hp < e.maxHp * 0.65 ? 40 : -30;
            if (o.op === 'shield') sc += e.shield < 6 ? 22 : -10;
            if (o.op === 'drain') sc += MANA.reduce((n, c) => n + Math.min(p.mana[c], o.n), 0) > 6 ? 18 : -10;
            if (o.op === 'stun' || o.op === 'burn' || o.op === 'buff') sc += 15;
        }
        if (sc > bestScore) { bestScore = sc; best = i; }
    });
    if (best >= 0 && bestScore >= 20 && rng.chance(0.88)) return { cast: best };

    // ---- moves
    const moves = findMoves(bt.board);
    const want = {};
    for (const sp of e.spells) {
        const def = SPELLS[sp.id] || sp.def;
        for (const [c, n] of Object.entries(def.cost)) want[c] = (want[c] || 0) + (e.mana[c] < n ? 1 : 0.25);
    }
    const sk = skullDamage(e);
    let bestMove = moves[0], bestVal = -Infinity;
    for (const m of moves) {
        const pv = previewMove(bt.board, m);
        let v = pv.tally[G.SKULL] * sk * 1.1;
        MANA.forEach((c, i) => {
            v += pv.tally[i] * (want[c] ? 1.2 + want[c] * 0.6 : 0.25);
            // denial: taking a colour the hero is close to casting with
            if (pv.tally[i] && p.mana[c] > p.manaCap * 0.5) v += pv.tally[i] * 0.4;
        });
        v += pv.tally[G.COIN] * (e.greedy ? 1.6 : 0.5);
        v += pv.tally[G.STAR] * 0.4;
        if (pv.extra) v += 8;
        if (pv.make) v += 4;
        if (pv.prism) v += 6;
        v += rng.range(0, e.sloppy * 12);
        if (v > bestVal) { bestVal = v; bestMove = m; }
    }
    return { move: bestMove };
}

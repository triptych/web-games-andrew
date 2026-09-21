/**
 * Chains. Absorbing a mote opens a short window; absorbing another inside it
 * raises the multiplier. This is the payoff that makes traps worth building:
 * a knot of opposite-polarity echoes holds motes in orbit until you fly in and
 * harvest the whole cluster in one pass at a rising multiplier.
 */

import { CHAIN_WINDOW, CHAIN_MAX, MOTE_SCORE } from './constants.js';
import { bus, EV } from '../core/bus.js';

export function makeScore() {
    return {
        score: 0,
        chain: 0,
        chainT: 0,
        best: 0,
        absorbed: 0
    };
}

export function scoreAbsorb(sc, kind) {
    sc.chain = Math.min(CHAIN_MAX, sc.chain + 1);
    sc.chainT = CHAIN_WINDOW;
    sc.absorbed++;
    const base = MOTE_SCORE[kind] ?? 10;
    const gained = base * sc.chain;
    sc.score += gained;
    if (sc.chain > sc.best) sc.best = sc.chain;
    bus.emit(EV.CHAIN_UP, { chain: sc.chain, gained });
    return gained;
}

export function updateScore(sc, dt) {
    if (sc.chainT > 0) {
        sc.chainT -= dt;
        if (sc.chainT <= 0 && sc.chain > 0) {
            sc.chain = 0;
            bus.emit(EV.CHAIN_BREAK, null);
        }
    }
}

/** Bonus at the end of a wave: rewards finishing with containment intact. */
export function waveBonus(sc, wave, containment) {
    const bonus = wave * 50 + containment * 100;
    sc.score += bonus;
    return bonus;
}

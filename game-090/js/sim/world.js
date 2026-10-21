// Small shared pieces of the world state that more than one module touches. Pure.

import { calc, partyUnits } from './units.js';
import { tideOf, TIDES } from '../config.js';

/** Restore HP and MP (and, for the field party only if `field`, clear nothing else). */
export function healAll(G, fieldOnly = false) {
    const list = fieldOnly ? partyUnits(G) : [G.agent, ...G.stock];
    for (const u of list) { const c = calc(G, u); u.hp = c.maxhp; u.mp = c.maxmp; }
}

/** Back to Arbor Station: the day ends, the infirmary does its work. */
export function leaveZone(G) {
    G.explore = null;
    G.phase = 'hub';
    G.day++;
    healAll(G);
    G.events.push({ type: 'hub', day: G.day, tide: tideOf(G.day) });
}

export const tideInfo = (G) => TIDES[tideOf(G.day)];

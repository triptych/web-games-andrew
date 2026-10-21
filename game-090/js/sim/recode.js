// Recoding: the Grafter's way of talking a Hex back into a Daemon. A short exchange: the daemon
// shows a mood, you pick a script, it reacts. Each script resonates differently with each
// personality (RAPPORT in data/daemons.js). Reach rapport 3 and it takes the patch.

import { PERSONALITIES, RAPPORT, SCRIPTS } from './data/daemons.js';
import { ITEMS } from './data/items.js';
import { NEED } from '../config.js';

const REACT = {
    2: ['It leans in, the static in its voice smoothing out.', 'Something in it clicks into place.', 'Its glow steadies. It is listening.'],
    1: ['It tilts its head. Not bad.', 'It relaxes a little.', 'The signal softens, just a notch.'],
    0: ['It stares, unmoved.', 'No reaction. Not even static.', 'It waits, as though you had not spoken.'],
    '-1': ['It bristles. That was the wrong note.', 'Its glow sours. It backs away a step.', 'The signal spikes. It did not like that.'],
};
const DEMAND_LINE = {
    item: (n) => `It eyes your pack. "${n}," it signals. "Give me one."`,
    scrap: (n) => `It rattles an empty palm. "${n} Scrap. For the road."`,
    hp: (n) => `It points a claw at you. "A taste of your life. ${n}% of it."`,
    mp: (n) => `It reaches for your ley-light. "${n} MP. Share."`,
};

export const tellOf = (pers) => PERSONALITIES[pers].tell;
export function reactLine(delta, k = 0) { const a = REACT[delta]; return a[Math.abs(k) % a.length]; }
export function demandLine(d) {
    if (d.kind === 'item') return DEMAND_LINE.item(ITEMS[d.id].name);
    return DEMAND_LINE[d.kind](d.n);
}
export const bestScript = (pers) => RAPPORT[pers].indexOf(Math.max(...RAPPORT[pers]));
export const scriptDelta = (pers, i) => RAPPORT[pers][i];
export { NEED, SCRIPTS };

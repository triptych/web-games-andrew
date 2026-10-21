// The Greenhouse's splice table: two races in, one race out. Symmetric. Same race gives the same
// race back, a level up. Special recipes name the two daemons that make one rare daemon.

import { RACES } from './daemons.js';

const R = Object.fromEntries(RACES.map((r, i) => [r, i]));
const PAIRS = {
    'sprite-beast': 'beast', 'sprite-construct': 'wisp', 'sprite-wisp': 'archon', 'sprite-wyrm': 'beast', 'sprite-colossus': 'colossus', 'sprite-archon': 'sprite', 'sprite-revenant': 'wisp',
    'beast-construct': 'colossus', 'beast-wisp': 'sprite', 'beast-wyrm': 'wyrm', 'beast-colossus': 'construct', 'beast-archon': 'wyrm', 'beast-revenant': 'revenant',
    'construct-wisp': 'revenant', 'construct-wyrm': 'colossus', 'construct-colossus': 'archon', 'construct-archon': 'beast', 'construct-revenant': 'beast',
    'wisp-wyrm': 'archon', 'wisp-colossus': 'revenant', 'wisp-archon': 'construct', 'wisp-revenant': 'sprite',
    'wyrm-colossus': 'construct', 'wyrm-archon': 'colossus', 'wyrm-revenant': 'wisp',
    'colossus-archon': 'wyrm', 'colossus-revenant': 'wyrm',
    'archon-revenant': 'wisp',
};

/** The race two parents splice into (null when they are the same race: handled as a level-up). */
export function fuseRace(a, b) {
    if (a === b) return a;
    const key = R[a] < R[b] ? `${a}-${b}` : `${b}-${a}`;
    return PAIRS[key] || null;
}
export const FUSION_PAIRS = PAIRS;

export const RECIPES = [
    { out: 'vorrath', in: ['emberdrake', 'rimewyrm'], note: 'Fire and frost, wound together.' },
    { out: 'seraphprime', in: ['principality', 'matron'], note: 'A ruler and a forgiver.' },
];

/** The cost of a splice in Scrap. */
export const spliceCost = (la, lb) => Math.round(((la + lb) * 0.5) ** 1.5 * 6 + 30);

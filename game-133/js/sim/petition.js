// Petitions: someone walks up to the desk with a problem. Dealt from G.rng out of the Handbook tables, so the
// words on the page always add up to the quest's true rank.

import { FEE, FEE_MULT } from '../config.js';
import { FOES, COUNTS, SITES, OMENS, JOBS, GIVERS, RANK_WEIGHTS, GIVER_WEIGHTS } from './data/quests.js';

export const rankOfThreat = (p) => Math.min(4, Math.floor(p / 2));
const cap = (s) => s[0].toUpperCase() + s.slice(1);
const VERB = { mgt: 'Slay', wit: 'Investigate', arc: 'Ward against', stl: 'Recover from' };

function weighted(rng, weights) {
    let t = weights.reduce((a, b) => a + b, 0) * rng();
    for (let i = 0; i < weights.length; i++) { t -= weights[i]; if (t < 0) return i; }
    return weights.length - 1;
}

export function makePetition(G, chapter) {
    const rng = G.rng;
    const types = ['folk', 'adv', 'crown', 'wild'];
    const tw = types.map((t) => (t === 'crown' && !G.flags.met_ren) || (t === 'wild' && !G.flags.met_moss) ? 0 : GIVER_WEIGHTS[t][chapter]);
    const type = types[weighted(rng, tw)];
    const rank = weighted(rng, RANK_WEIGHTS[chapter]);
    const omenMax = G.day >= 13 ? 2 : 0;
    // pick clues that add up to a threat inside the rank's band
    let tier = 0, cnt = 0, site = 0, omen = 0;
    for (let tries = 0; tries < 200; tries++) {
        tier = rng.int(0, 4); cnt = rng.int(0, 2); site = rng.int(0, 2); omen = rng.int(0, omenMax);
        if (rankOfThreat(tier + cnt + site + omen) === rank) break;
    }
    const trueRank = rankOfThreat(tier + cnt + site + omen);
    const foe = rng.pick(FOES.filter((f) => f.tier === tier));
    const [phrase, plural] = rng.pick(COUNTS[cnt]);
    const where = rng.pick(SITES[site]);
    const kind = rng.pick(['mgt', 'mgt', 'wit', 'arc', 'stl']);
    const face = rng.int(0, GIVERS[type].names.length - 1);
    const giver = GIVERS[type].names[face];
    const creature = plural ? foe.many : foe.one;
    const be = phrase === 'dozens of' ? 'are' : 'is';
    const text = `${rng.pick(GIVERS[type].open)} There ${be} ${phrase} ${creature} ${where}.${rng.pick(OMENS[omen])} ${rng.pick(JOBS[kind])}`;
    return {
        id: G.nid++, type, giver, face, text, kind,
        title: `${VERB[kind]} ${plural ? foe.many : 'the ' + foe.one} ${where}`.replace('in my cellar', 'in a cellar'),
        tier, cnt, site, omen, rank: trueRank, posted: null,
        days: 1 + (trueRank >= 2 ? 1 : 0) + (site === 2 ? 1 : 0),
        roll: 0.9 + rng() * 0.3, fee: 0, expires: 0,
    };
}

export function feeFor(G, q, posted) {
    return Math.round(FEE[posted] * FEE_MULT[q.type] * (1 + 0.1 * G.fac.board) * q.roll);
}

/**
 * Read a petition the way a clerk does: find the creature, the number, the place and the omen in its words,
 * look each up in the Handbook, add them, and halve. Used by the bot and by the test that proves every
 * petition can be graded from its text alone.
 */
export function readPetition(text) {
    let tier = -1, cnt = -1, site = -1, omen = 0;
    for (const f of FOES) if (text.includes(' ' + f.many + ' ') || text.includes(' ' + f.one + ' ')) tier = f.tier;
    COUNTS.forEach((list, i) => { for (const [p] of list) if (text.includes(`There is ${p} `) || text.includes(`There are ${p} `)) cnt = i; });
    SITES.forEach((list, i) => { for (const s of list) if (text.includes(s + '.')) site = i; });
    OMENS.forEach((list, i) => { for (const o of list) if (o && text.includes(o.trim())) omen = i; });
    if (tier < 0 || cnt < 0 || site < 0) return null;
    return { tier, cnt, site, omen, threat: tier + cnt + site + omen, rank: rankOfThreat(tier + cnt + site + omen) };
}
export { cap };

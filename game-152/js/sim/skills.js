// The skill tree's rules: what a set of ranks does to the boat, and buying, refunding and respeccing. Pure.
// `ranks` is a plain object { hull: 2, foil: 1, ... }; missing ids are rank 0.

import { SKILLS, SKILL_IDS } from './data.js';
import { BOAT, JUMP, GUN, MISSILE, FUEL, PICKUP } from '../config.js';

const r = (ranks, id) => Math.max(0, Math.min(nodeOf(id)?.ranks ?? 0, ranks?.[id] | 0));

export function nodeOf(id) {
    for (const b of SKILLS) for (const n of b.nodes) if (n.id === id) return n;
    return null;
}

/** Where a node sits: its branch and its index in that branch. */
export function placeOf(id) {
    for (const b of SKILLS) {
        const i = b.nodes.findIndex((n) => n.id === id);
        if (i >= 0) return { branch: b, i };
    }
    return null;
}

/** The boat's numbers for a set of ranks. Everything the tree changes is read from here by the sim. */
export function statsFor(ranks = {}) {
    return {
        maxHull: BOAT.hull + 20 * r(ranks, 'hull'),
        jumpV: JUMP.v * (1 + 0.15 * r(ranks, 'foil')),
        charges: JUMP.charges + r(ranks, 'charge'),
        shock: r(ranks, 'shock'),
        barrage: r(ranks, 'barrage') > 0,
        barrels: GUN.barrels + r(ranks, 'barrels'),
        dmg: GUN.damage * (1 + 0.2 * r(ranks, 'rounds')),
        pierce: r(ranks, 'pierce'),
        seeker: r(ranks, 'seeker'),
        missiles: MISSILE.ammo + 2 * r(ranks, 'racks'),
        missileRegen: MISSILE.regen * (1 - 0.2 * r(ranks, 'racks')),
        fuelDrain: FUEL.drain * (1 - 0.15 * r(ranks, 'fuel')),
        boostMul: 1 + 0.2 * r(ranks, 'amp'),
        startShield: [0, 2, 4][r(ranks, 'barrier')],
        reach: PICKUP.magnet + [0, 4, 9][r(ranks, 'magnet')],
        jumpRecharge: JUMP.recharge * (1 - 0.25 * r(ranks, 'recharge')),
    };
}

/** Price of the next rank of a node, or null at max rank. */
export function nextCost(ranks, id) {
    const n = nodeOf(id);
    const k = r(ranks, id);
    return n && k < n.ranks ? n.cost[k] : null;
}

/** Why a node can't be bought right now (null if it can). */
export function blocked(ranks, id, cores) {
    const n = nodeOf(id);
    if (!n) return 'unknown';
    if (r(ranks, id) >= n.ranks) return 'max';
    const { branch, i } = placeOf(id);
    if (i > 0 && r(ranks, branch.nodes[i - 1].id) < 1) return 'locked';
    if (cores < nextCost(ranks, id)) return 'cores';
    return null;
}

/** Buy one rank. meta = { cores, ranks }. Returns true if it was bought. */
export function buy(meta, id) {
    if (blocked(meta.ranks, id, meta.cores)) return false;
    meta.cores -= nextCost(meta.ranks, id);
    meta.ranks[id] = r(meta.ranks, id) + 1;
    return true;
}

/** Cores spent on a set of ranks. */
export function spent(ranks) {
    let s = 0;
    for (const id of SKILL_IDS) {
        const n = nodeOf(id);
        for (let k = 0; k < r(ranks, id); k++) s += n.cost[k];
    }
    return s;
}

/** Refund every rank: all the cores come back. */
export function respec(meta) {
    meta.cores += spent(meta.ranks);
    meta.ranks = {};
}

/** Refund the top rank of one node, if nothing below it in the branch depends on it. */
export function refundOne(meta, id) {
    const n = nodeOf(id);
    const k = r(meta.ranks, id);
    if (!n || k < 1) return false;
    const { branch, i } = placeOf(id);
    const below = branch.nodes[i + 1];
    if (k === 1 && below && r(meta.ranks, below.id) > 0) return false;
    meta.ranks[id] = k - 1;
    meta.cores += n.cost[k - 1];
    return true;
}

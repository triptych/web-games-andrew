/**
 * gear.js — Sigilstones: generation, enhancement, reforging, crafting.
 */

import {
    SLOTS, SLOT, GEAR_RARITY, MAIN_BASE, MAIN_GROWTH, SUB_RANGE, SUB_TIER, SUB_STATS, UPGRADE_ODDS,
    MAX_GEAR_LEVEL, SETS, SET_IDS, SLOT_NOUNS, JEWELS, PCT_KEYS, STAT_LABEL,
} from '../data/items.js';

const MAIN_WEIGHTS = { atkP: 3, defP: 2, hpP: 3, cr: 2, cd: 2, spd: 2, res: 1.5, acc: 1.5 };

function rollSub(rng, stat, tier) {
    const [a, b] = SUB_RANGE[stat];
    const v = rng.range(a, b) * SUB_TIER[tier];
    return PCT_KEYS.has(stat) ? +v.toFixed(3) : Math.max(1, Math.round(v));
}

/** opts: { slot?, tier, rarity?, set?, sets? (candidate list) } */
export function generateGear(rng, opts) {
    const slot = opts.slot || rng.pick(SLOTS);
    const tier = Math.max(1, Math.min(6, opts.tier || 1));
    const rarity = opts.rarity || rollRarity(rng, opts.rarityBias || 0);
    const set = opts.set || rng.pick(opts.sets || SET_IDS);
    const mains = SLOT[slot].mains;
    const main = mains.length === 1 ? mains[0] : rng.weighted(mains.map((m) => [m, MAIN_WEIGHTS[m] || 1]));
    const subs = [];
    const n = GEAR_RARITY[rarity].subs;
    const pool = SUB_STATS.filter((s) => s !== main);
    for (const st of rng.sample(pool, n)) subs.push({ s: st, v: rollSub(rng, st, tier), r: 0 });
    return {
        id: 0, slot, tier, rarity, set, main, level: 0, subs,
        name: `${SETS[set].name} ${rng.pick(SLOT_NOUNS[slot])}`, owner: 0, locked: false, isNew: true,
    };
}

/** bias 0 = normal drop odds; each +1 shifts weight toward higher rarity */
export function rollRarity(rng, bias = 0) {
    const w = [0, 46, 30, 16, 6.5, 1.5];
    for (let i = 0; i < bias; i++) {
        w[1] *= 0.55; w[2] *= 0.8; w[3] *= 1.25; w[4] *= 1.6; w[5] *= 1.9;
    }
    return rng.weighted([[1, w[1]], [2, w[2]], [3, w[3]], [4, w[4]], [5, w[5]]]);
}

export function mainValue(g) {
    const base = MAIN_BASE[g.main][g.tier];
    const v = base * (1 + MAIN_GROWTH * g.level);
    return PCT_KEYS.has(g.main) ? +v.toFixed(3) : Math.round(v);
}

export function upgradeCost(g, forgeLevel = 1) {
    const disc = 1 - 0.04 * (forgeLevel - 1);
    return Math.round(Math.pow(g.level + 1, 1.7) * 60 * (1 + g.tier * 0.6) * disc);
}

export function upgradeChance(g, bonus = 0) { return Math.min(1, UPGRADE_ODDS[g.level] + bonus); }

/** Tries one enhancement step; returns { ok, sub? } (gold must be paid by the caller). */
export function upgrade(rng, g, bonus = 0) {
    if (g.level >= MAX_GEAR_LEVEL) return { ok: false, maxed: true };
    if (!rng.chance(upgradeChance(g, bonus))) return { ok: false };
    g.level++;
    let sub = null;
    if (g.level % 3 === 0) {
        if (g.subs.length < 4) {
            const pool = SUB_STATS.filter((s) => s !== g.main && !g.subs.some((x) => x.s === s));
            const st = rng.pick(pool);
            sub = { s: st, v: rollSub(rng, st, g.tier), r: 0 };
            g.subs.push(sub);
            sub = { ...sub, added: true };
        } else {
            const x = rng.pick(g.subs);
            const add = rollSub(rng, x.s, g.tier);
            x.v = PCT_KEYS.has(x.s) ? +(x.v + add).toFixed(3) : x.v + add;
            x.r++;
            sub = { s: x.s, v: add, boosted: true };
        }
    }
    return { ok: true, sub };
}

export function reforgeCost(g) { return { gold: 3000 * g.tier, dust: 20 * g.tier }; }

/** Rerolls one substat (index) into a new random stat at fresh value, keeping enhancement bonuses count. */
export function reforge(rng, g, idx) {
    const old = g.subs[idx];
    if (!old) return null;
    const pool = SUB_STATS.filter((s) => s !== g.main && !g.subs.some((x, j) => j !== idx && x.s === s));
    const st = rng.pick(pool);
    let v = rollSub(rng, st, g.tier);
    for (let i = 0; i < old.r; i++) {
        const add = rollSub(rng, st, g.tier);
        v = PCT_KEYS.has(st) ? +(v + add).toFixed(3) : v + add;
    }
    g.subs[idx] = { s: st, v, r: old.r };
    return g.subs[idx];
}

export function sellValue(g) { return Math.round(150 * g.tier * g.rarity * (1 + g.level * 0.25)); }

/** Craft: tier chosen by ore; jewels steer sets/rarity. */
export function craftCost(tier) {
    const ore = ['copper', 'copper', 'iron', 'silver', 'gold', 'mithril', 'adamant'][tier];
    return { ore, n: 12 + tier * 4, gold: 800 * tier * tier };
}

export function craftGear(rng, tier, jewel, forgeLevel = 1, slot = null) {
    let bias = Math.floor((forgeLevel - 1) / 3);
    let sets = null, minR = 1;
    if (jewel && JEWELS[jewel]) {
        if (JEWELS[jewel].sets) sets = JEWELS[jewel].sets;
        if (jewel === 'topaz') bias += 2;
        if (jewel === 'diamond') { bias += 1; minR = 4; }
    }
    const g = generateGear(rng, { tier, slot: slot || undefined, sets, rarityBias: bias + 1 });
    if (g.rarity < minR) {
        // promote: add subs up to the new rarity
        while (g.subs.length < GEAR_RARITY[minR].subs) {
            const pool = SUB_STATS.filter((s) => s !== g.main && !g.subs.some((x) => x.s === s));
            const st = rng.pick(pool);
            g.subs.push({ s: st, v: rollSub(rng, st, tier), r: 0 });
        }
        g.rarity = minR;
    }
    return g;
}

export function statText(stat, v) {
    const label = STAT_LABEL[stat];
    if (PCT_KEYS.has(stat)) return `${label} +${(v * 100).toFixed(v < 0.1 ? 1 : 0)}%`;
    return `${label} +${v}`;
}

/** A rough desirability score for auto-equip suggestions. */
export function gearScore(g) {
    const w = { atk: 0.5, def: 0.4, hp: 0.03, atkP: 5, defP: 4, hpP: 4, spd: 1.5, cr: 6, cd: 4, res: 2.5, acc: 2.5 };
    let s = mainValue(g) * (w[g.main] || 1);
    for (const x of g.subs) s += x.v * (w[x.s] || 1);
    return s * (1 + g.tier * 0.15);
}

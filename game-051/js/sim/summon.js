/**
 * summon.js — the Summoning Circle: sigil odds, pity, featured pairs.
 */

import { weekKey } from '../core/time.js';
import { Rng } from '../core/rng.js';
import { CLASS_IDS } from '../data/classes.js';
import { ELEMENTS } from '../data/core.js';
import { generateHero } from './heroes.js';
import { addHero, bump, rngOf, spend, canAfford } from './state.js';

export const SIGILS = {
    common: { name: 'Common Sigil',  odds: [[1, 55], [2, 35], [3, 9], [4, 0.9], [5, 0.1]], els: ['fire', 'water', 'wind'], pity: false, color: '#9aa8b8', desc: 'Mostly 1–2★ heroes. Fodder for evolution, and the odd surprise.' },
    mystic: { name: 'Mystic Sigil',  odds: [[3, 87], [4, 11], [5, 2]], els: null, pity: true, color: '#6ad0ff', desc: '3★ or better. Rarely Light or Dark. Pity: guaranteed 5★ by 90.' },
    fire:   { name: 'Fire Sigil',    odds: [[3, 87], [4, 11], [5, 2]], els: ['fire'], pity: true, color: '#ff6a3d', desc: 'A Mystic summon locked to Fire.' },
    water:  { name: 'Water Sigil',   odds: [[3, 87], [4, 11], [5, 2]], els: ['water'], pity: true, color: '#3da5ff', desc: 'A Mystic summon locked to Water.' },
    wind:   { name: 'Wind Sigil',    odds: [[3, 87], [4, 11], [5, 2]], els: ['wind'], pity: true, color: '#4fd36a', desc: 'A Mystic summon locked to Wind.' },
    ld:     { name: 'Light & Dark Sigil', odds: [[3, 80], [4, 17], [5, 3]], els: ['light', 'dark'], pity: true, color: '#c89aff', desc: 'Only Light or Dark heroes, with better odds.' },
    legend: { name: 'Legendary Sigil', odds: [[5, 100]], els: null, pity: false, color: '#ffc94a', desc: 'A guaranteed 5★ hero of any element.' },
};
export const SIGIL_IDS = Object.keys(SIGILS);
export const SOFT_PITY = 60;
export const HARD_PITY = 90;
export const SHARDS_PER_SIGIL = 50;
export const GEMS_PER_MYSTIC = 90;
export const GEMS_PER_TEN = 800;

/** This week's featured element + class (same for everyone with the same clock). */
export function featured(t) {
    const r = new Rng(0xfeed ^ weekKey(t));
    return { el: r.pick(['fire', 'water', 'wind', 'light', 'dark']), cls: r.pick(CLASS_IDS) };
}

const MYSTIC_ELS = [['fire', 31], ['water', 31], ['wind', 31], ['light', 3.5], ['dark', 3.5]];

function rollRarity(rng, sigil, pity) {
    const def = SIGILS[sigil];
    if (!def.pity) return rng.weighted(def.odds);
    if (pity + 1 >= HARD_PITY) return 5;
    const odds = def.odds.map(([r, w]) => [r, w]);
    if (pity + 1 > SOFT_PITY) {
        const boost = (pity + 1 - SOFT_PITY) * 2.5;
        const five = odds.find((o) => o[0] === 5);
        five[1] += boost;
        odds.find((o) => o[0] === 3)[1] = Math.max(0, odds.find((o) => o[0] === 3)[1] - boost);
    }
    return rng.weighted(odds);
}

/**
 * Performs `count` summons of `sigil`, paying with sigils (or gems if
 * payWith === 'gems'). Returns the new heroes, or null if unaffordable.
 */
export function summon(S, sigil, count = 1, payWith = 'sigil') {
    const def = SIGILS[sigil];
    if (!def) return null;
    let cost;
    if (payWith === 'gems') {
        if (sigil !== 'mystic') return null;
        cost = { gems: count >= 10 ? GEMS_PER_TEN : GEMS_PER_MYSTIC * count };
    } else cost = { sigils: { [sigil]: count } };
    if (!spend(S, cost)) return null;

    const rng = rngOf(S);
    const feat = featured();
    const out = [];
    for (let i = 0; i < count; i++) {
        let rarity = rollRarity(rng, sigil, S.summon.pity);
        // the very first Mystic summon is a guaranteed 4★ to get the player going
        if (S.summon.first && def.pity) { rarity = Math.max(rarity, 4); S.summon.first = false; }
        // ten-pull floor: at least one 4★
        if (count >= 10 && i === count - 1 && def.pity && !out.some((h) => h.nat >= 4)) rarity = Math.max(rarity, 4);
        let element = def.els ? rng.pick(def.els) : sigil === 'legend' ? rng.pick(ELEMENTS) : rng.weighted(MYSTIC_ELS);
        let cls;
        if (sigil === 'mystic' && rarity >= 4 && rng.chance(0.5)) { element = feat.el; cls = feat.cls; }
        if (def.pity) S.summon.pity = rarity >= 5 ? 0 : S.summon.pity + 1;
        const hero = generateHero({ seed: rng.seed(), rarity, element, cls });
        addHero(S, hero);
        out.push(hero);
        bump(S, 'summons');
        if (hero.nat >= 5) bump(S, 'fiveStars');
        if (hero.radiant) bump(S, 'radiants');
    }
    S.summon.total += count;
    return out;
}

export function canSummon(S, sigil, count, payWith) {
    if (payWith === 'gems') return canAfford(S, { gems: count >= 10 ? GEMS_PER_TEN : GEMS_PER_MYSTIC * count });
    return (S.res.sigils[sigil] || 0) >= count;
}

export function craftSigil(S) {
    if (S.res.shards < SHARDS_PER_SIGIL) return false;
    S.res.shards -= SHARDS_PER_SIGIL;
    S.res.sigils.mystic++;
    return true;
}

/** Display odds including current soft-pity boost. */
export function currentFiveRate(S, sigil) {
    const def = SIGILS[sigil];
    const base = def.odds.find((o) => o[0] === 5)?.[1] || 0;
    if (!def.pity) return base / 100;
    const p = S.summon.pity + 1;
    if (p >= HARD_PITY) return 1;
    return (base + Math.max(0, p - SOFT_PITY) * 2.5) / 100;
}

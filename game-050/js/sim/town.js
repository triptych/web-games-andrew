/**
 * town.js — buildings, real-time production into baskets, and the costs of everything
 * the town can make (building, upgrading, crafting, brewing, spell ranks).
 *
 * Producers fill a basket at `rate(level) × multipliers` per minute up to `capHours` of
 * production; the player collects baskets into stock. tickTown(profile, now) advances
 * every basket to `now` — the same function handles a 200 ms frame and an 8-hour absence.
 */

import { bookMult, bookCount } from './books.js';
import { POTIONS, MAX_RANK } from './data.js';

export const PLOTS = 13;

export const BUILDINGS = {
    lumber:     { name: 'Lumber Camp',   icon: '🪓', res: 'wood',    rate: 6,   unlock: { level: 1 }, cost: { gold: 30 },                          up: { gold: 40, wood: 30 },               desc: 'Cheerful woodcutters. Produces wood.' },
    market:     { name: 'Market',        icon: '🏪', res: 'gold',    rate: 4,   unlock: { level: 2 }, cost: { wood: 50 },                          up: { gold: 40, wood: 60 },               desc: 'Stalls, awnings, a man who sells only spoons. Produces gold.' },
    quarry:     { name: 'Quarry',        icon: '⛏️', res: 'stone',   rate: 5,   unlock: { level: 3 }, cost: { gold: 60, wood: 70 },                up: { gold: 60, wood: 60 },               desc: 'Sings while it digs. Produces stone.' },
    guild:      { name: 'Guild Hall',    icon: '📜', res: null,              unlock: { level: 4 }, cost: { gold: 90, wood: 90, stone: 50 },     up: { gold: 120, wood: 80, stone: 80 },   desc: '+1 quest slot per level and richer quest rewards.' },
    herbs:      { name: 'Herb Garden',   icon: '🌿', res: 'herbs',   rate: 4,   unlock: { book: 'almanac' }, cost: { gold: 60, wood: 70 },      up: { gold: 70, wood: 70, stone: 30 },    desc: 'Rows of happy herbs. Produces herbs for potions.' },
    forge:      { name: 'Forge',         icon: '⚒️', res: null,              unlock: { book: 'ember' }, cost: { gold: 160, wood: 120, stone: 140 }, up: { gold: 160, wood: 90, stone: 120 }, desc: 'Craft gear. Higher levels forge stronger, rarer items.' },
    training:   { name: 'Training Yard', icon: '🎯', res: 'xp',      rate: 0.25,  unlock: { level: 7 }, cost: { gold: 140, wood: 150, stone: 100 },  up: { gold: 140, wood: 110, stone: 110 }, desc: 'Practice dummies that practise back. Produces XP.' },
    alchemist:  { name: 'Alchemist',     icon: '⚗️', res: null,              unlock: { book: 'tides' }, cost: { gold: 200, wood: 150, stone: 150, herbs: 60 }, up: { gold: 160, stone: 120, herbs: 60 }, desc: 'Brew potions. Each level unlocks a recipe and more to carry.' },
    storehouse: { name: 'Storehouse',    icon: '🏚️', res: null,              unlock: { level: 9 }, cost: { gold: 150, wood: 220, stone: 200 },  up: { gold: 150, wood: 160, stone: 160 }, desc: 'Every level lets buildings store 1 more hour of production.' },
    crystal:    { name: 'Crystal Mine',  icon: '💎', res: 'crystal', rate: 2.5, unlock: { level: 11 }, cost: { gold: 260, wood: 250, stone: 300 }, up: { gold: 200, wood: 160, stone: 220 }, desc: 'Glittering tunnels. Produces crystal.' },
    magetower:  { name: 'Mage Tower',    icon: '🗼', res: null,              unlock: { book: 'thunder' }, cost: { gold: 400, stone: 400, crystal: 80 }, up: { gold: 300, stone: 260, crystal: 60 }, desc: 'Rank up spells. Each level raises the highest rank by one.' },
    scriptorium:{ name: 'Scriptorium',   icon: '🖋️', res: 'ink',     rate: 1.6, unlock: { level: 14 }, cost: { gold: 500, wood: 400, stone: 300, crystal: 60 }, up: { gold: 300, wood: 220, stone: 200, crystal: 40 }, desc: 'Monks of the quill. Produces ink; study books for stronger bonuses.' },
    clocktower: { name: 'Clocktower',    icon: '🕰️', res: null,              unlock: { book: 'clock' }, cost: { gold: 800, wood: 600, stone: 700, crystal: 150 }, up: { gold: 500, wood: 400, stone: 450, crystal: 90 }, desc: '+8% production from every building per level.' },
};
export const BUILDING_IDS = Object.keys(BUILDINGS);
export const BASE_CAP_HOURS = 2;

export function levelCap(profile) { return Math.min(12, 3 + bookCount(profile)); }

export function isUnlocked(profile, id) {
    const u = BUILDINGS[id].unlock;
    if (u.level && profile.level < u.level) return false;
    if (u.book && !profile.books[u.book]) return false;
    return true;
}

export function bLevel(profile, id) { return profile.town[id]?.level || 0; }

const scale = (obj, f) => Object.fromEntries(Object.entries(obj).map(([k, v]) => [k, Math.round(v * f)]));

/** Cost to build (level 0 → 1) or upgrade (L → L+1). */
export function buildCost(profile, id) {
    const L = bLevel(profile, id);
    const def = BUILDINGS[id];
    return L === 0 ? { ...def.cost } : scale(def.up, Math.pow(1.62, L - 1));
}

export function prodMult(profile) {
    return 1 + 0.08 * bLevel(profile, 'clocktower') + 0.1 * bookMult(profile, 'clock');
}

/** Production per minute at the building's current level. */
export function rate(profile, id) {
    const def = BUILDINGS[id];
    const L = bLevel(profile, id);
    if (!def.res || !L) return 0;
    let r = def.rate * L * (1 + 0.12 * (L - 1)) * prodMult(profile);
    if (id === 'training') r *= 1 + profile.level * 0.12;
    if (id === 'market') r *= 1 + 0.25 * bookMult(profile, 'ledger');
    return r;
}

export function capHours(profile) {
    return BASE_CAP_HOURS + bLevel(profile, 'storehouse') + 4 * bookMult(profile, 'atlas');
}
export function capacity(profile, id) { return rate(profile, id) * capHours(profile) * 60; }

export function tickTown(profile, now) {
    for (const id of BUILDING_IDS) {
        const b = profile.town[id];
        if (!b || !BUILDINGS[id].res) continue;
        const dtMin = Math.max(0, (now - (b.t || now)) / 60000);
        b.basket = Math.min(capacity(profile, id), (b.basket || 0) + rate(profile, id) * dtMin);
        b.t = now;
    }
}

export function canAfford(profile, cost) {
    for (const [k, v] of Object.entries(cost)) if ((profile.res[k] || 0) < v) return false;
    return true;
}
export function pay(profile, cost) {
    for (const [k, v] of Object.entries(cost)) profile.res[k] -= v;
}

// ------------------------------------------------------------------ Workshops

export function questSlots(profile) { return 2 + bLevel(profile, 'guild'); }
export function carryLimit(profile) { return 3 + Math.floor(bLevel(profile, 'alchemist') / 3); }
export function maxSpellRank(profile) { return Math.min(MAX_RANK, 1 + bLevel(profile, 'magetower')); }

export function forgeCost(profile) {
    const iL = forgeItemLevel(profile);
    return { gold: 40 + iL * 14, wood: 20 + iL * 7, stone: 25 + iL * 8, ...(bLevel(profile, 'forge') >= 4 ? { crystal: 5 + iL } : {}) };
}
export function forgeItemLevel(profile) { return Math.max(1, profile.level + Math.floor(bLevel(profile, 'forge') / 2)); }
export function forgeLuck(profile) { return 0.2 + 0.12 * bLevel(profile, 'forge'); }

export function potionUnlocked(profile, id) { return bLevel(profile, 'alchemist') >= POTIONS[id].alch; }

export function rankCost(rank) {
    // cost to go from `rank` to rank + 1
    return { gold: 120 * rank * rank, crystal: 20 * rank + 10 * rank * rank, ...(rank >= 3 ? { ink: 25 * (rank - 2) } : {}) };
}

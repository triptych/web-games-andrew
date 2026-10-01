/**
 * shop.js — the Market (daily rotating stock + fixed counters) and the
 * Fortune Wheel.
 */

import { dayKey } from '../core/time.js';
import { ELEMENTS } from '../data/core.js';
import { CROP_IDS, JEWEL_IDS } from '../data/items.js';
import { generateGear } from './gear.js';
import { generateHero } from './heroes.js';
import { grant, spend, bump, rngOf } from './state.js';

function gearTier(S) { return Math.min(6, 1 + Math.floor(S.campaign.cleared / 9)); }

function makeOffer(S, rng) {
    const kind = rng.weighted([['hero3', 12], ['hero4', 4], ['gear', 18], ['seeds', 12], ['mystic', 6], ['ess', 10], ['elixir', 12], ['tome', 6], ['ore', 10], ['jewel', 8], ['pack', 6]]);
    const tier = gearTier(S);
    switch (kind) {
        case 'hero3': return { kind: 'hero', seed: rng.seed(), rarity: 3, price: { gold: 25000 } };
        case 'hero4': return { kind: 'hero', seed: rng.seed(), rarity: 4, price: { gems: 350 } };
        case 'gear': return { kind: 'gear', gear: generateGear(rng, { tier, rarityBias: 2 }), price: rng.chance(0.7) ? { gold: 4000 * tier } : { gems: 40 + tier * 10 } };
        case 'seeds': { const c = rng.pick(CROP_IDS); return { kind: 'bundle', label: `${c[0].toUpperCase() + c.slice(1)} Seeds ×4`, give: { seeds: { [c]: 4 } }, price: { gold: 300 * (CROP_IDS.indexOf(c) + 1) * 3 } }; }
        case 'mystic': return { kind: 'bundle', label: 'Mystic Sigil', give: { sigils: { mystic: 1 } }, price: { gems: 70 } };
        case 'ess': { const el = rng.pick(ELEMENTS); return { kind: 'bundle', label: `${el[0].toUpperCase() + el.slice(1)} Essences`, give: { essences: { [el]: { lo: 8, mid: 3 } } }, price: { gold: 9000 } }; }
        case 'elixir': return rng.chance(0.3) ? { kind: 'bundle', label: 'XP Elixir (L)', give: { items: { xpL: 1 } }, price: { gold: 22000 } } : { kind: 'bundle', label: 'XP Elixir (M) ×2', give: { items: { xpM: 2 } }, price: { gold: 7000 } };
        case 'tome': return { kind: 'bundle', label: 'Skill Tome', give: { tomes: 1 }, price: { gems: 60 } };
        case 'ore': { const o = ['copper', 'iron', 'silver', 'gold', 'mithril', 'adamant'][Math.min(5, tier - 1)]; return { kind: 'bundle', label: `${o[0].toUpperCase() + o.slice(1)} ×15`, give: { ores: { [o]: 15 } }, price: { gold: 2500 * tier } }; }
        case 'jewel': { const j = rng.pick(JEWEL_IDS.slice(0, 5)); return { kind: 'bundle', label: `${j[0].toUpperCase() + j.slice(1)} ×2`, give: { jewels: { [j]: 2 } }, price: { gold: 6000 } }; }
        case 'pack': return { kind: 'bundle', label: 'Seed Pack ×2', give: { items: { seedPack: 2 } }, price: { gold: 3000 } };
        default: return null;
    }
}

export function ensureShop(S, force = false) {
    const d = dayKey();
    if (!force && S.shop.day === d && S.shop.stock.length) return S.shop.stock;
    const rng = rngOf(S);
    if (S.shop.day !== d) S.shop.refreshes = 0;
    S.shop.day = d;
    S.shop.stock = Array.from({ length: 6 }, () => ({ ...makeOffer(S, rng), sold: false }));
    return S.shop.stock;
}

export function refreshCost(S) { return 20 + 20 * S.shop.refreshes; }

export function refreshShop(S) {
    if (!spend(S, { gems: refreshCost(S) })) return false;
    S.shop.refreshes++;
    ensureShop(S, true);
    return true;
}

export function offerHero(o) { return generateHero({ seed: o.seed, rarity: o.rarity }); }

export function buyOffer(S, i) {
    const o = S.shop.stock[i];
    if (!o || o.sold || !spend(S, o.price)) return null;
    o.sold = true;
    bump(S, 'purchases');
    if (o.kind === 'hero') return grant(S, { heroes: [offerHero(o)] });
    if (o.kind === 'gear') return grant(S, { gear: [{ ...o.gear }] });
    return grant(S, o.give);
}

export const COUNTERS = {
    gems: [
        { label: 'Stamina +60', give: { stamina: 60 }, price: { gems: 30 } },
        { label: 'Common Sigil ×10', give: { sigils: { common: 10 } }, price: { gems: 100 } },
        { label: 'Seed Pack ×3', give: { items: { seedPack: 3 } }, price: { gems: 40 } },
        { label: 'Mystery Chest', give: { items: { chest: 1 } }, price: { gems: 60 } },
        { label: 'Gold ×25,000', give: { gold: 25000 }, price: { gems: 80 } },
    ],
    arena: [
        { label: 'Mystic Sigil', give: { sigils: { mystic: 1 } }, price: { arenaTokens: 120 } },
        { label: 'Skill Tome', give: { tomes: 1 }, price: { arenaTokens: 80 } },
        { label: 'XP Elixir (L)', give: { items: { xpL: 1 } }, price: { arenaTokens: 60 } },
        { label: 'Diamond', give: { jewels: { diamond: 1 } }, price: { arenaTokens: 150 } },
        { label: 'Light & Dark Sigil', give: { sigils: { ld: 1 } }, price: { arenaTokens: 600 } },
    ],
    spire: [
        { label: 'Mystic Sigil', give: { sigils: { mystic: 1 } }, price: { spireTokens: 100 } },
        { label: 'Skill Tome', give: { tomes: 1 }, price: { spireTokens: 80 } },
        { label: 'Exalted Essences', give: { essences: { fire: { hi: 1 }, water: { hi: 1 }, wind: { hi: 1 }, light: { hi: 1 }, dark: { hi: 1 } } }, price: { spireTokens: 300 } },
        { label: 'Light & Dark Sigil', give: { sigils: { ld: 1 } }, price: { spireTokens: 500 } },
        { label: 'Legendary Sigil', give: { sigils: { legend: 1 } }, price: { spireTokens: 2000 } },
    ],
    dust: [
        { label: 'Common Sigil ×5', give: { sigils: { common: 5 } }, price: { dust: 60 } },
        { label: 'Skill Tome', give: { tomes: 1 }, price: { dust: 150 } },
        { label: 'Sigil Shards ×10', give: { shards: 10 }, price: { dust: 120 } },
        { label: 'Mystic Sigil', give: { sigils: { mystic: 1 } }, price: { dust: 400 } },
    ],
};

export function buyCounter(S, tab, i) {
    const o = COUNTERS[tab] && COUNTERS[tab][i];
    if (!o || !spend(S, o.price)) return null;
    bump(S, 'purchases');
    return grant(S, o.give);
}

// ---------------------------------------------------------------- fortune wheel

export const WHEEL = [
    { label: '5,000 Gold', give: { gold: 5000 }, w: 26, color: '#ffcf4a' },
    { label: '25 Gems', give: { gems: 25 }, w: 18, color: '#6ad0ff' },
    { label: 'XP Elixir (M)', give: { items: { xpM: 1 } }, w: 15, color: '#7b9cff' },
    { label: 'Seed Pack', give: { items: { seedPack: 1 } }, w: 12, color: '#8ad64a' },
    { label: 'Mystic Sigil', give: { sigils: { mystic: 1 } }, w: 9, color: '#53b4ff' },
    { label: 'Essences', give: { essences: { fire: { lo: 3 }, water: { lo: 3 }, wind: { lo: 3 }, light: { lo: 2 }, dark: { lo: 2 } } }, w: 10, color: '#c879ff' },
    { label: 'Skill Tome', give: { tomes: 1 }, w: 7, color: '#ffd24a' },
    { label: 'JACKPOT', give: { sigils: { legend: 1 }, gems: 100 }, w: 1.5, color: '#ff5d8f' },
];
export const WHEEL_COST = 50;

export function freeSpinAvailable(S) { return S.wheel.day !== dayKey(); }

/** Returns { index, items } or null. */
export function spinWheel(S) {
    const free = freeSpinAvailable(S);
    if (!free && !spend(S, { gems: WHEEL_COST })) return null;
    if (free) S.wheel.day = dayKey();
    const rng = rngOf(S);
    const index = rng.weighted(WHEEL.map((s, i) => [i, s.w]));
    bump(S, 'wheelSpins');
    if (index === WHEEL.length - 1) bump(S, 'jackpots');
    return { index, items: grant(S, WHEEL[index].give) };
}

// ---------------------------------------------------------------- mystery chest

export function openChest(S) {
    if ((S.res.items.chest || 0) < 1) return null;
    S.res.items.chest--;
    const rng = rngOf(S);
    const tier = rng.weighted([['common', 55], ['rare', 30], ['epic', 12], ['legend', 3]]);
    let b;
    if (tier === 'common') b = rng.pick([{ gold: 6000 }, { items: { xpM: 2 } }, { shards: 8 }, { items: { seedPack: 2 } }]);
    else if (tier === 'rare') b = rng.pick([{ gems: 60 }, { sigils: { mystic: 1 } }, { tomes: 1 }, { gear: [generateGear(rng, { tier: gearTier(S), rarityBias: 3 })] }]);
    else if (tier === 'epic') b = rng.pick([{ sigils: { mystic: 3 } }, { gems: 200 }, { items: { xpL: 3 } }, { jewels: { diamond: 2 } }]);
    else b = rng.pick([{ sigils: { legend: 1 } }, { sigils: { ld: 2 } }]);
    return { tier, items: grant(S, b) };
}

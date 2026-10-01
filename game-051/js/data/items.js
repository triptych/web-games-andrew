/**
 * items.js — gear (Sigilstones), materials, crops, recipes, consumables.
 */

export const SLOTS = ['weapon', 'helm', 'armor', 'gloves', 'boots', 'amulet'];
export const SLOT = {
    weapon: { name: 'Weapon', icon: 'sword',  mains: ['atk'] },
    helm:   { name: 'Helm',   icon: 'helm',   mains: ['hp'] },
    armor:  { name: 'Armor',  icon: 'armor',  mains: ['def'] },
    gloves: { name: 'Gloves', icon: 'gloves', mains: ['atkP', 'defP', 'hpP', 'cr', 'cd'] },
    boots:  { name: 'Boots',  icon: 'boots',  mains: ['atkP', 'defP', 'hpP', 'spd'] },
    amulet: { name: 'Amulet', icon: 'amulet', mains: ['atkP', 'defP', 'hpP', 'res', 'acc'] },
};

export const GEAR_RARITY = [
    null,
    { name: 'Common', color: '#c4ccd6', subs: 0 },
    { name: 'Magic', color: '#6ee07a', subs: 1 },
    { name: 'Rare', color: '#53b4ff', subs: 2 },
    { name: 'Epic', color: '#c879ff', subs: 3 },
    { name: 'Legendary', color: '#ffc94a', subs: 4 },
];

/** main stat value at +0 by tier (1–6); grows ×(1 + 0.27·level) */
export const MAIN_BASE = {
    atk: [0, 6, 9, 13, 18, 24, 32],
    def: [0, 6, 9, 13, 18, 24, 32],
    hp: [0, 90, 135, 200, 280, 370, 480],
    atkP: [0, 0.02, 0.03, 0.04, 0.05, 0.06, 0.08],
    defP: [0, 0.02, 0.03, 0.04, 0.05, 0.06, 0.08],
    hpP: [0, 0.02, 0.03, 0.04, 0.05, 0.06, 0.08],
    cr: [0, 0.01, 0.015, 0.02, 0.025, 0.03, 0.04],
    cd: [0, 0.02, 0.03, 0.04, 0.05, 0.06, 0.07],
    spd: [0, 1, 2, 3, 4, 5, 7],
    res: [0, 0.02, 0.03, 0.04, 0.05, 0.06, 0.08],
    acc: [0, 0.02, 0.03, 0.04, 0.05, 0.06, 0.08],
};
export const MAIN_GROWTH = 0.27;

/** substat roll ranges at tier 4; other tiers scale by SUB_TIER */
export const SUB_RANGE = {
    hp: [60, 140], atk: [5, 12], def: [5, 12],
    hpP: [0.03, 0.07], atkP: [0.03, 0.07], defP: [0.03, 0.07],
    spd: [2, 5], cr: [0.02, 0.05], cd: [0.03, 0.07], res: [0.03, 0.07], acc: [0.03, 0.07],
};
export const SUB_TIER = [0, 0.5, 0.65, 0.8, 1.0, 1.15, 1.3];
export const SUB_STATS = Object.keys(SUB_RANGE);
export const STAT_LABEL = {
    hp: 'HP', atk: 'ATK', def: 'DEF', hpP: 'HP', atkP: 'ATK', defP: 'DEF', spd: 'SPD',
    cr: 'Crit Rate', cd: 'Crit Dmg', res: 'Resist', acc: 'Accuracy',
};
export const PCT_KEYS = new Set(['hpP', 'atkP', 'defP', 'cr', 'cd', 'res', 'acc']);

/** chance to succeed going from level i → i+1 */
export const UPGRADE_ODDS = [1, 1, 0.95, 0.9, 0.85, 0.8, 0.7, 0.6, 0.5, 0.42, 0.35, 0.3, 0.25, 0.2, 0.15];
export const MAX_GEAR_LEVEL = 15;

export const SETS = {
    vigor:   { name: 'Vigor',   n: 2, desc: '+15% HP',                      bonus: { hpP: 0.15 }, color: '#7be08a' },
    guard:   { name: 'Guard',   n: 2, desc: '+15% DEF',                     bonus: { defP: 0.15 }, color: '#7fb3ff' },
    blade:   { name: 'Blade',   n: 2, desc: '+12% Crit Rate',               bonus: { cr: 0.12 }, color: '#ffd24a' },
    focus:   { name: 'Focus',   n: 2, desc: '+20% Accuracy',                bonus: { acc: 0.2 }, color: '#c9a0ff' },
    endure:  { name: 'Endure',  n: 2, desc: '+20% Resistance',              bonus: { res: 0.2 }, color: '#a0e0ff' },
    revenge: { name: 'Revenge', n: 2, desc: '15% chance to counterattack',  flag: { counter: 0.15 }, color: '#ff9a5a' },
    swift:   { name: 'Swift',   n: 4, desc: '+25% SPD',                     bonus: { spdP: 0.25 }, color: '#6ef0d0' },
    rage:    { name: 'Rage',    n: 4, desc: '+40% Crit Damage',             bonus: { cd: 0.4 }, color: '#ff5a5a' },
    fatal:   { name: 'Fatal',   n: 4, desc: '+35% ATK',                     bonus: { atkP: 0.35 }, color: '#ff7a3a' },
    vampire: { name: 'Vampire', n: 4, desc: 'Heals for 35% of damage dealt', flag: { lifesteal: 0.35 }, color: '#d04a7a' },
    despair: { name: 'Despair', n: 4, desc: '25% chance to stun on hit',    flag: { stunOnHit: 0.25 }, color: '#9a7ad6' },
    fervor:  { name: 'Fervor',  n: 4, desc: '20% chance of an extra turn',  flag: { extraTurn: 0.2 }, color: '#ff4ad0' },
};
export const SET_IDS = Object.keys(SETS);

export const SLOT_NOUNS = {
    weapon: ['Blade', 'Edge', 'Fang', 'Brand'], helm: ['Helm', 'Crown', 'Visage', 'Cowl'], armor: ['Mail', 'Aegis', 'Plate', 'Carapace'],
    gloves: ['Gauntlets', 'Grips', 'Fists', 'Bracers'], boots: ['Treads', 'Greaves', 'Striders', 'Sabatons'], amulet: ['Charm', 'Talisman', 'Locket', 'Pendant'],
};

// ---------------------------------------------------------------- materials

export const ORES = {
    copper:    { name: 'Copper Ore',  tier: 1, color: '#d9884a', value: 4 },
    iron:      { name: 'Iron Ore',    tier: 2, color: '#a8b0b8', value: 8 },
    silver:    { name: 'Silver Ore',  tier: 3, color: '#e0e8f0', value: 16 },
    gold:      { name: 'Gold Ore',    tier: 4, color: '#ffcf4a', value: 30 },
    mithril:   { name: 'Mithril',     tier: 5, color: '#7fe0ff', value: 60 },
    adamant:   { name: 'Adamantite',  tier: 6, color: '#d05aff', value: 110 },
    starmetal: { name: 'Starmetal',   tier: 7, color: '#ffffff', value: 220 },
};
export const ORE_IDS = Object.keys(ORES);

export const JEWELS = {
    ruby:     { name: 'Ruby',     color: '#ff3a5a', sets: ['fatal', 'rage', 'blade'],       desc: 'Steers crafting toward offense' },
    sapphire: { name: 'Sapphire', color: '#3a7aff', sets: ['guard', 'vigor', 'endure'],     desc: 'Steers crafting toward defense' },
    emerald:  { name: 'Emerald',  color: '#3ad07a', sets: ['swift', 'focus', 'fervor'],     desc: 'Steers crafting toward tempo' },
    amethyst: { name: 'Amethyst', color: '#a04aff', sets: ['despair', 'vampire', 'revenge'], desc: 'Steers crafting toward cunning' },
    topaz:    { name: 'Topaz',    color: '#ffb02a', sets: null,                              desc: '+1 rarity weight step' },
    diamond:  { name: 'Diamond',  color: '#e8f8ff', sets: null,                              desc: 'Guarantees at least Epic' },
};
export const JEWEL_IDS = Object.keys(JEWELS);

// ---------------------------------------------------------------- farm

export const CROPS = {
    wheat:       { name: 'Wheat',       mins: 5,   yield: [3, 5], color: '#f0d070', seedCost: 40,   sell: 6,    unlock: 1 },
    carrot:      { name: 'Carrot',      mins: 10,  yield: [3, 5], color: '#ff8a3a', seedCost: 80,   sell: 12,   unlock: 1 },
    pumpkin:     { name: 'Pumpkin',     mins: 30,  yield: [2, 4], color: '#ff7a1a', seedCost: 200,  sell: 40,   unlock: 2 },
    sunberry:    { name: 'Sunberry',    mins: 60,  yield: [3, 6], color: '#ffd84a', seedCost: 400,  sell: 60,   unlock: 3 },
    moonbloom:   { name: 'Moonbloom',   mins: 120, yield: [2, 4], color: '#9fb8ff', seedCost: 700,  sell: 150,  unlock: 4 },
    dragonfruit: { name: 'Dragonfruit', mins: 240, yield: [2, 3], color: '#ff4a8a', seedCost: 1200, sell: 380,  unlock: 6 },
    starmelon:   { name: 'Starmelon',   mins: 480, yield: [1, 2], color: '#b8f0ff', seedCost: 2500, sell: 1100, unlock: 8 },
};
export const CROP_IDS = Object.keys(CROPS);
export const GOLDEN_CHANCE = 0.06;

export const RECIPES = {
    snack:    { name: 'Hero Snack',         needs: { wheat: 2, carrot: 1 },                 gives: { item: 'xpS', n: 1 },     desc: 'An XP Elixir (S): 600 hero XP' },
    stew:     { name: 'Hearty Stew',        needs: { pumpkin: 1, carrot: 2, wheat: 2 },     gives: { item: 'xpM', n: 1 },     desc: 'An XP Elixir (M): 3,000 hero XP' },
    tart:     { name: 'Sunberry Tart',      needs: { sunberry: 3, wheat: 2 },               gives: { buff: 'gold', mins: 30 }, desc: '+25% battle & treasury gold for 30 min' },
    tea:      { name: 'Moonbloom Tea',      needs: { moonbloom: 2, sunberry: 1 },           gives: { buff: 'xp', mins: 30 },   desc: '+25% hero & Overlord XP for 30 min' },
    feast:    { name: 'Dragon Feast',       needs: { dragonfruit: 2, pumpkin: 2 },          gives: { buff: 'atk', mins: 30 },  desc: '+10% ATK in every battle for 30 min' },
    ambrosia: { name: 'Starmelon Ambrosia', needs: { starmelon: 1, moonbloom: 2, dragonfruit: 1 }, gives: { item: 'xpL', n: 1 }, desc: 'An XP Elixir (L): 15,000 hero XP' },
};

export const BUFFS = {
    gold: { name: 'Sunberry Tart', desc: '+25% gold', icon: 'coin' },
    xp:   { name: 'Moonbloom Tea', desc: '+25% XP', icon: 'xp' },
    atk:  { name: 'Dragon Feast',  desc: '+10% ATK', icon: 'sword' },
};

// ---------------------------------------------------------------- consumables

export const ITEMS = {
    xpS:   { name: 'XP Elixir (S)', desc: '600 hero XP',    xp: 600,   color: '#7be0ff' },
    xpM:   { name: 'XP Elixir (M)', desc: '3,000 hero XP',  xp: 3000,  color: '#7b9cff' },
    xpL:   { name: 'XP Elixir (L)', desc: '15,000 hero XP', xp: 15000, color: '#c87bff' },
    tome:  { name: 'Skill Tome',    desc: 'Raises a random skill of a hero by one level', color: '#ffd24a' },
    seedPack: { name: 'Seed Pack',  desc: 'Opens into 3–5 random seeds',   color: '#8ad64a' },
    chest: { name: 'Mystery Chest', desc: 'A random reward of random rarity', color: '#ffb02a' },
};

export const ESSENCE_TIERS = ['lo', 'mid', 'hi'];
export const ESSENCE_NAME = { lo: 'Lesser', mid: 'Greater', hi: 'Exalted' };

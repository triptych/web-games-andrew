// ROTTEN TO THE CORE — shared constants. Data tables live in js/sim/data/.

export const VERSION = '1.0.0';
export const SIM_DT = 1 / 60;          // fixed simulation step
export const SAVE_KEY = 'rttc.v1';      // localStorage prefix

export const LEVEL_CAP = 50;
export const STAT_POINTS_PER_LEVEL = 5;
export const INV_SIZE = 40;             // 10 × 4 backpack
export const STASH_SIZE = 60;
export const MAX_POTIONS = 12;          // per potion kind
export const MAX_PIES = 9;

export const FLOORS = 12;               // 3 acts × 4 floors
export const FOV_RADIUS = 11;           // tiles the hero can see (and the light radius)
export const AGGRO_RADIUS = 9.5;
export const SLEEP_RADIUS = 26;         // monsters further than this don't update

export const DIFFICULTIES = [
    { id: 'normal',   name: 'Fresh',    lvl: 0,  hp: 1.0, dmg: 1.0, xp: 1.0, mf: 0 },
    { id: 'overripe', name: 'Overripe', lvl: 16, hp: 1.25, dmg: 1.15, xp: 1.4, mf: 40 },
    { id: 'rotten',   name: 'Rotten',   lvl: 32, hp: 1.6, dmg: 1.3, xp: 1.9, mf: 90 },
];

export const RARITY = {
    normal:    { name: 'Common',    color: '#f2ede4', mult: 1 },
    magic:     { name: 'Juicy',     color: '#6fa8ff', mult: 2.4 },
    rare:      { name: 'Ripe',      color: '#ffd84a', mult: 5 },
    legendary: { name: 'Golden',    color: '#ff9a2e', mult: 12 },
    quest:     { name: 'Quest',     color: '#7dffa6', mult: 0 },
};

export const ELEMENTS = {
    phys:  { name: 'Physical',  color: '#ffffff' },
    fire:  { name: 'Spicy',     color: '#ff7a2e' },
    cold:  { name: 'Frosty',    color: '#8fe0ff' },
    light: { name: 'Fizzy',     color: '#f6ff7a' },
    pois:  { name: 'Moldy',     color: '#9be04a' },
};

export const STAT_NAMES = {
    str: 'Crunch', dex: 'Zip', mag: 'Zest', vit: 'Pulp',
};

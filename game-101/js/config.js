// PIXELCRYPT — tuning and constants. Shared by the sim, the view and the tests.

export const VERSION = '1.1.0';
export const SAVE_KEY = 'pixelcrypt.v1';

export const MAX_PARTY = 6;
export const INV_CAP = 80;
export const STEPS_PER_DAY = 280;           // dungeon steps that make one day pass
export const IDLE_SECONDS_PER_DAY = 150;    // real seconds that make one day pass (idle income)
export const OFFLINE_MAX_DAYS = 12;         // most days of income a closed tab earns
export const LEVEL_CAP = 250;
export const FLOOR_CACHE = 24;              // visited floors kept in the save

/** The sixteen EGA colours. Everything on screen is one of these (the 3D view is quantized to them). */
export const EGA = [
    '#000000', '#0000aa', '#00aa00', '#00aaaa', '#aa0000', '#aa00aa', '#aa5500', '#aaaaaa',
    '#555555', '#5555ff', '#55ff55', '#55ffff', '#ff5555', '#ff55ff', '#ffff55', '#ffffff',
];
export const C = {
    black: 0, blue: 1, green: 2, cyan: 3, red: 4, magenta: 5, brown: 6, grey: 7,
    dgrey: 8, lblue: 9, lgreen: 10, lcyan: 11, lred: 12, lmagenta: 13, yellow: 14, white: 15,
};

/** 0 north, 1 east, 2 south, 3 west. */
export const DIRS = [{ dx: 0, dy: -1 }, { dx: 1, dy: 0 }, { dx: 0, dy: 1 }, { dx: -1, dy: 0 }];
export const DIR_NAMES = ['North', 'East', 'South', 'West'];

export const ELEMENTS = ['phys', 'fire', 'ice', 'shock', 'holy', 'dark'];
export const ELEM_COL = { phys: 7, fire: 12, ice: 11, shock: 14, holy: 15, dark: 5 };
export const SLOTS = ['weapon', 'shield', 'head', 'body', 'hands', 'feet', 'acc1', 'acc2'];
export const SLOT_NAMES = { weapon: 'Weapon', shield: 'Shield', head: 'Head', body: 'Body', hands: 'Hands', feet: 'Feet', acc1: 'Charm', acc2: 'Charm' };
export const RARITY = [
    { name: 'Common', col: 15, mul: 1 }, { name: 'Uncommon', col: 10, mul: 1.1 }, { name: 'Rare', col: 11, mul: 1.24 },
    { name: 'Epic', col: 13, mul: 1.45 }, { name: 'Legendary', col: 14, mul: 1.8 },
];

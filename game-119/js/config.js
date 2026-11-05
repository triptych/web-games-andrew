// THE HERO'S MERCHANT — tuning and constants. Shared by the sim, the view and the tests.

export const VERSION = '1.0.0';
export const SAVE_KEY = 'heros-merchant.v1';

export const STEP = 1 / 120;              // fixed simulation step (s); the sim only animates travel and the clock
export const MAX_FRAME = 0.05;            // a long frame never runs more than this much game time

export const START = { gold: 240, day: 1, town: 'hearthmere' };
export const ECLIPSE_DAY = 360;           // the Dusk Wyrm wakes; the Hero leaves for the final battle
export const MAX_LEVEL = 20;
export const REGION_LEVEL = [0, 1, 4, 8, 12, 16];   // merchant level that opens each region (index = region)
export const DAY_SECONDS = 1.5;           // real sim seconds a travel day takes
export const LOG_MAX = 80;

// Wagon tiers: grid size, carrying capacity (weight), price and the merchant level that lets you buy it.
export const WAGONS = [
    { name: 'Handcart',        w: 6,  h: 4, cap: 90,  cost: 0,     lv: 1,  guard: 0 },
    { name: 'Donkey Cart',     w: 7,  h: 5, cap: 170, cost: 450,   lv: 3,  guard: 1 },
    { name: 'Merchant Wagon',  w: 8,  h: 5, cap: 290, cost: 1800,  lv: 6,  guard: 2 },
    { name: 'Caravan Wagon',   w: 9,  h: 6, cap: 460, cost: 6000,  lv: 10, guard: 3 },
    { name: 'Grand Caravan',   w: 10, h: 7, cap: 700, cost: 16000, lv: 14, guard: 4 },
];
export const STASH = { start: 12, step: 6, max: 60, cost: [150, 400, 900, 1800, 3200, 5200, 8000, 12000] };

// Market tuning
export const MARKET = {
    buyMarkup: 1.07,          // what a shop charges over the mid price
    sellMarkdown: 0.93,       // what a shop pays under it
    impact: 0.013,            // price moves this much per unit traded (stacks)
    impactGear: 0.07,         // ... per piece of gear
    recover: 0.09,            // daily pull back toward the town's natural price
    noise: 0.035,
    produce: 0.74, want: 1.36,
    minM: 0.45, maxM: 2.6,
    eventChance: 0.022,
};
export const BURDEN = { soft: 1.0, hard: 1.5 };   // above the soft limit travel slows; past the hard limit the wagon will not move

export const XP = { sale: 0.04, profit: 0.22, craft: 0.14, quest: 1 };
export const levelXp = (lv) => (lv <= 1 ? 0 : Math.round(64 * Math.pow(lv - 1, 2.05)));

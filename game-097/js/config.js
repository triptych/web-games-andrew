// Hollow Gambit — tuning and constants. Shared by the sim, the view and the tests.

export const VERSION = '1.0.0';
export const SAVE_KEY = 'hollow-gambit.v1';

export const STEP = 1 / 120;              // fixed simulation step (s)
export const MAX_FRAME = 0.05;            // a long frame never runs more than this much game time

export const AI_DELAY = 0.35;             // sim seconds between enemy actions
export const MAX_TURNS = 40;              // the night wins after this many rounds

export const COMBAT = {
    baseHit: 70,
    advHit: 15,                           // element advantage: +15 hit, disadvantage -15
    advMult: 1.25,
    disMult: 0.8,
    doubleSpd: 4,                         // this much faster strikes twice
    critMult: 3,
    spell: 0.5,                           // share of defence that a spell ignores
};

export const TERRAIN = {
    '.': { name: 'Flagstone', def: 0, avo: 0 },
    '+': { name: 'Altar', def: 2, avo: 10 },
    '#': { name: 'Wall', def: 0, avo: 0, solid: true },
    '~': { name: 'Chasm', def: 0, avo: 0, solid: true, pit: true },
};

export const XP = { perLevel: 100, maxLevel: 20 };
export const BOND = { perDupe: 0.05, max: 5, refund: 30 };   // 5% to every stat per duplicate, up to 5

export const GACHA = {
    single: 100,
    ten: 900,
    pity5: 40,                            // a 5-star at least every 40 summons
    pity4: 10,                            // a 4-star or better at least every 10
    rates: { 3: 0.70, 4: 0.25, 5: 0.05 },
};

export const START = { shards: 1000, party: ['maren', 'gideon', 'ilse'] };
export const PARTY_MAX = 5;

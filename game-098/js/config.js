// Wyrmbond — tuning and constants. Shared by the sim, the view and the tests.

export const VERSION = '1.0.0';
export const SAVE_KEY = 'wyrmbond.v1';

export const STEP = 1 / 120;              // fixed simulation step (s)
export const MAX_FRAME = 0.05;            // a long frame never runs more than this much game time

export const AI_DELAY = 0.3;              // sim seconds between enemy actions

export const COMBAT = {
    defWeight: 0.5,                       // share of DEF taken off each blow
    starCut: 0.06,                        // each terrain star cuts damage by 6% (fliers get none)
    luck: 0.08,                           // up to +8% on any blow
    critBase: 0.04,
    critMult: 1.5,
    flurrySpd: 6,                         // this much faster strikes a second time
    edge: 1.3,                            // element advantage
    dull: 0.75,                           // element disadvantage
    minDmg: 1,
};

export const PROPERTY = { capture: 20, income: 100, heal: 0.2 };
export const POWER = { max: 100, dealt: 34, taken: 22 };

export const LEVEL = { xp: 100, grow: 0.1, max: 40, adult: 12, juvenile: 6, elder: 25 };
/** XP from one level to the next: 100 at level 1, rising 10% of that per level. */
export const xpNeed = (lv) => Math.round(LEVEL.xp * (1 + (lv - 1) * LEVEL.grow));

/** Seconds of warmth an egg needs, by rarity (1–5). Real time passes while you play or are away. */
export const HATCH = { 1: 150, 2: 240, 3: 480, 4: 900, 5: 1800 };
export const IDLE = {
    offlineCap: 8 * 3600,                 // at most eight hours of time away count
    tapWarm: 3,                           // a tap on an egg warms it this many seconds
    winWarm: 120,                         // a victory warms every egg
    trainXp: 1 / 8,                       // XP per second for a dragon in a training ring
    hoardRate: 1 / 30,                    // gold per second for each dragon in the stable
    hoardCap: 600,
    breedCd: 600,                         // seconds a parent rests after laying
};

export const START = { gold: 300, incubators: 2, training: 1, stable: 12 };
export const SHOP = {
    meat:     { name: 'Roast Boar',     icon: '🍖', cost: 40,  desc: '+30 XP' },
    fish:     { name: 'Glimmerfish',    icon: '🐟', cost: 140, desc: '+100 XP' },
    fruit:    { name: 'Sunfruit',       icon: '🍑', cost: 60,  desc: '+1 Bond' },
    ironroot: { name: 'Ironroot',       icon: '🥕', cost: 150, desc: '+1 trained stat (pick)' },
    coal:     { name: 'Hearthcoal',     icon: '🪨', cost: 90,  desc: 'Warms every egg 5 minutes' },
    egg:      { name: 'Market Egg',     icon: '🥚', cost: 250, desc: 'A common or uncommon egg' },
    rareegg:  { name: 'Sky-Merchant Egg', icon: '🪺', cost: 900, desc: 'Uncommon to rare (3★–4★)' },
    nest:     { name: 'Incubator',      icon: '🔥', cost: 600, desc: '+1 incubator (max 4)', scale: 1.8 },
    ring:     { name: 'Training Ring',  icon: '🏟️', cost: 500, desc: '+1 training ring (max 3)', scale: 1.8 },
    stall:    { name: 'Stable Wing',    icon: '🏠', cost: 400, desc: '+4 stable stalls (max 32)', scale: 1.5 },
};
export const LIMITS = { incubators: 4, training: 3, stable: 32, trainBonus: 5 };
export const CALL = { base: 120, perLevel: 25 };   // gold to call a dragon from a roost mid-battle
export const PARTY_MAX = 6;

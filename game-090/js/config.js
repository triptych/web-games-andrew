// Verdant Protocol — tuning and constants. Shared by the sim, the view and the tests.

export const VERSION = '1.0.0';
export const SAVE_KEY = 'verdant-protocol.v1';

export const STEP = 1 / 120;              // fixed step for exploration (s); battles and the hub are turn-based
export const MAX_FRAME = 0.05;            // a long frame never runs more than this much game time

export const MAX_LEVEL = 60;
export const PARTY_SIZE = 3;              // daemons beside the Agent in the field
export const STOCK_MAX = 24;              // daemons the Greenhouse can keep
export const SKILL_SLOTS = 8;             // a daemon's skills; the Agent holds ten
export const AGENT_SKILL_SLOTS = 10;
export const NEED = 3;                    // rapport needed to recode a daemon
export const PATIENCE = 4;                // exchanges before a daemon loses interest

/** The eight damage types and Root, which nothing resists. */
export const ELEMENTS = ['strike', 'gun', 'pyre', 'rime', 'volt', 'gale', 'lumen', 'hex', 'root'];
export const EL = {
    strike: { name: 'Strike', tag: 'STR', color: '#ffa24a' },
    gun: { name: 'Gun', tag: 'GUN', color: '#c9d4e0' },
    pyre: { name: 'Pyre', tag: 'PYR', color: '#ff5a3a' },
    rime: { name: 'Rime', tag: 'RIM', color: '#6fd8ff' },
    volt: { name: 'Volt', tag: 'VLT', color: '#ffe14a' },
    gale: { name: 'Gale', tag: 'GAL', color: '#8dff9c' },
    lumen: { name: 'Lumen', tag: 'LUM', color: '#fff3a8' },
    hex: { name: 'Hex', tag: 'HEX', color: '#d24bff' },
    root: { name: 'Root', tag: 'RT', color: '#ffffff' },
};

export const AFFINITY_MULT = { w: 1.5, r: 0.5, n: 0, d: 0, p: 0 };

/** Moon of the grid: the eight tides of the ley-lattice, one a day. */
export const TIDES = [
    { name: 'Dark Tide', short: 'New', recode: -1, foe: 1.1 },
    { name: 'Waxing Crescent', short: 'Crescent', recode: 0, foe: 1.0 },
    { name: 'First Quarter', short: 'Quarter', recode: 0, foe: 1.0 },
    { name: 'Waxing Gibbous', short: 'Gibbous', recode: 0, foe: 1.0 },
    { name: 'Bright Tide', short: 'Full', recode: 1, foe: 0.92 },
    { name: 'Waning Gibbous', short: 'Gibbous', recode: 0, foe: 1.0 },
    { name: 'Last Quarter', short: 'Quarter', recode: 0, foe: 1.0 },
    { name: 'Waning Crescent', short: 'Crescent', recode: 0, foe: 1.0 },
];
export const tideOf = (day) => ((day % 8) + 8) % 8;

/** XP to go from level L to L+1. */
export const xpToNext = (L) => Math.round(16 + 7 * Math.pow(L, 1.5));

/** The damage a power-40 hit does at a level, before stats and affinity. */
export const baseline = (lv) => 8 + lv * 2.1;

export const SPEED = { walk: 4.3, dash: 6.4, chase: 3.7, patrol: 1.5 };
export const REST_COST = 0;               // resting at the station is free; it just ends the day
export const FLEE_BASE = 0.45;

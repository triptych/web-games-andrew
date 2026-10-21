// Dragonroll — tuning and constants. Shared by the sim, the view and the tests.

export const VERSION = '1.0.0';
export const SAVE_KEY = 'dragonroll.v1';

export const STEP = 1 / 120;              // view animation step (s); the sim itself is turn-based
export const MAX_FRAME = 0.05;            // a long frame never runs more than this much animation time

export const BOARD_SIZE = 40;             // spaces round the island, four corners and four sides of nine

/** Game lengths: laps before Pyrrhax wakes, and the earliest lap you may climb the mountain. */
export const LENGTHS = {
    short: { laps: 3, early: 2, label: 'Short', note: '3 laps · about 15 minutes' },
    standard: { laps: 5, early: 3, label: 'Standard', note: '5 laps · about 30 minutes' },
    long: { laps: 7, early: 4, label: 'Epic', note: '7 laps · about 45 minutes' },
};

export const START_GOLD = 140;
export const SALARY = { base: 90, perLap: 30, land: 1.5 };   // passing Hearthstone; landing on it pays ×1.5
export const MAX_LEVEL = 30;
export const PARTY_MAX = 3;
export const VALOR_MAX = 100;
export const DEFEAT_GOLD_LOSS = 0.2;      // share of gold dropped when the party is knocked out
export const FOUNTAIN_START = 60;

/** Property tolls by level (share of the deed price), income per lap, upgrade cost. */
export const DEED = { toll: [0.25, 0.45, 0.7, 1.0], income: [0.15, 0.25, 0.38, 0.55], upgrade: 0.55, maxLevel: 3, setToll: 2, sellBack: 0.5 };

/** XP to go from level L to L+1. */
export const xpToNext = (L) => Math.round(20 * Math.pow(L, 1.3) + 12);

/** Between turns the party rests on the road: a share of HP and MP comes back. */
export const ROAD_REST = { hp: 0.1, mp: 0.12 };

/** The island's pace: the level a party should be about at on each lap. */
export const pace = (lap) => 2 + 3 * (lap - 1);

/** Enemy level for a region and lap. */
export const enemyLevel = (tier, lap) => Math.max(1, Math.round(1 + tier * 1.5 + (lap - 1) * 2.6));

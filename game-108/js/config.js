// Oathstones — tuning and constants. Shared by the sim, the view and the tests.

export const VERSION = '1.0.0';
export const SAVE_KEY = 'oathstones.v1';

export const STEP = 1 / 120;              // fixed step for the view's clock (the sim is turn-based)
export const MAX_FRAME = 0.05;            // a long frame never runs more than this much animation time

export const BOARD = { w: 7, h: 7 };      // cells; row 0 is the far edge, where new stones fall in

export const PARTY = { size: 4, baseHp: 100 };
export const CALLS = { max: 10, firstIn: 0, every: 4, maxOnBoard: 2 };
export const SUMMON = { cost1: 100, cost5: 450, pity: 30, rates: { 5: 0.04, 4: 0.26 } };
export const START = { crystals: 300 };
export const LEVEL = { max: 30, xpPer: 30 };      // level n needs n × xpPer XP

/** Per-token damage = (TOKEN.base + party power of that colour) × element × combo. */
export const TOKEN = { base: 4, recruitDmg: 25, comboStep: 0.25 };

/** Enemy scaling on top of the table in sim/data.js (tuned against the bot, see game-plan.md). */
export const FOE = { hp: 1, atk: 1 };

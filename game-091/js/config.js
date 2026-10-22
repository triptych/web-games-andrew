// STARSPIN — tuning and constants. Shared by the sim, the view and the tests.

export const VERSION = '1.0.0';
export const SAVE_KEY = 'starspin.v1';

export const STEP = 1 / 120;              // fixed simulation step (s)
export const MAX_FRAME = 0.05;            // a long frame never runs more than this much game time

export const PLAYER = { hp: 64, energy: 2, reels: 3, maxReels: 5 };
// n of a kind on the payline: every copy in the group is multiplied by this
export const MULT = [0, 1, 1.5, 2, 2.5, 3];
export const COST = { nudge: 1, respin: 1 };
export const REST_HEAL = 0.35;            // share of max HP a Waystation rest restores
export const ETCH = 0.5;                  // each etch level adds this share of a symbol's base value

// enemy tuning, fitted with the bot (see dev/simtest.mjs, the 'bot' section)
export const FOE = { hp: 1.2, dmg: 1.3, perStop: 0.08 };

// Doom & Doilies: The Sugar Siege — tuning and constants. Shared by the sim, the view and the tests.

export const VERSION = '1.3.2';
export const SAVE_KEY = 'doom-doilies-sugar-siege.v1';

export const STEP = 1 / 120;              // fixed simulation step (s)
export const MAX_FRAME = 0.05;            // a long frame never runs more than this much game time

// ------------------------------------------------------------------ town
export const DAY_LEN = 40;                // seconds of sim time per day at 1x
export const PHASE_DAYS = [7, 8, 9, 10];  // days before each of the four invasions
export const EPI_DAYS = 6;                // days between leftover waves in the epilogue
export const RETRY_DAYS = 3;              // days to regroup after a lost (or withdrawn) wave
export const PLOTS = 12;
export const PLOTS_OPEN = [8, 10, 12];    // plots usable at town hall level 1, 2, 3
export const LVL_MULT = [1, 1.8, 2.8];    // output by building level
export const UPGRADE_COST = 2.4;          // each level costs this many times the build cost
export const BUILD_DAYS = 0.15;           // a new building takes about six seconds
export const UPGRADE_DAYS = 0.4;
export const START = { gold: 300, flour: 40, sugar: 30, stone: 100, pop: 8, hope: 48 };
// Harvest bubbles: a working building fills up over its own ripening time (each kind has one in data.js, nudged a
// little by the plot, so they never all pop up at once), then a tap collects `bonus` seconds of its output for every
// `ripe` seconds it waited (at least `min` of each), or `coins` gold per level from a building that makes nothing.
// Something to do every few seconds, and a reward for paying attention.
export const HARVEST = { ripe: 10, bonus: 8, min: 4, coins: 6 };
export const RIPE_JITTER = [0.9, 1.04, 0.96, 1.12, 0.86, 1.0, 1.08, 0.93, 1.15, 0.98, 0.88, 1.06];   // by plot, so two windmills ripen apart
// Time away: coming back after at least `min` real seconds, the town has saved up `share` of its production,
// one town day's worth for every `perDay` real seconds away, between `minDays` and `maxDays`, and never less than
// `floor` gold a day.
export const IDLE = { min: 120, perDay: 1800, minDays: 0.5, maxDays: 3, share: 0.6, floor: 60 };
// Hard mode: the wall falls, the game is over. The next game starts with `keep` of the stores on hand and `refund`
// of what the standing buildings cost.
export const HARD = { keep: 0.5, refund: 0.25 };
export const MODES = ['story', 'normal', 'hard'];
export const HALL_HOUSING = 6;
export const HALL_COST = [null, { gold: 300 }, { gold: 700, stone: 200 }];   // level 2 is gold only, so a town short of stone can always grow
export const HOPE = { base: 38, fearMax: 18, approach: 0.06 };
export const POP = { grow: 0.09, shrink: 0.05, minHope: 30, fleeHope: 18, tax: 0.025 };
export const STAFF_BONUS = { affinity: 0.6, other: 0.25 };

// ------------------------------------------------------------------ the Grand Bake
export const BAKE = { rate: 0.1, flour: 0.22, sugar: 0.22, honey: 1.3 }; // % per second at level 1; flour/sugar per second

// ------------------------------------------------------------------ battle
export const FIELD = { w: 100, spawn: 104, reach: 2.5 };   // x 0 is the wall's face
export const WALL_HP = [300, 520, 850, 1300, 1900];
export const WALL_COST = [null, { gold: 150, stone: 80 }, { gold: 320, stone: 180 }, { gold: 600, stone: 320 }, { gold: 1000, stone: 500 }];
export const WALL_DAYS = 0.5;
export const READY_BONUS = 0.15;          // wall HP bonus when every readiness item is met
export const DOILY = { dmg: 6, radius: 3, cd: 0.6, flight: 0.35, witchBonus: 0.3, range: 62 }; // the Mayor can't throw further than range
export const AIM_SPEED = 70;              // field units per second with the keys or stick
export const TOWER = { dps: 6, range: 75, flight: 0.45, grizelda: 0.25 };
export const KNIGHT = { x: 12, hp: 140, dps: 10, respawn: 12 };
export const KING = { hp: 4000, stopX: 34, patience: 60, floor: 0.5, regen: 30 };
export const QUEEN = { speed: 9, kissT: 6, transformT: 1.6 };   // the kiss lasts kissT; the King turns young transformT into it
export const BRACE = 3;                   // seconds of "here they come" before the first spawn
export const NAP_T = 2.2;                 // a calmed enemy naps this long before it wanders off

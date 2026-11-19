// Doom & Doilies: The Sugar Siege — tuning and constants. Shared by the sim, the view and the tests.

export const VERSION = '1.0.0';
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
export const BUILD_DAYS = 0.25;           // a new building takes a quarter of a day
export const UPGRADE_DAYS = 0.4;
export const START = { gold: 220, flour: 30, sugar: 20, stone: 70, pop: 8, hope: 45 };
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

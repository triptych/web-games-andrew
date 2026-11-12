// HOLLOWDEEP — tuning and constants. Shared by the sim, the view and the tests.

export const VERSION = '1.0.0';
export const SAVE_KEY = 'hollowdeep.v1';

// ---------------------------------------------------------------- party and town
export const PARTY_MAX = 5;            // three in the front row, two behind
export const FRONT = 3;
export const ROSTER_MAX = 12;
export const INV_MAX = 48;
export const START_GOLD = 250;
export const HIRE_COST = (lv) => 40 + lv * lv * 18;
export const INN_COST = (lvSum) => 6 + lvSum * 2;
export const REVIVE_COST = (lv) => 20 + lv * 15;
export const CURE_COST = 15;
export const WIPE_GOLD_LOSS = 0.3;

// ---------------------------------------------------------------- experience
export const XP_NEXT = (lv) => Math.round(10 * Math.pow(lv, 2.05));

// ---------------------------------------------------------------- the dungeon
export const MAP_SIZE = (floor) => Math.min(31, 15 + 2 * Math.floor((floor - 1) / 3));   // odd, grows with depth
export const DANGER_STEP = [0.035, 0.085];       // encounter gauge per step (fills to 1)
export const DANGER_SAFE_STEPS = 4;              // no fight in the first steps on a floor
export const FOUNTAIN_HEAL = 0.5;
export const REAPER_FROM = 6;                    // the roaming Lantern Reaper appears from this floor
export const REAPER_CHANCE = 0.35;
export const REAPER_SIGHT = 7;

// ---------------------------------------------------------------- battle
export const MON_POWER = 2.2;                    // monsters' attack is scaled by this (they have no gear)
export const MON_HP = 3;                       // and their health by this
export const CRIT_MUL = 1.6;
export const BACK_ROW_TAKEN = 0.7;               // physical damage the back row takes
export const BACK_ROW_MELEE = 0.55;              // melee damage dealt from the back row
export const WEAK_MUL = 1.5, RESIST_MUL = 0.5;
export const FLEE_BASE = 0.55;
export const POISON_PCT = 0.07;
export const REGEN_PCT = 0.08;
export const MAX_ENEMIES = 5;

/** How much stronger monsters are on `floor` than their own baseline: steady growth with depth, and a big step
 *  each pass round the strata (the Echoes start again from the first stratum's weaker base stats). */
export function monsterScale(floor, cycle) {
    return (1 + 0.07 * (floor - 1)) * Math.pow(3.4, cycle);
}

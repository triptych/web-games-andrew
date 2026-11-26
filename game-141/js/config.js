// SANDSUNK — tuning and constants. Shared by the sim, the view and the tests.

export const VERSION = '1.1.1';
export const SAVE_KEY = 'sandsunk.v1';

export const STEP = 1 / 60;               // the view's animation step; the rules are turn-based
export const MAX_FRAME = 0.05;

export const STORY_FLOORS = 16;           // floor 16 holds the Heart of the Spire; deeper floors are endless
export const TREASURE_EVERY = 4;          // 4, 8, 12, 16 are treasure floors

export const BASE = { hp: 20, stamina: 40, pick: 1 };
export const PER_RANK = { hp: 6, stamina: 10 };
export const LEVEL_CAP = 40;
/** XP needed to go from level lv to lv + 1. */
export const xpToNext = (lv) => 20 + lv * 18;
export const LEVEL_GIFT = { stamina: 5, hp: 5 };   // a level-up tops you up a little

export const FAINT_FEE = 0.15;            // share of gold paid to the camel-drivers who carry you up
export const SAFE_FLOOR_HP = 0.25;        // a hit taken above this share of max HP always leaves at least 1 HP
export const FALSE_ALARM = 3;             // stamina a careful dig on a safe marked block costs
export const AMBUSH_MULT = 2;             // a marked monster block lets you strike first, this many times as hard

export const SHOP = {
    potion: { gold: 35, max: 9 },
    tonic:  { gold: 25, max: 9 },
    hyper:  { gold: 70, max: 5 },
    ward:   { gold: 50, max: 5 },
    blast:  { gems: 3, max: 5 },
    dowse:  { gems: 2, max: 5 },
};
export const ITEM_FX = { potion: 15, tonic: 20, hyper: 25, ward: 3 };
export const INV_MAX = 9;

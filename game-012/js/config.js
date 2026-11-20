// Arcana Pull — tuning and constants. Shared by the sim, the view and the tests.

export const VERSION = '2.0.2';
export const SAVE_KEY = 'arcana-pull.v2';

export const PARTY_SIZE = 4;
export const TRIAL_COUNT = 10;
export const READING_AFTER = [3, 6, 9];       // a Reading follows a win at these Thresholds
export const LIVES = 3;

// The Well (gacha)
export const START_DUST = 900;
export const PULL_COST = 60;
export const TEN_COST = 540;                  // ten pulls for the price of nine, and one is Rare or better
export const RATES = { C: 52, U: 28, R: 13, E: 5, L: 2 };   // per hundred
export const PITY = 40;                       // a Legendary at the latest on this pull since the last
export const SOFT_PITY = 30;                  // from here each pull adds SOFT_STEP to the Legendary rate
export const SOFT_STEP = 6;
export const FEATURED_SHARE = 0.5;            // a Legendary is the featured Major this often
export const STAR_COST = [0, 1, 2, 3, 4];     // copies to go from ★n to ★n+1 (index n)
export const MAX_STAR = 5;
export const STAR_GROWTH = 0.2;               // +20% HP and ATK a star
export const SPARE_DUST = 25;                 // a copy of a ★5 card turns to stardust

// Rewards
export const winDust = (trial) => 200 + 40 * trial;
export const LOSS_DUST = 100;
export const winScore = (trial, survivors) => 100 * trial + 25 * survivors;

// Battle
export const BATTLE_CAP = 150;                // seconds of battle before the candle burns out (a loss)
export const BEAT = 20;                       // a unit acts every BEAT / SPD seconds
export const ADVANTAGE = 1.35;                // element beats element
export const DISADVANTAGE = 0.75;
export const CRIT_MULT = 1.6;
export const SWORDS_CRIT = 0.12;
export const DEF_CAP = 0.7;
export const SHIELD_CAP = 0.5;                // a shield holds at most half its bearer's max HP
export const ENEMY_SCALE = 1.0;               // every Hollow's HP and ATK
// per-Threshold HP and ATK (the bot's balance knobs, index 0 = Threshold 1)
export const TRIAL_HP = [2.2, 1.5, 0.8, 1.0, 1.0, 1.0, 0.85, 0.8, 0.8, 0.6];
export const TRIAL_ATK = [0.9, 0.9, 0.95, 0.8, 1.0, 0.95, 0.85, 0.7, 0.8, 0.8];
export const ASCENSION_STEP = 0.35;           // each Ascension makes the Hollows this much stronger

// Readings
export const OMEN_FIGHTS = 3;                 // an omen lasts this many battles
export const REVERSED_CHANCE = 0.3;
export const MAX_ITEMS = 3;

export const STEP = 1 / 60;
export const MAX_FRAME = 0.05;

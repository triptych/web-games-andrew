// The First Dragon Prince — tuning and constants. Shared by the sim, the UI and the tests.

export const VERSION = '1.1.0';
export const SAVE_KEY = 'first-dragon-prince.v1';
export const SLOTS = 3;                    // number of save slots

export const START_AGE = 10;
export const END_AGE = 18;                 // the coming-of-age ceremony on the 18th hatch-day ends the game
export const PERIODS = 3;                  // each month is planned as three ten-day periods
export const FREE_AP = 3;                  // actions on the Free Day that opens each month

// All stats run 0..100. Gains shrink as a stat grows: gain * max(MIN_GAIN, 1 - v / SOFTCAP).
export const SOFTCAP = 135;
export const MIN_GAIN = 0.12;
export const STAT_MAX = 100;
export const GAIN_SCALE = 0.45;          // every activity's listed gains are multiplied by this (tuned with the bot)

export const START_STATS = {
    str: 10, vit: 14, int: 10, grc: 6, cha: 12, mor: 45, fth: 10, art: 8,
    cmb: 4, mag: 6, elo: 5, com: 3, cun: 6,
    drc: 35, fame: 4, fav: 15, sts: 0, bond: 40,
};
export const START_GOLD = 400;

// The Crown's monthly stipend for the prince's keep: base + fav * per.
export const STIPEND = { base: 60, per: 1.0 };

// Stress: above REBEL a period can be skipped (chance grows), at SICK he falls ill and the next period is rest.
export const STRESS = { rebel: 62, sick: 100, drakeAt: 60, drakeGain: 0.6, failAt: 50 };

// Affection: each gain shrinks as affection grows (1 - aff / AFF_SOFT); heart events open at these thresholds and ages.
export const AFF_SOFT = 150;
export const HEARTS = [
    { aff: 15, age: 11 },
    { aff: 35, age: 13 },
    { aff: 55, age: 15 },
    { aff: 72, age: 17 },
];
export const PARTNER_MIN = 70;             // affection needed (with all four hearts) to marry

export const FESTIVAL_MONTH = 9;           // the Harvest Festival
export const STARFALL_MONTH = 12;          // Starfall Night
export const AUDIENCE_MONTH = 3;           // the spring audience with the King
export const SUMMER = [7, 8];              // a holiday can be taken in these months

export const MONTHS = ['Hatchmoon', 'Thawmoon', 'Bloommoon', 'Rainmoon', 'Greenmoon', 'Highsun',
    'Goldmoon', 'Emberwane', 'Harvestmoon', 'Mistmoon', 'Frostfall', 'Starfall'];
export const SEASON = ['winter', 'spring', 'spring', 'spring', 'summer', 'summer', 'summer', 'autumn', 'autumn', 'autumn', 'winter', 'winter'];

// Folio & Fable — constants and tuning. Shared by the sim, the view and the tests. Pure data.
// The content tables (books, materials, places, people, story) live in js/sim/data.js.

export const VERSION = '1.1.2';
export const SAVE_KEY = 'folio-and-fable.v1';

export const STEP = 1 / 60;               // the shop clock steps at this rate while the doors are open
export const MAX_FRAME = 0.05;            // a long frame never runs more than this much shop time

export const DAY = {
    open: 9, close: 17,                   // shop hours, for the clock on the HUD
    seconds: 80,                          // real seconds of an open day at 1× speed
    walk: 1.7,                            // customer walking speed, in shop slots per second
    browse: 3.2,                          // seconds a customer browses a shelf
    pay: 1.2,                             // seconds at the till
    patience: 45,                         // seconds a customer with a request waits at the counter
};

export const SHOP = {
    width: 6,                             // slots along the wall at the start
    widths: [6, 8, 10, 12],               // each renovation adds two
    expand: [120, 260, 480],              // gold for each renovation
    maxCommissions: 4,
    commissionDays: 5,                    // a commission waits this many days, then the customer gives up (no penalty)
};

export const START = { gold: 40, books: 10 };

export const ECON = {
    renownPrice: 0.004,                   // +0.4% on every price per point of renown …
    renownPriceCap: 0.4,                  // … up to +40%
    requestBonus: 1.5,                    // a request pays this much of the book's value
    commissionBonus: 1.9,
    traderMarkup: 1.35,
    silverTongue: 0.15,
    appraisal: 0.15,
    rebindGold: 12,                       // × the new plus level
    gardenGold: 15,                       // gold a day from the Duchess once her garden party has happened
};

export const EXP = {
    xpPerLevel: 10,                       // a level needs xpPerLevel × level experience
    maxLevel: 10,
    baseChance: 0.25,                     // chance = base + slope × power / need, clamped
    slope: 0.6,
    minChance: 0.1,
    maxChance: 0.97,
};

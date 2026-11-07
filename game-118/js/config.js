// The Kids Table — tuning and constants. Shared by the sim, the view, the UI and the tests.

export const VERSION = '1.0.0';
export const SAVE_KEY = 'the-kids-table.v1';

export const STEP = 0.25;                 // the sim's own pace (s): generators recharge, guests arrive; merges are commands
export const MAX_FRAME = 0.1;             // a long frame never advances more than this much game time

export const COLS = 6;
export const ROWS = 7;
export const MAX_TIER = 6;

// A generator holds a few charges and slowly earns them back (the idle half of the game).
export const GEN = { max: 8, regen: 12, tier2: 0.15 };

// Each table is a bigger rectangle of the 6x7 board. Stars buy the next one; each can bring a new generator.
export const TABLES = [
    { name: 'The Kids Table',        rect: { c0: 1, c1: 4, r0: 1, r1: 5 }, cost: 0, gift: null },
    { name: 'The Card Table',        rect: { c0: 0, c1: 5, r0: 1, r1: 5 }, cost: 3, gift: 'turkey' },
    { name: 'The Dining Table',      rect: { c0: 0, c1: 5, r0: 0, r1: 5 }, cost: 6, gift: 'grain' },
    { name: 'The Head of the Table', rect: { c0: 0, c1: 5, r0: 0, r1: 6 }, cost: 10, gift: null },
];

export const ECON = {
    startCoins: 20,
    refillPer: 6, refillMin: 30,                           // coins per missing charge (min refillMin): every generator back to full
    basket: 15,                            // coins: a mystery basket item
    mergeCoins: [0, 0, 0, 1, 2, 4, 8],    // coins for creating a tier (index = tier)
    compostCoins: (t) => Math.max(0, t - 2),
    comboWindow: 2.5,                      // s between merges to keep a combo going
    comboCap: 2,
};

export const GUESTS = { slots: 3, arrive: 3.5 };

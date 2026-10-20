// Curio Cove — tuning and constants. Shared by the sim, the view and the tests.

export const VERSION = '1.0.0';
export const SAVE_KEY = 'curio-cove.v1';

export const STEP = 1 / 120;              // fixed simulation step (s)
export const MAX_FRAME = 0.05;            // a long frame never runs more than this much game time

/** The six kinds of find on the board. Shape and colour both differ, so they read without colour. */
export const TILES = [
    { key: 'amphora', name: 'Amphora', color: '#e0653a' },
    { key: 'coin', name: 'Gold Coin', color: '#f2c230' },
    { key: 'leaf', name: 'Leaf Fossil', color: '#3faa3a' },
    { key: 'shell', name: 'Ammonite', color: '#2a82dc' },
    { key: 'crystal', name: 'Amethyst', color: '#9a4ee0' },
    { key: 'bone', name: 'Bone', color: '#efe4cc' },
];

export const SPECIALS = {
    h: { name: 'Trowel', how: 'Match 4 in a row: sweeps its whole row' },
    v: { name: 'Trowel', how: 'Match 4 in a column: sweeps its whole column' },
    bomb: { name: 'Pickaxe', how: 'Match an L or a T: breaks everything around it' },
    scarab: { name: 'Scarab', how: 'Match a 2×2 square: flies off to dig where it is needed' },
    sun: { name: 'Sunstone', how: 'Match 5 in a row: swap it with a find to clear every one of that kind' },
};

export const SCORE = {
    match3: 60, match4: 140, match5: 260, bomb: 200, square: 120,
    blast: 30, soil: 100, fossil: 600, rock: 80, crust: 50, relic: 1200, rushMove: 400,
};

export const COINS = {
    perStar: 10,          // a win pays this per star earned
    firstClear: 20,       // and this the first time
    extraMoves: 60,       // five more moves when you run out
    booster: { hammer: 80, shuffle: 50 },
};

export const BOOSTER_MOVES = 5;

/** The till fills while the museum is open; Ledger makes it bigger. */
export const TILL = { cap: 200, capLedger: 600, awayCapHours: 8 };

/** Visitors are drawn by exhibits. Coins per minute for each point of appeal. */
export const APPEAL = { perItem: 1, perDino: 8, perHall: 3, coinsPerMinute: 0.25 };

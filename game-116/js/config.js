// SOLITAIRE FROM OUTER SPACE — tuning and constants. Shared by the sim, the view and the tests.

export const VERSION = '1.0.0';
export const SAVE_KEY = 'solitaire-from-outer-space.v1';

export const STEP = 1 / 120;              // fixed step (s); the game is turn-based, this only ticks G.t
export const MAX_FRAME = 0.05;            // a long frame never runs more than this much time

export const START = { hp: 60, bucks: 60 };
export const CHARGE_MAX = 9;              // Atom charge, spent on gadgets
export const GADGET_SLOTS = 3;
export const DRAWS_PER_TURN = 2;          // a free beam card starts each turn, then this many draws
export const DECK_MIN = 5;                // removal stops here, so a draw is always possible
export const SWEEP = { dmg: 10, big: 20 }; // Clean Sweep: clearing the whole table
export const ACTS = 3;                    // three reels of film
export const MAP = { rows: 7, lanes: 4, walks: 5 };   // seven rows, then the boss
export const SHOP = { card: [42, 78], gadget: 85, relic: 135, remove: 50, removeStep: 25 };
export const REST_HEAL = 0.3;             // the diner heals 30% of max HP
export const ACT_HEAL = 0.6;              // between reels, heal 60% of what's missing
export const BUCKS = { fight: [12, 19], elite: [28, 36], boss: [70, 80] };
export const GADGET_DROP = 0.3;           // a normal fight drops a gadget this often
export const BOT_GUARD = 40000;           // the simtest gives up on a run after this many commands

// Creature HP and hit multipliers by reel and tier, fitted to the bot's balance table (simtest `bot`).
export const SCALE = [
    { fight: [1.15, 1.25], elite: [1.0, 1.1], boss: [1.0, 1.0] },
    { fight: [1.35, 1.3], elite: [1.1, 1.15], boss: [1.0, 1.1] },
    { fight: [1.55, 1.4], elite: [1.3, 1.3], boss: [1.15, 1.25] },
];

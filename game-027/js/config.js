// Alchemist's Lattice — tuning and constants. Shared by the sim, the view and the tests.

export const VERSION = '2.0.0';
export const SAVE_KEY = 'alchemists-lattice.v2';

export const MAX_FRAME = 0.05;            // a long frame never runs more than this much time

export const N = 9;                       // the lattice is N × N
export const HAND = 3;                    // tiles dealt at a time

export const SCORE = {
    placed: 2,                            // per cell placed
    cleared: 10,                          // per cell cleared, times the combo (lines in one placement)
    streak: 25,                           // per step of the streak, on a placement that clears
    overflow: 60,                         // Overflow skill: per line past the second
};

export const RESOLVE = 3;                 // failed levels a chapter can take before its map is redrawn
export const CHAPTERS = 3;                // the story; chapter 4 on is the open road
export const CONTENT_LAYERS = 5;          // map layers between the first node and the boss

export const BATTLE = { hit: 8, surge: 2 };
export const START = { gold: 40, items: { dissolvent: 1, catalyst: 1 } };

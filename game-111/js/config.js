// NEON ARCANA — tuning and constants. Shared by the sim, the view and the tests.

export const VERSION = '1.0.0';
export const SAVE_KEY = 'neon-arcana.v1';

export const STEP = 1 / 120;              // fixed simulation step (s); the sim only counts time with it
export const MAX_FRAME = 0.05;            // a long frame never runs more than this much game time

export const N = 8;                       // the lattice is N × N
export const HAND = 3;                    // glyphs dealt at a time

export const SCORE = {
    cell: 1,                              // light per cell placed
    line: 100,                            // one line; L lines at once: line·L + combo·L·(L−1)
    combo: 50,
    sigil: 60,                            // each sigil inside a cleared line
    clearAll: 300,                        // the whole lattice empty after a clear
    resonanceStep: 0.5,                   // multiplier gained per resonance level
    resonanceMax: 8,
};

export const SPARKS = { start: 2, max: 9, perRestore: 1, bigClear: 3 };   // bigClear: lines in one move that earn a spark

/** Light needed to rekindle Arcanum i (0 = The Fool … 21 = The World). */
export function goalFor(i) {
    return Math.round(500 + 150 * i + 6 * i * i);
}

/** How many times a deal is redrawn looking for a hand that fits. Mercy fades as the arcana climb. */
export function mercyFor(i) {
    return Math.max(1, 10 - Math.floor(i / 2));
}

/** From Death (XIII) on, the Void spawns a blight every this many placements that clear nothing. */
export const CREEP_EVERY = 7;

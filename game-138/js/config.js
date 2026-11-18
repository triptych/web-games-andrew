// LANTERNHOLLOW — tuning and constants. Shared by the sim, the view and the tests.

export const VERSION = '1.0.3';
export const SAVE_KEY = 'lanternhollow.v1';

export const STEP = 1 / 120;              // fixed simulation step (s)
export const MAX_FRAME = 0.05;            // a long frame never runs more than this much game time

/** World scale: a WFC cell is 3×3 micro cells; a micro cell is MICRO metres square. */
export const MICRO = 2;
export const CELL = MICRO * 3;
export const WALL_H = 3.2;                // wall height (m)
export const LEVEL_GAP = 9;               // vertical distance between stacked levels in the builder view (m)

export const SIZES = {
    s: { w: 12, h: 9, name: 'Snug' },
    m: { w: 16, h: 12, name: 'Roomy' },
    l: { w: 22, h: 16, name: 'Sprawling' },
};
export const MAX_LEVELS = 5;

export const GEN = {
    tries: 60,            // WFC attempts per level before pins are loosened
    minWalk: 0.22,        // the kept part of a level covers at least this share of its cells
    maxWalk: 0.8,
    stairsGap: 0.45,      // stairs down sit at least this share of the level's diagonal from the stairs up
};

/** The default mix, 0–9 each (the URL stores one digit per slider). */
export const DEFAULT_MIX = { tunnels: 5, chambers: 5, water: 4, pits: 3 };
export const DEFAULT_EL = { monsters: 5, hoards: 5, lights: 6, cozy: 5, flora: 5, windows: 4 };

/** First-person walker */
export const WALK = {
    speed: 3.6, run: 6.0, radius: 0.32, eye: 1.55, waterMul: 0.6, turn: 2.6,
    reach: 1.7,           // befriend a monster / pick up a hoard within this many metres
    pitchMax: 1.2,
};

// EMBERLEAF — tuning and constants. Shared by the sim, the view and the tests.

export const VERSION = '1.1.0';
export const SAVE_KEY = 'emberleaf.v1';

export const STEP = 1 / 120;              // fixed simulation step (s)
export const MAX_FRAME = 0.05;            // a long frame never runs more than this much game time

export const TILE = 16;                   // pixels per tile (view only; the sim works in tiles)

// The overworld is a grid of zones, each one screen-ish of tiles.
export const ZW = 24, ZH = 16;            // tiles per zone
export const ZC = 9, ZR = 7;              // zones across and down

export const PLAYER = {
    speed: 5.2,                           // tiles per second
    swimSpeed: 3.6,
    hw: 0.3, hh: 0.22,                    // half extents of the feet box (tiles)
    reach: 0.85,                          // how far in front an action reaches
};

export const ENEMY = {
    speed: 1.6,                           // wandering
    chase: 2.9,                           // closing in (the player is faster)
    notice: 4.2,                          // tiles
    forget: 7.5,
    touch: 0.62,                          // contact distance that starts a battle
    grace: 2.2,                           // seconds after a battle before another can start
    activeRange: 22,                      // only enemies this close to the player move
};

export const DAY_SECONDS = 600;           // one in-game day in real seconds (just for the light)

export const LEVEL_CAP = 30;

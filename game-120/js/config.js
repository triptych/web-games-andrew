// HEXAPOD RISING — tuning and constants. Shared by the sim, the view and the tests.

export const VERSION = '1.0.2';
export const SAVE_KEY = 'hexapod-rising.v1';

export const STEP = 1 / 120;              // fixed simulation step (s)
export const MAX_FRAME = 0.05;            // a long frame never runs more than this much game time

export const GRAVITY = 26;
export const GRID = { x0: -110, w: 221, zTop: 40 };   // heightfield: x in [-110, 110], z from +40 down to -(length + 50)
export const MECH = { baseScale: 0.8, perUpgrade: 0.06, radius: 1.25, eye: 2.4 };
export const ENEMY_WAKE_DIST = 95;        // enemies further than this from the walker are dormant

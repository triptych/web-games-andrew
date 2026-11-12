// Starbase Spooky — tuning and constants. Shared by the sim, the view and the tests.

export const VERSION = '1.0.0';
export const SAVE_KEY = 'starbase-spooky.v1';

export const STEP = 1 / 60;               // fixed simulation step (s); nothing here is twitchy
export const MAX_FRAME = 0.05;            // a long frame never runs more than this much game time

export const W = 640;                     // the game canvas, in game pixels
export const H = 360;
export const WALK_SPEED = 170;            // Kit walks this many game pixels a second
export const NOTE_TIME = 0.75;            // one light in a memory puzzle: lit for 0.5 s of it
export const SPOOK_FIRST = [18, 32];      // seconds of free roaming before the day's first spooky moment
export const SPOOK_AGAIN = [40, 70];      // and between later ones
export const STICKERS = { first: 2, retry: 1, fix: 2, clue: 1, solve: 3, home: 5 };

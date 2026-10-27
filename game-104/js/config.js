// Hemlock Hollow: tuning and constants. Shared by the sim, the view and the tests.

export const VERSION = '1.0.0';
export const SAVE_KEY = 'hemlock-hollow.v1';

export const VIRT = { w: 320, h: 136 };   // the scene is drawn at this size and scaled up, pixels hard
export const EMBER_BASE = 2;              // ember max = EMBER_BASE + craft level
export const DREAD_MAX = 100;             // at 100 the Crows close in
export const VAULT_CLOCK = 90;            // moves from the first step into the Brine Vaults until the wagons
export const LIGHT_TICKS = 30;            // a conjured witchlight burns this many moves
export const VEIL_TICKS = 12;             // a veil holds this many moves
export const MAX_SCORE = 100;
export const CHECKPOINTS = 4;             // room-entry checkpoints kept for "restore"
export const LOG_KEEP = 60;               // transcript lines saved with a game

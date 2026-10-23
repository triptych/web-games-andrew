// Hauntly Manor — tuning and constants. Shared by the sim, the view and the tests.

export const VERSION = '1.0.0';
export const SAVE_KEY = 'hauntly-manor.v1';

export const STEP = 1 / 120;              // fixed simulation step (s)
export const MAX_FRAME = 0.05;            // a long frame never runs more than this much game time

export const BAKE_SECONDS = 6;            // the cake is in the oven this long
export const SPOOK = { min: 14, max: 26 };// seconds between harmless ambient spooks
export const IDLE_NUDGE = 45;             // seconds without an action before the hint button starts to glow
export const EVIDENCE_NEEDED = 3;         // pieces of evidence before the case board will take an accusation
export const ROOM_ORDER = ['foyer', 'parlor', 'kitchen', 'library', 'attic', 'ballroom'];

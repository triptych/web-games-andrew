// SEEDFALL — tuning and constants. Shared by the sim, the view and the tests.

export const VERSION = '1.0.0';
export const SAVE_KEY = 'seedfall.v1';

export const STEP = 1 / 120;              // fixed simulation step (s)
export const MAX_FRAME = 0.05;            // a long frame never runs more than this much game time

// ---- the clock. Everything idle runs on game days, never on the wall clock: the year is the game.
export const YEAR_DAYS = 365;
export const DAY_SEC = 24;                // station: real seconds per game day at 1×
export const MISSION_DAY_SEC = 30;        // planet: a mission's seconds cost days at this rate
export const LAUNCH_DAYS = 0.5;           // prepping and dropping a bot
export const REPAIR_DAYS = 1.5;           // rebuilding one that didn't come back
export const SPEEDS = [0, 1, 4, 16];      // station time multipliers (index 0 = paused)

// ---- the station walker
export const WALK = { speed: 3.4, radius: 0.32, eye: 1.62, reach: 2.9 };

// ---- planet missions
export const MAP = { half: 30 };          // a zone is 60 × 60 world units, beacon at the south edge
export const BEACON = { x: 0, y: 25, r: 2.6, hold: 1.2 };
export const BOT = { radius: 0.5, reach: 1.9, strikeArc: 1.05, gatherReach: 2.1, shotSpeed: 20, shotLife: 0.75, recallHold: 4 };
export const ECHO_R = 1.7;

// ---- terraforming
export const METRIC_FLOOR = 4;            // nothing is ever perfectly clean
export const EDEN_WIN = 80;               // the Eden Index the colonists need
export const EDEN_HARD = 55;              // below this, Reveille is a disaster
export const GAIN_K = 1.45;                // metric points removed per trait point per release, at a perfect fit
export const REPEAT_DECAY = 0.6;          // a repeated pairing in the same zone works this much less each time
export const BLEND_DAYS = 2;              // a strain incubates this long

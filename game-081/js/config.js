// Salve & Scale — tuning and constants. Shared by the sim, the view and the tests.

export const VERSION = '1.0.4';
export const SAVE_KEY = 'salve-and-scale.v1';

export const STEP = 1 / 120;              // fixed simulation step (s)
export const MAX_FRAME = 0.05;            // a long frame never runs more than this much game time

export const CELL = 2;                    // metres per map cell
export const EYE = 1.62;                  // eye height (m)
export const PLAYER = {
    radius: 0.32,
    speed: 3.4,                           // m/s walking
    sprint: 5.6,
    reach: 2.7,                           // how far away you can talk to or use something (m)
    turn: 2.6,                            // rad/s for turn keys
};
export const PITCH_LIMIT = 1.2;

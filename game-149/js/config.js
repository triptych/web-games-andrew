// Hurray LA's Fairy Lamp Adventure — tuning and constants. Shared by the sim, the view and the tests.

export const VERSION = '1.0.0';
export const SAVE_KEY = 'hurray-la-fairy-lamps.v1';

export const STEP = 1 / 120;              // fixed simulation step (s)
export const MAX_FRAME = 0.05;            // a long frame never runs more than this much game time

export const FIELD = { w: 32, h: 18 };    // world units; the view fits this to any screen
export const PLAYER = { speed: 9, radius: 0.6 };
export const PICKUP = { radius: 0.45, count: 5, score: 10 };
export const ROUND = { seconds: 60 };

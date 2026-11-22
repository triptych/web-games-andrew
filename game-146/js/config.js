// JINGLE POP — tuning and constants. Shared by the sim, the view and the tests.

export const VERSION = '1.0.0';
export const SAVE_KEY = 'jingle-pop.v1';

export const STEP = 1 / 120;              // fixed simulation step (s)
export const MAX_FRAME = 0.05;            // a long frame never runs more than this much game time

// The board: a hex grid of ornaments hanging from the ceiling. Even rows hold COLS ornaments, odd rows COLS - 1,
// shifted half a ball to the right. One ball is 1 world unit across; y grows downward.
export const COLS = 11;
export const ROWS = 16;                   // grid storage; a ball can never live below the deadline anyway
export const R = 0.5;                     // ornament radius
export const ROW_H = Math.sqrt(3) / 2;    // vertical distance between row centres
export const FIELD = { w: 11, h: 16 };
export const SHOOTER = { x: 5.5, y: 15.0 };
export const DEAD_Y = 13.1;               // an ornament whose centre is below this line ends the level
export const HIT_DIST = 0.86;             // centre distance at which a shot touches a hanging ornament (a little under 1,
                                          // so shots slip through gaps the size of a ball, the way players expect)
export const SHOT_SPEED = 26;             // world units per second
export const AIM_MIN = 0.13;              // radians above horizontal at either side
export const TURN_SPEED = 1.7;            // keyboard / stick aiming, radians per second
export const COOLDOWN = 0.12;             // seconds after a shot lands before the next can be fired

// Ornament colours. The view gives each its own pattern too, so they never rely on colour alone.
export const COLORS = ['red', 'gold', 'green', 'blue', 'silver', 'purple'];
export const COLOR_HEX = [0xe0283a, 0xf2b630, 0x2fa85a, 0x2f7de0, 0xd8e2ec, 0x9a4fd8];
export const COLOR_NAMES = ['Cranberry', 'Gold', 'Evergreen', 'Frost Blue', 'Silver', 'Plum'];

export const SCORE = { pop: 10, drop: 20, clear: 1000, star: 500, gift: 50 };
export const SPIRIT_MAX = 36;             // popped + dropped ornaments that fill the Christmas-spirit meter (a free power-up)
export const SACK_MAX = 3;                // power-ups the elf can carry
export const STAR_GRACE = 1.45;           // 2 stars up to par × this many shots; 3 stars at par or better

// Endless mode ("Blizzard")
export const ENDLESS = { startRows: 6, pressure: 9, minPressure: 4, every: 4, colorsAt: [0, 1500, 5000] };

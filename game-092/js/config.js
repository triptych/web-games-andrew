// NEONFALL — tuning and constants. Shared by the sim, the view and the tests.
// Everything is in "screen pixels": one screen is W × H and the view scales it up.

export const VERSION = '1.0.0';
export const SAVE_KEY = 'neonfall.v1';

export const STEP = 1 / 120;              // fixed simulation step (s)
export const MAX_FRAME = 0.05;            // a long frame never runs more than this much game time

// ---- the screen: sky and jungle on top, a slab of earth, a tunnel under it
export const W = 320, H = 180;
export const SURF = 104;                  // y of the jungle floor (a body's feet)
export const CEIL = 124;                  // underside of the slab = tunnel ceiling
export const TF = 172;                    // tunnel floor
export const HORIZON = 84;

// ---- the world
export const N_SCREENS = 96;              // a ring; tunnels hop 3 screens at a time (96 = 3 × 32)
export const TUNNEL_STRIDE = 3;
export const TREASURES = 24;
export const TIME_LIMIT = 1200;           // 20 minutes
export const START_SCORE = 2000;
export const LIVES = 3;

// ---- Harry
export const HW = 4;                      // half width of the body
export const BODY_H = 18;
export const HAND = 12;                   // hands / chest are this far above the feet
export const RUN = 78;                    // px/s
export const ACCEL = 900;
export const AIR_ACCEL = 300;
export const CLIMB = 46;
export const JUMP_H = 24;                 // apex above the floor
export const JUMP_T = 0.6;                // time in the air from a flat jump
export const GRAV = (8 * JUMP_H) / (JUMP_T * JUMP_T);
export const JUMP_V = (GRAV * JUMP_T) / 2;
export const COYOTE = 0.07;               // a jump still works this long after running off an edge
export const BUFFER = 0.12;               // …and this long before landing
export const STUN = 0.55;
export const INV_HIT = 0.9;
export const INV_SPAWN = 1.6;
export const ENTRY_GRACE = 0.35;         // harmless for this long after a screen change

// ---- hazards
export const LOG = { r: 6, h: 12 };
export const PIT_DEPTH = 7;               // how far below the floor before the pit has you
export const HIT_FORGIVE = 1.5;           // hitboxes are this much smaller than the sprites at each side
export const PIT_FORGIVE = 2;             // a pit is this much narrower at each edge than it looks
export const LX = 160;                    // the ladder column
export const HOLE_HW = 11;
export const WALL_X = 236, WALL_W = 12;
export const CROC = { hw: 15, period: 2.6, closed: 1.75, warn: 0.3 };
export const VINE = { y0: 8, L: 74, A: 0.82, T: 2.6, grab: 7, boost: 1.08, hop: 30, cool: 0.3 };

// ---- scoring
export const TREASURE_NAMES = ['Money bag', 'Silver bar', 'Gold bar', 'Diamond ring'];
export const TREASURE_VALUES = [2000, 3000, 4000, 5000];
export const HIT_PENALTY = 50;
export const TIME_BONUS = 5;              // points per second left when the last treasure is found
export const STREAK_MAX = 4;              // each treasure in a row adds +25%, up to +100%
export const LIFE_EVERY = 6;              // an extra life for every 6th treasure
export const LIVES_MAX = 5;

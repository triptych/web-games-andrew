// Rainglass — tuning and constants. Shared by the sim, the view and the tests.

export const VERSION = '1.0.0';
export const SAVE_KEY = 'rainglass.v1';

export const STEP = 1 / 120;              // fixed simulation step (s)
export const MAX_FRAME = 0.05;            // a long frame never runs more than this much game time

// The window pane, in world units (4:3). y grows downward, as on the screen.
export const FIELD = { w: 12, h: 9 };
// The mist on the glass: a grid of bytes, 255 = fully misted, 0 = clear.
export const FOG = { gw: 96, gh: 72 };    // 0.125 units a cell
export const FOG_CELL = FIELD.w / FOG.gw;

export const DROP = {
    m0: 1.0,          // a fresh drop's water
    mMin: 0.42,       // below this it has wiped itself dry and a new one beads at the top
    speed: 2.5,       // steering speed (units/s) for a fresh drop
    cling: 1.7,       // water a drop can hold before it starts to slide
    slide: 1.5,       // slide speed per unit of water over `cling`
    r0: 0.26,         // wipe radius = r0 + rk·√m
    rk: 0.22,
    cost: 0.15,       // water spent per square unit of mist wiped
    respawn: 0.9,     // seconds before the next drop beads
    spawnY: 0.55,
};

export const BEADS = {
    rate: 1.15,       // new beads a second
    max: 26,
    mLo: 0.18, mHi: 0.48,
};

export const TAP = {
    cooldown: 2.5,    // seconds between taps on the glass
    reach: 2.4,       // beads this close roll to the drop
    pull: 3.2,        // how fast they roll (units/s)
};

export const FLOW = {
    rate: 0.55,       // square units a second of fresh mist that count as "in flow"
    up: 0.22,         // flow gained per second while in flow
    down: 0.1,        // flow lost per second otherwise
    max: 3,
};

export const CHIME = { every: 0.7 };      // a note for every this many square units wiped
export const SPOT = { clear: 92, need: 0.62, every: 0.2 };   // a curio is seen when this share of it is clearer than `clear`
export const PANE = { complete: 0.9, melt: 2.6 };            // clear this share and the rest melts away

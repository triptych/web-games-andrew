// Fray & the Spiral Isle — tuning and constants. Shared by the sim, the view and the tests.

export const VERSION = '1.1.1';
export const SAVE_KEY = 'spiral-isle.v1';

export const STEP = 1 / 120;              // fixed simulation step (s)
export const MAX_FRAME = 0.05;            // a long frame never runs more than this much game time

export const PLAYER = {
    radius: 0.45,
    walk: 4.6,             // m/s
    run: 7.4,              // with the run button held
    turn: 2.4,             // rad/s from keys or a stick
    eye: 1.62,             // camera height above the ground (view only)
    reach: 3.2,            // how close a thing must be to interact with it
    touch: 1.25,           // how close a pickup must be to be picked up
};

export const FRAY = {
    speed: 5.4,
    follow: 2.4,           // she stops this far from you
    crumb: 1.0,            // spacing of the trail she follows
    crumbs: 40,
    catchUp: 26,           // further than this and she is brought to your side
};

export const ISLE = {
    size: 320,             // the field is size × size metres, centred on 0
    sea: 0,                // sea level
    shore: 0.3,            // ground lower than this is under water: no standing
    slope: 0.95,           // ground steeper than this (rise over run) is a cliff
    cliffZ: -20,           // the highland edge runs east–west about here
    plateau: 14,           // how high the highlands stand
    trees: 420,
};

export const PICKUPS_PER_ZONE = 12;
export const BARK_GAP = 9;                // seconds between Fray's passing remarks

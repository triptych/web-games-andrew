// Sugarplum Drop — tuning and constants. Shared by the sim, the view and the tests.

export const VERSION = '1.0.0';
export const SAVE_KEY = 'sugarplum-drop.v1';

export const STEP = 1 / 120;              // fixed simulation step (s)
export const MAX_FRAME = 0.05;            // a long frame never runs more than this much game time

// The jar, in world units. x right, y DOWN (like the canvas); the floor is at y = h.
// Treats are dropped at dropY; one resting with its top above `line` counts toward game over.
export const JAR = { w: 10, h: 14, line: 2.6, dropY: 1.15 };

export const PHYS = {
    gravity: 30,
    velIters: 10,            // sequential-impulse passes per step
    posIters: 6,            // overlap push-out passes per step
    restitution: 0.15,      // only above bounceSpeed, so piles don't jitter
    bounceSpeed: 1.5,
    friction: 0.4,
    linDamp: 0.35,          // per second
    angDamp: 1.6,
    maxSpeed: 36,
    slop: 0.004,            // overlap left alone, so resting contacts stay in contact
    push: 0.6,              // share of the remaining overlap fixed per position pass
    bias: 0.1,              // share of an overlap the velocity solver pushes apart per step
    biasMax: 1.2,           // ...at most this fast (units/s)
};

export const DROP = {
    cooldown: 0.5,          // s between drops
    buffer: 0.25,           // a press this close to the end of the cooldown is kept, not lost
    speed: 9,               // keyboard / stick aim speed, units per second
    weights: [34, 26, 19, 13, 8],   // the first five treats are the only ones that are dropped
};

export const DANGER = {
    grace: 1.0,             // a treat younger than this (still falling) never counts
    limit: 3.0,             // seconds over the line before the jar is full
    recover: 2,             // the timer drains this many times faster than it fills
};

export const MERGE = {
    grow: 0.14,             // s for a merged treat to swell to full size
    chainWindow: 0.75,      // merges this close together make a chain
    touch: 0.03,            // gap that still counts as touching
};

// The merge ladder. Points are for making that treat (Suika's triangle numbers).
export const ITEMS = [
    { id: 'peppermint', name: 'Peppermint',       r: 0.34, pts: 0 },
    { id: 'gumdrop',    name: 'Gumdrop',          r: 0.47, pts: 1 },
    { id: 'lollipop',   name: 'Lollipop',         r: 0.62, pts: 3 },
    { id: 'truffle',    name: 'Truffle',          r: 0.74, pts: 6 },
    { id: 'gingerman',  name: 'Gingerbread Man',  r: 0.92, pts: 10 },
    { id: 'wreath',     name: 'Holly Wreath',     r: 1.10, pts: 15 },
    { id: 'bauble',     name: 'Ornament',         r: 1.30, pts: 21 },
    { id: 'present',    name: 'Present',          r: 1.52, pts: 28 },
    { id: 'globe',      name: 'Snow Globe',       r: 1.76, pts: 36 },
    { id: 'house',      name: 'Gingerbread House', r: 2.02, pts: 45 },
    { id: 'bell',       name: 'Jingle Bell',      r: 2.34, pts: 55 },
];
export const TOP_TIER = ITEMS.length - 1;
export const MIRACLE_PTS = 120;            // two Jingle Bells

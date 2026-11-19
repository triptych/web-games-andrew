// Kaboom Keep — tuning and constants. Shared by the sim, the view and the tests.
// World: metres, y up. The cannon sits near the origin and fires along +z at the castle.

export const VERSION = '1.1.0';
export const SAVE_KEY = 'kaboom-keep.v1';
export const PROGRESS_KEY = 'kaboom-keep.progress.v1';

export const STEP = 1 / 60;               // fixed simulation step (s); the physics runs at this rate
export const MAX_FRAME = 0.05;            // a long frame never runs more than this much game time

export const CANNON = {
    pivot: [0, 2.3, 0],                   // the barrel's pivot, on top of the cannon's plinth
    barrel: 1.5,                          // muzzle distance from the pivot
    yawMax: 0.62, pitchMin: -0.08, pitchMax: 1.25,
    yawRate: 0.85, pitchRate: 0.55,       // rad/s at full stick
    reload: 1.4,                          // seconds after a shot before the next
    aim0: { yaw: 0, pitch: 0.16 },
};

// Cannonballs. speed in m/s at the muzzle; special = what a tap does in flight.
export const AMMO = {
    iron:   { name: 'Iron Ball',      r: 0.30, density: 9,  speed: 30, re: 0.12, fr: 0.5, punch: 1.0, special: null },
    boom:   { name: 'Boom Ball',      r: 0.34, density: 5,  speed: 28, re: 0.1,  fr: 0.5, punch: 0.8, special: 'detonate',
              blast: { radius: 3.8, power: 17, damage: 14 } },
    triple: { name: 'Triple Trouble', r: 0.25, density: 9,  speed: 31, re: 0.12, fr: 0.5, punch: 1.0, special: 'split', spread: 0.085 },
    bertha: { name: 'Big Bertha',     r: 0.62, density: 7,  speed: 23, re: 0.05, fr: 0.6, punch: 1.3, special: null },
    boing:  { name: 'Boing Ball',     r: 0.34, density: 5,  speed: 30, re: 0.86, fr: 0.2, punch: 0.9, special: null },
};
export const AMMO_ORDER = ['iron', 'boom', 'triple', 'bertha', 'boing'];

// Building materials. Damage is the velocity change a body takes in one step (impulse / mass,
// m/s) above thr; hp is how much of that it can take. score: points when it breaks; half that
// when it is first knocked well out of place.
export const MATS = {
    stone:  { density: 2.0, fr: 0.75, re: 0.04, thr: 3.0, hp: 9,  score: 10 },
    brick:  { density: 1.8, fr: 0.75, re: 0.04, thr: 3.0, hp: 7,  score: 10 },
    wood:   { density: 0.7, fr: 0.7,  re: 0.08, thr: 2.2, hp: 6,  score: 15 },
    ice:    { density: 0.9, fr: 0.25, re: 0.05, thr: 1.6, hp: 2.5, score: 25, shatter: true },
    roof:   { density: 0.8, fr: 0.7,  re: 0.05, thr: 2.5, hp: 6,  score: 20 },
    tnt:    { density: 0.8, fr: 0.7,  re: 0.05, thr: 1.8, hp: 2,  score: 50, blast: { radius: 3.4, power: 15, damage: 12 } },
    gold:   { density: 3.0, fr: 0.6,  re: 0.1,  thr: 99,  hp: 99, score: 0 },
    rock:   { density: 2.5, fr: 0.8,  re: 0.02, thr: 99,  hp: 99, score: 0 },   // static plinths and cliffs
};

// The little people. Every one of them must be bonked to clear a castle: tipped over, hit hard
// enough, or dropped from a height.
export const CHARS = {
    knight: { h: [0.2, 0.34, 0.18], density: 1.3, thr: 3.0, hp: 4, score: 500 },
    king:   { h: [0.26, 0.42, 0.22], density: 1.3, thr: 3.0, hp: 5, score: 1500 },
    wizard: { h: [0.2, 0.42, 0.18], density: 1.2, thr: 3.0, hp: 4, score: 800 },
};
export const BONK = {
    tiltUp: 0.5,          // the body's up axis below this (60°) is a bonk
    fall: 2.0,            // landing this far below where it stood is a bonk
    poof: 1.4,            // seconds a bonked character lies there seeing stars before it goes poof
};

export const BREAK = {
    minHalf: 0.11,        // a piece whose smallest half-size is below this turns to dust instead
    maxBodies: 520,       // past this, broken blocks turn to dust instead of splitting
    knockDist: 1.2,       // a block this far from where it was built counts as knocked
    pieceHp: 0.55,        // pieces start with this share of the material's hp
};

export const SCORE = { spareBall: 1000, knock: 0.5 };

export const PLAY = {
    clearDelay: 1.6,      // after the last bonk, the dust settles this long before the castle is clear
    failWait: 5,          // with no balls left, wait this long after the last shot (or until still)
    ballLife: 12,         // a cannonball is removed after this long ...
    ballRest: 1.5,        // ... or after resting this long
    bounds: 90,           // anything this far from the origin, or below -5, is gone
};

// STARSLING — tuning and constants. Shared by the sim, the view and the tests.

export const VERSION = '1.0.0';
export const SAVE_KEY = 'starsling.v1';

export const STEP = 1 / 120;              // fixed simulation step (s)
export const MAX_FRAME = 0.05;            // a long frame never runs more than this much game time

// The part of the world the camera fits to any screen: x0,y0 is the bottom-left corner.
export const FIELD = { x0: 0, y0: -5, w: 50, h: 26 };
export const GRAVITY = 14;

// The slingshot. angle is radians above +x; power is 0..1 of vmax.
export const SLING = { x: 6, y: 5.3, maxPull: 3.4, vmax: 27, minPower: 0.18, minAngle: -0.25, maxAngle: 1.5 };

// Floating rock shelves. Static, so the sim and the view share the numbers.
export const ISLANDS = [
    { x0: -3, x1: 13, top: 3, depth: 3.4 },     // the launch pad
    { x0: 24, x1: 51, top: 3, depth: 3.4 },     // the station's dock
];
export const KILL = { yMin: -9, xMin: -8, xMax: 62 };     // past these a body is gone

// Asteroids you can sling. special: what a tap does in flight.
export const AMMO = {
    rock: { label: 'Rock', r: 0.55, density: 2.2, punch: 1.0, special: 'boost', hint: 'Tap: thrusters burn' },
    iron: { label: 'Iron', r: 0.45, density: 6.0, punch: 1.5, special: 'slam', hint: 'Tap: dive bomb' },
    ice: { label: 'Ice', r: 0.62, density: 1.2, punch: 0.8, special: 'split', hint: 'Tap: split in three' },
    bomb: { label: 'Nova', r: 0.55, density: 2.5, punch: 1.0, special: 'blast', hint: 'Tap: detonate' },
};

// Station materials. thr: the impact below which nothing breaks; k: damage per point over it.
export const MATS = {
    hull: { density: 1.0, hp: 120, thr: 18, k: 1.0, fric: 0.7, rest: 0.05, value: 100 },
    glass: { density: 0.5, hp: 16, thr: 5, k: 1.3, fric: 0.4, rest: 0.1, value: 60 },
    crate: { density: 0.7, hp: 32, thr: 6.5, k: 1.0, fric: 0.7, rest: 0.05, value: 80 },
    fuel: { density: 0.8, hp: 14, thr: 5, k: 1.3, fric: 0.6, rest: 0.05, value: 150 },
    robot: { density: 0.6, hp: 14, thr: 1.5, k: 2.4, fric: 0.6, rest: 0.1, value: 500 },
};
export const ROBOT = { w: 0.9, h: 1.1 };

export const SCORE = { spare: 500 };      // per asteroid left over when the last robot falls
export const STARS = [0.7, 1.0];          // fractions of a sector's total value for stars 2 and 3

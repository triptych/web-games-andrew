// HAYATE RIVER STRIKE — tuning and constants. Shared by the sim, the view and the tests.
// Sim space: x is across the river (metres, + to the right), y is distance downriver (+ ahead), z is height.

export const VERSION = '1.0.1';
export const SAVE_KEY = 'hayate-river-strike.v1';      // the run in progress
export const META_KEY = 'hayate-river-strike.meta.v1'; // cores, skills and records (kept between runs)

export const STEP = 1 / 120;              // fixed simulation step (s)
export const MAX_FRAME = 0.05;            // a long frame never runs more than this much game time

// ------------------------------------------------------------------ the boat
export const BOAT = {
    radius: 1.1,
    accel: 34,          // lateral acceleration (m/s²)
    lateralMax: 17,     // m/s across the river
    drag: 6,            // lateral damping
    cruise: 16,         // forward speed with no throttle input (m/s)
    minSpeed: 10,       // brake held
    maxSpeed: 24,       // throttle held
    speedLerp: 2.2,
    hull: 100,
    iframes: 0.7,       // invulnerable after a hit (s)
};

export const FUEL = {
    max: 100,
    drain: 1.0,         // per second at cruise; scales with throttle
    depotRate: 32,      // per second while over a depot
    cell: 30,           // an energy cell
    emptyHullDrain: 5,  // hull lost per second with an empty tank (no instant death)
    low: 25,
};

export const JUMP = {
    v: 13.5,            // launch speed (m/s up)
    gravity: 30,
    clear: 0.9,         // above this height the boat flies over mines, blockades, sandbars and water-level shots
    recharge: 7,        // seconds per charge
    killBonus: 0.12,    // a kill adds this share of a charge
    charges: 1,
    shockRadius: [0, 7, 9],
    shockDamage: [0, 6, 12],
    barrageShots: 14,
};

export const GUN = {
    rate: 9,            // shots per second (each shot fires every barrel)
    speed: 72,
    range: 62,
    damage: 1,
    spacing: 0.55,      // between barrels
    barrels: 2,
};

export const MISSILE = {
    ammo: 6,
    regen: 6,           // seconds per missile
    speed: 34,
    turn: 5.5,          // rad/s
    damage: 7,
    splash: 3.2,
    life: 3.2,
    cooldown: 0.28,
};

export const DAMAGE = {
    bullet: 9, shell: 13, ram: 14, mine: 20, bank: 6, blockade: 12, sandbar: 5, laser: 22,
};

export const BOOSTS = {
    overdrive: { time: 6, speed: 1.55 },
    spread: { time: 10 },
    plasma: { time: 9 },
    rapid: { time: 10 },
    shield: { time: 16, hits: 3 },
    magnet: { time: 12, radius: 16 },
};
export const PICKUP = { radius: 1.6, magnet: 4.5, life: 40 };

export const COMBO = { window: 2.5, step: 5, perStep: 0.5, max: 4 };

export const SECTOR = {
    length: 2300,       // metres to the boss
    miniAt: 0.5,        // the mini-boss lines up at this share of the length
    bossGap: 34,        // a boss holds this far ahead of the boat
    viewAhead: 95,      // things spawn this far ahead
    behind: 24,         // and are dropped this far behind
    sample: 2,          // the river is sampled every 2 m
};

export const CORES = { perKill: 1, perScore: 1 / 400 };

export const SECTORS = 3;

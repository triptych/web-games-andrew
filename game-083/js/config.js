// WYRMZONE — tuning and constants. Shared by the sim, the view and the tests.

export const VERSION = '1.0.1';
export const SAVE_KEY = 'wyrmzone.v1';

export const STEP = 1 / 120;              // fixed simulation step (s)
export const MAX_FRAME = 0.05;            // a long frame never runs more than this much game time

export const SCALES = 6;                  // the dragon's armour: a hit costs one scale
export const INVULN = 1.3;                // seconds of grace after a hit
export const LOOP_HARDER = 0.3;           // each cycle through the kingdom is this much fiercer

// Act I: on foot, Battlezone style. Sim plane is (x, z); heading h, forward = (sin h, -cos h).
export const GROUND = {
    speed: 10,          // forward walk (u/s)
    back: 6,            // backing up
    turn: 1.6,          // rad/s
    radius: 1.3,
    eye: 1.7,
    fireCd: 0.42,
    shotSpeed: 78,
    shotRange: 96,
    maxShots: 2,        // fireballs in the air at once
    spawnMin: 46,
    spawnMax: 74,
    radar: 90,          // radar radius
    inRange: 72,        // "ENEMY IN RANGE"
    cell: 26,           // obstacle grid
};

// Act II: on the wing, Star Wars style. Forward is +z; the dragon flies at a fixed speed and
// steers by aiming: the body drifts toward where the cursor points.
export const FLIGHT = {
    speed: 42,
    aimYaw: 0.46,       // cursor at ±1 = this many radians off the nose
    aimPitch: 0.32,
    keyRate: 2.2,       // cursor speed with keys (aim units/s)
    absRate: 10,        // how fast the cursor chases a stick or mouse
    follow: 2.0,        // how fast the body follows the cursor
    fireCd: 0.15,
    shotSpeed: 280,
    shotRange: 300,
    radius: 2.0,
};

// Where the body may go on each flight track: x = ax * latX, y = base + ay * latY.
export const TRACKS = {
    sky: { latX: 18, base: 0, latY: 9 },
    ramparts: { latX: 26, base: 12, latY: 8.5 },
    gorge: { latX: 6.5, base: 10, latY: 7.5, wall: 10, top: 26 },
};

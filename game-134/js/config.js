// UFOops! — tuning and constants. Shared by the sim, the view and the tests.
// World units: x right, y DOWN. The ground is a line at GROUND; the sky starts at 0.

export const VERSION = '1.0.0';
export const SAVE_KEY = 'ufoops.v1';

export const STEP = 1 / 120;              // fixed simulation step (s)
export const MAX_FRAME = 0.05;            // a long frame never runs more than this much game time

export const WORLD_H = 20;                // the whole height of a level, sky to dirt
export const GROUND = 18;                 // walkers stand on this line
export const CEIL = 1.2;                  // the saucer can't fly higher than this
export const FLOOR = GROUND - 2.2;        // ...or lower than this

export const UFO = {
    speed: 10,            // u/s at full stick
    accel: 34,            // how fast velocity chases the stick (floaty, not icy)
    beamSlow: 0.62,       // speed multiplier while the beam is on
    holdSlow: 0.05,       // each specimen aboard slows you by this share
    rx: 1.25, ry: 0.62,   // hit ellipse
    hull: 3, hullMax: 6,
    hold: 4, holdMax: 8,
    lives: 3,
    invuln: 1.6,          // seconds of blinking after a hit
    respawn: 2.2,         // seconds from a crash to the replacement saucer
};

export const BEAM = {
    top: 0.45,            // half-width of the cone at the saucer
    spread: 0.13,         // extra half-width per unit below the saucer
    lift: 6.2,            // u/s for a weight-1 specimen
    pull: 7,              // u/s sideways towards the saucer's centre
    catchDy: 0.7,         // caught when this close under the saucer
    drain: 20,            // energy per second while on (energy is 0..100)
    recharge: 28,
    relock: 35,           // after overheating, the beam needs this much back
    backfire: 0.45,       // seconds of beaming a tinfoil hat before it zaps you
    megaWidth: 1.6, megaLift: 1.5,
};

export const DROP = { gravity: 30, bonkStun: 5, cooldown: 0.25 };

export const MOTHER = { intakeHalf: 3.2, intakeY: 4.2, dockTime: 1.4 };

// Glitches: the saucer is a little defective. Every second there's a chance of one.
export const DEFECT = { base: 0.012, perDefect: 0.075, max: 3, sputter: 0.8, honk: 0.7, hiccup: 6 };

export const PICKUP_LIFE = 11;            // seconds a pickup floats before fading
export const FX = { turbo: 8, mega: 10, shield: 6, clock: 15, star: 500 };
export const STATUS = { net: 2.6, dazzle: 2.4 };

export const SCORE = { timeBonus: 10, bonk: 150, destroy: 300, extra: 50 };
export const GRADES = ['F', 'D', 'C', 'B', 'A', 'A+'];
export const GRADE_BONUS = { F: 0, D: 100, C: 300, B: 600, A: 1000, 'A+': 1600 };

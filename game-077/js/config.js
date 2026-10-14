// CUE VICE — tunables shared by the simulation and the view.
//
// Units: one map tile is 1 world unit. The sim works in the map plane with
// x to the right (columns) and y down the screen (rows); the view maps sim
// (x, y) to three.js (x, 0, y). Angles are radians, 0 = +x, π/2 = +y (south).

export const SIM_DT = 1 / 120;          // fixed physics step
export const MAX_SUBSTEPS = 24;         // per rendered frame (at FAST=1)

export const PHYS = {
    friction: 5.4,        // constant rolling deceleration, u/s²
    drag: 0.5,            // proportional drag, 1/s
    restWall: 0.78,       // coefficient of restitution against walls
    restBall: 0.94,       // between balls
    restBumper: 1.0,      // bumpers add a kick on top of this
    bumperKick: 6,        // u/s added along the normal
    stopSpeed: 0.06,      // below this a ball is at rest
    maxSpeed: 21,         // a full-power shot
    minSpeed: 1.6,        // the weakest shot that counts
    glassBreak: 8.5,      // normal impact speed that shatters glass
    noiseWall: 5.5,       // wall impact that makes a noise guards hear
};

// Surfaces: friction multipliers by floor style.
export const SURFACE = {
    concrete: 1, asphalt: 1.05, dock: 1.1, checker: 0.9, club: 1.15, carpet: 1.35,
    tile: 0.95, marble: 0.8, grass: 1.5, sand: 2.6, metal: 0.9, deck: 1.05, lino: 0.9,
    oil: 0.15, hedge: 1.9,
};

export const MOTION = {
    minPhase: 0.9,        // a shot always runs at least this long
    maxPhase: 7,          // and at most this long, even if something still rolls
    waitStep: 1.5,        // seconds of time passed by one tap of WAIT
};

export const VISION = {
    range: 6.5, half: 0.66,          // patrol cone: 6.5 tiles, ±38°
    alertRange: 9, alertHalf: 1.05,  // alarm: wider, longer
    cautionRange: 7.5, cautionHalf: 0.8,
    dogRange: 4.2, dogHalf: 1.2, dogSmell: 2.2,
    camRange: 7, camHalf: 0.42,
    rate: 1.5,                       // suspicion per second at long range
    hedgeSee: 1.6,                   // a resting ball in a hedge is seen only this close
    bodyRange: 6,                    // a guard notices a downed colleague
};

export const ALARM = { alert: 18, evasion: 9, caution: 16 };

export const GUARD = {
    walk: 1.5, run: 3.4, dogRun: 4.6,
    koTime: 32, stunTime: 1.6, sleepTime: 36,
    shootRange: 9, shootCool: 1.5, bulletSpeed: 13,
    takedownSpeed: 3, bruteSpeed: 7.5,
};

export const SQUAD_MAX = 4;
export const REWINDS = 3;

// Palette (hex for three.js, css strings for DOM).
export const NEON = {
    pink: 0xff3fa4, hotpink: 0xff5fc8, teal: 0x2ff2e0, aqua: 0x4fd8ff, purple: 0xb44cff,
    orange: 0xff8a3a, yellow: 0xffe45c, lime: 0x8dff5a, white: 0xfff4f8, red: 0xff2e3e,
};
export const CSS = {
    pink: '#ff3fa4', teal: '#2ff2e0', aqua: '#4fd8ff', purple: '#b44cff', orange: '#ff8a3a',
    yellow: '#ffe45c', red: '#ff2e3e', sand: '#ffd8b0', ink: '#120818',
};

export const TIMES = {
    sunset: { sky: [0xff7a59, 0x5b2a86], fog: 0x6a2c6a, amb: 0xffc0c8, ambI: 0.75, sun: 0xffb27a, sunI: 1.6, night: 0.25 },
    dusk:   { sky: [0xc8508a, 0x1c1446], fog: 0x3a1c54, amb: 0xc0a8ff, ambI: 0.6, sun: 0xff9ad0, sunI: 1.1, night: 0.55 },
    night:  { sky: [0x2a1450, 0x05030f], fog: 0x140a26, amb: 0x8a8cff, ambI: 0.42, sun: 0x9ab8ff, sunI: 0.55, night: 1 },
    dawn:   { sky: [0xffb08a, 0x6aa8d8], fog: 0x9a80a8, amb: 0xffe0d0, ambI: 0.9, sun: 0xfff0d0, sunI: 1.5, night: 0.1 },
    day:    { sky: [0x7fd8ff, 0x2a8ad0], fog: 0x9ad0e8, amb: 0xfff4ea, ambI: 1.0, sun: 0xffffff, sunI: 1.8, night: 0 },
    storm:  { sky: [0x3a4458, 0x0a0e18], fog: 0x1a2030, amb: 0x8aa0c0, ambI: 0.5, sun: 0xb0c8ff, sunI: 0.5, night: 0.85 },
};

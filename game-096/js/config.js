// Homeward Hop — tuning and constants. Shared by the sim, the view and the tests.

export const VERSION = '1.0.0';
export const SAVE_KEY = 'homeward-hop.v1';

export const STEP = 1 / 120;              // fixed simulation step (s)
export const MAX_FRAME = 0.05;            // a long frame never runs more than this much game time

// Metres and seconds. A jump is ~2.1 m high and ~5 m long at a run; level gaps are built from these.
export const PHYS = {
    gravity: 30,
    fallMax: 27,
    run: 7.2,
    accelGround: 62,
    accelAir: 30,
    turnRate: 14,                 // how fast Pinch turns to face where he runs
    radius: 0.42,
    height: 0.95,
    stepUp: 0.34,
    jumpV: 11.2,
    jumpCut: 0.42,
    coyote: 0.11,
    buffer: 0.13,
    spinTime: 0.42,
    spinCool: 0.08,
    spinReach: 1.75,
    rollSpeed: 12.2,
    rollTime: 0.72,
    rollCool: 0.28,
    rollAirSpeed: 10.2,
    braceSpeed: 0.42,             // × run while the shield is up
    slamSpeed: 33,
    slamRadius: 3.4,
    glideFall: 2.1,
    glideSpeed: 9.2,
    glideAccel: 24,
    hopMin: 10.5,
    hopMax: 18.6,
    hopCharge: 0.75,
    anchorRunMul: 0.9,
    anchorJumpMul: 0.93,
    swapCool: 0.18,
    hurtTime: 1.7,
    knock: 6,
    springV: 19.5,
    bounceV: 8.6,                 // off an enemy's head or a wood crate
    bounceHold: 12.4,             // ... with jump held
    launchSpeedMul: 1,
};

// What a level builder may rely on (edge to edge, in metres). The builder refuses anything past these.
export const REACH = {
    jump: 4.3,                    // a normal jump
    rise: 1.55,                   // a normal jump up
    roll: 6.2,                    // roll-jump (spiral shell)
    glide: 10.5,                  // sail shell
    glideDrop: 0,                 // extra range per metre dropped, handled in the builder
    hop: 4.3,                     // spring shell hop with charge
    hopRise: 4.2,
};

export const PEARL = { radius: 0.7, magnet: 4.2 };
export const HEARTS = { base: 3 };

// Tiny deterministic checks the tests lean on
export const TEST_SEED = 1;

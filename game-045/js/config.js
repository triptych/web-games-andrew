// ============================================================
// PINBREAK '86 — Configuration
// ============================================================
//
// Everything here is plain data so both the pure simulation (js/sim/) and the
// three.js view (js/view/) can import it. Units are "table units": the field
// is ~12.8 wide and ~28 tall, y points UP the table (away from the flippers).

// --- Starting resources ---
export const STARTING_SCORE = 0;
export const STARTING_LIVES = 3;

// --- Table outline ---
export const TABLE = {
    left:      -6.4,     // left field wall
    right:      6.4,     // right field wall == plunger lane inner wall
    laneOuter:  7.7,     // plunger lane outer wall
    laneX:      7.05,    // plunger lane centre
    laneTop:   20.0,     // top of the lane's inner wall
    arcCx:      0.65,    // the top of the table is a half circle
    arcCy:     21.0,
    arcR:       7.05,
    funnelY:    6.6,     // where the side walls turn into the flipper funnels
};

// --- Physics ---
export const PHYS = {
    tick:        1 / 480,   // fixed sub-step (s). Small enough that nothing tunnels.
    gravity:     15,        // down the table (units / s²)
    maxSpeed:    42,
    ballR:       0.34,
    wallE:       0.5,       // restitution against plain walls
    brickE:      0.96,      // bricks are lively, breakout-style
    flipperE:    0.25,
    bumperKick:  17,        // minimum outgoing speed off a pop bumper
    slingKick:   14,
    shieldKick:  22,
};

// --- Flippers ---
export const FLIPPER = {
    pivotX:   2.8,
    pivotY:   3.2,
    len:      2.35,
    wideLen:  2.8,          // with the WIDE power-up (like breakout's paddle extend)
    r0:       0.34,         // radius at the pivot
    r1:       0.18,         // radius at the tip
    rest:    -0.52,         // radians, measured upward from pointing at the centre
    up:       0.46,
    upSpeed:  24,           // rad / s
    downSpeed: 13,
};

// --- Plunger ---
export const PLUNGER = {
    chargeTime: 0.9,        // seconds to full power
    minSpeed:   26,     // even a tap clears the lane
    maxSpeed:   37,
    autoPower:  0.8,
};

// --- Rules ---
export const RULES = {
    ballSave:      8,       // seconds of ball save after each fresh launch
    comboWindow:   2.6,     // seconds to chain the next brick
    comboStep:     4,       // bricks per multiplier step
    comboMaxMult:  8,
    extraBallAt:   [30000, 75000, 150000],   // then every 100k
    nudgeImpulse:  3.2,
    tiltHeat:      3.2,     // nudges within a short window that trigger TILT
    blastRadius:   1.75,
    pickupChance:  0.09,    // chance a plain brick drops a power-up
    pickupFall:    3.6,
    laserSpeed:    38,
    multiMax:      6,
};

export const POWER_DURATION = {
    fire:   10,
    laser:  12,
    shield: 20,
    wide:   15,
    x2:     20,
};

// Pickup kinds, their HUD labels and colours (CSS strings; the view converts).
export const PICKUPS = {
    multi:  { label: 'MULTIBALL', letter: 'M', color: '#35f2ff', weight: 20 },
    fire:   { label: 'FIREBALL',  letter: 'F', color: '#ff7a1a', weight: 18 },
    laser:  { label: 'LASERS',    letter: 'L', color: '#ff2d55', weight: 18 },
    shield: { label: 'SHIELD',    letter: 'S', color: '#3dff8a', weight: 16 },
    wide:   { label: 'WIDE FLIP', letter: 'W', color: '#b86bff', weight: 14 },
    x2:     { label: 'DOUBLE',    letter: '2', color: '#ffe23d', weight: 14 },
};

// --- Palette ---
export const COLORS = {
    bg:        0x07021a,
    sky:       0x12002e,
    horizon:   0xff2fa8,
    grid:      0xff36c8,
    cyan:      0x35f2ff,
    pink:      0xff2fa8,
    purple:    0x8a2cff,
    gold:      0xffd23d,
    orange:    0xff7a1a,
    white:     0xffffff,
    text:      '#f4eaff',
};

// Brick colours by max HP (index = hp), plus explosive / power-up bricks.
export const BRICK_COLORS = {
    1: 0x35f2ff,
    2: 0xff2fa8,
    3: 0xffd23d,
    4: 0xff5a2a,
    x: 0xff3b3b,
    p: 0x3dff8a,
};

// --- Camera ---
export const CAM = {
    fov:        45,
    tableTilt:  0.52,   // radians the table leans back from vertical (~30°)
    elevation:  0.13,   // radians above horizontal the camera looks down from (~7°)
};

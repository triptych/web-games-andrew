// PHOSPHOR PATROL — constants. Units are logical monitor units: the screen is
// 400 × 300, y is up, origin bottom-left. The world wraps horizontally.

export const VIEW_W = 400;
export const VIEW_H = 300;
export const WORLD_W = 3200;          // eight screens around
export const SIM_DT = 1 / 120;        // fixed sim step

export const FIELD = {
    ground: 22,       // colonists stand on this line
    floor: 34,        // lowest the ship's centre can go
    top: 246,         // top of the sky: a snatcher that lifts a colonist here has won
    hud: 252,         // HUD band starts here
};

export const SHIP = {
    thrust: 900,          // horizontal acceleration, units/s²
    maxSpeed: 420,
    drag: 1.4,            // per second, when not thrusting
    turnBrake: 0.35,      // speed kept when turning around
    climb: 190,           // vertical speed
    r: 6,                 // hit radius
    lead: 120,            // how far the camera looks ahead
    respawnInv: 2.5,
    hyperInv: 0.7,
    hyperCooldown: 1.2,
};

export const LASER = {
    speed: 1500,          // head speed
    maxLen: 230,          // longest the streak gets
    range: 560,           // head travel before it dies
    max: 4,
    tapCooldown: 0.07,    // minimum gap between shots
    holdCooldown: 0.16,   // auto-fire gap while held
};

export const COLONIST = {
    count: 10,
    walk: 9,
    safeFall: 80,         // a fall shorter than this is survivable
    gravity: 60,
    maxFall: 70,
};

export const SCORE = {
    snatcher: 150, ravager: 150, minelayer: 250, mine: 25, hive: 1000, stinger: 150, hunter: 200,
    dart: 100, dartDive: 200, squadron: 1000,
    meteor: [0, 100, 50, 20],     // by size 1, 2, 3
    catch: 500, setDown: 500, softLanding: 250,
    bossPod: 500, bossSeg: 300,
};

export const EXTRA_EVERY = 10000;
export const MAX_BOMBS = 9;
export const MAX_LIVES = 9;

export const DIFFICULTY = {
    cadet: { name: 'CADET', lives: 5, bombs: 3, speed: 0.8, shotSpeed: 0.75, fire: 0.55, hunterAt: 1.6, boss: 0.75 },
    arcade: { name: 'ARCADE', lives: 3, bombs: 3, speed: 1, shotSpeed: 1, fire: 1, hunterAt: 1, boss: 1 },
};

// Colours are linear RGB, roughly 0..1 (values above 1 bloom harder).
export const COL = {
    ship: [0.75, 0.95, 1.0],
    shipTrim: [0.2, 0.75, 1.0],
    flame: [1.0, 0.55, 0.15],
    snatcher: [0.35, 1.0, 0.35],
    snatcherEye: [1.0, 0.95, 0.3],
    ravager: [1.0, 0.25, 0.55],
    minelayer: [0.95, 0.6, 0.15],
    mine: [1.0, 0.3, 1.0],
    hive: [0.75, 0.35, 1.0],
    stinger: [1.0, 0.85, 0.2],
    hunter: [0.3, 0.9, 1.0],
    dart: [1.0, 0.45, 0.2],
    dartWing: [1.0, 0.95, 0.4],
    meteor: [0.75, 0.7, 0.6],
    colonist: [0.4, 1.0, 0.55],
    shot: [1.0, 0.5, 0.3],
    ground: [0.85, 0.45, 0.15],
    mountain: [0.95, 0.5, 0.15],
    mountainFar: [0.45, 0.22, 0.6],
    star: [0.7, 0.75, 1.0],
    hud: [0.35, 0.8, 1.0],
    text: [0.85, 0.9, 1.0],
    yellow: [1.0, 0.9, 0.25],
    red: [1.0, 0.25, 0.25],
    green: [0.35, 1.0, 0.4],
    pink: [1.0, 0.35, 0.8],
    cyan: [0.3, 0.95, 1.0],
    orange: [1.0, 0.55, 0.15],
    grey: [0.45, 0.5, 0.6],
    dim: [0.25, 0.3, 0.4],
    white: [1.0, 1.0, 1.0],
    boss: [0.9, 0.3, 1.0],
    bossCore: [1.0, 0.95, 0.4],
};

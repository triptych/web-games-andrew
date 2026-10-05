// BRICKVADERS — constants. Units are low-res pixels; y is up, origin bottom-left.

export const W = 240;            // the vertical "monitor"
export const H = 320;
export const SIM_DT = 1 / 120;   // fixed sim step

export const FIELD = {
    left: 0, right: W,
    top: 300,        // ceiling the ball bounces off (HUD lives above)
    ground: 10,      // the green line; a ball below it is lost
    invasion: 34,    // formation bottom reaching this = INVASION
};

export const PADDLE = {
    y: 20, h: 6, w: 26, wWide: 40,
    keySpeed: 230, keyAccel: 1400, maxSpeed: 900,
};

export const BALL = {
    r: 1.5,
    baseSpeed: 128,       // px/s at stage 1
    stageSpeedUp: 3.2,    // + per stage index
    hitSpeedUp: 1.6,      // + per paddle hit
    maxMul: 1.55,         // cap relative to the stage's base
    minVy: 0.3,           // |vy| / speed never below this
    stickRelease: 2.5,    // CATCH auto-release
    nudgeAfter: 20,       // s without a paddle touch → nudge
};

export const SLOT = { w: 16, h: 12 };
export const FORMATION_TOP = 286;     // top edge of row 0 at wave start
export const MARCH_DROP = 8;

export const LASER = { speed: 300, rapidSpeed: 380, maxSingle: 1, maxRapid: 4, rapidCooldown: 0.13 };

export const POWER_TIME = { L: 12, E: 15, C: 15, F: 10 };

export const CAPSULE_KINDS = ['L', 'E', 'C', 'M', 'F', 'S', 'B', 'N', 'P'];
export const CAPSULE_WEIGHTS = { L: 14, E: 14, C: 12, M: 12, F: 8, S: 10, B: 10, N: 6, P: 3 };
export const CAPSULE_INFO = {
    L: { name: 'LASER', desc: 'TWIN RAPID LASERS' },
    E: { name: 'EXPAND', desc: 'WIDE PADDLE' },
    C: { name: 'CATCH', desc: 'STICKY PADDLE' },
    M: { name: 'MULTI', desc: 'SPLIT THE BALL x3' },
    F: { name: 'FIRE', desc: 'FIREBALL SMASHES ALL' },
    S: { name: 'SLOW', desc: 'SLOW THE BALL' },
    B: { name: 'BARRIER', desc: 'SAVES 3 BALLS' },
    N: { name: 'NOVA', desc: '+1 NOVA BOMB' },
    P: { name: '1UP', desc: 'EXTRA SHIP' },
};

export const EXTRA_LIFE_AT = [20000, 60000];
export const EXTRA_LIFE_EVERY = 60000;

export const DIFFICULTY = {
    cadet: {
        name: 'CADET', lives: 5, bulletSpeed: 0.75, fireRate: 0.6, march: 0.8,
        maxBullets: 0.7, startBarrier: 1, ballSpeed: 0.9, diveRate: 0.7,
    },
    arcade: {
        name: 'ARCADE', lives: 3, bulletSpeed: 1, fireRate: 1, march: 1,
        maxBullets: 1, startBarrier: 0, ballSpeed: 1, diveRate: 1,
    },
};

export const MAX_BOMBS = 3;
export const MAX_BALLS = 9;

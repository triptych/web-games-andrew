// Sizes, speeds, scoring and the skill table. Everything the sim and the view
// both need to agree on lives here.

export const SIM_DT = 1 / 120;

// The arcade monitor: 320 × 240 native, drawn at SCALE× for crisp effects.
export const W = 320;
export const H = 240;
export const PF_Y = 32;            // playfield top (HUD above it)
export const T = 8;                // tile size in native pixels
export const RW = 40;              // room width in tiles
export const RH = 25;              // room height in tiles
export const ROOM_W = RW * T;      // 320
export const ROOM_H = RH * T;      // 200

// Tile codes
export const FLOOR = 0, WALL = 1, GATE = 2, CHASM = 3, CRACK = 4, LASER = 5, PAD = 6, FACADE = 7, BARRIER = 8, VOID = 9;

export const PLAYER = { size: 8, speed: 80, dashSpeed: 270, dashTime: 0.16, dashCool: 0.65, pips: 3, lives: 3, invuln: 2 };

export const DRAGONS = {
    aurix:    { name: 'AURIX',    hp: 1, speed: 44, bite: 0.42, color: 'gold',    fire: 0,   hunter: false, guard: false },
    verdox:   { name: 'VERDOX',   hp: 2, speed: 50, bite: 0.42, color: 'green',   fire: 2.6, hunter: false, guard: true },
    scarlax:  { name: 'SCARLAX',  hp: 3, speed: 72, bite: 0.36, color: 'red',     fire: 0,   hunter: true,  guard: false, lunge: true },
    cryovex:  { name: 'CRYOVEX',  hp: 3, speed: 56, bite: 0.40, color: 'cyan',    fire: 2.2, hunter: false, guard: true, ice: true, skate: true },
    luma:     { name: 'LUMA',     hp: 3, speed: 54, bite: 0.40, color: 'magenta', fire: 0,   hunter: true,  guard: false, twin: 'nox' },
    nox:      { name: 'NOX',      hp: 3, speed: 54, bite: 0.40, color: 'violet',  fire: 3.0, hunter: false, guard: false, twin: 'luma' },
};

export const SKILL = {
    novice: { name: 'NOVICE', sw: 'B', dragonSpeed: 1.0, bite: 1.0, par: 1.0, fire: 1.0 },
    expert: { name: 'EXPERT', sw: 'A', dragonSpeed: 1.2, bite: 0.75, par: 0.8, fire: 0.8 },
};

export const SCORE = {
    gem: 100, bigGem: 500, gate: 500, dragon: 1000, boss: 50000, realm: 10000, perSecond: 50,
    noMiss: 5000, cassette: 2500, secret: 25000, bat: 300, extra: [20000, 60000], extraEvery: 60000,
};

export const KEY_COLORS = ['gold', 'onyx', 'pearl', 'neon', 'violet', 'chrome', 'sunset'];

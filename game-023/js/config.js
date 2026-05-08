// ============================================================
// Synthwave Invaders — Configuration
// ============================================================

export const GAME_WIDTH  = 1280;
export const GAME_HEIGHT = 720;

// Camera
export const CAM_FOV    = 55;
export const CAM_Z      = 22;
export const CAM_TILT_X = -0.18; // slight downward look at grid

// Grid plane
export const GRID_LINES    = 30;
export const GRID_SIZE     = 60;
export const GRID_HORIZON  = -18; // z position of the horizon edge
export const GRID_NEAR     = 14;  // z position of the near edge

// Player
export const PLAYER_Z       = 12;
export const PLAYER_SPEED   = 14;
export const PLAYER_X_LIMIT = 9;

// Bullets
export const BULLET_SPEED      = 28;
export const BULLET_COOLDOWN   = 0.28; // seconds between shots
export const ENEMY_BULLET_SPEED = 10;

// Invaders formation
export const COLS = 11;
export const ROWS = 5;
export const INVADER_SPACING_X = 1.6;
export const INVADER_SPACING_Y = 1.4;
export const FORMATION_START_Z  = -10; // z at start of wave (far)
export const FORMATION_ADVANCE  = 0.3; // z advance speed (units/sec) — accelerates per wave
export const FORMATION_WOBBLE   = 0.9; // side-to-side amplitude
export const FORMATION_WOBBLE_SPEED = 0.5;

// Starting resources
export const STARTING_LIVES = 3;
export const POINTS_ROW = [30, 20, 20, 10, 10]; // top row = 30pts

// Synthwave colors
export const COLORS = {
    bg:          0x050010,
    grid:        0xff00ff,
    gridDim:     0x440044,
    horizonGlow: 0xff00ff,
    player:      0x00ffff,
    playerGlow:  0x004466,
    bullet:      0xffff00,
    enemyA:      0xff00ff, // octopus top rows
    enemyB:      0x00ffff, // crab mid rows
    enemyC:      0xff6600, // squid bottom row
    enemyBullet: 0xff4444,
    explosion:   0xffaa00,
    starNear:    0xffffff,
    starFar:     0x8844aa,
    sun:         0xff0066,
    boss:        0xff00aa,
    shield:      0x00ff88,
    ufo:         0xff0066,
};

// Shots per wave for enemies (random one fires per interval)
export const ENEMY_SHOOT_INTERVAL_MIN = 0.8;
export const ENEMY_SHOOT_INTERVAL_MAX = 2.2;

// Boss wave (every N waves)
export const BOSS_WAVE_INTERVAL = 5;
export const BOSS_HP            = 8;  // hits to kill boss
export const BOSS_POINTS        = 500;

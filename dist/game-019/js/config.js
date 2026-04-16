// ============================================================
// Synthwave Breakout — Configuration
// ============================================================

// --- Canvas ---
export const GAME_WIDTH  = 1280;
export const GAME_HEIGHT = 720;

// --- Starting resources ---
export const STARTING_SCORE = 0;
export const STARTING_LIVES = 3;

// --- Color palette (synthwave neon) ---
export const COLORS = {
    bg:         [10, 5, 25],
    text:       [220, 210, 255],
    accent:     [255, 60, 220],    // hot pink
    accent2:    [60, 220, 255],    // cyan
    accent3:    [180, 60, 255],    // purple
    gold:       [255, 215, 0],
    danger:     [255, 60, 80],
    success:    [60, 255, 180],
    grid:       [30, 15, 60],
    paddleColor:[255, 60, 220],
    ballColor:  [255, 240, 100],
};

// --- Paddle ---
export const PADDLE_WIDTH   = 120;
export const PADDLE_HEIGHT  = 14;
export const PADDLE_SPEED   = 600;
export const PADDLE_Y       = GAME_HEIGHT - 60;

// --- Ball ---
export const BALL_RADIUS    = 8;
export const BALL_SPEED_INIT = 420;
export const BALL_SPEED_MAX  = 800;
export const BALL_SPEED_INC  = 12;   // added per brick hit

// --- Bricks ---
export const BRICK_COLS     = 14;
export const BRICK_ROWS     = 8;
export const BRICK_WIDTH    = 72;
export const BRICK_HEIGHT   = 22;
export const BRICK_PAD_X    = 8;
export const BRICK_PAD_Y    = 6;
export const BRICK_OFFSET_X = 56;
export const BRICK_OFFSET_Y = 80;

// --- Powerups ---
export const POWERUP_CHANCE   = 0.18;  // per brick destroyed
export const POWERUP_FALL_SPD = 180;

// Brick HP by row (top rows = glass, bottom = armored)
export const BRICK_ROW_HP = [1, 1, 1, 2, 2, 2, 3, 3];

// --- Particles ---
export const PARTICLE_COUNT_BRICK  = 18;
export const PARTICLE_COUNT_PADDLE = 8;
export const PARTICLE_COUNT_DEATH  = 40;

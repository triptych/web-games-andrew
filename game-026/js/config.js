// ============================================================
// Crypt of the Forgotten — Configuration
// ============================================================

// --- Starting resources ---
export const STARTING_SCORE = 0;
export const STARTING_LIVES = 3;

// --- Camera ---
export const CAM_FOV     = 75;
export const CAM_NEAR    = 0.1;
export const CAM_FAR     = 200;
export const CAM_POS     = [0, 1.6, 0];   // x, y, z — eye height for first-person crawl

// --- Grid / dungeon ---
export const TILE_SIZE   = 4;             // world units per dungeon tile
export const WALL_HEIGHT = 4;
export const STEP_TIME   = 0.18;          // seconds to slide one tile forward
export const TURN_TIME   = 0.18;          // seconds to rotate 90 degrees
export const BUMP_TIME   = 0.16;          // seconds for the blocked-move head-knock
export const BUMP_DIST   = 0.35;          // world units the camera lurches into the wall
export const BUMP_DIP    = 0.12;          // world units the eye dips during the knock

// Facing directions (clockwise): 0=North, 1=East, 2=South, 3=West
export const DIRS = [
    { dx:  0, dz: -1 },   // North
    { dx:  1, dz:  0 },   // East
    { dx:  0, dz:  1 },   // South
    { dx: -1, dz:  0 },   // West
];

// --- Color palette (hex integers — three.js wants 0xRRGGBB, not [r,g,b]) ---
export const COLORS = {
    bg:       0x0a0a14,
    text:     '#dcdcf0',
    accent:   0x64c8ff,
    danger:   0xff5050,
    success:  0x50dc64,
    gold:     0xffd700,
    wall:     0x8a8496,   // weathered stone — light enough to read under the lantern
    floor:    0x5a5560,
    ceiling:  0x3c3848,
};

// --- TODO: Add game-specific constants below ---
// export const MONSTER_DEFS = { ... };
// export const PLAYER_STATS  = { hp: 20, atk: 4, def: 2 };

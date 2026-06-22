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

// --- Player starting stats ---
export const PLAYER_HP_MAX = 20;
export const PLAYER_ATK    = 4;
export const PLAYER_DEF    = 2;
export const STARTING_DEPTH = 1;

// --- Minimap ---
export const MINIMAP_CELL = 6;    // px per tile in the minimap canvas

// --- Phase 4: Per-face shading multipliers ---
// Lower = darker. North/South walls are slightly darker to create side-lit crypt feel.
export const SHADING = {
    wallNorth:  0.72,
    wallSouth:  0.72,
    wallEast:   0.90,
    wallWest:   0.90,
    floor:      1.00,
    ceiling:    0.55,
    floorAlt:   0.85,   // worn/rubble patch alternate tile
    stairsTile: 1.00,
};

// --- Phase 4: Wall variant types ---
export const WALL_VARIANTS = { none: 0, crack: 1, moss: 2, arch: 3, torch: 4 };

// --- Phase 4: Level theme configurations ---
export const LEVEL_THEMES = {
    1: {
        name:             'Upper Crypt',
        wallTint:         0xb0a080,
        floorTint:        0x907868,
        ceilTint:         0x504040,
        fogColor:         0x0a0a14,
        fogNear:          12,
        fogFar:           40,
        ambientIntensity: 0.9,
        allowedVariants:  ['crack', 'moss', 'torch'],
    },
    2: {
        name:             'Deep Passages',
        wallTint:         0x8090a8,
        floorTint:        0x506070,
        ceilTint:         0x283040,
        fogColor:         0x060810,
        fogNear:          10,
        fogFar:           32,
        ambientIntensity: 0.65,
        allowedVariants:  ['crack', 'arch', 'torch'],
    },
    3: {
        name:             'Cold Depths',
        wallTint:         0x607090,
        floorTint:        0x3a4858,
        ceilTint:         0x1c2030,
        fogColor:         0x04060c,
        fogNear:          8,
        fogFar:           24,
        ambientIntensity: 0.45,
        allowedVariants:  ['crack', 'torch'],
    },
};

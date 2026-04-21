// ============================================================
// Depths Unknown — Configuration
// ============================================================

// --- Canvas ---
export const GAME_WIDTH  = 480;
export const GAME_HEIGHT = 720;

// --- World grid ---
export const TILE_SIZE    = 16;    // px per tile
export const WORLD_COLS   = 120;
export const WORLD_ROWS   = 400;
export const BASE_ROWS    = 4;     // rows above row 0 that are the surface base

// --- Depth tiers ---
// Each tier: { name, rowStart, rowEnd, bgTop (hex), bgBot (hex), fillBlock, oreRate }
export const DEPTH_TIERS = [
    { index: 0, name: 'Surface Soil',   rowStart: 0,   rowEnd: 30,  bgTop: 0x8B6914, bgBot: 0x5A3A1A, fillBlock: 1 /* DIRT */,       lavaRate: 0.00, caveRate: 0.00 },
    { index: 1, name: 'Stone Layer',    rowStart: 31,  rowEnd: 80,  bgTop: 0x5A5A6E, bgBot: 0x3A3A4E, fillBlock: 2 /* STONE */,      lavaRate: 0.01, caveRate: 0.00 },
    { index: 2, name: 'Iron Depths',    rowStart: 81,  rowEnd: 140, bgTop: 0x8B2500, bgBot: 0x5A1000, fillBlock: 2 /* STONE */,      lavaRate: 0.03, caveRate: 0.00 },
    { index: 3, name: 'Crystal Caverns',rowStart: 141, rowEnd: 200, bgTop: 0x4B0082, bgBot: 0x2B0050, fillBlock: 2 /* STONE */,      lavaRate: 0.02, caveRate: 0.05 },
    { index: 4, name: 'Ancient Ruins',  rowStart: 201, rowEnd: 270, bgTop: 0x2D4A1E, bgBot: 0x1A2D10, fillBlock: 2 /* STONE */,      lavaRate: 0.01, caveRate: 0.08 },
    { index: 5, name: 'Alien Stratum',  rowStart: 271, rowEnd: 340, bgTop: 0x0D1B2A, bgBot: 0x061015, fillBlock: 2 /* STONE */,      lavaRate: 0.02, caveRate: 0.10 },
    { index: 6, name: 'The Void Layer', rowStart: 341, rowEnd: 399, bgTop: 0x0A0010, bgBot: 0x000005, fillBlock: 24 /* VOID_STONE */, lavaRate: 0.00, caveRate: 0.15 },
];

// Bedrock strip every N rows (with a 3-cell gap)
export const BEDROCK_STRIP_INTERVAL = 50;

// --- Player starting stats ---
export const START_CREDITS     = 500;
export const START_HULL_MAX    = 100;
export const START_FUEL_MAX    = 100;
export const START_CARGO_SLOTS = 10;
export const START_DRILL_POWER = 1;
export const START_LIGHT_RADIUS = 3;
export const START_SPEED_TILES_PER_SEC  = 4;   // horizontal + drill movement
export const START_WINCH_TILES_PER_SEC  = 2.5; // upward winch speed

// --- Fuel burn rates (units/sec) ---
export const FUEL_BURN_MOVE   = 0.8;   // while moving or drilling
export const FUEL_BURN_IDLE   = 0.1;   // parked underground
export const FUEL_BURN_WINCH  = 1.2;   // ascending

// --- Damage values ---
export const LAVA_DAMAGE_PER_SEC  = 3;
export const FUEL_EMPTY_DAMAGE_PER_SEC = 2;
export const CAVE_IN_DAMAGE_MIN   = 5;
export const CAVE_IN_DAMAGE_MAX   = 25;
export const VOID_ANOMALY_DAMAGE  = 10;

// --- Loose rock chance per tier ---
export const LOOSE_ROCK_RATES = [0.02, 0.05, 0.08, 0.10, 0.12, 0.18, 0.25];

// --- Base position (tiles) ---
export const BASE_COL   = 58;   // roughly center of world
export const BASE_ROW   = -2;   // above ground row 0

// --- Rescue mechanic ---
export const RESCUE_FEE           = 200;
export const RESCUE_CARGO_LOSS    = 0.20; // 20% of cargo lost

// --- Scene keys ---
export const SCENE = {
    BOOT:     'BootScene',
    PRELOAD:  'PreloadScene',
    SPLASH:   'SplashScene',
    GAME:     'GameScene',
    UI:       'UIScene',
    BASE:     'BaseScene',
    GAMEOVER: 'GameOverScene',
};

// Colors used across scenes
export const COLORS = {
    bg:       [10, 10, 20],
    text:     [220, 220, 240],
    accent:   [100, 200, 255],
    danger:   [255, 80, 80],
    success:  [80, 220, 100],
    gold:     [255, 215, 0],
    warn:     [255, 165, 0],
    hullBar:  0xCC2222,
    fuelBar:  0xFF9900,
    cargoBar: 0x667755,
    uiBg:     0x111122,
    uiBorder: 0x334466,
};

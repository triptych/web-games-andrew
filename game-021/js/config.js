// ============================================================
// Dungeon Blobber — Configuration
// ============================================================

// --- Canvas ---
export const GAME_WIDTH  = 1280;
export const GAME_HEIGHT = 720;

// --- Starting resources ---
export const STARTING_SCORE = 0;
export const STARTING_LIVES = 3;

// --- Color palette ---
export const COLORS = {
    bg:       [10, 10, 20],
    text:     [220, 220, 240],
    accent:   [100, 200, 255],
    danger:   [255, 80, 80],
    success:  [80, 220, 100],
    gold:     [255, 215, 0],
};

// --- Dungeon / raycasting ---
export const DUNGEON_COLS      = 24;   // map width in tiles
export const DUNGEON_ROWS      = 24;   // map height in tiles
export const TILE_EMPTY        = 0;
export const TILE_WALL         = 1;
export const TILE_DOOR         = 2;
export const TILE_STAIRS_DOWN  = 3;
export const TILE_STAIRS_UP    = 4;
export const TILE_MONSTER      = 5;    // spawn marker (replaced at runtime)
export const TILE_ITEM         = 6;    // spawn marker

// --- 3D viewport (raycaster) ---
export const VIEW_WIDTH        = 800;  // px — left panel
export const VIEW_HEIGHT       = 720;
export const FOV_DEGREES       = 60;
export const RAY_COUNT         = 200;  // horizontal slices
export const MAX_DEPTH         = 20;   // max ray distance in tiles

// --- Automap (right panel) ---
export const MAP_PANEL_X       = VIEW_WIDTH;
export const MAP_PANEL_WIDTH   = GAME_WIDTH - VIEW_WIDTH;  // 480 px
export const MAP_TILE_SIZE     = 14;   // px per tile on the minimap

// --- Turn-based combat ---
export const BASE_PLAYER_HP    = 30;
export const BASE_PLAYER_ATK   = 5;
export const BASE_PLAYER_DEF   = 2;

// --- Floors ---
export const TOTAL_FLOORS      = 5;

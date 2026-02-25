// ============================================================
// Tiny Town — Configuration
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

// --- Grid ---
export const TILE_SIZE    = 40;           // pixels per grid tile
export const GRID_COLS    = 24;           // number of columns
export const GRID_ROWS    = 16;           // number of rows
export const GRID_OFFSET_X = 40;         // left margin (pixels)
export const GRID_OFFSET_Y = 48;         // top margin below HUD (pixels)

// --- Building types ---
// Each building type has: label, color [r,g,b], cost, scoreValue
export const BUILDINGS = {
    road:  { label: 'Road',  color: [120, 120, 130], cost: 10,  scoreValue: 1  },
    house: { label: 'House', color: [180, 130,  80], cost: 50,  scoreValue: 10 },
    park:  { label: 'Park',  color: [ 80, 180,  80], cost: 30,  scoreValue: 5  },
    shop:  { label: 'Shop',  color: [200, 160,  60], cost: 80,  scoreValue: 20 },
    clear: { label: 'Clear', color: [ 40,  40,  60], cost: 0,   scoreValue: 0  },
};

// --- Starting gold ---
export const STARTING_GOLD = 500;

// --- HUD ---
export const PANEL_WIDTH = 200; // right-side build panel width

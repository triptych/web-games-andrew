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
// Each entry: label, color [r,g,b], cost, scoreValue, icon (text drawn on tile)
export const BUILDINGS = {
    road:       { label: 'Road',       color: [100, 100, 110], cost: 10,  scoreValue: 1,  icon: null   },
    house:      { label: 'House',      color: [190, 140,  80], cost: 50,  scoreValue: 10, icon: 'H'    },
    apartment:  { label: 'Apartment',  color: [140, 110, 180], cost: 120, scoreValue: 25, icon: 'A'    },
    park:       { label: 'Park',       color: [ 70, 170,  70], cost: 30,  scoreValue: 5,  icon: 'PR'   },
    shop:       { label: 'Shop',       color: [210, 170,  50], cost: 80,  scoreValue: 20, icon: 'SH'   },
    office:     { label: 'Office',     color: [ 80, 160, 200], cost: 150, scoreValue: 35, icon: 'OF'   },
    bank:       { label: 'Bank',       color: [200, 200, 100], cost: 200, scoreValue: 50, icon: 'BK'   },
    government: { label: 'Gov.t',      color: [180,  80,  80], cost: 250, scoreValue: 60, icon: 'GV'   },
    clear:      { label: 'Clear',      color: [ 40,  40,  60], cost: 0,   scoreValue: 0,  icon: null   },
};

// --- Terrain types (background biome for empty tiles) ---
// color: base fill color, accent: small detail color
export const TERRAIN = {
    field:      { color: [45, 70, 35],  accent: [60, 95, 45]  },
    grassland:  { color: [40, 80, 40],  accent: [55, 110, 55] },
    mountain:   { color: [65, 60, 55],  accent: [90, 85, 75]  },
    lake:       { color: [30, 50, 90],  accent: [40, 70, 120] },
};
export const TERRAIN_KEYS = Object.keys(TERRAIN);

// --- Starting gold ---
export const STARTING_GOLD = 500;

// --- HUD ---
export const PANEL_WIDTH = 200; // right-side build panel width

// --- Clear refund ---
export const CLEAR_REFUND_RATE = 0.5; // fraction of original build cost refunded on clear

// --- Phase 3: Population & Income ---
export const INCOME_TICK_SECONDS  = 5;      // seconds between passive gold ticks
export const INCOME_PER_SHOP      = 10;     // gold earned per shop per tick (before happiness mult)
export const HAPPINESS_PER_PARK   = 0.10;   // each park adds 10% happiness (capped at 100%)
export const HAPPINESS_INCOME_MULT_MIN = 0.5; // income multiplier at 0% happiness

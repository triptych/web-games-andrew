// ============================================================
// Alchemist's Lattice — Configuration  (Phase 1: core puzzle)
// ============================================================
//
// Engine: Phaser 4 (ES module). Following the game-019 repo convention.
// Phase 1 scope: lattice, polyomino tray (sets of 3), drag-and-drop with
// ghost preview, line clears + combo/streak scoring, and the "jammed"
// failure. No alchemy / deposits / cauldron yet (those are Phase 2+).

// --- Canvas ---
export const GAME_WIDTH  = 1280;
export const GAME_HEIGHT = 720;

// --- Lattice (placement grid) ---
export const GRID_W    = 9;   // §1 — start at 9×9
export const GRID_H    = 9;
export const CELL_SIZE = 56;  // px per cell
export const CELL_GAP  = 2;   // px gap drawn between cells

// Top-left origin of the grid, computed so the lattice sits centered-left,
// leaving the right rail for the supply / score panels.
export const GRID_PX   = GRID_W * CELL_SIZE;   // grid pixel width/height
export const GRID_X    = 110;
export const GRID_Y    = (GAME_HEIGHT - GRID_W * CELL_SIZE) / 2 - 30;

// --- Tray (drag-and-drop shapes) ---
export const TRAY_SIZE = 3;    // §2 — dealt 3 at a time, place all 3
export const TRAY_Y    = GAME_HEIGHT - 95;       // baseline for tray shapes
export const TRAY_CELL = 30;   // px per cell when drawn in the tray
// Horizontal slot centers for the 3 tray shapes.
export const TRAY_SLOT_X = [
    GRID_X + GRID_PX * 0.18,
    GRID_X + GRID_PX * 0.50,
    GRID_X + GRID_PX * 0.82,
];

// --- Right rail panels ---
export const PANEL_X = GRID_X + GRID_PX + 50;
export const PANEL_W = GAME_WIDTH - (GRID_X + GRID_PX + 50) - 40;

// --- Scoring (§3) ---
export const SCORE_PER_CELL  = 10;   // base points per cleared cell
export const STREAK_BONUS    = 25;   // per current streak step, added on a clearing placement

// --- Supply (Phase 1 placeholder, §2/§4) ---
// Real seeding/mix lands with the cauldron in Phase 3. For Phase 1 the supply
// is a generous, deterministic-per-seed flat pool so the core loop is playable.
export const SUPPLY_TILES = 36;      // total tiles dealt over the level (12 sets)

// --- Colors (warm apothecary, §UI) ---
export const COLORS = {
    bg:          [20, 16, 12],     // dark wood
    parchment:   [222, 206, 170],
    panel:       [38, 30, 22],
    panelEdge:   [120, 96, 60],    // brass
    gridBg:      [30, 24, 18],
    cellEmpty:   [46, 38, 28],
    cellEmptyHi: [58, 48, 34],
    text:        [232, 220, 192],
    textDim:     [150, 132, 100],
    brass:       [196, 158, 88],
    gold:        [240, 200, 96],
    ghostOk:     [120, 220, 130],  // valid placement
    ghostBad:    [220, 90, 80],    // invalid placement
    danger:      [220, 90, 80],
    success:     [120, 220, 130],
};

// --- Tile-type tints (Phase 1: a small placeholder palette of elements) ---
// Each tile gets a distinct color + glyph so it reads at a glance (§UI).
export const TILE_TYPES = [
    { id: 'salt',  color: [210, 206, 198], glyph: '✦' },
    { id: 'ember', color: [232, 128, 64],  glyph: '✸' },
    { id: 'dew',   color: [110, 188, 196], glyph: '❀' },
    { id: 'root',  color: [150, 120, 78],  glyph: '⬢' },
    { id: 'ash',   color: [128, 122, 130], glyph: '◆' },
];

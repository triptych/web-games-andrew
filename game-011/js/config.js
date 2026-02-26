// ============================================================
// Nonogram Fleet — Configuration
// ============================================================

// --- Canvas ---
export const GAME_WIDTH  = 1280;
export const GAME_HEIGHT = 720;

// --- Starting resources ---
export const STARTING_SCORE = 0;
export const STARTING_LIVES = 3;

// --- Color palette ---
export const COLORS = {
    bg:        [8, 12, 28],
    text:      [200, 220, 255],
    accent:    [80, 180, 255],
    danger:    [255, 80, 80],
    success:   [80, 220, 120],
    gold:      [255, 215, 0],
    gridLine:  [40, 60, 100],
    cellFill:  [60, 140, 220],
    cellEmpty: [20, 30, 55],
    cellWrong: [200, 50, 50],
    shipHit:   [255, 140, 0],
    shipSunk:  [255, 60, 60],
};

// --- Nonogram grid ---
export const GRID_COLS    = 10;   // nonogram puzzle width
export const GRID_ROWS    = 10;   // nonogram puzzle height
export const CELL_SIZE    = 42;   // px per cell
export const CLUE_MARGIN  = 80;   // space for row/col clues in px

// --- Battleship fleet (shapes are [row, col] offsets from origin) ---
export const FLEET = [
    { name: 'Carrier',    size: 5, count: 1 },
    { name: 'Battleship', size: 4, count: 1 },
    { name: 'Cruiser',    size: 3, count: 2 },
    { name: 'Submarine',  size: 2, count: 2 },
    { name: 'Scout',      size: 1, count: 2 },
];

// --- Shots per puzzle (limited ammo = difficulty) ---
export const SHOTS_PER_PUZZLE = 15;

// --- Puzzle levels ---
export const TOTAL_LEVELS = 8;   // escalating enemy fleet configurations
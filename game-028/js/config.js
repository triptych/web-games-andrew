// ============================================================
// Echoes of Aethermoor — Configuration
// ============================================================

// --- Canvas ---
export const GAME_WIDTH  = 1280;
export const GAME_HEIGHT = 720;

// --- Starting resources ---
export const STARTING_SCORE = 0;
export const STARTING_LIVES = 3;

// --- Color palette ---
export const COLORS = {
    bg:       [8, 5, 18],
    text:     [220, 210, 240],
    accent:   [180, 140, 255],
    danger:   [255, 80, 100],
    success:  [100, 220, 140],
    gold:     [255, 215, 80],
    dark:     [20, 15, 35],
    muted:    [100, 90, 130],
};

// --- Player starting stats ---
export const STARTING_HP     = 100;
export const STARTING_MP     = 50;
export const STARTING_GOLD   = 0;
export const STARTING_LEVEL  = 1;
export const STARTING_XP     = 0;
export const XP_PER_LEVEL    = 100;

// --- Battle constants ---
export const BATTLE_PLAYER_SPEED = 10;
export const BATTLE_ENEMY_SPEED  = 8;

// --- Dialog box ---
export const DIALOG_BOX_HEIGHT = 180;
export const DIALOG_CHAR_SPEED = 30;   // characters per second for typewriter

// --- Map ---
export const TILE_SIZE = 32;

// --- Party members (initial unlock) ---
// Full definitions live in characters.js
export const STARTING_PARTY = ['lyra'];

// --- Chapters ---
export const TOTAL_CHAPTERS = 4;

// --- Item categories ---
export const ITEM_CATEGORIES = ['consumable', 'weapon', 'armor', 'key'];

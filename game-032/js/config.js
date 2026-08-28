// ============================================================
// Ironhollow Depths — Configuration
// ============================================================

// --- Canvas ---
export const GAME_WIDTH  = 1280;
export const GAME_HEIGHT = 720;

// --- Tile grid ---
export const TILE_SIZE   = 32;

// --- Starting resources ---
export const STARTING_SCORE  = 0;
export const STARTING_LIVES  = 3;
export const STARTING_HEALTH = 100;
export const STARTING_LEVEL  = 1;

// --- Player ---
export const PLAYER_SPEED       = 140;
export const PLAYER_ATTACK_DMG  = 25;
export const PLAYER_ATTACK_RANGE = 36;
export const PLAYER_ATTACK_COOLDOWN = 0.35;
export const PLAYER_INVULN_TIME = 0.8;

// --- Enemies ---
export const ENEMY_DEFS = {
    slime: {
        name: 'Slime',
        health: 30,
        speed: 45,
        damage: 10,
        score: 50,
        color: [88, 200, 90],
    },
    // TODO: add more monster types (skeleton, bat, etc.) as game develops
};

// --- Color palette (CRT / 8-bit dungeon aesthetic) ---
export const COLORS = {
    bg:        [12, 10, 18],
    floor:     [40, 28, 24],
    floorAlt:  [46, 32, 28],
    wall:      [96, 60, 32],
    wallDark:  [64, 38, 20],
    mortar:    [24, 14, 10],
    torch:     [255, 150, 40],
    text:      [180, 255, 210],
    accent:    [90, 220, 255],
    danger:    [255, 90, 90],
    success:   [90, 220, 100],
    gold:      [255, 215, 0],
};

// --- HUD ---
export const HUD_FONT_SIZE = 18;

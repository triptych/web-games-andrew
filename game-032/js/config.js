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

// --- Floors ---
export const FINAL_FLOOR        = 10;   // clear it and claim the Hollow Crown to win
export const POTION_HEAL        = 40;
export const POTION_FLOORS      = [3, 5, 7, 9];

// --- Enemies ---
// `from` is the first floor a type appears on; `weight` its share of the mix.
export const ENEMY_DEFS = {
    slime: {
        name: 'Slime',
        health: 30,
        hpPerFloor: 6,
        speed: 45,
        damage: 10,
        score: 50,
        color: [88, 200, 90],
        outline: [30, 90, 40],
        from: 1,
        weight: 3,
    },
    bat: {
        name: 'Bat',
        health: 14,
        hpPerFloor: 3,
        speed: 95,
        damage: 6,
        score: 40,
        color: [150, 110, 200],
        outline: [60, 40, 90],
        from: 2,
        weight: 2,
    },
    skeleton: {
        name: 'Skeleton',
        health: 45,
        hpPerFloor: 7,
        speed: 50,
        damage: 12,          // contact damage; bones use BONE_DAMAGE
        score: 90,
        color: [225, 220, 200],
        outline: [110, 100, 80],
        from: 3,
        weight: 2,
    },
};

export const BONE_SPEED    = 170;
export const BONE_DAMAGE   = 10;
export const BONE_COOLDOWN = 2.4;   // seconds between throws, per skeleton

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
    stairs:    [30, 22, 18],
    stairsOpen:[255, 190, 80],
    potion:    [230, 60, 80],
};

// --- HUD ---
export const HUD_FONT_SIZE = 18;

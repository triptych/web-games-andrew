// ============================================================
// Wayfarer's Path — Configuration
// ============================================================

// --- Starting resources ---
export const STARTING_HP    = 30;
export const STARTING_COINS = 0;

// --- Camera ---
export const CAM_FOV  = 60;
export const CAM_NEAR = 0.1;
export const CAM_FAR  = 300;
export const CAM_POS  = [0, 4, 8];   // x, y, z — behind/above the walker

// --- Color palette (hex integers — three.js wants 0xRRGGBB, not [r,g,b]) ---
export const COLORS = {
    bg:       0x0a0a14,
    text:     '#dcdcf0',
    accent:   0x64c8ff,
    danger:   0xff5050,
    success:  0x50dc64,
    gold:     0xffd700,
};

// --- Procedural path ---
// The path is generated as a sequence of chunks along +Z. Each chunk is
// either an "open road" segment (monster encounters) or a "town" segment
// (safe zone with a shop). TODO: implement chunk streaming in path.js.
export const CHUNK_LENGTH       = 40;   // world units per chunk
export const CHUNKS_BETWEEN_TOWNS = 6;  // road chunks before the next town
export const WALK_SPEED         = 6;    // world units / second

// --- Monster tiers ---
// Difficulty scales with distance travelled. TODO: implement in monsters.js.
export const MONSTER_TIERS = [
    { minDistance: 0,    level: 1, hp: 10, damage: 2,  coinDrop: [1, 3] },
    { minDistance: 400,  level: 2, hp: 18, damage: 3,  coinDrop: [2, 5] },
    { minDistance: 900,  level: 3, hp: 28, damage: 5,  coinDrop: [4, 8] },
    { minDistance: 1600, level: 4, hp: 42, damage: 7,  coinDrop: [6, 12] },
];

// --- Item rarity ---
// Drives both drop chance and comparison-UI accent color. TODO: use in loot.js.
export const RARITY = {
    common:    { chance: 0.60, color: 0xcccccc, mult: 1.0 },
    uncommon:  { chance: 0.25, color: 0x50dc64, mult: 1.3 },
    rare:      { chance: 0.11, color: 0x64c8ff, mult: 1.7 },
    epic:      { chance: 0.04, color: 0xb060ff, mult: 2.3 },
};

// --- Equipment slots ---
// Each item has a set of numeric attributes; the comparison UI diffs the
// new item against whatever is currently equipped in the same slot.
export const EQUIPMENT_SLOTS = ['weapon', 'armor'];
export const WEAPON_ATTRS = ['damage', 'attackSpeed', 'critChance'];
export const ARMOR_ATTRS  = ['defense', 'maxHp', 'moveSpeed'];

// --- TODO: Add further game-specific constants below (shop pricing, etc.) ---

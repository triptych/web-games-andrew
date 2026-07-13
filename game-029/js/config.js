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
export const ROAD_WIDTH          = 10;  // world units, steering is clamped to +/- ROAD_WIDTH/2
export const CHUNKS_AHEAD        = 5;   // how many chunks to keep generated ahead of the player
export const CHUNKS_BEHIND       = 2;   // how many passed chunks to keep before disposing

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

// --- Base weapon/armor stats, before rarity multiplier ---
export const BASE_WEAPON = { damage: 4, attackSpeed: 1.0, critChance: 0.05 };
export const BASE_ARMOR  = { defense: 2, maxHp: 0, moveSpeed: 0 };
export const WEAPON_NAMES = ['Sword', 'Blade', 'Cleaver', 'Rapier', 'Cutlass'];
export const ARMOR_NAMES  = ['Tunic', 'Vest', 'Mail', 'Plate', 'Cloak'];

// --- Player / combat ---
export const PLAYER_STEER_SPEED = 8;    // world units / second, lateral
export const SWORD_RANGE        = 2.2;  // reach from player z-position
export const SWORD_ARC_HALF_WIDTH = 1.6; // lateral half-width of the swing hitbox
export const SWORD_SWING_DURATION = 0.25; // seconds the hitbox is active
export const SWORD_SWING_COOLDOWN = 0.35; // seconds between swings
export const MONSTER_CONTACT_RANGE = 1.4; // distance at which a monster can hit the player
export const MONSTER_ATTACK_COOLDOWN = 1.0; // seconds between monster attacks

// --- Combat arena ---
// When the player's forward position comes within ARENA_LOCK_RANGE of any
// live monster, auto-walk halts and the player is confined to a
// forward/backward-movable arena of +/- ARENA_Z_RADIUS around their locked
// position until every monster in that encounter is dead.
export const ARENA_LOCK_RANGE  = 6;   // world units ahead a live monster triggers the lock
export const ARENA_Z_RADIUS    = 14;  // how far the player can move fwd/back within the arena
                                       // (must comfortably cover ARENA_LOCK_RANGE + the monster
                                       // spawn cluster's spread, or a chased monster in the same
                                       // encounter can end up unreachable — see monsters.js)
export const MONSTER_CHASE_SPEED = 3; // world units / second, monster closing speed on the player

// --- Monster spawning ---
export const MONSTER_SPAWN_CHANCE_PER_CHUNK = 0.8; // chance a road chunk gets a monster
export const MONSTER_MAX_PER_CHUNK = 2;

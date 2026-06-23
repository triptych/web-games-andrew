// ============================================================
// Crypt of the Forgotten — Configuration
// ============================================================

// --- Starting resources ---
export const STARTING_SCORE = 0;
export const STARTING_LIVES = 3;

// --- Camera ---
export const CAM_FOV     = 75;
export const CAM_NEAR    = 0.1;
export const CAM_FAR     = 200;
export const CAM_POS     = [0, 1.6, 0];   // x, y, z — eye height for first-person crawl

// --- Grid / dungeon ---
export const TILE_SIZE   = 4;             // world units per dungeon tile
export const WALL_HEIGHT = 4;
export const STEP_TIME   = 0.18;          // seconds to slide one tile forward
export const TURN_TIME   = 0.18;          // seconds to rotate 90 degrees
export const BUMP_TIME   = 0.16;          // seconds for the blocked-move head-knock
export const BUMP_DIST   = 0.35;          // world units the camera lurches into the wall
export const BUMP_DIP    = 0.12;          // world units the eye dips during the knock

// Facing directions (clockwise): 0=North, 1=East, 2=South, 3=West
export const DIRS = [
    { dx:  0, dz: -1 },   // North
    { dx:  1, dz:  0 },   // East
    { dx:  0, dz:  1 },   // South
    { dx: -1, dz:  0 },   // West
];

// --- Color palette (hex integers — three.js wants 0xRRGGBB, not [r,g,b]) ---
export const COLORS = {
    bg:       0x0a0a14,
    text:     '#dcdcf0',
    accent:   0x64c8ff,
    danger:   0xff5050,
    success:  0x50dc64,
    gold:     0xffd700,
    wall:     0x8a8496,   // weathered stone — light enough to read under the lantern
    floor:    0x5a5560,
    ceiling:  0x3c3848,
};

// --- Player starting stats ---
export const PLAYER_HP_MAX = 20;
export const PLAYER_ATK    = 4;
export const PLAYER_DEF    = 2;
export const STARTING_DEPTH = 1;

// --- Minimap ---
export const MINIMAP_CELL = 6;    // px per tile in the minimap canvas

// --- Phase 4: Per-face shading multipliers ---
// Lower = darker. North/South walls are slightly darker to create side-lit crypt feel.
export const SHADING = {
    wallNorth:  0.72,
    wallSouth:  0.72,
    wallEast:   0.90,
    wallWest:   0.90,
    floor:      1.00,
    ceiling:    0.55,
    floorAlt:   0.85,   // worn/rubble patch alternate tile
    stairsTile: 1.00,
};

// --- Phase 4: Wall variant types ---
export const WALL_VARIANTS = { none: 0, crack: 1, moss: 2, arch: 3, torch: 4 };

// --- Phase 6: Item definitions ---
// type: 'weapon' | 'armor' | 'consumable' | 'key' | 'quest'
export const ITEMS = {
    short_sword: { id: 'short_sword', name: 'Short Sword',  type: 'weapon',    icon: '⚔',  atk: 3,  def: 0,  desc: 'A worn but serviceable blade.' },
    iron_shield:  { id: 'iron_shield', name: 'Iron Shield',  type: 'armor',     icon: '🛡', atk: 0,  def: 2,  desc: 'Solid iron. A bit heavy.' },
    health_potion:{ id: 'health_potion',name: 'Health Potion',type: 'consumable',icon: '🧪', heal: 8,         desc: 'Restores 8 HP when used.' },
    torch_oil:    { id: 'torch_oil',   name: 'Torch Oil',   type: 'consumable', icon: '🫙', heal: 0,         desc: 'Keeps the flame bright. No combat use.' },
    crypt_key:    { id: 'crypt_key',   name: 'Crypt Key',   type: 'key',        icon: '🗝', desc: 'A heavy iron key. Opens a sealed door.' },
    bone_charm:   { id: 'bone_charm',  name: 'Bone Charm',  type: 'quest',      icon: '💎', desc: 'A relic fragment from the crypt\'s heart.' },
};

// Loot spawn map for Level 1: 'x,z' → item id.
// 'C' tiles in the level grid become chest markers; stepping on them yields the loot.
export const LEVEL_1_LOOT = {
    '13,1':  'health_potion',
    '3,3':   'crypt_key',
    '13,3':  'short_sword',
    '13,7':  'health_potion',
    '5,9':   'bone_charm',
    '13,9':  'iron_shield',
};

export const LEVEL_2_LOOT = {
    '3,1':   'health_potion',
    '11,3':  'short_sword',
    '3,7':   'health_potion',
};

export const LEVEL_3_LOOT = {
    '5,1':   'health_potion',
    '9,5':   'torch_oil',
};

// --- Phase 5: Monster definitions ---
// hp, atk, def, xp, name, description
export const MONSTERS = {
    ghoul: {
        id:   'ghoul',
        name: 'Crypt Ghoul',
        hp:   12,
        atk:  3,
        def:  1,
        xp:   30,
        icon: '☠',
    },
    skeleton: {
        id:   'skeleton',
        name: 'Rattling Skeleton',
        hp:   8,
        atk:  4,
        def:  0,
        xp:   20,
        icon: '💀',
    },
    wraith: {
        id:   'wraith',
        name: 'Shadow Wraith',
        hp:   16,
        atk:  5,
        def:  2,
        xp:   55,
        icon: '👻',
    },
};

// Monster spawn tiles: 'x,z' → monster id. Add 'M' tiles in the level
// and list them here so dungeon.js can report them on tileEntered.
export const LEVEL_1_SPAWNS = {
    '5,2':  'skeleton',   // corridor junction near first torch
    '7,5':  'ghoul',      // center passage
    '11,5': 'skeleton',   // east side
    '1,7':  'wraith',     // northwest room
    '7,9':  'ghoul',      // south corridor
};

export const LEVEL_2_SPAWNS = {
    '3,2':  'skeleton',
    '9,3':  'ghoul',
    '5,5':  'wraith',
    '11,6': 'skeleton',
    '3,8':  'ghoul',
};

export const LEVEL_3_SPAWNS = {
    '5,2':  'wraith',
    '9,2':  'wraith',
    '3,4':  'skeleton',
    '11,5': 'ghoul',
    '7,7':  'wraith',
};

// --- Phase 4: Level theme configurations ---
export const LEVEL_THEMES = {
    1: {
        name:             'Upper Crypt',
        wallTint:         0xb0a080,
        floorTint:        0x907868,
        ceilTint:         0x504040,
        fogColor:         0x0a0a14,
        fogNear:          12,
        fogFar:           40,
        ambientIntensity: 0.9,
        allowedVariants:  ['crack', 'moss', 'torch'],
    },
    2: {
        name:             'Deep Passages',
        wallTint:         0x8090a8,
        floorTint:        0x506070,
        ceilTint:         0x283040,
        fogColor:         0x060810,
        fogNear:          10,
        fogFar:           32,
        ambientIntensity: 0.65,
        allowedVariants:  ['crack', 'arch', 'torch'],
    },
    3: {
        name:             'Cold Depths',
        wallTint:         0x607090,
        floorTint:        0x3a4858,
        ceilTint:         0x1c2030,
        fogColor:         0x04060c,
        fogNear:          8,
        fogFar:           24,
        ambientIntensity: 0.45,
        allowedVariants:  ['crack', 'torch'],
    },
};

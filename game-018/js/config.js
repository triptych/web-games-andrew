// ============================================================
// Village of the Wandering Blade — Configuration
// ============================================================

// --- World ---
export const WORLD_SIZE        = 120;      // ground plane half-extent
export const VILLAGE_RADIUS    = 18;       // safe zone around village center
export const MONSTER_ZONE_MIN  = 20;       // spawn band start
export const MONSTER_ZONE_MAX  = 60;       // spawn band end
export const MONSTER_CAP       = 20;       // max live monsters

// --- Player ---
export const PLAYER_SPEED      = 8;        // units per second
export const PLAYER_HP_BASE    = 100;
export const PLAYER_ATK_BASE   = 15;
export const PLAYER_ATK_RANGE  = 2.5;     // melee reach
export const PLAYER_ATK_CD     = 0.55;    // seconds between attacks
export const XP_PER_LEVEL      = 100;     // scales with level

// --- Camera ---
export const CAM_OFFSET        = { x: 0, y: 12, z: 10 };
export const CAM_LERP          = 0.1;

// --- Monsters (definitions) ---
export const MONSTER_DEFS = {
    slime: {
        label: 'Slime',
        color: 0x44cc44,
        hp: 30, atk: 8, speed: 2.5,
        xp: 12, gold: 3,
        drops: { wood: 0, stone: 0, iron: 0, herbs: 1 },
        scale: 0.6,
    },
    goblin: {
        label: 'Goblin',
        color: 0x88bb44,
        hp: 55, atk: 14, speed: 4,
        xp: 25, gold: 7,
        drops: { wood: 1, stone: 0, iron: 1, herbs: 0 },
        scale: 0.85,
    },
    troll: {
        label: 'Troll',
        color: 0x887755,
        hp: 140, atk: 28, speed: 1.8,
        xp: 60, gold: 18,
        drops: { wood: 2, stone: 3, iron: 1, herbs: 0 },
        scale: 1.4,
    },
    wolf: {
        label: 'Wolf',
        color: 0x778899,
        hp: 45, atk: 18, speed: 5.5,
        xp: 20, gold: 5,
        drops: { wood: 0, stone: 0, iron: 0, herbs: 2 },
        scale: 0.75,
    },
};
export const MONSTER_TYPES = Object.keys(MONSTER_DEFS);

// --- Village buildings ---
export const BUILDING_DEFS = [
    {
        id: 'blacksmith',
        name: 'Blacksmith',
        desc: 'Craft iron weapons. +5 ATK per level.',
        emoji: '⚒️',
        cost: { wood: 10, stone: 5, iron: 8, gold: 0 },
        maxLevel: 3,
        effect: 'atkBonus',
        effectPerLevel: 5,
    },
    {
        id: 'healer',
        name: "Healer's Hut",
        desc: 'Rest to restore HP. +20 max HP per level.',
        emoji: '🌿',
        cost: { wood: 8, stone: 0, iron: 0, gold: 5 },
        maxLevel: 3,
        effect: 'hpBonus',
        effectPerLevel: 20,
    },
    {
        id: 'market',
        name: 'Market',
        desc: 'Sell resources for gold. +25% sell price per level.',
        emoji: '🏪',
        cost: { wood: 12, stone: 6, iron: 2, gold: 0 },
        maxLevel: 3,
        effect: 'sellBonus',
        effectPerLevel: 0.25,
    },
    {
        id: 'watchtower',
        name: 'Watchtower',
        desc: 'Reveal monster positions on your mental map. Expands range per level.',
        emoji: '🗼',
        cost: { wood: 6, stone: 8, iron: 3, gold: 0 },
        maxLevel: 2,
        effect: 'radarRange',
        effectPerLevel: 20,
    },
    {
        id: 'tavern',
        name: 'Tavern',
        desc: 'Rest between battles. Restores HP to full.',
        emoji: '🍺',
        cost: { wood: 15, stone: 5, iron: 0, gold: 10 },
        maxLevel: 1,
        effect: 'restHP',
        effectPerLevel: 0,
    },
];

// --- Sell prices per resource unit (base) ---
export const SELL_PRICES = {
    wood: 2,
    stone: 3,
    iron: 6,
    herbs: 4,
};

// --- Color palette ---
export const COLORS = {
    sky:          0x87ceeb,
    ground:       0x558844,
    villageGrass: 0x4a7a34,
    path:         0xb8a070,
    playerBody:   0x4488ff,
    playerHead:   0xffddaa,
    hpBar:        0xe05555,
    xpBar:        0x55aaee,
    gold:         0xc8a844,
    ui:           '#c8a844',
};

// --- Spawn tuning ---
export const SPAWN_INTERVAL   = 4;    // seconds between spawn attempts
export const ITEMS_ON_MAP_CAP = 30;   // max resource pickups in world

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
        hp: 30, atk: 6, speed: 2.5,
        xp: 12, gold: 3,
        drops: { wood: 0, stone: 0, iron: 0, herbs: 2 },
        scale: 0.6,
        minZone: 0,   // spawn anywhere outside village
    },
    goblin: {
        label: 'Goblin',
        color: 0x88bb44,
        hp: 55, atk: 12, speed: 4,
        xp: 25, gold: 8,
        drops: { wood: 2, stone: 0, iron: 1, herbs: 0 },
        scale: 0.85,
        minZone: 0,
    },
    troll: {
        label: 'Troll',
        color: 0x887755,
        hp: 140, atk: 22, speed: 1.8,
        xp: 60, gold: 20,
        drops: { wood: 3, stone: 4, iron: 2, herbs: 0 },
        scale: 1.4,
        minZone: 30,  // only in deeper zones
    },
    wolf: {
        label: 'Wolf',
        color: 0x778899,
        hp: 45, atk: 15, speed: 5.5,
        xp: 20, gold: 5,
        drops: { wood: 0, stone: 0, iron: 0, herbs: 3 },
        scale: 0.75,
        minZone: 0,
    },
    skeleton: {
        label: 'Skeleton',
        color: 0xddddbb,
        hp: 70, atk: 18, speed: 3.2,
        xp: 35, gold: 12,
        drops: { wood: 0, stone: 2, iron: 2, herbs: 0 },
        scale: 0.9,
        minZone: 25,
    },
    dragon: {
        label: 'Dragon',
        color: 0xcc3300,
        hp: 400, atk: 40, speed: 2.2,
        xp: 200, gold: 80,
        drops: { wood: 0, stone: 5, iron: 8, herbs: 3 },
        scale: 2.0,
        minZone: 45,  // only far out
        isBoss: true,
    },
};
export const MONSTER_TYPES = Object.keys(MONSTER_DEFS);
// Common types used for regular spawning (no boss)
export const COMMON_MONSTER_TYPES = MONSTER_TYPES.filter(t => !MONSTER_DEFS[t].isBoss);

// --- Village buildings ---
export const BUILDING_DEFS = [
    {
        id: 'blacksmith',
        name: 'Blacksmith',
        desc: 'Forge weapons. +5 ATK per level. Lv2: Unlocks Axe. Lv3: Unlocks Bow.',
        emoji: '⚒️',
        cost: { wood: 8, stone: 4, iron: 5, gold: 0 },
        maxLevel: 3,
        effect: 'atkBonus',
        effectPerLevel: 5,
    },
    {
        id: 'healer',
        name: "Healer's Hut",
        desc: 'Grants more max HP. +25 max HP per level.',
        emoji: '🌿',
        cost: { wood: 6, stone: 0, iron: 0, gold: 5 },
        maxLevel: 3,
        effect: 'hpBonus',
        effectPerLevel: 25,
    },
    {
        id: 'market',
        name: 'Market',
        desc: 'Sell resources for gold. +30% sell price per level.',
        emoji: '🏪',
        cost: { wood: 10, stone: 4, iron: 2, gold: 0 },
        maxLevel: 3,
        effect: 'sellBonus',
        effectPerLevel: 0.30,
    },
    {
        id: 'watchtower',
        name: 'Watchtower',
        desc: 'Expands radar range per level.',
        emoji: '🗼',
        cost: { wood: 5, stone: 6, iron: 2, gold: 0 },
        maxLevel: 2,
        effect: 'radarRange',
        effectPerLevel: 20,
    },
    {
        id: 'tavern',
        name: 'Tavern',
        desc: 'Walk near it to slowly restore HP. Proximity heals faster per level.',
        emoji: '🍺',
        cost: { wood: 12, stone: 4, iron: 0, gold: 8 },
        maxLevel: 3,
        effect: 'healRate',
        effectPerLevel: 0,
    },
    {
        id: 'alchemist',
        name: "Alchemist's Lab",
        desc: 'Craft health potions from herbs. +1 potion slot per level.',
        emoji: '⚗️',
        cost: { wood: 6, stone: 3, iron: 4, gold: 5 },
        maxLevel: 3,
        effect: 'potionSlots',
        effectPerLevel: 1,
    },
];

// --- Sell prices per resource unit (base) ---
export const SELL_PRICES = {
    wood: 2,
    stone: 3,
    iron: 7,
    herbs: 5,
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
export const SPAWN_INTERVAL   = 5;    // seconds between spawn attempts
export const ITEMS_ON_MAP_CAP = 40;   // max resource pickups in world
export const BOSS_SPAWN_INTERVAL = 120; // seconds between dragon spawn attempts

// --- Resource nodes (fixed locations that respawn) ---
export const RESOURCE_NODE_RESPAWN = 30;  // seconds to respawn a node after harvested

// --- Potions ---
export const POTION_COST_HERBS = 5;   // herbs to craft one potion
export const POTION_HEAL_AMOUNT = 50; // HP restored by one potion
export const MAX_POTIONS = 3;         // base max potions (+ potionSlots per alchemist level)

// --- Weapons ---
export const WEAPON_DEFS = {
    sword: { label: 'Sword', dmgMult: 1.0, range: 2.5, arcAngle: Math.PI * 0.5,  cooldown: 0.55, color: 0xcccccc, isRanged: false },
    axe:   { label: 'Axe',   dmgMult: 1.4, range: 2.0, arcAngle: Math.PI * 0.75, cooldown: 0.85, color: 0x886644, isRanged: false },
    bow:   { label: 'Bow',   dmgMult: 0.8, range: 12,  arcAngle: Math.PI * 0.12, cooldown: 1.1,  color: 0x8b5a2b, isRanged: true  },
};

// --- Quests ---
// type: 'kill' | 'gather' | 'build'
// For 'kill': target = monster type, count = required kills
// For 'gather': target = resource type, count = required amount
// For 'build': target = building id
export const QUEST_DEFS = [
    {
        id: 'q_slimes',
        title: 'Slime Problem',
        desc: 'The village is overrun with slimes. Kill 5 of them.',
        type: 'kill', target: 'slime', count: 5,
        reward: { xp: 50, gold: 15, resources: {} },
        npc: 'Elder',
    },
    {
        id: 'q_wood',
        title: 'Gather Timber',
        desc: 'We need wood to build. Gather 10 wood.',
        type: 'gather', target: 'wood', count: 10,
        reward: { xp: 40, gold: 10, resources: { stone: 5 } },
        npc: 'Builder',
    },
    {
        id: 'q_goblins',
        title: 'Goblin Raiders',
        desc: 'Goblins are raiding supply routes. Slay 5 goblins.',
        type: 'kill', target: 'goblin', count: 5,
        reward: { xp: 100, gold: 30, resources: { iron: 3 } },
        npc: 'Guard',
    },
    {
        id: 'q_herbs',
        title: 'Herbal Remedy',
        desc: 'The healer needs herbs for medicine. Gather 8 herbs.',
        type: 'gather', target: 'herbs', count: 8,
        reward: { xp: 60, gold: 12, resources: {} },
        npc: 'Healer',
    },
    {
        id: 'q_blacksmith',
        title: 'Forge the Future',
        desc: 'Build a Blacksmith to arm the village.',
        type: 'build', target: 'blacksmith', count: 1,
        reward: { xp: 80, gold: 20, resources: { iron: 5 } },
        npc: 'Elder',
    },
    {
        id: 'q_iron',
        title: 'Iron Supply',
        desc: 'We need iron to reinforce the walls. Gather 10 iron.',
        type: 'gather', target: 'iron', count: 10,
        reward: { xp: 120, gold: 40, resources: {} },
        npc: 'Builder',
    },
    {
        id: 'q_wolves',
        title: 'Wolf Pack',
        desc: 'Wolves have been spotted near the fields. Kill 6 wolves.',
        type: 'kill', target: 'wolf', count: 6,
        reward: { xp: 130, gold: 35, resources: { herbs: 4 } },
        npc: 'Guard',
    },
    {
        id: 'q_trolls',
        title: 'Troll Threat',
        desc: 'A troll is blocking the eastern trade road. Kill 3 trolls.',
        type: 'kill', target: 'troll', count: 3,
        reward: { xp: 200, gold: 60, resources: { stone: 8, iron: 4 } },
        npc: 'Elder',
    },
    {
        id: 'q_skeletons',
        title: 'Undead Rising',
        desc: 'Skeletons walk the night. Destroy 5 of them.',
        type: 'kill', target: 'skeleton', count: 5,
        reward: { xp: 175, gold: 50, resources: { iron: 6 } },
        npc: 'Healer',
    },
    {
        id: 'q_dragon',
        title: 'Dragon Slayer',
        desc: 'A fearsome dragon threatens the realm. Slay it!',
        type: 'kill', target: 'dragon', count: 1,
        reward: { xp: 500, gold: 200, resources: { iron: 10, stone: 10, herbs: 5 } },
        npc: 'Elder',
    },
];

// --- Day/Night ---
export const DAY_CYCLE_DURATION = 240;   // seconds for full day cycle
export const DAY_AMBIENT_INT    = 0.55;
export const NIGHT_AMBIENT_INT  = 0.10;
export const DAY_SUN_INT        = 1.4;
export const NIGHT_SUN_INT      = 0.0;
export const DAY_SKY_HEX        = 0x87ceeb;
export const NIGHT_SKY_HEX      = 0x080c18;

// --- Tavern proximity ---
export const TAVERN_HEAL_RADIUS = 4.5;
export const TAVERN_HEAL_RATE   = 2.0;   // seconds between heals
export const TAVERN_HEAL_AMOUNT = 8;

// --- Dungeons ---
export const DUNGEON_COUNT        = 4;    // number of dungeons in the world
export const DUNGEON_MIN_DIST     = 35;   // min distance from village center
export const DUNGEON_MAX_DIST     = 90;   // max distance from village center

// Dungeon-specific monster definitions (stronger than overworld)
export const DUNGEON_MONSTER_DEFS = {
    dungeon_rat: {
        label: 'Giant Rat',
        color: 0x886644,
        hp: 50, atk: 10, speed: 5.0,
        xp: 18, gold: 4,
        drops: { wood: 0, stone: 0, iron: 1, herbs: 1 },
        scale: 0.55,
    },
    dungeon_skeleton: {
        label: 'Cursed Skeleton',
        color: 0xeeeebb,
        hp: 120, atk: 28, speed: 3.5,
        xp: 55, gold: 18,
        drops: { wood: 0, stone: 3, iron: 3, herbs: 0 },
        scale: 0.95,
    },
    dungeon_troll: {
        label: 'Cave Troll',
        color: 0x556633,
        hp: 220, atk: 36, speed: 2.0,
        xp: 90, gold: 35,
        drops: { wood: 4, stone: 6, iron: 4, herbs: 0 },
        scale: 1.5,
    },
    dungeon_wraith: {
        label: 'Wraith',
        color: 0x8844cc,
        hp: 90, atk: 32, speed: 4.5,
        xp: 70, gold: 22,
        drops: { wood: 0, stone: 0, iron: 2, herbs: 3 },
        scale: 0.85,
    },
};

// Dungeon boss definition
export const DUNGEON_BOSS_DEF = {
    label: 'Dungeon Lord',
    color: 0x220044,
    hp: 600, atk: 55, speed: 2.8,
    xp: 400, gold: 150,
    drops: { wood: 8, stone: 12, iron: 15, herbs: 8 },
    scale: 2.2,
    isBoss: true,
    // Bonus village resources awarded on boss kill
    villageReward: { wood: 20, stone: 20, iron: 25, herbs: 15, gold: 200 },
};

// Treasure chest rewards
export const TREASURE_DEFS = [
    { wood: 5,  stone: 5,  iron: 8,  herbs: 3,  gold: 30 },
    { wood: 3,  stone: 8,  iron: 5,  herbs: 6,  gold: 20 },
    { wood: 0,  stone: 0,  iron: 15, herbs: 0,  gold: 50 },
    { wood: 10, stone: 10, iron: 5,  herbs: 10, gold: 15 },
    { wood: 0,  stone: 5,  iron: 10, herbs: 5,  gold: 60 },
];

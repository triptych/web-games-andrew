/**
 * Ore and block type definitions.
 * Each entry: id, name, color (hex int), hardness (1-10), value (credits),
 * isFill (true = dug but not collected), stackSize (max per slot).
 */

export const BLOCK = {
    AIR:            0,
    DIRT:           1,
    STONE:          2,
    BEDROCK:        3,
    LAVA:           4,
    COAL:           5,
    IRON:           6,
    COPPER:         7,
    SILVER:         8,
    GOLD:           9,
    RUBY:           10,
    MITHRIL:        11,
    MAGIC_CRYSTAL:  12,
    DRAGON_BONE:    13,
    SPIRIT_ESSENCE: 14,
    DRAGON_HEART:   15,
    XENITE:         16,
    RELIC_SHARD:    17,
    NANITE_CLUSTER: 18,
    VOID_CRYSTAL:   19,
    CRASHED_ALLOY:  20,
    SINGING_VEIN:   21,
    NULL_MATTER:    22,
    CORE_ESSENCE:   23,
    VOID_STONE:     24,
};

export const ORE_DEFS = {
    [BLOCK.AIR]:            { id: BLOCK.AIR,            name: 'Air',            color: 0x000000, hardness: 0,  value: 0,    isFill: true,  stackSize: 0 },
    [BLOCK.DIRT]:           { id: BLOCK.DIRT,           name: 'Dirt',           color: 0x6B4226, hardness: 1,  value: 0,    isFill: true,  stackSize: 0 },
    [BLOCK.STONE]:          { id: BLOCK.STONE,          name: 'Stone',          color: 0x888888, hardness: 2,  value: 0,    isFill: true,  stackSize: 0 },
    [BLOCK.BEDROCK]:        { id: BLOCK.BEDROCK,        name: 'Bedrock',        color: 0x333333, hardness: 99, value: 0,    isFill: true,  stackSize: 0 },
    [BLOCK.LAVA]:           { id: BLOCK.LAVA,           name: 'Lava',           color: 0xFF4400, hardness: 4,  value: 0,    isFill: true,  stackSize: 0 },
    [BLOCK.COAL]:           { id: BLOCK.COAL,           name: 'Coal',           color: 0x2C2C2C, hardness: 2,  value: 5,    isFill: false, stackSize: 5 },
    [BLOCK.IRON]:           { id: BLOCK.IRON,           name: 'Iron Ore',       color: 0xC87533, hardness: 3,  value: 12,   isFill: false, stackSize: 5 },
    [BLOCK.COPPER]:         { id: BLOCK.COPPER,         name: 'Copper Ore',     color: 0xB87333, hardness: 3,  value: 8,    isFill: false, stackSize: 5 },
    [BLOCK.SILVER]:         { id: BLOCK.SILVER,         name: 'Silver Ore',     color: 0xC0C0C0, hardness: 4,  value: 30,   isFill: false, stackSize: 5 },
    [BLOCK.GOLD]:           { id: BLOCK.GOLD,           name: 'Gold Ore',       color: 0xFFD700, hardness: 5,  value: 75,   isFill: false, stackSize: 5 },
    [BLOCK.RUBY]:           { id: BLOCK.RUBY,           name: 'Ruby',           color: 0x9B111E, hardness: 5,  value: 100,  isFill: false, stackSize: 3 },
    [BLOCK.MITHRIL]:        { id: BLOCK.MITHRIL,        name: 'Mithril Ore',    color: 0xA8D8EA, hardness: 6,  value: 180,  isFill: false, stackSize: 3 },
    [BLOCK.MAGIC_CRYSTAL]:  { id: BLOCK.MAGIC_CRYSTAL,  name: 'Magic Crystal',  color: 0xCC00FF, hardness: 6,  value: 220,  isFill: false, stackSize: 3 },
    [BLOCK.DRAGON_BONE]:    { id: BLOCK.DRAGON_BONE,    name: 'Dragon Bone',    color: 0xF5E6C8, hardness: 7,  value: 280,  isFill: false, stackSize: 2 },
    [BLOCK.SPIRIT_ESSENCE]: { id: BLOCK.SPIRIT_ESSENCE, name: 'Spirit Essence', color: 0x00FFCC, hardness: 7,  value: 350,  isFill: false, stackSize: 2 },
    [BLOCK.DRAGON_HEART]:   { id: BLOCK.DRAGON_HEART,   name: 'Dragon Heart',   color: 0xFF3300, hardness: 8,  value: 500,  isFill: false, stackSize: 2 },
    [BLOCK.XENITE]:         { id: BLOCK.XENITE,         name: 'Xenite',         color: 0x00FF88, hardness: 7,  value: 420,  isFill: false, stackSize: 2 },
    [BLOCK.RELIC_SHARD]:    { id: BLOCK.RELIC_SHARD,    name: 'Ancient Relic',  color: 0xDAA520, hardness: 8,  value: 600,  isFill: false, stackSize: 1 },
    [BLOCK.NANITE_CLUSTER]: { id: BLOCK.NANITE_CLUSTER, name: 'Nanite Cluster', color: 0x88CCFF, hardness: 8,  value: 750,  isFill: false, stackSize: 2 },
    [BLOCK.VOID_CRYSTAL]:   { id: BLOCK.VOID_CRYSTAL,   name: 'Void Crystal',   color: 0x9900CC, hardness: 9,  value: 1100, isFill: false, stackSize: 1 },
    [BLOCK.CRASHED_ALLOY]:  { id: BLOCK.CRASHED_ALLOY,  name: 'Crashed Alloy',  color: 0x445566, hardness: 9,  value: 900,  isFill: false, stackSize: 1 },
    [BLOCK.SINGING_VEIN]:   { id: BLOCK.SINGING_VEIN,   name: 'Singing Vein',   color: 0xFFFFFF, hardness: 10, value: 2500, isFill: false, stackSize: 1 },
    [BLOCK.NULL_MATTER]:    { id: BLOCK.NULL_MATTER,    name: 'Null Matter',    color: 0x110033, hardness: 10, value: 2000, isFill: false, stackSize: 1 },
    [BLOCK.CORE_ESSENCE]:   { id: BLOCK.CORE_ESSENCE,   name: 'Core Essence',   color: 0xFF00FF, hardness: 10, value: 3500, isFill: false, stackSize: 1 },
    [BLOCK.VOID_STONE]:     { id: BLOCK.VOID_STONE,     name: 'Void Stone',     color: 0x0A0010, hardness: 3,  value: 0,    isFill: true,  stackSize: 0 },
};

// Ore spawn table per depth tier [tierIndex]: [{block, weight}, ...]
// Only non-fill ores listed; remaining probability goes to fill blocks.
export const TIER_ORE_TABLES = [
    // Tier 0: Surface Soil (rows 0-30) — ore spawn rate 15%
    [
        { block: BLOCK.COAL,   weight: 60 },
        { block: BLOCK.IRON,   weight: 20 },
        { block: BLOCK.COPPER, weight: 20 },
    ],
    // Tier 1: Stone Layer (rows 31-80) — ore spawn rate 12%
    [
        { block: BLOCK.IRON,   weight: 40 },
        { block: BLOCK.SILVER, weight: 35 },
        { block: BLOCK.COPPER, weight: 25 },
    ],
    // Tier 2: Iron Depths (rows 81-140) — ore spawn rate 12%
    [
        { block: BLOCK.SILVER,  weight: 30 },
        { block: BLOCK.GOLD,    weight: 30 },
        { block: BLOCK.RUBY,    weight: 20 },
        { block: BLOCK.MITHRIL, weight: 20 },
    ],
    // Tier 3: Crystal Caverns (rows 141-200) — ore spawn rate 10%
    [
        { block: BLOCK.MITHRIL,        weight: 25 },
        { block: BLOCK.MAGIC_CRYSTAL,  weight: 30 },
        { block: BLOCK.DRAGON_BONE,    weight: 25 },
        { block: BLOCK.SPIRIT_ESSENCE, weight: 20 },
    ],
    // Tier 4: Ancient Ruins (rows 201-270) — ore spawn rate 10%
    [
        { block: BLOCK.DRAGON_HEART,   weight: 20 },
        { block: BLOCK.SPIRIT_ESSENCE, weight: 25 },
        { block: BLOCK.XENITE,         weight: 30 },
        { block: BLOCK.RELIC_SHARD,    weight: 25 },
    ],
    // Tier 5: Alien Stratum (rows 271-340) — ore spawn rate 8%
    [
        { block: BLOCK.XENITE,         weight: 25 },
        { block: BLOCK.NANITE_CLUSTER, weight: 30 },
        { block: BLOCK.VOID_CRYSTAL,   weight: 25 },
        { block: BLOCK.CRASHED_ALLOY,  weight: 20 },
    ],
    // Tier 6: The Void Layer (rows 341-400) — ore spawn rate 6%
    [
        { block: BLOCK.VOID_CRYSTAL,  weight: 20 },
        { block: BLOCK.SINGING_VEIN,  weight: 15 },
        { block: BLOCK.NULL_MATTER,   weight: 30 },
        { block: BLOCK.CORE_ESSENCE,  weight: 5  },
        { block: BLOCK.CRASHED_ALLOY, weight: 30 },
    ],
];

// Ore spawn rate (fraction of non-fill blocks that are ore) per tier
export const TIER_ORE_RATES = [0.15, 0.12, 0.12, 0.10, 0.10, 0.08, 0.06];

// ============================================================
// Ground and object codes shared by the overworld and dungeons.
// ============================================================

export const G = {
    GRASS: 0, GRASS2: 1, PATH: 2, SAND: 3, WATER: 4, SHALLOW: 5, CLIFF: 6, ROCKY: 7, SNOW: 8, ICE: 9,
    LAVA: 10, MARSH: 11, PLAZA: 12, FARM: 13, FLOOR: 14, WALL: 15, VOID: 16, BRIDGE: 17, ASH: 18,
};
export const G_BLOCK = new Set([G.WATER, G.CLIFF, G.LAVA, G.WALL, G.VOID]);
export const G_WATER = new Set([G.WATER, G.SHALLOW]);

export const O = {
    NONE: 0, TREE: 1, PINE: 2, BUSH: 3, ROCK: 4, WEED: 5, TUFT: 6, FLOWER: 7, STUMP: 8, FORAGE: 9,
    THORN: 10, BOULDER: 11, DARK: 12, ORE: 13, GEM: 14, CHEST: 15, SIGN: 16, DUNGEON: 17, CAVE: 18,
    GLIMMER: 19, FENCE: 20, HEART: 21, PLACED: 22, DOWN: 23, UP: 24, LOCKED: 25, KEY: 26, REED: 27,
    CRYSTAL: 28, LOTSIGN: 29, BOARD: 30, BIN: 31, RUIN: 32, LILY: 33, OLDTREE: 34, FACADE: 35,
    TORCH: 36, PEDESTAL: 37, DEADTREE: 38, BIGROCK: 39,
};

// Objects you cannot walk through.
export const O_BLOCK = new Set([O.TREE, O.PINE, O.BUSH, O.ROCK, O.WEED, O.STUMP, O.THORN, O.BOULDER, O.DARK,
    O.ORE, O.GEM, O.CHEST, O.SIGN, O.DUNGEON, O.CAVE, O.GLIMMER, O.FENCE, O.HEART, O.PLACED, O.LOCKED,
    O.CRYSTAL, O.LOTSIGN, O.BOARD, O.BIN, O.RUIN, O.OLDTREE, O.FACADE, O.TORCH, O.PEDESTAL, O.DEADTREE, O.BIGROCK]);

// What a tool (or the hand) does to an object: tool, hits needed, drops [[item, min, max, chance]]
export const BREAK = {
    [O.TREE]:    { tool: 'axe', hp: 4, drops: [['wood', 3, 5, 1], ['sap', 1, 2, 0.5], ['hardwood', 1, 1, 0.12]], leaves: O.STUMP, skill: 'foraging', xp: 4 },
    [O.PINE]:    { tool: 'axe', hp: 4, drops: [['wood', 3, 5, 1], ['sap', 1, 3, 0.6], ['pine_nut', 1, 1, 0.1]], leaves: O.STUMP, skill: 'foraging', xp: 4 },
    [O.DEADTREE]:{ tool: 'axe', hp: 3, drops: [['wood', 2, 4, 1], ['coal', 1, 1, 0.25]], skill: 'foraging', xp: 3 },
    [O.STUMP]:   { tool: 'axe', hp: 3, drops: [['wood', 1, 2, 1], ['hardwood', 1, 2, 0.6]], skill: 'foraging', xp: 3 },
    [O.BUSH]:    { tool: 'axe', hp: 2, drops: [['wood', 1, 2, 1], ['fiber', 1, 2, 0.6], ['wild_berry', 1, 1, 0.15]], skill: 'foraging', xp: 2 },
    [O.ROCK]:    { tool: 'pick', hp: 2, drops: [['stone', 2, 4, 1], ['clay', 1, 1, 0.2], ['coal', 1, 1, 0.08]], skill: 'mining', xp: 3 },
    [O.BIGROCK]: { tool: 'pick', hp: 6, tier: 2, drops: [['stone', 8, 12, 1], ['coal', 1, 2, 0.5]], skill: 'mining', xp: 8 },
    [O.WEED]:    { tool: 'scythe', hp: 1, drops: [['fiber', 1, 1, 0.7]], hand: true, skill: 'foraging', xp: 1 },
    [O.TUFT]:    { tool: 'scythe', hp: 1, drops: [['fiber', 1, 1, 0.5], ['hay', 1, 1, 0.6]], skill: 'foraging', xp: 1 },
    [O.CRYSTAL]: { tool: 'pick', hp: 3, drops: [['stone', 1, 2, 1], ['ice_crystal', 1, 1, 0.3], ['sulfur', 1, 1, 0.3]], skill: 'mining', xp: 5 },
    [O.THORN]:   { relic: 'thornbreaker', hp: 1, drops: [['fiber', 1, 2, 1]] },
    [O.BOULDER]: { relic: 'stonebreaker', hp: 1, drops: [['stone', 4, 8, 1]] },
    // ORE and GEM use their variant to pick the drop (see sim/world.js)
    [O.ORE]:     { tool: 'pick', hp: 3, skill: 'mining', xp: 6 },
    [O.GEM]:     { tool: 'pick', hp: 4, skill: 'mining', xp: 12 },
};

export const GLIMMER_KINDS = ['acorn', 'starfruit', 'scroll', 'cache', 'ring', 'shrine', 'moonwell'];
export const GLIMMER_INFO = {
    acorn: { name: 'Heart Acorn', desc: 'Max HP +10' },
    starfruit: { name: 'Star Fruit', desc: 'Max energy +10' },
    scroll: { name: 'Recipe Scroll', desc: 'A lost recipe' },
    cache: { name: 'Glimmer Cache', desc: 'Old treasure' },
    ring: { name: 'Fairy Ring', desc: 'Fast travel' },
    shrine: { name: 'Old Shrine', desc: 'A blessing' },
    moonwell: { name: 'Moonwell', desc: 'Restores you once a day' },
};

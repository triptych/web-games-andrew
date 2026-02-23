// ============================================================
// Chronicles of the Ember Crown — Configuration
// ============================================================

// --- Canvas ---
export const GAME_WIDTH  = 1280;
export const GAME_HEIGHT = 720;

// --- Starting resources ---
export const STARTING_SCORE = 0;
export const STARTING_LIVES = 3;  // party wipes before game over

// --- Color palette ---
export const COLORS = {
    bg:         [8, 6, 20],         // deep indigo night
    panel:      [18, 14, 36],       // battle panel background
    panelBorder:[80, 60, 140],      // panel border
    text:       [220, 210, 240],    // parchment white
    accent:     [200, 160, 80],     // gold
    danger:     [220, 60, 60],      // HP red
    mana:       [60, 120, 220],     // MP blue
    success:    [80, 200, 100],     // healing green
    xp:         [160, 80, 220],     // XP purple
    shadow:     [0, 0, 0],
};

// --- Party definitions ---
export const PARTY_DEFS = {
    warrior: {
        name: 'Warrior',
        hp: 180, mp: 30,
        atk: 28, def: 18, mag: 6, spd: 10,
        color: [200, 80, 60],       // crimson
        description: 'Stalwart frontliner. High HP and physical attack.',
    },
    mage: {
        name: 'Mage',
        hp: 80, mp: 120,
        atk: 8, def: 6, mag: 36, spd: 14,
        color: [80, 140, 220],      // sapphire
        description: 'Glass cannon. Devastating spells, fragile body.',
    },
    healer: {
        name: 'Healer',
        hp: 110, mp: 100,
        atk: 10, def: 12, mag: 22, spd: 12,
        color: [80, 200, 130],      // emerald
        description: 'Keeps the party alive. Balanced magic and support.',
    },
    rogue: {
        name: 'Rogue',
        hp: 120, mp: 50,
        atk: 24, def: 10, mag: 8, spd: 20,
        color: [160, 160, 60],      // bronze
        description: 'Fast striker. First to act; chance to hit twice.',
    },
};

// --- Ability definitions ---
// type: 'physical' | 'magical' | 'heal' | 'status'
// target: 'enemy' | 'ally' | 'allEnemies' | 'allAllies' | 'self'
export const ABILITY_DEFS = {
    // --- Warrior ---
    attack:       { name: 'Attack',       mp: 0,  type: 'physical', target: 'enemy',     power: 1.0,  desc: 'Basic physical strike.' },
    powerSlash:   { name: 'Power Slash',  mp: 8,  type: 'physical', target: 'enemy',     power: 1.8,  desc: 'Heavy blow; ignores some DEF.' },
    warCry:       { name: 'War Cry',      mp: 6,  type: 'status',   target: 'allAllies', effect: 'atkUp', desc: 'Raises party ATK for 3 turns.' },
    // --- Mage ---
    fireball:     { name: 'Fireball',     mp: 18, type: 'magical',  target: 'enemy',     power: 2.2,  elem: 'fire', desc: 'Concentrated flame burst.' },
    blizzard:     { name: 'Blizzard',     mp: 22, type: 'magical',  target: 'allEnemies',power: 1.4,  elem: 'ice',  desc: 'Ice shards hit all foes.' },
    magicMissile: { name: 'Magic Missile',mp: 8,  type: 'magical',  target: 'enemy',     power: 1.2,  desc: 'Reliable arcane bolt.' },
    // --- Healer ---
    cure:         { name: 'Cure',         mp: 12, type: 'heal',     target: 'ally',      power: 1.4,  desc: 'Restore HP to one ally.' },
    cureAll:      { name: 'Cure All',     mp: 24, type: 'heal',     target: 'allAllies', power: 0.9,  desc: 'Restore HP to all allies.' },
    protect:      { name: 'Protect',      mp: 10, type: 'status',   target: 'ally',      effect: 'defUp', desc: 'Raise one ally\'s DEF for 3 turns.' },
    // --- Rogue ---
    steal:        { name: 'Steal',        mp: 4,  type: 'physical', target: 'enemy',     power: 0.6,  steal: true, desc: 'Strike and attempt to steal.' },
    doubleStrike: { name: 'Double Strike',mp: 12, type: 'physical', target: 'enemy',     power: 0.9,  hits: 2,     desc: 'Strike twice in quick succession.' },
    smokeScreen:  { name: 'Smoke Screen', mp: 8,  type: 'status',   target: 'allEnemies',effect: 'accDown', desc: 'Lower all foes\' accuracy.' },
};

// Abilities available per class (in menu order)
export const CLASS_ABILITIES = {
    warrior: ['attack', 'powerSlash', 'warCry'],
    mage:    ['attack', 'fireball', 'blizzard', 'magicMissile'],
    healer:  ['attack', 'cure', 'cureAll', 'protect'],
    rogue:   ['attack', 'doubleStrike', 'steal', 'smokeScreen'],
};

// --- Enemy definitions ---
export const ENEMY_DEFS = {
    goblin:     { name: 'Goblin',      hp: 60,  atk: 14, def: 6,  mag: 4,  spd: 12, xp: 20,  gold: 8,  color: [80, 160, 60] },
    skeleton:   { name: 'Skeleton',    hp: 80,  atk: 18, def: 10, mag: 2,  spd: 8,  xp: 30,  gold: 12, color: [200, 200, 180] },
    orc:        { name: 'Orc',         hp: 140, atk: 24, def: 14, mag: 2,  spd: 6,  xp: 50,  gold: 20, color: [100, 140, 60] },
    darkElf:    { name: 'Dark Elf',    hp: 90,  atk: 16, def: 8,  mag: 20, spd: 16, xp: 60,  gold: 25, color: [120, 60, 160] },
    golem:      { name: 'Stone Golem', hp: 220, atk: 30, def: 28, mag: 0,  spd: 4,  xp: 100, gold: 40, color: [140, 130, 120] },
    dragon:     { name: 'Dragon',      hp: 400, atk: 40, def: 20, mag: 30, spd: 10, xp: 300, gold: 100,color: [180, 60, 40],  isBoss: true },
    lichKing:   { name: 'Lich King',   hp: 600, atk: 35, def: 18, mag: 50, spd: 14, xp: 500, gold: 200,color: [80, 60, 140],  isBoss: true },
};

// --- Encounter / battle list ---
// Each encounter: { enemies: [type, ...], region: string }
export const ENCOUNTERS = [
    { enemies: ['goblin'],              region: 'Forest Path' },
    { enemies: ['goblin', 'goblin'],    region: 'Forest Path' },
    { enemies: ['skeleton'],            region: 'Old Ruins' },
    { enemies: ['skeleton', 'goblin'],  region: 'Old Ruins' },
    { enemies: ['orc'],                 region: 'Mountain Pass' },
    { enemies: ['orc', 'skeleton'],     region: 'Mountain Pass' },
    { enemies: ['darkElf'],             region: 'Shadow Vale' },
    { enemies: ['darkElf', 'goblin', 'goblin'], region: 'Shadow Vale' },
    { enemies: ['golem'],               region: 'Ancient Fortress' },
    { enemies: ['orc', 'darkElf'],      region: 'Ancient Fortress' },
    { enemies: ['dragon'],              region: 'Dragon\'s Peak',  isBoss: true },
    { enemies: ['lichKing'],            region: 'Throne of Ash',   isBoss: true },
];

// --- Economy ---
export const SHOP_ITEMS = {
    potion:    { name: 'Potion',     cost: 30, effect: 'healHp',  amount: 80,  desc: 'Restore 80 HP to one ally.' },
    hiPotion:  { name: 'Hi-Potion',  cost: 80, effect: 'healHp',  amount: 200, desc: 'Restore 200 HP to one ally.' },
    ether:     { name: 'Ether',      cost: 40, effect: 'healMp',  amount: 40,  desc: 'Restore 40 MP to one ally.' },
    revive:    { name: 'Revive',     cost: 100,effect: 'revive',  amount: 50,  desc: 'Revive a fallen ally with 50% HP.' },
    antidote:  { name: 'Antidote',   cost: 20, effect: 'cureStatus', status: 'poison', desc: 'Cure poison from one ally.' },
};

// Starting gold
export const STARTING_GOLD = 120;

// XP required to level up (index = level - 1, so [0] = XP needed to reach level 2)
export const XP_TABLE = [100, 250, 500, 900, 1500, 2400, 3800, 6000, 9500, 15000];

// Stat growth per level (flat bonus, randomly picks from range)
export const LEVEL_UP_GROWTH = {
    warrior: { hp: [15, 25], mp: [2, 5],  atk: [2, 4], def: [2, 4], mag: [0, 1], spd: [0, 1] },
    mage:    { hp: [5, 10],  mp: [10,18], atk: [0, 1], def: [0, 1], mag: [3, 6], spd: [1, 2] },
    healer:  { hp: [8, 14],  mp: [8, 14], atk: [0, 1], def: [1, 2], mag: [2, 4], spd: [0, 2] },
    rogue:   { hp: [10, 16], mp: [3, 7],  atk: [2, 4], def: [1, 2], mag: [0, 1], spd: [2, 4] },
};

// --- Battle layout constants ---
export const BATTLE = {
    // Enemy sprites (right side, 3 slots)
    ENEMY_X:  [760, 920, 1080],
    ENEMY_Y:  [200, 250, 180],
    ENEMY_W:  100,
    ENEMY_H:  120,

    // Party sprites (left side, single column)
    PARTY_X:  [100, 100, 100, 100],
    PARTY_Y:  [85, 190, 295, 400],
    PARTY_W:  80,
    PARTY_H:  100,

    // Command panel
    PANEL_X:  20,
    PANEL_Y:  480,
    PANEL_W:  400,
    PANEL_H:  220,

    // Status panel
    STATUS_X: 440,
    STATUS_Y: 480,
    STATUS_W: 820,
    STATUS_H: 220,
};

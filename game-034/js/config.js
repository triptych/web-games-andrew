// ============================================================
// Idle Delve — Configuration & balance constants
// ============================================================

export const STAGE_W = 960;
export const STAGE_H = 540;

// --- Tick timing ---
export const BASE_TICK_MS   = 900;   // one combat "beat" at 1x speed
export const ROOM_PAUSE_MS  = 700;   // pause between rooms to let log breathe
export const SAVE_INTERVAL_MS = 8000;
export const MAX_OFFLINE_MS = 12 * 60 * 60 * 1000; // 12h catch-up cap

export const SPEEDS = [1, 2, 4];

// --- Colors (procedural palette, depth-shifted at render time) ---
export const COLORS = {
    bg:        [10, 8, 16],
    floorNear: [40, 30, 55],
    floorFar:  [20, 14, 30],
    text:      [232, 226, 240],
    accent:    [201, 156, 255],
    gold:      [255, 211, 77],
    danger:    [255, 93, 108],
    success:   [93, 224, 138],
};

// --- Hero classes ---
// baseHp/atk/def/spd are level-1 stats; growth applied per hero-tier upgrade.
export const HERO_CLASSES = {
    fighter: {
        id: 'fighter', name: 'Fighter', role: 'melee',
        color: '#8fb8ff', shape: 'square',
        baseHp: 46, baseAtk: 9, baseDef: 5, baseSpd: 10,
        critChance: 0.08,
    },
    archer: {
        id: 'archer', name: 'Archer', role: 'ranged',
        color: '#8fe0a0', shape: 'triangle',
        baseHp: 32, baseAtk: 11, baseDef: 2, baseSpd: 14,
        critChance: 0.16,
    },
    mage: {
        id: 'mage', name: 'Mage', role: 'burst',
        color: '#c99cff', shape: 'diamond',
        baseHp: 26, baseAtk: 15, baseDef: 1, baseSpd: 8,
        critChance: 0.12,
    },
    cleric: {
        id: 'cleric', name: 'Cleric', role: 'healer',
        color: '#ffd34d', shape: 'circle',
        baseHp: 34, baseAtk: 6, baseDef: 3, baseSpd: 9,
        critChance: 0.05,
        healPerTurn: 5, // heals lowest-HP living ally each of its turns
    },
};

// Recruit order — party grows in this sequence as heroes are bought.
export const RECRUIT_ORDER = ['fighter', 'archer', 'mage', 'cleric'];

// --- Monster tiers (families), scaled by floor at spawn time ---
export const MONSTER_TIERS = [
    { id: 'slime',   name: 'Slime',   color: '#7fe08a', shape: 'blob',     hpMul: 1.0, atkMul: 1.0 },
    { id: 'goblin',  name: 'Goblin',  color: '#c9a06a', shape: 'humanoid', hpMul: 1.15, atkMul: 1.1 },
    { id: 'bat',     name: 'Bat',     color: '#a06ac9', shape: 'wing',     hpMul: 0.75, atkMul: 1.25 },
    { id: 'skeleton',name: 'Skeleton',color: '#dcdcdc', shape: 'humanoid', hpMul: 1.3, atkMul: 1.2 },
    { id: 'ooze',    name: 'Ooze',    color: '#6ac9c0', shape: 'blob',     hpMul: 1.6, atkMul: 0.9 },
    { id: 'wraith',  name: 'Wraith',  color: '#7a6ac9', shape: 'wing',     hpMul: 1.4, atkMul: 1.4 },
];

export const BOSS_TIER = { id: 'warlord', name: 'Floor Warlord', color: '#ff5d6c', shape: 'boss', hpMul: 4.5, atkMul: 1.8 };

// Monster base stats at floor 1, scaled per floor by FLOOR_SCALING below.
export const MONSTER_BASE = { hp: 18, atk: 5, def: 1, spd: 8 };

// --- Floor/room scaling ---
export const FLOOR_SCALING = {
    hpGrowthPerFloor: 0.16,
    atkGrowthPerFloor: 0.12,
    goldGrowthPerFloor: 0.14,
    roomsPerFloorBase: 3,
    roomsPerFloorMax: 6,
    bossEveryNFloors: 5,
};

export const ROOM_TYPES = {
    combat: { weight: 70 },
    treasure: { weight: 20, goldMul: 2.2 },
    rest: { weight: 10, healPct: 0.35 },
};

// --- Gold rewards ---
export const GOLD_BASE_PER_ROOM = 6;
export const GOLD_BASE_PER_MONSTER = 3;
export const WIPE_BANK_BONUS = 0.15; // bonus % of run gold for surviving to deepest floor reached

// --- Shop upgrade catalog ---
// cost(level) -> gold cost to go from `level` to `level+1`
export const UPGRADES = {
    recruit: {
        id: 'recruit', icon: '\u{1F9D1}', name: 'Recruit Hero',
        maxLevel: RECRUIT_ORDER.length - 1, // level = heroes beyond the starting one
        baseCost: 80, growth: 4.2,
        describe: (lvl) => lvl >= RECRUIT_ORDER.length - 1
            ? 'Full party recruited'
            : `Recruit the ${HERO_CLASSES[RECRUIT_ORDER[lvl + 1]].name}`,
    },
    atk: {
        id: 'atk', icon: '⚔️', name: 'Weapon Training',
        maxLevel: 40, baseCost: 25, growth: 1.22,
        effectPerLevel: 0.045, // +4.5% party ATK per level
        describe: (lvl) => `+${Math.round(lvl * 4.5)}% party ATK`,
    },
    def: {
        id: 'def', icon: '\u{1F6E1}️', name: 'Armor Smithing',
        maxLevel: 40, baseCost: 25, growth: 1.22,
        effectPerLevel: 0.045,
        describe: (lvl) => `+${Math.round(lvl * 4.5)}% party DEF`,
    },
    hp: {
        id: 'hp', icon: '❤️', name: 'Vitality',
        maxLevel: 40, baseCost: 30, growth: 1.22,
        effectPerLevel: 0.05,
        describe: (lvl) => `+${Math.round(lvl * 5)}% party HP`,
    },
    goldfind: {
        id: 'goldfind', icon: '\u{1F4B0}', name: 'Gold Find',
        maxLevel: 30, baseCost: 40, growth: 1.28,
        effectPerLevel: 0.08,
        describe: (lvl) => `+${Math.round(lvl * 8)}% gold from rooms`,
    },
    startFloor: {
        id: 'startFloor', icon: '\u{1F5FA}️', name: 'Deeper Foothold',
        maxLevel: 20, baseCost: 300, growth: 1.9,
        describe: (lvl) => `New delves start at floor ${1 + lvl * 2}`,
    },
    revive: {
        id: 'revive', icon: '✨', name: "Cleric's Blessing",
        maxLevel: 5, baseCost: 500, growth: 3.0,
        describe: (lvl) => `${lvl} auto-revive charge(s) per delve`,
    },
};

export function upgradeCost(upgradeId, currentLevel) {
    const u = UPGRADES[upgradeId];
    return Math.ceil(u.baseCost * Math.pow(u.growth, currentLevel));
}

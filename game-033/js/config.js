// ============================================================
// Hearthbound — Configuration
// ============================================================

export const SAVE_KEY = 'hearthbound-save-v1';

// --- Starting player stats ---
export const STARTING_STATS = {
    level: 1,
    xp: 0,
    hp: 20,
    maxHp: 20,
    strength: 3,   // affects battle damage dealt
    wit: 3,        // unlocks dialogue options, affects flee/evade
    charm: 3,      // affects affinity gain from choices
    statPoints: 0, // unspent points from leveling up
};

// --- XP curve: XP required to reach the NEXT level, indexed by current level ---
export function xpToNextLevel(level) {
    return 20 + (level - 1) * 15;
}

// --- Enemy scaling: enemy stats grow with the player's level so later
// Whisperwood encounters stay meaningful instead of going flat forever.
// Applied multiplicatively on top of the enemy's base hp/strength/xp.
export function enemyScaleForLevel(level) {
    const steps = Math.max(0, level - 1);
    return {
        hp: 1 + steps * 0.18,
        strength: 1 + steps * 0.12,
        xp: 1 + steps * 0.1,
    };
}

export function scaledEnemy(enemyId, level) {
    const base = ENEMY_DEFS[enemyId];
    if (!base) return null;
    const scale = enemyScaleForLevel(level);
    return {
        ...base,
        hp: Math.round(base.hp * scale.hp),
        strength: Math.max(base.strength, Math.round(base.strength * scale.strength)),
        xp: Math.round(base.xp * scale.xp),
    };
}

// --- Starting inventory: array of { id, count } ---
export const STARTING_INVENTORY = [
    { id: 'dried_mintleaf', count: 3 },
];

// --- Item definitions ---
// type: 'material' (quest/crafting), 'equip' (wearable, grants stat bonus), 'consumable'
// Equip items declare a `slot` ('trinket' or 'charm' — two independent slots as of Phase 3).
// Some equip items trade a bonus for a penalty (e.g. +Strength/-Wit) rather than a flat gain.
export const ITEM_DEFS = {
    dried_mintleaf: {
        name: 'Dried Mintleaf',
        type: 'material',
        icon: '🌿',
        desc: 'A common herb. Smells faintly of tea. Used in brewing.',
    },
    silver_thimble: {
        name: "Grandmother's Thimble",
        type: 'equip',
        slot: 'trinket',
        icon: '🪡',
        desc: 'A tarnished silver thimble. Wearing it steadies your hands. (+2 Wit)',
        bonus: { wit: 2 },
    },
    oak_charm: {
        name: 'Oak Charm',
        type: 'equip',
        slot: 'trinket',
        icon: '🌰',
        desc: 'A carved charm from the Whisperwood. (+2 Strength)',
        bonus: { strength: 2 },
    },
    honey_tonic: {
        name: 'Honey Tonic',
        type: 'consumable',
        icon: '🍯',
        desc: 'A sweet restorative. Heals 10 HP when used in battle.',
        heal: 10,
    },
    cellar_key: {
        name: 'Cellar Key',
        type: 'material',
        icon: '🗝️',
        desc: 'A rust-spotted iron key. Opens the shop cellar.',
    },

    // --- Phase 3: brewing materials ---
    river_root: {
        name: 'River Root',
        type: 'material',
        icon: '🥕',
        desc: 'A pale, bitter root pulled from the creek bank. Used in brewing.',
    },
    thornback_quill: {
        name: 'Thornback Quill',
        type: 'material',
        icon: '🪶',
        desc: 'A barbed quill shed by a Whisperwood thornback. Used in brewing.',
    },
    moonpetal: {
        name: 'Moonpetal',
        type: 'material',
        icon: '🌸',
        desc: 'A pale flower that only blooms in deep shade. Used in brewing.',
    },

    // --- Phase 3: brewed consumables ---
    vigor_draught: {
        name: 'Vigor Draught',
        type: 'consumable',
        icon: '🧪',
        desc: 'A brewed tonic, stronger than a simple Honey Tonic. Heals 18 HP in battle.',
        heal: 18,
    },
    steady_hand_tea: {
        name: 'Steady-Hand Tea',
        type: 'consumable',
        icon: '🍵',
        desc: 'Calms the nerves before a fight. Heals 8 HP and never fails to help you flee this turn.',
        heal: 8,
        guaranteedFlee: true,
    },

    // --- Phase 3: trade-off equip items (a second "charm" slot) ---
    thornback_bracer: {
        name: 'Thornback Bracer',
        type: 'equip',
        slot: 'charm',
        icon: '🩹',
        desc: 'Stiff, barbed leather. Hits harder, but the bulk slows your reflexes. (+3 Strength, -1 Wit)',
        bonus: { strength: 3 },
        penalty: { wit: 1 },
    },
    moonpetal_locket: {
        name: 'Moonpetal Locket',
        type: 'equip',
        slot: 'charm',
        icon: '🔮',
        desc: 'Pressed moonpetal under glass. Sharpens the mind, softens the swing. (+3 Wit, -1 Strength)',
        bonus: { wit: 3 },
        penalty: { strength: 1 },
    },
    bakers_locket: {
        name: "Baker's Locket",
        type: 'equip',
        slot: 'charm',
        icon: '📿',
        desc: 'A small locket Bramwell pressed on you "for luck." Warms people to you, but you fight a little more timidly wearing it. (+3 Charm, -1 Strength)',
        bonus: { charm: 3 },
        penalty: { strength: 1 },
    },
};

// --- Brewing recipes: material items consumed to produce a result item. ---
// requires: array of { item, count }. result: { item, count }.
export const BREW_RECIPES = {
    vigor_draught: {
        name: 'Vigor Draught',
        result: { item: 'vigor_draught', count: 1 },
        requires: [
            { item: 'dried_mintleaf', count: 2 },
            { item: 'river_root', count: 1 },
        ],
    },
    steady_hand_tea: {
        name: 'Steady-Hand Tea',
        result: { item: 'steady_hand_tea', count: 1 },
        requires: [
            { item: 'dried_mintleaf', count: 1 },
            { item: 'moonpetal', count: 1 },
        ],
    },
    thornback_bracer: {
        name: 'Thornback Bracer',
        result: { item: 'thornback_bracer', count: 1 },
        requires: [
            { item: 'thornback_quill', count: 2 },
            { item: 'river_root', count: 1 },
        ],
    },
    moonpetal_locket: {
        name: 'Moonpetal Locket',
        result: { item: 'moonpetal_locket', count: 1 },
        requires: [
            { item: 'moonpetal', count: 2 },
            { item: 'dried_mintleaf', count: 1 },
        ],
    },
};

// --- Enemy definitions (for light battle encounters) ---
// Base stats only — actual encounters scale these via scaledEnemy() based on
// player level (see enemyScaleForLevel above) so the Whisperwood stays a threat.
export const ENEMY_DEFS = {
    cellar_slime: {
        name: 'Cellar Slime',
        icon: '🟢',
        hp: 14,
        strength: 2,
        xp: 12,
        fleeable: true,
    },
    hedge_wolf: {
        name: 'Hedge Wolf',
        icon: '🐺',
        hp: 22,
        strength: 4,
        xp: 20,
        fleeable: true,
    },
    thornback_boar: {
        name: 'Thornback Boar',
        icon: '🐗',
        hp: 30,
        strength: 5,
        xp: 26,
        fleeable: true,
    },
    deep_wood_stalker: {
        name: 'Deep-Wood Stalker',
        icon: '🦉',
        hp: 40,
        strength: 6,
        xp: 34,
        fleeable: false,
    },
};

// --- Color palette (DOM/CSS hex strings) ---
export const COLORS = {
    bg:      '#161320',
    panel:   '#211d2e',
    text:    '#f0e9da',
    accent:  '#e0a458',
    danger:  '#d1495b',
    success: '#7fb069',
    gold:    '#ffd166',
};

// --- Typewriter text speed (ms per character) ---
export const TYPEWRITER_MS_PER_CHAR = 18;

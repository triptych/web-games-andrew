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

// --- Starting inventory: array of { id, count } ---
export const STARTING_INVENTORY = [
    { id: 'dried_mintleaf', count: 3 },
];

// --- Item definitions ---
// type: 'material' (quest/crafting), 'equip' (wearable, grants stat bonus), 'consumable'
export const ITEM_DEFS = {
    dried_mintleaf: {
        name: 'Dried Mintleaf',
        type: 'material',
        icon: '🌿',
        desc: 'A common herb. Smells faintly of tea.',
    },
    silver_thimble: {
        name: "Grandmother's Thimble",
        type: 'equip',
        icon: '🪡',
        desc: 'A tarnished silver thimble. Wearing it steadies your hands. (+2 Wit)',
        bonus: { wit: 2 },
    },
    oak_charm: {
        name: 'Oak Charm',
        type: 'equip',
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
};

// --- Enemy definitions (for light battle encounters) ---
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

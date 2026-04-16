// ============================================================
// The River — Configuration
// ============================================================

// --- Canvas ---
export const GAME_WIDTH  = 1280;
export const GAME_HEIGHT = 720;

// --- Starting resources ---
export const STARTING_SCORE = 0;
export const STARTING_LIVES = 3;

// --- Color palette ---
export const COLORS = {
    bg:       [8, 18, 28],        // deep river-night blue
    text:     [210, 220, 200],    // warm parchment
    accent:   [120, 200, 160],    // river-green
    danger:   [200, 80, 60],
    success:  [100, 200, 120],
    gold:     [220, 185, 80],
    water:    [40, 100, 160],
    dusk:     [180, 120, 80],
};

// --- River journey ---
export const RIVER_SEGMENTS = 10;   // number of encounter stops before the tower
export const MAX_COMPANIONS  = 6;   // maximum travelers you can bring along

// --- Companion archetypes ---
// Each companion type contributes to one or more dinner success categories:
//   cooking | decorating | stories | strength | wisdom | music
export const COMPANION_TYPES = [
    { id: 'chef',       name: 'Retired Chef',       emoji: '👨‍🍳', skills: ['cooking'],              rarity: 'common' },
    { id: 'gardener',   name: 'Old Gardener',        emoji: '🌿',  skills: ['decorating', 'cooking'], rarity: 'common' },
    { id: 'bard',       name: 'Wandering Bard',      emoji: '🎵',  skills: ['music', 'stories'],       rarity: 'common' },
    { id: 'merchant',   name: 'Weary Merchant',      emoji: '💰',  skills: ['cooking'],               rarity: 'common' },
    { id: 'knight',     name: 'Faded Knight',        emoji: '⚔️',  skills: ['strength', 'stories'],    rarity: 'uncommon' },
    { id: 'herbalist',  name: 'Wandering Herbalist', emoji: '🌸',  skills: ['cooking', 'wisdom'],      rarity: 'uncommon' },
    { id: 'painter',    name: 'Reclusive Painter',   emoji: '🎨',  skills: ['decorating'],             rarity: 'uncommon' },
    { id: 'sailor',     name: 'Old Sailor',          emoji: '⚓',  skills: ['stories', 'strength'],    rarity: 'uncommon' },
    { id: 'alchemist',  name: 'Eccentric Alchemist', emoji: '⚗️',  skills: ['cooking', 'wisdom'],      rarity: 'rare' },
    { id: 'sculptor',   name: 'Master Sculptor',     emoji: '🗿',  skills: ['decorating', 'wisdom'],   rarity: 'rare' },
    { id: 'oracle',     name: 'Wandering Oracle',    emoji: '🔮',  skills: ['wisdom', 'stories'],      rarity: 'rare' },
    { id: 'troubadour', name: 'Exiled Troubadour',   emoji: '🎭',  skills: ['music', 'decorating'],    rarity: 'rare' },
];

// --- Ingredient categories ---
export const INGREDIENT_TYPES = [
    { id: 'herb',    name: 'River Herbs',     emoji: '🌿', category: 'cooking'    },
    { id: 'fish',    name: 'Fresh Fish',      emoji: '🐟', category: 'cooking'    },
    { id: 'spice',   name: 'Exotic Spice',    emoji: '🌶️', category: 'cooking'    },
    { id: 'flower',  name: 'Rare Flower',     emoji: '🌸', category: 'decorating' },
    { id: 'candle',  name: 'Beeswax Candle',  emoji: '🕯️', category: 'decorating' },
    { id: 'ribbon',  name: 'Silk Ribbon',     emoji: '🎀', category: 'decorating' },
    { id: 'wine',    name: 'Fine Wine',       emoji: '🍷', category: 'cooking'    },
    { id: 'gem',     name: 'River Gem',       emoji: '💎', category: 'decorating' },
];

// --- Dinner success thresholds ---
export const DINNER_THRESHOLDS = {
    catastrophe: 10,
    poor:        20,
    adequate:    35,
    good:        50,
    great:       70,
    legendary:  100,
};

// --- Daily news update flavor ---
export const NEWS_CADENCE_MS = 30000; // how often the tower sends a new "hint" during play

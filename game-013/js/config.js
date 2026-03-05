// ============================================================
// Petal & Purse — Configuration
// ============================================================

// --- Canvas ---
export const GAME_WIDTH  = 1280;
export const GAME_HEIGHT = 720;

// --- Starting resources ---
export const STARTING_SCORE = 0;
export const STARTING_LIVES = 3;
export const STARTING_GOLD  = 15;

// --- Color palette (soft, cozy) ---
export const COLORS = {
    bg:       [34, 28, 42],       // deep dusk purple
    text:     [240, 230, 210],    // warm cream
    accent:   [255, 180, 120],    // warm peach
    muted:    [150, 130, 160],    // soft lilac-grey
    gold:     [255, 210, 60],     // warm gold
    green:    [120, 200, 130],    // soft leaf green
    pink:     [255, 160, 190],    // petal pink
    soil:     [110, 75, 50],      // earth brown
    success:  [140, 220, 140],
    danger:   [230, 100, 100],
};

// --- Shop: seed definitions ---
// cost = buy price, sellValue = what the grown flower sells for, growTime = seconds
export const SEEDS = {
    daisy: {
        name: 'Daisy Seed',
        emoji: '🌼',
        cost: 3,
        sellValue: 7,
        growTime: 8,
        color: [255, 240, 180],
    },
    tulip: {
        name: 'Tulip Bulb',
        emoji: '🌷',
        cost: 6,
        sellValue: 14,
        growTime: 14,
        color: [255, 140, 170],
    },
    sunflower: {
        name: 'Sunflower Seed',
        emoji: '🌻',
        cost: 10,
        sellValue: 24,
        growTime: 22,
        color: [255, 200, 50],
    },
    rose: {
        name: 'Rose Cutting',
        emoji: '🌹',
        cost: 18,
        sellValue: 45,
        growTime: 35,
        color: [220, 60, 80],
    },
};

// --- Shop: pot definitions ---
export const POTS = {
    clay: {
        name: 'Clay Pot',
        cost: 0,          // starter pot, free
        speedBonus: 0,    // % grow speed bonus
        yieldBonus: 0,    // +N gold on harvest
        description: 'A humble clay pot.',
    },
    glazed: {
        name: 'Glazed Pot',
        cost: 20,
        speedBonus: 20,
        yieldBonus: 2,
        description: '+20% grow speed, +2g per harvest.',
    },
    terracotta: {
        name: 'Terracotta Pot',
        cost: 50,
        speedBonus: 40,
        yieldBonus: 5,
        description: '+40% grow speed, +5g per harvest.',
    },
};

// --- Shop: soil definitions ---
export const SOILS = {
    basic: {
        name: 'Basic Soil',
        cost: 0,
        speedBonus: 0,
        yieldBonus: 0,
        description: 'Plain potting mix.',
    },
    rich: {
        name: 'Rich Compost',
        cost: 15,
        speedBonus: 25,
        yieldBonus: 3,
        description: '+25% grow speed, +3g per harvest.',
    },
    enchanted: {
        name: 'Enchanted Soil',
        cost: 45,
        speedBonus: 60,
        yieldBonus: 8,
        description: '+60% grow speed, +8g per harvest.',
    },
};

// --- Number of plant slots ---
export const SLOT_COUNT = 5;

// --- Grow stage thresholds (0–1 progress) ---
export const GROW_STAGES = [0, 0.25, 0.55, 0.85, 1.0];

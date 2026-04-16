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
    // Common
    { id: 'chef',        name: 'Retired Chef',         emoji: '👨‍🍳', skills: ['cooking'],                rarity: 'common' },
    { id: 'gardener',    name: 'Old Gardener',          emoji: '🌿',  skills: ['decorating', 'cooking'],   rarity: 'common' },
    { id: 'bard',        name: 'Wandering Bard',        emoji: '🎵',  skills: ['music', 'stories'],         rarity: 'common' },
    { id: 'merchant',    name: 'Weary Merchant',        emoji: '💰',  skills: ['cooking'],                 rarity: 'common' },
    { id: 'farmer',      name: 'Retired Farmer',        emoji: '🌾',  skills: ['cooking', 'strength'],      rarity: 'common' },
    { id: 'innkeeper',   name: 'Wandering Innkeeper',   emoji: '🍺',  skills: ['cooking', 'stories'],       rarity: 'common' },
    { id: 'weaver',      name: 'Old Weaver',            emoji: '🧵',  skills: ['decorating'],               rarity: 'common' },
    { id: 'fisherman',   name: 'River Fisherman',       emoji: '🎣',  skills: ['cooking', 'strength'],      rarity: 'common' },
    // Uncommon
    { id: 'knight',      name: 'Faded Knight',          emoji: '⚔️',  skills: ['strength', 'stories'],      rarity: 'uncommon' },
    { id: 'herbalist',   name: 'Wandering Herbalist',   emoji: '🌸',  skills: ['cooking', 'wisdom'],        rarity: 'uncommon' },
    { id: 'painter',     name: 'Reclusive Painter',     emoji: '🎨',  skills: ['decorating'],               rarity: 'uncommon' },
    { id: 'sailor',      name: 'Old Sailor',            emoji: '⚓',  skills: ['stories', 'strength'],      rarity: 'uncommon' },
    { id: 'scribe',      name: 'Retired Scribe',        emoji: '📜',  skills: ['wisdom', 'stories'],        rarity: 'uncommon' },
    { id: 'candlemaker', name: 'Master Candlemaker',    emoji: '🕯️',  skills: ['decorating', 'wisdom'],     rarity: 'uncommon' },
    { id: 'hunter',      name: 'Aging Hunter',          emoji: '🏹',  skills: ['strength', 'cooking'],      rarity: 'uncommon' },
    { id: 'monk',        name: 'Wandering Monk',        emoji: '🙏',  skills: ['wisdom', 'music'],          rarity: 'uncommon' },
    // Rare
    { id: 'alchemist',   name: 'Eccentric Alchemist',   emoji: '⚗️',  skills: ['cooking', 'wisdom'],        rarity: 'rare' },
    { id: 'sculptor',    name: 'Master Sculptor',       emoji: '🗿',  skills: ['decorating', 'wisdom'],     rarity: 'rare' },
    { id: 'oracle',      name: 'Wandering Oracle',      emoji: '🔮',  skills: ['wisdom', 'stories'],        rarity: 'rare' },
    { id: 'troubadour',  name: 'Exiled Troubadour',     emoji: '🎭',  skills: ['music', 'decorating'],      rarity: 'rare' },
    { id: 'brewmaster',  name: 'Legendary Brewmaster',  emoji: '🍻',  skills: ['cooking', 'music'],         rarity: 'rare' },
    { id: 'mapmaker',    name: 'Last Mapmaker',         emoji: '🗺️',  skills: ['wisdom', 'stories', 'strength'], rarity: 'rare' },
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

// --- Lord's Secret Preference ---
// Each run one preference is chosen (from run seed). It applies a 1.5× multiplier
// to that skill at dinner. The hint broadcast mentions it obliquely.
export const LORD_PREFERENCES = [
    { id: 'cooking',    label: 'The Art of the Kitchen',    multiplier: 1.5, hint: "Tower Raven: 'The lord has been sharpening the kitchen knives himself.'" },
    { id: 'decorating', label: 'The Beauty of Adornment',   multiplier: 1.5, hint: "Tower Raven: 'Servants are polishing every mirror and candlestick in the hall.'" },
    { id: 'music',      label: 'The Song of the Hall',       multiplier: 1.5, hint: "Tower Raven: 'The lord's old lute was found tuned and waiting on his chair.'" },
    { id: 'stories',    label: 'The Weight of Old Tales',    multiplier: 1.5, hint: "Tower Raven: 'Every chair in the hall has been pulled close to the hearth.'" },
    { id: 'wisdom',     label: 'The Counsel of the Learned', multiplier: 1.5, hint: "Tower Raven: 'The lord's library door has been left open for the first time in years.'" },
    { id: 'strength',   label: 'The Valor of Old Bones',     multiplier: 1.5, hint: "Tower Raven: 'Old trophies have been brought down from the attic and dusted off.'" },
];

// --- Ingredient Crafting Recipes ---
// At a foraging stop, if you already carry both ingredients, they can be combined.
// Result ingredient gets a rarity bonus (used in scoring).
export const CRAFTING_RECIPES = [
    { input: ['herb',   'spice'],  output: { id: 'tincture', name: 'River Tincture',  emoji: '🧪', category: 'cooking',    crafted: true } },
    { input: ['fish',   'wine'],   output: { id: 'stew',     name: 'Hearth Stew',     emoji: '🍲', category: 'cooking',    crafted: true } },
    { input: ['flower', 'ribbon'], output: { id: 'garland',  name: 'Flower Garland',  emoji: '💐', category: 'decorating', crafted: true } },
    { input: ['candle', 'gem'],    output: { id: 'centrepiece', name: 'Crystal Centrepiece', emoji: '🔮', category: 'decorating', crafted: true } },
];

// --- Alternate Endings ---
// Determined by score AND the composition of the party. Checked after dinner scoring.
export const ALTERNATE_ENDINGS = [
    {
        id: 'all_music',
        condition: (companions, score) => companions.filter(c => c.skills.includes('music')).length >= 3,
        label: 'The Lord Dances',
        text: 'For the first time in a century, music fills the tower. The lord rises from his seat and dances alone in the firelight. No one speaks. It is perfect.',
    },
    {
        id: 'all_wisdom',
        condition: (companions, score) => companions.filter(c => c.skills.includes('wisdom')).length >= 3,
        label: 'The Long Conversation',
        text: 'The dinner lasts until dawn. No one eats much — they talk instead. The lord says it is the finest night he can remember. He offers you his library key.',
    },
    {
        id: 'full_boat',
        condition: (companions, score) => companions.length >= 6,
        label: 'A Crowded Table',
        text: 'Six travelers fill every chair. The hall, unused to warmth, creaks and settles like a contented cat. The lord cannot stop smiling.',
    },
    {
        id: 'lone_traveler',
        condition: (companions, score) => companions.length === 0,
        label: 'A Table for Two',
        text: 'You arrive alone. The lord sets two places anyway. You eat in comfortable silence, watching the river through the high windows. He thanks you for coming.',
    },
    {
        id: 'legendary_crafter',
        condition: (companions, score, ingredients) => ingredients.filter(i => i.crafted).length >= 2,
        label: 'The Alchemist\'s Table',
        text: 'Your crafted ingredients steal the show. The lord\'s cook weeps at the quality. Recipes are recorded for posterity. Your name is added to the tower archives.',
    },
];

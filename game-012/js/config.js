// ============================================================
// Arcana Pull — Configuration
// ============================================================

// --- Canvas ---
export const GAME_WIDTH  = 1280;
export const GAME_HEIGHT = 720;

// --- Starting resources ---
export const STARTING_SCORE = 0;
export const STARTING_LIVES = 3;
export const STARTING_GEMS  = 300;   // gacha currency

// --- Color palette ---
export const COLORS = {
    bg:       [8, 5, 20],
    bgPanel:  [18, 12, 40],
    text:     [220, 200, 255],
    accent:   [180, 100, 255],
    gold:     [255, 215, 0],
    silver:   [180, 190, 210],
    danger:   [255, 80, 80],
    success:  [80, 220, 100],
    mana:     [80, 140, 255],
};

// --- Tarot suit archetypes (mapped to battle roles) ---
export const SUITS = {
    WANDS:    'wands',    // Fire / Attack
    CUPS:     'cups',     // Water / Heal
    SWORDS:   'swords',   // Air / Speed / Control
    PENTACLES:'pentacles',// Earth / Tank / Shield
    MAJOR:    'major',    // Major Arcana — rare, powerful
};

// --- Card rarity tiers ---
export const RARITY = {
    COMMON:    { label: 'Common',    color: [160, 160, 160], pullWeight: 60 },
    UNCOMMON:  { label: 'Uncommon',  color: [100, 200, 120], pullWeight: 25 },
    RARE:      { label: 'Rare',      color: [80, 140, 255],  pullWeight: 12 },
    LEGENDARY: { label: 'Legendary', color: [255, 180, 0],   pullWeight: 3  },
};

// --- Gacha pull costs ---
export const SINGLE_PULL_COST  = 60;   // gems
export const TEN_PULL_COST     = 500;  // gems (discount)
export const PITY_THRESHOLD    = 90;   // guaranteed Legendary after N pulls

// --- Battle parameters ---
export const MAX_PARTY_SIZE = 4;
export const BATTLE_TICK_MS = 1200;    // ms between auto-battle actions
export const MAX_ENEMY_WAVES = 10;

// --- Gem earn rates ---
export const GEMS_PER_WIN    = 80;
export const GEMS_PER_LOSS   = 20;
export const GEMS_PER_WAVE   = 30;

// --- TODO: Add game-specific constants below ---
// export const CARD_DEFS = { ... };   // defined in cards.js
// export const ENEMY_DEFS = { ... };  // defined in enemies.js

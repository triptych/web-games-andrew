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

// --- Reading / Omen ---
export const READING_WAVES = [5, 10];   // waves that trigger The Reading
export const MAX_ITEMS     = 3;         // max consumable item slots
export const REVERSED_CHANCE = 0.30;   // 30% chance a card draws reversed (curse)

// Blessings (positive omens — upright card)
export const BLESSINGS = [
    {
        id:     'blaze',
        label:  'Blaze',
        suit:   'wands',
        desc:   'All party ATK +20% for 5 waves.',
        type:   'buff',
        stat:   'atk',
        mult:   1.20,
    },
    {
        id:     'clarity',
        label:  'Clarity',
        suit:   'swords',
        desc:   'All party SPD +1 for 5 waves.',
        type:   'buff',
        stat:   'spd',
        flat:   1,
    },
    {
        id:     'ward',
        label:  'Ward',
        suit:   'pentacles',
        desc:   'Party gains a one-hit shield at battle start for 5 waves.',
        type:   'buff',
        stat:   'shield',
        flat:   30,
    },
    {
        id:     'mending',
        label:  'Mending',
        suit:   'cups',
        desc:   'Restore 30% max HP to all party members immediately.',
        type:   'heal',
    },
    {
        id:     'fortune',
        label:  'Fortune',
        suit:   'major',
        desc:   'A legendary item is granted to the player.',
        type:   'item',
    },
];

// Curses (negative omens — reversed card)
export const CURSES = [
    {
        id:     'poisoned',
        label:  'Poisoned',
        desc:   'Party loses 5% max HP at the start of each battle tick.',
        type:   'curse',
        stat:   'poison',
    },
    {
        id:     'weakened',
        label:  'Weakened',
        desc:   'All party ATK -20% for 5 waves.',
        type:   'curse',
        stat:   'atk',
        mult:   0.80,
    },
    {
        id:     'slowed',
        label:  'Slowed',
        desc:   'All party SPD -1 (min 1) for 5 waves.',
        type:   'curse',
        stat:   'spd',
        flat:   -1,
    },
    {
        id:     'cursed',
        label:  'Cursed',
        desc:   'Pity counter is frozen for 5 waves.',
        type:   'curse',
        stat:   'pity',
    },
    {
        id:     'hexed',
        label:  'Hexed',
        desc:   'Gem income from the next 5 waves is halved.',
        type:   'curse',
        stat:   'gems',
        mult:   0.50,
    },
];

// Legendary items (granted by Major Arcana blessing)
export const LEGENDARY_ITEMS = [
    { id: 'star_vial',   label: 'Star Vial',    desc: 'Restore all HP to the entire party.',           effect: 'fullHeal'  },
    { id: 'sun_sigil',   label: 'Sun Sigil',     desc: 'Double Gem income for the next wave.',          effect: 'doubleGems' },
    { id: 'moon_shard',  label: 'Moon Shard',    desc: 'Remove all debuffs from the active party.',     effect: 'cleanse'   },
];

// ============================================================
// Tamagoji — Configuration
// ============================================================

// --- Canvas ---
export const GAME_WIDTH  = 480;
export const GAME_HEIGHT = 720;

// --- Pet stat limits ---
export const STAT_MAX = 100;
export const STAT_MIN = 0;

// --- Stat decay rates (per second) ---
export const HUNGER_DECAY   = 0.8;   // hunger drops fastest
export const HAPPY_DECAY    = 0.5;
export const ENERGY_DECAY   = 0.3;
export const HEALTH_DECAY_THRESHOLD = 20; // below this hunger/happy, health drops

// --- Stage thresholds (age in seconds) ---
export const STAGE_EGG_DURATION     = 8;   // egg hatches after 8 seconds
export const STAGE_BABY_DURATION    = 120; // baby for 2 minutes
export const STAGE_CHILD_DURATION   = 300; // child for 5 minutes
export const STAGE_TEEN_DURATION    = 600; // teen for 10 minutes
// adult is final stage

// --- Feeding ---
export const FOOD_TYPES = [
    { id: 'berry',   emoji: '🍓', name: 'Berry',   hunger: 20, happy: 5,  energy: 5  },
    { id: 'meal',    emoji: '🍖', name: 'Meal',    hunger: 40, happy: 10, energy: 15 },
    { id: 'cake',    emoji: '🎂', name: 'Cake',    hunger: 15, happy: 25, energy: 10 },
    { id: 'veggie',  emoji: '🥦', name: 'Veggie',  hunger: 25, happy: -5, energy: 20 },
];

// --- Interactions ---
export const INTERACTION_TYPES = [
    { id: 'play',    emoji: '🎾', name: 'Play',    happy: 20, energy: -15, hunger: -10 },
    { id: 'sleep',   emoji: '😴', name: 'Sleep',   energy: 40, happy: 5,   hunger: -5  },
    { id: 'bath',    emoji: '🛁', name: 'Bath',    happy: 10, health: 10,  hunger: 0   },
    { id: 'cuddle',  emoji: '🤗', name: 'Cuddle',  happy: 15, energy: 5,   hunger: 0   },
];

// --- Pet species definitions (each has emoji per life stage) ---
export const PET_SPECIES = [
    {
        id: 'dino',
        name: 'Dinofriend',
        egg: '🥚',
        baby:  '🐣',
        child: '🦎',
        teen:  '🦕',
        adult: '🦖',
        color: [80, 200, 100],
    },
    {
        id: 'spirit',
        name: 'Spirit',
        egg: '🪄',
        baby:  '✨',
        child: '👻',
        teen:  '🌟',
        adult: '🌈',
        color: [180, 100, 255],
    },
    {
        id: 'dragon',
        name: 'Dragonlet',
        egg: '🥚',
        baby:  '🐉',
        child: '🐲',
        teen:  '🔥',
        adult: '🐲',
        color: [255, 120, 60],
    },
    {
        id: 'aqua',
        name: 'Aquapup',
        egg: '🫧',
        baby:  '🐟',
        child: '🐠',
        teen:  '🐬',
        adult: '🐳',
        color: [60, 180, 255],
    },
    {
        id: 'bunny',
        name: 'Bunbun',
        egg: '🥚',
        baby:  '🐇',
        child: '🐰',
        teen:  '🌸',
        adult: '🦄',
        color: [255, 180, 210],
    },
];

// --- Color palette ---
export const COLORS = {
    bg:       [15, 10, 30],
    bgCard:   [25, 20, 45],
    text:     [220, 220, 240],
    textDim:  [120, 110, 150],
    accent:   [160, 100, 255],
    accentAlt:[100, 200, 255],
    gold:     [255, 215, 0],
    danger:   [255, 80,  80],
    success:  [80,  220, 100],
    warning:  [255, 180, 40],
    bar: {
        hunger: [255, 140, 60],
        happy:  [255, 220, 60],
        energy: [80,  180, 255],
        health: [80,  220, 100],
    },
};

// --- UI Layout ---
export const PET_DISPLAY_Y    = 300;  // center Y of pet display area
export const STAT_BAR_START_Y = 430;  // top of stat bars section
export const ACTION_BAR_Y     = 600;  // Y of bottom action buttons
export const ACTION_BTN_SIZE  = 64;   // tap target size

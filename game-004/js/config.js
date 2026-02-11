// Game dimensions - fits standard desktop (16:9)
export const GAME_WIDTH = 1280;
export const GAME_HEIGHT = 720;

// Grid layout
export const TILE_SIZE = 40;
export const GRID_COLS = 32;
export const GRID_ROWS = 15;
export const GRID_OFFSET_Y = 48;
export const HUD_HEIGHT = 48;
export const TOOLBAR_HEIGHT = 72;
export const TOOLBAR_Y = GAME_HEIGHT - TOOLBAR_HEIGHT;

// Starting resources
export const STARTING_GOLD = 500;
export const STARTING_LIVES = 20;

// Path waypoints (grid coordinates) - S-curve from left to right
export const PATH_WAYPOINTS = [
    { col: 0, row: 2 },
    { col: 9, row: 2 },
    { col: 9, row: 6 },
    { col: 3, row: 6 },
    { col: 3, row: 10 },
    { col: 15, row: 10 },
    { col: 15, row: 3 },
    { col: 22, row: 3 },
    { col: 22, row: 11 },
    { col: 28, row: 11 },
    { col: 28, row: 6 },
    { col: 31, row: 6 },
];

// Tower definitions
export const TOWER_DEFS = {
    archer: {
        name: "Archer",
        cost: 100,
        damage: 10,
        range: 150,
        attackSpeed: 1.0, // attacks per second (10 DPS)
        projectileSpeed: 400,
        color: { r: 80, g: 145, b: 60 },
        hotkey: "1",
        description: "Fast attack, medium range",
        upgrades: [
            { cost: 80, damageBonus: 5, rangeBonus: 20, attackSpeedBonus: 0.2 },   // Tier 1
            { cost: 120, damageBonus: 8, rangeBonus: 30, attackSpeedBonus: 0.3 },  // Tier 2
            { cost: 180, damageBonus: 12, rangeBonus: 40, attackSpeedBonus: 0.5 }, // Tier 3
        ],
    },
    cannon: {
        name: "Cannon",
        cost: 250,
        damage: 50,
        range: 200,
        attackSpeed: 0.5, // attacks per second (25 DPS)
        projectileSpeed: 200,
        splashRadius: 60,
        color: { r: 100, g: 100, b: 100 },
        hotkey: "2",
        description: "Slow, high damage, splash",
        upgrades: [
            { cost: 180, damageBonus: 25, rangeBonus: 30, splashRadiusBonus: 10 },  // Tier 1
            { cost: 280, damageBonus: 40, rangeBonus: 50, splashRadiusBonus: 20 },  // Tier 2
            { cost: 420, damageBonus: 70, rangeBonus: 70, splashRadiusBonus: 30 },  // Tier 3
        ],
    },
    mage: {
        name: "Mage",
        cost: 200,
        damage: 15,
        range: 175,
        attackSpeed: 1.0, // attacks per second (15 DPS)
        projectileSpeed: 350,
        slowDuration: 2.0, // seconds
        slowAmount: 0.5, // 50% slow
        color: { r: 130, g: 80, b: 180 },
        hotkey: "3",
        description: "Magic damage, slows enemies",
        upgrades: [
            { cost: 150, damageBonus: 10, rangeBonus: 25, slowAmountBonus: 0.1 },   // Tier 1
            { cost: 220, damageBonus: 15, rangeBonus: 35, slowAmountBonus: 0.15 },  // Tier 2
            { cost: 350, damageBonus: 25, rangeBonus: 50, slowAmountBonus: 0.2 },   // Tier 3
        ],
    },
    tesla: {
        name: "Tesla",
        cost: 300,
        damage: 20,
        range: 100,
        attackSpeed: 1.0, // attacks per second (20 DPS)
        chainCount: 3, // hits up to 3 enemies
        chainRange: 80,
        color: { r: 60, g: 140, b: 200 },
        hotkey: "4",
        description: "Chain lightning, short range",
        upgrades: [
            { cost: 220, damageBonus: 12, rangeBonus: 20, chainCountBonus: 1 },     // Tier 1
            { cost: 340, damageBonus: 20, rangeBonus: 30, chainCountBonus: 1 },     // Tier 2
            { cost: 500, damageBonus: 35, rangeBonus: 50, chainCountBonus: 2 },     // Tier 3
        ],
    },
    sniper: {
        name: "Sniper",
        cost: 350,
        damage: 100,
        range: 300,
        attackSpeed: 0.4, // attacks per second (40 DPS)
        projectileSpeed: 800,
        armorPierce: 0.5, // ignores 50% of armor
        color: { r: 140, g: 80, b: 50 },
        hotkey: "5",
        description: "Long range, armor pierce",
        upgrades: [
            { cost: 250, damageBonus: 50, rangeBonus: 50, attackSpeedBonus: 0.1 },  // Tier 1
            { cost: 400, damageBonus: 80, rangeBonus: 80, attackSpeedBonus: 0.15 }, // Tier 2
            { cost: 600, damageBonus: 150, rangeBonus: 100, attackSpeedBonus: 0.25 }, // Tier 3
        ],
    },
};

// Enemy definitions
export const ENEMY_DEFS = {
    scout: {
        name: "Scout",
        hp: 40,
        speed: 90,
        armor: 0,
        reward: 10,
        damage: 1,
        size: 10,
        color: { r: 200, g: 60, b: 60 },
    },
    soldier: {
        name: "Soldier",
        hp: 100,
        speed: 70,
        armor: 5,
        reward: 20,
        damage: 2,
        size: 12,
        color: { r: 100, g: 140, b: 100 },
    },
    tank: {
        name: "Tank",
        hp: 300,
        speed: 40,
        armor: 20,
        reward: 50,
        damage: 3,
        size: 16,
        color: { r: 80, g: 80, b: 80 },
    },
    speedster: {
        name: "Speedster",
        hp: 60,
        speed: 140,
        armor: 0,
        reward: 25,
        damage: 1,
        size: 9,
        color: { r: 255, g: 200, b: 50 },
    },
    boss: {
        name: "Boss",
        hp: 800,
        speed: 50,
        armor: 30,
        reward: 150,
        damage: 5,
        size: 24,
        color: { r: 150, g: 50, b: 200 },
    },
};

// Wave definitions (Phase 3: Multiple enemy types with scaling difficulty)
export const WAVE_DEFS = [
    // Waves 1-4: Tutorial waves - Single enemy types
    { enemies: [{ type: "scout", count: 5, interval: 1.2 }] },
    { enemies: [{ type: "scout", count: 8, interval: 1.0 }] },
    { enemies: [{ type: "soldier", count: 4, interval: 1.5 }] },
    { enemies: [{ type: "scout", count: 10, interval: 0.9 }] },

    // Wave 5: First Boss
    { enemies: [{ type: "boss", count: 1, interval: 0 }], isBoss: true },

    // Waves 6-9: Mixed enemy types
    { enemies: [
        { type: "scout", count: 8, interval: 0.8 },
        { type: "soldier", count: 4, interval: 1.2 }
    ] },
    { enemies: [
        { type: "speedster", count: 6, interval: 0.9 },
        { type: "scout", count: 6, interval: 0.8 }
    ] },
    { enemies: [
        { type: "soldier", count: 8, interval: 1.0 },
        { type: "speedster", count: 4, interval: 0.8 }
    ] },
    { enemies: [
        { type: "tank", count: 2, interval: 2.0 },
        { type: "scout", count: 12, interval: 0.6 }
    ] },

    // Wave 10: Boss wave
    { enemies: [
        { type: "boss", count: 1, interval: 0 },
        { type: "soldier", count: 4, interval: 1.5 }
    ], isBoss: true },

    // Waves 11-14: Increased difficulty
    { enemies: [
        { type: "tank", count: 3, interval: 1.8 },
        { type: "speedster", count: 6, interval: 0.7 }
    ] },
    { enemies: [
        { type: "soldier", count: 12, interval: 0.8 },
        { type: "speedster", count: 8, interval: 0.6 }
    ] },
    { enemies: [
        { type: "tank", count: 4, interval: 1.5 },
        { type: "soldier", count: 8, interval: 0.9 }
    ] },
    { enemies: [
        { type: "speedster", count: 12, interval: 0.5 },
        { type: "tank", count: 3, interval: 1.8 }
    ] },

    // Wave 15: Boss wave
    { enemies: [
        { type: "boss", count: 2, interval: 3.0 },
        { type: "speedster", count: 8, interval: 0.6 }
    ], isBoss: true },

    // Waves 16-19: Maximum challenge
    { enemies: [
        { type: "tank", count: 6, interval: 1.2 },
        { type: "soldier", count: 10, interval: 0.7 },
        { type: "speedster", count: 8, interval: 0.5 }
    ] },
    { enemies: [
        { type: "speedster", count: 15, interval: 0.4 },
        { type: "tank", count: 5, interval: 1.5 }
    ] },
    { enemies: [
        { type: "soldier", count: 20, interval: 0.5 },
        { type: "tank", count: 4, interval: 1.8 }
    ] },
    { enemies: [
        { type: "tank", count: 8, interval: 1.0 },
        { type: "speedster", count: 12, interval: 0.4 },
        { type: "soldier", count: 10, interval: 0.6 }
    ] },

    // Wave 20: Final Boss wave
    { enemies: [
        { type: "boss", count: 3, interval: 4.0 },
        { type: "tank", count: 5, interval: 1.5 },
        { type: "speedster", count: 10, interval: 0.5 }
    ], isBoss: true },
];

// Wave completion bonus gold
export const WAVE_BONUS_GOLD = 25;

// Sell refund rate
export const SELL_REFUND_RATE = 0.75;

// Tower targeting priorities
export const TARGETING_PRIORITIES = {
    first: { name: "First", description: "Closest to exit" },
    last: { name: "Last", description: "Furthest from exit" },
    strongest: { name: "Strongest", description: "Highest HP" },
    weakest: { name: "Weakest", description: "Lowest HP" },
};

// Colors
export const COLORS = {
    grass: { r: 62, g: 100, b: 50 },
    grassAlt: { r: 68, g: 108, b: 55 },
    path: { r: 175, g: 150, b: 105 },
    pathBorder: { r: 140, g: 120, b: 85 },
    hudBg: { r: 25, g: 28, b: 38 },
    toolbarBg: { r: 32, g: 35, b: 48 },
    goldText: { r: 255, g: 215, b: 0 },
    livesText: { r: 255, g: 90, b: 90 },
    validPlace: { r: 0, g: 200, b: 80 },
    invalidPlace: { r: 200, g: 50, b: 50 },
    buttonBg: { r: 50, g: 55, b: 70 },
    buttonHover: { r: 70, g: 75, b: 95 },
    startBtn: { r: 45, g: 140, b: 65 },
};

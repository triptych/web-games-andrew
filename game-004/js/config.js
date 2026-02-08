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
export const STARTING_GOLD = 200;
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
        cost: 50,
        damage: 12,
        range: 120,
        attackSpeed: 1.0, // attacks per second
        projectileSpeed: 320,
        color: { r: 80, g: 145, b: 60 },
        hotkey: "1",
    },
};

// Enemy definitions
export const ENEMY_DEFS = {
    scout: {
        name: "Scout",
        hp: 40,
        speed: 90,
        reward: 10,
        damage: 1,
        size: 10,
        color: { r: 200, g: 60, b: 60 },
    },
};

// Wave definitions (Phase 1: scouts only)
export const WAVE_DEFS = [
    { enemies: [{ type: "scout", count: 5, interval: 1.2 }] },
    { enemies: [{ type: "scout", count: 8, interval: 1.0 }] },
    { enemies: [{ type: "scout", count: 10, interval: 0.9 }] },
    { enemies: [{ type: "scout", count: 12, interval: 0.8 }] },
    { enemies: [{ type: "scout", count: 15, interval: 0.7 }] },
    { enemies: [{ type: "scout", count: 18, interval: 0.6 }] },
    { enemies: [{ type: "scout", count: 22, interval: 0.55 }] },
    { enemies: [{ type: "scout", count: 25, interval: 0.5 }] },
    { enemies: [{ type: "scout", count: 30, interval: 0.45 }] },
    { enemies: [{ type: "scout", count: 35, interval: 0.4 }] },
];

// Wave completion bonus gold
export const WAVE_BONUS_GOLD = 25;

// Sell refund rate
export const SELL_REFUND_RATE = 0.75;

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

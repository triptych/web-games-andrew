// ============================================================
// Crypt Crawler — Configuration
// ============================================================

// --- Starting resources ---
export const STARTING_SCORE  = 0;
export const STARTING_HEALTH = 100;

// --- Camera (top-down, slightly angled — classic Gauntlet feel) ---
export const CAM_FOV     = 55;
export const CAM_NEAR    = 0.1;
export const CAM_FAR     = 400;
export const CAM_OFFSET  = [0, 22, 14];   // offset from player (x, y, z) — overhead + slight tilt

// --- World / maze grid ---
export const TILE_SIZE   = 4;             // world units per maze cell
export const WALL_HEIGHT = 3;

// --- Color palette (hex integers — three.js wants 0xRRGGBB, not [r,g,b]) ---
export const COLORS = {
    bg:       0x0a0a14,
    text:     '#dcdcf0',
    accent:   0x64c8ff,
    danger:   0xff5050,
    success:  0x50dc64,
    gold:     0xffd700,

    floor:    0x1c1c2e,
    wall:     0x3a3a5c,
    wallTop:  0x52527a,
    door:     0x8a5a2a,
    nest:     0x6a2020,
};

// --- Player classes (Gauntlet four) ---
// speed: world units/sec · power: attack damage · hp: max health · range: ranged shot length (0 = melee)
export const CLASSES = {
    1: { key: 'warrior',  name: 'Warrior',  color: 0xff5050, speed: 6,  power: 30, hp: 160, range: 0 },
    2: { key: 'valkyrie', name: 'Valkyrie', color: 0x64c8ff, speed: 7,  power: 20, hp: 120, range: 6 },
    3: { key: 'wizard',   name: 'Wizard',   color: 0xb060ff, speed: 6,  power: 45, hp: 80,  range: 10 },
    4: { key: 'elf',      name: 'Elf',      color: 0x50dc64, speed: 9,  power: 15, hp: 90,  range: 8 },
};

// --- Enemies ---
export const ENEMY_DEFS = {
    grunt:   { color: 0x70b070, speed: 2.5, hp: 20, damage: 8,  score: 10 },
    ghost:   { color: 0xc0c0e0, speed: 4.0, hp: 12, damage: 6,  score: 15 },
    demon:   { color: 0xff7040, speed: 3.0, hp: 40, damage: 14, score: 30 },
};

// --- Monster nests (spawners) ---
export const NEST_HP          = 60;
export const NEST_SPAWN_EVERY = 2.5;   // seconds between spawns
export const NEST_MAX_ALIVE   = 6;     // cap on enemies spawned per nest at once
export const NEST_SCORE       = 100;

// --- Pickups ---
export const PICKUP_DEFS = {
    food:     { color: 0xff60a0, heal: 25,  score: 0 },   // restores health
    treasure: { color: 0xffd700, heal: 0,   score: 50 },  // pure score
    potion:   { color: 0x60c0ff, heal: 0,   score: 25 },  // (reserved: future power-up)
    key:      { color: 0xffe070, heal: 0,   score: 0 },   // opens one door
};

// --- Combat ---
export const ATTACK_COOLDOWN = 0.35;   // seconds between attacks
export const SHOT_SPEED       = 18;    // world units/sec for ranged projectiles
export const SHOT_LIFETIME    = 1.2;   // seconds before a shot despawns

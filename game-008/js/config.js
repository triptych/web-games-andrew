// ============================================================
// Game 008 — Centipede Tower Defense: Configuration
// ============================================================

// --- Canvas / Game dimensions ---
export const GAME_WIDTH  = 1280;
export const GAME_HEIGHT = 720;

// --- Grid ---
export const TILE_SIZE   = 40;
export const GRID_COLS   = 24;
export const GRID_ROWS   = 18;

// Center the 960×720 grid within 1280×720, leaving 160px side margins.
export const GRID_OFFSET_X = (GAME_WIDTH  - GRID_COLS * TILE_SIZE) / 2; // 160
export const GRID_OFFSET_Y = 0;

// --- Zone row boundaries (inclusive) ---
export const ENEMY_ZONE_MAX  = 12; // rows 0-12  — centipede territory, tower slots here
export const BUFFER_ZONE_MIN = 13; // rows 13-14 — danger strip, no towers
export const BUFFER_ZONE_MAX = 14;
export const PLAYER_ZONE_MIN = 15; // rows 15-17 — player ship lives here
export const PLAYER_ZONE_MAX = 17;

// --- Starting resources ---
export const STARTING_GOLD  = 200;
export const STARTING_LIVES = 3;
export const STARTING_SCORE = 0;
export const SMART_BOMBS_PER_WAVE = 3;

// --- Node config ---
export const NODES_AT_START = 30;
export const NODE_MAX_HP    = 4;

// --- Tower placement slots (pre-designated positions in the enemy zone) ---
// ~20 slots scattered through rows 1-11, avoiding edges (col 0 & 23).
export const TOWER_SLOTS = [
    // Row 1
    { col: 4,  row: 1 }, { col: 10, row: 1 }, { col: 14, row: 1 }, { col: 20, row: 1 },
    // Row 3
    { col: 2,  row: 3 }, { col: 8,  row: 3 }, { col: 16, row: 3 }, { col: 22, row: 3 },
    // Row 5
    { col: 5,  row: 5 }, { col: 12, row: 5 }, { col: 19, row: 5 },
    // Row 7
    { col: 3,  row: 7 }, { col: 9,  row: 7 }, { col: 17, row: 7 }, { col: 21, row: 7 },
    // Row 9
    { col: 6,  row: 9 }, { col: 11, row: 9 }, { col: 18, row: 9 },
    // Row 11
    { col: 4,  row: 11 }, { col: 15, row: 11 }, { col: 20, row: 11 },
];

// Fast lookup set (populated at module load time)
export const TOWER_SLOT_SET = new Set(TOWER_SLOTS.map(s => `${s.col},${s.row}`));

// --- Tower definitions ---
// fireRate: seconds between shots (lower = faster)
export const TOWER_DEFS = {
    blaster: {
        name:     'Blaster',
        cost:     150,
        damage:   8,
        fireRate: 0.6,
        range:    5,      // in tiles
        special:  'Basic single shot, full 360°',
        color:    [60, 120, 220],
        upgrades: [
            { cost: 100, damage: 4,  fireRate: -0.15, range: 1 },
            { cost: 200, damage: 6,  fireRate: -0.15, range: 1, dualShot: true },
        ],
    },
    sniper: {
        name:     'Sniper',
        cost:     300,
        damage:   40,
        fireRate: 1.8,
        range:    12,
        special:  'Pierces all segments in a line',
        color:    [220, 220, 255],
        upgrades: [
            { cost: 150, damage: 20, fireRate: -0.3, range: 2 },
            { cost: 300, damage: 30, fireRate: -0.3, range: 3 },
        ],
    },
    scatter: {
        name:     'Scatter',
        cost:     250,
        damage:   5,
        fireRate: 1.2,
        range:    4,
        pellets:  3,
        special:  '3-way spread, great vs clusters',
        color:    [220, 140, 60],
        upgrades: [
            { cost: 125, damage: 3,  fireRate: -0.2, range: 1 },
            { cost: 250, damage: 5,  fireRate: -0.2, pellets: 2 },
        ],
    },
    freeze: {
        name:     'Freeze',
        cost:     200,
        damage:   2,
        fireRate: 2.0,
        range:    4,
        slowFactor: 0.4,  // reduces speed by 40%
        slowDuration: 2,  // seconds
        special:  'Slows centipede 60% for 2s',
        color:    [60, 200, 220],
        upgrades: [
            { cost: 100, damage: 1,  fireRate: -0.3, range: 1 },
            { cost: 200, damage: 2,  slowFactor: 0.2, slowDuration: 1 },
        ],
    },
    tesla: {
        name:     'Tesla',
        cost:     350,
        damage:   15,
        fireRate: 1.0,
        range:    5,
        chainCount: 3,
        special:  'Chains to 3 nearby segments',
        color:    [255, 230, 50],
        upgrades: [
            { cost: 175, damage: 8,  fireRate: -0.15, chainCount: 1 },
            { cost: 350, damage: 12, fireRate: -0.15, chainCount: 2 },
        ],
    },
    mortar: {
        name:     'Mortar',
        cost:     400,
        damage:   35,
        fireRate: 3.0,
        range:    8,
        splashRadius: 2,  // tiles
        destroysNodes: true,
        special:  'AOE splash 2-tile radius, destroys nodes',
        color:    [140, 140, 140],
        upgrades: [
            { cost: 200, damage: 15, fireRate: -0.5, range: 2 },
            { cost: 400, damage: 25, fireRate: -0.5, splashRadius: 1 },
        ],
    },
};

// --- Enemy definitions ---
export const ENEMY_DEFS = {
    centipede: {
        name:     'Centipede',
        hp:       1,
        speed:    2.5,   // tiles per second
        reward:   5,
        score:    10,
        color:    [200, 50, 50],
        headColor: [255, 70, 70],
    },
    centipedeArmored: {
        name:     'Armored Centipede',
        hp:       2,
        speed:    2.5,
        reward:   10,
        score:    20,
        color:    [120, 80, 200],
        headColor: [150, 100, 255],
    },
    centipedeFast: {
        name:     'Fast Centipede',
        hp:       1,
        speed:    5.0,
        reward:   8,
        score:    15,
        color:    [255, 120, 30],
        headColor: [255, 160, 60],
    },
    centipedeGiant: {
        name:     'Giant Centipede',
        hp:       3,
        speed:    2.0,
        segments: 20,
        reward:   20,
        score:    30,
        color:    [180, 30, 180],
        headColor: [220, 60, 220],
    },
    flea: {
        name:   'Flea',
        hp:     1,
        speed:  4.0,   // tiles per second downward
        reward: 15,
        score:  200,
        color:  [255, 140, 60],
    },
    spider: {
        name:   'Spider',
        hp:     1,
        speed:  3.5,
        reward: 25,
        score:  300,   // bonus for distance into player zone
        color:  [170, 70, 255],
    },
    scorpion: {
        name:   'Scorpion',
        hp:     1,
        speed:  3.0,
        reward: 30,
        score:  1000,
        color:  [255, 70, 140],
    },
};

// --- Wave definitions (waves 1-20) ---
// centipedeType: key from ENEMY_DEFS; segments: head count (12 default)
// specials: scheduled mid-wave spawns
export const WAVE_DEFS = [
    // 1
    { title: 'Wave 1', centipedeType: 'centipede', segments: 12, specials: [] },
    // 2
    { title: 'Wave 2', centipedeType: 'centipede', segments: 14, specials: [] },
    // 3 — Fleas join
    { title: 'Wave 3 — The Fleas Arrive', centipedeType: 'centipede', segments: 14,
      specials: [{ type: 'flea', count: 2, startTime: 5 }] },
    // 4
    { title: 'Wave 4', centipedeType: 'centipede', segments: 16,
      specials: [{ type: 'flea', count: 3, startTime: 4 }] },
    // 5 — Boss
    { title: 'Wave 5 — BOSS', centipedeType: 'centipedeGiant', segments: 20,
      isBoss: true, specials: [{ type: 'flea', count: 2, startTime: 6 }] },
    // 6
    { title: 'Wave 6', centipedeType: 'centipede', segments: 14,
      specials: [{ type: 'flea', count: 3, startTime: 4 }, { type: 'spider', count: 1, startTime: 8 }] },
    // 7 — Scorpion joins
    { title: 'Wave 7 — Scorpion!', centipedeType: 'centipede', segments: 16,
      specials: [{ type: 'scorpion', count: 1, startTime: 3 }, { type: 'spider', count: 1, startTime: 9 }] },
    // 8 — Fast centipede
    { title: 'Wave 8 — Speed Run', centipedeType: 'centipedeFast', segments: 12,
      specials: [{ type: 'flea', count: 3, startTime: 3 }, { type: 'scorpion', count: 1, startTime: 7 }] },
    // 9
    { title: 'Wave 9', centipedeType: 'centipede', segments: 18,
      specials: [{ type: 'flea', count: 4, startTime: 3 }, { type: 'spider', count: 2, startTime: 7 }] },
    // 10 — Boss
    { title: 'Wave 10 — BOSS', centipedeType: 'centipedeGiant', segments: 20,
      isBoss: true,
      specials: [{ type: 'scorpion', count: 2, startTime: 4 }, { type: 'spider', count: 2, startTime: 8 }] },
    // 11 — Armored
    { title: 'Wave 11 — Armored', centipedeType: 'centipedeArmored', segments: 12,
      specials: [{ type: 'flea', count: 4, startTime: 3 }, { type: 'scorpion', count: 1, startTime: 7 }] },
    // 12
    { title: 'Wave 12', centipedeType: 'centipede', segments: 20,
      specials: [{ type: 'flea', count: 5, startTime: 2 }, { type: 'spider', count: 3, startTime: 6 }] },
    // 13
    { title: 'Wave 13', centipedeType: 'centipedeFast', segments: 16,
      specials: [{ type: 'scorpion', count: 2, startTime: 3 }, { type: 'flea', count: 4, startTime: 6 }] },
    // 14
    { title: 'Wave 14', centipedeType: 'centipedeArmored', segments: 16,
      specials: [{ type: 'spider', count: 3, startTime: 4 }, { type: 'scorpion', count: 2, startTime: 8 }] },
    // 15 — Boss
    { title: 'Wave 15 — BOSS', centipedeType: 'centipedeGiant', segments: 20,
      isBoss: true,
      specials: [
          { type: 'flea',     count: 4, startTime: 3 },
          { type: 'spider',   count: 3, startTime: 6 },
          { type: 'scorpion', count: 2, startTime: 9 },
      ] },
    // 16
    { title: 'Wave 16', centipedeType: 'centipedeFast', segments: 18,
      specials: [{ type: 'flea', count: 6, startTime: 2 }, { type: 'spider', count: 3, startTime: 5 }] },
    // 17
    { title: 'Wave 17', centipedeType: 'centipedeArmored', segments: 20,
      specials: [{ type: 'scorpion', count: 3, startTime: 3 }, { type: 'spider', count: 4, startTime: 7 }] },
    // 18
    { title: 'Wave 18', centipedeType: 'centipede', segments: 22,
      specials: [
          { type: 'flea',     count: 6, startTime: 2 },
          { type: 'scorpion', count: 3, startTime: 5 },
          { type: 'spider',   count: 4, startTime: 8 },
      ] },
    // 19
    { title: 'Wave 19', centipedeType: 'centipedeFast', segments: 20,
      specials: [
          { type: 'flea',     count: 6, startTime: 2 },
          { type: 'scorpion', count: 4, startTime: 5 },
          { type: 'spider',   count: 5, startTime: 7 },
      ] },
    // 20 — Final Boss
    { title: 'Wave 20 — FINAL BOSS', centipedeType: 'centipedeGiant', segments: 20,
      isBoss: true,
      specials: [
          { type: 'flea',     count: 8,  startTime: 2 },
          { type: 'spider',   count: 6,  startTime: 5 },
          { type: 'scorpion', count: 4,  startTime: 7 },
      ] },
];

// --- Economy ---
export const GOLD_PER_WAVE         = 75;
export const GOLD_PER_SEGMENT      = 5;
export const GOLD_NO_DEATH_BONUS   = 25;
export const GOLD_BOSS_BONUS       = 150;
export const SELL_REFUND_RATE      = 0.5;

// --- Scoring ---
export const SCORE_SEGMENT_KILL    = 10;
export const SCORE_HEAD_BONUS      = 25;
export const SCORE_FLEA_KILL       = 200;
export const SCORE_SPIDER_KILL_BASE = 300;
export const SCORE_SCORPION_KILL   = 1000;
export const SCORE_WAVE_COMPLETE   = 100; // × wave number
export const SCORE_NO_DEATH_BONUS  = 500;
export const SCORE_BOSS_KILL       = 5000;
export const SCORE_NODE_DESTROY    = 1;

// --- Color palette ---
export const COLORS = {
    // Background
    bg:            [10,  10,  20],
    // Grid tile zones
    enemyZone:     [10,  10,  22],   // dark blue-black
    bufferZone:    [22,  10,  10],   // slight red tint — danger
    playerZone:    [10,  22,  10],   // slight green tint — player territory
    gridLine:      [26,  26,  46],   // subtle grid lines
    // Tower slots
    towerSlotEmpty: [30,  58,  95],  // dark blue highlight
    towerSlotHover: [50,  90, 150],  // brighter blue on hover
    // Nodes
    node:          [107, 91,  69],   // brown (full HP)
    nodeHit1:      [140, 70,  50],   // darker red-brown (3/4 HP)
    nodeHit2:      [160, 50,  40],   // more damage (2/4 HP)
    nodeHit3:      [180, 30,  30],   // near dead (1/4 HP)
    nodePoisoned:  [42,  122, 42],   // green tint (poisoned)
    // Entities
    centipedeHead: [255, 70,  70],
    centipedeBody: [200, 50,  50],
    playerShip:    [68,  170, 255],
    playerBullet:  [255, 255, 68],
    flea:          [255, 140, 68],
    spider:        [170, 68,  255],
    scorpion:      [255, 68,  140],
    // HUD
    hudBg:         [8,   8,   16],
    hudText:       [220, 220, 240],
    goldColor:     [255, 215, 0],
    livesColor:    [255, 80,  80],
    scoreColor:    [100, 220, 255],
    waveColor:     [180, 180, 220],
};

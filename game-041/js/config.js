// ============================================================
// BURROWGUARD — configuration and balance numbers
// ============================================================
// Sim units: one grid cell = 1.0. Cell centres sit on integer coordinates,
// so an actor at (3, 7) is standing dead-centre of column 3, row 7.

export const COLS = 13;
export const ROWS = 18;

// Row 0 is the surface lane (open air). Rows 1..17 are dirt in four strata.
export const SURFACE_ROW = 0;
export const CORE = { c: 6, r: 16 };
export const PLAYER_START = { c: 6, r: 0 };

// Enemies walk in from off-grid on either end of the surface lane.
export const SPAWNS = [
    { fromC: -1, c: 0, r: 0, dir: 0 },
    { fromC: COLS, c: COLS - 1, r: 0, dir: 2 },
];

// The pre-dug maze: horizontal corridors on these rows, joined by shafts.
export const CORRIDOR_ROWS = [3, 6, 9, 12];

export function stratumOf(r) {
    if (r <= 4) return 0;
    if (r <= 8) return 1;
    if (r <= 12) return 2;
    return 3;
}

// --- Player ---
export const PLAYER_SPEED     = 4.6;   // cells / s through tunnels
export const PLAYER_DIG_SPEED = 2.7;   // cells / s while carving dirt
export const HARPOON_REACH    = 3.2;   // cells
export const HARPOON_SPEED    = 20;
export const PUMP_REPEAT      = 0.2;   // s between pumps while the button is held
export const RESPAWN_TIME     = 2.2;
export const SPAWN_SHIELD     = 2.5;

// --- Economy ---
export const START_GOLD   = 30;
export const START_LIVES  = 3;
export const CORE_HP      = 10;
export const EXTRA_LIVES  = [20000, 60000, 120000];
export const DOT_SCORE    = 10;
export const DOT_GOLD     = 1;
export const GEM_SCORE    = 50;
export const GEM_GOLD     = 5;
export const EAT_CHAIN    = [200, 400, 800, 1600];
export const ROCK_CHAIN   = [1000, 2500, 4000, 6000, 8000];
export const SELL_RATE    = 0.7;

// --- Waves ---
export const WAVES_PER_ROUND = 6;       // wave 6 of every round is a boss wave
export const FIRST_COUNTDOWN = 16;
export const WAVE_GAP        = 9;
export const VEG_AFTER_DOTS  = 60;
export const VEG_TIME        = 9;

export function frightTime(round) {
    return Math.max(3, 7.5 - (round - 1) * 0.9);
}

// --- Enemies ---
// speed/ghostSpeed/digSpeed in cells per second. pumps = harpoon pumps to pop.
export const ENEMIES = {
    grub:    { name: 'GRUB',    hp: 6,   speed: 2.0, gold: 2,  score: 100, pumps: 4,  dmg: 1 },
    skitter: { name: 'SKITTER', hp: 3,   speed: 3.3, gold: 1,  score: 80,  pumps: 2,  dmg: 1 },
    drake:   { name: 'DRAKE',   hp: 11,  speed: 1.7, gold: 4,  score: 200, pumps: 4,  dmg: 1, fire: true },
    stalker: { name: 'STALKER', hp: 8,   speed: 2.3, gold: 5,  score: 250, pumps: 3,  dmg: 1, ghostSpeed: 1.35, chase: 11 },
    borer:   { name: 'BORER',   hp: 26,  speed: 1.25, gold: 8, score: 400, pumps: 6,  dmg: 2, digSpeed: 0.7, armor: 1 },
    king:    { name: 'KING',    hp: 100, speed: 1.0,  gold: 40, score: 3000, pumps: 14, dmg: 4, boss: true },
};

// --- Towers ---
// Every tower is built into a DIRT cell and fires into the tunnels around it.
export const TOWER_ORDER = ['blaster', 'frost', 'arc', 'boomer'];
export const TOWERS = {
    blaster: {
        name: 'BLASTER', cost: 12, color: '#ffd23a', head: 'headBlaster', rotates: true,
        levels: [
            { range: 2.2, rate: 2.6, dmg: 2 },
            { range: 2.5, rate: 3.3, dmg: 3 },
            { range: 2.8, rate: 4.2, dmg: 4.5 },
        ],
    },
    frost: {
        name: 'FROST', cost: 20, color: '#4ff0ff', head: 'headFrost', rotates: false,
        levels: [
            { range: 1.7, slow: 0.5,  dps: 1.0 },
            { range: 2.0, slow: 0.4,  dps: 1.7 },
            { range: 2.4, slow: 0.3,  dps: 2.6 },
        ],
    },
    arc: {
        name: 'ARC', cost: 35, color: '#d070ff', head: 'headArc', rotates: false,
        levels: [
            { range: 2.3, rate: 0.85, dmg: 3.5, chain: 3 },
            { range: 2.6, rate: 1.0,  dmg: 5,   chain: 4 },
            { range: 2.9, rate: 1.2,  dmg: 7,   chain: 5 },
        ],
    },
    boomer: {
        name: 'BOOMER', cost: 50, color: '#ff6a3a', head: 'headBoomer', rotates: true,
        levels: [
            { range: 3.2, rate: 0.5,  dmg: 7,  splash: 1.1 },
            { range: 3.5, rate: 0.6,  dmg: 11, splash: 1.3 },
            { range: 3.9, rate: 0.72, dmg: 16, splash: 1.5 },
        ],
    },
};

export function upgradeCost(type, lvl) {
    // lvl = current level index (0 or 1); cost to reach lvl + 1
    const base = TOWERS[type].cost;
    return Math.round(base * (lvl === 0 ? 1.0 : 1.6));
}

export function towerValue(type, lvl) {
    let v = TOWERS[type].cost;
    for (let i = 0; i < lvl; i++) v += upgradeCost(type, i);
    return v;
}

// --- Palette for the tunnels: one neon edge colour per stratum ---
export const EDGE_COLORS = ['#ffd23a', '#ff7a2a', '#ff3a78', '#b456ff'];
export const SURFACE_EDGE = '#5aff6a';

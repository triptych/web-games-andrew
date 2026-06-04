// ============================================================
// Neon Vanguard — Configuration
// ============================================================

// --- Starting resources ---
export const STARTING_SCORE = 0;
export const STARTING_LIVES = 3;

// --- Camera (top-down view looking straight down the -Y / Z axis) ---
export const CAM_FOV     = 60;
export const CAM_NEAR    = 0.1;
export const CAM_FAR     = 200;
export const CAM_POS     = [0, 28, 0];   // x, y, z — high overhead
export const CAM_LOOK    = [0, 0, 0];    // look target

// --- Play field (world units; the camera frames roughly this area) ---
export const FIELD_HALF_W = 16;   // playable area extends +/- this on X
export const FIELD_HALF_H = 11;   // and +/- this on Z

// --- Player ---
export const PLAYER_SPEED    = 18;   // world units / sec
export const PLAYER_RADIUS   = 0.6;
export const FIRE_COOLDOWN   = 0.12; // sec between shots
export const BULLET_SPEED    = 40;
export const BULLET_RADIUS   = 0.25;

// --- Enemies ---
export const ENEMY_RADIUS    = 0.7;
export const ENEMY_BASE_HP   = 1;

// --- Enemy types (Phase 4: variety) -------------------------------------
// Each archetype is a distinct visual + stat profile. The wave spawner draws
// from a wave-scaled pool (see waves.js) so the mix gets nastier as you climb.
// `geo` picks the mesh shape built once in enemies.js; `color` is its neon hue;
// `hp`/`speedMul`/`value`/`radiusMul` tune feel and reward. `fireMul` scales how
// likely/often this type shoots when the wave arms it.
export const ENEMY_TYPES = {
    GRUNT: {                       // baseline diamond — the wave-1 staple
        key: 'grunt',
        geo: 'octahedron',
        color: 0xff5050,           // danger red
        hp: 1,
        speedMul: 1.0,
        radiusMul: 1.0,
        value: 100,
        fireMul: 1.0,
    },
    DARTER: {                      // small, fast, fragile — punishes slow aim
        key: 'darter',
        geo: 'tetrahedron',
        color: 0xffc850,           // amber
        hp: 1,
        speedMul: 1.8,
        radiusMul: 0.75,
        value: 150,
        fireMul: 0.5,
    },
    BRUTE: {                       // slow tank, 3 HP — soaks fire, big payoff
        key: 'brute',
        geo: 'box',
        color: 0xff64ff,           // magenta
        hp: 3,
        speedMul: 0.6,
        radiusMul: 1.35,
        value: 250,
        fireMul: 1.4,
    },
    WEAVER: {                      // nimble dodger that loves the sine/orbit lanes
        key: 'weaver',
        geo: 'dodecahedron',
        color: 0x64c8ff,           // cyan
        hp: 2,
        speedMul: 1.1,
        radiusMul: 1.0,
        value: 200,
        fireMul: 1.0,
    },
};

// --- Power-ups (Phase 4) ------------------------------------------------
export const POWERUP_DROP_CHANCE = 0.10;  // chance a normal kill drops a pickup
export const POWERUP_BOSS_DROPS  = 2;     // guaranteed drops from a boss kill
export const POWERUP_SPEED       = 7;     // drift speed toward the player (+Z)
export const POWERUP_RADIUS      = 0.6;
export const SPREAD_DURATION     = 8;     // sec of triple-shot from a spread pickup
export const SHIELD_DURATION     = 6;     // sec of invulnerability from a shield pickup
export const POWERUP_TYPES = {
    SPREAD: { key: 'spread', color: 0x64ffd2 },  // teal — triple shot
    SHIELD: { key: 'shield', color: 0x64c8ff },  // cyan — temporary invulnerability
    LIFE:   { key: 'life',   color: 0x50dc64 },  // green — +1 life
};

// --- Wave intro banner (Phase 4) ---
export const WAVE_BANNER_TIME = 1.6;   // sec the "WAVE N" splash holds on screen

// --- Enemy fire ---
export const ENEMY_BULLET_SPEED  = 16;    // world units / sec (slower than player's)
export const ENEMY_BULLET_RADIUS = 0.3;
export const ENEMY_FIRE_COOLDOWN = 2.2;   // base seconds between an enemy's shots
export const ENEMY_FIRE_WAVE     = 2;     // enemies don't shoot until this wave

// --- Mini-boss ---
export const BOSS_EVERY      = 4;     // a mini-boss arrives every Nth wave
export const BOSS_HP         = 30;    // base; scales with wave
export const BOSS_RADIUS     = 2.2;
export const BOSS_VALUE      = 1000;  // score (before the *wave multiplier)
export const BOSS_FIRE_COOLDOWN = 0.9;

// --- Waves ---
export const WAVE_BASE_COUNT   = 6;    // enemies in wave 1
export const WAVE_COUNT_GROWTH = 2;    // +N enemies per wave
export const WAVE_BREAK        = 2.0;  // seconds between waves

// --- Color palette ---
// Three.js takes 0xRRGGBB integers for material colors, not [r,g,b] tuples.
// '#RRGGBB' strings are for DOM/CSS HUD text.
export const COLORS = {
    bg:       0x06060f,
    text:     '#dcdcf0',
    accent:   0x64c8ff,   // cyan
    magenta:  0xff64ff,   // neon magenta
    danger:   0xff5050,
    success:  0x50dc64,
    gold:     0xffd700,
    player:   0x64ffd2,   // teal-cyan ship
    bullet:   0xfff060,   // hot yellow
};

// --- Movement pattern keys (used by enemy spawner) ---
export const PATTERNS = {
    DIVE:    'dive',     // straight down toward player rows
    SINE:    'sine',     // weave horizontally while descending
    ORBIT:   'orbit',    // circle around a point
    SWOOP:   'swoop',    // arc in from a side
};

// --- TODO: Add more game-specific constants below ---

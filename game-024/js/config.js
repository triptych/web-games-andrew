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

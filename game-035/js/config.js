// ============================================================
// N2 Overdrive — Configuration
// A tribute to N2O: Nitrous Oxide (PS1, 1998, Gremlin Interactive)
// ============================================================

// --- Canvas ---
// Initial size only — the game uses Phaser Scale.RESIZE so the canvas (and
// every position derived from it) actually tracks the live viewport via
// viewport.js. See viewport.js for the runtime width/height/center/radius.
export const GAME_WIDTH  = 960;
export const GAME_HEIGHT = 720;

// --- Starting resources ---
export const STARTING_SCORE = 0;
export const STARTING_SHIELDS = 3;

// --- Tunnel / ring geometry ---
// Ship travels around a ring at fixed depth (z=0, closest to camera).
// Everything else lives at depth z in [0..1] (1 = vanishing point, far away).
export const RING_SEGMENTS = 16;        // angular "lanes" — like Tempest's tube segments
export const SHIP_RADIUS_FRAC = 0.86;   // ship orbit radius as a fraction of viewport maxR
export const VANISH_RADIUS_FRAC = 0.06; // radius at the vanishing point (z=1), fraction of viewport maxR

// --- Ship ---
export const SHIP_ANGULAR_SPEED = 3.4;     // radians/sec at full stick deflection
export const SHIP_TOUCH_SPEED   = 4.2;     // radians/sec for touch buttons
export const SHIP_BOB_AMOUNT    = 0.015;   // subtle depth wobble

// --- Depth / speed ---
export const BASE_FORWARD_SPEED = 0.42;    // z-units/sec that world rushes toward camera
export const MAX_FORWARD_SPEED  = 1.6;
export const SPEED_PER_KILL     = 0.012;   // speed ramps up with every enemy kill (N2O signature mechanic)
export const SPEED_DECAY        = 0.04;    // gentle settle back toward base over time

// --- Weapons ---
export const FIRE_COOLDOWN = 0.14;         // seconds between shots (base gun)
export const BULLET_SPEED  = 1.9;          // z-units/sec bullets travel toward the vanishing point

// --- Spawning ---
export const SPAWN_Z = 1.0;                // enemies/pickups spawn at the vanishing point
export const KILL_Z  = -0.08;              // z at which things reach the camera (danger zone)
export const ENEMY_BASE_INTERVAL = 1.15;   // seconds between enemy spawns at game start
export const ENEMY_MIN_INTERVAL  = 0.32;
export const MUSHROOM_INTERVAL   = 2.6;
export const COIN_BURST_INTERVAL = 3.4;

// --- Mushrooms (N2O's shield pickup mechanic) ---
export const MUSHROOM_HITS_TO_RIPEN = 2;   // shots needed before it turns red / grants shield

// --- Bonus stars ---
export const STARS_FOR_BONUS_ROUND = 5;

// --- Difficulty ramp ---
export const DIFFICULTY_RAMP_PER_SEC = 0.006; // spawn interval shrinks over survival time

// --- Color palette (Phaser hex ints 0xRRGGBB) ---
export const COLORS = {
    bg:        0x05010f,
    text:      0xe8e0ff,
    accent:    0x36f0ff,
    danger:    0xff2f6e,
    success:   0x4dffb0,
    gold:      0xffd23f,
    magenta:   0xff2fe0,
    purple:    0x8a2fff,
    ship:      0x36f0ff,
    bullet:    0xfff23f,
    enemy:     0xff2f6e,
    mushroom:  0xa03fff,
    mushroomRipe: 0xff2f2f,
    coin:      0xffd23f,
    shieldRing:0x4dffb0,
};

// --- HUD ---
export const HUD_MARGIN = 16;

// ============================================================
// Island Walker — Configuration
// ============================================================

export const ISLAND_RADIUS = 260;
export const OCEAN_OUTER_RADIUS = ISLAND_RADIUS * 1.8;

export const DRAW_DISTANCE = 105;     // world units — chunk render radius
export const LOD_DISTANCE = 45;       // beyond this, chunks rebuild props at low detail
export const CHUNK_UNLOAD_DISTANCE = 160; // evict cached chunks beyond this to bound memory

// Fog must finish fading *before* DRAW_DISTANCE, otherwise chunks are culled at
// full colour and pop in as hard-edged blocks. Ending it a little short of the
// draw radius means terrain has already dissolved into haze by the time it's
// dropped. RENDER_FAR sits beyond both so the ocean and clouds still reach the
// horizon (they opt out of the far-plane cull — see renderer.js).
export const FOG_NEAR = 55;
export const FOG_FAR = 100;
export const RENDER_FAR = 400;

export const PLAYER_EYE_HEIGHT = 1.7;
export const PLAYER_RADIUS = 0.4;
export const PLAYER_SPEED = 5.2;
export const PLAYER_SPRINT_MULT = 1.7;
export const GRAVITY = 18;
export const JUMP_SPEED = 6.2;

// Lowest terrain height the player may stand on. Sea level is 0, so this lets
// them wade ankle-to-shin deep in the shallows while keeping the camera above
// the water surface (there is no underwater rendering pass).
export const WADE_FLOOR = -0.6;

export const PICKUP_RADIUS = 2.0;
export const INTERACT_RADIUS = 2.5;

export const BOOK_COUNT = 10;
export const ARTIFACT_COUNT = 8;

export const SKY_TOP = [92, 148, 208];
export const SKY_BOTTOM = [178, 208, 226];
// Distance haze. Kept a touch deeper/bluer than SKY_BOTTOM so far terrain and
// open sea recede into atmosphere instead of bleaching out to near-white.
export const FOG_COLOR = [162, 194, 216];
// Backdrop colour while underground, standing in for "solid rock in every
// direction" so daylight can't leak through gaps between tunnel triangles.
export const CAVE_DARK = [18, 16, 20];

// Direction light travels *from* (i.e. toward the sun), normalised by the
// renderer. Mid-morning and off-axis so building faces and terrain slopes
// catch it at different angles instead of flattening out.
export const SUN_DIR = [0.5, 0.9, 0.3];

export const SEED_STORAGE_KEY = 'island-walker-seed';

// ============================================================
// Island Walker — Configuration
// ============================================================

export const ISLAND_RADIUS = 260;
// The ocean disc must reach past RENDER_FAR, not just past the island: it opts
// out of the far-plane cull so it can be the horizon, and if its outer edge
// falls inside the view distance you see sky through the gap beyond it and the
// disc's polygon edge shows up as a ring of spikes against the skyline.
export const OCEAN_OUTER_RADIUS = 900;

// Draw distance is affordable because the renderer rejects whole instances by
// bounding sphere against the view frustum (renderer.js), so only the ~quarter
// of loaded chunks actually in front of the camera costs anything per frame.
// Chunks past LOD_NEAR/LOD_FAR drop to progressively cheaper geometry, which is
// what keeps the far half of this radius nearly free.
export const DRAW_DISTANCE = 260;     // world units — chunk render radius
// The near band is the expensive one: a full-detail chunk is ~10x a mid one and
// ~15x a far one, so the radius at which it ends is the main framerate control
// — more so than DRAW_DISTANCE, since the outer ring is mostly cheap terrain.
// This keeps the detailed shell to roughly a dozen chunks, which is what an
// open hilltop view (the worst case — it sees every band at once) can afford.
// 38 put the detail-2 -> detail-1 step inside the foreground: trees maybe ten
// tree-heights away visibly shed canopy blobs and branches while in plain view.
// 52 moves the step back far enough that it lands in the mid-ground, where the
// crown-fill compensation in vegetation.js covers the rest.
export const LOD_NEAR = 52;           // within this, full detail props + ground
export const LOD_FAR = 105;           // beyond this, coarsest props + ground
export const CHUNK_UNLOAD_DISTANCE = 340; // evict cached chunks beyond this to bound memory

// Fog must finish fading *before* DRAW_DISTANCE, otherwise chunks are culled at
// full colour and pop in as hard-edged blocks. Ending it a little short of the
// draw radius means terrain has already dissolved into haze by the time it's
// dropped. RENDER_FAR sits beyond both so the ocean and clouds still reach the
// horizon (they opt out of the far-plane cull — see renderer.js).
//
// Fog starts proportionally much later than it used to: at a 105-unit draw
// distance haze had to begin at ~55 to hide the edge, which greyed out the
// mid-ground. With the horizon pushed to 260 the fade can stay in the last
// third, so the island reads sharp out to a genuine distance.
export const FOG_NEAR = 150;
export const FOG_FAR = 250;
export const RENDER_FAR = 620;

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

// Backdrop colour inside the library/museum. Interiors are drawn exclusively
// (no outside geometry), so this stands in for "walls in every direction" and
// keeps daylight from showing through the doorway gap. Warmer and much lighter
// than CAVE_DARK — an indoor room, not a cave.
export const INDOOR_DARK = [64, 54, 46];

// Direction light travels *from* (i.e. toward the sun), normalised by the
// renderer. Mid-morning and off-axis so building faces and terrain slopes
// catch it at different angles instead of flattening out.
export const SUN_DIR = [0.5, 0.9, 0.3];

export const SEED_STORAGE_KEY = 'island-walker-seed';

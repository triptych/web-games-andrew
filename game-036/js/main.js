/**
 * main.js — Island Walker entry point.
 *
 * Boot sequence:
 *   1. Resolve a world seed (random per session, or ?seed=NNN for sharing).
 *   2. Build the World (heightmap, regions, chunk system, streams, cave,
 *      clouds, fauna) and place collectible items.
 *   3. Wait for the player to click "Start" — this both requests Pointer
 *      Lock (required for mouse-look) and satisfies the browser's
 *      user-gesture requirement to start Web Audio.
 *   4. Run the frame loop: update player -> update world/fauna/items ->
 *      cull chunks by distance -> submit instances to the software
 *      renderer -> draw sky gradient + rasterized triangles.
 *
 * No external engine — engine/renderer.js is a from-scratch Canvas2D
 * triangle rasterizer (see its header comment for the pipeline).
 */

import { Renderer } from './engine/renderer.js';
import { FirstPersonCamera } from './engine/camera.js';
import { hashSeedFromString } from './world/noise.js';
import { World } from './world/world.js';
import { generateItems, ItemManager } from './game/items.js';
import { CollectionSites } from './game/collections.js';
import { Player } from './game/player.js';
import { MapState } from './game/mapstate.js';
import { MapUI } from './game/mapui.js';
import { Panels } from './game/panels.js';
import { QuestLog } from './game/quests.js';
import { SaveManager } from './game/save.js';
import { inventory } from './game/inventory.js';
import { updateInteractionPrompt, updateRegionLabel } from './game/interaction.js';
import { initUI, setLockHintVisible, setObjective } from './ui.js';
import { events } from './events.js';
import { state } from './state.js';
import { initAudio, playUiClick } from './sounds.js';
import { drawSkyGradient } from './world/sky.js';
import {
    SKY_TOP, SKY_BOTTOM, FOG_COLOR, FOG_NEAR, FOG_FAR, RENDER_FAR, CAVE_DARK, INDOOR_DARK, SUN_DIR,
    SEED_STORAGE_KEY, WADE_FLOOR, PLAYER_EYE_HEIGHT,
} from './config.js';
import { v3norm } from './engine/math.js';

// ---------- Seed resolution ----------
/**
 * Resolves both the hashed integer the generators use and the raw string it came
 * from. The save keys on the string: resuming has to reproduce the same island,
 * and the hash is one-way.
 *
 * Precedence is ?seed= over sessionStorage over a fresh random. A ?seed= link is
 * an explicit request for a particular island, so it also gets written back to
 * the session — otherwise loading a save would silently switch islands the
 * moment the query string was dropped.
 */
function resolveSeed() {
    const params = new URLSearchParams(location.search);
    const fromUrl = params.get('seed');
    if (fromUrl) {
        try { sessionStorage.setItem(SEED_STORAGE_KEY, fromUrl); } catch { /* ignore */ }
        return { seed: hashSeedFromString(fromUrl), seedString: fromUrl };
    }
    let stored = null;
    try { stored = sessionStorage.getItem(SEED_STORAGE_KEY); } catch { /* ignore */ }
    if (!stored) {
        // Prefer the seed of an existing save, so a plain reload resumes the walk
        // rather than stranding it on an island the player can no longer reach.
        stored = SaveManager.storedSeedString() || String(Math.floor(Math.random() * 1e9));
        try { sessionStorage.setItem(SEED_STORAGE_KEY, stored); } catch { /* ignore */ }
    }
    return { seed: hashSeedFromString(stored), seedString: stored };
}

const { seed, seedString } = resolveSeed();

// ---------- Build world ----------
// Pre-normalised: assigning renderer.lightDir directly bypasses the constructor's
// normalisation, and the shading dot products assume a unit vector.
const SUN_DIR_N = v3norm(SUN_DIR);

const canvas = document.getElementById('game-canvas');
const renderer = new Renderer(canvas, {
    fogColor: FOG_COLOR,
    fogNear: FOG_NEAR,
    fogFar: FOG_FAR,
    far: RENDER_FAR,
});
const camera = new FirstPersonCamera(canvas);

const world = new World(seed);
const { books, artifacts } = generateItems(seed, world.regionMap, world.heightmap);
const itemManager = new ItemManager(books, artifacts, world.regionMap);
const collections = new CollectionSites(world, itemManager);

// The overmap is fog-of-war: it knows every item position (it needs them to test
// proximity) but draws nothing until the player has been near enough to spot it.
const mapState = new MapState(world);
mapState.registerItems(itemManager.all);

/**
 * Pick a spawn on comfortable dry land: start from the meadow region's anchor
 * (inland and gently sloped by construction) and, if that particular seed put
 * it somewhere wet or steep, spiral outward until we find solid footing. The
 * island is always large enough that this terminates well before the fallback.
 */
function findSpawn() {
    const meadow = world.regionMap.points.find(p => p.type === 'meadow');
    const start = meadow ? [meadow.x, meadow.z] : [0, 0];
    const isGood = (x, z) => world.heightmap.heightAt(x, z) > 1.5 && world.heightmap.slopeAt(x, z) < 0.4;
    if (isGood(start[0], start[1])) return [start[0], 0, start[1]];
    for (let r = 6; r <= 120; r += 6) {
        for (let i = 0; i < 12; i++) {
            const a = (i / 12) * Math.PI * 2;
            const x = start[0] + Math.cos(a) * r;
            const z = start[1] + Math.sin(a) * r;
            if (isGood(x, z)) return [x, 0, z];
        }
    }
    return [0, 0, 0]; // island centre is the highland plateau — always dry
}

const spawn = findSpawn();
const player = new Player(camera, world, spawn);
camera.yaw = Math.atan2(-spawn[0], -spawn[2]); // look roughly toward island center

initUI();

// After initUI(), because the map's annotation handler routes through the HUD's
// toast element and that is only bound once initUI has run.
const mapUI = new MapUI(mapState, camera);

const quests = new QuestLog({ mapState });
const save = new SaveManager({
    seedString, camera, world, itemManager, collections, mapState, quests,
});
const panels = new Panels({ camera, quests, save, mapUI });

/**
 * Restore a saved walk, if there is one for this island.
 *
 * Order matters here. The save is applied *before* the spawn reveal and before
 * quests.start(), because:
 *   - loading overwrites the camera position, and the spawn reveal has to chart
 *     the ground around wherever the player actually is, not around the spawn
 *     point they left an hour ago;
 *   - quests.start() re-tests every predicate on subscribe, so running it after
 *     the restore lets a save from an older build complete anything it has
 *     already earned under the current definitions.
 */
const resumed = save.load();

// Chart the surroundings before the first frame, so the minimap opens on
// recognisable ground rather than solid black. Silent: the player has not
// started walking yet, and the discoveries here are just "where I am standing",
// which does not warrant a queue of toasts behind the title screen. On a resumed
// walk this is nearly a no-op, since those cells are already revealed.
mapState.updateSilent(camera.pos);

// Keep the HUD's one-line objective in step with the chain. Bound before
// start(), so the initial re-test of every predicate paints the right line.
const syncObjective = () => {
    const active = quests.activeMain;
    setObjective(active ? active.title : null);
};
events.on('questsChanged', syncObjective);

quests.start();
save.start();
syncObjective();

// ---------- Boot / start overlay ----------
const $start = document.getElementById('start-overlay');
const $startBtn = document.getElementById('start-btn');
const $startResumed = document.getElementById('start-resumed');
const $startFresh = document.getElementById('start-fresh');
let started = false;

// The title screen tells the player which of the two they are about to get.
// Walking back onto a half-explored island without being told is disorienting —
// especially since the fog map and the shelves will not match a fresh start.
if ($startResumed) $startResumed.classList.toggle('hidden', !resumed);
if ($startFresh) $startFresh.classList.toggle('hidden', resumed);
if (resumed && $startBtn) $startBtn.textContent = 'Continue Walking';

function beginGame() {
    if (started) return;
    started = true;
    initAudio();
    playUiClick();
    camera.requestLock();
    $start.classList.add('hidden');
}

$startBtn.addEventListener('click', beginGame);

document.addEventListener('pointerlockchange', () => {
    const locked = document.pointerLockElement === canvas;
    // The map releases the cursor on purpose; showing "click to re-lock" over an
    // open map would be telling the player to dismiss what they just opened.
    setLockHintVisible(started && !locked && !state.isComplete
        && !mapUI.suppressLockHint && !panels.suppressLockHint);
    if (started && !locked) {
        // paused via lock loss (e.g. Esc) — show hint, freeze isn't strictly required
        // since without lock there's no mouse-look input anyway.
    }
});

canvas.addEventListener('click', () => {
    if (started && !mapUI.isOpen && !panels.isOpen
        && document.pointerLockElement !== canvas && !state.isComplete) {
        camera.requestLock();
    }
});

window.addEventListener('resize', () => renderer.onResize());

events.on('gameComplete', () => {
    camera.exitLock();
    save.save();
});

// Last-chance save. `visibilitychange` rather than `beforeunload`, which is
// unreliable on mobile and is not fired at all when a backgrounded tab is
// discarded; pagehide covers the desktop close case.
document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden' && started) save.save();
});
window.addEventListener('pagehide', () => { if (started) save.save(); });

// ---------- Frame loop ----------
let last = performance.now();
// Populated only under ?debug=1 (see the bottom of this file); the frame loop
// checks it every frame, so it has to exist before the first frame runs.
let debugHud = null;

function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    dt = Math.min(dt, 0.05); // guard against tab-hidden huge deltas

    const time = now / 1000;

    // The open map is a pause: it takes the cursor, so mouse-look is gone
    // anyway, and letting gravity keep running would drop the player off the
    // ledge they stopped on to check where they were.
    if (started && !state.isComplete && !mapUI.isOpen && !panels.isOpen) {
        player.update(dt);
        world.update(dt, time);
        itemManager.update(camera.pos, dt, time);
        collections.update(camera.pos);
        updateInteractionPrompt(itemManager, world, camera.pos);
        updateRegionLabel(world.regionMap, camera.pos);
        world.pruneChunks(camera.pos[0], camera.pos[2]);
        mapUI.update(camera.pos);
        save.update(dt);
    }

    // Underground the backdrop is rock, not sky — otherwise daylight shows through
    // every gap between tunnel triangles.
    const underground = world.isInsideCave(camera.pos);
    const indoors = !underground && world.isInsideBuilding(camera.pos);
    if (underground) {
        drawSkyGradient(renderer.ctx, renderer.width, renderer.height, CAVE_DARK, CAVE_DARK);
        // Light the tunnel from the viewer's own position, lantern-style. Keeping
        // the sun direction underground would leave the rock almost black, and
        // the falloff doubles as the reason to keep walking toward the crystals.
        renderer.lightDir = v3norm([Math.sin(camera.yaw), 0.35, -Math.cos(camera.yaw)]);
        renderer.ambient = 0.20;
        renderer.keyLight = 0.62;
    } else if (indoors) {
        // Indoors the outside world isn't drawn at all, so the backdrop has to be
        // interior gloom or daylight shows through the doorway gap and the seams
        // between wall panels. Lifted well above the cave's ambient — a library
        // should read as warm and legible, not as a cave with shelves in it.
        drawSkyGradient(renderer.ctx, renderer.width, renderer.height, INDOOR_DARK, INDOOR_DARK);
        // Lit from the viewer, like the cave, but much flatter and brighter: the
        // room is small enough that a directional key light just silhouettes the
        // near wall, and a library wants to read as evenly lit rather than gloomy.
        renderer.lightDir = v3norm([Math.sin(camera.yaw), 0.45, -Math.cos(camera.yaw)]);
        renderer.ambient = 0.72;
        renderer.keyLight = 0.30;
    } else {
        drawSkyGradient(renderer.ctx, renderer.width, renderer.height, SKY_TOP, SKY_BOTTOM);
        renderer.lightDir = SUN_DIR_N;
        renderer.ambient = 0.38;
        renderer.keyLight = 0.55;
    }

    const instances = world.getVisibleInstances(camera.pos, time);
    // Interiors and the cave are drawn as exclusive scenes — appending the outdoor
    // item lists there would leave collectibles floating in the dark, and the
    // shelved-book geometry belongs to the room the player is standing in. So the
    // deposited items are submitted only indoors, and loose world items only
    // outdoors. Both lists are small enough that filtering per frame is free.
    if (indoors) {
        const here = world.buildingContaining(camera.pos);
        for (const inst of collections.getInstances()) {
            if (collections.instanceBelongsTo(inst, here.type)) instances.push(inst);
        }
    } else if (!underground) {
        for (const inst of itemManager.getInstances(time)) instances.push(inst);
    }

    renderer.render(camera, instances);
    // Drawn after the 3D pass: it lives on its own 2D canvases layered over the
    // game canvas, so it is unaffected by the scene swap for caves/interiors.
    // Not gated on `started` — the spawn surroundings are charted before the
    // first frame, and drawing them behind the title screen means the minimap
    // is already showing where you are when the overlay clears, rather than
    // being a black square until the first step.
    mapUI.draw();

    if (debugHud) updateDebugHud(dt);
}

/**
 * Frame-time / triangle-count readout, opt-in via ?debug=1. The whole point of
 * the LOD and culling work is that its effect is invisible, so there has to be
 * some way to see what it is actually doing.
 */
let _fpsAccum = 0, _fpsFrames = 0, _fpsShown = 0;
function updateDebugHud(dt) {
    _fpsAccum += dt; _fpsFrames++;
    if (_fpsAccum >= 0.25) {
        _fpsShown = _fpsFrames / _fpsAccum;
        _fpsAccum = 0; _fpsFrames = 0;
    }
    const s = renderer.stats;
    debugHud.textContent =
        `${_fpsShown.toFixed(0)} fps | ${s.trisDrawn.toLocaleString()} tris drawn ` +
        `(${s.tris.toLocaleString()} submitted) | ` +
        `${s.instances - s.instancesCulled}/${s.instances} instances | ` +
        `${renderer.width}x${renderer.height}`;
}

requestAnimationFrame(frame);

// Debug hooks, opt-in via ?debug=1. Handy for inspecting a hand-rolled renderer
// (teleporting to a landmark, checking triangle counts, forcing a completion),
// but they expose mutable engine internals, so they stay off by default.
if (new URLSearchParams(location.search).has('debug')) {
    debugHud = document.createElement('div');
    debugHud.style.cssText =
        'position:fixed;left:8px;bottom:8px;z-index:50;pointer-events:none;' +
        'font:12px/1.4 ui-monospace,Consolas,monospace;color:#cfe8ff;' +
        'background:rgba(8,14,22,.72);padding:5px 9px;border-radius:5px;' +
        'white-space:nowrap;';
    document.body.appendChild(debugHud);

    window.__debugTeleport = (x, z) => {
        const ground = Math.max(world.heightmap.heightAt(x, z), WADE_FLOOR);
        camera.pos = [x, ground + PLAYER_EYE_HEIGHT, z];
    };
    window.__debugWorld = world;
    window.__debugCamera = camera;
    window.__debugItems = itemManager;
    window.__debugCollections = collections;
    window.__debugRenderer = renderer;
    window.__debugMap = mapState;
    window.__debugQuests = quests;
    window.__debugSave = save;
    window.__debugInventory = inventory;
    // Chart the whole island at once, for checking the map's terrain rendering
    // without walking 260 units in every direction.
    window.__debugRevealAll = () => {
        for (let cz = 0; cz < mapState.size; cz++) {
            for (let cx = 0; cx < mapState.size; cx++) {
                const [wx, wz] = mapState.cellCenter(cx, cz);
                mapState.update([wx, 0, wz]);
            }
        }
    };
}

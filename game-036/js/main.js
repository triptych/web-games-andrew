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
import { updateInteractionPrompt, updateRegionLabel } from './game/interaction.js';
import { initUI, setLockHintVisible } from './ui.js';
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
function resolveSeed() {
    const params = new URLSearchParams(location.search);
    const fromUrl = params.get('seed');
    if (fromUrl) return hashSeedFromString(fromUrl);
    let stored = sessionStorage.getItem(SEED_STORAGE_KEY);
    if (!stored) {
        stored = String(Math.floor(Math.random() * 1e9));
        sessionStorage.setItem(SEED_STORAGE_KEY, stored);
    }
    return hashSeedFromString(stored);
}

const seed = resolveSeed();

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
const itemManager = new ItemManager(books, artifacts);
const collections = new CollectionSites(world, itemManager);

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

// ---------- Boot / start overlay ----------
const $start = document.getElementById('start-overlay');
const $startBtn = document.getElementById('start-btn');
let started = false;

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
    setLockHintVisible(started && !locked && !state.isComplete);
    if (started && !locked) {
        // paused via lock loss (e.g. Esc) — show hint, freeze isn't strictly required
        // since without lock there's no mouse-look input anyway.
    }
});

canvas.addEventListener('click', () => {
    if (started && document.pointerLockElement !== canvas && !state.isComplete) {
        camera.requestLock();
    }
});

window.addEventListener('resize', () => renderer.onResize());

events.on('gameComplete', () => {
    camera.exitLock();
});

// ---------- Frame loop ----------
let last = performance.now();

function frame(now) {
    requestAnimationFrame(frame);
    let dt = (now - last) / 1000;
    last = now;
    dt = Math.min(dt, 0.05); // guard against tab-hidden huge deltas

    const time = now / 1000;

    if (started && !state.isComplete) {
        player.update(dt);
        world.update(dt, time);
        itemManager.update(camera.pos, dt, time);
        collections.update(camera.pos);
        updateInteractionPrompt(itemManager, world, camera.pos);
        updateRegionLabel(world.regionMap, camera.pos);
        world.pruneChunks(camera.pos[0], camera.pos[2]);
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
}

requestAnimationFrame(frame);

// Debug hooks, opt-in via ?debug=1. Handy for inspecting a hand-rolled renderer
// (teleporting to a landmark, checking triangle counts, forcing a completion),
// but they expose mutable engine internals, so they stay off by default.
if (new URLSearchParams(location.search).has('debug')) {
    window.__debugTeleport = (x, z) => {
        const ground = Math.max(world.heightmap.heightAt(x, z), WADE_FLOOR);
        camera.pos = [x, ground + PLAYER_EYE_HEIGHT, z];
    };
    window.__debugWorld = world;
    window.__debugCamera = camera;
    window.__debugItems = itemManager;
    window.__debugCollections = collections;
    window.__debugRenderer = renderer;
}

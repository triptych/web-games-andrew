/**
 * main.js — Three.js entry point for Crypt Crawler.
 *
 * Game states: 'splash' → 'playing' → 'gameover' | 'won'
 * The splash is a CLASS SELECT: the player presses 1–4 to pick a class,
 * which starts the run.
 *
 * Library: three.js r165 via import map (see index.html)
 */

import * as THREE from 'three';

import { initScene, renderer, scene, camera, clock, composer } from './scene.js';
import { state }  from './state.js';
import { events } from './events.js';
import { initUI, hideSplash, showMessage } from './ui.js';
import {
    initAudio, playClassSelect, playUiClick,
} from './sounds.js';
import { CLASSES, CAM_OFFSET } from './config.js';

import { loadLevel, FINAL_LEVEL } from './maze.js';
import { initPlayer, updatePlayer, getPlayerPos, detachPlayerInput } from './player.js';
import { initEnemies, updateEnemies } from './enemies.js';
import { initNests, updateNests }     from './nests.js';
import { initCombat, updateCombat, detachCombatInput } from './combat.js';
import { initPickups, updatePickups } from './pickups.js';
import { initEffects, updateEffects } from './effects.js';
import { initMinimap, updateMinimap } from './minimap.js';
import { playLevelComplete, playGameWon, playGameOver } from './sounds.js';

// ============================================================
// THREE.JS GOTCHAS (read before adding anything)
// ============================================================
//
// 1. RESIZE — camera.updateProjectionMatrix() is REQUIRED after changing
//    camera.aspect. The scaffold does this in scene.js — don't remove it.
//
// 2. CLOCK CAP — Math.min(clock.getDelta(), 0.05) is mandatory. A backgrounded
//    tab returns a huge delta on first frame after unhide; without the cap
//    movement and collisions will tunnel through walls.
//
// 3. COLOR — new THREE.Color(255, 0, 255) is WHITE, not magenta. Color takes
//    floats 0..1. Use 0xRRGGBB hex integers everywhere instead (see config.js).
//
// 4. GPU MEMORY — three.js does not auto-free geometries/materials. Enemies,
//    pickups and shots spawn/despawn constantly, so call mesh.geometry.dispose()
//    and mesh.material.dispose() before scene.remove(mesh), OR share cached
//    geometries/materials across instances (recommended for this game).
//
// ============================================================
// Init
// ============================================================

initScene();
initUI();

// A torch-like light that will follow the player once a run starts.
const torch = new THREE.PointLight(0xffd9a0, 1.4, 30, 1.6);
torch.position.set(0, 6, 0);
scene.add(torch);

// Per-level systems (maze, player, enemies, nests, combat, pickups) are
// initialized by loadCurrentLevel() on class select and on each descend.

// ============================================================
// Game state machine
// ============================================================

let mode = 'splash';   // 'splash' | 'playing' | 'transition' | 'gameover' | 'won'
let _currentClass = null;

/**
 * Build (or rebuild) every per-level system for the current state.level and
 * the active class. Used both on first spawn and on each descend.
 */
function loadCurrentLevel() {
    loadLevel(state.level - 1);   // levels are 1-based in state, 0-based in LEVELS
    initPlayer(_currentClass);
    initEnemies();
    initNests();
    initCombat(_currentClass);
    initPickups();
    initEffects();
    initMinimap();
}

function startRun(classNum) {
    if (mode === 'playing') return;
    const cls = CLASSES[classNum];
    if (!cls) return;

    initAudio();
    playClassSelect();

    state.reset();
    state.classKey = cls.key;
    state.maxHealth = cls.hp;
    state.health = cls.hp;   // setter clamps to maxHealth
    _currentClass = cls;

    mode = 'playing';
    hideSplash();

    loadCurrentLevel();
}

/**
 * Player reached the exit. Descend to the next level, or — if the final level
 * was cleared — win. Health does NOT refill between levels (food management is
 * the survival pressure, per the plan).
 */
function onLevelExit() {
    if (mode !== 'playing') return;

    if (state.level >= FINAL_LEVEL) {
        state.isGameWon = true;
        events.emit('gameWon');
        return;
    }

    // Brief between-level pause: detach input, show a banner, then descend.
    mode = 'transition';
    detachPlayerInput();
    detachCombatInput();
    playLevelComplete();
    state.nextLevel();
    showMessage(`LEVEL ${state.level}`, 'Descending into the crypt…');

    // Wait a beat so the fanfare + banner land, then load the next level.
    setTimeout(() => {
        if (mode !== 'transition') return;   // game may have ended meanwhile
        hideSplash();
        loadCurrentLevel();   // re-attaches player + combat input
        mode = 'playing';
    }, 1400);
}

events.on('levelExit', onLevelExit);
events.on('gameOver', () => { mode = 'gameover'; detachPlayerInput(); detachCombatInput(); playGameOver(); });
events.on('gameWon',  () => { mode = 'won';      detachPlayerInput(); detachCombatInput(); playGameWon(); });

// ============================================================
// Input
// ============================================================

function onKeyDown(e) {
    if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;

    if (mode === 'splash') {
        // Class select: 1–4
        if (e.key >= '1' && e.key <= '4') startRun(Number(e.key));
        return;
    }

    if (mode === 'playing') {
        if (e.key === 'p' || e.key === 'P') {
            state.isPaused = !state.isPaused;
            playUiClick();
            if (state.isPaused) showMessage('PAUSED', 'Press P to resume');
            else                hideSplash();
            return;
        }
        if (e.key === 'r' || e.key === 'R') { location.reload(); return; }
        // Movement (player.js) and attack (combat.js) own their own listeners.
    }

    if (mode === 'gameover' || mode === 'won') {
        if (e.key === 'r' || e.key === 'R') location.reload();
    }
}

document.addEventListener('keydown', onKeyDown);
// On the splash, a click does nothing (class must be chosen by number);
// during play, Space/click attacks are wired in the combat module later.

// ============================================================
// Render loop
// ============================================================

function animate() {
    requestAnimationFrame(animate);

    // Cap dt — a hidden tab returns one giant delta on first frame.
    const dt = Math.min(clock.getDelta(), 0.05);

    if (mode === 'playing' && !state.isPaused) {
        updatePlayer(dt);
        updateNests(dt);
        updateEnemies(dt);
        updateCombat(dt);
        updatePickups(dt);

        // Follow the player with the camera + torch light.
        const p = getPlayerPos();
        camera.position.set(p.x + CAM_OFFSET[0], CAM_OFFSET[1], p.z + CAM_OFFSET[2]);
        camera.lookAt(p.x, 0, p.z);
        torch.position.set(p.x, 6, p.z);

        updateMinimap();
    }

    // Cosmetic effects keep animating outside the playing state (so a death
    // burst / final popup finishes during the level transition or game-over),
    // but freeze while paused.
    if (mode !== 'splash' && !state.isPaused) updateEffects(dt);

    composer.render();
}
animate();

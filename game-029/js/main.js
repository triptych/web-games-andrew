/**
 * main.js — Three.js entry point.
 *
 * Game states: 'splash' → 'playing' → 'gameover'
 *
 * Library: three.js r165 via import map (see index.html)
 */

import { initScene, renderer, scene, camera, clock } from './scene.js';
import { state }  from './state.js';
import { events } from './events.js';
import { initUI, hideSplash, showLootComparison, showShop, showPaused, hidePaused, setCombatIndicator } from './ui.js';
import { initAudio, playUiClick } from './sounds.js';
import { WALK_SPEED } from './config.js';

import { initPath, updatePath }         from './path.js';
import { initPlayer, updatePlayer, setCombatLock, clearCombatLock } from './player.js';
import { initMonsters, updateMonsters, trySpawnInChunk, findEncounterAhead, isEncounterClear } from './monsters.js';
import { ARENA_LOCK_RANGE } from './config.js';

// ============================================================
// THREE.JS GOTCHAS (read before adding anything)
// ============================================================
//
// 1. RESIZE — camera.updateProjectionMatrix() is REQUIRED after changing
//    camera.aspect. The scaffold does this in scene.js — don't remove it.
//
// 2. CLOCK CAP — Math.min(clock.getDelta(), 0.05) is mandatory. A backgrounded
//    tab returns a huge delta on first frame after unhide; without the cap
//    physics will tunnel through walls.
//
// 3. COLOR — new THREE.Color(255, 0, 255) is WHITE, not magenta. Color takes
//    floats 0..1. Use 0xRRGGBB hex integers everywhere instead.
//
// 4. GPU MEMORY — the path is endless and monsters/loot spawn continuously,
//    so meshes WILL be created and destroyed constantly. Always call
//    mesh.geometry.dispose() and mesh.material.dispose() before removing
//    a mesh from the scene, or GPU memory leaks over a long run.
//
// ============================================================
// Init
// ============================================================

initScene();
initUI();

// ============================================================
// Game state machine
// ============================================================

let mode = 'splash';   // 'splash' | 'playing' | 'paused' | 'paused-for-loot' | 'town' | 'gameover'
let _lockedChunkIndex = null; // set while forward auto-walk is halted for a combat encounter

function startGame() {
    if (mode === 'playing') return;
    mode = 'playing';
    _lockedChunkIndex = null;
    state.reset();
    initAudio();
    initPath();
    initPlayer();
    initMonsters();
    playUiClick();
    hideSplash();
    setCombatIndicator(false);
}

events.on('gameOver', () => { mode = 'gameover'; });
events.on('chunkSpawned', (chunk) => trySpawnInChunk(chunk));

events.on('townEntered', async () => {
    if (mode !== 'playing') return;
    mode = 'town';
    await showShop();
    mode = 'playing';
});

events.on('lootFound', async (item, saleValue) => {
    if (mode !== 'playing') return;
    mode = 'paused-for-loot';
    const choice = await showLootComparison(item, saleValue);
    if (choice === 'equip') state.equip(item);
    else state.addCoins(saleValue);
    mode = 'playing';
});

// ============================================================
// Input
// ============================================================

function onAnyKey(e) {
    if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
    if (mode === 'splash') {
        startGame();
        return;
    }
    if (e.key === 'r' || e.key === 'R') {
        location.reload();
    }
    if (e.key === 'p' || e.key === 'P') {
        if (mode === 'playing') { mode = 'paused'; state.isPaused = true; showPaused(); }
        else if (mode === 'paused') { mode = 'playing'; state.isPaused = false; hidePaused(); }
    }
}
document.addEventListener('keydown', onAnyKey);
document.addEventListener('click',   () => { if (mode === 'splash') startGame(); });

// ============================================================
// Render loop
// ============================================================

function animate() {
    requestAnimationFrame(animate);

    // Cap dt — a hidden tab returns one giant delta on first frame.
    const dt = Math.min(clock.getDelta(), 0.05);

    if (mode === 'playing') {
        if (_lockedChunkIndex !== null && isEncounterClear(_lockedChunkIndex)) {
            _lockedChunkIndex = null;
            clearCombatLock();
            setCombatIndicator(false);
        }
        if (_lockedChunkIndex === null) {
            const encounterChunk = findEncounterAhead(state.distance, ARENA_LOCK_RANGE);
            if (encounterChunk !== null) {
                _lockedChunkIndex = encounterChunk;
                setCombatLock();
                setCombatIndicator(true);
            }
        }

        if (_lockedChunkIndex === null) {
            state.distance += WALK_SPEED * dt;
        }
        updatePath(state.distance);
        updatePlayer(dt);
        updateMonsters(dt, _lockedChunkIndex !== null);
    }

    renderer.render(scene, camera);
}
animate();

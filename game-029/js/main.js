/**
 * main.js — Three.js entry point.
 *
 * Game states: 'splash' → 'playing' → 'gameover'
 *
 * Library: three.js r165 via import map (see index.html)
 */

import * as THREE from 'three';

import { initScene, renderer, scene, camera, clock } from './scene.js';
import { state }  from './state.js';
import { events } from './events.js';
import { initUI, hideSplash, showLootComparison } from './ui.js';
import { initAudio, playUiClick } from './sounds.js';
import { WALK_SPEED } from './config.js';

// TODO: import your game-specific modules here as they're built
// import { initPath, updatePath }         from './path.js';
// import { initPlayer, updatePlayer }     from './player.js';
// import { initMonsters, updateMonsters } from './monsters.js';
// import { rollLoot }                     from './loot.js';
// import { enterTown, exitTown }          from './town.js';

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

// TODO: initialize game-specific modules once they exist
// initPath();
// initPlayer();
// initMonsters();

// ============================================================
// Game state machine
// ============================================================

let mode = 'splash';   // 'splash' | 'playing' | 'gameover'

function startGame() {
    if (mode === 'playing') return;
    mode = 'playing';
    state.reset();
    initAudio();
    playUiClick();
    hideSplash();
}

events.on('gameOver', () => { mode = 'gameover'; });

// TODO: wire town entry/exit into the mode machine, e.g.
// events.on('townEntered', () => { mode = 'town'; });
// events.on('townExited',  () => { mode = 'playing'; });

// TODO: example of how loot.js should present the comparison UI —
// remove once real drop logic exists.
// async function onLootDropped(item, saleValue) {
//     mode = 'paused-for-loot';
//     const choice = await showLootComparison(item, saleValue);
//     if (choice === 'equip') state.equipped[item.slot] = item;
//     else state.addCoins(saleValue);
//     mode = 'playing';
// }

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
        state.distance += WALK_SPEED * dt;
        // TODO: replace the auto-walk distance tick above with real
        // player-driven movement once player.js exists.
        // updatePlayer(dt);
        // updatePath(dt);
        // updateMonsters(dt);
    }

    renderer.render(scene, camera);
}
animate();

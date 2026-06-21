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
import { initUI, hideSplash, logMessage, showDamage, updateActionHint } from './ui.js';
import { initAudio, playUiClick } from './sounds.js';

import { initDungeon, tileAt } from './dungeon.js';
import { initPlayer, updatePlayer, handleInput } from './player.js';

// ============================================================
// THREE.JS GOTCHAS (read before adding anything)
// ============================================================
//
// 1. RESIZE — camera.updateProjectionMatrix() is REQUIRED after changing
//    camera.aspect. The scaffold does this in scene.js — don't remove it.
//
// 2. CLOCK CAP — Math.min(clock.getDelta(), 0.05) is mandatory. A backgrounded
//    tab returns a huge delta on first frame after unhide; without the cap
//    movement tweens / physics will tunnel through walls.
//
// 3. COLOR — new THREE.Color(255, 0, 255) is WHITE, not magenta. Color takes
//    floats 0..1. Use 0xRRGGBB hex integers everywhere instead.
//
// 4. GPU MEMORY — three.js does not auto-free geometries/materials. If you
//    spawn/destroy lots of meshes (monsters, loot), call mesh.geometry.dispose()
//    and mesh.material.dispose() before removing. Negligible for a fixed scene.
//
// ============================================================
// Init
// ============================================================

initScene();
initUI();
initDungeon();   // build the level mesh once; player spawns into it on start

// ============================================================
// Game state machine
// ============================================================

let mode = 'splash';   // 'splash' | 'playing' | 'gameover'

function startGame() {
    if (mode === 'playing') return;
    mode = 'playing';
    state.reset();
    events.emit('depthChanged', state.depth);
    events.emit('hpChanged', { cur: state.hp, max: state.hpMax });
    initPlayer();      // spawn onto the start tile, facing into the maze
    initAudio();
    playUiClick();
    hideSplash();
    logMessage('You descend into the Crypt of the Forgotten...');
}

events.on('gameOver', () => { mode = 'gameover'; });

// Context-sensitive action hint: show "SEARCH (F)" when an interactable is ahead.
// INTERACTABLE_TILES = doors, switches, chests (Phase 5). For now nothing is interactive,
// but the hook is live so Phase 5 just adds tile chars to the set.
const INTERACTABLE_TILES = new Set(['?', 'C', '+']);   // placeholder chars
events.on('playerMoved', ({ x, z, facing }) => {
    const { dx, dz } = [{ dx:0,dz:-1 },{ dx:1,dz:0 },{ dx:0,dz:1 },{ dx:-1,dz:0 }][facing];
    const ahead = tileAt(x + dx, z + dz);
    updateActionHint(INTERACTABLE_TILES.has(ahead));
});

// Camera shake state — grid-safe (no position stored between frames)
let _shake = null;   // { t, dur, mag }
const SHAKE_DUR = 0.22;
const SHAKE_MAG = 0.06;

events.on('damageTaken', () => {
    showDamage();
    _shake = { t: 0, dur: SHAKE_DUR, mag: SHAKE_MAG };
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
        // Restart
        location.reload();
        return;
    }
    if (e.key === 'Escape') {
        // Back to splash
        location.reload();
        return;
    }
    if (mode === 'playing') handleInput(e);
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
        updatePlayer(dt);
    }

    // Grid-safe camera shake — offset is applied and removed each frame
    if (_shake) {
        _shake.t += dt;
        const p = _shake.t / _shake.dur;
        if (p < 1) {
            const decay = 1 - p;
            // Use a seeded-by-time oscillation so shake varies without random
            const ox = Math.sin(p * 47.3) * _shake.mag * decay;
            const oy = Math.cos(p * 38.7) * _shake.mag * decay;
            camera.position.x += ox;
            camera.position.y += oy;
            renderer.render(scene, camera);
            camera.position.x -= ox;
            camera.position.y -= oy;
        } else {
            _shake = null;
            renderer.render(scene, camera);
        }
    } else {
        renderer.render(scene, camera);
    }
}
animate();

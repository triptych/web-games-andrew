/**
 * main.js — Village of the Wandering Blade
 *
 * Three.js action RPG: explore the countryside, slay monsters,
 * gather resources, and return to build and develop your village.
 *
 * Architecture:
 *   world.js    — terrain, lighting, scene setup
 *   player.js   — player mesh, movement, attacks, camera
 *   monsters.js — monster spawning, AI
 *   pickups.js  — resource orbs
 *   village.js  — building meshes, village mode
 *   ui.js       — DOM HUD (no Three.js)
 *   state.js    — global state, auto-emits events
 *   events.js   — EventBus
 *   sounds.js   — Web Audio API
 *   config.js   — constants
 *
 * Controls:
 *   WASD / Arrows — move
 *   Mouse         — rotate camera (click to lock pointer)
 *   Space / F     — attack
 *   E             — interact (open build panel in village)
 *   Tab           — toggle explore / village mode
 *   Escape        — unlock pointer / return to splash
 */

import * as THREE from 'https://cdn.jsdelivr.net/npm/three@0.165.0/build/three.module.js';

import { initWorld }    from './world.js';
import { initPlayer, requestPointerLock } from './player.js';
import { initMonsters } from './monsters.js';
import { initPickups }  from './pickups.js';
import { initVillage }  from './village.js';
import { initUI, showBuildPanel, hideBuildPanel } from './ui.js';
import { state }        from './state.js';
import { events }       from './events.js';
import { initAudio, playUiClick, playLevelUp, playGameOver } from './sounds.js';
import { VILLAGE_RADIUS } from './config.js';

// ============================================================
// Splash → Game start
// ============================================================

const splashEl  = document.getElementById('splash');
const hudEl     = document.getElementById('hud');
const startBtn  = document.getElementById('splash-start');
let gameStarted = false;

function startGame() {
    if (gameStarted) return;
    gameStarted = true;
    initAudio();
    playUiClick();
    splashEl.style.display = 'none';
    hudEl.style.display    = 'block';
    _initGame();
}

startBtn.addEventListener('click', startGame);
document.addEventListener('keydown', (e) => {
    if (!gameStarted && !['Shift','Control','Alt','Meta'].includes(e.key)) {
        startGame();
    }
});

// ============================================================
// Game init
// ============================================================

function _initGame() {
    // --- World ---
    const { scene, camera, renderer, fireGroup } = initWorld();

    // --- Systems ---
    const { playerGroup, update: updatePlayer } = initPlayer(scene, camera);
    const { monsters, update: updateMonsters }  = initMonsters(scene);
    const { pickups,  update: updatePickups  }  = initPickups(scene);
    const { update: updateVillage }             = initVillage(scene);

    initUI();

    // --- Event sounds ---
    events.on('playerLevelUp', () => playLevelUp());
    events.on('gameOver', () => {
        playGameOver();
        setTimeout(() => {
            document.getElementById('hud-mode').textContent = 'GAME OVER';
            document.getElementById('hud-mode').style.color = '#e05555';
        }, 200);
    });

    // --- Input: Tab = toggle mode ---
    document.addEventListener('keydown', (e) => {
        if (e.code === 'Tab') {
            e.preventDefault();
            state.mode = state.mode === 'explore' ? 'village' : 'explore';
            playUiClick();
        }

        if (e.code === 'KeyE') {
            // Interact — open build panel if in village
            const pPos = playerGroup.position;
            const distToVillage = Math.sqrt(pPos.x * pPos.x + pPos.z * pPos.z);
            if (distToVillage <= VILLAGE_RADIUS + 2) {
                const panel = document.getElementById('build-panel');
                if (panel.style.display === 'none' || panel.style.display === '') {
                    showBuildPanel();
                } else {
                    hideBuildPanel();
                }
                playUiClick();
            } else {
                events.emit('message', 'Return to the village to build. (Walk toward campfire)', '#c8a844');
            }
        }

        if (e.code === 'Escape') {
            // Unlock pointer or close build panel
            if (document.getElementById('build-panel').style.display === 'block') {
                hideBuildPanel();
            } else if (document.pointerLockElement) {
                document.exitPointerLock();
            }
        }
    });

    // --- Pointer lock on click ---
    renderer.domElement.addEventListener('click', () => {
        requestPointerLock();
    });

    // ============================================================
    // Game loop
    // ============================================================

    const clock = new THREE.Clock();
    let frameCount = 0;

    function animate() {
        requestAnimationFrame(animate);

        const dt = Math.min(clock.getDelta(), 0.1);  // cap to avoid physics explosion
        frameCount++;

        if (!state.isGameOver) {
            const pPos = playerGroup.position;

            updatePlayer(dt, monsters, pickups);
            updateMonsters(dt, pPos);
            updatePickups(dt);
            updateVillage(dt);

            // Animate campfire flame
            if (fireGroup.userData.flame) {
                const flame = fireGroup.userData.flame;
                flame.position.y = 0.5 + Math.sin(Date.now() * 0.006) * 0.12;
                flame.scale.setScalar(0.9 + Math.sin(Date.now() * 0.009) * 0.15);
                flame.material.color.setHex(
                    Date.now() % 400 < 200 ? 0xff7722 : 0xff9933
                );
            }

            // Campfire light flicker
            if (fireGroup.userData.fireLight) {
                fireGroup.userData.fireLight.intensity = 2.2 + Math.sin(Date.now() * 0.012) * 0.5;
            }

            // Dead monster cleanup every 300 frames
            if (frameCount % 300 === 0) {
                const before = monsters.length;
                monsters.splice(0, before, ...monsters.filter(m => m.alive));
            }
        }

        renderer.render(scene, camera);
    }

    animate();
}

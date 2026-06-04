/**
 * main.js — Three.js entry point for Neon Vanguard.
 *
 * Game states: 'splash' → 'playing' → 'gameover'
 *
 * Library: three.js r165 via import map (see index.html)
 */

import * as THREE from 'three';

import { initScene, scene, camera, clock, renderScene } from './scene.js';
import { state }  from './state.js';
import { events } from './events.js';
import { initUI, hideSplash } from './ui.js';
import { initAudio, playUiClick, playGameOver } from './sounds.js';
import { FIELD_HALF_W, FIELD_HALF_H, COLORS, CAM_POS } from './config.js';

import { initPlayer, updatePlayer, resetPlayer } from './player.js';
import { initBullets, updateBullets, resetBullets } from './bullets.js';
import { initEnemyBullets, updateEnemyBullets, resetEnemyBullets } from './enemyBullets.js';
import { initEnemies, updateEnemies, resetEnemies } from './enemies.js';
import { initExplosions, updateExplosions, resetExplosions } from './explosions.js';
import { initPopups, updatePopups, resetPopups } from './popups.js';
import { updateCollisions, resetCollisions } from './collisions.js';
import { initWaves, updateWaves, resetWaves } from './waves.js';

// ============================================================
// THREE.JS GOTCHAS (read before adding anything)
// ============================================================
//
// 1. RESIZE — camera.updateProjectionMatrix() is REQUIRED after changing
//    camera.aspect. The scaffold does this in scene.js — don't remove it.
//
// 2. CLOCK CAP — Math.min(clock.getDelta(), 0.05) is mandatory. A backgrounded
//    tab returns a huge delta on first frame after unhide; without the cap
//    bullets/enemies will tunnel past each other.
//
// 3. COLOR — new THREE.Color(255, 0, 255) is WHITE, not magenta. Color takes
//    floats 0..1. Use 0xRRGGBB hex integers everywhere instead.
//
// 4. GPU MEMORY — three.js does not auto-free geometries/materials. This is a
//    shmup that spawns/destroys many meshes, so SHARE geometries/materials
//    where possible, and call mesh.geometry.dispose() / mesh.material.dispose()
//    on bullets and enemies you remove (unless they share a cached resource).
//
// 5. SHADER UNIFORMS — ShaderMaterial uniforms must be updated every frame for
//    time-based effects (e.g. uTime). See the neon grid below for the pattern.
//
// ============================================================
// Neon retro backdrop — animated scrolling grid via a custom ShaderMaterial.
// This is both the game's signature look and a working example of the shader
// pattern enemy/player modules can copy.
// ============================================================

let gridMaterial = null;

function _buildNeonBackdrop() {
    const geo = new THREE.PlaneGeometry(
        FIELD_HALF_W * 2 + 8,
        FIELD_HALF_H * 2 + 8,
        1, 1,
    );

    gridMaterial = new THREE.ShaderMaterial({
        transparent: true,
        uniforms: {
            uTime:     { value: 0 },
            uColorA:   { value: new THREE.Color(COLORS.accent) },
            uColorB:   { value: new THREE.Color(COLORS.magenta) },
            uGridSize: { value: 1.4 },
        },
        vertexShader: /* glsl */`
            varying vec2 vUv;
            void main() {
                vUv = uv;
                gl_Position = projectionMatrix * modelViewMatrix * vec4(position, 1.0);
            }
        `,
        fragmentShader: /* glsl */`
            precision highp float;
            varying vec2 vUv;
            uniform float uTime;
            uniform vec3  uColorA;
            uniform vec3  uColorB;
            uniform float uGridSize;

            // Distance to the nearest grid line, used to draw glowing lines.
            float gridLine(vec2 p, float thickness) {
                vec2 g = abs(fract(p - 0.5) - 0.5) / fwidth(p);
                float line = min(g.x, g.y);
                return 1.0 - smoothstep(0.0, thickness, line);
            }

            void main() {
                // Scroll the grid "toward" the player for a forward-motion feel.
                vec2 p = vUv * vec2(20.0, 14.0);
                p.y += uTime * 1.5;

                float l = gridLine(p, 1.6);

                // Colour blends across the field from cyan to magenta.
                vec3 col = mix(uColorA, uColorB, vUv.y);
                col *= l * 0.9;

                // Subtle vignette so edges fade into the fog.
                float vig = smoothstep(1.1, 0.2, length(vUv - 0.5));
                gl_FragColor = vec4(col, l * vig);
            }
        `,
    });

    const grid = new THREE.Mesh(geo, gridMaterial);
    grid.rotation.x = -Math.PI / 2; // lay flat on the XZ plane
    grid.position.y = -0.5;
    scene.add(grid);
}

// ============================================================
// Init
// ============================================================

initScene();
initUI();
_buildNeonBackdrop();
initPlayer();
initBullets();
initEnemyBullets();
initEnemies();
initExplosions();
initPopups();
initWaves();

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
    resetPlayer();
    resetBullets();
    resetEnemyBullets();
    resetEnemies();
    resetExplosions();
    resetPopups();
    resetCollisions();
    resetWaves();
    _shake = 0;
    camera.position.set(CAM_POS[0], CAM_POS[1], CAM_POS[2]);
}

events.on('gameOver', () => {
    mode = 'gameover';
    playGameOver();
});

// ============================================================
// Screen flash on player hit (Phase 2 "juice"; tuned further in Phase 3)
// ============================================================

const _flash = document.getElementById('flash');
let _flashTimer = 0;

events.on('playerHit', () => { _flashTimer = 0.25; });

function _updateFlash(dt) {
    if (!_flash) return;
    if (_flashTimer > 0) {
        _flashTimer -= dt;
        _flash.style.opacity = String(Math.max(0, _flashTimer / 0.25) * 0.6);
    } else {
        _flash.style.opacity = '0';
    }
}

// ============================================================
// Camera shake on player hit (Phase 3 juice)
// ------------------------------------------------------------
// A hit kicks _shake to 1; it decays toward 0 over SHAKE_DECAY. Each frame we
// offset the camera on the XZ plane (it looks straight down, so X/Z reads as a
// screen-space jolt) by a random amount scaled by the remaining shake, then
// restore the base position so the offset never accumulates.
// ============================================================

const SHAKE_DECAY = 4.0;   // 1/sec — higher = snappier recovery
const SHAKE_MAX   = 0.9;   // peak offset in world units
let _shake = 0;

events.on('playerHit', () => { _shake = 1; });

function _updateShake(dt) {
    if (_shake > 0) {
        _shake = Math.max(0, _shake - SHAKE_DECAY * dt);
        // Quadratic falloff so the tail settles smoothly rather than buzzing.
        const mag = SHAKE_MAX * _shake * _shake;
        camera.position.x = CAM_POS[0] + (Math.random() * 2 - 1) * mag;
        camera.position.z = CAM_POS[2] + (Math.random() * 2 - 1) * mag;
    } else {
        // Idle: hold the exact base position.
        camera.position.x = CAM_POS[0];
        camera.position.z = CAM_POS[2];
    }
}

// ============================================================
// Input
// ============================================================

function onAnyKey(e) {
    if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
    if (mode === 'splash') {
        startGame();
        return;
    }
    if (mode === 'gameover') {
        if (e.key === 'r' || e.key === 'R') location.reload();
        if (e.key === 'Escape') location.reload();
    }
    if (e.key === 'p' || e.key === 'P') {
        if (mode === 'playing') state.isPaused = !state.isPaused;
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

    // Backdrop animates in every mode so the splash screen looks alive.
    if (gridMaterial) gridMaterial.uniforms.uTime.value += dt;

    if (mode === 'playing' && !state.isPaused) {
        updateWaves(dt);
        updatePlayer(dt);
        updateBullets(dt);
        updateEnemyBullets(dt);
        updateEnemies(dt);
        updateCollisions(dt);     // after movement, before render
        updateExplosions(dt);
        updatePopups(dt);
        _updateFlash(dt);
        _updateShake(dt);
    }

    renderScene();
}
animate();

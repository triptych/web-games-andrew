/**
 * Main Game Module
 * Kaplay initialization and game scene
 */

import kaplay from '../../lib/kaplay/kaplay.mjs';
import { SCREEN_WIDTH, SCREEN_HEIGHT, TEST_MAP, TEST_ENEMIES } from './config.js';
import { state } from './state.js';
import { initTextures } from './textures.js';
import { initRenderer } from './renderer.js';
import { initPlayer } from './player.js';
import { initInput } from './input.js';
import { initUI } from './ui.js';
import { initWeapons, updateWeapons, unlockWeapon } from './weapons.js';
import { initEnemies, updateEnemies, spawnEnemiesFromConfig } from './enemies.js';

// Initialize kaplay with transparent rendering
const k = kaplay({
    width: SCREEN_WIDTH,
    height: SCREEN_HEIGHT,
    crisp: true,
    pixelDensity: 1,
    // Transparent background - critical for layering
    background: [0, 0, 0, 0],
});

// Make kaplay globally accessible for debugging
window.k = k;

// Debug helper to check enemy status
window.debugEnemies = () => {
    console.log('\n=== ENEMY STATUS ===');
    if (!state.enemies || state.enemies.length === 0) {
        console.log('No enemies found!');
        return;
    }
    state.enemies.forEach((enemy, i) => {
        const dx = enemy.x - state.player.x;
        const dy = enemy.y - state.player.y;
        const dist = Math.sqrt(dx * dx + dy * dy).toFixed(1);
        console.log(`${i + 1}. ${enemy.type.name} - HP: ${enemy.hp.toFixed(0)}/${enemy.maxHp} - State: ${enemy.state} - Alive: ${enemy.alive} - Dist: ${dist} units - Pos: (${enemy.x.toFixed(1)}, ${enemy.y.toFixed(1)})`);
    });
    console.log('==================\n');
};

// Game scene
k.scene("game", () => {
    console.log('Starting game scene...');

    // Reset state
    state.reset();

    // Store map in state for weapon system
    state.map = TEST_MAP;

    // Initialize all systems
    initTextures(k); // Load and slice textures first
    initRenderer(k);
    initPlayer(k);
    initWeapons(k);
    initEnemies(k); // Phase 3: Initialize enemy system
    initInput(k);
    initUI(k);

    // Unlock all weapons for testing Phase 2
    // In a real game, these would be unlocked through pickups
    unlockWeapon('machinegun');
    unlockWeapon('shotgun');
    unlockWeapon('rocket');

    // Spawn enemies for Phase 3 testing
    spawnEnemiesFromConfig(TEST_ENEMIES);

    // Update loop - for logic only
    k.onUpdate(() => {
        if (state.isPaused || state.isGameOver) return;

        // Update FPS counter
        state.fps = 1 / k.dt();

        // Update time alive
        state.timeAlive += k.dt();

        // Update weapon system (projectiles, effects, etc.)
        updateWeapons(k.dt());

        // Update enemy system (AI, behaviors, etc.) - Phase 3
        updateEnemies(k.dt(), state.player);
    });

    // Note: Rendering is now handled by player object's draw() function

    // Pause handling
    k.onKeyPress('escape', () => {
        if (!state.isGameOver) {
            state.isPaused = !state.isPaused;
            if (state.isPaused) {
                console.log('Game paused');
                // Release pointer lock when paused
                if (document.pointerLockElement) {
                    document.exitPointerLock();
                }
            } else {
                console.log('Game resumed');
            }
        }
    });

    console.log('Game scene initialized!');
});

// Start the game
k.go("game");

console.log('Kaplay initialized - Game started!');

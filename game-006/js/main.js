/**
 * Main Game Module
 * Kaplay initialization and game scene
 */

import kaplay from '../../lib/kaplay/kaplay.mjs';
import { SCREEN_WIDTH, SCREEN_HEIGHT, TEST_MAP } from './config.js';
import { state } from './state.js';
import { initTextures } from './textures.js';
import { initRenderer } from './renderer.js';
import { initPlayer } from './player.js';
import { initInput } from './input.js';
import { initUI } from './ui.js';
import { initWeapons, updateWeapons, unlockWeapon } from './weapons.js';

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
    initInput(k);
    initUI(k);

    // Unlock all weapons for testing Phase 2
    // In a real game, these would be unlocked through pickups
    unlockWeapon('machinegun');
    unlockWeapon('shotgun');
    unlockWeapon('rocket');

    // Update loop - for logic only
    k.onUpdate(() => {
        if (state.isPaused || state.isGameOver) return;

        // Update FPS counter
        state.fps = 1 / k.dt();

        // Update time alive
        state.timeAlive += k.dt();

        // Update weapon system (projectiles, effects, etc.)
        updateWeapons(k.dt());
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

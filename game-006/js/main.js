/**
 * Main Game Module
 * Kaplay initialization and game scene
 */

import kaplay from '../../lib/kaplay/kaplay.mjs';
import { SCREEN_WIDTH, SCREEN_HEIGHT } from './config.js';
import { state } from './state.js';
import { initTextures } from './textures.js';
import { initRenderer } from './renderer.js';
import { initPlayer } from './player.js';
import { initInput } from './input.js';
import { initUI } from './ui.js';
import { initWeapons, updateWeapons, unlockWeapon } from './weapons.js';
import { initEnemies, updateEnemies, getAliveEnemyCount } from './enemies.js';
import { initItems, updateItems } from './items.js';
import { initMenuScene } from './menu.js';
import { initFloorSystem, loadFloor, transitionToNextFloor, getCurrentExitDoor } from './floor.js';
import { initDoor, updateDoor, spawnDoor, removeDoor, shouldTransitionFloor, resetTransitionFlag, isDoorActive } from './door.js';

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

// Debug helper to check player status
window.debugPlayer = () => {
    console.log('\n=== PLAYER STATUS ===');
    if (!state.player) {
        console.log('Player not initialized!');
        return;
    }
    console.log(`Position: (${state.player.x.toFixed(2)}, ${state.player.y.toFixed(2)})`);
    console.log(`Angle: ${state.player.angle || state.player.playerAngle}°`);
    console.log(`Health: ${state.health}/${state.maxHealth}`);

    // Check tiles around player
    const getTile = (x, y) => {
        const mapX = Math.floor(x);
        const mapY = Math.floor(y);
        if (!state.map || mapY < 0 || mapY >= state.map.length || mapX < 0 || mapX >= state.map[0].length) {
            return -1;
        }
        return state.map[mapY][mapX];
    };

    console.log(`Tile at player: ${getTile(state.player.x, state.player.y)}`);
    console.log('Surrounding tiles (N/S/E/W):',
        getTile(state.player.x, state.player.y - 1),
        getTile(state.player.x, state.player.y + 1),
        getTile(state.player.x + 1, state.player.y),
        getTile(state.player.x - 1, state.player.y)
    );
    console.log('==================\n');
};

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

// Initialize menu scene
initMenuScene(k);

// Game scene
k.scene("game", () => {
    console.log('Starting game scene...');

    // Reset state
    state.reset();

    // Initialize all systems
    initTextures(k); // Load and slice textures first
    initRenderer(k);
    initPlayer(k);
    initWeapons(k);
    initEnemies(k); // Phase 3: Initialize enemy system
    initItems(k); // Initialize item/pickup system
    initFloorSystem(k); // Initialize floor progression system
    initDoor(k); // Initialize door system
    initInput(k);
    initUI(k);

    // Unlock all weapons for testing
    unlockWeapon('machinegun');
    unlockWeapon('shotgun');
    unlockWeapon('rocket');

    // Load first floor (replaces TEST_MAP/TEST_ENEMIES/TEST_ITEMS)
    // Wait for floor to load before starting game loop
    let floorLoaded = false;
    loadFloor(1).then(() => {
        floorLoaded = true;
        console.log('✓ Floor loaded, game ready!');
    });

    // Update loop - for logic only
    k.onUpdate(() => {
        // Wait for floor to load before updating
        if (!floorLoaded) return;

        if (state.isPaused || state.isGameOver) return;

        // Update FPS counter
        state.fps = 1 / k.dt();

        // Update time alive
        state.timeAlive += k.dt();

        // Update weapon system (projectiles, effects, etc.)
        updateWeapons(k.dt());

        // Update enemy system (AI, behaviors, etc.) - Phase 3
        updateEnemies(k.dt(), state.player);

        // Update items system (bobbing, pickup detection, etc.)
        updateItems(k.dt(), state.player);

        // Update door system
        updateDoor(k.dt(), state.player);

        // Floor progression logic
        const aliveEnemies = getAliveEnemyCount();

        // Spawn door when all enemies are dead
        if (aliveEnemies === 0 && !isDoorActive()) {
            const exitDoor = getCurrentExitDoor();
            if (exitDoor) {
                console.log('All enemies defeated! Spawning exit door...');
                spawnDoor(exitDoor.x, exitDoor.y);
            }
        }

        // Transition to next floor when door is activated
        if (shouldTransitionFloor()) {
            resetTransitionFlag();
            removeDoor();
            transitionToNextFloor();
        }
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

// Start with menu/splash screen
k.go("menu");

console.log('Kaplay initialized - Starting with menu!');

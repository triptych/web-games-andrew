/**
 * Floor System Module
 * Manages floor progression, generation, and transitions
 */

import { generateFloor } from './procgen.js';
import { setMap } from './map.js';
import { state } from './state.js';
import { clearEnemies, spawnEnemy } from './enemies.js';
import { clearItems, spawnItem } from './items.js';
import { getThemeForFloor } from './themes.js';
import { loadThemeTextures } from './textures.js';

let k = null; // Kaplay instance

// Floor state
export const floorState = {
    currentFloor: 1,
    currentFloorData: null,
    currentTheme: null,
};

/**
 * Initialize the floor system
 */
export function initFloorSystem(kaplay) {
    k = kaplay;
    floorState.currentFloor = 1;
    floorState.currentFloorData = null;
    console.log('Floor system initialized');
}

/**
 * Get current floor number
 */
export function getCurrentFloor() {
    return floorState.currentFloor;
}

/**
 * Load a specific floor
 */
export async function loadFloor(floorNumber) {
    console.log(`\n=== Loading Floor ${floorNumber} ===`);

    // Get theme for this floor
    const theme = getThemeForFloor(floorNumber);
    floorState.currentTheme = theme;
    console.log(`Theme: ${theme.name} - ${theme.description}`);

    // Load theme textures and wait for them to be ready
    console.log('Waiting for textures to load...');
    await loadThemeTextures(theme);
    console.log('✓ Textures ready!');

    // Generate the floor
    const floorData = generateFloor(floorNumber);
    floorState.currentFloorData = floorData;
    floorState.currentFloor = floorNumber;

    // Apply the generated map
    setMap(floorData.map);
    console.log(`Map loaded: ${floorData.map[0].length}x${floorData.map.length}`);

    // Update state
    state.currentFloor = floorNumber;
    state.currentTheme = theme.name;
    state.enemiesThisFloor = floorData.enemySpawns.length;
    state.map = floorData.map;

    // Clear existing entities
    clearEnemies();
    clearItems();

    // Teleport player to spawn point
    if (state.player) {
        // CRITICAL: Must update BOTH pos (Kaplay position) AND x/y (custom properties)
        state.player.pos.x = floorData.playerSpawn.x;
        state.player.pos.y = floorData.playerSpawn.y;
        state.player.x = floorData.playerSpawn.x;
        state.player.y = floorData.playerSpawn.y;
        state.player.playerAngle = floorData.playerSpawn.angle;
        console.log(`✓ Player teleported to (${floorData.playerSpawn.x.toFixed(1)}, ${floorData.playerSpawn.y.toFixed(1)})`);
        console.log(`  pos: (${state.player.pos.x}, ${state.player.pos.y}), x/y: (${state.player.x}, ${state.player.y})`);
    } else {
        console.error('⚠️  CRITICAL: state.player does not exist! Cannot teleport player.');
        console.log('Spawn position will be:', floorData.playerSpawn);
    }

    // Spawn enemies
    let successfulEnemySpawns = 0;
    floorData.enemySpawns.forEach(spawn => {
        const enemy = spawnEnemy(spawn.type, spawn.x, spawn.y, spawn.angle);
        if (enemy) successfulEnemySpawns++;
    });
    console.log(`✓ Spawned ${successfulEnemySpawns}/${floorData.enemySpawns.length} enemies successfully`);

    // Spawn items
    let successfulItemSpawns = 0;
    floorData.itemSpawns.forEach(spawn => {
        const item = spawnItem(spawn.type, spawn.x, spawn.y);
        if (item) successfulItemSpawns++;
    });
    console.log(`✓ Spawned ${successfulItemSpawns}/${floorData.itemSpawns.length} items successfully`);

    console.log(`=== Floor ${floorNumber} Ready ===\n`);

    return floorData;
}

/**
 * Transition to the next floor
 */
export function transitionToNextFloor() {
    console.log(`\n>>> Transitioning from Floor ${floorState.currentFloor} to Floor ${floorState.currentFloor + 1} >>>`);

    // Increment floor counter
    const nextFloor = floorState.currentFloor + 1;
    state.totalFloorsCompleted++;

    // Reset floor-specific stats (but preserve player stats)
    state.timeAlive = 0;

    // Load the next floor
    loadFloor(nextFloor);

    // TODO: Add visual/audio feedback for floor transition
    console.log(`>>> Transition Complete >>>\n`);
}

/**
 * Get the exit door location for the current floor
 */
export function getCurrentExitDoor() {
    return floorState.currentFloorData?.exitDoor || null;
}

/**
 * Reset floor system for new game
 */
export function resetFloorSystem() {
    floorState.currentFloor = 1;
    floorState.currentFloorData = null;
    console.log('Floor system reset');
}

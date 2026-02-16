/**
 * Door System Module
 * Handles exit door spawning, rendering, and interaction
 */

import { state } from './state.js';
import { getTile } from './map.js';

let k = null; // Kaplay instance

// Door state
export const doorState = {
    active: false,
    x: 0,
    y: 0,
    proximityRange: 1.5, // Distance to show prompt and allow interaction
    isPlayerNear: false,
    shouldTransition: false,
};

/**
 * Initialize door system
 */
export function initDoor(kaplay) {
    k = kaplay;
    doorState.active = false;
    doorState.shouldTransition = false;
    console.log('Door system initialized');
}

/**
 * Spawn exit door at location
 */
export function spawnDoor(x, y) {
    doorState.active = true;
    doorState.x = Math.floor(x);
    doorState.y = Math.floor(y);
    doorState.isPlayerNear = false;
    doorState.shouldTransition = false;

    // Place door tile on map
    if (state.map && state.map[doorState.y] && state.map[doorState.y][doorState.x] !== undefined) {
        state.map[doorState.y][doorState.x] = 5; // Door tile
        console.log(`Exit door spawned at (${doorState.x}, ${doorState.y})`);
    } else {
        console.error(`Failed to spawn door at (${doorState.x}, ${doorState.y}) - invalid map location`);
    }
}

/**
 * Remove door (for floor transitions)
 */
export function removeDoor() {
    if (doorState.active && state.map) {
        // Clear door tile from map
        if (state.map[doorState.y] && state.map[doorState.y][doorState.x] === 5) {
            state.map[doorState.y][doorState.x] = 0; // Make walkable
        }
    }

    doorState.active = false;
    doorState.isPlayerNear = false;
    doorState.shouldTransition = false;
    console.log('Door removed');
}

/**
 * Check if player is near door
 */
export function isPlayerNearDoor() {
    if (!doorState.active || !state.player) return false;

    const dx = state.player.x - (doorState.x + 0.5);
    const dy = state.player.y - (doorState.y + 0.5);
    const distance = Math.sqrt(dx * dx + dy * dy);

    return distance <= doorState.proximityRange;
}

/**
 * Activate door (player presses E)
 */
export function activateDoor() {
    if (!doorState.active) return false;
    if (!isPlayerNearDoor()) return false;

    console.log('Door activated! Transitioning to next floor...');
    doorState.shouldTransition = true;
    return true;
}

/**
 * Check if door should trigger floor transition
 */
export function shouldTransitionFloor() {
    return doorState.shouldTransition;
}

/**
 * Reset transition flag
 */
export function resetTransitionFlag() {
    doorState.shouldTransition = false;
}

/**
 * Update door state (check proximity)
 */
export function updateDoor(dt, player) {
    if (!doorState.active) return;

    // Update proximity state
    doorState.isPlayerNear = isPlayerNearDoor();
}

/**
 * Check if door is active
 */
export function isDoorActive() {
    return doorState.active;
}

/**
 * Get door location
 */
export function getDoorLocation() {
    return { x: doorState.x, y: doorState.y };
}

/**
 * Input System
 * Handles mouse lock, mouse movement, shooting, and weapon switching
 */

import { MOUSE_SENSITIVITY } from './config.js';
import { rotatePlayer } from './player.js';
import { state } from './state.js';
import { switchWeapon, nextWeapon, previousWeapon, fireWeapon } from './weapons.js';
import { castSingleRay } from './raycaster.js';

let isMouseLocked = false;
let isMouseDown = false;

/**
 * Initialize input system
 */
export function initInput(k) {
    // Get canvas
    const canvas = document.querySelector('canvas');
    if (!canvas) {
        console.error('Canvas not found for input system!');
        return;
    }

    // Click canvas to request pointer lock
    canvas.addEventListener('click', () => {
        if (!isMouseLocked) {
            canvas.requestPointerLock();
        }
    });

    // Handle pointer lock changes
    document.addEventListener('pointerlockchange', () => {
        isMouseLocked = document.pointerLockElement === canvas;

        if (isMouseLocked) {
            console.log('Mouse locked - move mouse to look around, ESC to unlock');
        } else {
            console.log('Mouse unlocked - click canvas to lock again');
        }
    });

    // Handle mouse movement
    document.addEventListener('mousemove', (e) => {
        if (isMouseLocked && !state.isPaused && !state.isGameOver) {
            const angleChange = e.movementX * MOUSE_SENSITIVITY;
            rotatePlayer(angleChange);
        }
    });

    // Handle mouse down for shooting - DISABLED
    canvas.addEventListener('mousedown', (e) => {
        if (isMouseLocked && !state.isPaused && !state.isGameOver) {
            e.preventDefault();
            isMouseDown = true;
            // handleShoot(k); // DISABLED
        }
    });

    // Handle mouse up
    canvas.addEventListener('mouseup', (e) => {
        if (isMouseLocked) {
            e.preventDefault();
            isMouseDown = false;
        }
    });

    // Handle mouse wheel for weapon switching
    canvas.addEventListener('wheel', (e) => {
        if (isMouseLocked && !state.isPaused && !state.isGameOver) {
            e.preventDefault();
            if (e.deltaY < 0) {
                previousWeapon();
            } else {
                nextWeapon();
            }
        }
    });

    // Keyboard weapon switching (number keys 1-4)
    k.onKeyPress('1', () => {
        if (!state.isPaused && !state.isGameOver) {
            switchWeapon('pistol');
        }
    });

    k.onKeyPress('2', () => {
        if (!state.isPaused && !state.isGameOver) {
            switchWeapon('machinegun');
        }
    });

    k.onKeyPress('3', () => {
        if (!state.isPaused && !state.isGameOver) {
            switchWeapon('shotgun');
        }
    });

    k.onKeyPress('4', () => {
        if (!state.isPaused && !state.isGameOver) {
            switchWeapon('rocket');
        }
    });

    // Ctrl key for shooting (alternative to mouse) - DISABLED
    k.onKeyPress('control', () => {
        if (!state.isPaused && !state.isGameOver && isMouseLocked) {
            // handleShoot(k); // DISABLED
        }
    });

    // Continuous shooting while mouse is held - DISABLED
    k.onUpdate(() => {
        if (isMouseDown && isMouseLocked && !state.isPaused && !state.isGameOver) {
            // handleShoot(k); // DISABLED
        }
    });

    console.log('Input system initialized - click canvas to lock mouse');
}

/**
 * Handle shooting logic
 */
function handleShoot(k) {
    if (!state.player) return;

    const result = fireWeapon(state.player, state.map, castSingleRay);

    if (result) {
        state.shotsFired++;

        // Track hits for accuracy
        if (result.hits && result.hits.length > 0) {
            state.shotsHit += result.hits.length;

            // Log hits for debugging
            result.hits.forEach(hit => {
                console.log(`Hit at distance ${hit.distance.toFixed(2)}, damage: ${hit.damage.toFixed(1)}`);
            });
        }
    }
}

/**
 * Get mouse lock state
 */
export function getMouseLocked() {
    return isMouseLocked;
}

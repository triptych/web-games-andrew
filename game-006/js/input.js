/**
 * Input System
 * Handles mouse lock and mouse movement
 */

import { MOUSE_SENSITIVITY } from './config.js';
import { rotatePlayer } from './player.js';
import { state } from './state.js';

let isMouseLocked = false;

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

    console.log('Input system initialized - click canvas to lock mouse');
}

/**
 * Get mouse lock state
 */
export function getMouseLocked() {
    return isMouseLocked;
}

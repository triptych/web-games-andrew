/**
 * Player System
 * Handles player state, movement, and camera
 */

import {
    PLAYER_START_X,
    PLAYER_START_Y,
    PLAYER_START_ANGLE,
    PLAYER_SIZE,
    PLAYER_MOVE_SPEED,
    PLAYER_SPRINT_SPEED,
    PLAYER_ROTATION_SPEED,
    FOV,
} from './config.js';
import { degToRad, normalizeAngle } from './utils.js';
import { checkCollision } from './map.js';
import { state } from './state.js';

// Player object
const player = {
    x: PLAYER_START_X,
    y: PLAYER_START_Y,
    angle: PLAYER_START_ANGLE,
    dirX: 0,
    dirY: 0,
    planeX: 0,
    planeY: 0,
};

/**
 * Update camera direction and plane vectors based on angle
 */
function updateCameraVectors() {
    const angleRad = degToRad(player.angle);

    // Direction vector
    player.dirX = Math.cos(angleRad);
    player.dirY = Math.sin(angleRad);

    // Camera plane (perpendicular to direction, length determines FOV)
    const planeLength = Math.tan(degToRad(FOV / 2));
    player.planeX = -player.dirY * planeLength;
    player.planeY = player.dirX * planeLength;
}

/**
 * Initialize player system
 */
export function initPlayer(k) {
    // Reset player to starting position
    player.x = PLAYER_START_X;
    player.y = PLAYER_START_Y;
    player.angle = PLAYER_START_ANGLE;

    updateCameraVectors();

    // Store player in state for other modules
    state.player = player;

    // Update loop - handle movement and rotation
    k.onUpdate(() => {
        if (state.isPaused || state.isGameOver) return;

        // Handle rotation
        const rotationSpeed = PLAYER_ROTATION_SPEED * k.dt();

        if (k.isKeyDown('left')) {
            player.angle -= rotationSpeed;
        }
        if (k.isKeyDown('right')) {
            player.angle += rotationSpeed;
        }

        // Normalize angle to 0-360
        player.angle = normalizeAngle(player.angle);

        // Update camera vectors after rotation
        updateCameraVectors();

        // Handle movement
        const isSprinting = k.isKeyDown('shift');
        const moveSpeed = (isSprinting ? PLAYER_SPRINT_SPEED : PLAYER_MOVE_SPEED) * k.dt();

        let moveX = 0;
        let moveY = 0;

        // Forward/backward (W/S or up/down arrows)
        if (k.isKeyDown('w') || k.isKeyDown('up')) {
            moveX += player.dirX * moveSpeed;
            moveY += player.dirY * moveSpeed;
        }
        if (k.isKeyDown('s') || k.isKeyDown('down')) {
            moveX -= player.dirX * moveSpeed;
            moveY -= player.dirY * moveSpeed;
        }

        // Strafe left/right (A/D)
        if (k.isKeyDown('a')) {
            // Strafe left (perpendicular to direction)
            moveX -= player.planeY * moveSpeed;
            moveY += player.planeX * moveSpeed;
        }
        if (k.isKeyDown('d')) {
            // Strafe right (perpendicular to direction)
            moveX += player.planeY * moveSpeed;
            moveY -= player.planeX * moveSpeed;
        }

        // Apply movement with collision detection
        // Check X and Y separately for wall sliding
        if (moveX !== 0) {
            const newX = player.x + moveX;
            if (!checkCollision(newX, player.y, PLAYER_SIZE)) {
                player.x = newX;
            }
        }

        if (moveY !== 0) {
            const newY = player.y + moveY;
            if (!checkCollision(player.x, newY, PLAYER_SIZE)) {
                player.y = newY;
            }
        }
    });

    console.log('Player initialized at', player.x, player.y);

    return player;
}

/**
 * Rotate player by angle (for mouse input)
 */
export function rotatePlayer(angleChange) {
    player.angle += angleChange;
    player.angle = normalizeAngle(player.angle);
    updateCameraVectors();
}

/**
 * Get player object (for debugging)
 */
export function getPlayer() {
    return player;
}

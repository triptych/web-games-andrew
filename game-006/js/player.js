/**
 * Player System
 * Player as a Kaplay game object with custom draw() function
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
import { render } from './renderer.js';

let k = null;
let playerObject = null;

/**
 * Update camera direction and plane vectors based on angle
 */
function updateCameraVectors(player) {
    const angleRad = degToRad(player.playerAngle);

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
export function initPlayer(kaplay) {
    k = kaplay;

    // Create player as a Kaplay game object
    playerObject = k.add([
        k.pos(PLAYER_START_X, PLAYER_START_Y),
        k.z(-1),
        k.opacity(0), // Invisible in 2D view
        {
            // Custom player properties (use playerAngle to avoid conflict with rotate component)
            playerAngle: PLAYER_START_ANGLE,
            dirX: 0,
            dirY: 0,
            planeX: 0,
            planeY: 0,
            x: PLAYER_START_X, // Keep separate x/y for compatibility
            y: PLAYER_START_Y,

            // Update position sync
            update() {
                // Sync custom x/y with Kaplay pos
                this.x = this.pos.x;
                this.y = this.pos.y;
            },

            // Custom draw function - renders the raycasting view
            draw() {
                // Render the entire 3D raycasting view
                render(this);
            },
        },
    ]);

    // Initialize camera vectors
    updateCameraVectors(playerObject);

    // Store player in state for other modules
    state.player = playerObject;

    // Update loop - handle movement and rotation
    k.onUpdate(() => {
        if (state.isPaused || state.isGameOver) return;

        // Handle rotation
        const rotationSpeed = PLAYER_ROTATION_SPEED * k.dt();

        if (k.isKeyDown('left')) {
            playerObject.playerAngle -= rotationSpeed;
        }
        if (k.isKeyDown('right')) {
            playerObject.playerAngle += rotationSpeed;
        }

        // Normalize angle to 0-360
        playerObject.playerAngle = normalizeAngle(playerObject.playerAngle);

        // Update camera vectors after rotation
        updateCameraVectors(playerObject);

        // Handle movement
        const isSprinting = k.isKeyDown('shift');
        const moveSpeed = (isSprinting ? PLAYER_SPRINT_SPEED : PLAYER_MOVE_SPEED) * k.dt();

        let moveX = 0;
        let moveY = 0;

        // Forward/backward (W/S or up/down arrows)
        if (k.isKeyDown('w') || k.isKeyDown('up')) {
            moveX += playerObject.dirX * moveSpeed;
            moveY += playerObject.dirY * moveSpeed;
        }
        if (k.isKeyDown('s') || k.isKeyDown('down')) {
            moveX -= playerObject.dirX * moveSpeed;
            moveY -= playerObject.dirY * moveSpeed;
        }

        // Strafe left/right (A/D)
        if (k.isKeyDown('a')) {
            // Strafe left (perpendicular to direction)
            moveX -= playerObject.planeY * moveSpeed;
            moveY += playerObject.planeX * moveSpeed;
        }
        if (k.isKeyDown('d')) {
            // Strafe right (perpendicular to direction)
            moveX += playerObject.planeY * moveSpeed;
            moveY -= playerObject.planeX * moveSpeed;
        }

        // Apply movement with collision detection
        // Check X and Y separately for wall sliding
        if (moveX !== 0) {
            const newX = playerObject.pos.x + moveX;
            if (!checkCollision(newX, playerObject.pos.y, PLAYER_SIZE)) {
                playerObject.pos.x = newX;
            }
        }

        if (moveY !== 0) {
            const newY = playerObject.pos.y + moveY;
            if (!checkCollision(playerObject.pos.x, newY, PLAYER_SIZE)) {
                playerObject.pos.y = newY;
            }
        }
    });

    console.log('Player initialized as Kaplay game object at', PLAYER_START_X, PLAYER_START_Y);

    return playerObject;
}

/**
 * Rotate player by angle (for mouse input)
 */
export function rotatePlayer(angleChange) {
    if (!playerObject) return;

    playerObject.playerAngle += angleChange;
    playerObject.playerAngle = normalizeAngle(playerObject.playerAngle);
    updateCameraVectors(playerObject);
}

/**
 * Get player object (for debugging)
 */
export function getPlayer() {
    return playerObject;
}

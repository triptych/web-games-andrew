/**
 * Player Module
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
    MOUSE_SENSITIVITY,
    FOV,
} from './config.js';
import { degToRad, normalizeAngle } from './utils.js';
import { checkCollision } from './map.js';

export const player = {
    x: PLAYER_START_X,
    y: PLAYER_START_Y,
    angle: PLAYER_START_ANGLE, // In degrees

    // Camera vectors (calculated from angle)
    dirX: 0,
    dirY: 0,
    planeX: 0,
    planeY: 0,

    // Movement state
    moveForward: false,
    moveBackward: false,
    strafeLeft: false,
    strafeRight: false,
    rotateLeft: false,
    rotateRight: false,
    sprinting: false,
};

/**
 * Initialize player camera vectors from angle
 */
export function updateCameraVectors() {
    const angleRad = degToRad(player.angle);

    // Direction vector (where player is facing)
    player.dirX = Math.cos(angleRad);
    player.dirY = Math.sin(angleRad);

    // Camera plane (perpendicular to direction, determines FOV)
    const fovRad = degToRad(FOV);
    const planeLength = Math.tan(fovRad / 2);

    player.planeX = -player.dirY * planeLength;
    player.planeY = player.dirX * planeLength;
}

/**
 * Initialize player
 */
export function initPlayer() {
    updateCameraVectors();
}

/**
 * Update player movement
 */
export function updatePlayer(dt) {
    // Rotation
    if (player.rotateLeft) {
        player.angle -= PLAYER_ROTATION_SPEED * dt;
    }
    if (player.rotateRight) {
        player.angle += PLAYER_ROTATION_SPEED * dt;
    }

    player.angle = normalizeAngle(player.angle);
    updateCameraVectors();

    // Movement speed
    const speed = player.sprinting ? PLAYER_SPRINT_SPEED : PLAYER_MOVE_SPEED;
    const moveSpeed = speed * dt;

    // Calculate desired movement
    let moveX = 0;
    let moveY = 0;

    if (player.moveForward) {
        moveX += player.dirX * moveSpeed;
        moveY += player.dirY * moveSpeed;
    }
    if (player.moveBackward) {
        moveX -= player.dirX * moveSpeed;
        moveY -= player.dirY * moveSpeed;
    }
    if (player.strafeLeft) {
        moveX -= player.planeY * moveSpeed;
        moveY += player.planeX * moveSpeed;
    }
    if (player.strafeRight) {
        moveX += player.planeY * moveSpeed;
        moveY -= player.planeX * moveSpeed;
    }

    // Apply movement with collision detection
    // Try X movement
    const newX = player.x + moveX;
    if (!checkCollision(newX, player.y, PLAYER_SIZE)) {
        player.x = newX;
    }

    // Try Y movement
    const newY = player.y + moveY;
    if (!checkCollision(player.x, newY, PLAYER_SIZE)) {
        player.y = newY;
    }
}

/**
 * Handle keyboard input
 */
export function handleKeyDown(key) {
    switch (key) {
        case 'w':
        case 'W':
        case 'ArrowUp':
            player.moveForward = true;
            break;
        case 's':
        case 'S':
        case 'ArrowDown':
            player.moveBackward = true;
            break;
        case 'a':
        case 'A':
            player.strafeLeft = true;
            break;
        case 'd':
        case 'D':
            player.strafeRight = true;
            break;
        case 'ArrowLeft':
            player.rotateLeft = true;
            break;
        case 'ArrowRight':
            player.rotateRight = true;
            break;
        case 'Shift':
            player.sprinting = true;
            break;
    }
}

/**
 * Handle keyboard release
 */
export function handleKeyUp(key) {
    switch (key) {
        case 'w':
        case 'W':
        case 'ArrowUp':
            player.moveForward = false;
            break;
        case 's':
        case 'S':
        case 'ArrowDown':
            player.moveBackward = false;
            break;
        case 'a':
        case 'A':
            player.strafeLeft = false;
            break;
        case 'd':
        case 'D':
            player.strafeRight = false;
            break;
        case 'ArrowLeft':
            player.rotateLeft = false;
            break;
        case 'ArrowRight':
            player.rotateRight = false;
            break;
        case 'Shift':
            player.sprinting = false;
            break;
    }
}

/**
 * Handle mouse movement for camera rotation
 */
export function handleMouseMove(movementX) {
    player.angle += movementX * MOUSE_SENSITIVITY;
    player.angle = normalizeAngle(player.angle);
    updateCameraVectors();
}

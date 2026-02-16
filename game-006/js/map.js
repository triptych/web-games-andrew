/**
 * Map Module
 * Handles map data and collision detection
 */

import { TEST_MAP } from './config.js';

let currentMap = TEST_MAP;

/**
 * Get tile at map coordinates
 */
export function getTile(x, y) {
    const mapX = Math.floor(x);
    const mapY = Math.floor(y);

    // Use dynamic map dimensions
    const mapHeight = currentMap.length;
    const mapWidth = currentMap[0]?.length || 0;

    if (mapX < 0 || mapX >= mapWidth || mapY < 0 || mapY >= mapHeight) {
        return 1; // Out of bounds = wall
    }

    return currentMap[mapY][mapX];
}

/**
 * Check if a position is walkable (not a wall)
 */
export function isWalkable(x, y) {
    const tile = getTile(x, y);
    return tile === 0 || tile === 5; // Empty space or door
}

/**
 * Check if a tile is a door
 */
export function isDoorTile(x, y) {
    return getTile(x, y) === 5;
}

/**
 * Check collision for player movement
 * Uses a circular collision radius
 */
export function checkCollision(x, y, radius) {
    // Check corners of bounding box
    const offsets = [
        [radius, radius],
        [-radius, radius],
        [radius, -radius],
        [-radius, -radius],
    ];

    for (const [ox, oy] of offsets) {
        if (!isWalkable(x + ox, y + oy)) {
            return true; // Collision detected
        }
    }

    return false; // No collision
}

/**
 * Get the current map
 */
export function getMap() {
    return currentMap;
}

/**
 * Set a new map
 */
export function setMap(newMap) {
    currentMap = newMap;
}

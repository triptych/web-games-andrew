/**
 * Raycaster Module
 * Implements the DDA (Digital Differential Analysis) raycasting algorithm
 */

import {
    NUM_RAYS,
    MAX_RAY_DISTANCE,
    SCREEN_WIDTH,
} from './config.js';
import { getTile } from './map.js';

/**
 * Cast all rays for the current frame
 * Returns array of ray hit information
 */
export function castRays(player) {
    const rays = [];

    for (let x = 0; x < NUM_RAYS; x++) {
        // Calculate ray direction
        // cameraX is x-coordinate in camera space (ranges from -1 to 1)
        const cameraX = 2 * x / SCREEN_WIDTH - 1;
        const rayDirX = player.dirX + player.planeX * cameraX;
        const rayDirY = player.dirY + player.planeY * cameraX;

        // Cast this ray
        const hit = castRayInternal(player.x, player.y, rayDirX, rayDirY);

        if (hit) {
            rays.push({
                column: x,
                distance: hit.distance,
                wallType: hit.wallType,
                side: hit.side, // 0 = vertical wall, 1 = horizontal wall
            });
        }
    }

    return rays;
}

/**
 * Cast a single ray using DDA algorithm
 * Exported for weapon hit detection
 */
export function castSingleRay(player, rayDir, maxDistance = MAX_RAY_DISTANCE) {
    return castRayInternal(player.x, player.y, rayDir.x, rayDir.y, maxDistance);
}

/**
 * Internal ray casting implementation
 */
function castRayInternal(startX, startY, rayDirX, rayDirY, maxDistance = MAX_RAY_DISTANCE) {
    // Current map position
    let mapX = Math.floor(startX);
    let mapY = Math.floor(startY);

    // Length of ray from current position to next x or y-side
    const deltaDistX = Math.abs(1 / rayDirX);
    const deltaDistY = Math.abs(1 / rayDirY);

    // Direction to step in (either +1 or -1)
    let stepX, stepY;

    // Distance from start position to first x-side and y-side
    let sideDistX, sideDistY;

    // Calculate step direction and initial sideDist
    if (rayDirX < 0) {
        stepX = -1;
        sideDistX = (startX - mapX) * deltaDistX;
    } else {
        stepX = 1;
        sideDistX = (mapX + 1.0 - startX) * deltaDistX;
    }

    if (rayDirY < 0) {
        stepY = -1;
        sideDistY = (startY - mapY) * deltaDistY;
    } else {
        stepY = 1;
        sideDistY = (mapY + 1.0 - startY) * deltaDistY;
    }

    // Perform DDA
    let hit = false;
    let side; // 0 = x-side, 1 = y-side
    let iterations = 0;
    const maxIterations = MAX_RAY_DISTANCE * 2;

    while (!hit && iterations < maxIterations) {
        // Jump to next map square
        if (sideDistX < sideDistY) {
            sideDistX += deltaDistX;
            mapX += stepX;
            side = 0;
        } else {
            sideDistY += deltaDistY;
            mapY += stepY;
            side = 1;
        }

        // Check if ray hit a wall
        const tile = getTile(mapX, mapY);
        if (tile > 0) {
            hit = true;
        }

        iterations++;
    }

    if (!hit) {
        return null; // Ray didn't hit anything
    }

    // Calculate perpendicular distance to wall
    // (perpendicular distance avoids fisheye effect)
    let perpWallDist;
    if (side === 0) {
        perpWallDist = (mapX - startX + (1 - stepX) / 2) / rayDirX;
    } else {
        perpWallDist = (mapY - startY + (1 - stepY) / 2) / rayDirY;
    }

    // Clamp distance to prevent extreme values
    perpWallDist = Math.max(0.1, Math.min(maxDistance, perpWallDist));

    // Calculate hit position
    const hitX = startX + rayDirX * perpWallDist;
    const hitY = startY + rayDirY * perpWallDist;

    return {
        distance: perpWallDist,
        wallType: getTile(mapX, mapY),
        side: side,
        x: hitX,
        y: hitY,
        target: 'wall', // Default to wall, will be 'enemy' in Phase 3
    };
}

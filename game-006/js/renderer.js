/**
 * Renderer Module
 * Handles all rendering operations
 */

import {
    SCREEN_WIDTH,
    SCREEN_HEIGHT,
    WALL_HEIGHT_MULTIPLIER,
    WALL_COLORS,
    SHADING_ENABLED,
    MIN_BRIGHTNESS,
    MAX_BRIGHTNESS,
    MAX_RAY_DISTANCE,
} from './config.js';
import { clamp, lerp } from './utils.js';

let ctx;
let canvas;

/**
 * Initialize renderer
 */
export function initRenderer(canvasElement) {
    canvas = canvasElement;
    ctx = canvas.getContext('2d');

    canvas.width = SCREEN_WIDTH;
    canvas.height = SCREEN_HEIGHT;
}

/**
 * Clear the screen
 */
export function clear() {
    // Draw ceiling (top half)
    ctx.fillStyle = '#2a2a4a';
    ctx.fillRect(0, 0, SCREEN_WIDTH, SCREEN_HEIGHT / 2);

    // Draw floor (bottom half)
    ctx.fillStyle = '#1a1a2a';
    ctx.fillRect(0, SCREEN_HEIGHT / 2, SCREEN_WIDTH, SCREEN_HEIGHT / 2);
}

/**
 * Render all walls from ray data
 */
export function renderWalls(rays) {
    for (const ray of rays) {
        renderWallSlice(ray);
    }
}

/**
 * Render a single vertical wall slice
 */
function renderWallSlice(ray) {
    const { column, distance, wallType, side } = ray;

    // Calculate wall height based on distance
    const lineHeight = Math.floor(WALL_HEIGHT_MULTIPLIER / distance);

    // Calculate top and bottom of wall slice
    const drawStart = Math.floor((SCREEN_HEIGHT - lineHeight) / 2);
    const drawEnd = Math.floor((SCREEN_HEIGHT + lineHeight) / 2);

    // Get base wall color
    const baseColor = WALL_COLORS[wallType] || [100, 100, 100];

    // Apply distance shading
    let brightness = 1.0;
    if (SHADING_ENABLED) {
        // Linear falloff based on distance
        brightness = 1.0 - (distance / MAX_RAY_DISTANCE);
        brightness = clamp(brightness, MIN_BRIGHTNESS, MAX_BRIGHTNESS);

        // Make horizontal walls (y-side) slightly darker for depth perception
        if (side === 1) {
            brightness *= 0.7;
        }
    }

    // Apply brightness to color
    const r = Math.floor(baseColor[0] * brightness);
    const g = Math.floor(baseColor[1] * brightness);
    const b = Math.floor(baseColor[2] * brightness);

    // Draw the wall slice
    ctx.fillStyle = `rgb(${r}, ${g}, ${b})`;
    ctx.fillRect(column, drawStart, 1, drawEnd - drawStart);
}

/**
 * Get the canvas context (for other modules if needed)
 */
export function getContext() {
    return ctx;
}

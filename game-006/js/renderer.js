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
import { castRays } from './raycaster.js';

let ctx;
let raycastCanvas;
let initialized = false;

/**
 * Initialize renderer - create separate canvas for raycasting
 */
export function initRenderer(k) {
    // Create a separate canvas for raycasting rendering
    raycastCanvas = document.createElement('canvas');
    raycastCanvas.width = SCREEN_WIDTH;
    raycastCanvas.height = SCREEN_HEIGHT;
    raycastCanvas.id = 'raycastCanvas';

    // Style it to overlay behind kaplay's canvas
    raycastCanvas.style.position = 'absolute';
    raycastCanvas.style.top = '0';
    raycastCanvas.style.left = '0';
    raycastCanvas.style.width = '100%';
    raycastCanvas.style.height = '100%';
    raycastCanvas.style.zIndex = '0';
    raycastCanvas.style.imageRendering = 'pixelated';
    raycastCanvas.style.imageRendering = 'crisp-edges';

    // Get the kaplay canvas to position ours with it
    const kaplayCanvas = document.querySelector('canvas');
    if (kaplayCanvas && kaplayCanvas.parentElement) {
        // Create a container wrapper
        const container = document.createElement('div');
        container.style.position = 'relative';
        container.style.width = SCREEN_WIDTH + 'px';
        container.style.height = SCREEN_HEIGHT + 'px';
        container.style.border = '2px solid #333';

        // Move kaplay canvas into container
        const parent = kaplayCanvas.parentElement;
        parent.insertBefore(container, kaplayCanvas);
        container.appendChild(kaplayCanvas);

        // Add our canvas to the container
        container.appendChild(raycastCanvas);

        // Style kaplay canvas - make it transparent
        kaplayCanvas.style.position = 'absolute';
        kaplayCanvas.style.top = '0';
        kaplayCanvas.style.left = '0';
        kaplayCanvas.style.width = '100%';
        kaplayCanvas.style.height = '100%';
        kaplayCanvas.style.zIndex = '1';
        kaplayCanvas.style.pointerEvents = 'auto';
        kaplayCanvas.style.border = 'none';
        kaplayCanvas.style.background = 'transparent';
    } else {
        // Fallback - just add to body
        document.body.appendChild(raycastCanvas);
    }

    ctx = raycastCanvas.getContext('2d');
    initialized = true;

    console.log('Raycasting renderer initialized with separate canvas:', {
        width: raycastCanvas.width,
        height: raycastCanvas.height,
    });
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
 * Main render function - renders complete frame
 */
export function render(player) {
    if (!ctx || !initialized || !player) {
        return;
    }

    // Clear screen (ceiling and floor)
    clear();

    // Cast rays from player position
    const rays = castRays(player);

    // Render walls
    renderWalls(rays);
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

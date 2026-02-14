/**
 * Main Game Module
 * Initialization and game loop
 */

import { initRenderer, clear, renderWalls } from './renderer.js';
import { initPlayer, updatePlayer, player, handleKeyDown, handleKeyUp, handleMouseMove } from './player.js';
import { castRays } from './raycaster.js';

// Game state
let lastTime = 0;
let fps = 60;
let frameCount = 0;
let fpsUpdateTime = 0;

// Mouse lock state
let isMouseLocked = false;

/**
 * Initialize the game
 */
function init() {
    console.log('Initializing Game 006: Wolfenstein-like Raycasting FPS');

    // Get canvas
    const canvas = document.getElementById('gameCanvas');
    if (!canvas) {
        console.error('Canvas not found!');
        return;
    }

    // Initialize modules
    initRenderer(canvas);
    initPlayer();

    // Set up input handlers
    setupInput(canvas);

    // Start game loop
    requestAnimationFrame(gameLoop);

    console.log('Game initialized successfully!');
}

/**
 * Set up input event handlers
 */
function setupInput(canvas) {
    // Keyboard events
    window.addEventListener('keydown', (e) => {
        handleKeyDown(e.key);

        // Prevent arrow keys from scrolling
        if (['ArrowUp', 'ArrowDown', 'ArrowLeft', 'ArrowRight'].includes(e.key)) {
            e.preventDefault();
        }
    });

    window.addEventListener('keyup', (e) => {
        handleKeyUp(e.key);
    });

    // Mouse lock (click canvas to lock mouse)
    canvas.addEventListener('click', () => {
        if (!isMouseLocked) {
            canvas.requestPointerLock();
        }
    });

    // Mouse movement
    document.addEventListener('mousemove', (e) => {
        if (isMouseLocked) {
            handleMouseMove(e.movementX);
        }
    });

    // Pointer lock change
    document.addEventListener('pointerlockchange', () => {
        isMouseLocked = document.pointerLockElement === canvas;
    });
}

/**
 * Main game loop
 */
function gameLoop(currentTime) {
    // Calculate delta time
    const dt = lastTime ? (currentTime - lastTime) / 1000 : 0;
    lastTime = currentTime;

    // Update
    update(dt);

    // Render
    render();

    // Update FPS counter
    updateFPS(dt);

    // Next frame
    requestAnimationFrame(gameLoop);
}

/**
 * Update game logic
 */
function update(dt) {
    // Update player
    updatePlayer(dt);
}

/**
 * Render the game
 */
function render() {
    // Clear screen
    clear();

    // Cast rays
    const rays = castRays(player);

    // Render walls
    renderWalls(rays);
}

/**
 * Update FPS counter and stats display
 */
function updateFPS(dt) {
    frameCount++;
    fpsUpdateTime += dt;

    if (fpsUpdateTime >= 0.5) {
        fps = Math.round(frameCount / fpsUpdateTime);
        frameCount = 0;
        fpsUpdateTime = 0;

        // Update stats display
        document.getElementById('fps').textContent = fps;
        document.getElementById('position').textContent =
            `${player.x.toFixed(2)}, ${player.y.toFixed(2)}`;
        document.getElementById('direction').textContent =
            `${player.angle.toFixed(0)}°`;
    }
}

// Start the game when page loads
window.addEventListener('DOMContentLoaded', init);

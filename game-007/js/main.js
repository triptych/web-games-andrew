// Main game initialization and loop

import { CONFIG } from './config.js';
import { TextEngine } from './textEngine.js';
import { World } from './world.js';
import { Parser } from './parser.js';
import { ROOMS } from '../data/rooms.js';

// Initialize Kaplay
const k = kaplay({
    width: CONFIG.SCREEN_WIDTH,
    height: CONFIG.SCREEN_HEIGHT,
    background: CONFIG.COLORS.BACKGROUND,
    crisp: true,
    global: false
});

// Game state
let textEngine;
let world;
let parser;
let inputBuffer = '';
let cursorVisible = true;
let lastCursorBlink = 0;
const CURSOR_BLINK_INTERVAL = 500; // ms

/**
 * Initialize the game
 */
function init() {
    // Create game systems
    textEngine = new TextEngine(k);
    world = new World(ROOMS);
    parser = new Parser(world, textEngine);

    // Connect inventory to world for light source checking
    world.setInventory(parser.inventory);

    // Set starting room
    world.setStartRoom('damp_chamber');

    // Show intro
    showIntro();

    // Setup input handlers
    setupInput();
}

/**
 * Show game introduction
 */
function showIntro() {
    const intro = `
========================================
     THE FORGOTTEN TEMPLE
        An Interactive Fiction
========================================

Type HELP for a list of commands.
Press SPACE or click to skip text.

========================================
    `;
    
    textEngine.print(intro.trim(), { instant: true });
    textEngine.print(''); // Empty line
    
    // Show starting room description
    const startDesc = world.getRoomDescription(true);
    textEngine.print(startDesc);
    
    textEngine.print(''); // Empty line for spacing
}

/**
 * Setup keyboard and mouse input
 */
function setupInput() {
    // Handle text input
    k.onCharInput((char) => {
        // Only accept printable characters
        if (char.length === 1 && !textEngine.currentlyTyping) {
            inputBuffer += char;
        }
    });

    // Handle special keys
    k.onKeyPress('backspace', () => {
        if (inputBuffer.length > 0 && !textEngine.currentlyTyping) {
            inputBuffer = inputBuffer.slice(0, -1);
        }
    });

    k.onKeyPress('enter', () => {
        if (!textEngine.currentlyTyping && inputBuffer.trim() !== '') {
            executeCommand(inputBuffer);
            inputBuffer = '';
        }
    });

    // Skip typewriter on space or click
    k.onKeyPress('space', () => {
        if (textEngine.currentlyTyping) {
            textEngine.skipTypewriter();
        }
    });

    k.onClick(() => {
        if (textEngine.currentlyTyping) {
            textEngine.skipTypewriter();
        }
    });

    // Scroll with mouse wheel
    k.onScroll((delta) => {
        const direction = delta.y > 0 ? -1 : 1;
        textEngine.scroll(direction);
    });

    // Arrow keys for scrolling
    k.onKeyPress('up', () => {
        if (!textEngine.currentlyTyping) {
            textEngine.scroll(-1);
        }
    });

    k.onKeyPress('down', () => {
        if (!textEngine.currentlyTyping) {
            textEngine.scroll(1);
        }
    });
}

/**
 * Execute a player command
 */
function executeCommand(command) {
    // Echo command
    textEngine.printSystem(`> ${command}`);
    
    // Parse and execute
    parser.parse(command);
    
    // Add spacing
    textEngine.print('', { instant: true });
}

/**
 * Render status bar
 */
function renderStatusBar() {
    const room = world.getCurrentRoom();
    const roomName = room ? room.name : 'Unknown';
    const itemCount = parser.inventory.getItemCount();
    const totalWeight = parser.inventory.getTotalWeight();
    
    // Draw background
    k.drawRect({
        pos: k.vec2(0, 0),
        width: CONFIG.SCREEN_WIDTH,
        height: CONFIG.UI.STATUS_BAR_HEIGHT,
        color: k.rgb(0, 50, 0)
    });

    // Draw room name
    k.drawText({
        text: roomName,
        pos: k.vec2(CONFIG.UI.PADDING, 8),
        size: CONFIG.FONT_SIZE,
        color: k.rgb(...CONFIG.COLORS.TEXT_HIGHLIGHTED),
        font: 'monospace'
    });

    // Draw inventory info
    const invText = `Items: ${itemCount} | Weight: ${totalWeight}kg`;
    k.drawText({
        text: invText,
        pos: k.vec2(CONFIG.SCREEN_WIDTH - CONFIG.UI.PADDING - 250, 8),
        size: CONFIG.FONT_SIZE,
        color: k.rgb(...CONFIG.COLORS.TEXT_PRIMARY),
        font: 'monospace'
    });
}

/**
 * Render input line
 */
function renderInputLine() {
    const inputY = CONFIG.SCREEN_HEIGHT - CONFIG.UI.INPUT_HEIGHT + 10;
    
    // Draw separator line
    k.drawLine({
        p1: k.vec2(0, CONFIG.SCREEN_HEIGHT - CONFIG.UI.INPUT_HEIGHT),
        p2: k.vec2(CONFIG.SCREEN_WIDTH, CONFIG.SCREEN_HEIGHT - CONFIG.UI.INPUT_HEIGHT),
        width: 2,
        color: k.rgb(...CONFIG.COLORS.TEXT_SECONDARY)
    });

    // Draw prompt
    k.drawText({
        text: '> ',
        pos: k.vec2(CONFIG.UI.PADDING, inputY),
        size: CONFIG.FONT_SIZE,
        color: k.rgb(...CONFIG.COLORS.TEXT_PRIMARY),
        font: 'monospace'
    });

    // Draw input buffer
    k.drawText({
        text: inputBuffer,
        pos: k.vec2(CONFIG.UI.PADDING + 20, inputY),
        size: CONFIG.FONT_SIZE,
        color: k.rgb(...CONFIG.COLORS.TEXT_PRIMARY),
        font: 'monospace'
    });

    // Draw blinking cursor
    if (cursorVisible && !textEngine.currentlyTyping) {
        const cursorX = CONFIG.UI.PADDING + 20 + (inputBuffer.length * 9.6); // Approximate character width
        k.drawRect({
            pos: k.vec2(cursorX, inputY),
            width: 10,
            height: 16,
            color: k.rgb(...CONFIG.COLORS.CURSOR)
        });
    }
}

/**
 * Main game loop
 */
k.onDraw(() => {
    // Update typewriter effect
    textEngine.updateTypewriter();

    // Render status bar
    renderStatusBar();

    // Render text buffer
    textEngine.render();

    // Render input line
    renderInputLine();
});

/**
 * Update loop for cursor blinking
 */
k.onUpdate(() => {
    const now = Date.now();
    if (now - lastCursorBlink > CURSOR_BLINK_INTERVAL) {
        cursorVisible = !cursorVisible;
        lastCursorBlink = now;
    }
});

// Start the game
init();

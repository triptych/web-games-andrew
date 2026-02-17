// Main game initialization and loop (DOM-based, no Kaplay)

import { CONFIG } from './config.js';
import { TextEngine } from './textEngine.js';
import { World } from './world.js';
import { Parser } from './parser.js';
import { ROOMS } from '../data/rooms.js';

// Game state
let textEngine;
let world;
let parser;
let commandInput;
let statusBarRoomName;
let statusBarInventoryInfo;

/**
 * Initialize the game
 */
function init() {
    console.log('Initializing game...');
    
    // Get DOM elements
    commandInput = document.getElementById('command-input');
    statusBarRoomName = document.getElementById('room-name');
    statusBarInventoryInfo = document.getElementById('inventory-info');

    console.log('DOM elements:', { commandInput, statusBarRoomName, statusBarInventoryInfo });

    // Create game systems
    textEngine = new TextEngine();
    console.log('TextEngine created');
    
    world = new World(ROOMS);
    console.log('World created');
    
    parser = new Parser(world, textEngine);
    console.log('Parser created');

    // Connect inventory to world if needed
    if (world.setInventory) {
        world.setInventory(parser.inventory);
    }

    // Set starting room
    world.setStartRoom('damp_chamber');
    console.log('Starting room set');

    // Show intro
    showIntro();
    console.log('Intro shown');

    // Setup input handlers
    setupInput();

    // Focus on input
    commandInput.focus();

    // Start game loop
    gameLoop();
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
    
    // Update status bar
    updateStatusBar();
}

/**
 * Setup keyboard and mouse input
 */
function setupInput() {
    // Handle enter key for command submission
    commandInput.addEventListener('keydown', (e) => {
        if (e.key === 'Enter') {
            const command = commandInput.value.trim();
            if (command && !textEngine.currentlyTyping) {
                executeCommand(command);
                commandInput.value = '';
            }
        }
    });

    // Handle space bar for skipping typewriter
    document.addEventListener('keydown', (e) => {
        if (e.key === ' ' && textEngine.currentlyTyping) {
            // Only skip if not typing in input field
            if (document.activeElement !== commandInput) {
                e.preventDefault();
                textEngine.skipTypewriter();
            }
        }
    });

    // Handle click for skipping typewriter
    document.getElementById('text-display').addEventListener('click', () => {
        if (textEngine.currentlyTyping) {
            textEngine.skipTypewriter();
        }
    });

    // Keep focus on input
    document.addEventListener('click', (e) => {
        // Don't focus if clicking on text display for selection
        if (e.target.id !== 'text-display' && e.target.id !== 'text-buffer') {
            commandInput.focus();
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
    
    // Update status bar
    updateStatusBar();
}

/**
 * Update status bar
 */
function updateStatusBar() {
    const room = world.getCurrentRoom();
    const roomName = room ? room.name : 'Unknown';
    
    // Update room name
    statusBarRoomName.textContent = roomName;
    
    // Update inventory info
    let itemCount = 0;
    if (parser.inventory) {
        if (typeof parser.inventory.getItemCount === 'function') {
            itemCount = parser.inventory.getItemCount();
        } else if (Array.isArray(parser.inventory)) {
            itemCount = parser.inventory.length;
        }
    }
    
    statusBarInventoryInfo.textContent = `Items: ${itemCount}`;
}

/**
 * Main game loop
 */
function gameLoop() {
    // Update typewriter effect
    textEngine.updateTypewriter();
    
    // Continue loop
    requestAnimationFrame(gameLoop);
}

// Start the game when DOM is ready
console.log('Script loaded, document state:', document.readyState);
if (document.readyState === 'loading') {
    console.log('Waiting for DOMContentLoaded...');
    document.addEventListener('DOMContentLoaded', init);
} else {
    console.log('DOM already loaded, initializing immediately...');
    init();
}

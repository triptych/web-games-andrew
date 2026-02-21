// Main game initialization and loop (DOM-based, no Kaplay)

import { TextEngine } from './textEngine.js';
import { World } from './world.js';
import { Parser } from './parser.js';
import { NPCSystem } from './npc.js';
import { SaveSystem } from './saveload.js';
import { ROOMS } from '../data/rooms.js';
import { NPCS } from '../data/npcs.js';

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
    // Get DOM elements
    commandInput = document.getElementById('command-input');
    statusBarRoomName = document.getElementById('room-name');
    statusBarInventoryInfo = document.getElementById('inventory-info');

    // Create game systems
    textEngine = new TextEngine();
    world = new World(ROOMS);
    const npcSystem = new NPCSystem(NPCS);

    parser = new Parser(world, textEngine, npcSystem, null, () => window.location.reload());

    // Create save system now that inventory is on the parser
    const saveSystem = new SaveSystem(world, parser.inventory, npcSystem);
    parser.saveSystem = saveSystem;

    // Connect inventory and NPC system to world
    world.setInventory(parser.inventory);
    world.setNPCSystem(npcSystem);

    // Set starting room
    world.setStartRoom('damp_chamber');

    // Show intro
    showIntro();

    // Setup input handlers
    setupInput();

    // Setup splash screen
    setupSplash();

    // Start game loop
    gameLoop();
}

/**
 * Handle splash screen dismissal
 */
function setupSplash() {
    const splash = document.getElementById('splash-screen');
    let dismissed = false;

    function dismiss() {
        if (dismissed) return;
        dismissed = true;
        splash.classList.add('hidden');
        setTimeout(() => { splash.style.display = 'none'; }, 400);
        commandInput.focus();
        document.removeEventListener('keydown', onKey);
    }

    function onKey(e) {
        // Ignore modifier-only keys
        if (['Shift', 'Control', 'Alt', 'Meta'].includes(e.key)) return;
        dismiss();
    }

    document.addEventListener('keydown', onKey);
    splash.addEventListener('click', dismiss);
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

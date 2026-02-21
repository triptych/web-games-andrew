// Command parser for text adventure

import { CONFIG } from './config.js';
import { Inventory } from './inventory.js';
import { getItem, getItemName } from '../data/items.js';

export class Parser {
    constructor(world, textEngine, npcSystem = null, saveSystem = null, onRestart = null) {
        this.world = world;
        this.textEngine = textEngine;
        this.inventory = new Inventory(); // Player inventory system
        this.npcSystem = npcSystem;
        this.saveSystem = saveSystem;
        this.onRestart = onRestart;
        this._pendingRestart = false;
        this.commands = this.initCommands();
    }

    /**
     * Parse and execute player command
     */
    parse(input) {
        if (!input || input.trim() === '') {
            return;
        }

        // Convert to lowercase and trim
        const cleanInput = input.trim().toLowerCase();
        
        // Split into tokens
        const tokens = cleanInput.split(/\s+/);
        const command = tokens[0];
        const args = tokens.slice(1);

        // Check for alias
        const actualCommand = CONFIG.ALIASES[command] || command;

        // Execute command
        if (this.commands[actualCommand]) {
            this.commands[actualCommand](args);
        } else {
            this.textEngine.printError(`I don't understand "${input}".`);
            this.textEngine.printSystem("Type HELP for a list of commands.");
        }
    }

    /**
     * Initialize command handlers
     */
    initCommands() {
        return {
            'look': () => this.look(),
            'examine': (args) => this.examine(args),
            'north': () => this.go(['north']),
            'south': () => this.go(['south']),
            'east': () => this.go(['east']),
            'west': () => this.go(['west']),
            'northeast': () => this.go(['northeast']),
            'northwest': () => this.go(['northwest']),
            'southeast': () => this.go(['southeast']),
            'southwest': () => this.go(['southwest']),
            'up': () => this.go(['up']),
            'down': () => this.go(['down']),
            'in': () => this.go(['in']),
            'out': () => this.go(['out']),
            'go': (args) => this.go(args),
            'take': (args) => this.take(args),
            'drop': (args) => this.drop(args),
            'use': (args) => this.use(args),
            'combine': (args) => this.combine(args),
            'equip': (args) => this.equip(args),
            'unequip': (args) => this.unequip(args),
            'inventory': () => this.showInventory(),
            'talk': (args) => this.talk(args),
            'ask': (args) => this.ask(args),
            'give': (args) => this.give(args),
            'save': (args) => this.saveGame(args),
            'load': (args) => this.loadGame(args),
            'saves': () => this.showSaves(),
            'restart': () => this.restartGame(),
            'help': () => this.showHelp(),
            'quit': () => this.quit(),
            'clear': () => this.clear()
        };
    }

    /**
     * LOOK - Examine current room
     */
    look() {
        const description = this.world.getRoomDescription(true);
        this.textEngine.print(description);
    }

    /**
     * EXAMINE - Look at something closely
     */
    examine(args) {
        if (args.length === 0) {
            this.textEngine.printError("What do you want to examine?");
            return;
        }

        const searchTerm = args.join(' ');

        // Try to find item in inventory first
        const invItemId = this.inventory.findItemByName(searchTerm);
        if (invItemId) {
            const result = this.inventory.getItemDescription(invItemId);
            if (result.success) {
                this.textEngine.print(result.message);
                return;
            }
        }

        // Check room items
        const roomItems = this.world.getRoomItems();
        for (const itemId of roomItems) {
            const item = getItem(itemId);
            if (item && (item.id === searchTerm ||
                         item.name.toLowerCase().includes(searchTerm) ||
                         item.name.toLowerCase().replace(/\s+/g, '_') === searchTerm)) {
                this.textEngine.print(item.description);
                return;
            }
        }

        // Check room's examinable objects (scenery, hidden features)
        const examinableResult = this.world.examineObject(searchTerm);
        if (examinableResult) {
            this.textEngine.print(examinableResult.description);
            if (examinableResult.revealedExit) {
                this.textEngine.printSystem(`A hidden passage to the ${examinableResult.revealedExit} has been revealed!`);
            }
            return;
        }

        this.textEngine.printError(`You don't see any ${searchTerm} here.`);
    }

    /**
     * GO - Move in a direction
     */
    go(args) {
        if (args.length === 0) {
            this.textEngine.printError("Go where? Try: GO NORTH, GO SOUTH, etc.");
            return;
        }

        const direction = args[0];
        const result = this.world.move(direction);

        if (result.success) {
            this.textEngine.print(result.message);
        } else {
            this.textEngine.printError(result.message);
        }
    }

    /**
     * TAKE - Pick up an item
     */
    take(args) {
        if (args.length === 0) {
            this.textEngine.printError("What do you want to take?");
            return;
        }

        const searchTerm = args.join(' ');
        const roomItems = this.world.getRoomItems();
        
        // Find item in room
        for (const itemId of roomItems) {
            const item = getItem(itemId);
            if (item && (item.id === searchTerm || 
                         item.name.toLowerCase().includes(searchTerm) ||
                         item.name.toLowerCase().replace(/\s+/g, '_') === searchTerm)) {
                
                const result = this.inventory.addItem(itemId);
                if (result.success) {
                    this.world.removeItemFromRoom(itemId);
                    this.textEngine.print(result.message);
                } else {
                    this.textEngine.printError(result.message);
                }
                return;
            }
        }

        this.textEngine.printError(`You don't see any ${searchTerm} here.`);
    }

    /**
     * DROP - Drop an item from inventory
     */
    drop(args) {
        if (args.length === 0) {
            this.textEngine.printError("What do you want to drop?");
            return;
        }

        const searchTerm = args.join(' ');
        const itemId = this.inventory.findItemByName(searchTerm);
        
        if (!itemId) {
            this.textEngine.printError(`You don't have any ${searchTerm}.`);
            return;
        }

        const result = this.inventory.removeItem(itemId);
        if (result.success) {
            this.world.addItemToRoom(itemId);
            this.textEngine.print(result.message);
        } else {
            this.textEngine.printError(result.message);
        }
    }

    /**
     * INVENTORY - Show what player is carrying
     */
    showInventory() {
        const invList = this.inventory.getInventoryList();
        this.textEngine.print(invList);
    }

    /**
     * USE - Use an item
     */
    use(args) {
        if (args.length === 0) {
            this.textEngine.printError("What do you want to use?");
            return;
        }

        // Parse "USE item ON target" or "USE item"
        const argStr = args.join(' ');
        const onIndex = argStr.indexOf(' on ');
        
        let itemSearch, targetSearch;
        if (onIndex > -1) {
            itemSearch = argStr.substring(0, onIndex);
            targetSearch = argStr.substring(onIndex + 4);
        } else {
            itemSearch = argStr;
            targetSearch = null;
        }

        const itemId = this.inventory.findItemByName(itemSearch);
        if (!itemId) {
            this.textEngine.printError(`You don't have any ${itemSearch}.`);
            return;
        }

        // If targeting something in room
        let targetId = null;
        if (targetSearch) {
            const roomItems = this.world.getRoomItems();
            for (const id of roomItems) {
                const item = getItem(id);
                if (item && (item.id === targetSearch || 
                             item.name.toLowerCase().includes(targetSearch) ||
                             item.name.toLowerCase().replace(/\s+/g, '_') === targetSearch)) {
                    targetId = id;
                    break;
                }
            }

            if (!targetId) {
                this.textEngine.printError(`You don't see any ${targetSearch} here.`);
                return;
            }
        }

        const result = this.inventory.useItem(itemId, targetId);

        if (result.success) {
            // handleItemUse returns true if it printed its own message (special interaction)
            const specialHandled = this.handleItemUse(itemId, targetId || result.target || null);
            if (!specialHandled) {
                this.textEngine.print(result.message);
            }

            if (result.effect) {
                this.handleItemEffect(result.effect);
            }
        } else {
            this.textEngine.printError(result.message);
        }
    }

    /**
     * COMBINE - Combine two items
     */
    combine(args) {
        if (args.length < 3) {
            this.textEngine.printError("Usage: COMBINE item1 WITH item2");
            return;
        }

        const argStr = args.join(' ');
        const withIndex = argStr.indexOf(' with ');
        
        if (withIndex === -1) {
            this.textEngine.printError("Usage: COMBINE item1 WITH item2");
            return;
        }

        const item1Search = argStr.substring(0, withIndex);
        const item2Search = argStr.substring(withIndex + 6);

        const item1Id = this.inventory.findItemByName(item1Search);
        const item2Id = this.inventory.findItemByName(item2Search);

        if (!item1Id) {
            this.textEngine.printError(`You don't have any ${item1Search}.`);
            return;
        }

        if (!item2Id) {
            this.textEngine.printError(`You don't have any ${item2Search}.`);
            return;
        }

        const result = this.inventory.combineItems(item1Id, item2Id);
        
        if (result.success) {
            this.textEngine.print(result.message);
        } else {
            this.textEngine.printError(result.message);
        }
    }

    /**
     * EQUIP - Equip an item
     */
    equip(args) {
        if (args.length === 0) {
            this.textEngine.printError("What do you want to equip?");
            return;
        }

        const searchTerm = args.join(' ');
        const itemId = this.inventory.findItemByName(searchTerm);
        
        if (!itemId) {
            this.textEngine.printError(`You don't have any ${searchTerm}.`);
            return;
        }

        const result = this.inventory.equip(itemId);
        
        if (result.success) {
            this.textEngine.print(result.message);
        } else {
            this.textEngine.printError(result.message);
        }
    }

    /**
     * UNEQUIP - Unequip an item
     */
    unequip(args) {
        if (args.length === 0) {
            this.textEngine.printError("What do you want to unequip?");
            return;
        }

        const searchTerm = args.join(' ');
        const itemId = this.inventory.findItemByName(searchTerm);
        
        if (!itemId) {
            this.textEngine.printError(`You don't have any ${searchTerm}.`);
            return;
        }

        const result = this.inventory.unequip(itemId);
        
        if (result.success) {
            this.textEngine.print(result.message);
        } else {
            this.textEngine.printError(result.message);
        }
    }

    /**
     * TALK - Initiate conversation with an NPC
     * Accepts: "TALK [name]" or "TALK TO [name]"
     */
    talk(args) {
        if (!this.npcSystem) {
            this.textEngine.printError("There is no one to talk to.");
            return;
        }

        if (args.length === 0) {
            this.textEngine.printError("Talk to whom? Try: TALK TO [name]");
            return;
        }

        // Strip leading "to" if present
        const effectiveArgs = args[0] === 'to' ? args.slice(1) : args;
        const npcSearch = effectiveArgs.join(' ');

        if (!npcSearch) {
            this.textEngine.printError("Talk to whom? Try: TALK TO [name]");
            return;
        }

        const npcId = this.npcSystem.findNPCByName(npcSearch);
        if (!npcId) {
            this.textEngine.printError(`You don't see anyone called "${npcSearch}" here.`);
            return;
        }

        this.npcSystem.talkTo(npcId, this.world.currentRoomId, this.textEngine);
    }

    /**
     * ASK - Ask an NPC about a topic
     * Accepts: "ASK [name] ABOUT [topic]"
     */
    ask(args) {
        if (!this.npcSystem) {
            this.textEngine.printError("There is no one to ask.");
            return;
        }

        const argStr = args.join(' ');
        const aboutIndex = argStr.indexOf(' about ');

        if (aboutIndex === -1) {
            this.textEngine.printError("Usage: ASK [name] ABOUT [topic]");
            return;
        }

        const npcSearch = argStr.substring(0, aboutIndex).trim();
        const topic = argStr.substring(aboutIndex + 7).trim(); // ' about '.length === 7

        if (!npcSearch || !topic) {
            this.textEngine.printError("Usage: ASK [name] ABOUT [topic]");
            return;
        }

        const npcId = this.npcSystem.findNPCByName(npcSearch);
        if (!npcId) {
            this.textEngine.printError(`You don't see anyone called "${npcSearch}" here.`);
            return;
        }

        this.npcSystem.askAbout(npcId, topic, this.world.currentRoomId, this.textEngine);
    }

    /**
     * GIVE - Give an item to an NPC
     * Accepts: "GIVE [item] TO [name]"
     */
    give(args) {
        if (!this.npcSystem) {
            this.textEngine.printError("There is no one to give things to.");
            return;
        }

        const argStr = args.join(' ');
        const toIndex = argStr.indexOf(' to ');

        if (toIndex === -1) {
            this.textEngine.printError("Usage: GIVE [item] TO [name]");
            return;
        }

        const itemSearch = argStr.substring(0, toIndex).trim();
        const npcSearch = argStr.substring(toIndex + 4).trim(); // ' to '.length === 4

        if (!itemSearch || !npcSearch) {
            this.textEngine.printError("Usage: GIVE [item] TO [name]");
            return;
        }

        const itemId = this.inventory.findItemByName(itemSearch);
        if (!itemId) {
            this.textEngine.printError(`You don't have any ${itemSearch}.`);
            return;
        }

        const npcId = this.npcSystem.findNPCByName(npcSearch);
        if (!npcId) {
            this.textEngine.printError(`You don't see anyone called "${npcSearch}" here.`);
            return;
        }

        this.npcSystem.giveItem(npcId, itemId, this.world.currentRoomId, this.inventory, this.world, this.textEngine);
    }

    /**
     * SAVE [slot] — persist game state
     */
    saveGame(args) {
        if (!this.saveSystem) {
            this.textEngine.printError("Save system unavailable.");
            return;
        }
        const slot = args.length > 0 ? parseInt(args[0], 10) : 1;
        if (isNaN(slot)) {
            this.textEngine.printError("Usage: SAVE [1-3]");
            return;
        }
        const result = this.saveSystem.save(slot);
        if (result.success) {
            this.textEngine.printSystem(result.message);
        } else {
            this.textEngine.printError(result.message);
        }
    }

    /**
     * LOAD [slot] — list saves or restore a save
     */
    loadGame(args) {
        if (!this.saveSystem) {
            this.textEngine.printError("Save system unavailable.");
            return;
        }
        if (args.length === 0) {
            this.showSaves();
            return;
        }
        const slot = parseInt(args[0], 10);
        if (isNaN(slot)) {
            this.textEngine.printError("Usage: LOAD [1-3]");
            return;
        }
        const result = this.saveSystem.load(slot);
        if (result.success) {
            this.textEngine.printSystem(result.message);
            this.textEngine.print('', { instant: true });
            this.look(); // Show room after loading
        } else {
            this.textEngine.printError(result.message);
        }
    }

    /**
     * SAVES — list all save slots
     */
    showSaves() {
        if (!this.saveSystem) {
            this.textEngine.printError("Save system unavailable.");
            return;
        }
        this.textEngine.printSystem(this.saveSystem.listSaves());
    }

    /**
     * RESTART — reload the game (two-step confirmation)
     */
    restartGame() {
        if (!this._pendingRestart) {
            this.textEngine.printSystem("Type RESTART again to confirm. All unsaved progress will be lost.");
            this._pendingRestart = true;
            setTimeout(() => { this._pendingRestart = false; }, 8000);
        } else {
            if (this.onRestart) {
                this.onRestart();
            } else {
                window.location.reload();
            }
        }
    }

    /**
     * HELP - Show available commands
     */
    showHelp() {
        const helpText = `
========================================
AVAILABLE COMMANDS
========================================

MOVEMENT:
  NORTH, SOUTH, EAST, WEST (or N, S, E, W)
  UP, DOWN, IN, OUT
  GO [direction]

ACTIONS:
  LOOK (or L) - Look around current room
  EXAMINE [item] (or X) - Examine something closely
  TAKE [item] (or GET) - Pick up an item
  DROP [item] - Drop an item
  USE [item] - Use an item
  USE [item] ON [target] - Use item on something
  COMBINE [item1] WITH [item2] - Combine items
  EQUIP [item] - Equip a weapon or tool
  UNEQUIP [item] - Unequip an item
  INVENTORY (or I) - Show what you're carrying

NPCs:
  TALK TO [name] - Start a conversation
  ASK [name] ABOUT [topic] - Ask about a subject
  GIVE [item] TO [name] - Give an item to someone

SYSTEM:
  SAVE [slot]  - Save game (slot 1-3, default 1)
  LOAD [slot]  - Load save (no slot = list saves)
  SAVES        - List all save slots
  RESTART      - Restart from the beginning
  HELP         - Show this help text
  CLEAR        - Clear the screen
  QUIT         - Exit the game

========================================
TIP: You can click anywhere or press 
SPACE to skip text animations.
========================================
        `.trim();
        
        this.textEngine.print(helpText, { instant: true });
    }

    /**
     * QUIT - Exit the game
     */
    quit() {
        this.textEngine.print("Thanks for playing! Refresh the page to start again.", { instant: true });
    }

    /**
     * CLEAR - Clear the screen
     */
    clear() {
        this.textEngine.clear();
        this.textEngine.printSystem("Screen cleared. Type LOOK to see where you are.");
    }

    /**
     * Handle special item use cases.
     * Returns true if the interaction was handled (and printed its own message),
     * false if no special handling occurred (generic message will be shown).
     */
    handleItemUse(itemId, targetId) {
        const room = this.world.getCurrentRoom();

        // --- Rusty sword on wooden crate ---
        if (itemId === 'rusty_sword' && targetId === 'wooden_crate') {
            if (this.world.isItemInRoom('wooden_crate')) {
                this.textEngine.print("You pry open the wooden crate with the rusty sword. The lid splinters away. Inside, you find a healing potion!");
                this.world.removeItemFromRoom('wooden_crate');
                this.world.addItemToRoom('healing_potion');
                return true;
            }
        }

        // --- Iron key: unlocks current room's locked exit ---
        if (itemId === 'iron_key') {
            if (room && room.locked && room.locked.requiresKey === 'iron_key') {
                this.world.unlockExit(room.locked.direction);
                this.textEngine.print("You insert the iron key into the lock. It turns with a satisfying clunk, and the door swings open with a creak.");
                return true;
            }
            this.textEngine.print("You look around for a matching lock, but there is none here.");
            return true;
        }

        // --- Bronze key: unlocks current room's locked exit ---
        if (itemId === 'bronze_key') {
            if (room && room.locked && room.locked.requiresKey === 'bronze_key') {
                this.world.unlockExit(room.locked.direction);
                this.textEngine.print("The crescent-moon bow of the bronze key fits the crescent-shaped lock perfectly. It turns with a deep, resonant click and the door groans open.");
                return true;
            }
            this.textEngine.print("You look around for a crescent-shaped lock, but there is none here.");
            return true;
        }

        // --- Rope and hook: climb to upper balcony from library ---
        if (itemId === 'rope_and_hook') {
            if (room && room.id === 'library') {
                if (room.locked && room.locked.direction === 'north') {
                    this.world.unlockExit('north');
                    this.textEngine.print("You swing the grappling hook upward toward the high window. The first two throws miss, but on the third, the hook catches firmly on the ledge above with a satisfying clang. You tug the rope — it holds. A makeshift ladder to the upper balcony!");
                    return true;
                }
                this.textEngine.print("The rope and hook are already secured to the ledge above.");
                return true;
            }
            // Not in library — no special handling
            return false;
        }

        // --- Ancient lantern: equip reminder ---
        if (itemId === 'ancient_lantern') {
            this.textEngine.print("The ancient lantern glows with a steady warm light. Make sure to EQUIP it to use it as a light source in dark areas.");
            return true;
        }

        // --- Old torch: equip reminder ---
        if (itemId === 'old_torch') {
            this.textEngine.print("The torch flickers with a warm flame. Make sure to EQUIP it to use it as a light source in dark areas.");
            return true;
        }

        return false; // No special handling
    }

    /**
     * Handle item effects (healing, buffs, etc.)
     */
    handleItemEffect(effect) {
        const [type, value] = effect.split(':');
        
        if (type === 'heal') {
            this.textEngine.print(`You feel refreshed! (+${value} HP)`);
            // HP system would be implemented in Phase 6
        }
    }

    /**
     * Check if player has a light source (for dark rooms)
     */
    hasLightSource() {
        return this.inventory.hasLightSource();
    }
}

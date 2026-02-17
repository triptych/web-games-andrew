// Command parser for text adventure

import { CONFIG } from './config.js';
import { Inventory } from './inventory.js';
import { getItem, getItemName } from '../data/items.js';

export class Parser {
    constructor(world, textEngine) {
        this.world = world;
        this.textEngine = textEngine;
        this.inventory = new Inventory(); // Player inventory system
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
            this.textEngine.print(result.message);
            
            // Handle special cases
            if (result.target) {
                this.handleItemUse(itemId, result.target);
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

SYSTEM:
  HELP - Show this help text
  CLEAR - Clear the screen
  QUIT - Exit the game

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
     * Handle special item use cases
     */
    handleItemUse(itemId, targetId) {
        const item = getItem(itemId);
        const target = getItem(targetId);

        // Using sword on wooden crate
        if (itemId === 'rusty_sword' && targetId === 'wooden_crate') {
            const crateItem = this.world.getRoomItems().find(id => id === 'wooden_crate');
            if (crateItem) {
                this.textEngine.print("You pry open the wooden crate with the rusty sword. Inside, you find a healing potion!");
                this.world.removeItemFromRoom('wooden_crate');
                this.world.addItemToRoom('healing_potion');
            }
        }

        // Using iron key on locked door
        if (itemId === 'iron_key') {
            const room = this.world.getCurrentRoom();
            if (room && room.locked) {
                this.world.unlockExit(room.locked.direction);
                this.textEngine.print("You unlock the door with the iron key. It swings open with a creak.");
            }
        }
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

// World and room management system

import { getItem, getItemName } from '../data/items.js';

export class World {
    constructor(roomData) {
        this.rooms = new Map();
        this.currentRoomId = null;
        this.inventory = null; // Will be set by parser
        this.npcSystem = null; // Will be set by main
        this.initRooms(roomData);
    }

    /**
     * Set inventory reference for light source checking
     */
    setInventory(inventory) {
        this.inventory = inventory;
    }

    /**
     * Set NPC system reference for room descriptions
     */
    setNPCSystem(npcSystem) {
        this.npcSystem = npcSystem;
    }

    /**
     * Initialize rooms from data
     */
    initRooms(roomData) {
        roomData.forEach(room => {
            this.rooms.set(room.id, {
                ...room,
                visited: false,
                items: room.items || [],
                npcs: room.npcs || []
            });
        });
    }

    /**
     * Set starting room
     */
    setStartRoom(roomId) {
        if (this.rooms.has(roomId)) {
            this.currentRoomId = roomId;
            const room = this.rooms.get(roomId);
            room.visited = true;
            return true;
        }
        return false;
    }

    /**
     * Get current room
     */
    getCurrentRoom() {
        return this.rooms.get(this.currentRoomId);
    }

    /**
     * Get room by ID
     */
    getRoom(roomId) {
        return this.rooms.get(roomId);
    }

    /**
     * Get current room description
     */
    getRoomDescription(forceLong = false) {
        const room = this.getCurrentRoom();
        if (!room) return "You are nowhere.";

        // Check if room is dark and player has no light
        if (room.dark && this.inventory && !this.inventory.hasLightSource()) {
            return "It is pitch black. You can't see anything. You need a light source.";
        }

        // Use long description on first visit or when forced (LOOK command)
        const useShort = room.visited && !forceLong && room.shortDescription;
        const description = useShort ? room.shortDescription : room.description;

        // Build full description with items and exits
        let fullDesc = description;

        // Collect items and NPCs for "You can see:" section
        const visibleThings = [];

        room.items.forEach(itemId => {
            const item = getItem(itemId);
            visibleThings.push(item ? item.name : itemId);
        });

        if (this.npcSystem) {
            const npcsHere = this.npcSystem.getNPCsInRoom(this.currentRoomId);
            npcsHere.forEach(npc => {
                visibleThings.push(`${npc.name} (TALK TO ${npc.shortName.toUpperCase()})`);
            });
        }

        if (visibleThings.length > 0) {
            fullDesc += "\n\nYou can see:";
            visibleThings.forEach(thing => {
                fullDesc += `\n  - ${thing}`;
            });
        }

        // Add visible exits
        if (room.exits && Object.keys(room.exits).length > 0) {
            fullDesc += "\n\nExits:";
            const exitNames = Object.keys(room.exits).join(', ');
            fullDesc += ` ${exitNames}`;
        }

        return fullDesc;
    }

    /**
     * Attempt to move in a direction
     */
    move(direction) {
        const room = this.getCurrentRoom();
        if (!room) {
            return { success: false, message: "You are nowhere." };
        }

        // Check if exit exists
        if (!room.exits || !room.exits[direction]) {
            return { 
                success: false, 
                message: `You can't go ${direction} from here.` 
            };
        }

        // Check if exit is locked
        if (room.locked && room.locked.direction === direction) {
            // Use custom message if provided, otherwise show item name
            if (room.locked.message) {
                return { success: false, message: room.locked.message };
            }
            const keyName = getItemName(room.locked.requiresKey);
            return {
                success: false,
                message: `The way ${direction} is locked. You need ${keyName}.`
            };
        }

        // Move to new room
        const newRoomId = room.exits[direction];
        const newRoom = this.rooms.get(newRoomId);

        if (!newRoom) {
            return {
                success: false,
                message: "Something went wrong. That room doesn't exist."
            };
        }

        // Check if new room is dark and player has no light
        if (newRoom.dark && !this.hasLight()) {
            return {
                success: false,
                message: "It is pitch black. You need a light source to go that way."
            };
        }

        // Successfully move
        this.currentRoomId = newRoomId;
        if (!newRoom.visited) {
            newRoom.visited = true;
        }

        return {
            success: true,
            message: this.getRoomDescription()
        };
    }

    /**
     * Check if player has light source
     */
    hasLight() {
        return this.inventory ? this.inventory.hasLightSource() : true;
    }

    /**
     * Add item to current room
     */
    addItemToRoom(itemId) {
        const room = this.getCurrentRoom();
        if (room && !room.items.includes(itemId)) {
            room.items.push(itemId);
        }
    }

    /**
     * Remove item from current room
     */
    removeItemFromRoom(itemId) {
        const room = this.getCurrentRoom();
        if (room) {
            const index = room.items.indexOf(itemId);
            if (index > -1) {
                room.items.splice(index, 1);
                return true;
            }
        }
        return false;
    }

    /**
     * Check if item is in current room
     */
    isItemInRoom(itemId) {
        const room = this.getCurrentRoom();
        return room && room.items.includes(itemId);
    }

    /**
     * Unlock a direction in current room
     */
    unlockExit(direction) {
        const room = this.getCurrentRoom();
        if (room && room.locked && room.locked.direction === direction) {
            room.locked = null;
            return true;
        }
        return false;
    }

    /**
     * Get list of items in current room
     */
    getRoomItems() {
        const room = this.getCurrentRoom();
        return room ? [...room.items] : [];
    }

    /**
     * Get available exits from current room
     */
    getExits() {
        const room = this.getCurrentRoom();
        return room && room.exits ? Object.keys(room.exits) : [];
    }

    /**
     * Examine a named object in the current room's examinable list.
     * Returns { description, revealedExit? } or null if not found.
     * Reveals hidden exits if the object has a revealsExit property.
     */
    examineObject(searchTerm) {
        const room = this.getCurrentRoom();
        if (!room || !room.examinable) return null;

        const search = searchTerm.toLowerCase();

        for (const [key, obj] of Object.entries(room.examinable)) {
            const nameMatch = key.toLowerCase().includes(search);
            const aliasMatch = obj.aliases && obj.aliases.some(a => a.toLowerCase().includes(search));

            if (nameMatch || aliasMatch) {
                const result = { description: obj.description };

                // Reveal hidden exit if not already revealed
                if (obj.revealsExit && !obj.revealed) {
                    obj.revealed = true;
                    room.exits[obj.revealsExit.direction] = obj.revealsExit.roomId;
                    result.revealedExit = obj.revealsExit.direction;
                }

                return result;
            }
        }

        return null;
    }

    /**
     * Restore world state from a save (roomStates from SaveSystem._serializeWorld).
     * Re-initialises rooms from the original roomData then overlays saved state.
     */
    deserialize(roomStates, currentRoomId, roomData) {
        // Reset to original data
        this.initRooms(roomData);

        this.currentRoomId = currentRoomId;

        for (const [id, state] of Object.entries(roomStates)) {
            const room = this.rooms.get(id);
            if (!room) continue;

            room.visited = state.visited;
            room.items   = [...state.items];
            room.locked  = state.locked ? { ...state.locked } : null;

            // Re-apply revealed examinable exits
            if (state.examinableRevealed && room.examinable) {
                for (const [key, revealed] of Object.entries(state.examinableRevealed)) {
                    if (revealed && room.examinable[key]) {
                        room.examinable[key].revealed = true;
                        if (room.examinable[key].revealsExit) {
                            const { direction, roomId } = room.examinable[key].revealsExit;
                            room.exits[direction] = roomId;
                        }
                    }
                }
            }
        }
    }

    /**
     * Unlock an exit in any room by room ID and direction.
     * Used for items that unlock exits from a distance (e.g. rope_and_hook).
     */
    unlockExitInRoom(roomId, direction) {
        const room = this.rooms.get(roomId);
        if (room && room.locked && room.locked.direction === direction) {
            room.locked = null;
            return true;
        }
        return false;
    }
}

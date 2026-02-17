// World and room management system

import { getItem, getItemName } from '../data/items.js';

export class World {
    constructor(roomData) {
        this.rooms = new Map();
        this.currentRoomId = null;
        this.inventory = null; // Will be set by parser
        this.initRooms(roomData);
    }

    /**
     * Set inventory reference for light source checking
     */
    setInventory(inventory) {
        this.inventory = inventory;
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

        // Add items if any (show proper item names)
        if (room.items.length > 0) {
            fullDesc += "\n\nYou can see:";
            room.items.forEach(itemId => {
                const item = getItem(itemId);
                const itemName = item ? item.name : itemId;
                fullDesc += `\n  - ${itemName}`;
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
            const keyNeeded = room.locked.requiresKey;
            return {
                success: false,
                message: `The way ${direction} is locked. You need a ${keyNeeded}.`
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
}

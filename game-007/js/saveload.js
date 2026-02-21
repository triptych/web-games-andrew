// Save / Load system using localStorage

import { ROOMS } from '../data/rooms.js';

const SAVE_KEY_PREFIX = 'forgotten-temple-save-';
const SAVE_VERSION = 1;
export const NUM_SAVE_SLOTS = 3;

export class SaveSystem {
    constructor(world, inventory, npcSystem) {
        this.world = world;
        this.inventory = inventory;
        this.npcSystem = npcSystem;
    }

    /**
     * Save game state to a slot (1–NUM_SAVE_SLOTS)
     */
    save(slot = 1) {
        if (!this._validSlot(slot)) {
            return { success: false, message: `Invalid slot. Use 1–${NUM_SAVE_SLOTS}.` };
        }

        const room = this.world.getCurrentRoom();
        const roomName = room ? room.name : 'Unknown';

        const state = {
            version: SAVE_VERSION,
            savedAt: new Date().toISOString(),
            roomName,
            currentRoomId: this.world.currentRoomId,
            rooms: this._serializeWorld(),
            inventory: this.inventory.serialize(),
            npcs: this.npcSystem.serialize()
        };

        try {
            localStorage.setItem(this._key(slot), JSON.stringify(state));
            const ts = new Date().toLocaleString();
            return { success: true, message: `Saved to Slot ${slot} — ${roomName} [${ts}]` };
        } catch (e) {
            return { success: false, message: `Save failed: ${e.message}` };
        }
    }

    /**
     * Load game state from a slot
     */
    load(slot = 1) {
        if (!this._validSlot(slot)) {
            return { success: false, message: `Invalid slot. Use 1–${NUM_SAVE_SLOTS}.` };
        }

        const raw = localStorage.getItem(this._key(slot));
        if (!raw) {
            return { success: false, message: `Slot ${slot} is empty.` };
        }

        try {
            const state = JSON.parse(raw);
            if (state.version !== SAVE_VERSION) {
                return { success: false, message: `Slot ${slot} is from an incompatible save version.` };
            }

            // Restore all systems
            this.world.deserialize(state.rooms, state.currentRoomId, ROOMS);
            this.inventory.deserialize(state.inventory);
            this.npcSystem.deserialize(state.npcs);

            const savedAt = new Date(state.savedAt).toLocaleString();
            return {
                success: true,
                message: `Loaded Slot ${slot} — ${state.roomName} [Saved: ${savedAt}]`
            };
        } catch (e) {
            return { success: false, message: `Load failed: ${e.message}` };
        }
    }

    /**
     * Return a formatted multi-line list of save slots
     */
    listSaves() {
        const lines = [`Save Slots:`];
        for (let i = 1; i <= NUM_SAVE_SLOTS; i++) {
            const raw = localStorage.getItem(this._key(i));
            if (raw) {
                try {
                    const state = JSON.parse(raw);
                    const savedAt = new Date(state.savedAt).toLocaleString();
                    lines.push(`  Slot ${i}: ${state.roomName || state.currentRoomId} | ${savedAt}`);
                } catch {
                    lines.push(`  Slot ${i}: (corrupted)`);
                }
            } else {
                lines.push(`  Slot ${i}: (empty)`);
            }
        }
        lines.push(`Type LOAD [1-${NUM_SAVE_SLOTS}] to load, SAVE [1-${NUM_SAVE_SLOTS}] to save.`);
        return lines.join('\n');
    }

    hasSave(slot) {
        return localStorage.getItem(this._key(slot)) !== null;
    }

    // ── Private helpers ────────────────────────────────────────────────────────

    _key(slot) { return `${SAVE_KEY_PREFIX}${slot}`; }

    _validSlot(slot) { return Number.isInteger(slot) && slot >= 1 && slot <= NUM_SAVE_SLOTS; }

    /**
     * Capture mutable world state (visited flags, items, locks, revealed exits)
     */
    _serializeWorld() {
        const roomStates = {};
        for (const [id, room] of this.world.rooms) {
            const examinableRevealed = {};
            if (room.examinable) {
                for (const [key, obj] of Object.entries(room.examinable)) {
                    if (obj.revealed) examinableRevealed[key] = true;
                }
            }
            roomStates[id] = {
                visited: room.visited,
                items: [...room.items],
                locked: room.locked ? { ...room.locked } : null,
                examinableRevealed
            };
        }
        return roomStates;
    }
}

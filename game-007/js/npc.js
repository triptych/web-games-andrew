// NPC system - dialogue, trading, and NPC state management

import { NPCS } from '../data/npcs.js';
import { getItemName } from '../data/items.js';

export class NPCSystem {
    constructor(npcData) {
        this.npcs = new Map();
        this.npcStates = new Map();
        this.initNPCs(npcData);
    }

    /**
     * Initialize NPCs from data, separating static data from mutable state
     */
    initNPCs(npcData) {
        Object.values(npcData).forEach(npc => {
            this.npcs.set(npc.id, { ...npc });
            this.npcStates.set(npc.id, {
                talkedTo: false,
                itemsGiven: new Set()
            });
        });
    }

    /**
     * Get all NPCs in a given room
     */
    getNPCsInRoom(roomId) {
        const result = [];
        for (const npc of this.npcs.values()) {
            if (npc.location === roomId) {
                result.push(npc);
            }
        }
        return result;
    }

    /**
     * Find NPC by partial name match
     */
    findNPCByName(searchName) {
        const search = searchName.toLowerCase().trim();
        for (const [id, npc] of this.npcs) {
            if (
                id === search ||
                id.includes(search) ||
                npc.name.toLowerCase().includes(search) ||
                npc.shortName.toLowerCase().includes(search) ||
                npc.shortName.toLowerCase() === search
            ) {
                return id;
            }
        }
        return null;
    }

    /**
     * Handle TALK TO [npc] command
     */
    talkTo(npcId, currentRoomId, textEngine) {
        const npc = this.npcs.get(npcId);
        if (!npc) {
            textEngine.printError("There is no one here by that name.");
            return false;
        }

        if (npc.location !== currentRoomId) {
            textEngine.printError(`${npc.name} is not here.`);
            return false;
        }

        const state = this.npcStates.get(npcId);

        // Print NPC name header
        textEngine.printNPCName(`[ ${npc.name} ]`);

        // Show greeting
        const greeting = state.talkedTo
            ? npc.dialogue.greeting_repeat
            : npc.dialogue.greeting;
        textEngine.printNPC(greeting);

        // Mark as talked to
        state.talkedTo = true;

        // Show available topics hint
        const topicKeys = Object.keys(npc.dialogue.topics);
        const topicList = topicKeys.map(t => t.toUpperCase()).join(', ');
        textEngine.printSystem(`You can ASK ${npc.shortName.toUpperCase()} ABOUT: ${topicList}`);
        textEngine.printSystem(`Or: GIVE [item] TO ${npc.shortName.toUpperCase()}`);

        return true;
    }

    /**
     * Handle ASK [npc] ABOUT [topic] command
     */
    askAbout(npcId, topic, currentRoomId, textEngine) {
        const npc = this.npcs.get(npcId);
        if (!npc) {
            textEngine.printError("There is no one here by that name.");
            return;
        }

        if (npc.location !== currentRoomId) {
            textEngine.printError(`${npc.name} is not here.`);
            return;
        }

        const state = this.npcStates.get(npcId);

        // Auto-greet if not yet talked to
        if (!state.talkedTo) {
            this.talkTo(npcId, currentRoomId, textEngine);
            textEngine.print('', { instant: true });
        }

        // Find matching topic
        const matchedTopic = this.findTopic(npc, topic);

        textEngine.printNPCName(`[ ${npc.name} ]`);

        if (matchedTopic) {
            textEngine.printNPC(npc.dialogue.topics[matchedTopic].text);
        } else {
            textEngine.printNPC(npc.dialogue.unknown_topic);
        }
    }

    /**
     * Find a topic by keyword matching
     */
    findTopic(npc, searchTerm) {
        const search = searchTerm.toLowerCase().trim();

        for (const [key, topic] of Object.entries(npc.dialogue.topics)) {
            // Match topic key directly
            if (key.toLowerCase() === search || key.toLowerCase().includes(search)) {
                return key;
            }
            // Match any keyword
            if (topic.keywords && topic.keywords.some(k => k.toLowerCase().includes(search))) {
                return key;
            }
        }
        return null;
    }

    /**
     * Handle GIVE [item] TO [npc] command
     */
    giveItem(npcId, itemId, currentRoomId, inventory, world, textEngine) {
        const npc = this.npcs.get(npcId);
        if (!npc) {
            textEngine.printError("There is no one here by that name.");
            return;
        }

        if (npc.location !== currentRoomId) {
            textEngine.printError(`${npc.name} is not here.`);
            return;
        }

        if (!inventory.hasItem(itemId)) {
            textEngine.printError(`You don't have a ${getItemName(itemId)}.`);
            return;
        }

        const state = this.npcStates.get(npcId);

        // Auto-greet if not yet talked to
        if (!state.talkedTo) {
            this.talkTo(npcId, currentRoomId, textEngine);
            textEngine.print('', { instant: true });
        }

        textEngine.printNPCName(`[ ${npc.name} ]`);

        const giveKey = `give_${itemId}`;

        if (npc.dialogue[giveKey] && !state.itemsGiven.has(itemId)) {
            // Remove item from player inventory
            inventory.removeItem(itemId);
            state.itemsGiven.add(itemId);

            // Handle any special rewards before showing dialogue
            this.handleGiveReward(npcId, itemId, inventory, world, textEngine);

            // Show NPC response
            textEngine.printNPC(npc.dialogue[giveKey]);
        } else if (state.itemsGiven.has(itemId)) {
            textEngine.printNPC("You have already given me that.");
        } else {
            textEngine.printNPC(npc.dialogue.give_generic);
        }
    }

    /**
     * Handle special rewards for giving specific items to NPCs
     */
    handleGiveReward(npcId, itemId, inventory, world, textEngine) {
        // Atem-Ra rewards the stone tablet with the Moonfire Charm
        if (npcId === 'atem_ra' && itemId === 'stone_tablet') {
            const result = inventory.addItem('moonfire_charm');
            if (result.success) {
                textEngine.printSystem("You receive the Moonfire Charm.");
            }
        }
    }

    /**
     * Serialize NPC states for saving
     */
    serialize() {
        const states = {};
        for (const [id, state] of this.npcStates) {
            states[id] = {
                talkedTo: state.talkedTo,
                itemsGiven: [...state.itemsGiven]
            };
        }
        return states;
    }

    /**
     * Restore NPC states from a save
     */
    deserialize(data) {
        for (const [id, saved] of Object.entries(data)) {
            const state = this.npcStates.get(id);
            if (state) {
                state.talkedTo   = saved.talkedTo;
                state.itemsGiven = new Set(saved.itemsGiven);
            }
        }
    }

    /**
     * Check if an NPC exists in the system
     */
    hasNPC(npcId) {
        return this.npcs.has(npcId);
    }

    /**
     * Get NPC data
     */
    getNPC(npcId) {
        return this.npcs.get(npcId);
    }
}

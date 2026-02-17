// Inventory management system

import { getItem, getItemName, itemExists } from '../data/items.js';

export class Inventory {
    constructor(maxWeight = 50) {
        this.items = new Map(); // itemId -> item object
        this.maxWeight = maxWeight;
        this.equippedItems = new Set();
    }

    /**
     * Add item to inventory
     */
    addItem(itemId) {
        const item = getItem(itemId);
        if (!item) {
            return { success: false, message: `Unknown item: ${itemId}` };
        }

        if (!item.takeable) {
            return { success: false, message: `You can't take the ${item.name}.` };
        }

        // Check weight limit
        if (this.getTotalWeight() + item.weight > this.maxWeight) {
            return { 
                success: false, 
                message: `The ${item.name} is too heavy. You're carrying too much.` 
            };
        }

        // Add to inventory
        this.items.set(itemId, item);
        return { 
            success: true, 
            message: `You take the ${item.name}.` 
        };
    }

    /**
     * Remove item from inventory
     */
    removeItem(itemId) {
        if (!this.hasItem(itemId)) {
            return { 
                success: false, 
                message: `You don't have a ${getItemName(itemId)}.` 
            };
        }

        const item = this.items.get(itemId);
        
        // Unequip if equipped
        if (this.isEquipped(itemId)) {
            this.unequip(itemId);
        }

        this.items.delete(itemId);
        return { 
            success: true, 
            message: `You drop the ${item.name}.` 
        };
    }

    /**
     * Check if player has item
     */
    hasItem(itemId) {
        return this.items.has(itemId);
    }

    /**
     * Get item from inventory
     */
    getItem(itemId) {
        return this.items.get(itemId);
    }

    /**
     * Get all items in inventory
     */
    getAllItems() {
        return Array.from(this.items.values());
    }

    /**
     * Get all item IDs
     */
    getItemIds() {
        return Array.from(this.items.keys());
    }

    /**
     * Get inventory count
     */
    getItemCount() {
        return this.items.size;
    }

    /**
     * Get total weight of items
     */
    getTotalWeight() {
        let total = 0;
        for (const item of this.items.values()) {
            total += item.weight;
        }
        return Math.round(total * 10) / 10; // Round to 1 decimal
    }

    /**
     * Get total value of items
     */
    getTotalValue() {
        let total = 0;
        for (const item of this.items.values()) {
            total += item.value;
        }
        return total;
    }

    /**
     * Equip an item
     */
    equip(itemId) {
        if (!this.hasItem(itemId)) {
            return { 
                success: false, 
                message: `You don't have a ${getItemName(itemId)}.` 
            };
        }

        const item = this.items.get(itemId);
        
        if (!item.equippable) {
            return { 
                success: false, 
                message: `You can't equip the ${item.name}.` 
            };
        }

        if (this.isEquipped(itemId)) {
            return { 
                success: false, 
                message: `The ${item.name} is already equipped.` 
            };
        }

        // Unequip other items of same type
        if (item.type === 'weapon') {
            this.unequipType('weapon');
        }

        item.equipped = true;
        this.equippedItems.add(itemId);
        return { 
            success: true, 
            message: `You equip the ${item.name}.` 
        };
    }

    /**
     * Unequip an item
     */
    unequip(itemId) {
        if (!this.hasItem(itemId)) {
            return { 
                success: false, 
                message: `You don't have a ${getItemName(itemId)}.` 
            };
        }

        if (!this.isEquipped(itemId)) {
            return { 
                success: false, 
                message: `The ${getItemName(itemId)} is not equipped.` 
            };
        }

        const item = this.items.get(itemId);
        item.equipped = false;
        this.equippedItems.delete(itemId);
        return { 
            success: true, 
            message: `You unequip the ${item.name}.` 
        };
    }

    /**
     * Unequip all items of a certain type
     */
    unequipType(type) {
        for (const [itemId, item] of this.items) {
            if (item.type === type && this.isEquipped(itemId)) {
                this.unequip(itemId);
            }
        }
    }

    /**
     * Check if item is equipped
     */
    isEquipped(itemId) {
        return this.equippedItems.has(itemId);
    }

    /**
     * Get all equipped items
     */
    getEquippedItems() {
        return Array.from(this.equippedItems).map(id => this.items.get(id));
    }

    /**
     * Check if player has a light source
     */
    hasLightSource() {
        for (const item of this.items.values()) {
            if (item.providesLight && (!item.equippable || this.isEquipped(item.id))) {
                return true;
            }
        }
        return false;
    }

    /**
     * Use an item
     */
    useItem(itemId, target = null) {
        if (!this.hasItem(itemId)) {
            return { 
                success: false, 
                message: `You don't have a ${getItemName(itemId)}.` 
            };
        }

        const item = this.items.get(itemId);

        if (!item.usable) {
            return { 
                success: false, 
                message: `You can't use the ${item.name}.` 
            };
        }

        // Handle consumables
        if (item.consumable) {
            this.removeItem(itemId);
            return {
                success: true,
                message: `You consume the ${item.name}.`,
                effect: item.healAmount ? `heal:${item.healAmount}` : null
            };
        }

        // Handle items that need a target
        if (target) {
            if (item.useWith && item.useWith.includes(target)) {
                return {
                    success: true,
                    message: `You use the ${item.name} on the ${getItemName(target)}.`,
                    target: target
                };
            } else {
                return {
                    success: false,
                    message: `You can't use the ${item.name} on the ${getItemName(target)}.`
                };
            }
        }

        // Generic use
        return {
            success: true,
            message: `You use the ${item.name}.`
        };
    }

    /**
     * Combine two items
     */
    combineItems(itemId1, itemId2) {
        if (!this.hasItem(itemId1)) {
            return { 
                success: false, 
                message: `You don't have a ${getItemName(itemId1)}.` 
            };
        }

        if (!this.hasItem(itemId2)) {
            return { 
                success: false, 
                message: `You don't have a ${getItemName(itemId2)}.` 
            };
        }

        const item1 = this.items.get(itemId1);
        const item2 = this.items.get(itemId2);

        // Check if items can be combined
        if (item1.combinesWith && item1.combinesWith.includes(itemId2)) {
            const resultItemId = item1.combinesInto;
            const resultItem = getItem(resultItemId);

            if (!resultItem) {
                return {
                    success: false,
                    message: "Something went wrong with the combination."
                };
            }

            // Remove both items and add the result
            this.removeItem(itemId1);
            this.removeItem(itemId2);
            this.addItem(resultItemId);

            return {
                success: true,
                message: `You combine the ${item1.name} with the ${item2.name} to create ${resultItem.name}!`
            };
        }

        // Check reverse combination
        if (item2.combinesWith && item2.combinesWith.includes(itemId1)) {
            return this.combineItems(itemId2, itemId1);
        }

        return {
            success: false,
            message: `You can't combine the ${item1.name} with the ${item2.name}.`
        };
    }

    /**
     * Get a formatted inventory list
     */
    getInventoryList() {
        if (this.items.size === 0) {
            return "You are carrying nothing.";
        }

        let output = "You are carrying:\n";
        
        for (const item of this.items.values()) {
            const equipped = this.isEquipped(item.id) ? " (equipped)" : "";
            output += `  - ${item.name}${equipped}\n`;
        }

        output += `\nTotal weight: ${this.getTotalWeight()} / ${this.maxWeight} kg`;
        output += `\nTotal value: ${this.getTotalValue()} gold`;

        return output.trim();
    }

    /**
     * Get detailed item description
     */
    getItemDescription(itemId) {
        if (!this.hasItem(itemId)) {
            return { 
                success: false, 
                message: `You don't have a ${getItemName(itemId)}.` 
            };
        }

        const item = this.items.get(itemId);
        let description = item.description;

        // Add technical details
        description += `\n\nType: ${item.type}`;
        description += `\nWeight: ${item.weight} kg`;
        
        if (item.equippable) {
            const equippedStatus = this.isEquipped(itemId) ? "Yes" : "No";
            description += `\nEquipped: ${equippedStatus}`;
        }

        if (item.usable) {
            description += `\n\nYou can USE this item.`;
        }

        if (item.combinesWith && item.combinesWith.length > 0) {
            description += `\n\nThis item can be combined with other items.`;
        }

        return {
            success: true,
            message: description
        };
    }

    /**
     * Find item by partial name
     */
    findItemByName(searchName) {
        const search = searchName.toLowerCase();
        
        // Try exact ID match first
        if (this.hasItem(search)) {
            return search;
        }

        // Try to match item name
        for (const [itemId, item] of this.items) {
            if (item.name.toLowerCase().includes(search) || 
                item.name.toLowerCase().replace(/\s+/g, '_') === search) {
                return itemId;
            }
        }

        return null;
    }

    /**
     * Clear inventory
     */
    clear() {
        this.items.clear();
        this.equippedItems.clear();
    }

    /**
     * Serialize inventory for saving
     */
    serialize() {
        return {
            items: Array.from(this.items.keys()),
            equipped: Array.from(this.equippedItems),
            maxWeight: this.maxWeight
        };
    }

    /**
     * Restore inventory from save data
     */
    deserialize(data) {
        this.clear();
        this.maxWeight = data.maxWeight || 50;

        // Restore items
        if (data.items) {
            data.items.forEach(itemId => {
                const item = getItem(itemId);
                if (item) {
                    this.items.set(itemId, item);
                }
            });
        }

        // Restore equipped status
        if (data.equipped) {
            data.equipped.forEach(itemId => {
                if (this.hasItem(itemId)) {
                    const item = this.items.get(itemId);
                    item.equipped = true;
                    this.equippedItems.add(itemId);
                }
            });
        }
    }
}

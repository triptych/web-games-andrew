/**
 * Items System
 * Handles collectible items (health, ammo, power-ups)
 */

import { state } from './state.js';
import { addAmmo } from './weapons.js';
import { playSound } from './sounds.js';

// Item type definitions
export const ITEM_TYPES = {
    // Health items
    HEALTH_SMALL: {
        id: 'health_small',
        name: 'Small Health',
        type: 'health',
        amount: 10,
        color: [100, 255, 100], // Green
        size: 0.3,
        bobSpeed: 2, // Bobbing animation speed
        bobHeight: 0.1,
    },
    HEALTH_MEDIUM: {
        id: 'health_medium',
        name: 'Med Kit',
        type: 'health',
        amount: 25,
        color: [150, 255, 150], // Bright green
        size: 0.4,
        bobSpeed: 2,
        bobHeight: 0.12,
    },
    HEALTH_LARGE: {
        id: 'health_large',
        name: 'Large Health',
        type: 'health',
        amount: 50,
        color: [200, 255, 200], // Very bright green
        size: 0.5,
        bobSpeed: 2,
        bobHeight: 0.15,
    },

    // Ammo items
    AMMO_BULLETS: {
        id: 'ammo_bullets',
        name: 'Bullet Box',
        type: 'ammo',
        ammoType: 'bullets',
        amount: 20,
        color: [255, 200, 100], // Orange
        size: 0.3,
        bobSpeed: 2,
        bobHeight: 0.1,
    },
    AMMO_SHELLS: {
        id: 'ammo_shells',
        name: 'Shell Box',
        type: 'ammo',
        ammoType: 'shells',
        amount: 8,
        color: [255, 100, 100], // Red
        size: 0.3,
        bobSpeed: 2,
        bobHeight: 0.1,
    },
    AMMO_ROCKETS: {
        id: 'ammo_rockets',
        name: 'Rocket Crate',
        type: 'ammo',
        ammoType: 'rockets',
        amount: 4,
        color: [255, 255, 100], // Yellow
        size: 0.4,
        bobSpeed: 2,
        bobHeight: 0.12,
    },
};

// Item state
const itemState = {
    items: [], // All active items in the level
    pickupDistance: 0.5, // How close player needs to be to pick up
};

/**
 * Initialize items system
 */
export function initItems(k) {
    console.log('Items system initialized');
    itemState.items = [];
    state.items = itemState.items; // Store in global state for renderer
}

/**
 * Spawn an item at a position
 */
export function spawnItem(itemTypeKey, x, y) {
    const itemType = ITEM_TYPES[itemTypeKey];
    if (!itemType) {
        console.error('Invalid item type:', itemTypeKey);
        return null;
    }

    const item = {
        ...itemType,
        x: x,
        y: y,
        baseHeight: 0.5, // Base height for rendering
        bobOffset: Math.random() * Math.PI * 2, // Random start for bob animation
        timeAlive: 0,
        active: true,
    };

    itemState.items.push(item);
    console.log(`Spawned ${item.name} at (${x}, ${y})`);
    return item;
}

/**
 * Spawn items from configuration array
 */
export function spawnItemsFromConfig(itemConfigs) {
    if (!itemConfigs || itemConfigs.length === 0) {
        console.log('No items to spawn');
        return;
    }

    for (const config of itemConfigs) {
        spawnItem(config.type, config.x, config.y);
    }

    console.log(`Spawned ${itemConfigs.length} items`);
}

/**
 * Check if player can pick up an item
 */
function canPickupItem(player, item) {
    if (!item.active) return false;

    // Calculate distance to item
    const dx = player.x - item.x;
    const dy = player.y - item.y;
    const distance = Math.sqrt(dx * dx + dy * dy);

    return distance <= itemState.pickupDistance;
}

/**
 * Apply item effect to player
 */
function applyItemEffect(item) {
    if (item.type === 'health') {
        // Add health, capped at max health
        const oldHealth = state.health;
        state.health = Math.min(state.health + item.amount, state.maxHealth);
        const actualHealed = state.health - oldHealth;

        if (actualHealed > 0) {
            console.log(`Picked up ${item.name}: +${actualHealed} HP (${state.health}/${state.maxHealth})`);
            playSound('healthPickup');
            return true;
        } else {
            console.log('Health already full!');
            return false; // Don't consume item if health is full
        }
    } else if (item.type === 'ammo') {
        // Add ammo
        addAmmo(item.ammoType, item.amount);
        console.log(`Picked up ${item.name}: +${item.amount} ${item.ammoType}`);
        return true;
    }

    return false;
}

/**
 * Update items (called each frame)
 */
export function updateItems(dt, player) {
    // Update bobbing animation and check for pickups
    for (let i = itemState.items.length - 1; i >= 0; i--) {
        const item = itemState.items[i];

        if (!item.active) {
            // Remove inactive items
            itemState.items.splice(i, 1);
            continue;
        }

        // Update bobbing animation
        item.timeAlive += dt;

        // Check for pickup
        if (canPickupItem(player, item)) {
            // Try to apply item effect
            if (applyItemEffect(item)) {
                // Item consumed successfully
                item.active = false;
                itemState.items.splice(i, 1);
            }
            // If applyItemEffect returns false, item stays (e.g., health when full)
        }
    }
}

/**
 * Get current bob height for an item (for rendering)
 */
export function getItemBobHeight(item) {
    const bobPhase = item.timeAlive * item.bobSpeed + item.bobOffset;
    return item.baseHeight + Math.sin(bobPhase) * item.bobHeight;
}

/**
 * Get all active items
 */
export function getActiveItems() {
    return itemState.items.filter(item => item.active);
}

/**
 * Clear all items (for level reset)
 */
export function clearItems() {
    itemState.items = [];
    state.items = itemState.items;
    console.log('Cleared all items');
}

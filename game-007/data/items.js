// Item definitions for the game

export const ITEMS = {
    // Starting room items
    "old_torch": {
        id: "old_torch",
        name: "Old Torch",
        description: "A weathered wooden torch with oil-soaked wrappings. It flickers with a warm, steady flame that casts dancing shadows on the walls. The torch provides enough light to see in dark places.",
        type: "tool",
        takeable: true,
        equippable: true,
        equipped: false,
        usable: true,
        providesLight: true,
        useWith: [],
        weight: 1,
        value: 5
    },

    // Storage room items
    "rusty_sword": {
        id: "rusty_sword",
        name: "Rusty Sword",
        description: "An old, rusty sword with a pitted blade. Despite its appearance and the brown stains of oxidation covering the metal, the edge still looks sharp enough to be dangerous. The leather-wrapped handle is worn but serviceable.",
        type: "weapon",
        takeable: true,
        equippable: true,
        equipped: false,
        usable: true,
        useWith: ["wooden_crate"],
        weight: 3,
        value: 10,
        damage: 2
    },

    "wooden_crate": {
        id: "wooden_crate",
        name: "Wooden Crate",
        description: "A sturdy wooden crate reinforced with iron bands. The wood is old but solid. It appears to be sealed shut, but you might be able to pry it open with the right tool.",
        type: "container",
        takeable: false,
        equippable: false,
        usable: true,
        isOpen: false,
        contains: ["healing_potion"],
        weight: 20,
        value: 5
    },

    // Hidden in dark alcove
    "iron_key": {
        id: "iron_key",
        name: "Iron Key",
        description: "A heavy iron key, cold to the touch. It's surprisingly well-preserved despite its age. Intricate patterns are etched into the bow of the key. This looks like it would fit a substantial lock.",
        type: "key",
        takeable: true,
        equippable: false,
        usable: true,
        unlocks: ["temple_door"],
        weight: 0.5,
        value: 0
    },

    // Temple entrance
    "stone_tablet": {
        id: "stone_tablet",
        name: "Stone Tablet",
        description: "A rectangular stone tablet covered in ancient hieroglyphics. You can make out some symbols: a sun, a moon, a star, and what appears to be a comet. Below the symbols is an inscription that reads: 'First light guides the way, the wandering star follows, bringing light to the darkness.'",
        type: "quest",
        takeable: true,
        equippable: false,
        usable: false,
        weight: 2,
        value: 0,
        isClue: true
    },

    // Inner sanctum - the goal
    "crystal_of_light": {
        id: "crystal_of_light",
        name: "Crystal of Light",
        description: "A magnificent crystal that pulses with an ethereal inner light. Its facets catch and refract the light in mesmerizing patterns. As you hold it, you feel a sense of warmth and peace wash over you. This is clearly an artifact of great power and importance.",
        type: "quest",
        takeable: true,
        equippable: false,
        usable: false,
        weight: 1,
        value: 1000,
        isVictoryItem: true
    },

    // Items in containers
    "healing_potion": {
        id: "healing_potion",
        name: "Healing Potion",
        description: "A small glass vial filled with a shimmering red liquid. The potion swirls gently as you move it, and you can feel a faint warmth emanating from the glass. This looks like it could restore your health if consumed.",
        type: "consumable",
        takeable: true,
        equippable: false,
        usable: true,
        consumable: true,
        healAmount: 10,
        weight: 0.3,
        value: 15
    },

    // Combinable items for puzzle
    "rope": {
        id: "rope",
        name: "Coil of Rope",
        description: "A sturdy hemp rope, about 20 feet long. It's well-made and could support considerable weight. Useful for climbing or pulling things.",
        type: "tool",
        takeable: true,
        equippable: false,
        usable: true,
        useWith: ["grappling_hook"],
        combinesWith: ["grappling_hook"],
        combinesInto: "rope_and_hook",
        weight: 2,
        value: 8
    },

    "grappling_hook": {
        id: "grappling_hook",
        name: "Grappling Hook",
        description: "A three-pronged iron grappling hook. The metal is tarnished but solid. On its own, it's not much use, but if you had some rope...",
        type: "tool",
        takeable: true,
        equippable: false,
        usable: false,
        useWith: ["rope"],
        combinesWith: ["rope"],
        combinesInto: "rope_and_hook",
        weight: 2,
        value: 10
    },

    "rope_and_hook": {
        id: "rope_and_hook",
        name: "Rope with Grappling Hook",
        description: "A sturdy rope securely tied to a grappling hook. This makeshift climbing tool could help you reach high places or pull down distant objects.",
        type: "tool",
        takeable: true,
        equippable: false,
        usable: true,
        useWith: ["high_window"],
        weight: 4,
        value: 20,
        isCombined: true
    }
};

/**
 * Get item by ID
 */
export function getItem(itemId) {
    return ITEMS[itemId] ? { ...ITEMS[itemId] } : null;
}

/**
 * Get item name by ID
 */
export function getItemName(itemId) {
    return ITEMS[itemId] ? ITEMS[itemId].name : itemId;
}

/**
 * Check if item exists
 */
export function itemExists(itemId) {
    return itemId in ITEMS;
}

/**
 * Get all takeable items
 */
export function getTakeableItems() {
    return Object.values(ITEMS).filter(item => item.takeable);
}

/**
 * Get all items of a specific type
 */
export function getItemsByType(type) {
    return Object.values(ITEMS).filter(item => item.type === type);
}

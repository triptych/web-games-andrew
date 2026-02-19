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
        description: "A sturdy rope securely tied to a grappling hook. This makeshift climbing tool could help you reach high places or pull down distant objects. You could throw the hook toward a high ledge and use the rope to climb up.",
        type: "tool",
        takeable: true,
        equippable: false,
        usable: true,
        useWith: [],
        weight: 4,
        value: 20,
        isCombined: true
    },

    // ===== PHASE 3: NEW ITEMS =====

    "ancient_lantern": {
        id: "ancient_lantern",
        name: "Ancient Lantern",
        description: "A bronze oil lantern of ancient design, its glass globe surprisingly intact. When lit, it casts a steady, warm light significantly brighter than a torch. An inscription on the base reads 'Lux perpetua' — eternal light. The lantern still contains oil and burns reliably.",
        type: "tool",
        takeable: true,
        equippable: true,
        equipped: false,
        usable: true,
        providesLight: true,
        weight: 1.5,
        value: 25
    },

    "bronze_key": {
        id: "bronze_key",
        name: "Bronze Key",
        description: "A heavy bronze key, green with patina but still solid. The bow is shaped like a crescent moon, and intricate leaf patterns run down the shaft. This clearly opens something of importance — perhaps a crescent-shaped lock.",
        type: "key",
        takeable: true,
        equippable: false,
        usable: true,
        weight: 0.5,
        value: 0
    },

    "old_manuscript": {
        id: "old_manuscript",
        name: "Old Manuscript",
        description: "A leather-bound manuscript, its pages yellowed but still legible. The text discusses the founding of the temple and the Crystal of Light: 'The Crystal was the gift of the First Priests, imbued with the light of all four celestial bodies. When the Great Sundering came, the High Priest Atem-Ra shattered the Crystal into pieces to prevent its corruption: the main body was left upon the sanctum pedestal as a beacon; three shards were hidden — one in the heights, one in the depths, one in the sacred fire. Only a worthy seeker could reunite them and restore the Crystal's full power.'",
        type: "quest",
        takeable: true,
        equippable: false,
        usable: false,
        weight: 0.8,
        value: 0,
        isClue: true
    },

    "moon_stone": {
        id: "moon_stone",
        name: "Moon Stone",
        description: "A smooth, oval stone that glows with a soft silver-blue light. It is cool to the touch, like moonlight given physical form. This appears to be one of the crystal shards mentioned in the manuscript — the shard 'hidden in the depths.' The light it emits is steady and calming, pulsing gently as if alive.",
        type: "quest",
        takeable: true,
        equippable: false,
        usable: false,
        weight: 0.5,
        value: 0,
        isClue: true,
        isShard: true
    },

    "fire_shard": {
        id: "fire_shard",
        name: "Fire Shard",
        description: "A brilliant red-amber crystal shard, warm to the touch as if lit from within by fire. It pulses with an orange-gold inner light. This must be the shard 'hidden where fire and ritual converge' — it was resting on the altar in the ritual chamber. Like the other shards, it seems to yearn for reunion with the Crystal of Light.",
        type: "quest",
        takeable: true,
        equippable: false,
        usable: false,
        weight: 0.3,
        value: 0,
        isShard: true
    },

    "silver_coin": {
        id: "silver_coin",
        name: "Silver Coin",
        description: "An old silver coin, tarnished with age. One face shows a sun rising over mountains; the other shows the moon and stars. The coin bears script you cannot read, but the craftsmanship suggests it is very old. It would fetch a fair price from a collector or merchant.",
        type: "consumable",
        takeable: true,
        equippable: false,
        usable: false,
        weight: 0.1,
        value: 50
    },

    "ceremonial_dagger": {
        id: "ceremonial_dagger",
        name: "Ceremonial Dagger",
        description: "A slender bronze dagger with an ornate handle wrapped in silver wire. The blade, though old, is still sharp. This was not a weapon of war but a ritual implement, used in ceremonies within the temple. It has a balance and elegance that speaks of skilled craftsmanship. Despite its age, it remains serviceable as a weapon.",
        type: "weapon",
        takeable: true,
        equippable: true,
        equipped: false,
        usable: true,
        useWith: [],
        weight: 0.8,
        value: 30,
        damage: 3
    },

    "old_codex": {
        id: "old_codex",
        name: "Old Codex",
        description: "A faded leather codex — a book with folded pages rather than a scroll. It appears to be a soldier's journal, written in a mix of official reports and personal observations. An entry near the end reads: 'The priests are gone. The temple is sealed. Our orders are to guard the entrance until relieved, but no relief is coming. I have explored more of the temple than I should have. In the library, there is a bookshelf that is not what it seems. In the crypt below, the high priest's tomb holds answers. In the ritual chamber above, an eternal fire burns. Do not disturb the crystal — it is incomplete and dangerous.'",
        type: "quest",
        takeable: true,
        equippable: false,
        usable: false,
        weight: 0.7,
        value: 0,
        isClue: true
    },

    "rusty_armor": {
        id: "rusty_armor",
        name: "Rusty Armor",
        description: "A suit of iron scale armor, heavy with rust and age. Many of the scales are pitted or missing, and the leather backing has rotted in places. Despite its poor condition, it still provides more protection than no armor at all. It would be uncomfortable and noisy to wear, but better than nothing if you expect danger.",
        type: "armor",
        takeable: true,
        equippable: true,
        equipped: false,
        usable: false,
        weight: 12,
        value: 5,
        defense: 2
    },

    "crystal_shard": {
        id: "crystal_shard",
        name: "Crystal Shard",
        description: "A brilliant, faceted crystal shard about the size of your fist. It catches the light and refracts it into dazzling rainbow patterns. The shard pulses with the same inner light as the Crystal of Light in the inner sanctum, only weaker — as if this fragment yearns to be reunited with its other parts. This must be the shard 'hidden in the heights.'",
        type: "quest",
        takeable: true,
        equippable: false,
        usable: false,
        weight: 0.3,
        value: 0,
        isShard: true
    },

    "vine": {
        id: "vine",
        name: "Thick Vine",
        description: "A length of thick, woody vine cut from an ancient tree in the temple garden. It is surprisingly strong and flexible, roughly ten feet long. This might be useful as a rope substitute in a pinch, though less reliable than real rope. Perhaps it could be combined with something, or used to reach something distant.",
        type: "tool",
        takeable: true,
        equippable: false,
        usable: true,
        combinesWith: [],
        weight: 1.5,
        value: 2
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

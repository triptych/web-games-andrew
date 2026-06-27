/**
 * items.js — Item definitions and inventory helpers.
 *
 * Item categories: consumable, weapon, armor, key
 * Items are referenced by id string; the state module holds qty.
 */

export const ITEM_DEFS = {
    // --- Consumables ---
    potion: {
        id: 'potion', name: 'Healing Potion', category: 'consumable', icon: '🧪',
        desc: 'Restores 50 HP to one ally.',
        usable: true, target: 'ally', effect: { heal: 50 },
        buyPrice: 50, sellPrice: 20,
    },
    hi_potion: {
        id: 'hi_potion', name: 'Hi-Potion', category: 'consumable', icon: '💊',
        desc: 'Restores 120 HP to one ally.',
        usable: true, target: 'ally', effect: { heal: 120 },
        buyPrice: 120, sellPrice: 50,
    },
    ether: {
        id: 'ether', name: 'Ether', category: 'consumable', icon: '🔵',
        desc: 'Restores 30 MP to one ally.',
        usable: true, target: 'ally', effect: { mpRestore: 30 },
        buyPrice: 80, sellPrice: 30,
    },
    antidote: {
        id: 'antidote', name: 'Antidote', category: 'consumable', icon: '💉',
        desc: 'Cures poison from one ally.',
        usable: true, target: 'ally', effect: { cure: 'poison' },
        buyPrice: 40, sellPrice: 15,
    },
    phoenix_down: {
        id: 'phoenix_down', name: 'Phoenix Down', category: 'consumable', icon: '🪶',
        desc: 'Revives a fallen ally with 1 HP.',
        usable: true, target: 'ally', effect: { revive: true },
        buyPrice: 200, sellPrice: 80,
    },

    // --- Weapons ---
    iron_dagger: {
        id: 'iron_dagger', name: 'Iron Dagger', category: 'weapon', icon: '🗡️',
        desc: 'A simple iron dagger. +4 ATK.',
        equippable: true, slot: 'weapon', statBonus: { atk: 4 },
        buyPrice: 60, sellPrice: 25,
    },
    mage_staff: {
        id: 'mage_staff', name: "Apprentice's Staff", category: 'weapon', icon: '🪄',
        desc: 'A beginner mage staff. +6 ATK, +10 MAX MP.',
        equippable: true, slot: 'weapon', statBonus: { atk: 6, maxMp: 10 },
        buyPrice: 90, sellPrice: 35,
    },
    longbow: {
        id: 'longbow', name: 'Thornwood Longbow', category: 'weapon', icon: '🏹',
        desc: 'Crafted from ancient thornwood. +8 ATK, +2 SPD.',
        equippable: true, slot: 'weapon', statBonus: { atk: 8, spd: 2 },
        buyPrice: 110, sellPrice: 45,
    },
    runic_blade: {
        id: 'runic_blade', name: 'Runic Blade', category: 'weapon', icon: '⚔️',
        desc: 'Etched with ancient runes. +12 ATK, -2 SPD.',
        equippable: true, slot: 'weapon', statBonus: { atk: 12, spd: -2 },
        buyPrice: 250, sellPrice: 100,
    },

    // --- Armor ---
    leather_vest: {
        id: 'leather_vest', name: 'Leather Vest', category: 'armor', icon: '🧥',
        desc: 'Basic leather armor. +3 DEF.',
        equippable: true, slot: 'armor', statBonus: { def: 3 },
        buyPrice: 55, sellPrice: 20,
    },
    chain_mail: {
        id: 'chain_mail', name: 'Chain Mail', category: 'armor', icon: '🛡️',
        desc: 'Interlocked rings of iron. +8 DEF, -1 SPD.',
        equippable: true, slot: 'armor', statBonus: { def: 8, spd: -1 },
        buyPrice: 150, sellPrice: 60,
    },
    mage_robe: {
        id: 'mage_robe', name: "Mage's Robe", category: 'armor', icon: '👘',
        desc: 'Enchanted with protection sigils. +4 DEF, +20 MAX MP.',
        equippable: true, slot: 'armor', statBonus: { def: 4, maxMp: 20 },
        buyPrice: 130, sellPrice: 55,
    },

    // --- Key items ---
    slime_core: {
        id: 'slime_core', name: 'Slime Core', category: 'key', icon: '🟢',
        desc: 'A gelatinous core from a slime. Used for alchemy.',
        usable: false, buyPrice: 0, sellPrice: 10,
    },
    wolf_pelt: {
        id: 'wolf_pelt', name: 'Wolf Pelt', category: 'key', icon: '🐺',
        desc: 'Thick fur from a forest wolf.',
        usable: false, buyPrice: 0, sellPrice: 15,
    },
    fang: {
        id: 'fang', name: 'Sharp Fang', category: 'key', icon: '🦷',
        desc: 'A wolf fang. Crafting material.',
        usable: false, buyPrice: 0, sellPrice: 8,
    },
    stone_heart: {
        id: 'stone_heart', name: 'Stone Heart', category: 'key', icon: '🗿',
        desc: 'The animated core of a golem. Valuable to scholars.',
        usable: false, buyPrice: 0, sellPrice: 50,
    },
    soul_gem: {
        id: 'soul_gem', name: 'Soul Gem', category: 'key', icon: '💠',
        desc: 'Crystallized lich energy. Key to unsealing the ruins.',
        usable: false, buyPrice: 0, sellPrice: 0, isKeyItem: true,
    },
    lich_crown: {
        id: 'lich_crown', name: 'Crown of Aethermoor', category: 'key', icon: '👑',
        desc: 'The Lich\'s crown, now drained of power. Proof of your victory.',
        usable: false, buyPrice: 0, sellPrice: 0, isKeyItem: true,
    },
    elder_scroll: {
        id: 'elder_scroll', name: 'Elder Scroll', category: 'key', icon: '📜',
        desc: 'An ancient scroll from the Academy ruins. The prophecy Lyra fled.',
        usable: false, buyPrice: 0, sellPrice: 0, isKeyItem: true,
    },
};

/**
 * Returns a shuffled loot drop list based on enemy loot table.
 * @param {Array} lootTable — array of { id, chance }
 * @returns {Array} item id strings that dropped
 */
export function rollLoot(lootTable) {
    const drops = [];
    for (const entry of lootTable) {
        if (Math.random() < entry.chance) drops.push(entry.id);
    }
    return drops;
}

/** Get item def by id. Returns undefined if not found. */
export function getItem(id) { return ITEM_DEFS[id]; }

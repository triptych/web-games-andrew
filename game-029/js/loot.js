/**
 * loot.js — item generation: rarity roll, base stats per monster tier,
 * and sale value formula. Items are plain objects matching the shape
 * ui.js's showLootComparison() expects (see ui.js header comment).
 */

import {
    RARITY, EQUIPMENT_SLOTS, WEAPON_ATTRS, ARMOR_ATTRS,
    BASE_WEAPON, BASE_ARMOR, WEAPON_NAMES, ARMOR_NAMES,
} from './config.js';

/** Roll a rarity tier using RARITY's chance weights (they sum to 1.0). */
export function rollRarity() {
    const roll = Math.random();
    let acc = 0;
    for (const [key, def] of Object.entries(RARITY)) {
        acc += def.chance;
        if (roll <= acc) return key;
    }
    return 'common';
}

/**
 * Generate a random item for the given monster tier. Base stats scale with
 * tier.level, then get multiplied by the rolled rarity's mult.
 */
export function generateItem(tier) {
    const slot   = EQUIPMENT_SLOTS[Math.floor(Math.random() * EQUIPMENT_SLOTS.length)];
    const rarity = rollRarity();
    const mult   = RARITY[rarity].mult;
    const levelMult = 1 + (tier.level - 1) * 0.35;

    if (slot === 'weapon') {
        const name = WEAPON_NAMES[Math.floor(Math.random() * WEAPON_NAMES.length)];
        return {
            name: `${_rarityPrefix(rarity)}${name}`,
            slot, rarity,
            damage:      _scaled(BASE_WEAPON.damage, levelMult, mult),
            attackSpeed: +(BASE_WEAPON.attackSpeed * mult).toFixed(2),
            critChance:  +(BASE_WEAPON.critChance * mult).toFixed(2),
        };
    }

    const name = ARMOR_NAMES[Math.floor(Math.random() * ARMOR_NAMES.length)];
    return {
        name: `${_rarityPrefix(rarity)}${name}`,
        slot, rarity,
        defense:   _scaled(BASE_ARMOR.defense, levelMult, mult),
        maxHp:     _scaled(5, levelMult, mult),
        moveSpeed: +(BASE_ARMOR.moveSpeed * mult).toFixed(2),
    };
}

/** Coin value if the player chooses to sell rather than equip. */
export function getSaleValue(item) {
    const mult = RARITY[item.rarity]?.mult ?? 1;
    const attrs = item.slot === 'weapon' ? WEAPON_ATTRS : ARMOR_ATTRS;
    const total = attrs.reduce((sum, key) => sum + (item[key] ?? 0), 0);
    return Math.max(1, Math.round(total * mult * 2));
}

function _scaled(base, levelMult, rarityMult) {
    return Math.round(base * levelMult * rarityMult);
}

function _rarityPrefix(rarity) {
    if (rarity === 'common') return '';
    return rarity[0].toUpperCase() + rarity.slice(1) + ' ';
}

// Item.js - Item entities and equipment

export const ItemType = {
    WEAPON: 'weapon',
    ARMOR: 'armor',
    POTION: 'potion',
    SCROLL: 'scroll',
    FOOD: 'food'
};

export const ItemRarity = {
    COMMON: 'common',
    UNCOMMON: 'uncommon',
    RARE: 'rare',
    LEGENDARY: 'legendary'
};

export class Item {
    constructor(x, y, type, subtype, name, data = {}) {
        this.x = x;
        this.y = y;
        this.type = type;
        this.subtype = subtype;
        this.name = name;
        this.char = this.getCharForType(type);
        this.color = this.getColorForType(type);
        this.rarity = data.rarity || ItemRarity.COMMON;
        
        // Equipment stats
        this.attackBonus = data.attackBonus || 0;
        this.defenseBonus = data.defenseBonus || 0;
        this.hpBonus = data.hpBonus || 0;
        
        // Consumable effects
        this.healAmount = data.healAmount || 0;
        this.effect = data.effect || null;
        
        // Misc properties
        this.value = data.value || 10;
        this.weight = data.weight || 1;
        this.stackable = data.stackable || false;
        this.quantity = data.quantity || 1;
    }

    getCharForType(type) {
        switch (type) {
            case ItemType.WEAPON:
                return ')';
            case ItemType.ARMOR:
                return '[';
            case ItemType.POTION:
                return '!';
            case ItemType.SCROLL:
                return '?';
            case ItemType.FOOD:
                return '%';
            default:
                return '*';
        }
    }

    getColorForType(type) {
        switch (type) {
            case ItemType.WEAPON:
                return '#C0C0C0'; // Silver
            case ItemType.ARMOR:
                return '#8B7355'; // Brown
            case ItemType.POTION:
                return '#FF00FF'; // Magenta
            case ItemType.SCROLL:
                return '#FFFF00'; // Yellow
            case ItemType.FOOD:
                return '#FFA500'; // Orange
            default:
                return '#FFFFFF';
        }
    }

    getDescription() {
        let desc = this.name;
        
        if (this.type === ItemType.WEAPON) {
            desc += ` (+${this.attackBonus} ATK)`;
        } else if (this.type === ItemType.ARMOR) {
            desc += ` (+${this.defenseBonus} DEF)`;
        } else if (this.type === ItemType.POTION) {
            desc += ` (Heals ${this.healAmount} HP)`;
        }
        
        return desc;
    }

    clone() {
        return new Item(this.x, this.y, this.type, this.subtype, this.name, {
            rarity: this.rarity,
            attackBonus: this.attackBonus,
            defenseBonus: this.defenseBonus,
            hpBonus: this.hpBonus,
            healAmount: this.healAmount,
            effect: this.effect,
            value: this.value,
            weight: this.weight,
            stackable: this.stackable,
            quantity: this.quantity
        });
    }

    serialize() {
        return {
            x: this.x,
            y: this.y,
            type: this.type,
            subtype: this.subtype,
            name: this.name,
            rarity: this.rarity,
            attackBonus: this.attackBonus,
            defenseBonus: this.defenseBonus,
            hpBonus: this.hpBonus,
            healAmount: this.healAmount,
            effect: this.effect,
            value: this.value,
            weight: this.weight,
            stackable: this.stackable,
            quantity: this.quantity
        };
    }

    static deserialize(data) {
        return new Item(data.x, data.y, data.type, data.subtype, data.name, {
            rarity: data.rarity,
            attackBonus: data.attackBonus,
            defenseBonus: data.defenseBonus,
            hpBonus: data.hpBonus,
            healAmount: data.healAmount,
            effect: data.effect,
            value: data.value,
            weight: data.weight,
            stackable: data.stackable,
            quantity: data.quantity
        });
    }
}

// Item Templates
export const ItemTemplates = {
    // Weapons
    DAGGER: {
        type: ItemType.WEAPON,
        subtype: 'dagger',
        name: 'Dagger',
        data: { attackBonus: 2, value: 15, weight: 1 }
    },
    SHORT_SWORD: {
        type: ItemType.WEAPON,
        subtype: 'sword',
        name: 'Short Sword',
        data: { attackBonus: 4, value: 30, weight: 2 }
    },
    LONG_SWORD: {
        type: ItemType.WEAPON,
        subtype: 'sword',
        name: 'Long Sword',
        data: { attackBonus: 6, value: 50, weight: 3, rarity: ItemRarity.UNCOMMON }
    },
    BATTLE_AXE: {
        type: ItemType.WEAPON,
        subtype: 'axe',
        name: 'Battle Axe',
        data: { attackBonus: 8, value: 75, weight: 4, rarity: ItemRarity.UNCOMMON }
    },
    GREAT_SWORD: {
        type: ItemType.WEAPON,
        subtype: 'sword',
        name: 'Great Sword',
        data: { attackBonus: 10, value: 100, weight: 5, rarity: ItemRarity.RARE }
    },

    // Armor
    LEATHER_ARMOR: {
        type: ItemType.ARMOR,
        subtype: 'light',
        name: 'Leather Armor',
        data: { defenseBonus: 2, value: 20, weight: 3 }
    },
    CHAIN_MAIL: {
        type: ItemType.ARMOR,
        subtype: 'medium',
        name: 'Chain Mail',
        data: { defenseBonus: 4, value: 50, weight: 5, rarity: ItemRarity.UNCOMMON }
    },
    PLATE_ARMOR: {
        type: ItemType.ARMOR,
        subtype: 'heavy',
        name: 'Plate Armor',
        data: { defenseBonus: 6, value: 100, weight: 8, rarity: ItemRarity.RARE }
    },
    SHIELD: {
        type: ItemType.ARMOR,
        subtype: 'shield',
        name: 'Shield',
        data: { defenseBonus: 3, value: 40, weight: 4 }
    },

    // Potions
    MINOR_HEALING: {
        type: ItemType.POTION,
        subtype: 'healing',
        name: 'Minor Healing Potion',
        data: { healAmount: 20, value: 15, weight: 0.5, stackable: true }
    },
    HEALING: {
        type: ItemType.POTION,
        subtype: 'healing',
        name: 'Healing Potion',
        data: { healAmount: 40, value: 30, weight: 0.5, stackable: true }
    },
    GREATER_HEALING: {
        type: ItemType.POTION,
        subtype: 'healing',
        name: 'Greater Healing Potion',
        data: { healAmount: 60, value: 50, weight: 0.5, stackable: true, rarity: ItemRarity.UNCOMMON }
    },

    // Food
    BREAD: {
        type: ItemType.FOOD,
        subtype: 'food',
        name: 'Bread',
        data: { healAmount: 5, value: 5, weight: 0.5, stackable: true }
    },
    RATION: {
        type: ItemType.FOOD,
        subtype: 'food',
        name: 'Food Ration',
        data: { healAmount: 10, value: 10, weight: 1, stackable: true }
    }
};

export function createRandomItem(x, y, depth = 1) {
    const templates = Object.values(ItemTemplates);
    
    // Weight selection by depth (better items at deeper levels)
    const availableItems = templates.filter(template => {
        if (template.data.rarity === ItemRarity.RARE) {
            return depth >= 5;
        } else if (template.data.rarity === ItemRarity.UNCOMMON) {
            return depth >= 3;
        }
        return true;
    });
    
    const template = availableItems[Math.floor(Math.random() * availableItems.length)];
    return new Item(x, y, template.type, template.subtype, template.name, template.data);
}

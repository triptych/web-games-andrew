// Player.js - Player character class

import { ItemType } from './Item.js';

export class Player {
    constructor(x, y) {
        this.x = x;
        this.y = y;
        this.hp = 100;
        this.maxHp = 100;
        this.mp = 50;
        this.maxMp = 50;
        this.level = 1;
        this.experience = 0;
        this.experienceToLevel = 100;
        this.baseAttack = 10;
        this.baseDefense = 2;
        this.char = '@';
        this.color = '#FFFF00'; // Yellow

        // Inventory system
        this.inventory = [];
        this.maxInventorySize = 20;

        // Equipment slots
        this.equippedWeapon = null;
        this.equippedArmor = null;
    }
    
    get attack() {
        let total = this.baseAttack;
        if (this.equippedWeapon) {
            total += this.equippedWeapon.attackBonus;
        }
        return total;
    }
    
    get defense() {
        let total = this.baseDefense;
        if (this.equippedArmor) {
            total += this.equippedArmor.defenseBonus;
        }
        return total;
    }

    move(dx, dy, map) {
        const newX = this.x + dx;
        const newY = this.y + dy;

        if (map.isWalkable(newX, newY)) {
            this.x = newX;
            this.y = newY;
            return true;
        }
        return false;
    }

    getPosition() {
        return { x: this.x, y: this.y };
    }

    takeDamage(amount) {
        const damage = Math.max(1, amount - this.defense);
        this.hp -= damage;
        if (this.hp < 0) this.hp = 0;
        return damage;
    }

    heal(amount) {
        this.hp += amount;
        if (this.hp > this.maxHp) this.hp = this.maxHp;
    }

    isDead() {
        return this.hp <= 0;
    }

    gainExperience(amount) {
        this.experience += amount;
        
        // Check for level up
        if (this.experience >= this.experienceToLevel) {
            this.levelUp();
        }
    }

    levelUp() {
        this.level++;
        this.experience = 0;
        this.experienceToLevel = Math.floor(this.experienceToLevel * 1.5);

        // Increase stats
        this.maxHp += 10;
        this.hp = this.maxHp; // Full heal on level up
        this.maxMp += 5;
        this.mp = this.maxMp; // Full mana on level up
        this.baseAttack += 2;
        this.baseDefense += 1;

        return true; // Signal that level up occurred
    }

    useMana(amount) {
        if (this.mp >= amount) {
            this.mp -= amount;
            return true;
        }
        return false;
    }

    restoreMana(amount) {
        this.mp += amount;
        if (this.mp > this.maxMp) this.mp = this.maxMp;
    }

    getAttackDamage() {
        // Base attack with some randomness
        const variance = Math.floor(Math.random() * 3) - 1; // -1 to +1
        return Math.max(1, this.attack + variance);
    }
    
    // Inventory management
    addItem(item) {
        if (this.inventory.length >= this.maxInventorySize) {
            return false; // Inventory full
        }
        
        // Check if item is stackable and already in inventory
        if (item.stackable) {
            const existing = this.inventory.find(i => 
                i.type === item.type && i.subtype === item.subtype && i.name === item.name
            );
            if (existing) {
                existing.quantity += item.quantity;
                return true;
            }
        }
        
        this.inventory.push(item);
        return true;
    }
    
    removeItem(item) {
        const index = this.inventory.indexOf(item);
        if (index > -1) {
            this.inventory.splice(index, 1);
            return true;
        }
        return false;
    }
    
    equipItem(item) {
        if (item.type === ItemType.WEAPON) {
            // Unequip current weapon if any
            if (this.equippedWeapon) {
                this.equippedWeapon = null;
            }
            this.equippedWeapon = item;
            return true;
        } else if (item.type === ItemType.ARMOR) {
            // Unequip current armor if any
            if (this.equippedArmor) {
                this.equippedArmor = null;
            }
            this.equippedArmor = item;
            return true;
        }
        return false;
    }
    
    unequipItem(item) {
        if (this.equippedWeapon === item) {
            this.equippedWeapon = null;
            return true;
        } else if (this.equippedArmor === item) {
            this.equippedArmor = null;
            return true;
        }
        return false;
    }
    
    useItem(item) {
        if (item.type === ItemType.POTION || item.type === ItemType.FOOD) {
            // Heal player
            if (item.healAmount > 0) {
                this.heal(item.healAmount);
                
                // Remove or decrease quantity
                if (item.stackable && item.quantity > 1) {
                    item.quantity--;
                } else {
                    this.removeItem(item);
                }
                return { success: true, message: `You consume ${item.name} and heal ${item.healAmount} HP!` };
            }
        }
        return { success: false, message: `You can't use ${item.name} right now.` };
    }
    
    isEquipped(item) {
        return this.equippedWeapon === item || this.equippedArmor === item;
    }

    serialize() {
        return {
            x: this.x,
            y: this.y,
            hp: this.hp,
            maxHp: this.maxHp,
            mp: this.mp,
            maxMp: this.maxMp,
            level: this.level,
            experience: this.experience,
            experienceToLevel: this.experienceToLevel,
            baseAttack: this.baseAttack,
            baseDefense: this.baseDefense,
            inventory: this.inventory.map(item => item.serialize()),
            equippedWeaponIndex: this.equippedWeapon ? this.inventory.indexOf(this.equippedWeapon) : -1,
            equippedArmorIndex: this.equippedArmor ? this.inventory.indexOf(this.equippedArmor) : -1
        };
    }

    static deserialize(data, ItemClass) {
        const player = new Player(data.x, data.y);
        player.hp = data.hp;
        player.maxHp = data.maxHp;
        player.mp = data.mp || 50;
        player.maxMp = data.maxMp || 50;
        player.level = data.level;
        player.experience = data.experience;
        player.experienceToLevel = data.experienceToLevel;
        player.baseAttack = data.baseAttack;
        player.baseDefense = data.baseDefense;

        // Restore inventory
        player.inventory = data.inventory.map(itemData => ItemClass.deserialize(itemData));

        // Restore equipped items
        if (data.equippedWeaponIndex >= 0) {
            player.equippedWeapon = player.inventory[data.equippedWeaponIndex];
        }
        if (data.equippedArmorIndex >= 0) {
            player.equippedArmor = player.inventory[data.equippedArmorIndex];
        }

        return player;
    }
}

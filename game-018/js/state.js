import { events } from './events.js';
import {
    PLAYER_HP_BASE, PLAYER_ATK_BASE, XP_PER_LEVEL,
    BUILDING_DEFS, WEAPON_DEFS,
} from './config.js';

/**
 * Global game state singleton.
 * Setters auto-emit events so UI stays in sync.
 * Call state.reset() on new game.
 */
class GameState {
    constructor() {
        this.reset();
    }

    reset() {
        // --- Player ---
        this._hp         = PLAYER_HP_BASE;
        this._maxHp      = PLAYER_HP_BASE;
        this._atk        = PLAYER_ATK_BASE;
        this._xp         = 0;
        this._level      = 1;
        this._xpNext     = XP_PER_LEVEL;
        this._gold       = 0;
        this._isGameOver = false;

        // --- Resources ---
        this._resources = { wood: 0, stone: 0, iron: 0, herbs: 0 };

        // --- Village buildings: id -> level (0 = not built) ---
        this._buildings = {};
        for (const b of BUILDING_DEFS) this._buildings[b.id] = 0;

        // --- Mode ---
        this._mode = 'explore';  // 'explore' | 'village'

        // --- Weapons ---
        this._equippedWeapon = 'sword';
        this._inventory = ['sword'];
    }

    // ---- Player HP ----
    get hp()    { return this._hp; }
    get maxHp() { return this._maxHp; }

    set hp(val) {
        this._hp = Math.max(0, Math.min(this._maxHp, val));
        events.emit('playerHpChanged', this._hp, this._maxHp);
        if (this._hp <= 0 && !this._isGameOver) {
            this._isGameOver = true;
            events.emit('gameOver');
        }
    }

    heal(amount) { this.hp = this._hp + amount; }
    takeDamage(amount) { this.hp = this._hp - amount; }

    // ---- XP / Level ----
    get xp()      { return this._xp; }
    get xpNext()  { return this._xpNext; }
    get level()   { return this._level; }
    get atk()     { return this._atk; }

    addXp(amount) {
        this._xp += amount;
        events.emit('playerXpChanged', this._xp, this._xpNext);
        while (this._xp >= this._xpNext) {
            this._xp      -= this._xpNext;
            this._level   += 1;
            this._xpNext   = Math.floor(XP_PER_LEVEL * Math.pow(1.4, this._level - 1));
            this._maxHp   += 20 + this.buildingBonus('hpBonus');
            this._hp       = this._maxHp;
            this._atk     += 3 + this.buildingBonus('atkBonus');
            events.emit('playerLevelUp', this._level);
            events.emit('playerHpChanged', this._hp, this._maxHp);
            events.emit('message', `Level up! Now level ${this._level}.`, '#88ddff');
        }
    }

    // ---- Gold ----
    get gold() { return this._gold; }
    set gold(val) {
        this._gold = Math.max(0, val);
        events.emit('playerGoldChanged', this._gold);
    }

    addGold(n)  { this.gold = this._gold + n; }
    spendGold(n) {
        if (this._gold < n) return false;
        this.gold = this._gold - n;
        return true;
    }

    // ---- Resources ----
    getResource(type)     { return this._resources[type] ?? 0; }

    addResource(type, n) {
        if (!(type in this._resources)) return;
        this._resources[type] = Math.max(0, this._resources[type] + n);
        events.emit('resourceChanged', type, this._resources[type]);
    }

    spendResource(type, n) {
        if (this._resources[type] < n) return false;
        this._resources[type] -= n;
        events.emit('resourceChanged', type, this._resources[type]);
        return true;
    }

    canAfford(cost) {
        for (const [type, amount] of Object.entries(cost)) {
            if (type === 'gold') {
                if (this._gold < amount) return false;
            } else {
                if (this.getResource(type) < amount) return false;
            }
        }
        return true;
    }

    spendCost(cost) {
        if (!this.canAfford(cost)) return false;
        for (const [type, amount] of Object.entries(cost)) {
            if (type === 'gold') this.spendGold(amount);
            else this.spendResource(type, amount);
        }
        return true;
    }

    // ---- Buildings ----
    getBuildingLevel(id) { return this._buildings[id] ?? 0; }

    upgradeBuilding(id) {
        const def  = BUILDING_DEFS.find(b => b.id === id);
        if (!def) return false;
        const lvl = this._buildings[id];
        if (lvl >= def.maxLevel) return false;

        // Cost scales with level
        const scaledCost = {};
        for (const [k, v] of Object.entries(def.cost)) {
            scaledCost[k] = Math.ceil(v * Math.pow(1.8, lvl));
        }

        if (!this.spendCost(scaledCost)) return false;

        this._buildings[id] = lvl + 1;
        events.emit('buildingBuilt', id, this._buildings[id]);

        // Weapon unlocks via blacksmith
        if (id === 'blacksmith') {
            const newLvl = this._buildings[id];
            if (newLvl === 2) this.addWeapon('axe');
            if (newLvl === 3) this.addWeapon('bow');
        }

        return true;
    }

    // Sum a bonus type across all buildings
    buildingBonus(effectType) {
        let total = 0;
        for (const def of BUILDING_DEFS) {
            if (def.effect === effectType) {
                total += (this._buildings[def.id] ?? 0) * def.effectPerLevel;
            }
        }
        return total;
    }

    // ---- Mode ----
    get mode() { return this._mode; }
    set mode(val) {
        if (this._mode === val) return;
        this._mode = val;
        events.emit('modeChanged', val);
    }

    get isGameOver() { return this._isGameOver; }

    // ---- Weapons ----
    get equippedWeapon() { return this._equippedWeapon; }
    set equippedWeapon(type) {
        if (this._equippedWeapon === type) return;
        this._equippedWeapon = type;
        events.emit('weaponChanged', type);
    }

    hasWeapon(type) { return this._inventory.includes(type); }

    addWeapon(type) {
        if (!this._inventory.includes(type)) {
            this._inventory.push(type);
            events.emit('inventoryChanged');
        }
    }
}

export const state = new GameState();

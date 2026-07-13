import { events } from './events.js';
import { STARTING_HP, STARTING_COINS, BASE_ARMOR } from './config.js';

/**
 * Global game state.
 * Setters auto-emit events so UI stays in sync.
 * Call state.reset() on game restart.
 */
class GameState {
    constructor() {
        this.reset();
    }

    reset() {
        this._hp          = STARTING_HP;
        this._maxHp       = STARTING_HP;
        this._coins       = STARTING_COINS;
        this._distance    = 0;
        this._isGameOver  = false;
        this._isPaused    = false;
        this._isInTown    = false;

        // Currently worn gear. null slot = bare hands / no armor.
        // Shape: { name, rarity, damage, attackSpeed, critChance } for weapon
        //        { name, rarity, defense, maxHp, moveSpeed } for armor
        this.equipped = {
            weapon: null,
            armor:  null,
        };

        // TODO: add inventory array here if unequipped items are kept
        // rather than immediately converted to coins.
    }

    /**
     * Equip an item in its slot. Armor's maxHp bonus is re-derived from
     * scratch each time (STARTING_HP + new armor's bonus) rather than
     * incrementally adjusted, so swapping armor never double-counts a
     * previous bonus. Current HP is preserved, only re-clamped to the
     * new max.
     */
    equip(item) {
        this.equipped[item.slot] = item;
        if (item.slot === 'armor') {
            this.maxHp = STARTING_HP + item.maxHp;
        }
    }

    // --- HP ---
    get hp() { return this._hp; }
    set hp(val) {
        this._hp = Math.max(0, Math.min(this._maxHp, val));
        events.emit('hpChanged', this._hp, this._maxHp);
        if (this._hp <= 0 && !this._isGameOver) {
            this._isGameOver = true;
            events.emit('gameOver');
        }
    }

    get maxHp() { return this._maxHp; }
    set maxHp(val) {
        this._maxHp = Math.max(1, val);
        events.emit('hpChanged', this._hp, this._maxHp);
    }

    takeDamage(n) {
        const defense = this.equipped.armor ? this.equipped.armor.defense : BASE_ARMOR.defense;
        this.hp -= Math.max(1, n - defense);
    }
    heal(n)       { this.hp += n; }

    // --- Coins ---
    get coins() { return this._coins; }
    set coins(val) {
        this._coins = Math.max(0, val);
        events.emit('coinsChanged', this._coins);
    }

    addCoins(n) { this.coins += n; }

    // --- Distance travelled along the path ---
    get distance() { return this._distance; }
    set distance(val) {
        this._distance = Math.max(0, val);
        events.emit('distanceChanged', this._distance);
    }

    // --- Flags ---
    get isGameOver() { return this._isGameOver; }
    get isPaused()   { return this._isPaused; }
    set isPaused(v)  { this._isPaused = v; }
    get isInTown()   { return this._isInTown; }
    set isInTown(v)  { this._isInTown = v; }
}

export const state = new GameState();

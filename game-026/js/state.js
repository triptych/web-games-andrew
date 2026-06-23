import { events } from './events.js';
import { STARTING_SCORE, STARTING_LIVES, PLAYER_HP_MAX, STARTING_DEPTH,
         PLAYER_ATK, PLAYER_DEF, ITEMS } from './config.js';

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
        this._score      = STARTING_SCORE;
        this._lives      = STARTING_LIVES;
        this._isGameOver = false;
        this._isWon      = false;
        this._isPaused   = false;

        this.playerTile  = { x: 1, z: 1 };
        this.facing      = 0;

        this._hp         = PLAYER_HP_MAX;
        this._hpMax      = PLAYER_HP_MAX;
        this._depth      = STARTING_DEPTH;

        // Inventory: array of item ids (duplicates allowed for consumables)
        this.inventory   = [];
        // Equipped slots: { weapon: itemId|null, armor: itemId|null }
        this.equipped    = { weapon: null, armor: null };
        // Bonus stats from equipment
        this._atkBonus   = 0;
        this._defBonus   = 0;
        // Kill count
        this.kills       = 0;
    }

    // --- Score ---
    get score() { return this._score; }
    set score(val) {
        this._score = Math.max(0, val);
        events.emit('scoreChanged', this._score);
    }

    addScore(n) { this.score += n; }

    // --- Lives ---
    get lives() { return this._lives; }
    set lives(val) {
        this._lives = Math.max(0, val);
        events.emit('livesChanged', this._lives);
        if (this._lives <= 0 && !this._isGameOver) {
            this._isGameOver = true;
            events.emit('gameOver');
        }
    }

    loseLife() { this.lives -= 1; }

    // --- HP ---
    get hp()    { return this._hp; }
    get hpMax() { return this._hpMax; }
    set hp(val) {
        this._hp = Math.max(0, Math.min(this._hpMax, val));
        events.emit('hpChanged', { cur: this._hp, max: this._hpMax });
        if (this._hp <= 0 && !this._isGameOver) this.loseLife();
    }

    // --- Depth ---
    get depth() { return this._depth; }
    set depth(val) {
        this._depth = val;
        events.emit('depthChanged', val);
    }

    // --- Derived combat stats (base + equipment bonuses) ---
    get atk() { return PLAYER_ATK + this._atkBonus; }
    get def() { return PLAYER_DEF + this._defBonus; }

    // --- Inventory helpers ---
    addItem(itemId) {
        this.inventory.push(itemId);
        events.emit('inventoryChanged', this.inventory);
    }

    removeItem(itemId) {
        const idx = this.inventory.indexOf(itemId);
        if (idx !== -1) this.inventory.splice(idx, 1);
        events.emit('inventoryChanged', this.inventory);
    }

    equipItem(itemId, slot) {
        this.equipped[slot] = itemId;
        this._recalcEquipBonus();
        events.emit('equippedChanged', this.equipped);
    }

    _recalcEquipBonus() {
        this._atkBonus = 0;
        this._defBonus = 0;
        for (const itemId of Object.values(this.equipped)) {
            if (!itemId) continue;
            const def = ITEMS[itemId];
            if (def) {
                this._atkBonus += def.atk || 0;
                this._defBonus += def.def || 0;
            }
        }
        events.emit('statsChanged', { atk: this.atk, def: this.def });
    }

    // --- Flags ---
    get isGameOver() { return this._isGameOver; }
    get isWon()      { return this._isWon; }
    get isPaused()   { return this._isPaused; }
    set isPaused(v)  { this._isPaused = v; }

    win() {
        if (this._isWon || this._isGameOver) return;
        this._isWon = true;
        events.emit('gameWon', { score: this._score, depth: this._depth, kills: this.kills });
    }
}

export const state = new GameState();

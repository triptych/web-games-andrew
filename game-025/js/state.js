import { events } from './events.js';
import { STARTING_SCORE, STARTING_HEALTH } from './config.js';

/**
 * Global game state.
 * Setters auto-emit events so the HUD stays in sync.
 * Call state.reset() on game restart.
 */
class GameState {
    constructor() {
        this.reset();
    }

    reset() {
        this._score      = STARTING_SCORE;
        this._health     = STARTING_HEALTH;
        this._maxHealth  = STARTING_HEALTH;
        this._keys       = 0;
        this._level      = 1;
        this._classKey   = null;      // 'warrior' | 'valkyrie' | 'wizard' | 'elf'
        this._isGameOver = false;
        this._isPaused   = false;
    }

    // --- Score ---
    get score() { return this._score; }
    set score(val) {
        this._score = Math.max(0, val);
        events.emit('scoreChanged', this._score);
    }
    addScore(n) { this.score += n; }

    // --- Health ---
    get health()    { return this._health; }
    get maxHealth() { return this._maxHealth; }
    set maxHealth(v) { this._maxHealth = v; }
    set health(val) {
        this._health = Math.max(0, Math.min(val, this._maxHealth));
        events.emit('healthChanged', this._health);
        if (this._health <= 0 && !this._isGameOver) {
            this._isGameOver = true;
            events.emit('gameOver');
        }
    }
    damage(n) { this.health -= n; }
    heal(n)   { this.health += n; }

    // --- Keys ---
    get keys() { return this._keys; }
    set keys(val) {
        this._keys = Math.max(0, val);
        events.emit('keysChanged', this._keys);
    }
    addKey()    { this.keys += 1; }
    useKey()    { if (this._keys > 0) { this.keys -= 1; return true; } return false; }

    // --- Level ---
    get level() { return this._level; }
    set level(val) {
        this._level = val;
        events.emit('levelChanged', this._level);
    }
    nextLevel() { this.level += 1; }

    // --- Class ---
    get classKey() { return this._classKey; }
    set classKey(val) {
        this._classKey = val;
        events.emit('classChosen', this._classKey);
    }

    // --- Flags ---
    get isGameOver() { return this._isGameOver; }
    get isPaused()   { return this._isPaused; }
    set isPaused(v)  { this._isPaused = v; }
}

export const state = new GameState();

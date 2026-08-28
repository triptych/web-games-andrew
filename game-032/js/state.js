import { events } from './events.js';
import {
    STARTING_SCORE,
    STARTING_LIVES,
    STARTING_HEALTH,
    STARTING_LEVEL,
} from './config.js';

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
        this._health     = STARTING_HEALTH;
        this._maxHealth  = STARTING_HEALTH;
        this._level      = STARTING_LEVEL;
        this._isGameOver = false;
        this._isPaused   = false;

        // TODO: add game-specific state properties here (keys held, gold, etc.)
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

    // --- Health ---
    get health() { return this._health; }
    get maxHealth() { return this._maxHealth; }
    set health(val) {
        this._health = Math.max(0, Math.min(this._maxHealth, val));
        events.emit('healthChanged', this._health, this._maxHealth);
        if (this._health <= 0) {
            this.loseLife();
            if (!this._isGameOver) {
                this._health = this._maxHealth;
                events.emit('healthChanged', this._health, this._maxHealth);
            }
        }
    }

    damage(n) { this.health -= n; }
    heal(n)   { this.health += n; }

    // --- Level / floor ---
    get level() { return this._level; }
    set level(val) {
        this._level = val;
        events.emit('levelChanged', this._level);
    }

    nextLevel() { this.level += 1; }

    // --- Flags ---
    get isGameOver() { return this._isGameOver; }
    get isPaused()   { return this._isPaused; }
    set isPaused(v)  { this._isPaused = v; }
}

export const state = new GameState();

import { events } from './events.js';
import { STARTING_SCORE, STARTING_LIVES } from './config.js';

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
        this._isPaused   = false;
        this._level      = 1;
        this._combo      = 0;
        this._maxCombo   = 0;

        // Active powerups
        this.activePowerups = {
            widePaddle:   false,
            slowBall:     false,
            multiball:    false,
            laserPaddle:  false,
        };
    }

    // --- Score ---
    get score() { return this._score; }
    set score(val) {
        this._score = Math.max(0, val);
        events.emit('scoreChanged', this._score);
    }

    addScore(n) {
        this._combo++;
        if (this._combo > this._maxCombo) this._maxCombo = this._combo;
        const multiplier = Math.min(this._combo, 8);
        this.score += n * multiplier;
    }

    resetCombo() { this._combo = 0; }

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

    loseLife() {
        this.resetCombo();
        this.lives -= 1;
        events.emit('ballLost');
    }

    // --- Level ---
    get level() { return this._level; }
    set level(val) { this._level = val; }

    // --- Flags ---
    get isGameOver() { return this._isGameOver; }
    get isPaused()   { return this._isPaused; }
    set isPaused(v)  { this._isPaused = v; }
    get combo()      { return this._combo; }
}

export const state = new GameState();

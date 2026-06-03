import { events } from './events.js';
import { STARTING_SCORE, STARTING_LIVES } from './config.js';

/**
 * Global game state.
 * Setters auto-emit events so the UI stays in sync.
 * Call state.reset() on game restart.
 */
class GameState {
    constructor() {
        this.reset();
    }

    reset() {
        this._score      = STARTING_SCORE;
        this._lives      = STARTING_LIVES;
        this._wave       = 1;
        this._isGameOver = false;
        this._isPaused   = false;

        // TODO: add game-specific state properties here
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

    // --- Wave ---
    get wave() { return this._wave; }
    set wave(val) {
        this._wave = Math.max(1, val);
        events.emit('waveChanged', this._wave);
    }

    nextWave() { this.wave += 1; }

    // --- Flags ---
    get isGameOver() { return this._isGameOver; }
    get isPaused()   { return this._isPaused; }
    set isPaused(v)  { this._isPaused = v; }
}

export const state = new GameState();

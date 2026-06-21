import { events } from './events.js';
import { STARTING_SCORE, STARTING_LIVES, PLAYER_HP_MAX, STARTING_DEPTH } from './config.js';

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

        this.playerTile  = { x: 1, z: 1 };
        this.facing      = 0;

        this._hp         = PLAYER_HP_MAX;
        this._hpMax      = PLAYER_HP_MAX;
        this._depth      = STARTING_DEPTH;
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

    // --- Flags ---
    get isGameOver() { return this._isGameOver; }
    get isPaused()   { return this._isPaused; }
    set isPaused(v)  { this._isPaused = v; }
}

export const state = new GameState();

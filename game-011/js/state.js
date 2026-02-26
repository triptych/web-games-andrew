import { events } from './events.js';
import { STARTING_SCORE, STARTING_LIVES, SHOTS_PER_PUZZLE, TOTAL_LEVELS } from './config.js';

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

        // --- Nonogram Fleet specific ---
        this._level         = 1;
        this._shotsLeft     = SHOTS_PER_PUZZLE;
        this._shipsRemaining = 0;   // how many ships still afloat on current level

        // Player's nonogram fill state: 2D array [row][col] -> 'filled'|'empty'|null
        this._playerGrid = null;

        // Enemy hidden grid: 2D array [row][col] -> shipName or null
        this._enemyGrid  = null;

        // Revealed cells: 2D array [row][col] -> 'hit'|'miss'|null
        this._revealed   = null;
    }

    /**
     * Reset only the per-level state (shots, grids) without touching
     * score, lives, or level number.  Used when transitioning between levels
     * or retrying the same level.
     */
    resetLevel() {
        this._isPaused       = false;
        this._shotsLeft      = SHOTS_PER_PUZZLE;
        this._shipsRemaining = 0;
        this._playerGrid     = null;
        this._enemyGrid      = null;
        this._revealed       = null;
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

    // --- Flags ---
    get isGameOver() { return this._isGameOver; }
    get isPaused()   { return this._isPaused; }
    set isPaused(v)  { this._isPaused = v; }

    // --- Level ---
    get level() { return this._level; }
    set level(v) {
        this._level = Math.min(v, TOTAL_LEVELS);
    }
    nextLevel() { this.level += 1; }

    // --- Shots ---
    get shotsLeft() { return this._shotsLeft; }
    set shotsLeft(v) {
        this._shotsLeft = Math.max(0, v);
        events.emit('shotsChanged', this._shotsLeft);
        if (this._shotsLeft <= 0 && this._shipsRemaining > 0) {
            events.emit('puzzleFailed');
        }
    }
    useShot() { this.shotsLeft -= 1; }

    // --- Ships ---
    get shipsRemaining() { return this._shipsRemaining; }
    set shipsRemaining(v) { this._shipsRemaining = Math.max(0, v); }
    sinkShip(name) {
        this._shipsRemaining = Math.max(0, this._shipsRemaining - 1);
        events.emit('shipSunk', name);
        if (this._shipsRemaining === 0) {
            events.emit('levelComplete');
        }
    }

    // --- Grids ---
    get playerGrid() { return this._playerGrid; }
    set playerGrid(g) { this._playerGrid = g; }

    get enemyGrid() { return this._enemyGrid; }
    set enemyGrid(g) { this._enemyGrid = g; }

    get revealed() { return this._revealed; }
    set revealed(g) { this._revealed = g; }
}

export const state = new GameState();

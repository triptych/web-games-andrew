import { events } from './events.js';
import { STARTING_SCORE, STARTING_GOLD, GRID_COLS, GRID_ROWS } from './config.js';

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
        this._gold       = STARTING_GOLD;
        this._isPaused   = false;
        this._selectedTool = 'road';

        // 2D grid: null = empty, string = building type key
        this._grid = Array.from({ length: GRID_ROWS }, () => Array(GRID_COLS).fill(null));

        // Map<"col,row", bonusAmount> — tracks active adjacency bonuses
        this._adjacencyBonuses = new Map();

        // Phase 3
        this._population = 0;
        this._happiness  = 0;   // 0.0 – 1.0
    }

    // --- Score ---
    get score() { return this._score; }
    set score(val) {
        this._score = Math.max(0, val);
        events.emit('scoreChanged', this._score);
    }

    addScore(n) { this.score += n; }

    // --- Gold ---
    get gold() { return this._gold; }
    set gold(val) {
        this._gold = Math.max(0, val);
        events.emit('goldChanged', this._gold);
    }

    spendGold(n) {
        if (this._gold < n) return false;
        this.gold -= n;
        return true;
    }

    // --- Selected tool ---
    get selectedTool() { return this._selectedTool; }
    set selectedTool(v) {
        this._selectedTool = v;
        events.emit('selectedToolChanged', v);
    }

    // --- Grid ---
    getTile(col, row) {
        if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return undefined;
        return this._grid[row][col];
    }

    setTile(col, row, type) {
        if (col < 0 || col >= GRID_COLS || row < 0 || row >= GRID_ROWS) return;
        this._grid[row][col] = type;
    }

    // --- Adjacency bonuses ---
    get adjacencyBonuses() { return this._adjacencyBonuses; }
    set adjacencyBonuses(map) { this._adjacencyBonuses = map; }

    // --- Population ---
    get population() { return this._population; }
    set population(val) {
        this._population = Math.max(0, val);
        events.emit('populationChanged', this._population);
    }

    // --- Happiness (0.0 – 1.0) ---
    get happiness() { return this._happiness; }
    set happiness(val) {
        this._happiness = Math.min(1, Math.max(0, val));
        events.emit('happinessChanged', this._happiness);
    }

    // --- Gold income (called by income tick) ---
    addGold(n) {
        this.gold += n;
    }

    // --- Flags ---
    get isPaused()  { return this._isPaused; }
    set isPaused(v) { this._isPaused = v; }
}

export const state = new GameState();

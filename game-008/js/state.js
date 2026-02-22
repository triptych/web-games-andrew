import { events } from './events.js';
import { STARTING_GOLD, STARTING_LIVES, STARTING_SCORE, SMART_BOMBS_PER_WAVE } from './config.js';

/**
 * Global game state.
 * Setters automatically emit events so UI and other systems stay in sync.
 * Call state.reset() to restart the game.
 */
class GameState {
    constructor() {
        this.reset();
    }

    reset() {
        this._score      = STARTING_SCORE;
        this._gold       = STARTING_GOLD;
        this._lives      = STARTING_LIVES;
        this._wave       = 0;
        this._isGameOver = false;
        this._isPaused   = false;
        this._isWaveActive = false;

        // Tower type currently selected in the shop for placement
        this.selectedTower = null;

        // Nodes: Map of "col,row" → { hp: number, poisoned: boolean }
        this.nodes = new Map();

        // Towers: Map of "col,row" → tower object (added in Phase 4)
        this.towers = new Map();

        // Burned slots: Set of "col,row" strings for tower slots destroyed by enemies.
        // These slots can never have a new tower placed on them.
        this.burnedSlots = new Set();

        // Active centipede chains (added in Phase 2)
        this.centipedes = [];

        // Non-centipede enemies (added in Phase 5)
        this.enemies = [];

        // Smart bombs remaining this wave
        this.smartBombs = SMART_BOMBS_PER_WAVE;

        // Per-wave kill tracking for gold/score bonuses
        this.waveKills = 0;
        this.waveDeaths = 0;  // lives lost this wave (for no-death bonus)
    }

    // --- Score ---
    get score() { return this._score; }
    set score(val) {
        this._score = Math.max(0, val);
        events.emit('scoreChanged', this._score);
    }

    // --- Gold ---
    get gold() { return this._gold; }
    set gold(val) {
        this._gold = Math.max(0, val);
        events.emit('goldChanged', this._gold);
    }

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

    // --- Wave ---
    get wave() { return this._wave; }
    set wave(val) {
        this._wave = val;
        events.emit('waveChanged', this._wave);
    }

    // --- Flags ---
    get isGameOver()    { return this._isGameOver; }
    get isPaused()      { return this._isPaused; }
    get isWaveActive()  { return this._isWaveActive; }

    set isPaused(val)     { this._isPaused = val; }
    set isWaveActive(val) { this._isWaveActive = val; }

    // --- Helpers ---
    canAfford(cost) {
        return this._gold >= cost;
    }

    spend(amount) {
        if (!this.canAfford(amount)) return false;
        this.gold -= amount;
        return true;
    }

    earn(amount) {
        this.gold += amount;
    }

    addScore(points) {
        this.score += points;
    }

    // --- Node helpers ---
    getNode(col, row) {
        return this.nodes.get(`${col},${row}`);
    }

    setNode(col, row, data) {
        this.nodes.set(`${col},${row}`, data);
    }

    removeNode(col, row) {
        this.nodes.delete(`${col},${row}`);
    }

    hasNode(col, row) {
        return this.nodes.has(`${col},${row}`);
    }

    // --- Tower helpers ---
    getTower(col, row) {
        return this.towers.get(`${col},${row}`);
    }

    setTower(col, row, tower) {
        this.towers.set(`${col},${row}`, tower);
    }

    removeTower(col, row) {
        this.towers.delete(`${col},${row}`);
    }

    hasTower(col, row) {
        return this.towers.has(`${col},${row}`);
    }
}

/** Singleton state shared across all modules. */
export const state = new GameState();

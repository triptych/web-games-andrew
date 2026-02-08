import { events } from './events.js';
import { STARTING_GOLD, STARTING_LIVES, WAVE_DEFS } from './config.js';

class GameState {
    constructor() {
        this._gold = STARTING_GOLD;
        this._lives = STARTING_LIVES;
        this._wave = 0;
        this._isWaveActive = false;
        this._placingType = null;
        this._selectedTower = null;
        this._isGameOver = false;
        this._isVictory = false;
        this._enemiesAlive = 0;
        this._enemiesSpawnedThisWave = 0;
        this._totalEnemiesThisWave = 0;
        this.occupiedCells = new Set();
    }

    get gold() { return this._gold; }
    set gold(val) {
        this._gold = Math.max(0, val);
        events.emit('goldChanged', this._gold);
    }

    get lives() { return this._lives; }
    set lives(val) {
        this._lives = Math.max(0, val);
        events.emit('livesChanged', this._lives);
        if (this._lives <= 0 && !this._isGameOver) {
            this._isGameOver = true;
            events.emit('gameOver');
        }
    }

    get wave() { return this._wave; }
    set wave(val) {
        this._wave = val;
        events.emit('waveChanged', this._wave);
    }

    get isWaveActive() { return this._isWaveActive; }
    set isWaveActive(val) { this._isWaveActive = val; }

    get placingType() { return this._placingType; }
    set placingType(val) {
        this._placingType = val;
        if (val) {
            events.emit('placementStarted', val);
        } else {
            events.emit('placementCancelled');
        }
    }

    get selectedTower() { return this._selectedTower; }
    set selectedTower(val) {
        this._selectedTower = val;
        if (val) {
            events.emit('towerSelected', val);
        } else {
            events.emit('towerDeselected');
        }
    }

    get isGameOver() { return this._isGameOver; }
    get isVictory() { return this._isVictory; }

    get enemiesAlive() { return this._enemiesAlive; }
    set enemiesAlive(val) {
        this._enemiesAlive = val;
        if (val <= 0 && this._isWaveActive &&
            this._enemiesSpawnedThisWave >= this._totalEnemiesThisWave) {
            this._isWaveActive = false;
            events.emit('waveCompleted', this._wave);
            if (this._wave >= WAVE_DEFS.length && !this._isVictory) {
                this._isVictory = true;
                events.emit('gameWon');
            }
        }
    }

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

    occupyCell(col, row) {
        this.occupiedCells.add(`${col},${row}`);
    }

    isCellOccupied(col, row) {
        return this.occupiedCells.has(`${col},${row}`);
    }
}

export const state = new GameState();

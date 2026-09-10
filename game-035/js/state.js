import { events } from './events.js';
import {
    STARTING_SCORE, STARTING_SHIELDS,
    BASE_FORWARD_SPEED, MAX_FORWARD_SPEED, SPEED_PER_KILL, SPEED_DECAY,
    STARS_FOR_BONUS_ROUND,
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
        this._score       = STARTING_SCORE;
        this._multiplier   = 1;
        this._shields      = STARTING_SHIELDS;
        this._stars        = 0;
        this._forwardSpeed = BASE_FORWARD_SPEED;
        this._isGameOver   = false;
        this._isPaused     = false;
        this._inBonusRound = false;
        this._weapon       = 'blaster';
        this._survivalTime = 0;
        this._killCount    = 0;
    }

    // --- Score ---
    get score() { return this._score; }
    set score(val) {
        this._score = Math.max(0, Math.floor(val));
        events.emit('scoreChanged', this._score);
    }
    addScore(n) { this.score += Math.round(n * this._multiplier); }

    // --- Multiplier ---
    get multiplier() { return this._multiplier; }
    set multiplier(v) {
        this._multiplier = Math.max(1, v);
        events.emit('multiplierChanged', this._multiplier);
    }
    bumpMultiplier(n = 1) { this.multiplier += n; }
    resetMultiplier() { this.multiplier = 1; }

    // --- Shields (lives, N2O-style — collected via ripened mushrooms) ---
    get shields() { return this._shields; }
    set shields(val) {
        this._shields = Math.max(0, val);
        events.emit('shieldsChanged', this._shields);
        if (this._shields <= 0 && !this._isGameOver) {
            this._isGameOver = true;
            events.emit('gameOver');
        }
    }
    loseShield() { this.shields -= 1; }
    gainShield(n = 1) { this.shields += n; }

    // --- Forward speed (ramps up on kill, N2O signature mechanic) ---
    get forwardSpeed() { return this._forwardSpeed; }
    onKill() {
        this._killCount++;
        this._forwardSpeed = Math.min(MAX_FORWARD_SPEED, this._forwardSpeed + SPEED_PER_KILL);
        events.emit('speedChanged', this._forwardSpeed);
    }
    decaySpeed(dt) {
        if (this._forwardSpeed > BASE_FORWARD_SPEED) {
            this._forwardSpeed = Math.max(BASE_FORWARD_SPEED, this._forwardSpeed - SPEED_DECAY * dt);
            events.emit('speedChanged', this._forwardSpeed);
        }
    }

    // --- Bonus stars ---
    get stars() { return this._stars; }
    addStar() {
        if (this._inBonusRound) return; // stars already spent triggering this round
        this._stars++;
        events.emit('starsChanged', this._stars);
        if (this._stars >= STARS_FOR_BONUS_ROUND) {
            this._stars = 0;
            events.emit('starsChanged', this._stars);
            this._inBonusRound = true;
            events.emit('bonusRoundStart');
        }
    }
    endBonusRound(bonusScore) {
        this._inBonusRound = false;
        this.addScore(bonusScore);
        events.emit('bonusRoundEnd', bonusScore);
    }

    // --- Weapon ---
    get weapon() { return this._weapon; }
    set weapon(name) {
        this._weapon = name;
        events.emit('weaponChanged', name);
    }

    // --- Flags ---
    get isGameOver()   { return this._isGameOver; }
    get isPaused()     { return this._isPaused; }
    set isPaused(v)    { this._isPaused = v; }
    get inBonusRound() { return this._inBonusRound; }
}

export const state = new GameState();

import { events } from './events.js';

/**
 * GameState singleton (game-plan §state.js).
 *
 * Phase 1 holds only the puzzle-loop state: score, combo (lines per single
 * placement) and streak (consecutive clearing placements). Element stores,
 * unlocked tile types, currency, XP, etc. arrive in later phases.
 *
 * Setters auto-emit so the HUD stays in sync. Call state.reset() on restart.
 */
class GameState {
    constructor() {
        this.reset();
    }

    reset() {
        this._score    = 0;
        this._combo    = 0;   // lines cleared by the most recent placement
        this._streak   = 0;   // consecutive placements that each cleared ≥1 line
        this._maxCombo = 0;
        this._failed   = false;
    }

    // --- Score (§3) ---
    get score() { return this._score; }
    set score(val) {
        this._score = Math.max(0, val);
        events.emit('scoreChanged', this._score);
    }

    // --- Combo (within one placement) & streak (across placements) (§3) ---
    get combo()  { return this._combo; }
    get streak() { return this._streak; }
    get maxCombo() { return this._maxCombo; }

    /**
     * Apply the result of a placement to combo/streak.
     * @param {number} linesThisPlacement — rows+cols cleared by this placement.
     */
    applyPlacement(linesThisPlacement) {
        this._combo = linesThisPlacement;
        if (linesThisPlacement > this._maxCombo) this._maxCombo = linesThisPlacement;
        if (linesThisPlacement > 0) {
            this._streak += 1;
        } else {
            this._streak = 0;   // a no-clear placement breaks the streak
        }
        events.emit('comboChanged',  { combo: this._combo });
        events.emit('streakChanged', { streak: this._streak });
    }

    // --- Flags ---
    get failed() { return this._failed; }
    set failed(v) { this._failed = v; }
}

export const state = new GameState();

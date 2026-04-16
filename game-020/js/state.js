import { events } from './events.js';
import { STARTING_SCORE, STARTING_LIVES, RIVER_SEGMENTS } from './config.js';

/**
 * Global game state for The River.
 * Setters auto-emit events so UI stays in sync.
 * Call state.reset() on game restart.
 *
 * Key state concepts:
 *   - companions: travelers who have joined the boat (max 6)
 *   - ingredients: items collected along the river
 *   - riverSegment: current position on the river (0 = start, RIVER_SEGMENTS = tower)
 *   - runSeed: random seed for this run (determines encounter ordering)
 *   - newsHistory: log of tower broadcasts received this run
 */
class GameState {
    constructor() {
        this.reset();
    }

    reset() {
        this._score         = STARTING_SCORE;
        this._lives         = STARTING_LIVES;
        this._isGameOver    = false;
        this._isPaused      = false;
        this._isWon         = false;

        // River journey
        this._riverSegment  = 0;
        this._companions    = [];       // array of companion def objects
        this._ingredients   = [];       // array of ingredient def objects
        this._runSeed       = Math.floor(Math.random() * 1_000_000);
        this._newsHistory   = [];       // array of { text, turn } objects

        // Dinner result (set at the end)
        this._dinnerScore   = null;
        this._dinnerOutcome = null;
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
    get isWon()      { return this._isWon; }

    // --- River journey ---
    get riverSegment() { return this._riverSegment; }
    advanceRiver() {
        this._riverSegment = Math.min(this._riverSegment + 1, RIVER_SEGMENTS);
        events.emit('riverAdvanced', this._riverSegment);
    }

    // --- Companions ---
    get companions() { return [...this._companions]; }
    get companionCount() { return this._companions.length; }

    addCompanion(companionDef) {
        this._companions.push({ ...companionDef });
        events.emit('companionInvited', companionDef);
    }

    hasSkill(skill) {
        return this._companions.some(c => c.skills.includes(skill));
    }

    skillCount(skill) {
        return this._companions.reduce((n, c) => n + (c.skills.includes(skill) ? 1 : 0), 0);
    }

    // --- Ingredients ---
    get ingredients() { return [...this._ingredients]; }
    get ingredientCount() { return this._ingredients.length; }

    addIngredient(ingredientDef) {
        this._ingredients.push({ ...ingredientDef });
        events.emit('ingredientCollected', ingredientDef);
    }

    countIngredientsByCategory(category) {
        return this._ingredients.filter(i => i.category === category).length;
    }

    // --- News / hints ---
    get newsHistory() { return [...this._newsHistory]; }
    addNews(text) {
        const item = { text, turn: this._riverSegment };
        this._newsHistory.push(item);
        events.emit('newsReceived', item);
    }

    // --- Run seed (for reproducible randomness) ---
    get runSeed() { return this._runSeed; }

    // --- Dinner ---
    get dinnerScore()   { return this._dinnerScore; }
    get dinnerOutcome() { return this._dinnerOutcome; }
    setDinnerResult(score, outcome) {
        this._dinnerScore   = score;
        this._dinnerOutcome = outcome;
        this._isWon = true;
        events.emit('dinnerScored', { score, outcome });
    }
}

export const state = new GameState();

import { events } from './events.js';
import { STARTING_SCORE, STARTING_LIVES, BASE_PLAYER_HP, BASE_PLAYER_ATK, BASE_PLAYER_DEF } from './config.js';

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

        // Player stats
        this._floor       = 1;
        this._playerHp    = BASE_PLAYER_HP;
        this._playerMaxHp = BASE_PLAYER_HP;
        this._playerAtk   = BASE_PLAYER_ATK;
        this._playerDef   = BASE_PLAYER_DEF;
        this._playerLevel = 1;
        this._playerXp    = 0;
        this._xpToNext    = 20;

        // Player position (grid coords) and facing (0=N,1=E,2=S,3=W)
        this.playerX      = 1;
        this.playerY      = 1;
        this.playerFacing = 2; // start facing South

        // Inventory / items (arrays of item objects)
        this.inventory    = [];
        this.gold         = 0;

        // Active enemies on current floor (managed by DungeonScene)
        this.enemies      = [];

        // Combat state
        this._inCombat    = false;
        this.combatEnemy  = null;

        // Status effects (turn counters)
        this.poisonTurns  = 0;
        this.stunTurns    = 0;

        // Message log
        this.log          = [];
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

    // --- Floor ---
    get floor() { return this._floor; }
    set floor(v) {
        this._floor = v;
        events.emit('floorChanged', v);
    }

    // --- Player HP ---
    get playerHp()    { return this._playerHp; }
    get playerMaxHp() { return this._playerMaxHp; }
    set playerHp(v) {
        this._playerHp = Math.max(0, Math.min(this._playerMaxHp, v));
        if (this._playerHp <= 0 && !this._isGameOver) {
            this._isGameOver = true;
            events.emit('gameOver');
        }
    }
    healPlayer(n) { this.playerHp += n; }
    damagePlayer(n) { this.playerHp -= Math.max(0, n - this._playerDef); }

    // --- XP / Level ---
    gainXp(n) {
        this._playerXp += n;
        while (this._playerXp >= this._xpToNext) {
            this._playerXp -= this._xpToNext;
            this._playerLevel++;
            this._xpToNext = Math.floor(this._xpToNext * 1.6);
            this._playerMaxHp += 5;
            this._playerHp = this._playerMaxHp;
            this._playerAtk += 2;
            this._playerDef += 1;
            this.addMessage(`Level up! Now level ${this._playerLevel}.`);
        }
    }

    // --- Combat ---
    get inCombat() { return this._inCombat; }
    startCombat(enemy) {
        this._inCombat   = true;
        this.combatEnemy = enemy;
        events.emit('combatStart', { enemy });
    }
    endCombat() {
        this._inCombat   = false;
        this.combatEnemy = null;
        events.emit('combatEnd');
    }

    // --- Message log ---
    addMessage(text) {
        this.log.unshift(text);
        if (this.log.length > 20) this.log.pop();
        events.emit('logMessage', text);
    }

    // --- Flags ---
    get isGameOver() { return this._isGameOver; }
    get isPaused()   { return this._isPaused; }
    set isPaused(v)  { this._isPaused = v; }
}

export const state = new GameState();

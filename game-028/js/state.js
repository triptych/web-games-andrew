import { events } from './events.js';
import {
    STARTING_SCORE, STARTING_LIVES,
    STARTING_HP, STARTING_MP,
    STARTING_GOLD, STARTING_LEVEL, STARTING_XP, XP_PER_LEVEL,
    STARTING_PARTY,
} from './config.js';

/**
 * Global game state.
 * Setters auto-emit events so UI stays in sync.
 * Call state.reset() on new game.
 */
class GameState {
    constructor() {
        this.reset();
    }

    reset() {
        this._score      = STARTING_SCORE;
        this._lives      = STARTING_LIVES;
        this._gold       = STARTING_GOLD;
        this._xp         = STARTING_XP;
        this._level      = STARTING_LEVEL;
        this._isGameOver = false;
        this._isPaused   = false;

        // Chapter / story progress
        this._chapter     = 1;
        this._storyFlags  = {};   // { flagName: true/false/value }

        // Party & inventory
        this._party     = [...STARTING_PARTY];   // array of character ids in active party
        this._inventory = [];                     // array of item objects { id, qty, ... }

        // Quests
        this._quests = {
            active:    [],   // array of quest ids
            completed: [],   // array of quest ids
        };

        // Current map
        this._currentMap  = 'thornhaven';
        this._playerTileX = 9;
        this._playerTileY = 7;
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

    // --- Gold ---
    get gold() { return this._gold; }
    set gold(val) {
        this._gold = Math.max(0, val);
        events.emit('goldChanged', this._gold);
    }
    addGold(n)  { this.gold += n; }
    spendGold(n){ this.gold -= n; }

    // --- XP / Level ---
    get xp()    { return this._xp; }
    get level() { return this._level; }

    addXP(n) {
        this._xp += n;
        events.emit('xpChanged', this._xp);
        while (this._xp >= XP_PER_LEVEL * this._level) {
            this._xp -= XP_PER_LEVEL * this._level;
            this._level++;
            events.emit('levelUp', this._level);
        }
    }

    // --- Chapter / story flags ---
    get chapter() { return this._chapter; }
    setChapter(n) { this._chapter = n; }

    setFlag(name, value = true) { this._storyFlags[name] = value; }
    getFlag(name)               { return this._storyFlags[name]; }

    // --- Party ---
    get party() { return this._party; }
    addToParty(id)      { if (!this._party.includes(id)) { this._party.push(id); events.emit('partyChanged', this._party); } }
    removeFromParty(id) { this._party = this._party.filter(x => x !== id); events.emit('partyChanged', this._party); }

    // --- Inventory ---
    get inventory() { return this._inventory; }

    addItem(item) {
        const existing = this._inventory.find(i => i.id === item.id);
        if (existing) {
            existing.qty = (existing.qty || 1) + (item.qty || 1);
        } else {
            this._inventory.push({ ...item, qty: item.qty || 1 });
        }
        events.emit('itemAdded', item);
    }

    removeItem(id, qty = 1) {
        const idx = this._inventory.findIndex(i => i.id === id);
        if (idx === -1) return false;
        this._inventory[idx].qty -= qty;
        if (this._inventory[idx].qty <= 0) this._inventory.splice(idx, 1);
        return true;
    }

    hasItem(id) { return this._inventory.some(i => i.id === id && i.qty > 0); }

    // --- Quests ---
    get quests() { return this._quests; }

    acceptQuest(id) {
        if (!this._quests.active.includes(id) && !this._quests.completed.includes(id)) {
            this._quests.active.push(id);
            events.emit('questAccepted', id);
        }
    }

    completeQuest(id) {
        this._quests.active = this._quests.active.filter(q => q !== id);
        if (!this._quests.completed.includes(id)) {
            this._quests.completed.push(id);
            events.emit('questCompleted', id);
        }
    }

    hasQuest(id)      { return this._quests.active.includes(id) || this._quests.completed.includes(id); }
    isQuestDone(id)   { return this._quests.completed.includes(id); }

    // --- Map position ---
    get currentMap()  { return this._currentMap; }
    get playerTileX() { return this._playerTileX; }
    get playerTileY() { return this._playerTileY; }
    setMap(mapId, tx, ty) { this._currentMap = mapId; this._playerTileX = tx; this._playerTileY = ty; }

    // --- Flags ---
    get isGameOver() { return this._isGameOver; }
    get isPaused()   { return this._isPaused; }
    set isPaused(v)  { this._isPaused = v; }
}

export const state = new GameState();

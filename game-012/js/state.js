import { events } from './events.js';
import { STARTING_SCORE, STARTING_LIVES, STARTING_GEMS, PITY_THRESHOLD, READING_WAVES, MAX_ITEMS } from './config.js';

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
        this._gems       = STARTING_GEMS;
        this._isGameOver = false;
        this._isPaused   = false;

        // Gacha
        this._pullCount    = 0;   // total pulls since last Legendary (pity counter)
        this._collection   = [];  // all cards owned (card def objects)
        this._party        = [];  // active battle party (up to MAX_PARTY_SIZE cards)

        // Battle
        this._wave         = 1;
        this._inBattle     = false;

        // Omen (The Reading)
        this._activeOmen      = null;   // { id, type, label, effect, wavesLeft }
        this._omenWavesLeft   = 0;
        this._items           = [];     // consumable items (max MAX_ITEMS)
        this._pityFrozen      = false;  // curse: pity counter frozen
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

    // --- Gems (gacha currency) ---
    get gems() { return this._gems; }
    set gems(val) {
        this._gems = Math.max(0, val);
        events.emit('gemsChanged', this._gems);
    }
    spendGems(n) { this.gems -= n; }
    earnGems(n)  { this.gems += n; }

    // --- Pity counter ---
    get pullCount() { return this._pullCount; }
    incrementPull() {
        if (!this._pityFrozen) this._pullCount++;
    }
    resetPity() {
        this._pullCount = 0;
    }
    get isPityReady() {
        return this._pullCount >= PITY_THRESHOLD;
    }

    // --- Collection ---
    get collection() { return this._collection; }
    addCard(cardDef) {
        this._collection.push({ ...cardDef, uid: Date.now() + Math.random() });
        events.emit('cardPulled', cardDef);
    }

    // --- Party ---
    get party() { return this._party; }
    setParty(cards) {
        this._party = cards;
        events.emit('partyChanged', this._party);
    }
    addToParty(card) {
        if (this._party.length < 4) {
            this._party.push(card);
            events.emit('partyChanged', this._party);
        }
    }
    removeFromParty(uid) {
        this._party = this._party.filter(c => c.uid !== uid);
        events.emit('partyChanged', this._party);
    }

    // --- Battle ---
    get wave() { return this._wave; }
    set wave(n) { this._wave = n; }
    get inBattle() { return this._inBattle; }
    set inBattle(v) { this._inBattle = v; }

    // --- Omen / Reading ---
    get activeOmen()    { return this._activeOmen; }
    get omenWavesLeft() { return this._omenWavesLeft; }
    get pityFrozen()    { return this._pityFrozen; }

    applyOmen(omenDef) {
        this._activeOmen    = omenDef;
        this._omenWavesLeft = 5;
        this._pityFrozen    = omenDef && omenDef.id === 'cursed';
        events.emit('omenApplied', omenDef);
    }

    tickOmen() {
        if (!this._activeOmen) return;
        this._omenWavesLeft--;
        if (this._omenWavesLeft <= 0) {
            const expiredId = this._activeOmen.id;
            this._activeOmen    = null;
            this._omenWavesLeft = 0;
            this._pityFrozen    = false;
            events.emit('omenExpired', expiredId);
        }
    }

    /** Check if wave n should trigger a reading (waves 5 and 10). */
    isReadingWave(waveJustCleared) {
        return READING_WAVES.includes(waveJustCleared);
    }

    // --- Items ---
    get items() { return this._items; }

    addItem(itemDef) {
        if (this._items.length >= MAX_ITEMS) return false;
        this._items.push({ ...itemDef });
        return true;
    }

    useItem(itemId) {
        const idx = this._items.findIndex(i => i.id === itemId);
        if (idx === -1) return null;
        const item = this._items.splice(idx, 1)[0];
        events.emit('itemUsed', item);
        return item;
    }

    // --- Flags ---
    get isGameOver() { return this._isGameOver; }
    get isPaused()   { return this._isPaused; }
    set isPaused(v)  { this._isPaused = v; }
}

export const state = new GameState();

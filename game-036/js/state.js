import { events } from './events.js';
import { BOOK_COUNT, ARTIFACT_COUNT } from './config.js';

/**
 * Global game state.
 *
 * Collections are two-stage: items picked up out in the world are *carried*,
 * and only count toward completion once deposited at the library (books) or
 * museum (artifacts). This is what makes the island a round trip rather than
 * a checklist — you have to bring things home.
 */
class GameState {
    constructor() { this.reset(); }

    reset() {
        this._carriedBooks = 0;
        this._carriedArtifacts = 0;
        this._booksShelved = 0;
        this._artifactsDisplayed = 0;
        this.collectedIds = new Set();
        this._isPaused = false;
        this._complete = false;
        this.currentRegion = '';
    }

    // --- Carried (found, not yet returned) ---
    get carriedBooks() { return this._carriedBooks; }
    get carriedArtifacts() { return this._carriedArtifacts; }

    // --- Deposited (counts toward completion) ---
    get booksShelved() { return this._booksShelved; }
    get artifactsDisplayed() { return this._artifactsDisplayed; }

    get booksTotal() { return BOOK_COUNT; }
    get artifactsTotal() { return ARTIFACT_COUNT; }
    get isComplete() { return this._complete; }
    get isPaused() { return this._isPaused; }
    set isPaused(v) { this._isPaused = v; }

    collectBook(id) {
        if (this.collectedIds.has(id)) return;
        this.collectedIds.add(id);
        this._carriedBooks++;
        this._emitProgress();
    }

    collectArtifact(id) {
        if (this.collectedIds.has(id)) return;
        this.collectedIds.add(id);
        this._carriedArtifacts++;
        this._emitProgress();
    }

    depositBooks() {
        this._booksShelved += this._carriedBooks;
        this._carriedBooks = 0;
        this._emitProgress();
        this._checkComplete();
    }

    depositArtifacts() {
        this._artifactsDisplayed += this._carriedArtifacts;
        this._carriedArtifacts = 0;
        this._emitProgress();
        this._checkComplete();
    }

    _emitProgress() {
        events.emit('progressChanged', {
            carriedBooks: this._carriedBooks,
            carriedArtifacts: this._carriedArtifacts,
            booksShelved: this._booksShelved,
            artifactsDisplayed: this._artifactsDisplayed,
            booksTotal: BOOK_COUNT,
            artifactsTotal: ARTIFACT_COUNT,
        });
    }

    _checkComplete() {
        if (!this._complete
            && this._booksShelved >= BOOK_COUNT
            && this._artifactsDisplayed >= ARTIFACT_COUNT) {
            this._complete = true;
            events.emit('gameComplete');
        }
    }

    setRegion(name) {
        if (name !== this.currentRegion) {
            this.currentRegion = name;
            events.emit('regionEntered', name);
        }
    }
}

export const state = new GameState();

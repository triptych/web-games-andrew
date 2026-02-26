/**
 * EventBus — lightweight pub/sub for cross-module communication.
 *
 * Usage:
 *   import { events } from './events.js';
 *
 *   const off = events.on('someEvent', (data) => { ... });
 *   off();                        // unsubscribe
 *   events.emit('someEvent', data);
 *   events.clearAll();            // call in k.onSceneLeave()
 *
 * Event catalog:
 *   scoreChanged(newScore)
 *   livesChanged(newLives)
 *   shotsChanged(remaining)
 *   cellFilled(row, col)          — player filled a nonogram cell
 *   cellCleared(row, col)         — player un-filled a cell
 *   shotFired(row, col)           — player fired at enemy grid cell
 *   shipHit(row, col, shipName)   — shot connected with a ship segment
 *   shipSunk(shipName)            — all segments of a ship destroyed
 *   puzzleSolved()                — nonogram completely and correctly solved
 *   puzzleFailed()                — ran out of shots before solving
 *   levelComplete()               — all ships sunk on current level
 *   gameOver()
 *   gameWon()
 */
export class EventBus {
    constructor() {
        this._listeners = new Map();
    }

    on(event, fn) {
        if (!this._listeners.has(event)) {
            this._listeners.set(event, new Set());
        }
        this._listeners.get(event).add(fn);
        return () => this.off(event, fn);
    }

    off(event, fn) {
        const set = this._listeners.get(event);
        if (set) set.delete(fn);
    }

    emit(event, ...args) {
        const set = this._listeners.get(event);
        if (set) {
            for (const fn of set) fn(...args);
        }
    }

    clearAll() {
        this._listeners.clear();
    }
}

export const events = new EventBus();
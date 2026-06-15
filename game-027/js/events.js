/**
 * EventBus — lightweight pub/sub for cross-module communication.
 * (Matches the game-019 / repo convention.)
 *
 * Usage:
 *   import { events } from './events.js';
 *   const off = events.on('someEvent', (data) => { ... });
 *   off();                  // unsubscribe
 *   events.emit('someEvent', data);
 *   events.clearAll();      // call on scene shutdown
 *
 * Phase 1 event catalog (subset of game-plan §Event Catalog):
 *   shapePicked   {shapeId}
 *   shapePlaced   {shapeId, cells}
 *   placeInvalid  ()
 *   linesCleared  {rows, cols, cells, combo}
 *   scoreChanged  newScore
 *   comboChanged  {combo}     — lines cleared this placement
 *   streakChanged {streak}    — consecutive clearing placements
 *   setDealt      {shapes:[{slot, shapeId}]}
 *   supplyChanged {remaining}
 *   shapeNearlyStuck {shapeId, legalSpots}
 *   levelFailed   {reason:'jammed'}
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
            // copy to a snapshot so handlers can unsubscribe mid-emit safely
            for (const fn of [...set]) fn(...args);
        }
    }

    clearAll() {
        this._listeners.clear();
    }
}

export const events = new EventBus();

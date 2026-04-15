/**
 * EventBus — lightweight pub/sub for cross-module communication.
 *
 * Usage:
 *   import { events } from './events.js';
 *
 *   const off = events.on('someEvent', (data) => { ... });
 *   off();                        // unsubscribe
 *   events.emit('someEvent', data);
 *   events.clearAll();            // call on scene shutdown
 *
 * Event catalog:
 *   scoreChanged(newScore)
 *   livesChanged(newLives)
 *   gameOver()
 *   gameWon()
 *   brickDestroyed(x, y, color)
 *   ballLost()
 *   powerupCollected(type)
 *   levelComplete()
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

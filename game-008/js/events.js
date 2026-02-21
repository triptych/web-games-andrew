/**
 * EventBus — lightweight pub/sub for cross-module communication.
 *
 * Usage:
 *   import { events } from './events.js';
 *
 *   // Subscribe (returns an unsubscribe function)
 *   const off = events.on('goldChanged', (amount) => { ... });
 *
 *   // Unsubscribe
 *   off();
 *
 *   // Emit
 *   events.emit('goldChanged', state.gold);
 *
 *   // Cleanup all listeners (call in k.onSceneLeave)
 *   events.clearAll();
 *
 * Event catalog:
 *   segmentKilled(col, row, centipedeId)
 *   centipedeReachedBottom()
 *   playerHit()
 *   towerPlaced(type, col, row)
 *   towerSold(col, row)
 *   towerUpgraded(col, row)
 *   waveComplete(waveNumber)
 *   waveStarted(waveNumber)
 *   goldChanged(newAmount)
 *   scoreChanged(newScore)
 *   livesChanged(newLives)
 *   nodeDestroyed(col, row)
 *   nodePoisoned(col, row)
 *   nodeDamaged(col, row, hp)
 *   gameOver()
 *   gameWon()
 */
export class EventBus {
    constructor() {
        /** @type {Map<string, Set<Function>>} */
        this._listeners = new Map();
    }

    /**
     * Subscribe to an event.
     * @param {string} event
     * @param {Function} fn
     * @returns {Function} Unsubscribe function
     */
    on(event, fn) {
        if (!this._listeners.has(event)) {
            this._listeners.set(event, new Set());
        }
        this._listeners.get(event).add(fn);
        return () => this.off(event, fn);
    }

    /**
     * Unsubscribe a specific listener.
     * @param {string} event
     * @param {Function} fn
     */
    off(event, fn) {
        const set = this._listeners.get(event);
        if (set) set.delete(fn);
    }

    /**
     * Emit an event to all subscribers.
     * @param {string} event
     * @param {...any} args
     */
    emit(event, ...args) {
        const set = this._listeners.get(event);
        if (set) {
            for (const fn of set) {
                fn(...args);
            }
        }
    }

    /**
     * Remove ALL listeners (call when leaving a scene to prevent accumulation).
     */
    clearAll() {
        this._listeners.clear();
    }
}

/** Singleton EventBus shared across all modules. */
export const events = new EventBus();

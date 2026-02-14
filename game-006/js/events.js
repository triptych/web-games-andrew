/**
 * Event bus for cross-module communication
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
            for (const fn of set) {
                fn(...args);
            }
        }
    }

    clear() {
        this._listeners.clear();
    }
}

// Singleton event bus
export const events = new EventBus();

/*
 * Game Events Catalog (for future use):
 *
 * gamePaused()                    - Game paused
 * gameResumed()                   - Game resumed
 * gameStarted()                   - Game started
 * gameOver()                      - Game ended
 *
 * playerDamaged(damage)           - Player takes damage (future: enemies)
 * playerDied()                    - Player health reaches zero (future)
 *
 * doorOpened(doorId)              - Door opens (future)
 * itemCollected(itemType)         - Item picked up (future)
 */

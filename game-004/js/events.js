/**
 * Custom EventBus for cross-module communication.
 * Modules emit and listen to events without direct dependencies on each other.
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
}

// Singleton event bus shared across all modules
export const events = new EventBus();

/*
 * Event catalog:
 *
 * goldChanged(amount)        - Gold total changed
 * livesChanged(amount)       - Lives total changed
 * waveChanged(waveNum)       - Current wave number changed
 * waveStarted(waveNum)       - A wave has begun spawning
 * waveCompleted(waveNum)     - All enemies in wave defeated
 * enemySpawned(enemyObj)     - An enemy was spawned
 * enemyKilled(enemyObj)      - An enemy was killed
 * enemyReachedEnd(enemyObj)  - An enemy reached the exit
 * towerPlaced(towerObj)      - A tower was placed
 * towerSelected(towerObj)    - A tower was clicked/selected
 * towerDeselected()          - Tower selection cleared
 * placementStarted(type)     - Entered tower placement mode
 * placementCancelled()       - Cancelled tower placement
 * gameOver()                 - Lives reached zero
 * gameWon()                  - All waves completed
 */

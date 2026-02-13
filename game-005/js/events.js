// Event bus for cross-module communication

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
 * Game Events Catalog:
 *
 * playerDamaged(damage)           - Player takes damage
 * playerLevelUp(level)            - Player reaches new level
 * playerDied()                    - Player health reaches zero
 *
 * enemySpawned(enemy)             - Enemy enters the game
 * enemyKilled(enemy)              - Enemy destroyed
 * enemyDamaged(enemy, damage)     - Enemy takes damage
 *
 * xpGained(amount)                - XP collected
 * xpDropped(pos, amount)          - XP gem spawned
 *
 * upgradeSelected(upgrade)        - Player picks an upgrade
 * weaponUnlocked(weaponType)      - New weapon available
 *
 * waveChanged(waveNumber)         - New difficulty wave
 * bossSpawned(boss)               - Boss enemy appears
 *
 * gameOver(stats)                 - Game ended
 * gamePaused()                    - Game paused
 * gameResumed()                   - Game resumed
 * gameStarted()                   - Game started
 *
 * playerShoot(fromPos, toPos)     - Player fires weapon
 */

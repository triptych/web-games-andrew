/**
 * EventBus — lightweight pub/sub for cross-module communication.
 *
 * Usage:
 *   import { events } from './events.js';
 *
 *   const off = events.on('someEvent', (data) => { ... });
 *   off();                        // unsubscribe
 *   events.emit('someEvent', data);
 *   events.clearAll();            // call on scene teardown
 *
 * Event catalog:
 *   playerMoved(position)          — player 3D position changed
 *   playerHpChanged(hp, maxHp)     — player took damage or healed
 *   playerXpChanged(xp, xpNext)    — xp gained
 *   playerLevelUp(newLevel)        — levelled up
 *   playerGoldChanged(gold)        — gold amount changed
 *   resourceChanged(type, amount)  — a resource count changed
 *   monsterDied(def, position)     — monster killed, drops pending
 *   itemPickedUp(type, amount)     — resource collected from world
 *   buildingBuilt(id, level)       — village building constructed/upgraded
 *   modeChanged(mode)              — 'explore' | 'village'
 *   gameOver()                     — player died
 *   message(text, color)           — show a message in the log
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

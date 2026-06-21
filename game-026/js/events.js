/**
 * EventBus — lightweight pub/sub for cross-module communication.
 *
 * Usage:
 *   import { events } from './events.js';
 *
 *   const off = events.on('someEvent', (data) => { ... });
 *   off();                        // unsubscribe
 *   events.emit('someEvent', data);
 *   events.clearAll();            // call on game restart
 *
 * Event catalog:
 *   scoreChanged(newScore)
 *   livesChanged(newLives)
 *   gameOver()
 *   gameWon()
 *   playerMoved({x, z, facing})   — after a step or turn commits (and on spawn)
 *   tileEntered({x, z, tile})     — after a step commits; tile is the grid char
 *   stairsReached({x, z})         — player stepped onto a '>' tile
 *   hpChanged({cur, max})         — player HP changed
 *   depthChanged(newDepth)        — dungeon depth changed
 *   tileRevealed({x, z})          — tile first stepped into (fog-of-war reveal)
 *   logMessage(string)            — narrative message for the message log
 *   pickupGold()                  — loot/gold acquired (triggers HUD flash)
 *   damageTaken()                 — player took a hit (triggers vignette)
 *   TODO: combatStarted, combatEnded
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

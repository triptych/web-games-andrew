/**
 * EventBus — lightweight pub/sub for cross-module communication.
 *
 * Event catalog:
 *   itemCollected({ id, kind, name })   — a book or artifact was picked up
 *   libraryProgress({ have, total })    — library completion changed
 *   museumProgress({ have, total })     — museum completion changed
 *   gameComplete()                      — both collections are full
 *   promptChanged(text|null)            — "press E to..." interaction prompt
 *   regionEntered(name)                 — player crossed into a new region
 */
export class EventBus {
    constructor() {
        this._listeners = new Map();
    }
    on(event, fn) {
        if (!this._listeners.has(event)) this._listeners.set(event, new Set());
        this._listeners.get(event).add(fn);
        return () => this.off(event, fn);
    }
    off(event, fn) {
        const set = this._listeners.get(event);
        if (set) set.delete(fn);
    }
    emit(event, ...args) {
        const set = this._listeners.get(event);
        if (set) for (const fn of set) fn(...args);
    }
    clearAll() { this._listeners.clear(); }
}

export const events = new EventBus();

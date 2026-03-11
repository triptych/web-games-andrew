/**
 * EventBus — lightweight pub/sub for cross-module communication.
 *
 * Event catalog:
 *   petStatsChanged({ hunger, happy, energy, health })
 *   petStageChanged(newStage)
 *   petDied()
 *   petHatched(species)
 *   newEggReady()
 *   feedStart(foodId)
 *   interactStart(interactionId)
 *   moodChanged(moodKey)  — 'happy','content','sad','hungry','tired','sick'
 *   goldChanged(amount)
 *   uiModeChanged(mode)   — 'main','feed','interact','shop','eggs'
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

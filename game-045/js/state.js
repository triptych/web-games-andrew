/**
 * state.js — the little bit of state that outlives a single game: the high
 * score and the mute setting, persisted to localStorage (wrapped, because
 * private windows and blocked storage throw).
 *
 * Everything about a game in progress (score, balls, bricks...) lives in the
 * simulation world (js/sim/world.js).
 */

const KEY = 'pinbreak86';

function load() {
    try { return JSON.parse(localStorage.getItem(KEY)) ?? {}; } catch { return {}; }
}

class Persistent {
    constructor() {
        const d = load();
        this.best = Number(d.best) || 0;
        this.muted = !!d.muted;
    }

    save() {
        try { localStorage.setItem(KEY, JSON.stringify({ best: this.best, muted: this.muted })); } catch { /* ignore */ }
    }

    /** @returns true when `score` is a new high score. */
    submit(score) {
        if (score <= this.best) return false;
        this.best = score;
        this.save();
        return true;
    }
}

export const state = new Persistent();

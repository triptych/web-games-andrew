/**
 * save.js — progress, unlocks, high scores and settings in localStorage.
 * Every access is guarded: with storage blocked the game plays on, unsaved.
 */

const KEY = 'sister-circuit.save.v1';

const DEFAULTS = {
    v: 1,
    settings: { master: 0.8, music: 0.55, sfx: 0.8, crt: true, bloom: true, shake: true, vibrate: true, touchSize: 1 },
    unlocked: { bossrush: false, survival: false, mika: false },
    stageReached: 0,            // furthest story stage started (stage select)
    cleared: { easy: false, normal: false, hard: false },
    best: { story: 0, arcade: 0, bossrush: 0, survival: 0 },
    bestWave: 0,
    run: null,                  // story run in progress: { stage, difficulty, profile }
    ranks: {},                  // 'stage-diff' -> best rank letter
};

let data = null;

export function load() {
    if (data) return data;
    data = structuredClone(DEFAULTS);
    try {
        const raw = localStorage.getItem(KEY);
        if (raw) {
            const d = JSON.parse(raw);
            data = { ...data, ...d, settings: { ...data.settings, ...(d.settings || {}) }, unlocked: { ...data.unlocked, ...(d.unlocked || {}) }, best: { ...data.best, ...(d.best || {}) }, cleared: { ...data.cleared, ...(d.cleared || {}) } };
        }
    } catch { /* blocked or corrupt: play unsaved */ }
    return data;
}

export function save() {
    try { localStorage.setItem(KEY, JSON.stringify(data)); } catch { /* ignore */ }
}

export function get() { return load(); }

export function update(fn) { fn(load()); save(); }

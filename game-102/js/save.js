// Saves and settings in localStorage. Every access is guarded: with storage blocked the game
// still plays, it just can't remember anything.
//
// Three keys: the game in progress, the settings, and the campaign (best stars per sector).

import { SAVE_KEY } from './config.js';
import { serialize, deserialize } from './sim/game.js';

const SETTINGS_KEY = SAVE_KEY + '.settings';
const PROGRESS_KEY = SAVE_KEY + '.progress';
const DEFAULTS = { sfx: 0.8, music: 0.6, touch: 'auto' };

function read(key) {
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : null; } catch { return null; }
}
function write(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch { return false; }
}

export function loadSettings() {
    const s = read(SETTINGS_KEY);
    return { ...DEFAULTS, ...(s && typeof s === 'object' ? s : {}) };
}
export function saveSettings(s) { write(SETTINGS_KEY, s); }

export function hasSave() { return !!read(SAVE_KEY)?.data; }
export function saveGame(G) { return !G.over && write(SAVE_KEY, { savedAt: Date.now(), data: serialize(G) }); }
export function loadGame() {
    const s = read(SAVE_KEY);
    if (!s?.data) return null;
    try { return deserialize(s.data); } catch (err) { console.warn('[save] unreadable', err); return null; }
}
export function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch { /* blocked */ } }

/** { v: 1, stars: [3, 2, 0, …], best: [scores] } — one entry per sector played. */
export function loadProgress() {
    const p = read(PROGRESS_KEY);
    if (!p || p.v !== 1 || !Array.isArray(p.stars)) return { v: 1, stars: [], best: [] };
    return p;
}
export function recordResult(level, stars, score) {
    const p = loadProgress();
    p.stars[level] = Math.max(p.stars[level] || 0, stars);
    p.best[level] = Math.max(p.best[level] || 0, score);
    write(PROGRESS_KEY, p);
    return p;
}
/** A sector is open once the one before it has been cleared. */
export function unlocked(progress, level) { return level === 0 || (progress.stars[level - 1] || 0) > 0; }
export function clearProgress() { try { localStorage.removeItem(PROGRESS_KEY); } catch { /* blocked */ } }

// Saves and settings in localStorage. Every access is guarded: with storage blocked the game still
// plays, it just can't remember anything.
//
//   SAVE_KEY            the apprenticeship in progress (a serialized G, a level in progress included)
//   SAVE_KEY.settings   volumes and the calm setting
//   SAVE_KEY.best       a few records that outlive a run: chapters reached, guild marks earned

import { SAVE_KEY } from './config.js';
import { serialize, deserialize } from './sim/game.js';

const SETTINGS_KEY = SAVE_KEY + '.settings';
const BEST_KEY = SAVE_KEY + '.best';
const DEFAULTS = { sfx: 0.8, music: 0.5, calm: 'auto' };

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

export function loadBest() { const b = read(BEST_KEY); return { chapter: 1, marks: 0, ...(b && typeof b === 'object' ? b : {}) }; }
export function saveBest(b) { write(BEST_KEY, b); }

export function hasSave() { return !!read(SAVE_KEY)?.data; }
export function saveGame(G) { return write(SAVE_KEY, { savedAt: Date.now(), data: serialize(G) }); }
export function loadGame() {
    const s = read(SAVE_KEY);
    if (!s?.data) return null;
    try { return deserialize(s.data); } catch (err) { console.warn('[save] unreadable', err); return null; }
}
export function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch { /* blocked */ } }
export function clearAll() {
    for (const k of [SAVE_KEY, BEST_KEY]) { try { localStorage.removeItem(k); } catch { /* blocked */ } }
}

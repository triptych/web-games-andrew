// Saves and settings in localStorage. Every access is guarded: with storage blocked the game
// still plays, it just can't remember anything.

import { SAVE_KEY } from './config.js';
import { serialize, deserialize } from './sim/game.js';

const SETTINGS_KEY = SAVE_KEY + '.settings';
const coarse = typeof matchMedia === 'function' && matchMedia('(pointer: coarse)').matches;
// calm effects follow the system's reduced-motion setting until the player chooses
const reduced = typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;
const DEFAULTS = { sfx: 0.8, music: 0.55, quality: coarse ? 'medium' : 'high', shake: !reduced, calm: reduced };

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
/** Save the museum. `now` is the wall clock (ms), kept so time away can fill the till. */
export function saveGame(G, now = Date.now()) { return write(SAVE_KEY, { savedAt: now, data: serialize(G) }); }
/** Returns { G, savedAt } or null. */
export function loadGame() {
    const s = read(SAVE_KEY);
    if (!s?.data) return null;
    try { return { G: deserialize(s.data), savedAt: s.savedAt || 0 }; } catch (err) { console.warn('[save] unreadable', err); return null; }
}
export function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch { /* blocked */ } }

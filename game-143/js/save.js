// Saves and settings in localStorage. Every access is guarded: with storage blocked the game
// still plays, it just can't remember anything.

import { SAVE_KEY } from './config.js';
import { serialize, deserialize } from './sim/game.js';

const SETTINGS_KEY = SAVE_KEY + '.settings';
const DEFAULTS = { sfx: 0.8, music: 0.55, voice: 0.9, touch: 'auto' };

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
export function saveGame(G) { if (G.over) return false; return write(SAVE_KEY, { savedAt: Date.now(), data: serialize(G) }); }
export function loadGame() {
    const s = read(SAVE_KEY);
    if (!s?.data) return null;
    try { return deserialize(s.data); } catch (err) { console.warn('[save] unreadable', err); return null; }
}
export function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch { /* blocked */ } }
/** When the save was written (ms since 1970), for the time-away bonus; null without one. */
export function savedAt() { const t = read(SAVE_KEY)?.savedAt; return Number.isFinite(t) ? t : null; }

// A fallen hard-mode town's head start, kept until the next new game takes it.
const LEGACY_KEY = SAVE_KEY + '.legacy';
export function loadLegacy() { const l = read(LEGACY_KEY); return l && typeof l === 'object' && Object.values(l).some((v) => v > 0) ? l : null; }
export function saveLegacy(l) { write(LEGACY_KEY, l); }
export function clearLegacy() { try { localStorage.removeItem(LEGACY_KEY); } catch { /* blocked */ } }

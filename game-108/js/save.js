// Saves and settings in localStorage. Every access is guarded: with storage blocked the game
// still plays, it just can't remember anything.

import { SAVE_KEY } from './config.js';
import { serialize, deserialize } from './sim/game.js';

const SETTINGS_KEY = SAVE_KEY + '.settings';
const DEFAULTS = { sfx: 0.8, music: 0.55, quick: false, calm: false, hints: true };

function read(key) {
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : null; } catch { return null; }
}
function write(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch { return false; }
}

export function loadSettings() {
    const s = read(SETTINGS_KEY);
    const out = { ...DEFAULTS, ...(s && typeof s === 'object' ? s : {}) };
    // honour the OS setting the first time, before the player has chosen
    if (!(s && 'calm' in s)) { try { out.calm = !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches; } catch { /* no matchMedia */ } }
    return out;
}
export function saveSettings(s) { write(SETTINGS_KEY, s); }

export function hasSave() { return !!read(SAVE_KEY)?.data; }

/** A battle in progress is saved whole and resumes where it was; a finished one is already settled. */
export function saveGame(G) {
    const data = serialize(G);
    if (data.B?.over) data.B = null;
    return write(SAVE_KEY, { savedAt: Date.now(), data });
}
export function loadGame() {
    const s = read(SAVE_KEY);
    if (!s?.data) return null;
    try { return deserialize(s.data); } catch (err) { console.warn('[save] unreadable', err); return null; }
}
export function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch { /* blocked */ } }

// Saves and settings in localStorage. Every access is guarded: with storage blocked the game
// still plays, it just can't remember anything. The save also remembers when it was written,
// so the crew's gifts can count the time the game was closed.

import { SAVE_KEY } from './config.js';
import { serialize, deserialize } from './sim/game.js';

const SETTINGS_KEY = SAVE_KEY + '.settings';
const DEFAULTS = { sfx: 0.8, music: 0.6, voice: 0.9, touch: 'auto', detail: 'high', calm: false };

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
export function saveGame(G) { return !!G && write(SAVE_KEY, { savedAt: Date.now(), data: serialize(G) }); }
/** { G, away } where away is the seconds since the save was written (for the crew's gifts). */
export function loadGame() {
    const s = read(SAVE_KEY);
    if (!s?.data) return null;
    try {
        const away = Math.max(0, (Date.now() - (+s.savedAt || Date.now())) / 1000);
        return { G: deserialize(s.data), away };
    } catch (err) { console.warn('[save] unreadable', err); return null; }
}
export function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch { /* blocked */ } }

// Saves and settings in localStorage. Every access is guarded: with storage blocked the game still plays, it just can't
// remember anything.

import { SAVE_KEY } from './config.js';
import { serialize, deserialize } from './sim/game.js';

const SETTINGS_KEY = SAVE_KEY + '.settings';
const CLEARED_KEY = SAVE_KEY + '.cleared';
const DEFAULTS = { sfx: 0.8, music: 0.7, touch: 'auto', speed: 3, offset: 0, difficulty: 'normal', quality: 2, assist: false };

function read(key) { try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : null; } catch { return null; } }
function write(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch { return false; } }

export function loadSettings() { const s = read(SETTINGS_KEY); return { ...DEFAULTS, ...(s && typeof s === 'object' ? s : {}) }; }
export function saveSettings(s) { write(SETTINGS_KEY, s); }

export function hasSave() { return !!read(SAVE_KEY)?.data; }
export function saveInfo() { const s = read(SAVE_KEY); return s?.data ? { savedAt: s.savedAt, map: s.data.map, lv: s.data.party?.st?.lyra?.lv, members: s.data.party?.members } : null; }
/** Only calm moments are saved: walking around, or the start of a scene. Never mid-duel. */
export function saveGame(G) {
    if (G.mode !== 'field' && G.mode !== 'worldmap') return false;
    return write(SAVE_KEY, { savedAt: Date.now(), data: serialize(G) });
}
export function loadGame() {
    const s = read(SAVE_KEY);
    if (!s?.data) return null;
    try { return deserialize(s.data); } catch (err) { console.warn('[save] unreadable', err); return null; }
}
export function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch { /* blocked */ } }
export function markCleared() { write(CLEARED_KEY, true); }
export function wasCleared() { return !!read(CLEARED_KEY); }

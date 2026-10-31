// Saves, progress and settings in localStorage. Every access is guarded: with storage blocked the
// game still plays, it just can't remember anything.
//
//   SAVE_KEY            the reading in progress (a serialized G)
//   SAVE_KEY.meta       the Restoration: arcana rekindled, embers, bests
//   SAVE_KEY.settings   volumes and the calm setting

import { SAVE_KEY } from './config.js';
import { serialize, deserialize } from './sim/game.js';

const SETTINGS_KEY = SAVE_KEY + '.settings';
const META_KEY = SAVE_KEY + '.meta';
const DEFAULTS = { sfx: 0.8, music: 0.55, calm: 'auto' };

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

export function newMeta() { return { v: 1, restored: [], embers: 0, best: 0, bestFree: 0, readings: 0, won: false }; }
export function loadMeta() {
    const m = read(META_KEY);
    if (!m || m.v !== 1 || !Array.isArray(m.restored)) return newMeta();
    // the arcana are rekindled in order: keep only an unbroken run from The Fool
    const set = new Set(m.restored.filter((n) => Number.isInteger(n) && n >= 0 && n < 22));
    const restored = [];
    while (set.has(restored.length)) restored.push(restored.length);
    return { ...newMeta(), ...m, restored, won: restored.length === 22 };
}
export function saveMeta(m) { return write(META_KEY, m); }

export function hasSave() { return !!read(SAVE_KEY)?.data; }
export function saveGame(G) { return !G.over && write(SAVE_KEY, { savedAt: Date.now(), data: serialize(G) }); }
export function loadGame() {
    const s = read(SAVE_KEY);
    if (!s?.data) return null;
    try { return deserialize(s.data); } catch (err) { console.warn('[save] unreadable', err); return null; }
}
export function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch { /* blocked */ } }
export function clearAll() {
    for (const k of [SAVE_KEY, META_KEY]) { try { localStorage.removeItem(k); } catch { /* blocked */ } }
}

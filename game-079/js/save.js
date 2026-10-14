// Saves, settings and the tape archive in localStorage. Every access is guarded: with storage
// blocked the game still plays, it just can't remember anything.

import { SAVE_KEY } from './config.js';
import { serialize, deserialize } from './sim/game.js';

const SETTINGS_KEY = SAVE_KEY + '.settings';
const ARCHIVE_KEY = SAVE_KEY + '.tapes';
const DEFAULTS = { sfx: 0.8, music: 0.6, touch: 'auto', sens: 1, fov: 80, invert: false, scan: 0.6, quality: 'auto' };

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
export function saveGame(G) { return G.phase !== 'won' && write(SAVE_KEY, { savedAt: Date.now(), data: serialize(G) }); }
export function loadGame() {
    const s = read(SAVE_KEY);
    if (!s?.data) return null;
    try { return deserialize(s.data); } catch (err) { console.warn('[save] unreadable', err); return null; }
}
export function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch { /* blocked */ } }

/** Every tape ever found, across runs: [level][i] → true. */
export function loadArchive() {
    const a = read(ARCHIVE_KEY);
    return Array.isArray(a) ? a : [];
}
export function archiveTapes(tapes) {
    const a = loadArchive();
    tapes.forEach((row, l) => row.forEach((got, i) => { if (got) { a[l] ??= []; a[l][i] = true; } }));
    write(ARCHIVE_KEY, a);
    return a;
}

// Saves, settings and the album in localStorage. Every access is guarded: with storage blocked the game still
// plays, it just can't remember anything. Slot 0 is the autosave; slots 1..SLOTS are the player's.

import { SAVE_KEY, SLOTS } from './config.js';
import { serialize, deserialize } from './sim/game.js';

const SETTINGS_KEY = SAVE_KEY + '.settings';
const ALBUM_KEY = SAVE_KEY + '.album';
const DEFAULTS = { sfx: 0.75, music: 0.5, voice: 0.95, speed: 1, auto: 1, narr: true };

function read(key) {
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : null; } catch { return null; }
}
function write(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch { return false; }
}
function remove(key) { try { localStorage.removeItem(key); } catch { /* blocked */ } }

export function storageOk() {
    try { localStorage.setItem(SAVE_KEY + '.probe', '1'); localStorage.removeItem(SAVE_KEY + '.probe'); return true; } catch { return false; }
}

// ------------------------------------------------------------------ settings
export function loadSettings() {
    const s = read(SETTINGS_KEY);
    return { ...DEFAULTS, ...(s && typeof s === 'object' ? s : {}) };
}
export function saveSettings(s) { write(SETTINGS_KEY, s); }

// ------------------------------------------------------------------ save slots
const slotKey = (i) => `${SAVE_KEY}.slot${i}`;

/** A short description of each slot (or null), for the Load and Save screens. */
export function listSlots() {
    const out = [];
    for (let i = 0; i <= SLOTS; i++) {
        const s = read(slotKey(i));
        out.push(s && s.data ? { i, savedAt: s.savedAt, sum: s.sum } : null);
    }
    return out;
}

export function saveSlot(i, G) {
    const sum = { name: G.name, age: G.age, month: G.month, gold: G.gold, over: !!G.over, ending: G.ending?.id || null };
    return write(slotKey(i), { savedAt: Date.now(), sum, data: serialize(G) });
}

export function loadSlot(i) {
    const s = read(slotKey(i));
    if (!s?.data) return null;
    try { return deserialize(s.data); } catch (err) { console.warn('[save] unreadable slot', i, err); return null; }
}

/** The most recently written slot that holds a game still in progress. */
export function latestSlot() {
    let best = null;
    for (const s of listSlots()) if (s && !s.sum?.over && (!best || s.savedAt > best.savedAt)) best = s;
    return best ? best.i : -1;
}

export function clearAll() {
    for (let i = 0; i <= SLOTS; i++) remove(slotKey(i));
    remove(ALBUM_KEY);
}

// ------------------------------------------------------------------ the album (kept across games)
// scenes: { key: { id, args, title, kind, age } }, cgs: [ids], endings: [ids], names: the last names used.
export function loadAlbum() {
    const a = read(ALBUM_KEY);
    return {
        scenes: (a && a.scenes) || {}, cgs: (a && Array.isArray(a.cgs)) ? a.cgs : [], endings: (a && Array.isArray(a.endings)) ? a.endings : [],
        names: (a && a.names) || null,
    };
}
export function saveAlbum(a) { write(ALBUM_KEY, a); }

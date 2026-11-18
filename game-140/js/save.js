// Saves, settings and the album in localStorage. Every access is guarded: with storage blocked the game still
// plays, it just can't remember anything. Slot 0 is the autosave; slots 1..SLOTS are the player's.

import { SAVE_KEY, SLOTS } from './config.js';
import { serialize, deserialize, describe } from './sim/game.js';

const SETTINGS_KEY = SAVE_KEY + '.settings';
const ALBUM_KEY = SAVE_KEY + '.album';
const DEFAULTS = { sfx: 0.75, music: 0.55, voice: 0.95, speed: 1, auto: 1, narr: true, puzzle: 'normal', motion: 'full' };

function read(key) {
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : null; } catch { return null; }
}
function write(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch { return false; }
}
function remove(key) { try { localStorage.removeItem(key); } catch { /* blocked */ } }

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
        out.push(s && s.data ? { i, savedAt: s.savedAt, sum: s.sum || {} } : null);
    }
    return out;
}

export function saveSlot(i, G) {
    const sum = { name: G.name, where: describe(G), hues: G.hues.reduce((a, b) => a + b, 0), over: G.phase === 'end' };
    return write(slotKey(i), { savedAt: Date.now(), sum, data: serialize(G) });
}

export function loadSlot(i) {
    const s = read(slotKey(i));
    if (!s?.data) return null;
    try { return deserialize(s.data); } catch (err) { console.warn('[save] unreadable slot', i, err); return null; }
}

/** The most recently written slot that holds a story still in progress, or -1. */
export function latestSlot() {
    let best = null;
    for (const s of listSlots()) if (s && !s.sum.over && (!best || s.savedAt > best.savedAt)) best = s;
    return best ? best.i : -1;
}

export function clearAll() {
    for (let i = 0; i <= SLOTS; i++) remove(slotKey(i));
    remove(ALBUM_KEY);
}

// ------------------------------------------------------------------ the album (kept across stories)
// cgs: every illustration seen, done: the story has been finished once (the title is then in full colour).
export function loadAlbum() {
    const a = read(ALBUM_KEY);
    return {
        cgs: a && Array.isArray(a.cgs) ? a.cgs : [],
        done: !!(a && a.done),
        name: (a && typeof a.name === 'string') ? a.name : null,
    };
}
export function saveAlbum(a) { write(ALBUM_KEY, a); }

// Saves, settings and the endings album in localStorage. Every access is guarded: with storage blocked the game
// still plays, it just can't remember anything. Slot 0 is the autosave; slots 1..SLOTS are the player's.

import { SAVE_KEY, SLOTS, JOBS } from './config.js';
import { serialize, deserialize } from './sim/game.js';

const SETTINGS_KEY = SAVE_KEY + '.settings';
const ALBUM_KEY = SAVE_KEY + '.album';
const DEFAULTS = { sfx: 0.75, music: 0.5, voice: 0.95, speed: 1 };

function read(key) {
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : null; } catch { return null; }
}
function write(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch { return false; }
}
function remove(key) { try { localStorage.removeItem(key); } catch { /* blocked */ } }

export function loadSettings() {
    const s = read(SETTINGS_KEY);
    return { ...DEFAULTS, ...(s && typeof s === 'object' ? s : {}) };
}
export function saveSettings(s) { write(SETTINGS_KEY, s); }

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
    if (G.over) return false;
    const sum = { name: G.name, day: G.day, job: JOBS[G.rank], gold: G.gold };
    return write(slotKey(i), { savedAt: Date.now(), sum, data: serialize(G) });
}

export function loadSlot(i) {
    const s = read(slotKey(i));
    if (!s?.data) return null;
    try { return deserialize(s.data); } catch (err) { console.warn('[save] unreadable slot', i, err); return null; }
}

/** The most recently written slot. */
export function latestSlot() {
    let best = null;
    for (const s of listSlots()) if (s && (!best || s.savedAt > best.savedAt)) best = s;
    return best ? best.i : -1;
}
export function clearSlot(i) { remove(slotKey(i)); }

export function clearAll() {
    for (let i = 0; i <= SLOTS; i++) remove(slotKey(i));
    remove(ALBUM_KEY);
}

// the endings found so far, kept across games, and the last name and gender used
export function loadAlbum() {
    const a = read(ALBUM_KEY);
    return { endings: (a && Array.isArray(a.endings)) ? a.endings : [], who: (a && a.who) || null };
}
export function saveAlbum(a) { write(ALBUM_KEY, a); }

// Saves and settings in localStorage. Every access is guarded: with storage blocked the game still plays, it just
// can't remember anything. The save carries the wall-clock time, so a returning player gets the inn's idle earnings.

import { SAVE_KEY } from './config.js';
import { serialize, deserialize } from './sim/game.js';

const SETTINGS_KEY = SAVE_KEY + '.settings';
const DEFAULTS = { sfx: 0.8, music: 0.55, voice: 0.9, speed: 1, cloudAuto: true };

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
export function saveGame(G) { return write(SAVE_KEY, { savedAt: Date.now(), data: serialize(G) }); }
/** { G, away } where away is seconds since the save, or null. */
export function loadGame() {
    const s = read(SAVE_KEY);
    if (!s?.data) return null;
    try { return { G: deserialize(s.data), away: Math.max(0, (Date.now() - (s.savedAt || Date.now())) / 1000) }; }
    catch (err) { console.warn('[save] unreadable', err); return null; }
}
/** The local save as stored ({ savedAt, data }), for the cloud copy; and storing one fetched from the cloud. */
export function readSave() { const s = read(SAVE_KEY); return s?.data ? s : null; }
export function writeSave(s) { return write(SAVE_KEY, s); }
export function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch { /* blocked */ } }

// Saves, settings and the photo album in localStorage. Every access is guarded: with storage
// blocked the game still plays, it just can't remember anything.

import { SAVE_KEY, ALBUM_KEY, ALBUM_MAX } from './config.js';
import { serialize, deserialize } from './sim/game.js';

const SETTINGS_KEY = SAVE_KEY + '.settings';
const DEFAULTS = { sfx: 0.8, music: 0.5, detail: 'high' };

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
export function saveGame(G) {
    if (!G || G.visit) return false;
    return write(SAVE_KEY, { savedAt: Date.now(), data: serialize(G) });
}
export function loadGame() {
    const s = read(SAVE_KEY);
    if (!s?.data) return null;
    try { return deserialize(s.data); } catch (err) { console.warn('[save] unreadable', err); return null; }
}
export function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch { /* blocked */ } }

// ------------------------------------------------------------------ album
export function loadAlbum() {
    const a = read(ALBUM_KEY);
    return Array.isArray(a) ? a.filter((p) => p && typeof p.src === 'string' && p.src.startsWith('data:image/')) : [];
}
/** Add a photo (newest first). Drops the oldest when full or when storage runs out; false if it can't save at all. */
export function addToAlbum(photo) {
    const album = loadAlbum();
    album.unshift(photo);
    while (album.length > ALBUM_MAX) album.pop();
    while (album.length) {
        if (write(ALBUM_KEY, album)) return true;
        album.pop();
        if (!album.length || album[0] !== photo) return false;
    }
    return false;
}
export function removeFromAlbum(i) {
    const album = loadAlbum();
    album.splice(i, 1);
    return write(ALBUM_KEY, album);
}

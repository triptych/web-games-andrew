// Saves and settings in localStorage. Every access is guarded: with storage blocked the game
// still plays, it just can't remember anything.

import { SAVE_KEY } from './config.js';
import { serialize, deserialize } from './sim/game.js';

const SETTINGS_KEY = SAVE_KEY + '.settings';
const DEFAULTS = { sfx: 0.8, music: 0.6, quality: 'high', shake: true, touch: 'auto' };

function read(key) {
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : null; } catch { return null; }
}
function write(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch (err) { console.warn('[runebore] storage unavailable', err?.name); return false; }
}

export function loadSettings() {
    const s = read(SETTINGS_KEY);
    return { ...DEFAULTS, ...(s && typeof s === 'object' ? s : {}) };
}
export function saveSettings(s) { write(SETTINGS_KEY, s); }

export function hasSave() { return !!read(SAVE_KEY); }

export function saveGame(G) {
    if (!G || G.down) return false;
    return write(SAVE_KEY, { savedAt: Date.now(), data: serialize(G) });
}

export function loadGame() {
    const s = read(SAVE_KEY);
    if (!s || !s.data) return null;
    try { return deserialize(s.data); } catch (err) { console.warn('[runebore] save unreadable', err); return null; }
}

export function saveInfo() {
    const s = read(SAVE_KEY);
    if (!s || !s.data) return null;
    const d = s.data;
    return { name: d.name, ch: d.story?.ch ?? 0, deepest: d.stats?.deepest ?? 0, relics: (d.relics || []).filter(Boolean).length, savedAt: s.savedAt };
}

export function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch { /* blocked */ } }

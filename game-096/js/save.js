// Saves and settings in localStorage. Every access is guarded: with storage blocked the game still plays,
// it just can't remember anything.

import { SAVE_KEY } from './config.js';
import { emptyProgress, validProgress } from './sim/progress.js';

const SETTINGS_KEY = SAVE_KEY + '.settings';
const DEFAULTS = { sfx: 0.8, music: 0.6, touch: 'auto', shadows: 'auto', calm: 'auto' };

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

export function hasProgress() { const p = read(SAVE_KEY); return validProgress(p?.data) && p.data.started; }
export function loadProgress() {
    const s = read(SAVE_KEY);
    if (!s || !validProgress(s.data)) return emptyProgress();
    const P = { ...emptyProgress(), ...s.data };
    return P;
}
export function saveProgress(P) { return write(SAVE_KEY, { savedAt: Date.now(), data: P }); }
export function clearProgress() { try { localStorage.removeItem(SAVE_KEY); } catch { /* blocked */ } }

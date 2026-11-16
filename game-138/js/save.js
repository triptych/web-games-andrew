// Settings and the last dungeon in localStorage. Every access is guarded: with storage blocked the builder still
// works, it just can't remember anything (the share link still can).

import { SAVE_KEY } from './config.js';
import { normalize } from './sim/share.js';

const SETTINGS_KEY = SAVE_KEY + '.settings';
const DEFAULTS = { sfx: 0.8, music: 0.5, touch: 'auto', pom: true, look: 1, seen: false };

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
export function saveSettings(s) { return write(SETTINGS_KEY, s); }

/** The dungeon being built, so a reload comes back to it. */
export function saveParams(p) { return write(SAVE_KEY, { v: 1, savedAt: Date.now(), params: p }); }
export function loadParams() {
    const s = read(SAVE_KEY);
    if (!s || s.v !== 1 || !s.params) return null;
    try { return normalize(s.params); } catch { return null; }
}

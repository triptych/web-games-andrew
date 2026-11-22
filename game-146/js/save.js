// Saves, settings and progress in localStorage. Every access is guarded: with storage blocked the game still
// plays, it just can't remember anything.

import { SAVE_KEY } from './config.js';
import { serialize, deserialize } from './sim/game.js';

const SETTINGS_KEY = SAVE_KEY + '.settings';
const PROGRESS_KEY = 'jingle-pop.v1.progress';     // SAVE_KEY + '.progress', spelled out for dev/check-avatars.mjs
const DEFAULTS = { sfx: 0.8, music: 0.55, voice: 0.9, guide: 'short', calm: false };

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

/** A level or blizzard in progress (Continue). */
export function hasSave() { return !!read(SAVE_KEY)?.data; }
export function saveGame(G) { return !G.over && write(SAVE_KEY, { savedAt: Date.now(), data: serialize(G) }); }
export function loadGame() {
    const s = read(SAVE_KEY);
    if (!s?.data) return null;
    try { return deserialize(s.data); } catch (err) { console.warn('[save] unreadable', err); return null; }
}
export function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch { /* blocked */ } }

/** Story progress: highest level unlocked, best stars and score per level, the best blizzard, story scenes seen. */
export function loadProgress() {
    const p = read(PROGRESS_KEY);
    const ok = p && typeof p === 'object' && p.v === 1;
    return {
        v: 1,
        unlocked: ok && Number.isFinite(p.unlocked) ? Math.max(1, Math.min(36, p.unlocked)) : 1,
        stars: ok && p.stars && typeof p.stars === 'object' ? p.stars : {},
        best: ok && p.best && typeof p.best === 'object' ? p.best : {},
        endless: ok && Number.isFinite(p.endless) ? p.endless : 0,
        seen: ok && Array.isArray(p.seen) ? p.seen : [],
        done: ok ? !!p.done : false,
    };
}
export function saveProgress(p) { return write(PROGRESS_KEY, p); }
export function clearProgress() {
    for (const k of [PROGRESS_KEY, SAVE_KEY]) { try { localStorage.removeItem(k); } catch { /* blocked */ } }
}

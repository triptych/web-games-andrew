// Saves, settings and high scores in localStorage. Every access is guarded: with storage blocked the game still
// plays, it just can't remember anything.

import { SAVE_KEY } from './config.js';
import { serialize, deserialize } from './sim/game.js';

const SETTINGS_KEY = SAVE_KEY + '.settings';
const SCORES_KEY = SAVE_KEY + '.scores';
const SEEN_KEY = SAVE_KEY + '.seen';
const DEFAULTS = { sfx: 0.8, music: 0.6, voice: 0.9, touch: 'auto', quality: 'high', calm: false, scenes: 'all' };

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
export function saveGame(G) { return !G.over && G.phase !== 'over' && write(SAVE_KEY, { savedAt: Date.now(), data: serialize(G) }); }
export function loadGame() {
    const s = read(SAVE_KEY);
    if (!s?.data) return null;
    try { return deserialize(s.data); } catch (err) { console.warn('[save] unreadable', err); return null; }
}
export function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch { /* blocked */ } }

export function loadScores() {
    const s = read(SCORES_KEY);
    return { story: Array.isArray(s?.story) ? s.story : [], endless: Array.isArray(s?.endless) ? s.endless : [] };
}
/** Add a run; keeps the ten best of each mode. Returns its rank (1-based) or 0. */
export function addScore(mode, entry) {
    const all = loadScores();
    const list = all[mode === 'endless' ? 'endless' : 'story'];
    list.push(entry);
    list.sort((a, b) => b.score - a.score);
    list.length = Math.min(10, list.length);
    write(SCORES_KEY, all);
    return list.indexOf(entry) + 1;
}
export function hiScore() {
    const s = loadScores();
    return Math.max(0, ...s.story.map((x) => x.score), ...s.endless.map((x) => x.score));
}

export function loadSeen() { const s = read(SEEN_KEY); return new Set(Array.isArray(s) ? s : []); }
export function markSeen(id) { const s = loadSeen(); s.add(id); write(SEEN_KEY, [...s]); }

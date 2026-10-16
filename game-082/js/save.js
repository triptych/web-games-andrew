// Saves, settings and the high-score table in localStorage. Every access is guarded: with storage
// blocked the game still plays, it just can't remember anything.

import { SAVE_KEY } from './config.js';
import { serialize, deserialize } from './sim/game.js';

const SETTINGS_KEY = SAVE_KEY + '.settings';
const SCORES_KEY = SAVE_KEY + '.scores';
const DEFAULTS = { sfx: 0.8, music: 0.55, touch: 'auto', quality: -1, name: 'PIP' };
export const DEFAULT_SCORES = [
    { name: 'PIP', score: 50000, sector: 12 },
    { name: 'BLIP', score: 30000, sector: 8 },
    { name: 'SPARK', score: 20000, sector: 6 },
    { name: 'GLOOP', score: 10000, sector: 4 },
    { name: 'GRUNT', score: 5000, sector: 2 },
];

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
/** Saves a game in progress; never a finished one. */
export function saveGame(G) { return !G.over && write(SAVE_KEY, { savedAt: Date.now(), data: serialize(G) }); }
export function loadGame() {
    const s = read(SAVE_KEY);
    if (!s?.data) return null;
    try { return deserialize(s.data); } catch (err) { console.warn('[save] unreadable', err); return null; }
}
export function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch { /* blocked */ } }

export function loadScores() {
    const s = read(SCORES_KEY);
    return Array.isArray(s) && s.length ? s.slice(0, 5) : DEFAULT_SCORES.map((r) => ({ ...r }));
}
export function qualifies(score) { return score > 0 && score > loadScores()[4].score; }
export function addScore(name, score, sector) {
    const list = loadScores();
    list.push({ name: String(name || 'PIP').toUpperCase().slice(0, 8), score, sector });
    list.sort((a, b) => b.score - a.score);
    write(SCORES_KEY, list.slice(0, 5));
    return list.slice(0, 5);
}

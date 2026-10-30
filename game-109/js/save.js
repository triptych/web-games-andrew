// Saves, settings and the high-score table in localStorage. Every access is guarded: with storage
// blocked the game still plays, it just can't remember anything.

import { SAVE_KEY } from './config.js';
import { serialize, deserialize } from './sim/game.js';

const SETTINGS_KEY = SAVE_KEY + '.settings';
const SCORES_KEY = SAVE_KEY + '.scores';
const DEFAULTS = { sfx: 0.8, music: 0.6, touch: 'auto', autofire: 'auto', effects: 'full', crt: 'on', voice: 'on', story: 'on', name: 'AAA' };

/** The cabinet ships with scores to beat, as every cabinet does. */
const DEFAULT_SCORES = [
    { n: 'AJW', s: 60000, w: 11 },
    { n: 'NES', s: 32000, w: 7 },
    { n: 'CPU', s: 18000, w: 5 },
    { n: 'ACE', s: 9000, w: 3 },
    { n: 'BOT', s: 3000, w: 2 },
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
export function saveGame(G) { return !G.over && write(SAVE_KEY, { savedAt: Date.now(), data: serialize(G) }); }
export function loadGame() {
    const s = read(SAVE_KEY);
    if (!s?.data) return null;
    try { return deserialize(s.data); } catch (err) { console.warn('[save] unreadable', err); return null; }
}
export function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch { /* blocked */ } }

// ------------------------------------------------------------------ high scores
export function loadScores() {
    const s = read(SCORES_KEY);
    const ok = Array.isArray(s) && s.length && s.every((r) => r && typeof r.s === 'number' && typeof r.n === 'string');
    return (ok ? s : DEFAULT_SCORES).map((r) => ({ n: r.n.slice(0, 3), s: r.s, w: r.w | 0 })).sort((a, b) => b.s - a.s).slice(0, 5);
}
/** Would this score make the table? */
export function qualifies(score) {
    const t = loadScores();
    return score > 0 && (t.length < 5 || score > t[t.length - 1].s);
}
/** Insert a score; returns the new table and the row (0-based) it landed on. */
export function addHighScore(name, score, wave) {
    const t = loadScores();
    const row = { n: (name || 'AAA').toUpperCase().replace(/[^A-Z0-9]/g, '').slice(0, 3).padEnd(3, 'A'), s: score, w: wave };
    const i = t.findIndex((r) => score > r.s);
    t.splice(i < 0 ? t.length : i, 0, row);
    const top = t.slice(0, 5);
    write(SCORES_KEY, top);
    return { table: top, rank: i < 0 ? -1 : i };
}

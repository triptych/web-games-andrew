// Saves, settings and high scores in localStorage. Every access is guarded: with storage blocked
// the game still plays, it just can't remember anything.

import { SAVE_KEY, HIGHSCORES } from './config.js';
import { serialize, deserialize } from './sim/game.js';

const SETTINGS_KEY = SAVE_KEY + '.settings';
const SCORES_KEY = SAVE_KEY + '.scores';

const reduced = () => { try { return !!window.matchMedia?.('(prefers-reduced-motion: reduce)').matches; } catch { return false; } };
const defaults = () => ({ sfx: 0.8, music: 0.6, crt: 'full', calm: reduced(), quality: 'high', hints: true });

function read(key) {
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : null; } catch { return null; }
}
function write(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch { return false; }
}

export function loadSettings() {
    const s = read(SETTINGS_KEY);
    return { ...defaults(), ...(s && typeof s === 'object' ? s : {}) };
}
export function saveSettings(s) { write(SETTINGS_KEY, s); }

export function hasSave() { return !!read(SAVE_KEY)?.data; }
export function saveGame(G) { return G.state === 'play' && write(SAVE_KEY, { savedAt: Date.now(), data: serialize(G) }); }
export function loadGame() {
    const s = read(SAVE_KEY);
    if (!s?.data) return null;
    try { return deserialize(s.data); } catch (err) { console.warn('[save] unreadable', err); return null; }
}
export function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch { /* blocked */ } }

// ------------------------------------------------------------------ high scores
// A table per mode, best first. A fresh install starts with a house band, like a real cabinet.
const HOUSE = {
    dance: [['DSC', 180000, 7], ['FNK', 126000, 6], ['BOO', 88000, 5], ['SOL', 56000, 4], ['GRV', 34000, 3], ['AFR', 20000, 3], ['HUS', 11000, 2], ['MJK', 5000, 1]],
    jam: [['SLK', 90000, 5], ['VEL', 61000, 4], ['LUV', 42000, 4], ['TRK', 28000, 3], ['JIV', 17000, 2], ['CHA', 9000, 2], ['BUM', 4500, 1], ['TOT', 2000, 1]],
};
const house = (mode) => HOUSE[mode].map(([name, score, level]) => ({ name, score, level, house: true }));

export function loadScores() {
    const s = read(SCORES_KEY);
    const out = {};
    for (const mode of Object.keys(HOUSE)) {
        const t = s && Array.isArray(s[mode]) ? s[mode].filter((e) => e && typeof e.score === 'number' && typeof e.name === 'string') : null;
        out[mode] = t && t.length ? t : house(mode);
    }
    return out;
}

/** The rank (0 = top) a score would take in a mode's table, or -1 if it doesn't make it. */
export function scoreRank(mode, score) {
    if (score <= 0) return -1;
    const t = loadScores()[mode];
    let rank = t.findIndex((e) => score > e.score);
    if (rank < 0) rank = t.length < HIGHSCORES.size ? t.length : -1;
    return rank;
}

export function addScore(mode, entry) {
    const all = loadScores();
    const t = all[mode];
    let rank = t.findIndex((e) => entry.score > e.score);
    if (rank < 0) rank = t.length;
    if (rank >= HIGHSCORES.size) return -1;
    t.splice(rank, 0, entry);
    t.length = Math.min(t.length, HIGHSCORES.size);
    write(SCORES_KEY, all);
    return rank;
}

export function bestScore(mode) { return loadScores()[mode][0]?.score ?? 0; }
export function clearScores() { try { localStorage.removeItem(SCORES_KEY); } catch { /* blocked */ } }

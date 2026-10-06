// save.js — localStorage, guarded: a browser that blocks site data still plays,
// it just can't remember anything.

const GAME_KEY = 'game-062-voyage';
const PREFS_KEY = 'game-062-prefs';

function read(key) {
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : null; } catch { return null; }
}
function write(key, v) {
    try { localStorage.setItem(key, JSON.stringify(v)); return true; } catch { return false; }
}

export const loadGame = () => read(GAME_KEY);
export const saveGame = (m) => write(GAME_KEY, m);
export function clearGame() { try { localStorage.removeItem(GAME_KEY); } catch { /* blocked */ } }

export const DEFAULT_PREFS = {
    sound: true, music: true, labels: false, autoTurn: true,
    setup: { mode: 'ai', side: 1, level: 3, sea: 'choppy', events: null },
};
export function loadPrefs() {
    const p = read(PREFS_KEY) || {};
    return { ...DEFAULT_PREFS, ...p, setup: { ...DEFAULT_PREFS.setup, ...(p.setup || {}) } };
}
export const savePrefs = (p) => write(PREFS_KEY, p);

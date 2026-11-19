// Saves, progress and settings in localStorage. Every access is guarded: with storage blocked the
// game still plays, it just can't remember anything.
//
//   SAVE_KEY      the castle in progress (the whole simulation, so Continue picks up mid-shot)
//   PROGRESS_KEY  stars and best score per castle; a castle opens when the one before has a star
//   .settings     volumes, camera, touch controls

import { SAVE_KEY, PROGRESS_KEY } from './config.js';
import { serialize, deserialize } from './sim/game.js';
import { LEVELS } from './sim/levels.js';

const SETTINGS_KEY = SAVE_KEY + '.settings';
const DEFAULTS = { sfx: 0.8, music: 0.6, voice: 0.9, follow: true, touch: 'auto' };

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

// ------------------------------------------------------------------ progress
let progress = null;
export function loadProgress() {
    if (progress) return progress;
    const p = read(PROGRESS_KEY);
    progress = { v: 1, stars: {}, best: {}, endless: { best: 0, score: 0 }, ...(p && p.v === 1 ? p : {}) };
    if (!progress.endless) progress.endless = { best: 0, score: 0 };
    return progress;
}
export function unlocked(i) {
    const p = loadProgress();
    return i === 0 || (p.stars[LEVELS[i - 1].id] || 0) > 0;
}
/** Record a finished castle; returns whether the score is a new best. */
export function recordResult(level, won, stars, score) {
    const p = loadProgress();
    const id = LEVELS[level].id;
    if (!won) return false;
    const best = score > (p.best[id] || 0);
    p.stars[id] = Math.max(p.stars[id] || 0, stars);
    if (best) p.best[id] = score;
    write(PROGRESS_KEY, p);
    return best;
}
/** Endless Siege opens once the first region is cleared. */
export const endlessOpen = () => unlocked(12);
/** Record an Endless run that ended after `cleared` castles; returns whether it is a new best. */
export function recordEndless(cleared, score) {
    const p = loadProgress();
    const best = cleared > p.endless.best || (cleared === p.endless.best && score > p.endless.score);
    if (best) { p.endless = { best: cleared, score }; write(PROGRESS_KEY, p); }
    return best;
}
export function totalStars() { const p = loadProgress(); return Object.values(p.stars).reduce((a, b) => a + b, 0); }
export function forgetAll() {
    clearSave();
    progress = { v: 1, stars: {}, best: {}, endless: { best: 0, score: 0 } };
    try { localStorage.removeItem(PROGRESS_KEY); } catch { /* blocked */ }
}

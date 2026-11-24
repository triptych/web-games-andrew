// Progress, the level in play and settings, in localStorage. Every access is guarded: with storage blocked the
// game still plays, it just can't remember anything.

import { SAVE_KEY, TOTAL_LEVELS, WISPS } from './config.js';
import { serialize, deserialize } from './sim/game.js';

const SETTINGS_KEY = SAVE_KEY + '.settings';
const DEFAULTS = { sfx: 0.8, music: 0.55, voice: 0.9, glyphs: true, calm: false };

function read(key) {
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : null; } catch { return null; }
}
function write(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch { return false; }
}

export function loadSettings() {
    const s = read(SETTINGS_KEY);
    const out = { ...DEFAULTS, ...(s && typeof s === 'object' ? s : {}) };
    if (window.matchMedia?.('(prefers-reduced-motion: reduce)').matches && !(s && 'calm' in s)) out.calm = true;
    return out;
}
export function saveSettings(s) { return write(SETTINGS_KEY, s); }

export function freshProgress() {
    return {
        v: 1,
        unlocked: 0,                                   // highest level index that may be played
        stars: new Array(TOTAL_LEVELS).fill(0),
        woke: new Array(WISPS.length).fill(0),         // blooms per wisp colour, all time
        story: [],                                     // chapter intros already told
        ending: false,
        daily: { last: '', streak: 0, best: 0 },
        dreams: 0,
        cur: null,                                     // the puzzle in play (serialized G)
    };
}

/** Progress, repaired field by field so an older or damaged save still loads what it can. */
export function loadProgress() {
    const s = read(SAVE_KEY);
    const p = freshProgress();
    if (!s || s.v !== 1) return p;
    p.unlocked = Math.max(0, Math.min(TOTAL_LEVELS - 1, s.unlocked | 0));
    if (Array.isArray(s.stars)) for (let i = 0; i < TOTAL_LEVELS; i++) p.stars[i] = Math.max(0, Math.min(3, s.stars[i] | 0));
    if (Array.isArray(s.woke)) for (let i = 0; i < WISPS.length; i++) p.woke[i] = Math.max(0, s.woke[i] | 0);
    if (Array.isArray(s.story)) p.story = s.story.filter((x) => Number.isInteger(x));
    p.ending = !!s.ending;
    if (s.daily && typeof s.daily === 'object') p.daily = { last: String(s.daily.last || ''), streak: s.daily.streak | 0, best: s.daily.best | 0 };
    p.dreams = s.dreams | 0;
    if (s.cur) { try { p.cur = serialize(deserialize(s.cur)); } catch { p.cur = null; } }
    return p;
}

export function saveProgress(p) { return write(SAVE_KEY, p); }

export function clearProgress() { try { localStorage.removeItem(SAVE_KEY); } catch { /* blocked */ } }

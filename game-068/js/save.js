/**
 * save.js — progress in localStorage: levels and stars, the volunteer roster, letters, the names
 * we remember, lifetime numbers and settings. Every access is guarded: with site data blocked the
 * game still plays, it just can't remember.
 */

import { SAVE_KEY } from './config.js';

let warned = false;
const warn = () => { if (!warned) { warned = true; console.warn('[haven-road] storage unavailable; progress will not be saved'); } };
function get(k) { try { return localStorage.getItem(k); } catch { warn(); return null; } }
function put(k, v) { try { localStorage.setItem(k, v); return true; } catch { warn(); return false; } }
function del(k) { try { localStorage.removeItem(k); } catch { warn(); } }

const K = { progress: `${SAVE_KEY}.progress`, settings: `${SAVE_KEY}.settings` };

export function freshProgress() {
    return {
        unlocked: 1,                // highest level that can be played
        levels: {},                 // n → { stars, saved, spawned }
        roster: {},                 // trade → count
        letters: [],                // newest first, capped
        remembered: [],             // names of the lost, capped
        stats: { saved: 0, thriving: 0, lost: 0, cured: 0, treated: 0, played: 0, won: 0 },
        endlessBest: 0,
        finished: false,
        hintsSeen: {},
    };
}

export function loadProgress() {
    try {
        const p = JSON.parse(get(K.progress) || 'null');
        if (!p || typeof p !== 'object') return freshProgress();
        const f = freshProgress();
        return { ...f, ...p, stats: { ...f.stats, ...(p.stats || {}) }, roster: { ...(p.roster || {}) }, levels: { ...(p.levels || {}) }, hintsSeen: { ...(p.hintsSeen || {}) } };
    } catch { return freshProgress(); }
}

export function saveProgress(p) {
    p.letters = (p.letters || []).slice(0, 120);
    p.remembered = (p.remembered || []).slice(0, 200);
    return put(K.progress, JSON.stringify(p));
}

export function resetProgress() { del(K.progress); return freshProgress(); }

const DEFAULT_SETTINGS = { music: 0.55, sfx: 0.8, muted: false, quality: -1, words: true };
export function loadSettings() {
    try { return { ...DEFAULT_SETTINGS, ...(JSON.parse(get(K.settings) || 'null') || {}) }; } catch { return { ...DEFAULT_SETTINGS }; }
}
export function saveSettings(s) { put(K.settings, JSON.stringify(s)); }

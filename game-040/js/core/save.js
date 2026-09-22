/**
 * save.js — localStorage persistence: unlocked levels, best scores, headcount
 * records, options. Every read is defensive: a corrupt or absent blob must
 * degrade to defaults rather than throw, because a thrown error here would
 * take the title screen down with it.
 */

import { SAVE_KEY } from './config.js';

const DEFAULTS = {
    version: 1,
    unlockedLevel: 1,
    difficulty: 'pilot',
    bestScore: 0,
    bestRescued: 0,
    bestRank: '',
    clears: 0,
    seenIntro: false,
    options: { autofire: true, screenShake: true, music: true, sfx: true, showFps: false },
    levelBests: {},         // { "1": { score, rescued, rank } }
};

function storage() {
    try {
        if (typeof localStorage === 'undefined') return null;
        return localStorage;
    } catch { return null; }
}

export function loadSave() {
    const ls = storage();
    if (!ls) return structuredClone(DEFAULTS);
    try {
        const raw = ls.getItem(SAVE_KEY);
        if (!raw) return structuredClone(DEFAULTS);
        const data = JSON.parse(raw);
        const merged = { ...structuredClone(DEFAULTS), ...data };
        merged.options = { ...DEFAULTS.options, ...(data.options || {}) };
        merged.levelBests = { ...(data.levelBests || {}) };
        return merged;
    } catch {
        return structuredClone(DEFAULTS);
    }
}

export function writeSave(data) {
    const ls = storage();
    if (!ls) return false;
    try {
        ls.setItem(SAVE_KEY, JSON.stringify(data));
        return true;
    } catch { return false; }
}

export function recordRun(save, { level, score, rescued, rank, cleared }) {
    const key = String(level);
    const prev = save.levelBests[key] || { score: 0, rescued: 0, rank: '' };
    save.levelBests[key] = {
        score:   Math.max(prev.score, score),
        rescued: Math.max(prev.rescued, rescued),
        rank:    betterRank(prev.rank, rank),
    };
    if (cleared) save.unlockedLevel = Math.max(save.unlockedLevel, level + 1);
    save.bestScore   = Math.max(save.bestScore, score);
    save.bestRescued = Math.max(save.bestRescued, rescued);
    save.bestRank    = betterRank(save.bestRank, rank);
    return save;
}

const RANK_ORDER = ['', 'D', 'C', 'B', 'A', 'S'];
export function betterRank(a, b) {
    return RANK_ORDER.indexOf(a) >= RANK_ORDER.indexOf(b) ? a : b;
}

export function resetSave() {
    const ls = storage();
    try { ls?.removeItem(SAVE_KEY); } catch { /* ignore */ }
    return structuredClone(DEFAULTS);
}

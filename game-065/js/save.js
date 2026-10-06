/**
 * save.js — localStorage persistence. Every access is guarded: with site data
 * blocked the game still plays, it just can't remember.
 *
 * The save is the simulation state plus the wall-clock time it was written,
 * which is how offline progress knows how long you were away.
 */

import { migrate } from './sim/game.js';

const KEY = 'worldroot-save';
const SKEY = 'worldroot-settings';
let warned = false;
const warn = () => { if (!warned) { warned = true; console.warn('[worldroot] storage unavailable; progress will not be saved'); } };

export function loadGame() {
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return null;
        const data = JSON.parse(raw);
        const state = migrate(data.state);
        if (!state) return null;
        return { state, savedAt: Number(data.savedAt) || Date.now() };
    } catch { warn(); return null; }
}

export function saveGame(state) {
    try { localStorage.setItem(KEY, JSON.stringify({ state, savedAt: Date.now() })); return true; } catch { warn(); return false; }
}

export function clearGame() { try { localStorage.removeItem(KEY); } catch { warn(); } }

const DEFAULTS = { sound: true, music: true, volume: 0.7, sci: false, rotate: true, floaters: true, quality: 'auto', seenHelp: false, tab: 'grove', buy: 1 };
export function loadSettings() {
    try { return { ...DEFAULTS, ...(JSON.parse(localStorage.getItem(SKEY) || '{}')) }; } catch { warn(); return { ...DEFAULTS }; }
}
export function saveSettings(s) { try { localStorage.setItem(SKEY, JSON.stringify(s)); } catch { warn(); } }

/** Save codes: base64 of the JSON, so they survive copy and paste. */
export function exportCode(state) {
    const json = JSON.stringify({ state, savedAt: Date.now() });
    return btoa(unescape(encodeURIComponent(json)));
}
export function importCode(code) {
    try {
        const json = decodeURIComponent(escape(atob(code.trim())));
        const data = JSON.parse(json);
        const state = migrate(data.state);
        return state ? { state, savedAt: Number(data.savedAt) || Date.now() } : null;
    } catch { return null; }
}

/**
 * save.js — localStorage persistence for the profile and settings.
 * The profile is plain JSON (js/sim keeps it that way); battles are not saved
 * mid-fight — reloading during a battle returns you to town with nothing lost
 * but that battle's progress.
 */

import { SAVE_VERSION } from './sim/game.js';

const KEY = 'tomebound-save';
const SKEY = 'tomebound-settings';

export function loadProfile() {
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return null;
        const p = JSON.parse(raw);
        if (!p || p.v !== SAVE_VERSION || !p.cls) return null;
        return p;
    } catch { return null; }
}

export function saveProfile(p) {
    try { localStorage.setItem(KEY, JSON.stringify(p)); return true; } catch { return false; }
}

export function clearProfile() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } }
export function hasProfile() { return !!loadProfile(); }

export function loadSettings() {
    try { return { sound: true, music: true, quality: null, ...(JSON.parse(localStorage.getItem(SKEY) || '{}')) }; } catch { return { sound: true, music: true, quality: null }; }
}
export function saveSettings(s) { try { localStorage.setItem(SKEY, JSON.stringify(s)); } catch { /* ignore */ } }

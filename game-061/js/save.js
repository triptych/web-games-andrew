// Guarded localStorage: every access can throw (blocked site data), and the game must still play.

import { SAVE_KEY } from './config.js';

const SETTINGS_KEY = SAVE_KEY + '.settings';
export const DEFAULT_SETTINGS = { music: 0.6, sfx: 0.8, muted: false, quality: 'auto', mouseSteer: true, invertY: false, tips: true };

function read(key) {
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : null; } catch (e) { console.warn('Storage unavailable:', e?.name || e); return null; }
}
function write(key, value) {
    try { localStorage.setItem(key, typeof value === 'string' ? value : JSON.stringify(value)); return true; } catch (e) { console.warn('Could not save:', e?.name || e); return false; }
}

export function loadSettings() { return { ...DEFAULT_SETTINGS, ...(read(SETTINGS_KEY) || {}) }; }
export function saveSettings(s) { return write(SETTINGS_KEY, s); }
export function loadGame() { const s = read(SAVE_KEY); return s && s.seed && s.v ? s : null; }
export function saveGame(json) { return write(SAVE_KEY, json); }
export function clearGame() { try { localStorage.removeItem(SAVE_KEY); } catch { /* storage blocked */ } }

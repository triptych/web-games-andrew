/**
 * save.js — localStorage persistence for the career and the settings. Every access is guarded: with
 * site data blocked the game still plays, it just can't remember.
 *
 *   dirt-crown.v1.profile    the career (see newProfile in js/sim/career.js)
 *   dirt-crown.v1.settings   volumes, quality, camera, auto-accelerate
 */

import { SAVE_KEY } from './config.js';
import { newProfile } from './sim/career.js';
import { emptyLevels } from './sim/parts.js';

let warned = false;
const warn = () => { if (!warned) { warned = true; console.warn('[dirt-crown] storage unavailable; progress will not be saved'); } };
function get(k) { try { return localStorage.getItem(k); } catch { warn(); return null; } }
function put(k, v) { try { localStorage.setItem(k, v); return true; } catch { warn(); return false; } }
function del(k) { try { localStorage.removeItem(k); } catch { warn(); } }

const K = { profile: `${SAVE_KEY}.profile`, settings: `${SAVE_KEY}.settings` };

export const DEFAULT_SETTINGS = { master: 0.8, music: 0.55, sfx: 0.8, muted: false, quality: 'auto', camera: 0, autoGas: true, shake: true };

export function loadSettings() {
    try { return { ...DEFAULT_SETTINGS, ...(JSON.parse(get(K.settings) || 'null') || {}) }; } catch { return { ...DEFAULT_SETTINGS }; }
}
export function saveSettings(s) { put(K.settings, JSON.stringify(s)); }

export function loadProfile() {
    let p = null;
    try { p = JSON.parse(get(K.profile) || 'null'); } catch { p = null; }
    if (!p || typeof p !== 'object') return null;
    // Fill anything an older save is missing.
    const base = newProfile(p.name || 'Kit');
    const out = { ...base, ...p };
    out.levels = { ...emptyLevels(), ...(p.levels || {}) };
    out.owned = { paint: ['primer', ...((p.owned && p.owned.paint) || [])], livery: ['none', ...((p.owned && p.owned.livery) || [])] };
    out.owned.paint = [...new Set(out.owned.paint)];
    out.owned.livery = [...new Set(out.owned.livery)];
    out.stats = { ...base.stats, ...(p.stats || {}) };
    out.results = p.results || {};
    out.seen = p.seen || {};
    return out;
}
export function saveProfile(p) { return put(K.profile, JSON.stringify(p)); }
export function clearProfile() { del(K.profile); }

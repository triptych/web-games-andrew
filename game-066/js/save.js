// One save slot plus settings, in localStorage. Every access is guarded: a browser that blocks
// site data still plays, it just can't save.

import { SAVE_KEY } from './config.js';

const SLOT = `${SAVE_KEY}.save`;
const META = `${SAVE_KEY}.meta`;
const SET = `${SAVE_KEY}.settings`;

function get(k) { try { return localStorage.getItem(k); } catch { return null; } }
function put(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } }

export function hasSave() { return !!get(SLOT); }
export function loadJson() { return get(SLOT); }
export function saveJson(json, meta) { const ok = put(SLOT, json); if (ok) put(META, JSON.stringify(meta)); return ok; }
export function saveMeta() { try { return JSON.parse(get(META) || 'null'); } catch { return null; } }

export const DEFAULT_SETTINGS = { music: 0.55, sfx: 0.8, muted: false, quality: 'auto', textSpeed: 'normal', battleText: 'auto', grain: 1 };
export function loadSettings() { try { return { ...DEFAULT_SETTINGS, ...(JSON.parse(get(SET) || '{}') || {}) }; } catch { return { ...DEFAULT_SETTINGS }; } }
export function saveSettings(s) { put(SET, JSON.stringify(s)); }

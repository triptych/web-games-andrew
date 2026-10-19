// Saves in localStorage, every access guarded: with storage blocked the guild still works, it just can't
// remember, and the UI says so plainly (a writing tool must never lose work quietly).
//
// quillsworn.v1            the apprentice (progress, settings, the list of novels)
// quillsworn.v1.p.<id>     one novel each, so typing in one book rewrites one key
// quillsworn.v1.settings   sound, text size and the like

import { SAVE_KEY, PROJECT_KEY, VERSION } from './config.js';
import { serializeCore, serializeProject, deserialize } from './sim/state.js';

const SETTINGS_KEY = SAVE_KEY + '.settings';
const DEFAULTS = { sound: true, typing: true, motes: true, textSize: 'm', focusWidth: 'normal' };

function read(key) {
    try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : null; } catch { return null; }
}
function write(key, val) {
    try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch { return false; }
}

export function storageOk() {
    try { localStorage.setItem('__qs_probe', '1'); localStorage.removeItem('__qs_probe'); return true; } catch { return false; }
}

export function loadSettings() {
    const s = read(SETTINGS_KEY);
    return { ...DEFAULTS, ...(s && typeof s === 'object' ? s : {}) };
}
export const saveSettings = (s) => write(SETTINGS_KEY, s);

/** → S, or null with no save, or { error } for a save that can't be read (it is left untouched). */
export function loadGame() {
    const core = read(SAVE_KEY);
    if (!core) return null;
    const projects = {};
    for (const id of core.order || []) {
        const p = read(PROJECT_KEY + id);
        if (p) projects[id] = p;
    }
    try { return deserialize(core, projects); } catch (err) { console.warn('[save] unreadable', err); return { error: String(err.message || err) }; }
}

export const saveCore = (S) => write(SAVE_KEY, serializeCore(S));
export const saveProject = (P) => write(PROJECT_KEY + P.id, serializeProject(P));
export function removeProject(id) { try { localStorage.removeItem(PROJECT_KEY + id); } catch { /* blocked */ } }

export function clearAll() {
    try {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(SAVE_KEY)) keys.push(k); }
        for (const k of keys) localStorage.removeItem(k);
    } catch { /* blocked */ }
}

/** Everything, as one JSON file the apprentice can keep. */
export function backupJson(S, settings) {
    return JSON.stringify({
        app: 'quillsworn', version: VERSION,
        core: serializeCore(S),
        projects: Object.fromEntries(S.order.map((id) => [id, serializeProject(S.projects[id])])),
        settings,
    }, null, 1);
}

/** Read a backup file's text. Throws with a plain message if it isn't one. */
export function readBackup(text) {
    let d;
    try { d = JSON.parse(text); } catch { throw new Error('That file isn’t a Quillsworn backup (it isn’t JSON).'); }
    if (!d || d.app !== 'quillsworn' || !d.core) throw new Error('That file isn’t a Quillsworn backup.');
    const S = deserialize(d.core, d.projects || {});
    return { S, settings: { ...DEFAULTS, ...(d.settings || {}) } };
}

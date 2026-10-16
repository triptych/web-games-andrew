// Progress, the Studio and settings in localStorage. Every access is guarded: with storage blocked
// the game still plays, it just can't remember anything.

import { SAVE_KEY, STUDIO_KEY, SETTINGS_KEY } from './config.js';
import { serializeProgress, deserializeProgress } from './meta/progress.js';
import { V } from './runtime/index.js';

const DEFAULTS = { sfx: 0.8, music: 0.5, touch: 'auto', quality: -1, crt: 2, openArchive: false, fastText: false };

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
export function saveSettings(s) { return write(SETTINGS_KEY, s); }

export function hasSave() { return !!read(SAVE_KEY)?.data; }
export function saveProgress(P) {
    // Studio carts are stored apart, so starting a new expedition keeps them
    const { creative, ...rest } = serializeProgress(P);
    const a = write(SAVE_KEY, { savedAt: Date.now(), data: rest });
    const b = write(STUDIO_KEY, { carts: creative, nextId: P.nextId });
    return a && b;
}
export function loadProgress() {
    const s = read(SAVE_KEY);
    if (!s?.data) return null;
    try {
        const st = read(STUDIO_KEY);
        return deserializeProgress({ ...s.data, creative: st?.carts || [], nextId: Math.max(s.data.nextId | 0, st?.nextId | 0) });
    } catch (err) { console.warn('[save] unreadable', err); return null; }
}
/** The Studio carts on their own: kept across a new expedition. */
export function loadStudio() {
    const st = read(STUDIO_KEY);
    if (!st || !Array.isArray(st.carts)) return { carts: [], nextId: 1 };
    return { carts: st.carts.filter((e) => e && e.cart).map((e) => ({ id: String(e.id), cart: V.normalize(e.cart), made: e.made | 0 })), nextId: st.nextId | 0 };
}
export function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch { /* blocked */ } }
/** Only the Studio: used before an expedition has started, so a Studio visit doesn't create a save. */
export function saveStudio(P) { return write(STUDIO_KEY, { carts: serializeProgress(P).creative, nextId: P.nextId }); }

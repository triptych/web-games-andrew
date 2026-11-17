// lib/core/store.js — localStorage that never throws. With storage blocked (a browser that blocks
// site data, or itch.io's iframe with third-party storage off) the game still plays; it just can't
// remember anything. Every one of the 87 save.js files in the repo hand-writes this.
//
//   import { makeSettings, makeSaveSlot } from '../lib/core/store.js';
//   export const settings = makeSettings('mygame.v1.settings', { sfx: 0.8, music: 0.6, touch: 'auto' });
//   export const slot = makeSaveSlot('mygame.v1', { serialize, deserialize });

/** JSON from a key, or `fallback` when missing, unreadable or blocked. */
export function readJSON(key, fallback = null) {
    try {
        const s = localStorage.getItem(key);
        return s == null ? fallback : JSON.parse(s);
    } catch { return fallback; }
}

/** Write JSON; false when storage is blocked or full. */
export function writeJSON(key, value) {
    try { localStorage.setItem(key, JSON.stringify(value)); return true; } catch { return false; }
}

export function removeKey(key) {
    try { localStorage.removeItem(key); return true; } catch { return false; }
}

/** Is storage usable at all? (For a "saves are off in this browser" notice.) */
export function storageAvailable() {
    try {
        const k = '__core_probe__';
        localStorage.setItem(k, '1');
        localStorage.removeItem(k);
        return true;
    } catch { return false; }
}

/**
 * Settings merged over defaults, so a key added in a later version gets its default instead of
 * undefined. Unknown keys from an old version are dropped.
 */
export function makeSettings(key, defaults) {
    return {
        load() {
            const s = readJSON(key);
            const out = { ...defaults };
            if (s && typeof s === 'object') for (const k in defaults) if (k in s && typeof s[k] === typeof defaults[k]) out[k] = s[k];
            return out;
        },
        save(s) { return writeJSON(key, s); },
        clear() { return removeKey(key); },
    };
}

/**
 * One save slot: { savedAt, data } under `key`. `deserialize` should throw on a version it does
 * not know; load() then returns null (and logs) instead of half-loading a broken game.
 */
export function makeSaveSlot(key, { serialize, deserialize }) {
    return {
        has() { return !!readJSON(key)?.data; },
        save(G) { return writeJSON(key, { savedAt: Date.now(), data: serialize(G) }); },
        load() {
            const s = readJSON(key);
            if (!s?.data) return null;
            try { return deserialize(s.data); } catch (err) { console.warn('[save] unreadable', err); return null; }
        },
        savedAt() { return readJSON(key)?.savedAt ?? null; },
        clear() { return removeKey(key); },
    };
}

/**
 * save.js — localStorage persistence: many islands ("worlds"), the Train Shed of train sets shared by
 * every island, the sticker profile and the settings. Every access is guarded: with site data
 * blocked the game still plays, it just can't remember.
 *
 *   tootle-isles.v1.worlds       index: [{ id, name, preset, season, created, updated, thumb, counts }]
 *   tootle-isles.v1.world.<id>   the island itself (World.serialize())
 *   tootle-isles.v1.shed         train sets: [{ ...design, thumb }]
 *   tootle-isles.v1.profile      { stickers: { id: time }, islands, last }
 *   tootle-isles.v1.settings
 */

import { SAVE_KEY } from './config.js';
import { DEFAULT_SETS, cleanDesign } from './sim/trainsets.js';

let warned = false;
const warn = () => { if (!warned) { warned = true; console.warn('[tootle-isles] storage unavailable; islands will not be saved'); } };
function get(k) { try { return localStorage.getItem(k); } catch { warn(); return null; } }
function put(k, v) { try { localStorage.setItem(k, v); return true; } catch { warn(); return false; } }
function del(k) { try { localStorage.removeItem(k); } catch { warn(); } }
function json(k, def) { try { const v = JSON.parse(get(k) || 'null'); return v ?? def; } catch { return def; } }

const K = {
    worlds: `${SAVE_KEY}.worlds`, world: (id) => `${SAVE_KEY}.world.${id}`,
    shed: `${SAVE_KEY}.shed`, profile: `${SAVE_KEY}.profile`, settings: `${SAVE_KEY}.settings`,
};

// ------------------------------------------------------------------ worlds
export function listWorlds() {
    const l = json(K.worlds, []);
    return Array.isArray(l) ? l.filter((w) => w && w.id).sort((a, b) => (b.updated || 0) - (a.updated || 0)) : [];
}

export function loadWorldData(id) { return json(K.world(id), null); }

/** Save an island. Returns true on success; on a full disk, tries again without the thumbnail. */
export function saveWorld(id, data, meta) {
    const ok = put(K.world(id), JSON.stringify(data));
    if (!ok) return false;
    const list = listWorlds().filter((w) => w.id !== id);
    const entry = { id, ...meta, updated: Date.now() };
    list.unshift(entry);
    if (!put(K.worlds, JSON.stringify(list))) {
        entry.thumb = '';
        put(K.worlds, JSON.stringify(list));
    }
    return true;
}

export function renameWorld(id, name) {
    const list = listWorlds();
    const w = list.find((x) => x.id === id);
    if (!w) return;
    w.name = name;
    put(K.worlds, JSON.stringify(list));
    const data = loadWorldData(id);
    if (data) { data.name = name; put(K.world(id), JSON.stringify(data)); }
}

export function deleteWorld(id) {
    del(K.world(id));
    put(K.worlds, JSON.stringify(listWorlds().filter((w) => w.id !== id)));
}

export function duplicateWorld(id) {
    const data = loadWorldData(id);
    const meta = listWorlds().find((w) => w.id === id);
    if (!data || !meta) return null;
    const nid = newId();
    data.name = (meta.name + ' copy').slice(0, 32);
    saveWorld(nid, data, { ...meta, id: nid, name: data.name, created: Date.now() });
    return nid;
}

export const newId = () => 'w' + Date.now().toString(36) + Math.floor(Math.random() * 1e6).toString(36);

// ------------------------------------------------------------------ share codes
const b64 = (bytes) => { let s = ''; for (let i = 0; i < bytes.length; i += 0x8000) s += String.fromCharCode(...bytes.subarray(i, i + 0x8000)); return btoa(s); };
const unb64 = (s) => Uint8Array.from(atob(s), (c) => c.charCodeAt(0));

export async function exportCode(data) {
    const text = JSON.stringify(data);
    try {
        if (typeof CompressionStream === 'function') {
            const buf = await new Response(new Blob([text]).stream().pipeThrough(new CompressionStream('gzip'))).arrayBuffer();
            return 'TOOT1:' + b64(new Uint8Array(buf));
        }
    } catch { /* fall through */ }
    return 'TOOT0:' + b64(new TextEncoder().encode(text));
}

export async function importCode(code) {
    try {
        code = code.trim();
        if (code.startsWith('TOOT1:')) {
            const buf = await new Response(new Blob([unb64(code.slice(6))]).stream().pipeThrough(new DecompressionStream('gzip'))).text();
            return JSON.parse(buf);
        }
        if (code.startsWith('TOOT0:')) return JSON.parse(new TextDecoder().decode(unb64(code.slice(6))));
    } catch { /* bad code */ }
    return null;
}

// ------------------------------------------------------------------ train shed
export function loadShed() {
    const raw = json(K.shed, null);
    if (!Array.isArray(raw)) return DEFAULT_SETS.map((d) => ({ ...d, thumb: '' }));
    const out = [];
    for (const r of raw) { const d = cleanDesign(r); if (d) out.push({ ...d, thumb: typeof r.thumb === 'string' ? r.thumb : '' }); }
    return out;
}
export function saveShed(list) {
    if (!put(K.shed, JSON.stringify(list))) put(K.shed, JSON.stringify(list.map((d) => ({ ...d, thumb: '' }))));
}

// ------------------------------------------------------------------ profile + settings
export function loadProfile() {
    const p = json(K.profile, {});
    return { stickers: {}, islands: 0, last: '', designs: 0, ...p };
}
export function saveProfile(p) { put(K.profile, JSON.stringify(p)); }

export const DEFAULT_SETTINGS = { music: 0.6, sfx: 0.8, muted: false, quality: 'auto', cycle: false, tod: 0.42, help: false, edgeHints: true };
export function loadSettings() { return { ...DEFAULT_SETTINGS, ...json(K.settings, {}) }; }
export function saveSettings(s) { put(K.settings, JSON.stringify(s)); }

export function wipeAll() {
    try {
        const keys = [];
        for (let i = 0; i < localStorage.length; i++) { const k = localStorage.key(i); if (k && k.startsWith(SAVE_KEY)) keys.push(k); }
        for (const k of keys) localStorage.removeItem(k);
    } catch { warn(); }
}

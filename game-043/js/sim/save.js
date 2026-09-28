// ============================================================
// Persistence: three manual slots + an autosave, export/import.
// localStorage can throw (private mode, blocked storage), so every
// access is guarded and the game runs fine without it.
// ============================================================

import { SAVE_VERSION, dateText } from './state.js';

const PREFIX = 'glimmerglen.v1.';
export const SLOTS = ['auto', '1', '2', '3'];

export function serialize(game) {
    game.saveExplored();
    return JSON.stringify(game.s);
}

export function validate(obj) {
    return obj && typeof obj === 'object' && obj.v === SAVE_VERSION && typeof obj.seed === 'number' && obj.player && obj.time && Array.isArray(obj.inv);
}

export function parseSave(text) {
    try { const o = JSON.parse(text); return validate(o) ? o : null; } catch { return null; }
}

export function writeSlot(slot, game) {
    try {
        const data = serialize(game);
        localStorage.setItem(PREFIX + slot, data);
        localStorage.setItem(PREFIX + slot + '.meta', JSON.stringify(metaOf(game.s)));
        return true;
    } catch { return false; }
}

export function readSlot(slot) {
    try { const t = localStorage.getItem(PREFIX + slot); return t ? parseSave(t) : null; } catch { return null; }
}
export function slotMeta(slot) {
    try { const t = localStorage.getItem(PREFIX + slot + '.meta'); return t ? JSON.parse(t) : null; } catch { return null; }
}
export function deleteSlot(slot) { try { localStorage.removeItem(PREFIX + slot); localStorage.removeItem(PREFIX + slot + '.meta'); } catch { /* ignore */ } }

export function metaOf(s) {
    return { name: s.player.name, village: s.villageName, date: dateText(s.time.day), day: s.time.day, level: s.player.level, vlevel: s.village.level, playtime: Math.round(s.playtime), seed: s.seed, saved: Date.now(), shards: s.heartwood };
}

export function latestSlot() {
    let best = null, bt = -1;
    for (const sl of SLOTS) { const m = slotMeta(sl); if (m && m.saved > bt) { bt = m.saved; best = sl; } }
    return best;
}

export function loadOpts() {
    const d = { music: 0.6, sfx: 0.8, touch: 'auto', shake: true, run: false };
    try { return { ...d, ...JSON.parse(localStorage.getItem(PREFIX + 'opts') || '{}') }; } catch { return d; }
}
export function writeOpts(o) { try { localStorage.setItem(PREFIX + 'opts', JSON.stringify(o)); } catch { /* ignore */ } }

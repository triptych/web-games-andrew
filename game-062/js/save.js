// Saves: up to six heroes plus settings, in localStorage. Every access is guarded — a browser
// that blocks site data still plays, it just can't save.

import { SAVE_KEY } from './config.js';

const IDX = `${SAVE_KEY}.index`;
const SET = `${SAVE_KEY}.settings`;
export const MAX_SLOTS = 6;

function get(k) { try { return localStorage.getItem(k); } catch { return null; } }
function put(k, v) { try { localStorage.setItem(k, v); return true; } catch { return false; } }
function del(k) { try { localStorage.removeItem(k); } catch { /* storage blocked */ } }

export function listSlots() {
    try { const a = JSON.parse(get(IDX) || '[]'); return Array.isArray(a) ? a : []; } catch { return []; }
}
export function saveHero(slotId, hero, json) {
    const ok = put(`${SAVE_KEY}.hero.${slotId}`, json);
    if (!ok) return false;
    const list = listSlots().filter((s) => s.id !== slotId);
    list.unshift({ id: slotId, name: hero.name, cls: hero.cls, fruit: hero.look.fruit, level: hero.level, difficulty: hero.difficulty, floor: hero.maxFloor, savedAt: Date.now(), won: hero.quests.core === 3 });
    put(IDX, JSON.stringify(list.slice(0, MAX_SLOTS)));
    return true;
}
export function loadHeroJson(slotId) { return get(`${SAVE_KEY}.hero.${slotId}`); }
export function deleteHero(slotId) {
    del(`${SAVE_KEY}.hero.${slotId}`);
    put(IDX, JSON.stringify(listSlots().filter((s) => s.id !== slotId)));
}
export function newSlotId() { return 's' + Date.now().toString(36) + Math.floor(Math.random() * 1000); }

export const DEFAULT_SETTINGS = { music: 0.55, sfx: 0.8, muted: false, quality: 'auto', labels: 'always', shake: true, numbers: true, tips: true };
export function loadSettings() {
    try { return { ...DEFAULT_SETTINGS, ...(JSON.parse(get(SET) || '{}') || {}) }; } catch { return { ...DEFAULT_SETTINGS }; }
}
export function saveSettings(s) { put(SET, JSON.stringify(s)); }

// Saves and settings in localStorage. Every access is guarded: with storage blocked the game still plays, it just can't remember anything.

import { SAVE_KEY } from './config.js';
import { serialize, deserialize } from './sim/game.js';

const SETTINGS_KEY = SAVE_KEY + '.settings';
const DEFAULTS = { sfx: 0.8, music: 0.6, touch: 'auto', shake: true, reduced: false, quality: 'auto', textSpeed: 2 };

function read(key) { try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : null; } catch { return null; } }
function write(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch { return false; } }

export function loadSettings() { const s = read(SETTINGS_KEY); return { ...DEFAULTS, ...(s && typeof s === 'object' ? s : {}) }; }
export function saveSettings(s) { write(SETTINGS_KEY, s); }
export function hasSave() { return !!read(SAVE_KEY)?.data; }
export function saveInfo() { const s = read(SAVE_KEY); return s?.data ? { savedAt: s.savedAt, ...s.info } : null; }
export function saveGame(G) {
    if (G.mode === 'ending' || G.mode === 'gameover' || G.scene || G.battle) return false;
    const members = G.party.active.map((id) => G.party.members[id]);
    const info = { map: G.map, lvl: Math.round(members.reduce((a, m) => a + m.lvl, 0) / members.length), playtime: Math.round(G.stats.playtime), chapter: G.story.i };
    return write(SAVE_KEY, { savedAt: Date.now(), info, data: serialize(G) });
}
export function loadGame() {
    const s = read(SAVE_KEY);
    if (!s?.data) return null;
    try { return deserialize(s.data); } catch (err) { console.warn('[save] unreadable', err); return null; }
}
export function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch { /* blocked */ } }

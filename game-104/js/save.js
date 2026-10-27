// Saves and settings in localStorage. Every access is guarded: with storage blocked the game
// still plays, it just can't remember anything. A save is a stack of checkpoints (one per room
// entered, plus any "save"), so RESTORE after a death goes back one room, and again, further.

import { SAVE_KEY, CHECKPOINTS, LOG_KEEP } from './config.js';
import { serialize, deserialize } from './sim/game.js';

const SETTINGS_KEY = SAVE_KEY + '.settings';
const DEFAULTS = { sfx: 0.8, music: 0.5, speed: 'normal' };

function read(key) { try { const s = localStorage.getItem(key); return s ? JSON.parse(s) : null; } catch { return null; } }
function write(key, val) { try { localStorage.setItem(key, JSON.stringify(val)); return true; } catch { return false; } }

export function loadSettings() { const s = read(SETTINGS_KEY); return { ...DEFAULTS, ...(s && typeof s === 'object' ? s : {}) }; }
export function saveSettings(s) { write(SETTINGS_KEY, s); }

const stack = () => { const s = read(SAVE_KEY); return Array.isArray(s?.cps) ? s.cps : []; };
export function hasSave() { return stack().length > 0; }

/** Push a checkpoint. Not while dead, finished, or deep in dread (restoring into a doomed state is no mercy). */
export function checkpoint(G, log = [], force = false) {
    if (G.dead || G.ending) return false;
    if (!force && G.dread >= 70) return false;
    const cps = stack();
    cps.push({ data: serialize(G), log: log.slice(-LOG_KEEP), at: Date.now(), tries: 0 });
    return write(SAVE_KEY, { cps: cps.slice(-CHECKPOINTS) });
}

/** The latest checkpoint as { G, log }. A second restore into the same one goes back a step. */
export function restore() {
    let cps = stack();
    while (cps.length) {
        const top = cps[cps.length - 1];
        top.tries = (top.tries || 0) + 1;
        if (top.tries > 2 && cps.length > 1) { cps.pop(); continue; }
        write(SAVE_KEY, { cps });
        try { return { G: deserialize(top.data), log: top.log || [] }; } catch { cps.pop(); }
    }
    write(SAVE_KEY, { cps });
    return null;
}

/** Continue from the title: the latest checkpoint, without counting it as a retry. */
export function latest() {
    const top = stack().pop();
    if (!top) return null;
    try { return { G: deserialize(top.data), log: top.log || [] }; } catch { return null; }
}
export function clearSave() { try { localStorage.removeItem(SAVE_KEY); } catch { /* blocked */ } }

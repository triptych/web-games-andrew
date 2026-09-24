// ============================================================
// Persistence. localStorage can throw (private mode, blocked storage),
// so every access is guarded and the game runs fine without it.
// ============================================================

import { START_HEARTS, START_LIVES } from './config.js';

const KEY = 'popgunpip.save.v1';
const OPT = 'popgunpip.opts.v1';

export function newSave(seed) {
    return {
        v: 1, seed: seed >>> 0,
        gadgets: [], weapons: ['pea'], maxHearts: START_HEARTS, chips: 0,
        shards: [], vaults: [], cleared: [], seen: {},
        lives: START_LIVES, coins: 0, score: 0, hi: 0,
        at: { world: 1, node: 0 },
        stats: { deaths: 0, time: 0, kills: 0, started: Date.now() },
        done: false,
    };
}

export function loadSave() {
    try {
        const raw = localStorage.getItem(KEY);
        if (!raw) return null;
        const s = JSON.parse(raw);
        if (!s || s.v !== 1 || typeof s.seed !== 'number') return null;
        return { ...newSave(s.seed), ...s };
    } catch { return null; }
}

export function writeSave(s) {
    try { localStorage.setItem(KEY, JSON.stringify(s)); return true; } catch { return false; }
}

export function eraseSave() { try { localStorage.removeItem(KEY); } catch { /* ignore */ } }

export function loadOpts() {
    try { return { sound: true, music: true, ...JSON.parse(localStorage.getItem(OPT) || '{}') }; } catch { return { sound: true, music: true }; }
}
export function writeOpts(o) { try { localStorage.setItem(OPT, JSON.stringify(o)); } catch { /* ignore */ } }

/** The in-memory profile the simulation reads (Sets instead of arrays). */
export function profileOf(s) {
    return {
        gadgets: new Set(s.gadgets), weapons: s.weapons.slice(), maxHearts: s.maxHearts, chips: s.chips,
        shards: new Set(s.shards), vaults: new Set(s.vaults),
    };
}

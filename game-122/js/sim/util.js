// Small shared helpers for the simulation. Pure.

import { PHASES, DAY, ESSENCE_INFO } from '../config.js';
import { getWorld } from './world.js';
import { REAGENTS, ITEMS } from './data/reagents.js';

export const worldOf = (G) => getWorld(G.seed);

export function emit(G, ev) { G.events.push(ev); }
export function msg(G, text, tone = 'info') { G.events.push({ type: 'msg', text, tone }); }

export function phaseOf(tod) {
    for (const p of PHASES) if (tod >= p.from && tod < p.to) return p.id;
    return 'night';
}
export const phaseName = (id) => PHASES.find((p) => p.id === id)?.name || id;
export const phaseNow = (G) => phaseOf(G.tod);
export const isNight = (G) => G.tod >= 0.62 || G.tod < 0.02;
export const clockText = (tod) => {
    const h = (tod * 24 + 6) % 24;           // tod 0 is 6 am
    const hh = Math.floor(h), mm = Math.floor((h - hh) * 60);
    return `${String(hh).padStart(2, '0')}:${String(mm).padStart(2, '0')}`;
};
export const daySeconds = DAY;

export const itemName = (id) => REAGENTS[id]?.name || ITEMS[id]?.name || id;
export const essName = (e) => ESSENCE_INFO[e]?.name || e;

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const hdist = (a, x, z) => Math.hypot(a.x - x, a.z - z);

/** A goblin remark, at most one every few seconds and each kind at most once a minute. */
export function bark(G, key, text) {
    if (!G.nib || G.nib.mode !== 'follow') return;
    const last = G.nib.barked[key] ?? -1e9;
    if (G.t - last < 60 || G.t - (G.nib.lastBark ?? -1e9) < 6) return;
    G.nib.barked[key] = G.t;
    G.nib.lastBark = G.t;
    G.events.push({ type: 'bark', text });
}

export function addItem(G, id, n = 1) { G.bag[id] = (G.bag[id] || 0) + n; }
export function takeItem(G, id, n = 1) {
    if ((G.bag[id] || 0) < n) return false;
    G.bag[id] -= n;
    if (G.bag[id] <= 0) delete G.bag[id];
    return true;
}

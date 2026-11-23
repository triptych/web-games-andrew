// Affinity between residents. Points per pair; levels from BOND_LEVELS. Pure.

import { BOND_LEVELS } from '../config.js';
import { VIGNETTES, CHAINS, HEROES } from './data.js';

export const pairKey = (a, b) => (a < b ? `${a}|${b}` : `${b}|${a}`);

export function bondPts(G, a, b) { return G.bonds[pairKey(a, b)] || 0; }

export function bondLevel(G, a, b) {
    if (a === b) return 5;
    const p = bondPts(G, a, b);
    let lv = 1;
    for (let i = 0; i < BOND_LEVELS.length; i++) if (p >= BOND_LEVELS[i]) lv = i + 1;
    return lv;
}

/** Points to the next level, or null at the top. */
export function bondNext(G, a, b) {
    const lv = bondLevel(G, a, b);
    return lv >= BOND_LEVELS.length ? null : BOND_LEVELS[lv] - bondPts(G, a, b);
}

/** Add affinity between two joined residents; queues a vignette and a toast on level up. */
export function addBond(G, a, b, n, why = '') {
    if (a === b || !G.heroes[a]?.joined || !G.heroes[b]?.joined || n <= 0) return;
    const k = pairKey(a, b);
    const before = bondLevel(G, a, b);
    G.bonds[k] = (G.bonds[k] || 0) + n;
    const after = bondLevel(G, a, b);
    if (after > before) {
        G.events.push({ type: 'bondUp', a, b, lv: after, why });
        for (let lv = before + 1; lv <= after; lv++) {
            const v = VIGNETTES[`${k}:${lv}`];
            if (v && !G.seenVignettes.includes(`${k}:${lv}`)) G.vignettes.push(`${k}:${lv}`);
        }
    }
}

/** Every joined pair gets a little closer each day under one roof. */
export function dailyBonds(G) {
    const ids = Object.keys(G.heroes).filter((h) => G.heroes[h].joined);
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) addBond(G, ids[i], ids[j], 2, 'roof');
    // a hero whose favourite decor is on display is comfy: +3 with Maple
    for (const h of ids) if (h !== 'maple' && G.decor.includes(HEROES[h].favDecor)) addBond(G, 'maple', h, 3, 'decor');
}

/** Stat bonus (fraction) a hero gets from bonded party members: +3% per level above 2, per partner. */
export function synergy(G, hero, party) {
    let s = 0;
    for (const o of party) if (o !== hero) s += Math.max(0, bondLevel(G, hero, o) - 2) * 0.03;
    if (G.decor.includes(HEROES[hero].favDecor)) s += 0.05;          // comfy
    return s;
}

/** The chain attacks a party can use right now for one acting hero (solo, duo and trio). */
export function chainsFor(G, actor, partyIds) {
    const out = [];
    for (const [id, c] of Object.entries(CHAINS)) {
        if (!c.members.includes(actor)) continue;
        if (!c.members.every((m) => partyIds.includes(m))) continue;
        if (c.bond) {
            let okb = true;
            if (c.members.length === 2) okb = bondLevel(G, c.members[0], c.members[1]) >= c.bond;
            else for (const m of c.members) if (m !== 'maple' && bondLevel(G, 'maple', m) < c.bond) okb = false;
            if (!okb) continue;
        }
        out.push(id);
    }
    return out;
}

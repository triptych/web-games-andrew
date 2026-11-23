// Small shared helpers for the simulation: inventory, hero stats, levels. Pure.

import { HEROES, ITEMS } from './data.js';

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const round = (v) => Math.round(v);

// ------------------------------------------------------------------ inventory
export const has = (G, id, n = 1) => (G.inv[id] || 0) >= n;
export function give(G, id, n = 1) {
    if (n <= 0) return;
    G.inv[id] = (G.inv[id] || 0) + n;
}
export function take(G, id, n = 1) {
    if (!has(G, id, n)) return false;
    G.inv[id] -= n;
    if (!G.inv[id]) delete G.inv[id];
    return true;
}
export const hasAll = (G, need) => Object.entries(need).every(([k, n]) => has(G, k, n));
export function takeAll(G, need) {
    if (!hasAll(G, need)) return false;
    for (const [k, n] of Object.entries(need)) take(G, k, n);
    return true;
}
export const toolOwned = (G, id) => has(G, id);

// ------------------------------------------------------------------ levels
export const expToNext = (lv) => Math.round(18 * Math.pow(lv, 1.5));
export const MAX_LV = 30;

/** Gain experience; pushes a levelUp event for each level. */
export function gainExp(G, id, n) {
    const h = G.heroes[id];
    if (!h || h.lv >= MAX_LV) return;
    h.exp += Math.round(n);
    while (h.lv < MAX_LV && h.exp >= expToNext(h.lv)) {
        h.exp -= expToNext(h.lv);
        h.lv++;
        G.events.push({ type: 'levelUp', hero: id, lv: h.lv });
    }
}

/** A hero's stats outside battle: level, weapon and accessory. */
export function heroStats(G, id) {
    const def = HEROES[id], h = G.heroes[id];
    const L = h.lv - 1;
    const s = {
        hp: Math.round(def.base.hp + def.grow.hp * L),
        mp: Math.round(def.base.mp + def.grow.mp * L),
        atk: def.base.atk + def.grow.atk * L,
        def: def.base.def + def.grow.def * L,
        mag: def.base.mag + def.grow.mag * L,
        spd: def.base.spd + def.grow.spd * L,
        crit: def.base.crit, eva: def.base.eva,
    };
    for (const slot of ['weapon', 'acc']) {
        const it = ITEMS[h[slot]];
        if (it?.stats) for (const [k, v] of Object.entries(it.stats)) s[k] += v;
    }
    for (const k of ['atk', 'def', 'mag', 'spd']) s[k] = Math.round(s[k] * 10) / 10;
    return s;
}

/** Gear score used by auto-equip: the sum of an item's stats, weighted to the hero's role. */
export function gearScore(id, item) {
    const it = ITEMS[item];
    if (!it?.stats) return 0;
    const mage = HEROES[id].base.mag > HEROES[id].base.atk;
    const w = { atk: mage ? 0.4 : 1.2, mag: mage ? 1.2 : 0.4, def: 0.9, spd: 1.5, crit: 0.8, eva: 0.7, mp: 0.3, hp: 0.1 };
    return Object.entries(it.stats).reduce((a, [k, v]) => a + (w[k] || 0.5) * v, 0);
}

export const joinedHeroes = (G) => Object.keys(G.heroes).filter((h) => G.heroes[h].joined);

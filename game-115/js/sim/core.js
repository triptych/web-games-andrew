// Shared helpers for the simulation: inventory and caps, modifiers, events, lookups.
// Pure. Everything else in js/sim imports from here, never the other way round.

import { DAY_LEN, DAWN_HOUR, SEASON_DAYS } from '../config.js';
import { ITEMS } from './data/items.js';
import { BUILDINGS, stat } from './data/buildings.js';
import { UPGRADES } from './data/upgrades.js';
import { SPECIALS, VILLAGER_TRAITS } from './data/people.js';

export const clamp = (v, lo, hi) => Math.max(lo, Math.min(hi, v));
export const lerp = (a, b, t) => a + (b - a) * t;

// ---------------------------------------------------------------- time
export function dayOf(t) { return 1 + Math.floor(t / DAY_LEN); }
export function phaseOf(t) { return (t % DAY_LEN) / DAY_LEN; }
/** Clock hour 0..24 (the day starts at DAWN_HOUR). */
export function hourOf(t) { return (DAWN_HOUR + phaseOf(t) * 24) % 24; }
export function isNight(t) { const h = hourOf(t); return h >= 20 || h < 5.5; }
export function seasonOf(day) { return Math.floor(((day - 1) / SEASON_DAYS) % 4); }
export function dayOfSeason(day) { return ((day - 1) % SEASON_DAYS) + 1; }

// ---------------------------------------------------------------- events
export function push(G, e) {
    if (G.quiet) return;
    G.events.push(e);
}
/** A line for the "while you were away" summary and the journal log. */
export function note(G, text) {
    if (G.sum) { if (G.sum.notes.length < 14) G.sum.notes.push(text); }
}
export function toast(G, text, kind = 'info') { push(G, { type: 'toast', text, kind }); }

// ---------------------------------------------------------------- lookups
export function bldById(G, id) { return G.buildings.find((b) => b.id === id) || null; }
export function bldsOf(G, type) { return G.buildings.filter((b) => b.type === type); }
/** Finished buildings of a type (level ≥ 1). */
export function builtOf(G, type) { return G.buildings.filter((b) => b.type === type && b.lv >= 1); }
export function bestLv(G, type) { let m = 0; for (const b of G.buildings) if (b.type === type && b.lv > m) m = b.lv; return m; }
export function hall(G) { return G.buildings.find((b) => b.type === 'hall'); }
export function hallLv(G) { return hall(G)?.lv || 1; }
export function vById(G, id) { return G.villagers.find((v) => v.id === id) || null; }
export function hById(G, id) { return G.heroes.find((h) => h.id === id) || null; }
export function nextId(G) { return ++G.nid; }

/** Tile centre of a building's front door: where people walk to. */
export function doorOf(b) {
    const d = BUILDINGS[b.type];
    return { x: b.x + d.w / 2, y: b.y + d.h + 0.4 };
}
export function locPos(G, loc) {
    if (loc === 'plaza') { const h = hall(G); const d = doorOf(h); return { x: d.x + 0.2, y: d.y + 1.2 }; }
    if (loc === 'gate') return gatePos(G);
    if (loc === 'away') return gatePos(G);
    const b = typeof loc === 'number' ? bldById(G, loc) : null;
    return b ? doorOf(b) : locPos(G, 'plaza');
}
export function gatePos(G) { return { x: G.bounds.x0 + 0.5, y: 15.5 }; }
export function dist(a, b) { return Math.hypot(a.x - b.x, a.y - b.y); }

// ---------------------------------------------------------------- inventory and caps
export function stock(G, id) { return G.inv[id] || 0; }
export function has(G, cost) { for (const k in cost) { if (k === 'gold' ? G.gold < cost[k] : stock(G, k) < cost[k]) return false; } return true; }

export function capOf(G, id) {
    const it = ITEMS[id];
    let sh = 0;
    for (const b of G.buildings) if (b.type === 'storehouse' && b.lv >= 1) sh += stat('storehouse', b.lv, 'cap');
    const hl = hallLv(G);
    const m = G.mods;
    if (it.cat === 'raw') return Math.round((50 + 25 * hl + sh) * (1 + m.capMul));
    return Math.round((20 + 10 * hl + sh / 5) * (1 + m.goodsCap + m.capMul));
}
/** Add up to n of an item, never past the cap. Returns how many fit. */
export function addItem(G, id, n) {
    if (n <= 0) return 0;
    const room = Math.max(0, capOf(G, id) - stock(G, id));
    const k = Math.min(n, room);
    if (k > 0) G.inv[id] = stock(G, id) + k;
    return k;
}
export function takeItem(G, id, n) {
    const k = Math.min(n, stock(G, id));
    if (k > 0) { G.inv[id] -= k; if (G.inv[id] <= 0) delete G.inv[id]; }
    return k;
}
export function pay(G, cost, discount = 0) {
    for (const k in cost) {
        const n = Math.ceil(cost[k] * (1 - (k === 'gold' || k === 'lore' ? 0 : 0) - discount));
        if (k === 'gold') G.gold -= n; else takeItem(G, k, n);
    }
}
export function refund(G, cost, f) {
    for (const k in cost) {
        const n = Math.floor(cost[k] * f);
        if (k === 'gold') G.gold += n; else addItem(G, k, n);
    }
}
export function earn(G, n) { G.gold += n; G.stats.goldEarned += n; }

// ---------------------------------------------------------------- modifiers
const FX_KEYS = ['woodMul', 'stoneMul', 'farmMul', 'fishMul', 'husbMul', 'capMul', 'nightWork', 'nearMul', 'craftSpeed', 'dishPrice', 'buffDur', 'coalCut',
    'gearMul', 'goodsCap', 'extraPortion', 'potionMul', 'heroXp', 'heroCap', 'questTime', 'hunger', 'sleep', 'board', 'questGold', 'heroMood', 'heroPower',
    'welcomeRate', 'autoWelcome', 'cozyMul', 'sellMul', 'defenseMul', 'buildTime', 'builders', 'offlineHrs', 'offlineEff', 'renownMul',
    'smithSpeed', 'merchantFreq', 'cozy', 'loreMul', 'upgradeDiscount'];

/** Sum every upgrade and special-folk perk into G.mods. Call after buying or moving in. */
export function recomputeMods(G) {
    const m = {};
    for (const k of FX_KEYS) m[k] = 0;
    for (const id in G.upgrades) {
        const u = UPGRADES[id];
        if (u) for (const k in u.fx) m[k] = (m[k] || 0) + u.fx[k];
    }
    for (const v of G.villagers) {
        const sp = v.special && SPECIALS[v.special];
        if (sp) for (const k in sp.perk) m[k] = (m[k] || 0) + sp.perk[k];
    }
    G.mods = m;
    return m;
}

// ---------------------------------------------------------------- coziness
export function cozyOf(G) {
    let c = 0;
    for (const b of G.buildings) {
        if (b.lv < 1) continue;
        const d = BUILDINGS[b.type];
        c += d.cozy * (d.kind === 'deco' ? 1 : 1 + 0.4 * (b.lv - 1));
    }
    for (const v of G.villagers) c += VILLAGER_TRAITS[v.trait]?.cozy || 0;
    c += G.mods.cozy;
    return Math.round(c * (1 + G.mods.cozyMul));
}

// ---------------------------------------------------------------- prices
export function dishPrice(G, id) {
    const base = ITEMS[id].value;
    return Math.max(1, Math.round(base * (1 + G.mods.dishPrice) * (G.festival ? 1.5 : 1) * (1 + G.cozy / 700)));
}
export function shelfPrice(G, id) {
    const base = ITEMS[id].value;
    const mul = G.priceMul[id] ?? 1;
    return Math.max(1, Math.round(base * 1.1 * mul * (1 + G.mods.sellMul)));
}
export function marketPrice(G, id) {
    return Math.max(1, Math.floor(ITEMS[id].value * 0.6 * (1 + G.mods.sellMul)));
}
export function bedPrice(G, lv) { return Math.round((5 + 2 * lv) * (G.festival ? 1.2 : 1)); }

export function count(G, type, minLv = 1) { let n = 0; for (const b of G.buildings) if (b.type === type && b.lv >= minLv) n++; return n; }

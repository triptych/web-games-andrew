/**
 * state.js — the save: shape, creation, migration, resources, rewards.
 *
 * Everything the player owns lives in one JSON object `S`. Sim modules take
 * `S` as their first argument; the UI never edits it directly.
 */

import { now, dayKey, weekKey } from '../core/time.js';
import { streamRng } from '../core/rng.js';
import { ELEMENTS } from '../data/core.js';
import { ORE_IDS, JEWEL_IDS, CROP_IDS } from '../data/items.js';
import { TALENTS } from '../data/world.js';
import { addOverlordXp } from './overlord.js';

export const SAVE_VERSION = 1;
export const SAVE_KEY = 'sigilborn.save.v1';

export function newState(seed = 1) {
    const t = now();
    const essences = {};
    for (const e of ELEMENTS) essences[e] = { lo: 0, mid: 0, hi: 0 };
    const ores = Object.fromEntries(ORE_IDS.map((o) => [o, 0]));
    const jewels = Object.fromEntries(JEWEL_IDS.map((j) => [j, 0]));
    const crops = Object.fromEntries(CROP_IDS.map((c) => [c, 0]));
    const seeds = Object.fromEntries(CROP_IDS.map((c) => [c, 0]));
    seeds.wheat = 6; seeds.carrot = 3;
    return {
        v: SAVE_VERSION, created: t, saved: t, seed, rng: seed ^ 0x5bd1e995, lastSeen: t,
        overlord: {
            name: 'Overlord', look: null, level: 1, xp: 0,
            talents: Object.fromEntries(Object.keys(TALENTS).map((k) => [k, 0])),
            spells: ['smite', null], title: 'Novice Summoner', titles: ['Novice Summoner'],
        },
        res: {
            gold: 8000, gems: 300, stamina: 60, staminaAt: t, dust: 0, shards: 0, tomes: 0,
            arenaTokens: 0, spireTokens: 0,
            sigils: { common: 5, mystic: 3, fire: 0, water: 0, wind: 0, ld: 0, legend: 0 },
            essences, ores, jewels, crops, seeds,
            items: { xpS: 5, xpM: 1, xpL: 0, seedPack: 1, chest: 1 },
        },
        heroes: [], nextHeroId: 1,
        gear: [], nextGearId: 1,
        teams: { main: [], spire: [], arena: [], rift: [] },
        campaign: { stars: {}, cleared: 0 },
        rifts: { best: {} },
        spire: { floor: 1, best: 0, blessings: [], offer: null },
        arena: { points: 1000, tickets: 5, ticketAt: t, rivals: [], rivalsDay: '', wins: 0, losses: 0, beaten: [] },
        buildings: { treasury: 1, mine: 1, farm: 1, forge: 1, training: 1, tavern: 1 },
        treasury: { since: t, bonusRolls: 0 },
        training: { slots: [] },
        mine: { energy: 30, energyAt: t, depth: 1, grid: null, miners: [], minerSince: t, seed: (seed ^ 0x77) >>> 0 },
        farm: { plots: [], farmers: [] },
        buffs: {},
        expeditions: { board: [], active: [], boardDay: '', seq: 0 },
        quests: { day: '', daily: [], dailyPts: 0, dailyChests: [], week: -1, weekly: [], weeklyPts: 0, weeklyChests: [], main: 0, ach: {} },
        shop: { day: '', stock: [], refreshes: 0 },
        wheel: { day: '', spins: 0 },
        summon: { pity: 0, total: 0, first: true },
        counters: {},
        settings: { sound: true, music: true, quality: 'auto', speed: 1, auto: true, haptics: true },
        story: { intro: false, created: false, tips: {} },
        login: { last: '', streak: 0 },
        codex: { seen: [], claimed: 0 },
        log: [],
    };
}

export function migrate(S) {
    if (!S || typeof S !== 'object') return null;
    const fresh = newState(S.seed || 1);
    // shallow-fill any missing top-level and nested keys so old saves keep working
    const fill = (dst, src) => {
        for (const [k, v] of Object.entries(src)) {
            if (!(k in dst)) dst[k] = structuredClone(v);
            else if (v && typeof v === 'object' && !Array.isArray(v) && dst[k] && typeof dst[k] === 'object' && !Array.isArray(dst[k])) fill(dst[k], v);
        }
    };
    fill(S, fresh);
    S.v = SAVE_VERSION;
    return S;
}

export function rngOf(S) { return streamRng(S, 'rng'); }

// ---------------------------------------------------------------- lookups

export function heroById(S, id) { return S.heroes.find((h) => h.id === id) || null; }
export function gearById(S, id) { return S.gear.find((g) => g.id === id) || null; }
export function gearLookup(S) {
    const m = new Map(S.gear.map((g) => [g.id, g]));
    return (id) => m.get(id) || null;
}

export function addHero(S, hero) {
    hero.id = S.nextHeroId++;
    hero.got = now();
    S.heroes.push(hero);
    return hero;
}

export function addGear(S, g) {
    g.id = S.nextGearId++;
    S.gear.push(g);
    return g;
}

// ---------------------------------------------------------------- counters

export function bump(S, key, n = 1) { S.counters[key] = (S.counters[key] || 0) + n; }
export function counter(S, key) { return S.counters[key] || 0; }
export function maxCounter(S, key, v) { if ((S.counters[key] || 0) < v) S.counters[key] = v; }

export function today() { return dayKey(); }
export function thisWeek() { return weekKey(); }

// ---------------------------------------------------------------- resources

/** cost: { gold, gems, dust, shards, tomes, arenaTokens, spireTokens, ores:{}, jewels:{}, crops:{}, items:{}, sigils:{}, essences:{el:{lo}} } */
export function canAfford(S, cost) {
    const R = S.res;
    for (const [k, v] of Object.entries(cost)) {
        if (!v) continue;
        if (typeof v === 'number') { if ((R[k] || 0) < v) return false; continue; }
        if (k === 'essences') {
            for (const [el, tiers] of Object.entries(v)) for (const [t, n] of Object.entries(tiers)) if ((R.essences[el][t] || 0) < n) return false;
            continue;
        }
        for (const [kk, n] of Object.entries(v)) if ((R[k][kk] || 0) < n) return false;
    }
    return true;
}

export function spend(S, cost) {
    if (!canAfford(S, cost)) return false;
    const R = S.res;
    for (const [k, v] of Object.entries(cost)) {
        if (!v) continue;
        if (typeof v === 'number') { R[k] -= v; if (k === 'gold') bump(S, 'goldSpent', v); if (k === 'gems') bump(S, 'gemsSpent', v); continue; }
        if (k === 'essences') {
            for (const [el, tiers] of Object.entries(v)) for (const [t, n] of Object.entries(tiers)) R.essences[el][t] -= n;
            continue;
        }
        for (const [kk, n] of Object.entries(v)) R[k][kk] -= n;
    }
    return true;
}

/**
 * Grants a reward bundle. Returns a flat list of { kind, id?, n, label? } for
 * display. Gear and heroes inside the bundle are added to the collection.
 */
export function grant(S, b) {
    const out = [];
    const R = S.res;
    const num = (k, n) => { if (!n) return; R[k] = (R[k] || 0) + n; out.push({ kind: k, n }); if (k === 'gold') bump(S, 'goldEarned', n); };
    num('gold', b.gold); num('gems', b.gems); num('dust', b.dust); num('shards', b.shards); num('tomes', b.tomes);
    num('arenaTokens', b.arenaTokens); num('spireTokens', b.spireTokens);
    if (b.stamina) { R.stamina += b.stamina; out.push({ kind: 'stamina', n: b.stamina }); }
    for (const grp of ['sigils', 'ores', 'jewels', 'crops', 'seeds', 'items']) {
        if (!b[grp]) continue;
        for (const [id, n] of Object.entries(b[grp])) {
            if (!n) continue;
            R[grp][id] = (R[grp][id] || 0) + n;
            out.push({ kind: grp, id, n });
        }
    }
    if (b.essences) for (const [el, tiers] of Object.entries(b.essences)) for (const [t, n] of Object.entries(tiers)) {
        if (!n) continue;
        R.essences[el][t] += n;
        out.push({ kind: 'essences', id: el, tier: t, n });
    }
    if (b.gear) for (const g of b.gear) { addGear(S, g); out.push({ kind: 'gear', gear: g, n: 1 }); }
    if (b.heroes) for (const h of b.heroes) { addHero(S, h); out.push({ kind: 'hero', hero: h, n: 1 }); }
    if (b.xp) { const lv = addOverlordXp(S, b.xp); out.push({ kind: 'xp', n: b.xp }); if (lv) out.push({ kind: 'olLevel', n: lv }); }
    return out;
}

export function log(S, text, kind = 'info') {
    S.log.unshift({ t: now(), text, kind });
    if (S.log.length > 60) S.log.length = 60;
}

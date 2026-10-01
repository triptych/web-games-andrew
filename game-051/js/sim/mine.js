/**
 * mine.js — the Delve: a 7-wide rock face you dig down through, layer by
 * layer, plus idle miners who dig while you are away.
 */

import { Rng } from '../core/rng.js';
import { now, MIN, HOUR } from '../core/time.js';
import { ORES, ORE_IDS, JEWEL_IDS } from '../data/items.js';
import { ELEMENTS } from '../data/core.js';
import { grant, bump, rngOf, heroById } from './state.js';

export const MINE_W = 7;
export const MINE_H = 10;

export const CELL = {
    dirt:    { name: 'Soil',          hp: 1, color: '#8a6040' },
    stone:   { name: 'Stone',         hp: 2, color: '#7a7a86' },
    hard:    { name: 'Deep Stone',    hp: 4, color: '#4a4a5a' },
    bedrock: { name: 'Bedrock',       hp: Infinity, color: '#2a2a32' },
    ore:     { name: 'Ore Vein',      hp: 3, color: '#d9884a' },
    jewel:   { name: 'Jewel',         hp: 4, color: '#ff3a5a' },
    chest:   { name: 'Buried Chest',  hp: 2, color: '#c08a3a' },
    geode:   { name: 'Geode',         hp: 3, color: '#a070e0' },
    fossil:  { name: 'Fossil',        hp: 2, color: '#e8dcc0' },
    essence: { name: 'Essence Crystal', hp: 3, color: '#7af0ff' },
    cache:   { name: 'Sigil Cache',   hp: 3, color: '#ffd84a' },
};

export function maxEnergy(S) { return 30 + 5 * (S.buildings.mine - 1); }
export function energyMins(S) { return Math.max(1.2, 3 - 0.2 * (S.buildings.mine - 1)); }
export function pickPower(S) { return 1 + Math.floor((S.buildings.mine - 1) / 3); }
export function minerSlots(S) { return 1 + Math.floor(S.buildings.mine / 3); }

export function tickEnergy(S, t = now()) {
    const M = S.mine, cap = maxEnergy(S), step = energyMins(S) * MIN;
    if (M.energy >= cap) { M.energyAt = t; return; }
    const n = Math.floor((t - M.energyAt) / step);
    if (n > 0) {
        M.energy = Math.min(cap, M.energy + n);
        M.energyAt += n * step;
        if (M.energy >= cap) M.energyAt = t;
    }
}

export function energyNext(S, t = now()) {
    if (S.mine.energy >= maxEnergy(S)) return 0;
    return S.mine.energyAt + energyMins(S) * MIN - t;
}

function oreTable(depth) {
    const maxTier = Math.min(7, 1 + Math.floor((depth + 1) / 3));
    return ORE_IDS.filter((o) => ORES[o].tier <= maxTier).map((o) => [o, Math.pow(0.55, maxTier - ORES[o].tier) * (ORES[o].tier === maxTier ? 0.6 : 1)]);
}

export function generateLayer(seed, depth) {
    const rng = new Rng((seed ^ (depth * 0x9e3779b1)) >>> 0);
    const grid = [];
    const ores = oreTable(depth);
    for (let r = 0; r < MINE_H; r++) {
        const row = [];
        for (let c = 0; c < MINE_W; c++) {
            const deep = r / MINE_H + depth * 0.08;
            let k = rng.next() < 0.45 - deep * 0.25 ? 'dirt' : rng.next() < 0.25 + deep * 0.3 ? 'hard' : 'stone';
            let extra = null;
            const roll = rng.next();
            if (roll < 0.22) { k = 'ore'; extra = rng.weighted(ores); }
            else if (roll < 0.25 && depth >= 2) { k = 'jewel'; extra = rng.weighted(JEWEL_IDS.map((j) => [j, j === 'diamond' ? 0.25 : j === 'topaz' ? 0.8 : 1])); }
            else if (roll < 0.265) k = 'chest';
            else if (roll < 0.28) k = 'geode';
            else if (roll < 0.29) k = 'fossil';
            else if (roll < 0.302) { k = 'essence'; extra = rng.pick(ELEMENTS); }
            else if (roll < 0.306) k = 'cache';
            else if (roll < 0.34 && r > 0 && r < MINE_H - 1) k = 'bedrock';
            let hp = CELL[k].hp;
            if (k === 'ore') hp = 1 + ORES[extra].tier;
            if (k === 'hard') hp = 3 + Math.floor(depth / 4);
            row.push({ k, x: extra, hp, max: hp, open: false });
        }
        grid.push(row);
    }
    // every column of the bottom row must be reachable: never more than 3 bedrock in a row
    for (let r = 1; r < MINE_H - 1; r++) {
        let run = 0;
        for (let c = 0; c < MINE_W; c++) {
            if (grid[r][c].k === 'bedrock') { run++; if (run > 2) { grid[r][c] = { k: 'stone', x: null, hp: 2, max: 2, open: false }; run = 0; } } else run = 0;
        }
    }
    return grid;
}

export function ensureGrid(S) {
    if (!S.mine.grid) S.mine.grid = generateLayer(S.mine.seed, S.mine.depth);
    return S.mine.grid;
}

export function canHit(S, r, c) {
    const g = ensureGrid(S);
    const cell = g[r] && g[r][c];
    if (!cell || cell.open || cell.k === 'bedrock') return false;
    if (r === 0) return true;
    const n = [[r - 1, c], [r + 1, c], [r, c - 1], [r, c + 1]];
    return n.some(([y, x]) => g[y] && g[y][x] && g[y][x].open);
}

export function cellDrops(S, cell, rng) {
    const d = S.mine.depth;
    switch (cell.k) {
        case 'dirt': return rng.chance(0.06) ? { seeds: { [rng.pick(['wheat', 'carrot', 'pumpkin'])]: 1 } } : rng.chance(0.3) ? { gold: 5 * d } : {};
        case 'stone': return rng.chance(0.35) ? { gold: 12 * d } : {};
        case 'hard': return { gold: 25 * d, ...(rng.chance(0.15) ? { ores: { [rng.weighted(oreTable(d))]: 1 } } : {}) };
        case 'ore': return { ores: { [cell.x]: rng.int(1, 2) + Math.floor(d / 6) } };
        case 'jewel': return { jewels: { [cell.x]: 1 } };
        case 'chest': {
            const b = { gold: rng.int(200, 500) * d };
            const r = rng.next();
            if (r < 0.3) b.items = { xpM: 1 }; else if (r < 0.5) b.items = { seedPack: 1 }; else if (r < 0.65) b.tomes = 1; else if (r < 0.8) b.shards = rng.int(3, 8); else b.gems = rng.int(10, 30);
            return b;
        }
        case 'geode': {
            const jw = {};
            for (let i = rng.int(2, 4); i > 0; i--) { const j = rng.weighted(JEWEL_IDS.map((x) => [x, x === 'diamond' ? 0.3 : 1])); jw[j] = (jw[j] || 0) + 1; }
            return { jewels: jw };
        }
        case 'fossil': return { gold: 600 * d, dust: 10 * d };
        case 'essence': return { essences: { [cell.x]: { lo: rng.int(2, 4), mid: d >= 3 ? rng.int(0, 2) : 0, hi: d >= 8 && rng.chance(0.3) ? 1 : 0 } } };
        case 'cache': return rng.chance(0.85) ? { sigils: { common: rng.int(1, 3) } } : { sigils: { mystic: 1 } };
        default: return {};
    }
}

/** One pick strike. Returns { ok, broken, items, cell } or { ok:false, reason }. */
export function strike(S, r, c) {
    tickEnergy(S);
    if (S.mine.energy < 1) return { ok: false, reason: 'energy' };
    if (!canHit(S, r, c)) return { ok: false, reason: 'blocked' };
    const cell = S.mine.grid[r][c];
    S.mine.energy--;
    if (S.mine.energy < maxEnergy(S) && S.mine.energy === maxEnergy(S) - 1) S.mine.energyAt = now();
    cell.hp -= pickPower(S);
    bump(S, 'strikes');
    if (cell.hp > 0) return { ok: true, broken: false, cell };
    cell.open = true;
    cell.hp = 0;
    bump(S, 'blocks');
    const rng = rngOf(S);
    const items = grant(S, cellDrops(S, cell, rng));
    return { ok: true, broken: true, cell, items, special: ['chest', 'geode', 'fossil', 'essence', 'cache', 'jewel'].includes(cell.k) };
}

export function canDescend(S) {
    const g = ensureGrid(S);
    return g[MINE_H - 1].some((cell) => cell.open);
}

export function descend(S) {
    if (!canDescend(S)) return false;
    S.mine.depth++;
    S.mine.grid = generateLayer(S.mine.seed, S.mine.depth);
    bump(S, 'depths');
    if (S.mine.depth > (S.counters.mineDepth || 1)) S.counters.mineDepth = S.mine.depth;
    return true;
}

// ---------------------------------------------------------------- idle miners

export function minerRate(S, hero) {
    const base = 6 + 2 * S.buildings.mine;
    return base * (hero && hero.traits.includes('miner') ? 2 : 1); // ore per hour
}

export function minersPending(S, t = now()) {
    const hours = Math.min(24, (t - S.mine.minerSince) / HOUR);
    let total = 0;
    for (const id of S.mine.miners) total += minerRate(S, heroById(S, id)) * hours;
    return Math.floor(total);
}

export function collectMiners(S, t = now()) {
    const n = minersPending(S, t);
    S.mine.minerSince = t;
    if (n < 1) return null;
    const rng = rngOf(S);
    const table = oreTable(S.mine.depth);
    const ores = {};
    for (let i = 0; i < n; i++) { const o = rng.weighted(table); ores[o] = (ores[o] || 0) + 1; }
    const b = { ores };
    if (n >= 20 && rng.chance(0.3)) b.jewels = { [rng.pick(JEWEL_IDS.slice(0, 5))]: 1 };
    return grant(S, b);
}

export function setMiners(S, ids, t = now()) {
    collectMiners(S, t);
    S.mine.miners = ids.slice(0, minerSlots(S));
}

/**
 * farm.js — real-time crops, watering, golden mutations, farmers, the
 * seed shop and the Kitchen.
 */

import { now, MIN } from '../core/time.js';
import { CROPS, CROP_IDS, GOLDEN_CHANCE, RECIPES } from '../data/items.js';
import { grant, bump, rngOf, heroById, spend, canAfford } from './state.js';
import { addBuff } from './idle.js';

export function plotCount(S) { return Math.min(12, 4 + (S.buildings.farm - 1)); }
export function farmerSlots(S) { return 1 + Math.floor(S.buildings.farm / 3); }
export function growthMult(S) { return 1 - 0.05 * (S.buildings.farm - 1); }
export function cropUnlocked(S, id) { return CROPS[id].unlock <= S.buildings.farm; }

export function ensurePlots(S) {
    while (S.farm.plots.length < plotCount(S)) S.farm.plots.push({ crop: null });
    return S.farm.plots;
}

export function plotStage(p, t = now()) {
    if (!p.crop) return -1;
    const f = Math.min(1, (t - p.plantedAt) / (p.readyAt - p.plantedAt));
    return f >= 1 ? 3 : Math.floor(f * 3);
}

export function plotProgress(p, t = now()) {
    if (!p.crop) return 0;
    return Math.min(1, (t - p.plantedAt) / (p.readyAt - p.plantedAt));
}

export function plant(S, i, crop, t = now()) {
    ensurePlots(S);
    const p = S.farm.plots[i];
    if (!p || p.crop || !CROPS[crop] || (S.res.seeds[crop] || 0) < 1) return false;
    S.res.seeds[crop]--;
    const rng = rngOf(S);
    const dur = CROPS[crop].mins * MIN * growthMult(S);
    Object.assign(p, { crop, plantedAt: t, readyAt: t + dur, watered: [false, false, false], golden: rng.chance(GOLDEN_CHANCE) });
    bump(S, 'plants');
    return true;
}

export function canWater(p, t = now()) {
    if (!p.crop) return false;
    const st = plotStage(p, t);
    return st < 3 && !p.watered[st];
}

export function water(S, i, t = now()) {
    const p = S.farm.plots[i];
    if (!p || !canWater(p, t)) return false;
    const st = plotStage(p, t);
    p.watered[st] = true;
    const f = plotProgress(p, t);
    const ready = p.readyAt - (p.readyAt - t) * 0.2;
    // move the start too, so the progress fraction (and the visible stage) stays continuous
    p.plantedAt = (t - f * ready) / (1 - f);
    p.readyAt = ready;
    bump(S, 'waters');
    return true;
}

export function farmerBonus(S) {
    let b = 0;
    for (const id of S.farm.farmers) {
        const h = heroById(S, id);
        if (h) b += h.traits.includes('greenthumb') ? 0.4 : 0.2;
    }
    return b;
}

export function harvest(S, i, t = now()) {
    const p = S.farm.plots[i];
    if (!p || !p.crop || t < p.readyAt) return null;
    const rng = rngOf(S);
    const C = CROPS[p.crop];
    let n = rng.int(C.yield[0], C.yield[1]);
    n = Math.round(n * (1 + farmerBonus(S)));
    const b = { crops: { [p.crop]: n } };
    if (p.golden) { b.crops[p.crop] = n * 3; b.gems = rng.int(5, 15); }
    if (rng.chance(0.25)) b.seeds = { [p.crop]: 1 };
    const golden = p.golden, crop = p.crop;
    S.farm.plots[i] = { crop: null };
    bump(S, 'harvests');
    if (golden) bump(S, 'goldenHarvests');
    return { golden, crop, items: grant(S, b) };
}

export function harvestAll(S, t = now()) {
    const out = [];
    S.farm.plots.forEach((p, i) => { if (p.crop && t >= p.readyAt) out.push(harvest(S, i, t)); });
    return out;
}

export function setFarmers(S, ids) { S.farm.farmers = ids.slice(0, farmerSlots(S)); }

export function buySeeds(S, crop, n = 1) {
    if (!cropUnlocked(S, crop)) return false;
    if (!spend(S, { gold: CROPS[crop].seedCost * n })) return false;
    S.res.seeds[crop] = (S.res.seeds[crop] || 0) + n;
    return true;
}

export function openSeedPack(S) {
    if ((S.res.items.seedPack || 0) < 1) return null;
    S.res.items.seedPack--;
    const rng = rngOf(S);
    const seeds = {};
    const pool = CROP_IDS.map((c) => [c, 1 / Math.sqrt(CROPS[c].mins)]);
    for (let i = rng.int(3, 5); i > 0; i--) { const c = rng.weighted(pool); seeds[c] = (seeds[c] || 0) + 1; }
    return grant(S, { seeds });
}

export function sellCrop(S, crop, n) {
    if ((S.res.crops[crop] || 0) < n) return false;
    S.res.crops[crop] -= n;
    grant(S, { gold: CROPS[crop].sell * n });
    return true;
}

// ---------------------------------------------------------------- kitchen

export function canCook(S, id) { return canAfford(S, { crops: RECIPES[id].needs }); }

export function cook(S, id) {
    const R = RECIPES[id];
    if (!spend(S, { crops: R.needs })) return null;
    bump(S, 'cooks');
    if (R.gives.item) return grant(S, { items: { [R.gives.item]: R.gives.n } });
    addBuff(S, R.gives.buff, R.gives.mins);
    return [{ kind: 'buff', id: R.gives.buff, n: R.gives.mins }];
}

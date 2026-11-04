// Building, gathering, crafting and the market: everything the town makes while nobody is looking.

import { BOUNDS } from '../config.js';
import { BUILDINGS, stat, rateOf, costOf, timeOf, reqHall, nameOf } from './data/buildings.js';
import { ITEMS, RECIPES } from './data/items.js';
import { clamp, push, note, toast, stock, addItem, takeItem, hall, hallLv, recomputeMods, capOf, seasonOf, marketPrice, earn, builtOf, vById, bestLv } from './core.js';
import { addRenown } from './journal.js';
import { refreshRecruits } from './heroes.js';
import { refreshBoard } from './quests.js';
import { workerMul, nightMul, trainWorkers, autoAssign } from './townsfolk.js';
import { nodesNear } from './world.js';

// ---------------------------------------------------------------- construction
export function builderCap(G) {
    return stat('hall', hallLv(G), 'builders') + G.mods.builders;
}
export function buildTimeFor(G, type, lv) {
    return Math.max(3, Math.round(timeOf(type, lv) * (1 - G.mods.buildTime)));
}
export function constructions(G) {
    return G.buildings.filter((b) => b.bld).sort((a, b) => a.bld.seq - b.bld.seq);
}

export function tickBuilds(G, dt) {
    const list = constructions(G);
    const cap = builderCap(G);
    for (let i = 0; i < list.length && i < cap; i++) {
        const b = list[i];
        b.bld.t -= dt;
        if (b.bld.t <= 0) finishBuild(G, b);
    }
}

export function finishBuild(G, b) {
    const up = b.lv >= 1;
    b.lv = b.bld.to;
    b.bld = null;
    const d = BUILDINGS[b.type];
    if (b.type === 'hall') G.bounds = { ...BOUNDS[b.lv - 1] };
    defaultAuto(b);
    // a little renown for the firsts: the first of each kind, and a building brought to its best
    G.flags.firsts = G.flags.firsts || {};
    if (b.lv === 1 && !G.flags.firsts[b.type] && b.type !== 'hall' && d.kind !== 'deco') { G.flags.firsts[b.type] = 1; addRenown(G, 1); }
    if (b.lv === d.maxLv && d.maxLv > 1 && b.type !== 'hall') addRenown(G, 2);
    recomputeMods(G);
    refreshNear(G);
    // a new Lodge has people looking for work and jobs on the board straight away, not at the next dawn
    if (b.type === 'guild') { refreshRecruits(G); refreshBoard(G); }
    push(G, { type: up ? 'upgraded' : 'built', id: b.id, btype: b.type, lv: b.lv });
    toast(G, `${nameOf(b.type, b.lv)} ${up ? 'upgraded' : 'is finished'}!`, 'good');
    note(G, `${nameOf(b.type, b.lv)} ${up ? `reached level ${b.lv}` : 'was built'}.`);
    if (d.skill) autoAssign(G);
}

/** Processors start with a sensible stock target so a new town works without fiddling. */
export function defaultAuto(b) {
    if (b.autoSet) return;
    b.autoSet = true;
    if (b.type === 'carpenter') b.auto.plank = 20;
    else if (b.type === 'mill') b.auto.flour = 14;
    else if (b.type === 'loom') b.auto.cloth = 12;
    else if (b.type === 'smithy') { b.auto.ingot = 10; }
}

export function refreshNear(G) {
    for (const b of G.buildings) {
        const d = BUILDINGS[b.type];
        b.near = d.near ? nodesNear(G, b, d.near) : 0;
    }
}

// ---------------------------------------------------------------- gathering
function itemMul(G, item) {
    const m = G.mods;
    switch (item) {
        case 'wood': return 1 + m.woodMul;
        case 'stone': case 'ore': case 'coal': case 'gem': return 1 + m.stoneMul;
        case 'wheat': case 'berry': case 'apple': case 'herb': case 'mushroom': return 1 + m.farmMul;
        case 'fish': return 1 + m.fishMul;
        case 'egg': case 'honey': return 1 + m.husbMul;
        case 'lore': return 1 + m.loreMul;
        default: return 1;
    }
}
export function seasonMul(G, item) {
    const s = seasonOf(G.day), w = G.weather;
    let m = 1;
    if (s === 0) { if (['wheat', 'berry', 'apple', 'herb'].includes(item)) m *= 1.1; }
    else if (s === 1) { if (item === 'fish') m *= 1.1; if (item === 'apple' || item === 'berry') m *= 1.2; }
    else if (s === 2) { if (item === 'wheat' || item === 'apple') m *= 1.3; if (item === 'mushroom') m *= 1.3; }
    else { if (item === 'wheat') m *= 0.6; if (item === 'berry' || item === 'apple') m *= 0.5; if (item === 'herb') m *= 0.7; if (item === 'fish') m *= 0.9; if (item === 'wood') m *= 1.1; }
    if (w === 'rain') { if (item === 'wheat' || item === 'herb') m *= 1.2; if (item === 'fish') m *= 1.1; }
    else if (w === 'snow') { m *= item === 'wheat' ? 0.7 : 0.92; }
    return m;
}

/** Units per second a gatherer makes of one of its goods. */
export function outRate(G, b, o) {
    const d = BUILDINGS[b.type];
    if (b.lv < 1 || (o.minLv && b.lv < o.minLv)) return 0;
    let sum = 0;
    for (const vid of b.workers) {
        const v = vById(G, vid);
        if (v) sum += workerMul(G, v, d.skill, 'gather') * nightMul(G, v);
    }
    if (sum <= 0) return 0;
    const near = d.near ? Math.min(0.5, b.near * 0.04) * (1 + G.mods.nearMul) : 0;
    return (sum * rateOf(b.lv) * (1 + near) * itemMul(G, o.item) * seasonMul(G, o.item)) / o.every;
}

function tickGather(G, b, dt) {
    const d = BUILDINGS[b.type];
    let worked = false;
    for (const o of d.out) {
        const r = outRate(G, b, o);
        if (r <= 0) continue;
        worked = true;
        const full = stock(G, o.item) >= capOf(G, o.item);
        b.full = full;
        let acc = (b.acc[o.item] || 0) + r * dt;
        let n = Math.floor(acc);
        if (n > 0) {
            acc -= n;
            let bonus = 0;
            for (const vid of b.workers) {
                const v = vById(G, vid);
                if (v && v.trait === 'lucky' && G.rng() < 0.05 * Math.min(1, n)) bonus++;
            }
            const got = addItem(G, o.item, n + bonus);
            if (got > 0) {
                b.gain = (b.gain || 0) + got;
                if (G.t - (b.lastGain || 0) > 3) { push(G, { type: 'gain', bid: b.id, item: o.item, n: b.gain }); b.gain = 0; b.lastGain = G.t; }
                G.stats.gathered = (G.stats.gathered || 0) + got;
            }
        }
        b.acc[o.item] = full ? Math.min(acc, 1) : acc;
    }
    if (worked) trainWorkers(G, b, dt);
}

// ---------------------------------------------------------------- crafting
export function craftSpeed(G, b) {
    const d = BUILDINGS[b.type];
    let sum = 0;
    for (const vid of b.workers) {
        const v = vById(G, vid);
        if (v) sum += workerMul(G, v, d.skill, 'craft') * nightMul(G, v);
    }
    if (sum <= 0) return 0;
    let s = sum * rateOf(b.lv) * (1 + G.mods.craftSpeed);
    if (b.type === 'smithy' || b.type === 'carpenter') s *= 1 + G.mods.smithSpeed;
    return s;
}

export function canRun(G, b, rec) {
    if (!rec || rec.station !== b.type || rec.lv > b.lv) return false;
    for (const k in rec.in) if (stock(G, k) < rec.in[k]) return false;
    if (stock(G, rec.out) >= capOf(G, rec.out)) return false;
    return true;
}

function startJob(G, b, rec) {
    for (const k in rec.in) {
        let n = rec.in[k];
        if (k === 'coal' && G.mods.coalCut > 0) n = Math.max(0, n - (G.rng() < G.mods.coalCut ? 1 : 0));
        takeItem(G, k, n);
    }
    b.job = { rid: rec.id, p: 0, need: rec.time };
}

function pickJob(G, b) {
    for (let i = 0; i < b.queue.length; i++) {
        const q = b.queue[i];
        const rec = RECIPES[q.rid];
        if (!canRun(G, b, rec)) continue;
        q.n--;
        if (q.n <= 0) b.queue.splice(i, 1);
        startJob(G, b, rec);
        return true;
    }
    // standing orders: the one furthest below its target goes first, so no recipe starves the rest
    let best = null, bd = 0;
    for (const rid in b.auto) {
        const target = b.auto[rid];
        const rec = RECIPES[rid];
        if (!(target > 0) || !rec) continue;
        const have = stock(G, rec.out);
        if (have >= target || !canRun(G, b, rec)) continue;
        const deficit = (target - have) / target;
        if (deficit > bd) { bd = deficit; best = rec; }
    }
    if (best) { startJob(G, b, best); return true; }
    return false;
}

function finishJob(G, b) {
    const rec = RECIPES[b.job.rid];
    let n = rec.n;
    if (rec.kind === 'cook' && G.mods.extraPortion > 0 && G.rng() < G.mods.extraPortion) n++;
    const got = addItem(G, rec.out, n);
    b.job = null;
    const s = G.stats;
    s.crafted[rec.out] = (s.crafted[rec.out] || 0) + got;
    const it = ITEMS[rec.out];
    if (it.cat === 'dish') { s.cooked++; s.cookedItem[rec.out] = (s.cookedItem[rec.out] || 0) + got; }
    if (it.cat === 'gear') { s.craftedCat.gear = (s.craftedCat.gear || 0) + 1; s.tierMade = Math.max(s.tierMade, it.tier); }
    if (it.cat === 'potion') s.craftedCat.potion = (s.craftedCat.potion || 0) + 1;
    push(G, { type: 'craft', bid: b.id, item: rec.out, n: got });
}

function tickCraft(G, b, dt) {
    const sp = craftSpeed(G, b);
    if (sp <= 0) return;
    let rem = dt, guard = 0;
    let worked = false;
    while (rem > 1e-9 && guard++ < 40) {
        if (!b.job && !pickJob(G, b)) break;
        worked = true;
        const left = (b.job.need - b.job.p) / sp;
        if (left <= rem) { rem -= left; finishJob(G, b); }
        else { b.job.p += rem * sp; rem = 0; }
    }
    if (worked) trainWorkers(G, b, dt);
}

export function tickProduction(G, dt) {
    for (const b of G.buildings) {
        if (b.lv < 1) continue;
        const d = BUILDINGS[b.type];
        if (d.out) tickGather(G, b, dt);
        else if (d.kind === 'craft') tickCraft(G, b, dt);
    }
}

// ---------------------------------------------------------------- the market
export function tickMarket(G, dt) {
    const mk = builtOf(G, 'market');
    if (!mk.length) return;
    let budget = G.marketBudget + dt * mk.reduce((s, b) => s + stat('market', b.lv, 'sell') * (b.workers.length ? 1 : 0.5), 0);
    for (const id in G.autoSell) {
        const keep = G.autoSell[id];
        if (keep == null || keep < 0) continue;
        const have = stock(G, id);
        if (have <= keep) continue;
        const n = Math.min(have - keep, Math.floor(budget));
        if (n <= 0) continue;
        takeItem(G, id, n);
        const gold = n * marketPrice(G, id);
        earn(G, gold);
        G.stats.marketGold += gold;
        G.stats.marketSold += n;
        budget -= n;
        push(G, { type: 'sell', item: id, n, gold });
    }
    G.marketBudget = Math.min(budget, 20);
}

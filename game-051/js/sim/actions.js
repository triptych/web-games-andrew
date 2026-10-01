/**
 * actions.js — player actions on heroes and gear: elixirs, evolution,
 * awakening, skill-ups, release, equipping, enhancing, reforging, crafting.
 * Each returns a result object (or null when not allowed) and bumps counters.
 */

import { ITEMS, SLOTS } from '../data/items.js';
import { MAX_LEVEL } from '../data/core.js';
import { addXp, xpToMax, canEvolve, evolve, evolveCost, awaken, awakenCost, skillUp, releaseValue, maxLevel } from './heroes.js';
import { upgrade, upgradeCost, reforge, reforgeCost, craftGear, craftCost, sellValue, gearScore } from './gear.js';
import { heroById, gearById, spend, canAfford, bump, maxCounter, rngOf, addGear, grant } from './state.js';
import { heroBusy, isTraining } from './idle.js';

// ---------------------------------------------------------------- heroes

export function useElixir(S, heroId, item, n = 1) {
    const h = heroById(S, heroId);
    if (!h || !ITEMS[item] || !ITEMS[item].xp) return null;
    if (h.level >= maxLevel(h)) return null;
    let used = 0, levels = 0;
    while (used < n && (S.res.items[item] || 0) > 0 && h.level < maxLevel(h)) {
        S.res.items[item]--;
        used++;
        levels += addXp(h, ITEMS[item].xp);
    }
    bump(S, 'elixirs', used);
    if (levels) bump(S, 'levelUps', levels);
    return { used, levels };
}

/** Uses the smallest set of elixirs to reach max level (or as close as possible). */
export function autoLevel(S, heroId) {
    const h = heroById(S, heroId);
    if (!h) return null;
    let levels = 0, used = 0;
    for (const item of ['xpL', 'xpM', 'xpS']) {
        while ((S.res.items[item] || 0) > 0 && h.level < maxLevel(h)) {
            const need = xpToMax(h);
            if (item !== 'xpS' && ITEMS[item].xp > need * 1.15 && (S.res.items.xpS || 0) * 600 + (S.res.items.xpM || 0) * 3000 >= need) break;
            S.res.items[item]--;
            used++;
            levels += addXp(h, ITEMS[item].xp);
        }
    }
    bump(S, 'elixirs', used);
    if (levels) bump(S, 'levelUps', levels);
    return { used, levels };
}

export function inTeam(S, id) { return Object.values(S.teams).some((t) => t.includes(id)); }

export function fodderOk(S, h) {
    return !h.locked && !inTeam(S, h.id) && !heroBusy(S, h.id);
}

export function evolveHero(S, heroId, fodderIds) {
    const h = heroById(S, heroId);
    if (!h || !canEvolve(h)) return null;
    const cost = evolveCost(h);
    const fodder = fodderIds.map((id) => heroById(S, id)).filter(Boolean);
    if (fodder.length !== cost.fodder || fodder.some((f) => f.id === h.id || f.star !== h.star || !fodderOk(S, f))) return null;
    if (!spend(S, { gold: cost.gold })) return null;
    for (const f of fodder) removeHero(S, f.id, false);
    evolve(h);
    bump(S, 'evolves');
    if (h.star >= 5) bump(S, 'fiveStars');
    return { star: h.star };
}

export function awakenHero(S, heroId) {
    const h = heroById(S, heroId);
    if (!h || h.awake) return null;
    const c = awakenCost(h);
    const cost = { gold: c.gold, essences: { [c.el]: { lo: c.lo, mid: c.mid, hi: c.hi } } };
    if (!spend(S, cost)) return null;
    awaken(h);
    bump(S, 'awakens');
    return { ok: true };
}

export function skillUpWithTome(S, heroId) {
    const h = heroById(S, heroId);
    if (!h || S.res.tomes < 1) return null;
    const rng = rngOf(S);
    const s = skillUp(h, rng);
    if (!s) return null;
    S.res.tomes--;
    bump(S, 'skillUps');
    return { skill: s.n, lvl: s.lvl };
}

/** Fuse a same-class hero: guaranteed skill-up. */
export function skillUpWithHero(S, heroId, fodderId) {
    const h = heroById(S, heroId), f = heroById(S, fodderId);
    if (!h || !f || f.id === h.id || f.cls !== h.cls || !fodderOk(S, f)) return null;
    const rng = rngOf(S);
    const s = skillUp(h, rng);
    if (!s) return null;
    removeHero(S, f.id, false);
    bump(S, 'skillUps');
    return { skill: s.n, lvl: s.lvl };
}

export function removeHero(S, id, withRewards = true) {
    const h = heroById(S, id);
    if (!h) return null;
    for (const gid of Object.values(h.gear)) { const g = gearById(S, gid); if (g) g.owner = 0; }
    S.heroes = S.heroes.filter((x) => x.id !== id);
    for (const k of Object.keys(S.teams)) S.teams[k] = S.teams[k].filter((x) => x !== id);
    S.mine.miners = S.mine.miners.filter((x) => x !== id);
    S.farm.farmers = S.farm.farmers.filter((x) => x !== id);
    S.training.slots = S.training.slots.filter((s) => s.heroId !== id);
    if (!withRewards) return { ok: true };
    const v = releaseValue(h);
    bump(S, 'releases');
    return grant(S, { dust: v.dust, gold: v.gold });
}

export function releaseHeroes(S, ids) {
    const out = { dust: 0, gold: 0, n: 0 };
    for (const id of ids) {
        const h = heroById(S, id);
        if (!h || !fodderOk(S, h)) continue;
        const v = releaseValue(h);
        removeHero(S, id, false);
        out.dust += v.dust; out.gold += v.gold; out.n++;
        bump(S, 'releases');
    }
    if (out.n) grant(S, { dust: out.dust, gold: out.gold });
    return out;
}

export function toggleLock(S, id) {
    const h = heroById(S, id);
    if (h) h.locked = !h.locked;
    return h && h.locked;
}

export function setTeam(S, key, ids) {
    S.teams[key] = [...new Set(ids)].filter((id) => heroById(S, id)).slice(0, 5);
}

// ---------------------------------------------------------------- gear

export function equip(S, heroId, gearId) {
    const h = heroById(S, heroId), g = gearById(S, gearId);
    if (!h || !g) return false;
    if (g.owner && g.owner !== heroId) {
        const prev = heroById(S, g.owner);
        if (prev) delete prev.gear[g.slot];
    }
    const old = h.gear[g.slot];
    if (old) { const og = gearById(S, old); if (og) og.owner = 0; }
    h.gear[g.slot] = g.id;
    g.owner = h.id;
    g.isNew = false;
    bump(S, 'equips');
    return true;
}

export function unequip(S, heroId, slot) {
    const h = heroById(S, heroId);
    if (!h || !h.gear[slot]) return false;
    const g = gearById(S, h.gear[slot]);
    if (g) g.owner = 0;
    delete h.gear[slot];
    return true;
}

/** Fills empty or weaker slots with the best free gear. */
export function autoEquip(S, heroId) {
    const h = heroById(S, heroId);
    if (!h) return 0;
    let n = 0;
    for (const slot of SLOTS) {
        const cur = h.gear[slot] ? gearById(S, h.gear[slot]) : null;
        const free = S.gear.filter((g) => g.slot === slot && !g.owner);
        if (!free.length) continue;
        const best = free.sort((a, b) => gearScore(b) - gearScore(a))[0];
        if (!cur || gearScore(best) > gearScore(cur)) { equip(S, heroId, best.id); n++; }
    }
    return n;
}

export function enhance(S, gearId) {
    const g = gearById(S, gearId);
    if (!g) return null;
    const cost = upgradeCost(g, S.buildings.forge);
    if (g.level >= 15 || !spend(S, { gold: cost })) return null;
    const rng = rngOf(S);
    const r = upgrade(rng, g, 0.01 * (S.buildings.forge - 1));
    bump(S, 'enhances');
    if (r.ok) {
        maxCounter(S, 'gearBest', g.level);
        if (g.level === 15) bump(S, 'gear15');
    }
    return { ...r, cost, level: g.level };
}

export function reforgeGear(S, gearId, idx) {
    const g = gearById(S, gearId);
    if (!g) return null;
    if (!spend(S, reforgeCost(g))) return null;
    const rng = rngOf(S);
    bump(S, 'reforges');
    return reforge(rng, g, idx);
}

export function sellGear(S, ids) {
    let gold = 0, n = 0;
    for (const id of ids) {
        const g = gearById(S, id);
        if (!g || g.locked) continue;
        if (g.owner) unequip(S, g.owner, g.slot);
        gold += sellValue(g);
        n++;
        S.gear = S.gear.filter((x) => x.id !== id);
    }
    if (gold) grant(S, { gold });
    return { gold, n };
}

export function craft(S, tier, jewel, slot) {
    const c = craftCost(tier);
    const cost = { gold: c.gold, ores: { [c.ore]: c.n } };
    if (jewel) cost.jewels = { [jewel]: 1 };
    if (slot) cost.gold = Math.round(cost.gold * 1.5);
    if (!spend(S, cost)) return null;
    const rng = rngOf(S);
    const g = craftGear(rng, tier, jewel, S.buildings.forge, slot);
    addGear(S, g);
    bump(S, 'crafts');
    return g;
}

export function craftAffordable(S, tier, jewel, slot) {
    const c = craftCost(tier);
    const cost = { gold: slot ? Math.round(c.gold * 1.5) : c.gold, ores: { [c.ore]: c.n } };
    if (jewel) cost.jewels = { [jewel]: 1 };
    return canAfford(S, cost);
}

export { MAX_LEVEL, isTraining };

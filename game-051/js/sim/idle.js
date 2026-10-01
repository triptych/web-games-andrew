/**
 * idle.js — everything that runs on the clock: stamina, the Treasury,
 * Training Grounds, arena tickets, timed buffs, building upgrades, and the
 * "while you were away" summary.
 */

import { now, MIN, HOUR } from '../core/time.js';
import { BUILDINGS, BUILDING_ORE } from '../data/world.js';
import { MAX_LEVEL } from '../data/core.js';
import { generateGear } from './gear.js';
import { addXp } from './heroes.js';
import { maxStamina } from './overlord.js';
import { grant, bump, rngOf, heroById, spend, canAfford } from './state.js';
import { stageInfo } from './content.js';

export const STAMINA_MINS = 2;
export const ARENA_TICKET_MINS = 60;
export const ARENA_TICKET_MAX = 10;

// ---------------------------------------------------------------- stamina & tickets

export function tickStamina(S, t = now()) {
    const R = S.res, cap = maxStamina(S);
    if (R.stamina >= cap) { R.staminaAt = t; return; }
    const n = Math.floor((t - R.staminaAt) / (STAMINA_MINS * MIN));
    if (n > 0) {
        R.stamina = Math.min(cap, R.stamina + n);
        R.staminaAt += n * STAMINA_MINS * MIN;
        if (R.stamina >= cap) R.staminaAt = t;
    }
}

export function staminaNext(S, t = now()) {
    if (S.res.stamina >= maxStamina(S)) return 0;
    return S.res.staminaAt + STAMINA_MINS * MIN - t;
}

export function tickTickets(S, t = now()) {
    const A = S.arena;
    if (A.tickets >= ARENA_TICKET_MAX) { A.ticketAt = t; return; }
    const n = Math.floor((t - A.ticketAt) / (ARENA_TICKET_MINS * MIN));
    if (n > 0) {
        A.tickets = Math.min(ARENA_TICKET_MAX, A.tickets + n);
        A.ticketAt += n * ARENA_TICKET_MINS * MIN;
        if (A.tickets >= ARENA_TICKET_MAX) A.ticketAt = t;
    }
}

// ---------------------------------------------------------------- treasury

export function treasuryCapHours(S) { return 12 + (S.buildings.treasury - 1) * 1.34; }
export function treasuryRate(S) {
    // per minute, based on the furthest campaign stage reached
    const idx = Math.max(0, S.campaign.cleared - 1);
    const info = stageInfo(Math.min(63, idx));
    const m = 1 + 0.12 * (S.buildings.treasury - 1);
    return {
        gold: (info.gold * 0.18 + 6) * m,
        xp: (info.heroXp * 0.12 + 3) * m,     // hero XP (pooled → elixirs)
        olXp: (info.olXp * 0.05 + 0.5) * m,
        gearPerHour: 0.6 + S.campaign.cleared * 0.01,
        tier: info.gearTier,
    };
}

export function treasuryElapsed(S, t = now()) {
    return Math.min(treasuryCapHours(S) * HOUR, Math.max(0, t - S.treasury.since));
}

/** A preview without randomness (gear/shards are rolled on collect). */
export function treasuryPending(S, t = now()) {
    const mins = treasuryElapsed(S, t) / MIN;
    const r = treasuryRate(S);
    const goldBuff = S.buffs.gold && S.buffs.gold > t ? 1.25 : 1;
    return {
        mins,
        gold: Math.floor(r.gold * mins * goldBuff),
        heroXp: Math.floor(r.xp * mins),
        olXp: Math.floor(r.olXp * mins),
        full: mins >= treasuryCapHours(S) * 60 - 0.5,
    };
}

export function collectTreasury(S, t = now()) {
    const p = treasuryPending(S, t);
    if (p.mins < 1) return null;
    const rng = rngOf(S);
    const r = treasuryRate(S);
    const hours = p.mins / 60;
    const b = { gold: p.gold, xp: p.olXp, items: {} };
    // hero XP arrives as elixirs so the player chooses who gets it
    let xp = p.heroXp;
    const L = Math.floor(xp / 15000); xp -= L * 15000;
    const M = Math.floor(xp / 3000); xp -= M * 3000;
    const Sm = Math.ceil(xp / 600);
    b.items = { xpL: L, xpM: M, xpS: Sm };
    const gearN = Math.floor(hours * r.gearPerHour + rng.next());
    if (gearN > 0) b.gear = Array.from({ length: Math.min(8, gearN) }, () => generateGear(rng, { tier: r.tier }));
    const shards = Math.floor(hours * 1.2 + rng.next());
    if (shards) b.shards = shards;
    if (hours >= 2 && rng.chance(Math.min(0.9, hours * 0.06))) b.gems = rng.int(5, 20);
    if (hours >= 4 && rng.chance(0.25)) b.items.chest = 1;
    S.treasury.since = t;
    bump(S, 'treasury');
    return grant(S, b);
}

// ---------------------------------------------------------------- training grounds

export function trainingSlots(S) { return 1 + Math.floor(S.buildings.training / 2); }
export function trainingRate(S) {
    // XP per minute per trainee
    return 8 * S.buildings.training * (1 + S.campaign.cleared * 0.05);
}

export function trainingPending(S, slot, t = now()) {
    const mins = Math.min(24 * 60, (t - slot.since) / MIN);
    return Math.floor(mins * trainingRate(S));
}

/** Applies accumulated training XP to every trainee (called often). Returns level-ups. */
export function tickTraining(S, t = now()) {
    const ups = [];
    for (const slot of S.training.slots) {
        const h = heroById(S, slot.heroId);
        if (!h) continue;
        const xp = trainingPending(S, slot, t);
        if (xp < 1) continue;
        const lv = addXp(h, xp);
        slot.since = t;
        if (lv) { ups.push({ id: h.id, levels: lv }); bump(S, 'levelUps', lv); }
    }
    S.training.slots = S.training.slots.filter((s) => heroById(S, s.heroId));
    return ups;
}

export function setTrainee(S, idx, heroId, t = now()) {
    if (idx >= trainingSlots(S)) return false;
    tickTraining(S, t);
    S.training.slots = S.training.slots.filter((s) => s.heroId !== heroId);
    S.training.slots[idx] = heroId ? { heroId, since: t } : undefined;
    S.training.slots = S.training.slots.filter(Boolean);
    return true;
}

export function isTraining(S, heroId) { return S.training.slots.some((s) => s.heroId === heroId); }

// ---------------------------------------------------------------- buffs

export function activeBuffs(S, t = now()) {
    return Object.entries(S.buffs).filter(([, until]) => until > t).map(([id, until]) => ({ id, until }));
}

export function addBuff(S, id, mins, t = now()) {
    S.buffs[id] = Math.max(S.buffs[id] || 0, t) + mins * MIN;
}

// ---------------------------------------------------------------- buildings

export function buildingCost(S, id) {
    const lvl = S.buildings[id];
    if (lvl >= BUILDINGS[id].max) return null;
    const ore = BUILDING_ORE[lvl - 1];
    return { gold: Math.round(2500 * Math.pow(2.05, lvl - 1)), ores: { [ore]: 10 + lvl * 6 } };
}

export function upgradeBuilding(S, id) {
    const c = buildingCost(S, id);
    if (!c || !spend(S, c)) return false;
    if (id === 'treasury' || id === 'training') { /* settle before rates change */ }
    S.buildings[id]++;
    bump(S, 'buildingUps');
    return true;
}

export function canUpgradeBuilding(S, id) {
    const c = buildingCost(S, id);
    return !!c && canAfford(S, c);
}

// ---------------------------------------------------------------- away summary

export function awaySummary(S, since, t = now()) {
    const away = t - since;
    if (away < 3 * MIN) return null;
    const out = { away };
    out.treasury = treasuryPending(S, t);
    out.cropsReady = S.farm.plots.filter((p) => p && p.crop && t >= p.readyAt).length;
    out.expeditionsDone = S.expeditions.active.filter((e) => t >= e.endsAt).length;
    out.trainees = S.training.slots.length;
    return out;
}

export function heroBusy(S, id) {
    if (isTraining(S, id)) return 'Training';
    if (S.mine.miners.includes(id)) return 'Mining';
    if (S.farm.farmers.includes(id)) return 'Farming';
    if (S.expeditions.active.some((e) => e.heroes.includes(id))) return 'Exploring';
    return null;
}

export function levelProgress(h) { return h.level / MAX_LEVEL[h.star]; }

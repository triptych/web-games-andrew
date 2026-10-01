/**
 * expeditions.js — the Tavern's expedition board: procedurally named places,
 * timed parties, success rolls, great successes and stories.
 */

import { now, MIN, dayKey } from '../core/time.js';
import { ELEMENTS, ELEMENT } from '../data/core.js';
import { CLASS_IDS, CLASSES } from '../data/classes.js';
import { EXPEDITION } from '../data/world.js';
import { JEWEL_IDS, CROP_IDS } from '../data/items.js';
import { generateGear } from './gear.js';
import { addXp } from './heroes.js';
import { heroPower } from './stats.js';
import { grant, bump, rngOf, heroById, gearLookup } from './state.js';

export function expeditionSlots(S) { return Math.min(5, 2 + Math.floor(S.buildings.tavern / 3)); }
export function boardSize(S) { return Math.min(7, 4 + Math.floor(S.buildings.tavern / 4)); }

function recPower(S, mins) {
    // scales with campaign progress so the board stays relevant
    const base = 1800 + S.campaign.cleared * 650;
    return Math.round(base * (0.7 + Math.log2(mins / 15 + 1) * 0.35));
}

function makeExpedition(S, rng) {
    const mins = rng.pick(EXPEDITION.durations);
    const id = ++S.expeditions.seq;
    const rare = rng.chance(0.12);
    return {
        id, name: `The ${rng.pick(EXPEDITION.adj)} ${rng.pick(EXPEDITION.noun)}`, mins,
        rec: recPower(S, mins) * (rare ? 1.4 : 1),
        els: rng.sample(ELEMENTS, rng.int(1, 2)),
        cls: rng.pick(CLASS_IDS),
        rare,
        loot: rng.sample(['gold', 'ore', 'jewel', 'essence', 'gear', 'seeds', 'shards', 'elixir'], 3),
    };
}

export function refreshBoard(S, force = false) {
    const day = dayKey();
    const E = S.expeditions;
    if (!force && E.boardDay === day && E.board.length) {
        // top up after sending
        const rng = rngOf(S);
        while (E.board.length < boardSize(S)) E.board.push(makeExpedition(S, rng));
        return E.board;
    }
    const rng = rngOf(S);
    E.board = Array.from({ length: boardSize(S) }, () => makeExpedition(S, rng));
    E.boardDay = day;
    return E.board;
}

export function successChance(S, exp, heroIds) {
    const gl = gearLookup(S);
    const heroes = heroIds.map((id) => heroById(S, id)).filter(Boolean);
    if (!heroes.length) return 0;
    const p = heroes.reduce((s, h) => s + heroPower(h, { gearOf: gl, talents: S.overlord.talents }), 0);
    let c = 0.25 + 0.6 * Math.min(1.4, p / exp.rec);
    for (const h of heroes) {
        if (exp.els.includes(h.el)) c += 0.06;
        if (h.cls === exp.cls) c += 0.08;
        if (h.traits.includes('explorer')) c += 0.15;
    }
    return Math.max(0.05, Math.min(0.98, c));
}

export function sendExpedition(S, expId, heroIds, t = now()) {
    const E = S.expeditions;
    if (E.active.length >= expeditionSlots(S)) return false;
    const i = E.board.findIndex((e) => e.id === expId);
    if (i < 0 || !heroIds.length || heroIds.length > 4) return false;
    if (heroIds.some((id) => E.active.some((a) => a.heroes.includes(id)))) return false;
    const exp = E.board.splice(i, 1)[0];
    E.active.push({ ...exp, heroes: heroIds.slice(), chance: successChance(S, exp, heroIds), startedAt: t, endsAt: t + exp.mins * MIN });
    bump(S, 'expeditions');
    return true;
}

function lootFor(S, exp, rng, mult) {
    const scale = (exp.mins / 15) * (1 + S.campaign.cleared * 0.06) * mult * (exp.rare ? 1.6 : 1);
    const b = {};
    for (const kind of exp.loot) {
        switch (kind) {
            case 'gold': b.gold = Math.round(180 * scale * rng.range(0.8, 1.2)); break;
            case 'ore': {
                const tiers = ['copper', 'iron', 'silver', 'gold', 'mithril', 'adamant', 'starmetal'];
                const top = Math.min(6, Math.floor(S.campaign.cleared / 10));
                b.ores = { [tiers[rng.int(Math.max(0, top - 2), top)]]: Math.max(1, Math.round(4 * Math.sqrt(scale))) };
                break;
            }
            case 'jewel': b.jewels = { [rng.weighted(JEWEL_IDS.map((j) => [j, j === 'diamond' ? 0.2 : 1]))]: Math.max(1, Math.round(Math.sqrt(scale) * 0.6)) }; break;
            case 'essence': b.essences = { [rng.pick(exp.els)]: { lo: Math.max(1, Math.round(Math.sqrt(scale) * 1.5)), mid: exp.mins >= 120 ? rng.int(1, 2) : 0, hi: exp.mins >= 480 && rng.chance(0.4) ? 1 : 0 } }; break;
            case 'gear': b.gear = [generateGear(rng, { tier: Math.min(6, 1 + Math.floor(S.campaign.cleared / 9)), rarityBias: exp.mins >= 240 ? 2 : exp.rare ? 1 : 0 })]; break;
            case 'seeds': b.seeds = { [rng.pick(CROP_IDS)]: Math.max(1, Math.round(Math.sqrt(scale))) }; break;
            case 'shards': b.shards = Math.max(1, Math.round(Math.sqrt(scale) * 2)); break;
            case 'elixir': b.items = { [exp.mins >= 240 ? 'xpL' : exp.mins >= 60 ? 'xpM' : 'xpS']: 1 }; break;
            default: break;
        }
    }
    if (exp.mins >= 240 && rng.chance(0.15)) b.sigils = { mystic: 1 };
    else if (rng.chance(0.1)) b.sigils = { common: 1 };
    return b;
}

/** Resolves a finished expedition. Returns { ok, great, story, items, xp }. */
export function claimExpedition(S, id, t = now()) {
    const E = S.expeditions;
    const i = E.active.findIndex((e) => e.id === id);
    if (i < 0 || t < E.active[i].endsAt) return null;
    const exp = E.active.splice(i, 1)[0];
    const rng = rngOf(S);
    const ok = rng.chance(exp.chance);
    const great = ok && rng.chance(0.08 + Math.max(0, exp.chance - 0.8));
    const names = exp.heroes.map((h) => heroById(S, h)?.name).filter(Boolean);
    const who = names.length > 1 ? names.slice(0, -1).join(', ') + ' and ' + names[names.length - 1] : names[0] || 'Your party';
    const story = ok ? `${who} ${rng.pick(EXPEDITION.events)}` : `${who} ${rng.pick(EXPEDITION.fail)}`;
    const b = lootFor(S, exp, rng, ok ? (great ? 2 : 1) : 0.3);
    if (!ok) { delete b.gear; delete b.sigils; delete b.jewels; }
    const items = grant(S, b);
    const xp = Math.round(exp.mins * 25 * (1 + S.campaign.cleared * 0.08) * (ok ? 1 : 0.4));
    for (const hid of exp.heroes) { const h = heroById(S, hid); if (h) { const lv = addXp(h, xp); if (lv) bump(S, 'levelUps', lv); } }
    if (ok) bump(S, 'expeditionWins');
    return { ok, great, story, items, xp, name: exp.name };
}

export function rerollCost() { return 30; }

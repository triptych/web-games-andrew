// EMBERSPIRE — the numbers: level curves, gear power, hero and enemy stat blocks. Pure.

import { TIER_MULT } from '../config.js';
import { CLASSES, HERO } from './data/heroes.js';
import { GEAR, RARITY, AFFIXES, UNIQUES, materialName } from './data/items.js';
import { MONSTERS, biomeOf } from './data/biomes.js';
import { BLESSINGS } from './data/story.js';

export const STATS = ['hp', 'mp', 'atk', 'mag', 'def', 'res', 'spd'];

/** Growth for a level or an item level: linear with a gentle compound, so numbers climb forever. */
export const lvMult = (l) => (1 + 0.1 * (l - 1)) * Math.pow(1.022, l - 1);
export const gearMult = (l) => (1 + 0.1 * (l - 1)) * Math.pow(1.022, l - 1);
export const enemyMult = (f) => (1 + 0.1 * (f - 1)) * Math.pow(1.045, f - 1);
export const goldScale = (f) => (1 + 0.12 * (f - 1)) * Math.pow(1.03, f - 1);
export const xpScale = (f) => (1 + 0.1 * (f - 1)) * Math.pow(1.034, f - 1);
/** Experience to go from level l to l + 1. */
export const xpNext = (l) => Math.round(30 * Math.pow(l, 1.45) * Math.pow(1.034, l - 1));

// ---------------------------------------------------------------- gear
/** Stat lines of one gear item (before the hero's multipliers). */
export function gearStats(it) {
    const type = GEAR[it.type];
    const rar = RARITY[it.rar] || RARITY[0];
    const p = 4 * gearMult(it.lvl) * rar.mult * (1 + 0.1 * it.plus);
    const s = {};
    for (const [k, w] of Object.entries(type.w)) {
        if (k === 'spd') s.spd = Math.round(w * 60 * (1 + 0.05 * it.plus));
        else if (k === 'crit') s.crit = w + Math.floor(it.plus / 3);
        else if (k === 'hp') s.hp = Math.round(p * w * 5);
        else if (k === 'mp') s.mp = Math.round(p * w * 1.2);
        else s[k] = Math.round(p * w);
    }
    const pct = {};
    for (const a of it.aff || []) {
        const af = AFFIXES.find((x) => x.id === a);
        if (af) pct[af.stat] = (pct[af.stat] || 0) + af.pct;
    }
    return { flat: s, pct };
}

export function gearName(it) {
    if (it.u) return UNIQUES[it.u].name;
    const type = GEAR[it.type];
    const aff = (it.aff || []).length ? ' ' + AFFIXES.find((x) => x.id === it.aff[0]).name : '';
    return `${materialName(it.lvl)} ${type.name}${aff}`;
}

// ---------------------------------------------------------------- heroes
export function classOf(h) { return CLASSES[h.cls]; }
export function bondRank(h) { return h.bondLv || 0; }

/** Every effect a hero's unique gear grants, merged. */
export function uniqueFx(G, h) {
    const fx = { allPct: 0, statPct: {}, crit: 0, critMul: 0, leech: 0, regen: 0, mpRegen: 0, healBoost: 0, goldPct: 0, dropPct: 0, elBoost: {}, resist: [], startSt: [], attackEl: null, onHit: null, hits: 1, autoRevive: 0 };
    for (const slot of ['weapon', 'armor', 'acc']) {
        const it = G.gear[h.eq[slot]];
        if (!it || !it.u) continue;
        const u = UNIQUES[it.u].fx;
        for (const [k, v] of Object.entries(u)) {
            if (k === 'statPct') for (const [s, p] of Object.entries(v)) fx.statPct[s] = (fx.statPct[s] || 0) + p;
            else if (k === 'elBoost') for (const [e, p] of Object.entries(v)) fx.elBoost[e] = (fx.elBoost[e] || 0) + p;
            else if (k === 'resist') fx.resist.push(...v);
            else if (k === 'startSt') fx.startSt.push(v);
            else if (k === 'attackEl' || k === 'onHit') fx[k] = v;
            else if (k === 'hits') fx.hits = Math.max(fx.hits, v);
            else fx[k] += v;
        }
    }
    return fx;
}

export function blessing(G) { return BLESSINGS.find((b) => b.id === G.blessing) || null; }

/** A hero's full stat block: class growth x level x tier, plus gear, times bond, uniques and the day's blessing. */
export function heroStats(G, id) {
    const h = G.heroes[id];
    const c = CLASSES[h.cls];
    const lm = lvMult(h.lv) * TIER_MULT[h.tier];
    const [ghp, gmp, gatk, gmag, gdef, gres, gspd] = c.g;
    const s = {
        hp: ghp * lm, mp: gmp * (1 + 0.06 * (h.lv - 1)) * TIER_MULT[h.tier], atk: gatk * lm, mag: gmag * lm,
        def: gdef * lm, res: gres * lm, spd: gspd * (1 + 0.012 * (h.lv - 1)) * TIER_MULT[h.tier], crit: 0,
    };
    const pct = {};
    for (const slot of ['weapon', 'armor', 'acc']) {
        const it = G.gear[h.eq[slot]];
        if (!it) continue;
        const gs = gearStats(it);
        for (const [k, v] of Object.entries(gs.flat)) s[k] = (s[k] || 0) + v;
        for (const [k, v] of Object.entries(gs.pct)) pct[k] = (pct[k] || 0) + v;
    }
    const fx = uniqueFx(G, h);
    const bond = HERO[id].hero ? 0 : bondRank(h) * 3;
    const bl = blessing(G);
    for (const k of STATS) {
        let m = 1 + (bond + fx.allPct + (pct[k] || 0) + (fx.statPct[k] || 0)) / 100;
        if (bl && k === 'atk' && bl.atkPct) m += bl.atkPct / 100;
        if (bl && k === 'mag' && bl.atkPct) m += bl.atkPct / 100;
        if (bl && (k === 'def' || k === 'res') && bl.defPct) m += bl.defPct / 100;
        s[k] = Math.max(1, Math.round(s[k] * m));
    }
    s.crit = Math.round(s.crit + fx.crit + (pct.crit || 0) + (c.weapon === 'daggers' || h.cls === 'rogue' || CLASSES[h.cls].from === 'rogue' ? 4 : 0));
    return s;
}

/** A rough single number for a hero's strength (bot decisions, the party screen). */
export function power(G, id) {
    const s = heroStats(G, id);
    return Math.round(s.hp / 5 + s.atk + s.mag + s.def * 0.7 + s.res * 0.7 + s.spd * 2);
}

// ---------------------------------------------------------------- enemies
/** An enemy's stat block on a floor. elite: tougher and richer. */
export function enemyStats(mid, floor, elite = false) {
    const m = MONSTERS[mid];
    const { cycle } = biomeOf(floor);
    const k = enemyMult(floor) * (1 + 0.25 * cycle);
    const [hp, atk, mag, def, res, spd] = m.m;
    const e = elite ? 1 : 0;
    return {
        hp: Math.round(36 * k * hp * (1 + 0.6 * e)),
        atk: Math.round(12 * k * atk * (1 + 0.2 * e)),
        mag: Math.round(12 * k * mag * (1 + 0.2 * e)),
        def: Math.round(6 * k * def),
        res: Math.round(6 * k * res),
        spd: Math.round(9.5 * spd * (1 + 0.009 * (floor - 1)) * (1 + 0.1 * e)),
        crit: 4,
    };
}

export function rankOfFloor(floor) {
    if (floor % 10 === 0) return 'boss';
    if (floor % 5 === 0) return 'mini';
    return 'normal';
}

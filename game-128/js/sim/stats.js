// Gemheart Saga — hero stats and modifiers, gathered from the hero, the skill tree, the gear and the village. Pure.

import { HERO, NODE } from './data/heroes.js';
import { ITEM } from './data/items.js';
import { REGION, FOE } from './data/world.js';
import { HERO_GROW, FOE as FOE_CFG, UPGRADE_STEP, MANA } from '../config.js';

// Every modifier key. All are fractions except startMana, overflow, flow, purify (counts).
export const MOD_KEYS = ['sword', 'heart', 'skill', 'crit', 'critDmg', 'defPct', 'execute', 'chain', 'startMana', 'gain',
    'gain_r', 'gain_s', 'gain_e', 'gain_a', 'slow', 'frozen', 'overflow', 'flow', 'purify', 'lowHeal', 'loot', 'xp', 'maxHp', 'revive'];

export function zeroMods() {
    const m = {};
    for (const k of MOD_KEYS) m[k] = 0;
    return m;
}

/** An equipment piece's stats with its upgrades. */
export function itemStats(inv) {
    const it = ITEM[inv.id];
    const f = 1 + UPGRADE_STEP * (inv.plus || 0);
    return { atk: Math.round((it.atk || 0) * f), def: Math.round((it.def || 0) * f), hp: Math.round((it.hp || 0) * f), mods: it.mods || {} };
}

export const lvOf = (G, id) => G.village.lv[id] || 0;

/** All modifiers in force right now. */
export function mods(G) {
    const m = zeroMods();
    const h = HERO[G.hero.id];
    for (const [k, v] of Object.entries(h.aff)) m[k] += v;
    for (const [id, r] of Object.entries(G.hero.ranks)) {
        const n = NODE[id];
        if (n && n.type === 'passive' && r > 0) m[n.mod] += n.per * r;
    }
    for (const slot of ['weapon', 'armor', 'charm']) {
        const inv = equipped(G, slot);
        if (!inv) continue;
        for (const [k, v] of Object.entries(itemStats(inv).mods)) m[k] += v;
    }
    m.heart += 0.1 * lvOf(G, 'temple');
    m.skill += 0.06 * lvOf(G, 'tower');
    m.xp += 0.05 * lvOf(G, 'inn');
    m.maxHp += 0.05 * lvOf(G, 'farm');
    if (lvOf(G, 'temple') >= 3) m.startMana += 5;
    if (lvOf(G, 'temple') >= 5) m.revive = 1;
    return m;
}

export function equipped(G, slot) {
    const uid = G.hero.eq[slot];
    return uid ? G.inv.find((i) => i.uid === uid) || null : null;
}

/** The hero's battle stats. */
export function heroStats(G) {
    const h = HERO[G.hero.id];
    const lv = G.hero.lv;
    const m = mods(G);
    let hp = h.base.hp * (1 + HERO_GROW.hp * (lv - 1));
    let atk = h.base.atk * (1 + HERO_GROW.atk * (lv - 1)) + 2 * lvOf(G, 'armory');
    let def = h.base.def;
    for (const slot of ['weapon', 'armor', 'charm']) {
        const inv = equipped(G, slot);
        if (!inv) continue;
        const s = itemStats(inv);
        hp += s.hp; atk += s.atk; def += s.def;
    }
    hp *= 1 + m.maxHp;
    return { hp: Math.round(hp), atk: Math.round(atk), def: Math.round(def), mods: m };
}

/** Mana gain multiplier for a pool. */
export const gainOf = (m, pool) => 1 + m.gain + (m['gain_' + pool] || 0);

/** A foe at a level. */
export function foeStats(id, lv) {
    const f = FOE[id];
    return {
        id, name: f.name, lv, rank: f.rank || 'normal', weak: f.weak, abil: f.abil || [], region: f.region,
        max: Math.round(FOE_CFG.hp * (1 + FOE_CFG.hpGrow * (lv - 1)) * f.m[0] * (FOE_CFG.rankHp[f.rank || 'normal'] || 1)),
        atk: Math.round(FOE_CFG.atk * (1 + FOE_CFG.atkGrow * (lv - 1)) * f.m[1]),
        every: f.every * FOE_CFG.every * ((f.abil || []).includes('haste') ? 0.8 : 1),
    };
}

/** Skill numbers at a rank (for the tree, the tooltips and the battle). */
export function skillAt(node, rank) {
    const e = node.eff || {};
    const r = Math.max(1, rank) - 1;
    return {
        mult: (e.mult || 0) + (e.kind === 'dmg' || e.kind === 'summon' ? (e.per || 0) * r : 0),
        pct: (e.pct || 0) + (e.kind === 'shield' || e.kind === 'heal' ? (e.per || 0) * r : 0),
        n: (e.n || 0) + (e.kind === 'convert' ? (e.per || 0) * r : 0),
        cols: (e.cols || 0) + (e.kind === 'blast' ? (e.per || 0) * r : 0),
        secs: (e.secs || 0) + (e.kind === 'freeze' ? (e.per || 0) * r : 0),
    };
}

/** Human description of a node at a rank. */
export function describe(node, rank) {
    const s = skillAt(node, rank);
    const r = Math.max(1, rank);
    const v = node.type === 'passive' ? node.per * r : 0;
    return node.desc
        .replace('{m}', (Math.round(s.mult * 10) / 10).toString())
        .replace('{p}', node.type === 'passive' ? Math.round(v * 100) : Math.round(s.pct * 100))
        .replace('{v}', String(Math.round(v * 10) / 10))
        .replace('{n}', node.eff?.kind === 'blast' ? s.cols : s.n)
        .replace('{s}', s.secs);
}

export const costText = (cost) => MANA.filter((p) => cost[p]).map((p) => `${cost[p]} ${p.toUpperCase()}`).join(' + ');
export const regionName = (id) => REGION[id]?.name || id;

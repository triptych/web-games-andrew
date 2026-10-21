// Party members: stats from level and gear, skills by level, equipping. Pure.
//
// A member is plain data: { id: 'hero' | companion id, hp, mp, gear: { weapon, armor, charm } }
// where gear holds gear ids. Unequipped gear sits in G.bag.gear as counts.

import { CLASSES, COMPANIONS, GEAR, SKILLS } from './data.js';
import { regionDeeds } from './board.js';

export function memberDef(G, m) {
    return m.id === 'hero' ? CLASSES[G.cls] : COMPANIONS[m.id];
}

export function memberName(G, m) {
    return m.id === 'hero' ? G.heroName : COMPANIONS[m.id].short;
}

/** True when the player owns both deeds of a region. */
export function ownsSet(G, region) {
    const ds = regionDeeds(region);
    return ds.length > 0 && ds.every((s) => G.deeds[s.deed]?.owner === 'you');
}

/** Full derived stats at the party's level with gear. */
export function stats(G, m) {
    const d = memberDef(G, m);
    const L = G.level - 1;
    const s = {};
    for (const k of Object.keys(d.base)) s[k] = d.base[k] + d.grow[k] * L;
    const pct = { hp: 0, mp: 0 };
    let crit = 0.05, regen = 0, valor = 0, fireGuard = 0, element = null, bane = 1, amp = {}, onHit = null;
    const resist = [];
    for (const slot of ['weapon', 'armor', 'charm']) {
        const g = GEAR[m.gear?.[slot]];
        if (!g) continue;
        for (const [k, v] of Object.entries(g.bonus || {})) s[k] = (s[k] || 0) + v;
        if (g.pct) for (const [k, v] of Object.entries(g.pct)) pct[k] += v;
        if (g.crit) crit += g.crit;
        if (g.regen) regen += g.regen;
        if (g.valor) valor += g.valor;
        if (g.fireGuard) fireGuard += g.fireGuard;
        if (g.element) element = g.element;
        if (g.bane) bane = g.bane;
        if (g.amp) for (const [k, v] of Object.entries(g.amp)) amp[k] = (amp[k] || 1) * v;
        if (g.onHit) onHit = g.onHit;
        if (g.resist) resist.push(...g.resist);
    }
    if (ownsSet(G, 'woods')) pct.hp += 0.1;
    s.hp = Math.round(s.hp * (1 + pct.hp));
    s.mp = Math.round(s.mp * (1 + pct.mp));
    for (const k of ['atk', 'def', 'mag', 'res', 'spd']) s[k] = Math.max(1, Math.round(s[k]));
    return { ...s, maxhp: s.hp, maxmp: s.mp, crit, regen, valor, fireGuard, element, bane, amp, onHit, resist };
}

export function skillsOf(G, m) {
    return memberDef(G, m).skills.filter((id) => SKILLS[id].lv <= G.level);
}

export function canEquip(G, m, gearId) {
    const g = GEAR[gearId];
    if (!g) return false;
    if (g.slot !== 'weapon') return true;
    return g.kind === 'any' || memberDef(G, m).weapons.includes(g.kind);
}

/** Keep hp/mp inside the (possibly new) maxima. */
export function clampMember(G, m) {
    const s = stats(G, m);
    m.hp = Math.max(0, Math.min(s.maxhp, m.hp));
    m.mp = Math.max(0, Math.min(s.maxmp, m.mp));
}

export function newMember(G, id) {
    const d = id === 'hero' ? CLASSES[G.cls] : COMPANIONS[id];
    const m = { id, hp: 1, mp: 1, gear: { weapon: d.start.weapon, armor: d.start.armor, charm: null } };
    const s = stats(G, m);
    m.hp = s.maxhp;
    m.mp = s.maxmp;
    return m;
}

/** A score for a piece of gear on a member, used by the bot and the shop's "better" arrows. */
export function gearScore(G, m, gearId) {
    const g = GEAR[gearId];
    if (!g) return 0;
    const d = memberDef(G, m);
    const magic = d.base.mag > d.base.atk;
    const b = g.bonus || {};
    let v = (b.atk || 0) * (magic ? 0.35 : 1) + (b.mag || 0) * (magic ? 1 : 0.2) + (b.def || 0) * 0.9 + (b.res || 0) * 0.7 + (b.hp || 0) * 0.25 + (b.spd || 0) * 1.5;
    if (g.pct?.hp) v += g.pct.hp * 60;
    if (g.pct?.mp) v += g.pct.mp * (magic ? 40 : 10);
    if (g.crit) v += g.crit * 60;
    if (g.regen) v += g.regen * 300;
    if (g.valor) v += 12;
    if (g.fireGuard) v += 14 + G.level;
    if (g.element) v += 4;
    if (g.bane) v += 30;
    if (g.amp) v += 6;
    if (g.onHit) v += 4;
    if (g.resist) v += 4;
    return v;
}

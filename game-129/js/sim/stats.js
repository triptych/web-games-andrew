// HOLLOWDEEP — derived numbers: a hero's stats from class, level and gear; a monster's from its floor. Pure.

import { CLASSES, SKILLS } from './data/classes.js';
import { MONSTERS, stratumOf, echoName, FLOORS_PER_STRATUM, STRATA } from './data/monsters.js';
import { gearStats } from './data/items.js';
import { XP_NEXT, monsterScale, MON_POWER } from '../config.js';

const STATS = ['hp', 'mp', 'atk', 'def', 'mag', 'res', 'spd', 'luk'];

/** A hero's full stats: class base + growth × (level − 1) + every piece of gear. */
export function heroStats(c) {
    const cl = CLASSES[c.cls];
    const s = {};
    for (const k of STATS) s[k] = Math.floor(cl.base[k] + cl.grow[k] * (c.lv - 1));
    s.crit = 0.04 + s.luk * 0.003;
    s.ranged = false;
    for (const slot of ['weapon', 'armor', 'shield', 'acc']) {
        const e = c.eq[slot];
        if (!e) continue;
        const g = gearStats(e);
        for (const k of STATS) if (g[k]) s[k] += g[k];
        if (g.crit) s.crit += g.crit;
        if (g.ranged) s.ranged = true;
    }
    s.spd = Math.max(1, s.spd);
    s.hp = Math.max(1, s.hp);
    s.mp = Math.max(0, s.mp);
    return s;
}

export const xpNext = (lv) => XP_NEXT(lv);

/** Skills a hero knows at their level. */
export const knownSkills = (c) => CLASSES[c.cls].skills.filter((s) => s.lv <= c.lv).map((s) => SKILLS[s.id]);

/** Can this hero use this piece of gear? */
export function canEquip(c, def) {
    if (!def || def.type !== 'gear') return false;
    if (def.slot === 'acc') return true;
    return CLASSES[c.cls].gear.includes(def.kind);
}

/** A monster of id `mid` met on `floor`: its scaled stats and its (echo) name. */
export function monsterAt(mid, floor) {
    const m = MONSTERS[mid];
    const { cycle } = stratumOf(floor);
    // its own stratum's first floor in the current pass round the strata
    const si = STRATA.findIndex((s) => s.id === m.stratum);
    const first = si >= 0 ? (cycle * STRATA.length + si) * FLOORS_PER_STRATUM + 1 : floor;
    const k = monsterScale(floor, Math.min(first, floor), cycle);
    const ka = Math.sqrt(k) * (1 + 0.45 * (k - 1) / k);       // attack grows slower than health
    return {
        mid, name: echoName(m.name, cycle), boss: !!m.boss, elite: !!m.elite, undead: !!m.undead, fly: !!m.fly,
        hp: Math.round(m.hp * k), atk: Math.round(m.atk * ka * MON_POWER), def: Math.round(m.def * ka),
        mag: Math.round(m.mag * ka * MON_POWER), res: Math.round(m.res * ka), spd: Math.round(m.spd * (1 + 0.15 * cycle) + Math.max(0, floor - first) * 0.15),
        luk: 5, el: m.el, weak: m.weak.slice(), resist: m.resist.slice(), acts: m.acts.slice(),
        xp: Math.round(m.xp * k * (1 + 0.1 * Math.max(0, floor - first))), gold: Math.round(m.gold * k), cycle,
    };
}

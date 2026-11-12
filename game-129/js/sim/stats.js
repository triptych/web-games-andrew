// HOLLOWDEEP — derived numbers: a hero's stats from class, level and gear; a monster's from its floor. Pure.

import { CLASSES, SKILLS } from './data/classes.js';
import { MONSTERS, stratumOf, echoName } from './data/monsters.js';
import { gearStats } from './data/items.js';
import { XP_NEXT, monsterScale, MON_POWER, MON_HP } from '../config.js';

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
    const k = monsterScale(floor, cycle);
    return {
        mid, name: echoName(m.name, cycle), boss: !!m.boss, elite: !!m.elite, undead: !!m.undead, fly: !!m.fly,
        hp: Math.round(m.hp * k * (m.boss ? MON_HP * 0.5 : MON_HP)), atk: Math.round(m.atk * Math.pow(k, 0.9) * MON_POWER), def: Math.round(m.def * Math.pow(k, 0.8)),
        mag: Math.round(m.mag * Math.pow(k, 0.9) * MON_POWER), res: Math.round(m.res * Math.pow(k, 0.8)), spd: Math.round(m.spd * (1 + 0.012 * (floor - 1))),
        luk: 5, el: m.el, weak: m.weak.slice(), resist: m.resist.slice(), acts: m.acts.slice(),
        xp: Math.round(m.xp * Math.pow(k, 1.1)), gold: Math.round(m.gold * Math.pow(k, 0.6)), cycle,
    };
}

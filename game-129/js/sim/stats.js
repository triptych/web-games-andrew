// HOLLOWDEEP — derived numbers: a hero's stats from class, level and gear; a monster's from its floor. Pure.

import { CLASSES, SKILLS } from './data/classes.js';
import { MONSTERS, stratumOf, echoName } from './data/monsters.js';
import { gearStats, itemDef } from './data/items.js';
import { XP_NEXT, monsterScale, MON_POWER, MON_HP, BACK_ROW_MELEE } from '../config.js';

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

/** How much a piece of gear (gearStats) is worth to a hero of class `cls`: casters weigh magic over attack, and a
 *  back-row archer's melee weapon only lands at BACK_ROW_MELEE. (The bot keeps its own simpler score.) */
export function gearScore(g, cls) {
    if (!g) return 0;
    const magic = cls === 'mage' || cls === 'priest';
    const back = CLASSES[cls]?.row === 'back' && !magic;
    const atk = (g.atk || 0) * (back && g.slot === 'weapon' && !g.ranged ? BACK_ROW_MELEE : 1);
    return atk * (magic ? 0.3 : 1) + (g.mag || 0) * (magic ? 1.2 : 0.2) + (g.def || 0) + (g.res || 0) * 0.6 + (g.hp || 0) * 0.15
        + (g.mp || 0) * (magic ? 0.3 : 0) + (g.spd || 0) * 0.5 + (g.luk || 0) * 0.2 + (g.crit || 0) * 20;
}

const DIFF = [['atk', 'ATK'], ['def', 'DEF'], ['mag', 'MAG'], ['res', 'RES'], ['hp', 'HP'], ['mp', 'MP'], ['spd', 'SPD'], ['luk', 'LUK']];

/** What wearing `entry` instead of what's in that slot now would do for hero `c`: null if they can't wear it, else
 *  { better, gain, diff: [[label, change]...], ranged: +1 gained / −1 lost / 0 } with only the stats that change. */
export function compareGear(c, entry) {
    const d = itemDef(entry.id);
    if (!canEquip(c, d)) return null;
    const nw = gearStats(entry), cur = c.eq[d.slot] ? gearStats(c.eq[d.slot]) : null;
    const diff = [];
    for (const [k, l] of DIFF) { const v = (nw[k] || 0) - (cur?.[k] || 0); if (v) diff.push([l, v]); }
    const cr = Math.round(((nw.crit || 0) - (cur?.crit || 0)) * 100);
    if (cr) diff.push(['crit', cr, '%']);
    const ranged = (nw.ranged ? 1 : 0) - (cur?.ranged ? 1 : 0);
    const gain = gearScore(nw, c.cls) - gearScore(cur, c.cls);
    return { better: gain > 0.05, gain, diff, ranged };
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

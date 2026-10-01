/**
 * stats.js — from a hero (and its gear and the Overlord's talents) to the
 * numbers a battle uses, plus the Power rating shown everywhere.
 */

import { RACES, NAT_MULT, STAR_MULT, LEVEL_GROWTH, TRAITS } from '../data/core.js';
import { CLASSES } from '../data/classes.js';
import { SETS } from '../data/items.js';
import { TALENTS } from '../data/world.js';
import { mainValue } from './gear.js';
import { skillTemplate } from './heroes.js';

const FLAT = new Set(['hp', 'atk', 'def', 'spd']);

export function baseStats(hero) {
    const C = CLASSES[hero.cls].base, R = RACES[hero.race].mods;
    const scale = NAT_MULT[hero.nat] * STAR_MULT[hero.star] * (1 + LEVEL_GROWTH * (hero.level - 1)) * (hero.awake ? 1.15 : 1) * (hero.radiant ? 1.1 : 1);
    return {
        hp: C.hp * (R.hp || 1) * hero.rolls.hp * scale,
        atk: C.atk * (R.atk || 1) * hero.rolls.atk * scale,
        def: C.def * (R.def || 1) * hero.rolls.def * scale,
        spd: C.spd + (R.spd || 0) + hero.rolls.spd + (hero.star - 1) * 2 + (hero.awake ? 5 : 0),
        cr: C.cr + (R.cr || 0) + (hero.awake ? 0.05 : 0),
        cd: C.cd + (R.cd || 0),
        res: C.res + (R.res || 0),
        acc: C.acc + (R.acc || 0) + (hero.awake ? 0.05 : 0),
    };
}

/** Collects every modifier into { flat:{}, pct:{} } plus behaviour flags. */
function gatherMods(hero, gearOf, extra) {
    const flat = { hp: 0, atk: 0, def: 0, spd: 0, cr: 0, cd: 0, res: 0, acc: 0 };
    const pct = { hp: 0, atk: 0, def: 0, spd: 0 };
    const flags = {};
    const addMod = (k, v) => {
        if (k === 'hpP') pct.hp += v; else if (k === 'atkP') pct.atk += v; else if (k === 'defP') pct.def += v;
        else if (k === 'spdP') pct.spd += v;
        else if (k in flat) flat[k] += v;
        else flags[k] = (flags[k] || 0) + v;
    };
    for (const t of hero.traits) {
        const T = TRAITS[t];
        if (T.mod) for (const [k, v] of Object.entries(T.mod)) addMod(k, v);
        if (T.flag) for (const [k, v] of Object.entries(T.flag)) flags[k] = (flags[k] || 0) + v;
    }
    if (hero.passive) {
        const p = skillTemplate(hero, hero.passive).p;
        const lv = 1 + 0.15 * (hero.passive.lvl - 1);
        if (p.type === 'stat') addMod(p.stat, p.v * lv);
    }
    // gear
    const setCount = {};
    if (gearOf) {
        for (const gid of Object.values(hero.gear || {})) {
            const g = gearOf(gid);
            if (!g) continue;
            addMod(g.main, mainValue(g));
            for (const s of g.subs) addMod(s.s, s.v);
            setCount[g.set] = (setCount[g.set] || 0) + 1;
        }
    }
    const sets = [];
    for (const [id, n] of Object.entries(setCount)) {
        const S = SETS[id];
        const times = Math.floor(n / S.n);
        for (let i = 0; i < times; i++) {
            sets.push(id);
            if (S.bonus) for (const [k, v] of Object.entries(S.bonus)) addMod(k, v);
            if (S.flag) for (const [k, v] of Object.entries(S.flag)) flags[k] = (flags[k] || 0) + v;
        }
    }
    if (extra) for (const [k, v] of Object.entries(extra)) addMod(k, v);
    return { flat, pct, flags, sets };
}

/**
 * ctx: { gearOf(id) → gear, talents: {might..}, extra: {atkP..} }
 */
export function heroStats(hero, ctx = {}) {
    const b = baseStats(hero);
    const extra = { ...(ctx.extra || {}) };
    const T = ctx.talents;
    if (T) {
        extra.atkP = (extra.atkP || 0) + (T.might || 0) * TALENTS.might.per;
        extra.hpP = (extra.hpP || 0) + (T.fortitude || 0) * TALENTS.fortitude.per;
        extra.defP = (extra.defP || 0) + (T.bastion || 0) * TALENTS.bastion.per;
        extra.spd = (extra.spd || 0) + (T.celerity || 0) * TALENTS.celerity.per;
    }
    const { flat, pct, flags, sets } = gatherMods(hero, ctx.gearOf, extra);
    const out = {};
    for (const k of ['hp', 'atk', 'def']) out[k] = Math.round(b[k] * (1 + pct[k]) + flat[k]);
    out.spd = Math.round(b.spd * (1 + pct.spd) + flat.spd);
    for (const k of ['cr', 'cd', 'res', 'acc']) out[k] = +(b[k] + flat[k]).toFixed(3);
    out.cr = Math.min(1, out.cr);
    out.flags = flags;
    out.sets = sets;
    return out;
}

export function powerOf(st, hero) {
    let p = st.hp / 7 + st.atk * 1.7 + st.def * 1.3 + st.spd * 14 + st.cr * 450 + st.cd * 260 + st.res * 160 + st.acc * 160;
    if (hero) {
        const lv = hero.skills.reduce((a, s) => a + s.lvl - 1, 0);
        p *= 1 + 0.03 * lv + (hero.passive ? 0.05 : 0) + (hero.leader ? 0.03 : 0);
    }
    return Math.round(p);
}

export function heroPower(hero, ctx) { return powerOf(heroStats(hero, ctx), hero); }

export function isFlat(k) { return FLAT.has(k); }

/**
 * units.js — turns heroes and monster recipes into battle unit definitions.
 */

import { Rng } from '../core/rng.js';
import { ELEMENT, RACE_IDS } from '../data/core.js';
import { CLASSES } from '../data/classes.js';
import { SPECIES, BOSSES } from '../data/world.js';
import { heroStats } from './stats.js';
import { skillTemplate, generateLook, generateHero } from './heroes.js';
import { gearLookup } from './state.js';

export function skillDefs(hero) {
    return hero.skills.map((s) => ({ name: s.n, tpl: skillTemplate(hero, s), lvl: s.lvl, kind: s.k }));
}

/** Stat extras for every hero in a team: leader skill, feast buff, spire blessings. */
export function teamExtras(S, heroes, mode, now) {
    const lead = heroes[0] && heroes[0].leader;
    const out = heroes.map(() => ({}));
    heroes.forEach((h, i) => {
        const x = out[i];
        if (lead && (lead.scope === 'all' || lead.scope === h.el)) x[lead.stat] = (x[lead.stat] || 0) + lead.v;
        if (S.buffs.atk && S.buffs.atk > now) x.atkP = (x.atkP || 0) + 0.1;
        if (mode === 'spire') {
            for (const b of S.spire.blessings) {
                if (['atkP', 'hpP', 'defP', 'spd', 'cr', 'cd', 'res'].includes(b.key)) x[b.key] = (x[b.key] || 0) + b.v;
            }
        }
    });
    return out;
}

export function heroUnit(S, hero, extra) {
    const st = heroStats(hero, { gearOf: gearLookup(S), talents: S.overlord.talents, extra });
    const passive = hero.passive ? { tpl: skillTemplate(hero, hero.passive), lvl: hero.passive.lvl, name: hero.passive.n } : null;
    return {
        name: hero.name, el: hero.el, cls: hero.cls, heroId: hero.id,
        st: { hp: st.hp, atk: st.atk, def: st.def, spd: st.spd, cr: st.cr, cd: st.cd, res: st.res, acc: st.acc },
        flags: st.flags, skills: skillDefs(hero), passive,
        view: { kind: 'hero', look: hero.look, star: hero.star, awake: hero.awake, seed: hero.seed },
    };
}

/** A pseudo-hero used for enemies: class kit, neutral race, no gear. */
function enemyCore(rng, cls, el, star, level, opts = {}) {
    const nat = Math.min(5, Math.max(1, star));
    const kinds = ['basic', 'active'];
    if (star >= 3 || opts.boss) kinds.push('ult');
    const skills = kinds.map((k) => {
        const pool = CLASSES[cls][k];
        const i = rng.int(0, pool.length - 1);
        const noun = rng.pick(pool[i].nouns);
        return { k, i, n: rng.chance(0.6) && !noun.includes(' ') ? `${rng.pick(ELEMENT[el].adj)} ${noun}` : noun, lvl: Math.min(5, 1 + Math.floor(star / 2)) };
    });
    let passive = null;
    if (opts.boss || star >= 4) {
        const pool = CLASSES[cls].passive;
        const i = rng.int(0, pool.length - 1);
        passive = { k: 'passive', i, g: false, n: pool[i].nouns[0], lvl: 1 };
    }
    return {
        cls, race: 'human', el, nat, star, level, awake: 0, radiant: false, traits: [],
        rolls: { hp: 1, atk: 1, def: 1, spd: 0 }, skills, passive, gear: {},
    };
}

/**
 * recipe: { species | boss, el, star, level, diff, hpMult }
 */
export function enemyUnit(rng, r) {
    const bossDef = r.boss ? BOSSES[r.boss] : null;
    const sp = bossDef ? null : SPECIES[r.species];
    const cls = bossDef ? bossDef.cls : sp.cls;
    const el = r.el || (bossDef && bossDef.element) || 'fire';
    const core = enemyCore(rng, cls, el, r.star, r.level, { boss: !!bossDef });
    const st = heroStats(core, {});
    const m = sp ? sp.mult : { hp: 1, atk: 1, def: 1, spd: 0 };
    const diff = r.diff || 1;
    const bossM = bossDef ? { hp: 5.5, atk: 1.2, def: 1.2, spd: 12 } : r.elite ? { hp: 2, atk: 1.1, def: 1.1, spd: 6 } : { hp: 1, atk: 1, def: 1, spd: 0 };
    const out = {
        hp: Math.round(st.hp * m.hp * diff * bossM.hp * (r.hpMult || 1)),
        atk: Math.round(st.atk * m.atk * diff * bossM.atk),
        def: Math.round(st.def * m.def * diff * bossM.def),
        spd: Math.round(st.spd + m.spd + bossM.spd + (r.spdBonus || 0)),
        cr: st.cr, cd: st.cd, res: st.res + (r.star - 1) * 0.04, acc: st.acc + (r.star - 1) * 0.05,
    };
    let name, view;
    if (bossDef) {
        name = bossDef.name;
        view = { kind: 'monster', plan: bossDef.plan, el, size: bossDef.size, seed: rng.seed(), boss: true };
        if (bossDef.plan === 'usurper') {
            const lr = new Rng(0xbad);
            const look = generateLook(lr, 'demonkin', 'warlock', 'dark', 6);
            Object.assign(look, { headwear: 'crown', horns: 5, wings: 1, cape: 3, aura: 4, weapon: 'scythe', c1: '#2a1a2a', c2: '#14101a', c3: '#ff3a6a', skin: '#c8b8d8', eyeColor: '#ff3a4a', eyes: 4, brows: 2, mouth: 4, hair: 3, hairColor: '#f0f0f8' });
            view = { kind: 'hero', look, star: 6, awake: 1, seed: 0xbad, size: bossDef.size, boss: true };
        }
    } else {
        const adj = ELEMENT[el].adj[rng.int(0, 3)];
        name = `${adj} ${sp.name}`;
        if (sp.humanoid) {
            const race = rng.pick(sp.name === 'Cultist' ? ['human', 'undead', 'demonkin', 'elf'] : ['human', 'orc', 'undead', 'dwarf', 'demonkin']);
            const look = generateLook(rng, race, cls, el, Math.min(5, r.star));
            if (sp.name === 'Dread Knight') Object.assign(look, { outfit: 'plate', headwear: 'helm', c1: '#3a3440', c2: '#1a1620', shoulders: 2, cape: 3 });
            if (sp.name === 'Cultist') Object.assign(look, { outfit: 'necro', headwear: 'hood', c1: ELEMENT[el].dark, c2: '#1a1620' });
            view = { kind: 'hero', look, star: r.star, seed: rng.seed(), size: sp.size };
        } else view = { kind: 'monster', plan: sp.plan, el, size: sp.size * (r.elite ? 1.25 : 1), seed: rng.seed() };
    }
    if (r.elite) name = 'Elite ' + name;
    const skills = skillDefs({ ...core, cls });
    const passive = core.passive ? { tpl: CLASSES[cls].passive[core.passive.i], lvl: 1, name: core.passive.n } : null;
    return { name, el, cls, boss: !!bossDef, st: out, flags: {}, skills, passive, view };
}

/** A rival Overlord's hero for the Arena (generated, ungeared). */
export function rivalHeroUnit(seed, rarity, star, level, diff) {
    const h = generateHero({ seed, rarity });
    h.star = star;
    h.level = level;
    const st = heroStats(h, {});
    const passive = h.passive ? { tpl: skillTemplate(h, h.passive), lvl: 1, name: h.passive.n } : null;
    return {
        name: h.name, el: h.el, cls: h.cls,
        st: { hp: Math.round(st.hp * diff), atk: Math.round(st.atk * diff), def: Math.round(st.def * diff), spd: st.spd, cr: st.cr, cd: st.cd, res: st.res, acc: st.acc },
        flags: st.flags, skills: skillDefs(h), passive,
        view: { kind: 'hero', look: h.look, star, seed },
    };
}

export { RACE_IDS };

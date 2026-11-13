// TITAN'S VAULT: the player's derived stats. Pure.
// recompute(G) folds level, attributes, mastery bars, passive skills, gear, gems, sets and timed buffs into
// G.player.stats. It runs whenever any of those change (and on load), never every step.

import { PLAYER, LEVEL_CAP, RES_CAP } from '../config.js';
import { CLASSES, MASTERIES, SKILLS, skillVal } from './data/masteries.js';
import { BASES, GEMS, LEGENDARIES, SETS, SLOTS } from './data/items.js';

const FISTS = { dmg: [2, 4], spd: 1.25 };

export function equipped(G) {
    const P = G.player;
    return SLOTS.map((s) => P.equip[s] && G.items[P.equip[s]]).filter(Boolean);
}

/** The rank a skill acts at: learned rank plus +all-skills affixes of its mastery (0 if not learned). */
export function rankOf(G, id) {
    const P = G.player, r = P.ranks[id] || 0;
    if (!r) return 0;
    return r + (P.stats?.plusSkills?.[SKILLS[id].mastery] || 0);
}

export function hasMastery(G, m) { return G.player.masteries.includes(m); }

/** Can this skill be learned or ranked up now? Returns a reason string, or '' if yes. */
export function canLearn(G, id) {
    const P = G.player, s = SKILLS[id];
    if (!s) return 'no such skill';
    if (!hasMastery(G, s.mastery)) return 'not your mastery';
    if (P.unspent.skill < 1) return 'no skill points';
    if ((P.bar[s.mastery] || 0) < [0, 1, 4, 7, 10][s.tier]) return `needs ${MASTERIES[s.mastery].name} rank ${[0, 1, 4, 7, 10][s.tier]}`;
    if ((P.ranks[id] || 0) >= 5) return 'already at rank 5';
    return '';
}

export function recompute(G) {
    const P = G.player;
    const C = CLASSES[P.cls];
    const s = {
        might: C.stats.might + P.attrs.might, cunning: C.stats.cunning + P.attrs.cunning,
        spirit: C.stats.spirit + P.attrs.spirit, vitality: C.stats.vitality + P.attrs.vitality,
        life: 0, lifePct: 0, armor: 0, armorPct: 0, resAll: 0,
        physPct: 0, lightningPct: 0, shadowPct: 0, firePct: 0, dmgPct: 0, weaponDmg: 0,
        critPct: PLAYER.critBase, critDmgPct: PLAYER.critDmgBase, atkSpeedPct: 0,
        lifeOnHit: 0, lifeRegen: 0, resRegenPct: 0, cdrPct: 0, movePct: 0, magicFind: 0, goldFind: 0,
        staggerPct: 0, minionPct: 0, leechPct: 0, shockPct: 0, rageOnHit: 0, manaRegenPct: 0,
        plusSkills: {}, powers: {}, setCount: {},
        mana: PLAYER.mana, essence: PLAYER.essence, rage: PLAYER.rage,
    };
    const add = (k, v) => { if (k in s && typeof s[k] === 'number') s[k] += v; };

    // gear
    for (const it of equipped(G)) {
        if (it.armor) s.armor += it.armor;
        const B = BASES[it.base];
        if (B.implicit) add(B.implicit.k, B.implicit.v);
        for (const a of it.affixes) {
            if (a.k === 'skillRank') s.plusSkills[a.m] = (s.plusSkills[a.m] || 0) + 1;
            else if (a.k === 'critStat') s.critPct += a.v;
            else add(a.k, a.v);
        }
        const isWeapon = BASES[it.base].slot === 'weapon';
        for (const gid of it.sockets) {
            const g = gid && G.items[gid];
            if (!g) continue;
            const eff = isWeapon ? GEMS[g.gem].weapon : GEMS[g.gem].armor;
            add(eff.k, eff.v[g.grade]);
        }
        if (it.uniq) s.powers[LEGENDARIES[it.uniq].power] = true;
        if (it.set) s.setCount[it.set] = (s.setCount[it.set] || 0) + 1;
    }
    for (const [set, n] of Object.entries(s.setCount)) {
        for (const [need, bonus] of Object.entries(SETS[set].bonus)) {
            if (n < +need) continue;
            for (const [k, v] of Object.entries(bonus)) if (k === 'power') s.powers[v] = true; else add(k, v);
        }
    }

    // masteries: bar ranks
    for (const m of P.masteries) {
        if (!m) continue;
        const r = P.bar[m] || 0, b = MASTERIES[m].rankBonus;
        if (b.lifePct) s.lifePct += b.lifePct * r;
        if (b.armorPct) s.armorPct += b.armorPct * r;
        if (b.lightningPct) s.lightningPct += b.lightningPct * r;
        if (b.shadowPct) s.shadowPct += b.shadowPct * r;
        if (b.mana) s.mana += b.mana * r;
        if (b.essence) s.essence += b.essence * r;
    }
    // passives (rank includes +skills, so recompute twice is not needed: plusSkills is known by now)
    P.stats = s;
    for (const id of Object.keys(P.ranks)) {
        const S = SKILLS[id], r = rankOf(G, id);
        if (S.kind !== 'passive' || !r) continue;
        for (const k of Object.keys(S.fx)) if (k !== 'type') add(k, skillVal(id, k, r));
    }

    // attributes
    s.physPct += s.might * 1;
    s.armorPct += s.might * 0.5;
    s.critPct += s.cunning * 0.2;
    s.atkSpeedPct += s.cunning * 0.5;
    s.lightningPct += s.spirit * 1;
    s.shadowPct += s.spirit * 1;
    s.mana += s.spirit * PLAYER.manaPerSpirit;

    // caps
    s.atkSpeedPct = Math.min(s.atkSpeedPct, 60);
    s.critPct = Math.min(s.critPct, 60);
    s.cdrPct = Math.min(s.cdrPct, 25);
    s.movePct = Math.min(s.movePct, 30);
    s.res = Math.min(RES_CAP, s.resAll);

    // totals
    const L = Math.min(P.level, LEVEL_CAP);
    s.maxLife = Math.round((PLAYER.life + PLAYER.lifePerLevel * (L - 1) + s.vitality * PLAYER.lifePerVit + s.life) * (1 + s.lifePct / 100));
    s.armorTotal = Math.round(s.armor * (1 + s.armorPct / 100));
    const W = P.equip.weapon && G.items[P.equip.weapon];
    s.weapon = W ? { dmg: [W.dmg[0] + s.weaponDmg, W.dmg[1] + s.weaponDmg], spd: W.spd } : { dmg: [FISTS.dmg[0] + s.weaponDmg, FISTS.dmg[1] + s.weaponDmg], spd: FISTS.spd };
    s.atkRate = s.weapon.spd * (1 + s.atkSpeedPct / 100);
    s.moveSpeed = PLAYER.speed * (1 + s.movePct / 100);
    s.resMax = { rage: s.rage, mana: s.mana, essence: s.essence };
    // a rough "sheet DPS" for the character panel and the bot's gear choice: primary-ish 150% at the attack rate
    const avg = (s.weapon.dmg[0] + s.weapon.dmg[1]) / 2;
    const el = Math.max(s.physPct, s.lightningPct, s.shadowPct);
    s.dps = Math.round(avg * 1.5 * s.atkRate * (1 + (el + s.dmgPct) / 100) * (1 + (s.critPct / 100) * (s.critDmgPct / 100)));
    s.toughness = Math.round(s.maxLife / (1 - s.armorTotal / (s.armorTotal + 50 * Math.max(1, P.level))) / (1 - s.res / 100));

    P.stats = s;
    P.life = Math.min(P.life ?? s.maxLife, s.maxLife);
    for (const k of ['rage', 'mana', 'essence']) P.res[k] = Math.min(P.res[k] ?? 0, s.resMax[k]);
    return s;
}

/** Which resource a skill uses (its mastery's). */
export const resOf = (id) => MASTERIES[SKILLS[id].mastery].res;

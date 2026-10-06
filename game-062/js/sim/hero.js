// The hero: creation, derived stats, levelling, skills and the backpack.

import { CLASSES, SKILLS, MAX_SKILL_RANK } from './data/classes.js';
import { EQUIP_SLOTS, POTIONS } from './data/items.js';
import { itemStats, makeItem, sellPrice, finishItem } from './items.js';
import { LEVEL_CAP, STAT_POINTS_PER_LEVEL, INV_SIZE, STASH_SIZE, MAX_POTIONS, MAX_PIES } from '../config.js';
import { QUESTS } from './data/story.js';
import { RNG } from '../rng.js';

export const xpForLevel = (L) => Math.round(70 * Math.pow(L, 1.62) + 30 * L);

export const FRUITS = ['apple', 'orange', 'lemon', 'pear', 'strawberry', 'watermelon', 'grape', 'peach', 'cherry', 'banana', 'pineapple', 'coconut', 'kiwi', 'plum', 'blueberry', 'mango'];
export const EYES = ['round', 'happy', 'sleepy', 'fierce', 'starry', 'goggle'];
export const MOUTHS = ['smile', 'grin', 'o', 'smirk', 'teeth', 'tongue'];
export const HATS = ['none', 'helm', 'wizard', 'feather', 'crown', 'bandana', 'propeller', 'chef', 'pirate', 'flower', 'viking', 'tophat'];

export function createHero({ name, cls, look }, seed = 1) {
    const c = CLASSES[cls];
    const hero = {
        v: 1, name: name || 'Pip', cls, seed: seed >>> 0,
        look: { fruit: c.defaultFruit, tint: 0, eyes: 'round', mouth: 'smile', hat: c.defaultHat, ...look },
        level: 1, xp: 0, statPts: 0, skillPts: 1,
        alloc: { str: 0, dex: 0, mag: 0, vit: 0 },
        skills: Object.fromEntries(c.skills.map((s, i) => [s, i < 2 ? 1 : 0])),
        bar: [c.skills[0], c.skills[1], null, null, null, null],   // LMB, RMB, 1, 2, 3, 4
        equip: Object.fromEntries(EQUIP_SLOTS.map((s) => [s, null])),
        inv: new Array(INV_SIZE).fill(null),
        stash: new Array(STASH_SIZE).fill(null),
        sugar: 40, potions: { hp: 4, juice: 3, pie: 2 },
        quests: Object.fromEntries(QUESTS.map((q) => [q.id, 0])),
        waypoints: [0], maxFloor: 0, difficulty: 0, beaten: [],
        bonus: { maxHp: 0 },
        stats: { kills: 0, deaths: 0, time: 0, bosses: 0, gold: 0, legendaries: 0 },
        shopVisit: 0,
    };
    const rng = new RNG(seed ^ 0x5eed);
    hero.equip.weapon = makeItem(rng, c.weapons[0], 1, 'normal', { baseName: c.start.weapon });
    hero.equip.offhand = makeItem(rng, c.offhands[0], 1, 'normal', { baseName: c.start.offhand });
    hero.equip.body = makeItem(rng, 'body', 1, 'normal', { baseName: 'Cupcake Wrapper' });
    return hero;
}

const RES_CAP = 75;
/** Everything the sim and the character sheet need, derived from level, points and gear. */
export function computeStats(hero, buffs = null) {
    const c = CLASSES[hero.cls];
    const add = {};
    let armor = 0, wep = hero.equip.weapon;
    for (const slot of EQUIP_SLOTS) {
        const it = hero.equip[slot];
        if (!it || !usable(hero, it)) continue;
        if (it.armor) armor += it.armor;
        for (const [k, v] of Object.entries(itemStats(it))) add[k] = (add[k] || 0) + v;
    }
    if (wep && !usable(hero, wep)) wep = null;
    const all = add.allStats || 0;
    const lvlGrowth = (hero.level - 1);
    const s = {
        str: c.base.str + hero.alloc.str + (add.str || 0) + all + Math.floor(lvlGrowth * (c.main === 'str' ? 1 : 0.5)),
        dex: c.base.dex + hero.alloc.dex + (add.dex || 0) + all + Math.floor(lvlGrowth * (c.main === 'dex' ? 1 : 0.5)),
        mag: c.base.mag + hero.alloc.mag + (add.mag || 0) + all + Math.floor(lvlGrowth * (c.main === 'mag' ? 1 : 0.5)),
        vit: c.base.vit + hero.alloc.vit + (add.vit || 0) + all + Math.floor(lvlGrowth * 0.5),
    };
    const out = { ...s };
    out.maxHp = Math.round(c.baseHp + s.vit * 3 + hero.level * c.hpPerLvl + (add.hp || 0) + hero.bonus.maxHp);
    out.maxJuice = Math.round(c.baseJuice + s.mag * 1.2 + hero.level * c.juicePerLvl + (add.juice || 0));
    out.armor = Math.round((armor + (add.armor || 0) + s.str * 0.25) * (1 + (add.armorPct || 0) / 100));
    const dmin = (wep ? wep.dmg[0] : 1) + (add.minDmg || 0), dmax = Math.max(dmin, (wep ? wep.dmg[1] : 3) + (add.maxDmg || 0));
    out.dmgMin = dmin; out.dmgMax = dmax;
    out.elemFlat = { fire: add.fireDmg || 0, cold: add.coldDmg || 0, light: add.lightDmg || 0, pois: add.poisDmg || 0 };
    out.aps = (wep ? wep.aps : 1.2) * (1 + (add.ias || 0) / 100);
    out.mainStat = s[c.main];
    out.dmgPct = add.dmgPct || 0;
    out.spellDmg = add.spellDmg || 0;
    out.crit = Math.min(60, 5 + s.dex * 0.06 + (add.crit || 0));
    out.critDmg = 50 + (add.critDmg || 0);
    out.dodge = Math.min(20, (s.dex * 100) / (s.dex + 420));
    const resAll = add.resAll || 0;
    out.res = {
        phys: 0,
        fire: Math.min(RES_CAP, resAll + (add.resFire || 0)),
        cold: Math.min(RES_CAP, resAll + (add.resCold || 0)),
        light: Math.min(RES_CAP, resAll + (add.resLight || 0)),
        pois: Math.min(RES_CAP, resAll + (add.resPois || 0)),
    };
    out.moveSpeed = 4.3 * (1 + Math.min(60, add.moveSpeed || 0) / 100);
    out.hpRegen = 0.4 + s.vit * 0.015 + (add.hpRegen || 0);
    out.juiceRegen = c.juiceRegen + s.mag * 0.02 + (add.juiceRegen || 0);
    out.juiceOnHit = c.juiceOnHit;
    for (const k of ['lifeOnHit', 'lifeSteal', 'thorns', 'goldFind', 'magicFind', 'costReduce', 'cdr', 'extraProj', 'stunChance', 'freezeChance', 'healOnKill', 'skills', 'xpPct'])
        out[k] = add[k] || 0;
    out.costReduce = Math.min(60, out.costReduce);
    out.cdr = Math.min(40, out.cdr);
    out.weaponKind = wep ? wep.kind : null;
    if (buffs) {
        if (buffs.armor) out.armor = Math.round(out.armor * (1 + buffs.armor));
        if (buffs.speed) out.moveSpeed *= 1 + buffs.speed;
        if (buffs.dmg) out.dmgPct += buffs.dmg * 100;
    }
    return out;
}

export function skillRank(hero, id, st = null) {
    const r = hero.skills[id] || 0;
    return r > 0 ? r + (st ? st.skills : 0) : 0;
}

export function usable(hero, it) {
    if (!it || !it.identified) return false;
    if (it.lvl > hero.level) return false;
    const c = CLASSES[hero.cls];
    if (it.slot === 'weapon' && !c.weapons.includes(it.kind)) return false;
    if (it.slot === 'offhand' && !c.offhands.includes(it.kind)) return false;
    return true;
}
/** Why can't the hero equip this? '' when they can. */
export function whyNot(hero, it) {
    if (!it.identified) return 'Unidentified — show Deckard Cane';
    if (it.lvl > hero.level) return `Requires level ${it.lvl}`;
    const c = CLASSES[hero.cls];
    if (it.slot === 'weapon' && !c.weapons.includes(it.kind)) return `${c.name}s can't use this`;
    if (it.slot === 'offhand' && !c.offhands.includes(it.kind)) return `${c.name}s can't use this`;
    return '';
}

// ------------------------------------------------------------------ experience
/** Returns the number of levels gained. */
export function gainXp(hero, n) {
    if (hero.level >= LEVEL_CAP) return 0;
    hero.xp += Math.round(n);
    let ups = 0;
    while (hero.level < LEVEL_CAP && hero.xp >= xpForLevel(hero.level)) {
        hero.xp -= xpForLevel(hero.level);
        hero.level++;
        hero.statPts += STAT_POINTS_PER_LEVEL;
        hero.skillPts += 1;
        ups++;
    }
    if (hero.level >= LEVEL_CAP) hero.xp = 0;
    return ups;
}

export function spendStat(hero, stat, n = 1) {
    n = Math.min(n, hero.statPts);
    if (n <= 0 || !(stat in hero.alloc)) return false;
    hero.alloc[stat] += n; hero.statPts -= n;
    return true;
}

export function canLearn(hero, id) {
    const sk = SKILLS[id];
    return sk && hero.skillPts > 0 && hero.level >= sk.lvl && (hero.skills[id] || 0) < MAX_SKILL_RANK && CLASSES[hero.cls].skills.includes(id);
}
export function learnSkill(hero, id) {
    if (!canLearn(hero, id)) return false;
    const was = hero.skills[id] || 0;
    hero.skills[id] = was + 1; hero.skillPts--;
    // A newly learned skill drops into the first free hotkey.
    if (!was && !hero.bar.includes(id)) {
        const free = hero.bar.findIndex((b, i) => i >= 2 && !b);
        if (free >= 0) hero.bar[free] = id;
    }
    return true;
}

// ------------------------------------------------------------------ backpack
export const freeSlot = (arr) => arr.indexOf(null);
export function addToInv(hero, it) {
    const i = freeSlot(hero.inv);
    if (i < 0) return false;
    hero.inv[i] = it;
    return true;
}

/** Equip hero.inv[i]. Handles rings, two-handers and offhands. Returns '' or an error. */
export function equipFromInv(hero, i, ringSlot = null) {
    const it = hero.inv[i];
    if (!it) return 'nothing there';
    const why = whyNot(hero, it);
    if (why) return why;
    let slot = it.slot;
    if (slot === 'ring') slot = ringSlot || (!hero.equip.ring1 ? 'ring1' : !hero.equip.ring2 ? 'ring2' : 'ring1');
    hero.inv[i] = null;
    const prev = hero.equip[slot];
    hero.equip[slot] = it;
    if (prev) hero.inv[i] = prev;
    // A two-hander pushes the offhand into the bag; an offhand pushes out a two-hander.
    if (slot === 'weapon' && it.twoHanded && hero.equip.offhand) {
        const off = hero.equip.offhand;
        hero.equip.offhand = null;
        if (!addToInv(hero, off)) { hero.equip.offhand = off; hero.equip.weapon = prev; hero.inv[i] = it; return 'no room for your offhand'; }
    }
    if (slot === 'offhand' && hero.equip.weapon && hero.equip.weapon.twoHanded) {
        const w = hero.equip.weapon;
        hero.equip.weapon = null;
        if (!addToInv(hero, w)) { hero.equip.weapon = w; hero.equip.offhand = prev; hero.inv[i] = it; return 'no room for your weapon'; }
    }
    return '';
}

export function unequip(hero, slot) {
    const it = hero.equip[slot];
    if (!it) return false;
    if (!addToInv(hero, it)) return false;
    hero.equip[slot] = null;
    return true;
}

export function sellFromInv(hero, i) {
    const it = hero.inv[i];
    if (!it) return 0;
    const p = sellPrice(it);
    hero.inv[i] = null;
    hero.sugar += p;
    return p;
}

export function identifyAll(hero) {
    let n = 0;
    const fix = (it) => { if (it && !it.identified) { it.identified = true; finishItem(it); n++; } };
    hero.inv.forEach(fix); hero.stash.forEach(fix);
    EQUIP_SLOTS.forEach((s) => fix(hero.equip[s]));
    return n;
}

export function potionCap(kind) { return kind === 'pie' ? MAX_PIES : MAX_POTIONS; }
export function addPotion(hero, kind, n = 1) {
    const cap = potionCap(kind);
    const before = hero.potions[kind];
    hero.potions[kind] = Math.min(cap, before + n);
    return hero.potions[kind] - before;
}
export const potionPrice = (kind, lvl) => Math.round(POTIONS[kind].price * (1 + lvl * 0.12));

/** Lightweight equality score so the UI and the bot can compare items (higher is better). */
export function itemScore(hero, it) {
    if (!it || !usable(hero, it)) return -1;
    const c = CLASSES[hero.cls];
    const s = itemStats(it);
    let v = 0;
    if (it.dmg) v += ((it.dmg[0] + it.dmg[1]) / 2) * it.aps * 3 * (1 + (s.dmgPct || 0) / 100);
    if (it.armor) v += it.armor * 0.8;
    v += (s[c.main] || 0) * 1.6 + (s.allStats || 0) * 2.2 + (s.vit || 0) * 1.2;
    v += (s.hp || 0) * 0.4 + (s.armor || 0) * 0.6 + (s.armorPct || 0) * 0.3 + (s.resAll || 0) * 0.9;
    v += ((s.resFire || 0) + (s.resCold || 0) + (s.resLight || 0) + (s.resPois || 0)) * 0.25;
    v += ((s.fireDmg || 0) + (s.coldDmg || 0) + (s.lightDmg || 0) + (s.poisDmg || 0) + (s.maxDmg || 0)) * 2;
    v += (s.ias || 0) * 1.5 + (s.crit || 0) * 2.5 + (s.critDmg || 0) * 0.5 + (s.spellDmg || 0) * (c.main === 'mag' ? 1 : 0.2);
    v += (s.lifeOnHit || 0) * 0.8 + (s.lifeSteal || 0) * 4 + (s.hpRegen || 0) * 1 + (s.moveSpeed || 0) * 1.2 + (s.juice || 0) * 0.3;
    v += (s.skills || 0) * 30 + (s.extraProj || 0) * 25 + (s.costReduce || 0) * 1.5;
    return v;
}

/**
 * heroes.js — the procedural hero generator and everything that changes a
 * hero: levels, evolution, awakening, skill-ups, release.
 *
 * A hero is plain JSON so it lives in the save as-is. Skills are stored as
 * references into the class pools (data/classes.js) plus their rolled names.
 */

import { Rng } from '../core/rng.js';
import { ELEMENT, ELEMENTS, RACES, RACE_IDS, TRAITS, TRAIT_IDS, TRAIT_COUNT, MAX_LEVEL } from '../data/core.js';
import { CLASSES, CLASS_IDS, GENERAL_PASSIVES } from '../data/classes.js';
import {
    EYE_STYLES, BROWS, MOUTHS, MARKS, HAIR_STYLES, HORNS, TAILS, WINGS, BEARDS, CAPES, SHOULDERS,
    HAIR_COLORS, EYE_COLORS, METALS, ELEMENT_PALETTE, GLOW_COLORS,
} from '../data/looks.js';

export const RADIANT_CHANCE = 1 / 50;

// ---------------------------------------------------------------- names & lore

const EPITHET = {
    knight: ['the Steadfast', 'Ironheart', 'the Unbroken', 'Shieldbearer', 'the Oathsworn'],
    berserker: ['the Red', 'Bloodaxe', 'the Unchained', 'Skullsplitter', 'the Mad'],
    ranger: ['Farshot', 'the Hawk', 'Swiftbow', 'the Silent', 'Windrunner'],
    mage: ['the Wise', 'Spellweaver', 'the Arcane', 'Starcaller', 'the Learned'],
    assassin: ['the Shadow', 'Quickblade', 'the Unseen', 'Nightfang', 'the Whisper'],
    cleric: ['the Merciful', 'Lightbringer', 'the Blessed', 'Dawnhand', 'the Gentle'],
    bard: ['the Silver-Tongued', 'Songweaver', 'the Merry', 'Lyrebright', 'the Wandering'],
    necromancer: ['the Pale', 'Gravecaller', 'the Hollow', 'Bonewhisper', 'the Deathless'],
    paladin: ['the Just', 'Dawnshield', 'the Radiant', 'Lightforged', 'the Faithful'],
    monk: ['the Still', 'Ironfist', 'the Serene', 'Stormpalm', 'the Patient'],
    druid: ['Greenheart', 'the Wild', 'Rootsinger', 'the Verdant', 'Mossbeard'],
    warlock: ['the Damned', 'Voidtouched', 'the Bargainer', 'Hexblade', 'the Forsaken'],
};
const ORIGINS = ['the Verdant Vale', 'Emberfall', 'the Tidewater Coast', 'the Sunspire', 'the Gloomwood', 'Frostpeak', 'the Prismatic Caverns', 'a village nobody remembers', 'the far side of the sigil-light', 'a wandering caravan', 'a sunken monastery', 'the old capital'];
const QUIRKS = [
    'hums while fighting', 'keeps a journal of every foe', 'never refuses a wager', 'talks to their weapon', 'collects pretty stones',
    'is terrified of geese', 'cooks for the whole camp', 'still owes someone money', 'sleeps with one eye open', 'writes terrible poetry',
    'swears they were royalty once', 'feeds every stray they meet', 'counts their steps', 'laughs at the worst moments', 'is looking for a lost sibling',
    'refuses to retreat, ever', 'can name every star', 'trusts nobody but the Overlord', 'is always hungry', 'prays to a forgotten god',
];

function makeName(rng, race) {
    const [a, b] = RACES[race].syl;
    let n = rng.pick(a) + rng.pick(b);
    if (rng.chance(0.18)) n += rng.pick(b);
    return n[0].toUpperCase() + n.slice(1).toLowerCase();
}

export function randomName(rng, race) { return makeName(rng, race); }

// ---------------------------------------------------------------- look generation

const pickIdx = (rng, arr) => rng.int(0, arr.length - 1);

export function generateLook(rng, race, cls, el, rarity, radiant = false) {
    const R = RACES[race], C = CLASSES[cls];
    const pal = ELEMENT_PALETTE[el];
    const look = {
        race,
        build: +(rng.range(0.92, 1.08) * (R.build || 1)).toFixed(3),
        height: +rng.range(R.height[0], R.height[1]).toFixed(3),
        head: +rng.range(R.head[0], R.head[1]).toFixed(3),
        skin: rng.pick(R.skins),
        eyes: pickIdx(rng, EYE_STYLES.slice(0, 8)),
        eyeColor: race === 'undead' ? rng.pick(['#8ae8ff', '#a05aff', '#7ae05a']) : race === 'demonkin' ? rng.pick(['#ff3a4a', '#ffd84a', '#ff6ab0']) : rng.pick(EYE_COLORS),
        brows: pickIdx(rng, BROWS),
        mouth: pickIdx(rng, MOUTHS),
        blush: rng.chance(0.4),
        marks: rng.chance(0.35) ? rng.int(1, MARKS.length - 1) : 0,
        markColor: rng.pick([ELEMENT[el].color, '#2a2a3a', '#ffffff', '#d03a3a', '#3a8aff']),
        scar: rng.chance(0.12) ? rng.int(1, 2) : 0,
        hair: race === 'golem' ? (rng.chance(0.7) ? 15 : rng.int(0, 14)) : rng.chance(0.03) ? 15 : rng.int(0, 14),
        hairColor: rng.pick(HAIR_COLORS),
        hairTip: rng.chance(0.25) ? rng.pick([ELEMENT[el].color, ELEMENT[el].glow, '#ffffff']) : null,
        ears: rng.pick(R.ears),
        horns: rng.chance(R.horns) ? (race === 'dragonkin' ? rng.pick([2, 3, 5]) : race === 'demonkin' ? rng.pick([2, 3, 5]) : rng.int(1, 4)) : 0,
        hornColor: rng.pick(['#f4ead8', '#3a2a2a', '#c8a070', '#2a2238', ELEMENT[el].dark]),
        tail: rng.chance(R.tail) ? (race === 'beastkin' ? rng.pick([1, 2]) : race === 'dragonkin' ? 3 : 4) : 0,
        wings: rng.chance(R.wings) ? (race === 'fae' ? 3 : race === 'dragonkin' ? 4 : race === 'demonkin' ? 1 : race === 'undead' ? 1 : 2) : 0,
        wingColor: race === 'fae' ? rng.pick(['#bff0ff', '#ffd0f0', '#e0ffd0', '#fff0b0']) : rng.pick([ELEMENT[el].dark, '#2a2230', '#f4f0f8', ELEMENT[el].color]),
        beard: (R.beard && rng.chance(R.beard)) ? rng.int(1, 3) : rng.chance(0.06) ? 1 : 0,
        tusks: !!R.tusks,
        outfit: rng.pick(C.outfits),
        c1: rng.pick(pal.c1), c2: rng.pick(pal.c2), c3: rng.pick(pal.c3),
        cape: rarity >= 4 ? rng.int(1, 3) : rng.chance(0.3) ? rng.int(1, 3) : 0,
        headwear: rng.pick(C.head),
        shoulders: C.outfits.includes('plate') ? rng.int(1, 2) : rng.chance(0.2) ? 1 : 0,
        weapon: rng.pick(C.weapons),
        shield: !!C.shield,
        metal: rng.pick(METALS),
        glow: ELEMENT[el].color,
        aura: rarity >= 5 ? ({ fire: 2, water: 3, wind: 1, light: 5, dark: 4 })[el] : rarity >= 4 && rng.chance(0.4) ? 1 : 0,
        radiant: !!radiant,
    };
    if (look.headwear === 'horns' && look.horns) look.headwear = 'hood';
    if (radiant) {
        // radiant: an alternate, shinier palette
        look.c1 = rng.pick(['#f8f8ff', '#ffe27a', '#ff8ad8', '#7af0ff', '#c8ff7a']);
        look.c3 = '#ffe27a';
        look.hairTip = rng.pick(['#ffe27a', '#7af0ff', '#ff8ad8']);
        look.aura = Math.max(look.aura, 1);
        look.metal = '#ffe08a';
        look.glow = rng.pick(GLOW_COLORS);
    }
    return look;
}

// ---------------------------------------------------------------- skills

function rollSkill(rng, cls, kind, el) {
    const pool = CLASSES[cls][kind];
    const i = rng.int(0, pool.length - 1);
    const tpl = pool[i];
    const noun = rng.pick(tpl.nouns);
    // ultimates and actives get an element adjective most of the time; basics sometimes
    const adjP = kind === 'basic' ? 0.55 : 0.85;
    const name = rng.chance(adjP) && !noun.includes(' ') ? `${rng.pick(ELEMENT[el].adj)} ${noun}` : noun;
    return { k: kind, i, n: name, lvl: 1 };
}

function rollPassive(rng, cls, el) {
    const general = rng.chance(0.3);
    const pool = general ? GENERAL_PASSIVES : CLASSES[cls].passive;
    const i = rng.int(0, pool.length - 1);
    return { k: 'passive', i, g: general, n: rng.pick(pool[i].nouns), lvl: 1 };
}

export function skillTemplate(hero, s) {
    if (s.k === 'passive') return s.g ? GENERAL_PASSIVES[s.i] : CLASSES[hero.cls].passive[s.i];
    return CLASSES[hero.cls][s.k][s.i];
}

const LEADER_BY_ROLE = {
    attack: [['atkP', 1], ['cr', 0.6]],
    defense: [['defP', 1.2], ['hpP', 1]],
    hp: [['hpP', 1], ['res', 1]],
    support: [['spd', 50], ['res', 1], ['atkP', 0.9]],
};

function rollLeader(rng, cls, el, nat) {
    if (nat < 4) return null;
    const [stat, scale] = rng.pick(LEADER_BY_ROLE[CLASSES[cls].role]);
    const elemental = rng.chance(0.5);
    const base = nat >= 5 ? 0.2 : 0.14;
    let v = (elemental ? base + 0.08 : base) * scale;
    if (stat === 'spd') v = Math.round(v / 1); // flat spd
    else v = +v.toFixed(2);
    return { stat, v, scope: elemental ? el : 'all' };
}

// ---------------------------------------------------------------- generation

/**
 * opts: { seed, rarity, element?, cls?, race?, radiant? (true/false/undefined = roll) }
 */
export function generateHero(opts) {
    const rng = new Rng(opts.seed);
    const nat = opts.rarity;
    const el = opts.element || rng.pick(ELEMENTS);
    const cls = opts.cls || rng.pick(CLASS_IDS);
    const race = opts.race || rng.pick(RACE_IDS);
    const radiant = opts.radiant ?? rng.chance(RADIANT_CHANCE);

    const rolls = {
        hp: +rng.range(0.85, 1.15).toFixed(3),
        atk: +rng.range(0.85, 1.15).toFixed(3),
        def: +rng.range(0.85, 1.15).toFixed(3),
        spd: rng.int(-4, 4),
    };
    const q = (rolls.hp + rolls.atk + rolls.def) / 3 + rolls.spd * 0.01;
    const grade = q >= 1.08 ? 'S' : q >= 1.03 ? 'A' : q >= 0.96 ? 'B' : 'C';

    const nTraits = TRAIT_COUNT[nat] + (rng.chance(0.25) ? 1 : 0);
    const traits = rng.sample(TRAIT_IDS, Math.min(3, nTraits));

    const skills = [rollSkill(rng, cls, 'basic', el), rollSkill(rng, cls, 'active', el)];
    if (nat >= 2 || rng.chance(0.5)) skills.push(rollSkill(rng, cls, 'ult', el));
    const passive = nat >= 3 ? rollPassive(rng, cls, el) : null;
    const leader = rollLeader(rng, cls, el, nat);

    const name = makeName(rng, race);
    const epithet = rng.pick(EPITHET[cls]);
    const lore = `A ${RACES[race].name.toLowerCase()} ${CLASSES[cls].name.toLowerCase()} from ${rng.pick(ORIGINS)} who ${rng.pick(QUIRKS)}.`;
    const look = generateLook(rng, race, cls, el, nat, radiant);

    return {
        id: 0, seed: opts.seed >>> 0, name, epithet, race, cls, el, nat, star: nat, level: 1, xp: 0, awake: 0,
        rolls, grade, traits, skills, passive, leader, radiant, look, lore,
        gear: {}, locked: false, isNew: true,
    };
}

// ---------------------------------------------------------------- progression

export function maxLevel(hero) { return MAX_LEVEL[hero.star]; }

export function xpToNext(level, star) {
    return Math.round(45 * Math.pow(level, 1.55) * (1 + 0.18 * (star - 1)));
}

export function xpMult(hero) { return hero.traits.includes('scholar') ? 1 + TRAITS.scholar.flag.xp : 1; }

/** Adds XP; returns the number of levels gained. Overflow at max level is lost. */
export function addXp(hero, amount) {
    let gained = 0;
    hero.xp += Math.floor(amount * xpMult(hero));
    while (hero.level < maxLevel(hero) && hero.xp >= xpToNext(hero.level, hero.star)) {
        hero.xp -= xpToNext(hero.level, hero.star);
        hero.level++;
        gained++;
    }
    if (hero.level >= maxLevel(hero)) hero.xp = 0;
    return gained;
}

/** XP still needed to reach max level */
export function xpToMax(hero) {
    let need = -hero.xp;
    for (let l = hero.level; l < maxLevel(hero); l++) need += xpToNext(l, hero.star);
    return Math.max(0, need);
}

export const EVOLVE_FODDER = [0, 1, 2, 3, 3, 4];
export function evolveCost(hero) {
    return { fodder: EVOLVE_FODDER[hero.star] || 0, gold: hero.star * hero.star * 1500 };
}

export function canEvolve(hero) { return hero.star < 6 && hero.level >= maxLevel(hero); }

export function evolve(hero) {
    hero.star++;
    hero.level = 1;
    hero.xp = 0;
    // a new star can bring a new trait or passive
    if (hero.star >= 3 && !hero.passive) {
        const rng = new Rng(hero.seed ^ 0xa5a5);
        hero.passive = rollPassive(rng, hero.cls, hero.el);
    }
    if (hero.star === 6 && hero.traits.length < 3) {
        const rng = new Rng(hero.seed ^ 0x5a5a);
        const options = TRAIT_IDS.filter((t) => !hero.traits.includes(t));
        hero.traits.push(rng.pick(options));
    }
    if (hero.star >= 3 && !hero.skills.some((s) => s.k === 'ult')) {
        const rng = new Rng(hero.seed ^ 0x3c3c);
        hero.skills.push(rollSkill(rng, hero.cls, 'ult', hero.el));
    }
}

export function awakenCost(hero) {
    const s = hero.star;
    return {
        el: hero.el,
        lo: 6 + s * 3,
        mid: s >= 3 ? s * 3 : 0,
        hi: s >= 5 ? s * 2 : 0,
        gold: 2000 * s * s,
    };
}

export function awaken(hero) {
    hero.awake = 1;
    hero.look.aura = hero.look.aura || ({ fire: 2, water: 3, wind: 1, light: 5, dark: 4 })[hero.el];
}

export const SKILL_MAX = 5;

export function skillUpTargets(hero) { return hero.skills.filter((s) => s.lvl < SKILL_MAX); }

/** Raises a random non-max skill; returns it or null */
export function skillUp(hero, rng) {
    const opts = skillUpTargets(hero);
    if (!opts.length) return null;
    const s = rng.pick(opts);
    s.lvl++;
    return s;
}

export function releaseValue(hero) {
    return { dust: Math.round(10 * Math.pow(3, hero.star - 1) * (hero.awake ? 1.5 : 1)), gold: 200 * hero.star * hero.star };
}

export function displayName(hero) { return hero.name; }
export function title(hero) { return `${hero.name} ${hero.epithet.startsWith('the') ? hero.epithet : '“' + hero.epithet + '”'}`; }

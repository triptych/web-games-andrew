/**
 * monsters.js — procedural monsters: family × modifiers × name, scaled by level.
 *
 * makeMonster(rng, { level, family?, rank: 'normal'|'elite'|'keeper'|'guardian'|'final', boss? })
 * returns { name, family, level, rank, mods, look, side, xp, gold, weak, resist } where `side`
 * is the battle side and `look` drives the procedural 3D model (same seed, same creature).
 */

import { clamp } from './rng.js';
import { MANA } from './data.js';

// ------------------------------------------------------------------ Monster spells

export const MSPELLS = {
    gloop:      { name: 'Gloop', icon: '🟢', cost: { leaf: 6 }, ops: [{ op: 'heal', n: 10 }], desc: 'Heals {heal}.' },
    acidspit:   { name: 'Acid Spit', icon: '🤢', cost: { leaf: 7 }, ops: [{ op: 'dmg', n: 8, el: 'leaf' }], desc: 'Spits for {dmg}.' },
    sporecloud: { name: 'Spore Cloud', icon: '🍄', cost: { leaf: 7 }, ops: [{ op: 'burn', n: 3, turns: 3 }], desc: 'Poison: {burn} a turn for 3 turns.' },
    emberspit:  { name: 'Ember Spit', icon: '🔥', cost: { fire: 6 }, ops: [{ op: 'dmg', n: 8, el: 'fire' }], desc: 'Spits fire for {dmg}.' },
    flamedance: { name: 'Flame Dance', icon: '💃', cost: { fire: 9 }, ops: [{ op: 'dmg', n: 4, el: 'fire' }, { op: 'burn', n: 3, turns: 3 }], desc: '{dmg} and burns {burn} a turn.' },
    frenzy:     { name: 'Frenzy', icon: '😡', cost: { fire: 7 }, ops: [{ op: 'buff', key: 'skull', n: 2, turns: 3 }], desc: 'Skulls +2 for 3 turns.' },
    pinch:      { name: 'Pinch', icon: '🦀', cost: { water: 5 }, ops: [{ op: 'dmg', n: 6, el: 'water' }], desc: 'Pinches for {dmg}.' },
    bubble:     { name: 'Bubble Shield', icon: '🫧', cost: { water: 6 }, ops: [{ op: 'shield', n: 10 }], desc: 'Shield of {shield}.' },
    tidalslam:  { name: 'Tidal Slam', icon: '🌊', cost: { water: 9 }, ops: [{ op: 'dmg', n: 12, el: 'water' }], desc: 'Slams for {dmg}.' },
    hex:        { name: 'Hex', icon: '🌀', cost: { water: 8 }, ops: [{ op: 'drain', color: 'all', n: 3 }, { op: 'dmg', n: 4 }], desc: 'Drains 3 of each mana, {dmg} damage.' },
    zap:        { name: 'Zap', icon: '⚡', cost: { spark: 6 }, ops: [{ op: 'dmg', n: 7, el: 'spark' }], desc: 'Zaps for {dmg}.' },
    static:     { name: 'Static', icon: '📡', cost: { spark: 7 }, ops: [{ op: 'drain', color: 'all', n: 3 }], desc: 'Drains 3 of each of your mana.' },
    gust:       { name: 'Gust', icon: '💨', cost: { spark: 7 }, ops: [{ op: 'destroyRandom', count: 8, collect: true }], desc: 'Blows 8 gems its way.' },
    stoneskin:  { name: 'Stone Skin', icon: '🪨', cost: { leaf: 8 }, ops: [{ op: 'shield', n: 14 }], desc: 'Shield of {shield}.' },
    maul:       { name: 'Maul', icon: '🐾', cost: { fire: 7, leaf: 3 }, ops: [{ op: 'dmg', n: 11 }], desc: 'Mauls for {dmg}.' },
    quake:      { name: 'Quake', icon: '🌋', cost: { leaf: 10, fire: 4 }, ops: [{ op: 'dmg', n: 9 }, { op: 'stun', turns: 1 }], desc: '{dmg} and stuns you.' },
    pagestorm:  { name: 'Page Storm', icon: '📄', cost: { spark: 9 }, ops: [{ op: 'dmg', n: 5 }, { op: 'destroyRandom', count: 10, collect: true }], desc: '{dmg}, then 10 gems fly its way.' },
    wail:       { name: 'Wail', icon: '👻', cost: { water: 7, spark: 4 }, ops: [{ op: 'dmg', n: 5 }, { op: 'stun', turns: 1 }], desc: '{dmg} and you lose a turn.' },
    dragonfire: { name: 'Dragonfire', icon: '🐉', cost: { fire: 12 }, ops: [{ op: 'dmg', n: 15, el: 'fire' }, { op: 'burn', n: 3, turns: 2 }], desc: '{dmg} and burns.' },
    rallyroar:  { name: 'Rally Roar', icon: '🗯️', cost: { spark: 6 }, ops: [{ op: 'heal', n: 7 }, { op: 'buff', key: 'skull', n: 1, turns: 3 }], desc: 'Heals {heal}, skulls +1.' },
    smudge:     { name: 'Smudge', icon: '🖤', cost: { water: 6 }, ops: [{ op: 'drain', color: 'all', n: 2 }, { op: 'dmg', n: 5 }], desc: 'Smears your mana away and hits for {dmg}.' },
    unwrite:    { name: 'Unwrite', icon: '✒️', cost: { water: 10, spark: 8 }, ops: [{ op: 'dmg', n: 18 }, { op: 'drain', color: 'all', n: 4 }], desc: '{dmg} and erases 4 of each mana.' },
    blankpage:  { name: 'Blank Page', icon: '📃', cost: { fire: 8, leaf: 8 }, ops: [{ op: 'shield', n: 20 }, { op: 'heal', n: 10 }], desc: 'Shield {shield}, heals {heal}.' },
};

// ------------------------------------------------------------------ Families

export const FAMILIES = {
    slime:    { name: 'Slime',    plan: 'blob',    color: 'leaf',  weak: 'fire',  resist: 'leaf',  hues: [0.28, 0.34, 0.5],  hp: 1.0,  dmg: 0.9, spells: ['gloop', 'acidspit', 'sporecloud'], nouns: ['Slime', 'Jelly', 'Goo'] },
    sprite:   { name: 'Sprite',   plan: 'flyer',   color: 'spark', weak: 'water', resist: 'spark', hues: [0.12, 0.85, 0.55], hp: 0.8,  dmg: 1.0, spells: ['zap', 'gust', 'static'], nouns: ['Sprite', 'Pixie', 'Glimmer'] },
    imp:      { name: 'Imp',      plan: 'biped',   color: 'fire',  weak: 'water', resist: 'fire',  hues: [0.0, 0.04, 0.95],  hp: 0.95, dmg: 1.1, spells: ['emberspit', 'flamedance', 'frenzy'], nouns: ['Imp', 'Scamp', 'Fiendling'] },
    crab:     { name: 'Crab',     plan: 'crab',    color: 'water', weak: 'spark', resist: 'water', hues: [0.02, 0.55, 0.08], hp: 1.15, dmg: 0.95, spells: ['pinch', 'bubble', 'tidalslam'], nouns: ['Crab', 'Clacker', 'Shellback'] },
    eel:      { name: 'Eel',      plan: 'serpent', color: 'water', weak: 'spark', resist: 'water', hues: [0.52, 0.6, 0.45],  hp: 0.95, dmg: 1.1, spells: ['tidalslam', 'hex', 'zap'], nouns: ['Eel', 'Serpent', 'Wriggler'] },
    wisp:     { name: 'Wisp',     plan: 'wisp',    color: 'spark', weak: 'leaf',  resist: 'fire',  hues: [0.08, 0.15, 0.62], hp: 0.8,  dmg: 1.05, spells: ['zap', 'static', 'emberspit'], nouns: ['Wisp', 'Will-o', 'Flicker'] },
    gargoyle: { name: 'Gargoyle', plan: 'biped',   color: 'leaf',  weak: 'spark', resist: 'fire',  hues: [0.6, 0.7, 0.1],    hp: 1.2,  dmg: 1.0, spells: ['stoneskin', 'maul', 'quake'], nouns: ['Gargoyle', 'Grotesque', 'Spoutling'] },
    golem:    { name: 'Golem',    plan: 'golem',   color: 'leaf',  weak: 'water', resist: 'spark', hues: [0.08, 0.1, 0.58],  hp: 1.35, dmg: 0.95, spells: ['stoneskin', 'quake', 'maul'], nouns: ['Golem', 'Automaton', 'Cogwalker'] },
    mimic:    { name: 'Mimic',    plan: 'book',    color: 'spark', weak: 'fire',  resist: 'water', hues: [0.95, 0.08, 0.75], hp: 1.0,  dmg: 1.05, spells: ['pagestorm', 'frenzy', 'static'], nouns: ['Mimic Tome', 'Biteback Book', 'Snapjacket'], greedy: true },
    mushroom: { name: 'Shroom',   plan: 'mushroom',color: 'leaf',  weak: 'fire',  resist: 'water', hues: [0.98, 0.78, 0.3],  hp: 1.05, dmg: 0.9, spells: ['sporecloud', 'gloop', 'acidspit'], nouns: ['Shroom', 'Toadstool', 'Puffcap'] },
    specter:  { name: 'Specter',  plan: 'ghost',   color: 'water', weak: 'fire',  resist: 'leaf',  hues: [0.5, 0.7, 0.8],    hp: 0.9,  dmg: 1.15, spells: ['wail', 'hex', 'static'], nouns: ['Specter', 'Haunt', 'Shade'] },
    drake:    { name: 'Drake',    plan: 'beast',   color: 'fire',  weak: 'water', resist: 'fire',  hues: [0.0, 0.92, 0.08],  hp: 1.2,  dmg: 1.15, spells: ['dragonfire', 'emberspit', 'frenzy'], nouns: ['Drake', 'Wyrmling', 'Dragonet'] },
    owlbear:  { name: 'Owlbear',  plan: 'beast',   color: 'leaf',  weak: 'fire',  resist: 'spark', hues: [0.07, 0.1, 0.13],  hp: 1.25, dmg: 1.05, spells: ['maul', 'rallyroar', 'frenzy'], nouns: ['Owlbear', 'Hootgrizzly', 'Featherbear'] },
    inkling:  { name: 'Inkling',  plan: 'blob',    color: 'water', weak: 'spark', resist: 'water', hues: [0.72, 0.75, 0.68], hp: 1.0,  dmg: 1.0, spells: ['smudge', 'hex', 'bubble'], nouns: ['Inkling', 'Blot', 'Smudgeling'], ink: true },
};
export const FAMILY_IDS = Object.keys(FAMILIES);

export const MODS = {
    giant:    { name: 'Giant',    hp: 1.35, scale: 1.22, xp: 1.2 },
    swift:    { name: 'Swift',    sloppy: -0.25, startMana: 5, xp: 1.15 },
    arcane:   { name: 'Arcane',   power: 1.3, xp: 1.15 },
    armored:  { name: 'Armored',  shield: 10, ward: 0.12, xp: 1.15 },
    greedy:   { name: 'Greedy',   greedy: true, gold: 1.7 },
    frenzied: { name: 'Frenzied', dmg: 1.22, hp: 0.9, xp: 1.15 },
    ancient:  { name: 'Ancient',  hp: 1.15, dmg: 1.12, power: 1.12, xp: 1.4, gold: 1.3 },
    radiant:  { name: 'Radiant',  xp: 1.6, glow: true },
    spiky:    { name: 'Spiky',    thorns: 2, spikes: true, xp: 1.1 },
};
export const MOD_IDS = Object.keys(MODS);

const SYL_A = ['Glim', 'Bram', 'Zib', 'Mog', 'Tuff', 'Quill', 'Snor', 'Pip', 'Grub', 'Fizz', 'Wob', 'Nim', 'Krag', 'Lum', 'Bix', 'Drub', 'Oot', 'Skree', 'Vel', 'Yarn', 'Muck', 'Tib', 'Zor', 'Plum', 'Gob'];
const SYL_B = ['ble', 'wick', 'gle', 'nob', 'sy', 'zle', 'rot', 'mop', 'kin', 'ock', 'bit', 'ster', 'pus', 'lump', 'wort', 'dle', 'snout', 'fang'];

export function monsterName(rng) { return rng.pick(SYL_A) + rng.pick(SYL_B); }

// ------------------------------------------------------------------ Scaling

export function monsterHp(L) { return 32 + 9 * L + 0.12 * L * L; }
export function monsterSkull(L) { return 3.1 + 0.5 * L + 0.0026 * L * L; }

const RANK = {
    normal:   { hp: 1,    dmg: 1,    xp: 1,   gold: 1,   spells: 2, mods: [0, 1], sloppy: 0 },
    elite:    { hp: 1.4,  dmg: 1.12, xp: 2.2, gold: 2.2, spells: 3, mods: [2, 2], sloppy: -0.15 },
    keeper:   { hp: 1.75, dmg: 1.1,  xp: 4,   gold: 4,   spells: 3, mods: [1, 1], sloppy: -0.3 },
    guardian: { hp: 2.0,  dmg: 1.15, xp: 6,   gold: 6,   spells: 3, mods: [1, 1], sloppy: -0.35 },
    final:    { hp: 1.9,  dmg: 1.2,  xp: 10,  gold: 10,  spells: 3, mods: [0, 0], sloppy: -0.5 },
};

/**
 * Per-wing trim found with the balance table (BALANCE=1 node dev/simtest.mjs): books, spell
 * ranks, forged gear and potions compound, so a level-L monster in a late wing has to be
 * tougher than the same level early on for fights to stay ~10–20 turns.
 */
export const WING_HP  = [1, 1.12, 1.35, 1.6, 1.9, 2.2, 2.4];
export const WING_DMG = [1, 1.05, 1.12, 1.2, 1.26, 1.32, 1.38];
export function tierOfLevel(L) { return L < 5 ? 0 : L < 10 ? 1 : L < 15 ? 2 : L < 20 ? 3 : L < 26 ? 4 : L < 33 ? 5 : 6; }

export function makeMonster(rng, opt) {
    const L = opt.level;
    const famId = opt.family || rng.pick(FAMILY_IDS);
    const fam = FAMILIES[famId];
    const rank = RANK[opt.rank || 'normal'];
    const nMods = opt.mods ? 0 : rng.int(rank.mods[0], rank.mods[1]);
    const mods = opt.mods ? [...opt.mods] : [];
    const pool = MOD_IDS.slice();
    rng.shuffle(pool);
    for (let i = 0; i < nMods; i++) if (opt.rank !== 'normal' || rng.chance(0.45)) mods.push(pool[i]);

    const tier = opt.tier ?? tierOfLevel(L);
    let hp = monsterHp(L) * fam.hp * rank.hp * WING_HP[tier], dmg = monsterSkull(L) * fam.dmg * rank.dmg * WING_DMG[tier];
    let power = (1 + 0.065 * (L - 1)) * WING_DMG[tier];
    let xp = (8 + 4.2 * L + 0.04 * L * L) * rank.xp, gold = (5 + 2.5 * L) * rank.gold, scale = 1, shield = 0, ward = 0, thorns = 0, startMana = 0;
    let sloppy = clamp(0.95 - 0.022 * L + rank.sloppy, 0.12, 0.95), greedy = !!fam.greedy, glow = false, spikes = false;
    for (const id of mods) {
        const m = MODS[id];
        hp *= m.hp || 1; dmg *= m.dmg || 1; power *= m.power || 1; xp *= m.xp || 1; gold *= m.gold || 1;
        scale *= m.scale || 1; shield += m.shield || 0; ward += m.ward || 0; thorns += m.thorns ? m.thorns + Math.floor(L / 6) : 0;
        startMana += m.startMana || 0; sloppy = clamp(sloppy + (m.sloppy || 0), 0.08, 1);
        greedy = greedy || !!m.greedy; glow = glow || !!m.glow; spikes = spikes || !!m.spikes;
    }
    if (opt.rank === 'keeper' || opt.rank === 'guardian' || opt.rank === 'final') scale *= opt.rank === 'final' ? 1.6 : 1.35;

    const spellIds = [];
    const fsp = fam.spells.slice();
    if (opt.signature) spellIds.push(opt.signature);
    for (const s of fsp) if (spellIds.length < rank.spells && !spellIds.includes(s)) spellIds.push(s);
    // Early, plain monsters only learn their first spells.
    const known = opt.rank === 'normal' && L < 4 ? spellIds.slice(0, 1) : spellIds;

    const name = opt.name || `${monsterName(rng)} the ${mods.length ? MODS[mods[0]].name + ' ' : ''}${rng.pick(fam.nouns)}`;
    const look = makeLook(rng, famId, fam, { scale, glow, spikes, boss: opt.rank !== 'normal' && opt.rank !== 'elite' });
    const manaCap = Math.round(14 + L * 0.45 + (opt.rank === 'final' ? 6 : 0));
    const mana = { fire: 0, water: 0, leaf: 0, spark: 0 };
    if (startMana) mana[fam.color] = startMana;
    if (opt.rank === 'keeper' || opt.rank === 'guardian' || opt.rank === 'final') for (const m of MANA) mana[m] = 3;

    const side = {
        name, isPlayer: false, level: L,
        maxHp: Math.round(hp), hp: Math.round(hp), shield, ward: Math.min(0.4, ward), thorns,
        skullDmg: Math.max(1, Math.round(dmg * 10) / 10), crit: 0.04, spellPower: power,
        manaCap, mana, manaPer: {}, color: fam.color,
        spells: known.map((id) => ({ id, rank: 1, def: MSPELLS[id] })),
        buffs: [], greedy, sloppy, weak: fam.weak, resist: opt.resist || fam.resist,
    };
    return {
        name, family: famId, familyName: fam.name, level: L, rank: opt.rank || 'normal', mods, look, side,
        xp: Math.round(xp), gold: Math.round(gold), weak: fam.weak, resist: opt.resist || fam.resist, boss: rank !== RANK.normal && rank !== RANK.elite,
    };
}

function makeLook(rng, famId, fam, o) {
    const hue = (rng.pick(fam.hues) + rng.range(-0.04, 0.04) + 1) % 1;
    return {
        plan: fam.plan, family: famId,
        hue, hue2: (hue + rng.range(0.08, 0.5)) % 1,
        sat: rng.range(0.55, 0.9), light: rng.range(0.45, 0.62),
        eyes: rng.weighted([[1, 2], [2, 6], [3, 1.5]]),
        eyeSize: rng.range(0.85, 1.35),
        horns: rng.weighted([[0, 3], [1, 1], [2, 2]]),
        ears: rng.chance(0.4),
        tail: rng.chance(0.5),
        mouth: rng.pick(['smile', 'fangs', 'grin', 'o']),
        spots: rng.chance(0.4),
        crown: o.boss,
        scale: o.scale, glow: o.glow || o.boss, spikes: o.spikes,
        ink: !!fam.ink,
        seed: rng.int(1, 1e9),
    };
}

/**
 * items.js — procedural gear.
 *
 * An item is { uid, slot, cls, base, name, iL, rarity, mods } where mods is a flat map of
 * bonuses: stat keys (might…fortune), maxHp, ward, skullPct, spellPct, goldPct, xpPct,
 * critPct, lifesteal, thorns, haste, and per-colour keys 'manaPer.fire' / 'startMana.leaf'.
 */

import { clamp } from './rng.js';
import { MANA } from './data.js';

export const SLOTS = ['weapon', 'armor', 'charm', 'tome'];
export const SLOT_INFO = {
    weapon: { name: 'Weapon', icon: '🗡️' },
    armor:  { name: 'Armor',  icon: '🥋' },
    charm:  { name: 'Charm',  icon: '📿' },
    tome:   { name: 'Tome',   icon: '📘' },
};

const BASES = {
    weapon: { mage: ['Wand', 'Staff', 'Rod', 'Scepter', 'Orb'], warrior: ['Sword', 'Axe', 'Hammer', 'Spear', 'Mace'] },
    armor:  { mage: ['Robe', 'Mantle', 'Cloak', 'Vestments'], warrior: ['Mail', 'Plate', 'Brigandine', 'Cuirass'] },
    charm:  { mage: ['Amulet', 'Ring', 'Talisman', 'Brooch'], warrior: ['Amulet', 'Ring', 'Medallion', 'Signet'] },
    tome:   { mage: ['Grimoire', 'Codex', 'Folio', 'Spellbook'], warrior: ['Battle Manual', 'War Journal', 'Field Guide', 'Almanac'] },
};
const MATERIALS = ['Twig', 'Oak', 'Iron', 'Silver', 'Mithril', 'Starsteel', 'Aurora', 'Lumen'];
const SOFT = ['Homespun', 'Linen', 'Velvet', 'Silk', 'Moonweave', 'Starcloth', 'Aurora', 'Lumen'];

export const RARITIES = [
    { id: 'common',    name: 'Common',    color: '#d8dde6', affixes: 0, value: 1 },
    { id: 'magic',     name: 'Magic',     color: '#5ab8ff', affixes: 1, value: 1.6 },
    { id: 'rare',      name: 'Rare',      color: '#ffd23a', affixes: 2, value: 2.6 },
    { id: 'epic',      name: 'Epic',      color: '#c77dff', affixes: 3, value: 4 },
    { id: 'legendary', name: 'Legendary', color: '#ff8a3a', affixes: 4, value: 7 },
];

export const AFFIXES = {
    might:     { name: 'Might',         pre: 'Mighty',        suf: 'of Giants',     roll: (L) => 1 + L * 0.22, int: true },
    arcana:    { name: 'Arcana',        pre: 'Arcane',        suf: 'of Sages',      roll: (L) => 1 + L * 0.22, int: true },
    vitality:  { name: 'Vitality',      pre: 'Hearty',        suf: 'of the Bear',   roll: (L) => 1 + L * 0.22, int: true },
    focus:     { name: 'Focus',         pre: 'Focused',       suf: 'of the Owl',    roll: (L) => 1 + L * 0.2, int: true },
    fortune:   { name: 'Fortune',       pre: 'Lucky',         suf: 'of Clover',     roll: (L) => 1 + L * 0.2, int: true },
    maxHp:     { name: 'Max HP',        pre: 'Sturdy',        suf: 'of Vigor',      roll: (L) => 5 + L * 1.8, int: true },
    ward:      { name: 'Ward',          pre: 'Warded',        suf: 'of Shelter',    roll: (L) => 0.02 + L * 0.0018, pct: true },
    skullPct:  { name: 'Skull damage',  pre: 'Skullsplitting',suf: 'of Bones',      roll: (L) => 0.05 + L * 0.004, pct: true },
    spellPct:  { name: 'Spell power',   pre: 'Spellwoven',    suf: 'of Wonders',    roll: (L) => 0.05 + L * 0.005, pct: true },
    goldPct:   { name: 'Gold found',    pre: 'Gilded',        suf: 'of Plenty',     roll: (L) => 0.08 + L * 0.006, pct: true },
    xpPct:     { name: 'XP gained',     pre: 'Studious',      suf: 'of Learning',   roll: (L) => 0.06 + L * 0.005, pct: true },
    critPct:   { name: 'Skull crit',    pre: 'Keen',          suf: 'of Precision',  roll: (L) => 0.02 + L * 0.0012, pct: true },
    lifesteal: { name: 'Lifesteal',     pre: 'Vampiric',      suf: 'of the Leech',  roll: (L) => 0.04 + L * 0.002, pct: true },
    thorns:    { name: 'Thorns',        pre: 'Thorned',       suf: 'of Brambles',   roll: (L) => 1 + L * 0.15, int: true },
    haste:     { name: 'Extra-turn chance', pre: 'Swift',     suf: 'of the Hare',   roll: (L) => 0.03 + L * 0.0008, pct: true },
    'manaPer': { name: 'mana per match', pre: null,           suf: null,            roll: (L) => (L < 18 ? 1 : 2), int: true, color: true },
    'startMana': { name: 'starting mana', pre: null,          suf: null,            roll: (L) => 2 + L * 0.15, int: true, color: true },
};
const COLOR_WORD = { fire: ['Blazing', 'of Embers'], water: ['Tidal', 'of the Deep'], leaf: ['Verdant', 'of the Grove'], spark: ['Crackling', 'of Storms'] };
const AFFIX_IDS = Object.keys(AFFIXES);

export function rollRarity(rng, luck = 0) {
    const w = [[0, 52 - luck * 20], [1, 30], [2, 13 + luck * 8], [3, 4 + luck * 4], [4, 0.8 + luck * 2]];
    return rng.weighted(w.map(([i, x]) => [i, Math.max(0.1, x)]));
}

export function makeItem(rng, opt) {
    const slot = opt.slot || rng.pick(SLOTS);
    const cls = opt.cls;
    const iL = Math.max(1, Math.round(opt.iL));
    const r = opt.rarity ?? rollRarity(rng, opt.luck || 0);
    const rar = RARITIES[r];
    const base = rng.pick(BASES[slot][cls]);
    const tier = clamp(Math.floor((iL - 1) / 6), 0, MATERIALS.length - 1);
    const mods = {};
    const add = (k, v) => { mods[k] = (mods[k] || 0) + v; };
    // Implicit base bonus by slot.
    if (slot === 'weapon') add(cls === 'mage' ? 'arcana' : 'might', Math.round(1 + iL * 0.32));
    if (slot === 'armor') { add('maxHp', Math.round(4 + iL * 2.2)); add('ward', round3(0.015 + iL * 0.0015)); }
    if (slot === 'charm') add(rng.chance(0.5) ? 'fortune' : 'focus', Math.round(1 + iL * 0.18));
    if (slot === 'tome') { add('spellPct', round3(0.04 + iL * 0.004)); add('startMana.' + rng.pick(MANA), Math.round(1 + iL / 8)); }

    const picked = [];
    const pool = AFFIX_IDS.slice();
    rng.shuffle(pool);
    for (const id of pool) {
        if (picked.length >= rar.affixes) break;
        if (cls === 'warrior' && id === 'arcana') continue;
        if (cls === 'mage' && id === 'might' && rng.chance(0.7)) continue;
        const a = AFFIXES[id];
        let key = id, color = null;
        if (a.color) { color = rng.pick(MANA); key = `${id}.${color}`; }
        let v = a.roll(iL) * rng.range(0.85, 1.15) * (1 + r * 0.06);
        v = a.int ? Math.max(1, Math.round(v)) : round3(v);
        add(key, v);
        picked.push({ id, color });
    }
    // Name: [prefix] [material] [base] [suffix]
    const mat = slot === 'armor' && cls === 'mage' ? SOFT[tier] : slot === 'charm' || slot === 'tome' ? null : MATERIALS[tier];
    let pre = '', suf = '';
    if (picked[0]) pre = picked[0].color ? COLOR_WORD[picked[0].color][0] : AFFIXES[picked[0].id].pre;
    if (picked[1]) suf = picked[1].color ? COLOR_WORD[picked[1].color][1] : AFFIXES[picked[1].id].suf;
    let name = [pre, mat, base, suf].filter(Boolean).join(' ');
    if (r === 4) name = `${rng.pick(LEGEND_OWNERS)}'s ${mat ? mat + ' ' : ''}${base}`;
    return { uid: opt.uid, slot, cls, base, name, iL, rarity: r, mods, value: Math.round((6 + iL * 4) * rar.value) };
}

const LEGEND_OWNERS = ['Hootsworth', 'Queen Marigold', 'Barnaby Bookbinder', 'the First Reader', 'Sir Inkwell', 'Archmage Tumble', 'Lady Ledger', 'Old Margin', 'Captain Quarto', 'Saint Folio'];

const round3 = (v) => Math.round(v * 1000) / 1000;

/** Human-readable lines for a mods map. */
export function modLines(mods) {
    const out = [];
    for (const [k, v] of Object.entries(mods)) {
        const [id, color] = k.split('.');
        const a = AFFIXES[id];
        if (!a) continue;
        const val = a.pct ? `+${Math.round(v * 1000) / 10}%` : `+${v}`;
        if (color) out.push(`${val} ${color[0].toUpperCase() + color.slice(1)} ${a.name}`);
        else out.push(`${val} ${a.name}`);
    }
    return out;
}

/** Rough usefulness for a class (auto-equip, the bot, and the green/red compare arrows). */
export function itemScore(item, cls) {
    if (!item) return 0;
    const w = cls === 'mage'
        ? { might: 0.4, arcana: 3.2, vitality: 2, focus: 2.2, fortune: 1.2, maxHp: 0.33, ward: 60, skullPct: 18, spellPct: 50, goldPct: 6, xpPct: 8, critPct: 25, lifesteal: 30, thorns: 1.2, haste: 90, manaPer: 4, startMana: 0.8 }
        : { might: 3.2, arcana: 0.2, vitality: 2.4, focus: 1.6, fortune: 1.2, maxHp: 0.4, ward: 70, skullPct: 45, spellPct: 18, goldPct: 6, xpPct: 8, critPct: 35, lifesteal: 45, thorns: 1.8, haste: 90, manaPer: 3.5, startMana: 0.7 };
    let s = 0;
    for (const [k, v] of Object.entries(item.mods)) s += (w[k.split('.')[0]] || 0) * v;
    return Math.round(s * 10) / 10;
}

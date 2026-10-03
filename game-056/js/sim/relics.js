/**
 * relics.js — procedural relics (pick one of three between waves) and the
 * aggregation of relics + Ember perks into one modifier table.
 *
 * A relic is: rarity, 1–2 stat affixes rolled from STATS (magnitude by
 * rarity), and for legendaries one unique effect. The name is assembled from
 * the affixes and a noun by rarity; the icon is drawn by the UI from
 * {noun, colours}.
 *
 * Pure: no three.js, no DOM, no Math.random.
 */

import { makeRng, hashSeed } from './rng.js';
import { RARITIES, UNITS, UNIT_ORDER, DMG_TYPES } from '../config.js';

/** v: magnitude (percent) by rarity index. */
const STATS = {
    dmg:      { w: 10, v: [6, 10, 15, 22],  text: (v) => `+${v}% party damage`, adj: ['Valiant', 'Fierce', 'Warlike'], suf: 'of Valour', color: '#ff6a4a' },
    rate:     { w: 8,  v: [5, 8, 12, 16],   text: (v) => `+${v}% attack speed`, adj: ['Swift', 'Quickened', 'Hasty'], suf: 'of Swiftness', color: '#7affd0' },
    gold:     { w: 8,  v: [8, 13, 20, 30],  text: (v) => `+${v}% gold from foes`, adj: ['Gilded', 'Golden', 'Rich'], suf: 'of Plenty', color: '#ffd24a' },
    wallhp:   { w: 7,  v: [8, 13, 20, 30],  text: (v) => `+${v}% wall strength`, adj: ['Stalwart', 'Granite', 'Unyielding'], suf: 'of the Rampart', color: '#c8b89a' },
    crit:     { w: 6,  v: [3, 5, 8, 11],    text: (v) => `+${v}% critical chance`, adj: ['Keen', 'Precise', 'Deadly'], suf: 'of the Hawk', color: '#ff3a6a' },
    critdmg:  { w: 5,  v: [15, 25, 40, 55], text: (v) => `+${v}% critical damage`, adj: ['Cruel', 'Savage', 'Brutal'], suf: 'of Ruin', color: '#ff2a2a' },
    unithp:   { w: 6,  v: [10, 16, 25, 35], text: (v) => `+${v}% party health`, adj: ['Hale', 'Hardy', 'Sturdy'], suf: 'of Fortitude', color: '#6aff6a' },
    splash:   { w: 4,  v: [8, 12, 18, 25],  text: (v) => `+${v}% blast radius`, adj: ['Thundering', 'Booming', 'Roaring'], suf: 'of the Blast', color: '#ff9a2a' },
    slow:     { w: 4,  v: [8, 12, 18, 25],  text: (v) => `+${v}% slow strength`, adj: ['Chilling', 'Numbing', 'Wintry'], suf: 'of Stillness', color: '#8fd8ff' },
    recharge: { w: 5,  v: [5, 8, 12, 16],   text: (v) => `−${v}% card recharge`, adj: ['Ready', 'Eager', 'Restless'], suf: 'of Haste', color: '#e8e8ff' },
    cost:     { w: 4,  v: [4, 6, 9, 12],    text: (v) => `−${v}% party cost`, adj: ['Thrifty', 'Frugal', 'Shrewd'], suf: 'of the Miser', color: '#d8c86a' },
    drop:     { w: 4,  v: [15, 25, 40, 60], text: (v) => `+${v}% powerup drops`, adj: ['Lucky', 'Fortunate', 'Charmed'], suf: 'of Fortune', color: '#ff8aff' },
    keepfire: { w: 3,  v: [10, 16, 25, 35], text: (v) => `+${v}% Keepfire charge`, adj: ['Smouldering', 'Kindled', 'Blazing'], suf: 'of the Hearth', color: '#ffaa2a' },
    unit:     { w: 9,  v: [12, 20, 30, 45], text: (v, k) => `+${v}% ${UNITS[k].name} damage`, adj: ['Sworn', 'Favoured', 'Blessed'], suf: 'of the Company', color: '#e8dcc0' },
    elem:     { w: 7,  v: [10, 16, 25, 35], text: (v, k) => `+${v}% ${DMG_TYPES[k].name.toLowerCase()} damage`, adj: null, suf: null, color: null },
};
const ELEM_WORDS = {
    phys: { adj: ['Iron', 'Steel', 'Honed'], suf: 'of Steel', color: '#e8dcc0' },
    fire: { adj: ['Ashen', 'Burning', 'Infernal'], suf: 'of Cinders', color: '#ff6a2a' },
    frost: { adj: ['Frozen', 'Rimed', 'Glacial'], suf: 'of the North', color: '#8fd8ff' },
    shock: { adj: ['Crackling', 'Stormy', 'Galvanic'], suf: 'of Thunder', color: '#c9a8ff' },
    holy: { adj: ['Hallowed', 'Radiant', 'Sainted'], suf: 'of Dawn', color: '#ffe680' },
};

export const UNIQUES = {
    flamefletch: { name: 'Flamefletch', text: 'Archer arrows set foes alight' },
    bulwark:     { name: 'Bulwark Oath', text: 'Blockers reflect 30% of melee damage' },
    cluster:     { name: 'Cluster Kegs', text: 'Dwarf barrels always burst into bomblets' },
    emberheart:  { name: 'Ember Heart', text: 'Fireballs leave burning ground' },
    winter:      { name: "Winter's Grip", text: 'Slowed foes take +25% damage' },
    stormglass:  { name: 'Stormglass', text: 'Chain lightning jumps 2 more times' },
    phoenix:     { name: 'Phoenix Feather', text: 'Once a wave the wall survives a lethal blow' },
    huntmark:    { name: "Hunter's Mark", text: 'The first hit on each foe deals double' },
    secondwind:  { name: 'Second Wind', text: 'The party regenerates 2% health a second' },
    warhorn:     { name: 'Warhorn of Aldmere', text: 'Every wave opens with a Rally Horn' },
    ledger:      { name: 'Gilded Ledger', text: 'Treasury interest doubled, cap raised' },
    treasure:    { name: 'Treasure Sense', text: 'A loot-laden carrier every wave' },
};

const NOUNS = [
    ['Charm', 'Token', 'Trinket', 'Ring', 'Brooch'],
    ['Sigil', 'Talisman', 'Amulet', 'Rune', 'Idol'],
    ['Grimoire', 'Chalice', 'Lantern', 'Horn', 'Banner'],
    ['Crown', 'Heart', 'Feather', 'Crest', 'Codex'],
];

function rollRarity(rng, wave, minRarity = 0) {
    const luck = Math.min(1, wave / 60);
    const w = [60 - 25 * luck, 28 + 6 * luck, 10 + 12 * luck, 2 + 7 * luck];
    let r = rng.next() * (w[0] + w[1] + w[2] + w[3]);
    let i = 0;
    for (; i < 3; i++) { r -= w[i]; if (r <= 0) break; }
    return Math.max(i, minRarity);
}

function rollStat(rng, rarity, taken, unlocked) {
    const keys = Object.keys(STATS).filter((k) => !taken.has(k));
    const w = {};
    for (const k of keys) w[k] = STATS[k].w;
    const stat = rng.weighted(w);
    let key = null;
    if (stat === 'unit') key = rng.pick(unlocked.filter((u) => u !== 'palisade' && u !== 'alchemist').length ? unlocked.filter((u) => u !== 'palisade' && u !== 'alchemist') : ['archer']);
    if (stat === 'elem') key = rng.pick(Object.keys(DMG_TYPES));
    const v = STATS[stat].v[rarity];
    return { stat, key, v };
}

function words(a) {
    if (a.stat === 'elem') return ELEM_WORDS[a.key];
    return STATS[a.stat];
}

/** Generate one relic. */
export function genRelic(rng, wave, unlocked, minRarity = 0) {
    const rarity = rollRarity(rng, wave, minRarity);
    const taken = new Set();
    const affixes = [];
    const n = rarity === 0 ? 1 : 2;
    for (let i = 0; i < n; i++) {
        const a = rollStat(rng, rarity, taken, unlocked);
        taken.add(a.stat);
        affixes.push(a);
    }
    let unique = null;
    if (rarity === 3) {
        affixes.pop();
        unique = rng.pick(Object.keys(UNIQUES));
    }
    const noun = rng.pick(NOUNS[rarity]);
    const w0 = words(affixes[0]);
    const name = unique
        ? `${UNIQUES[unique].name}`
        : affixes.length > 1
            ? `${rng.pick(w0.adj)} ${noun} ${words(affixes[1]).suf}`
            : `${rng.pick(w0.adj)} ${noun}`;
    const colors = [w0.color, affixes[1] ? words(affixes[1]).color : RARITIES[rarity].color];
    return {
        id: hashSeed(Math.floor(rng.next() * 1e9), wave) >>> 0,
        name, noun, rarity, affixes, unique, colors, wave,
    };
}

/** Three (or four) choices, distinct by name; boss waves offer epic or better. */
export function genRelicChoices(seed, wave, unlocked, count = 3, boss = false) {
    const rng = makeRng(hashSeed(seed, wave, 0x2e11c));
    const out = [];
    const names = new Set();
    for (let guard = 0; out.length < count && guard < 40; guard++) {
        const r = genRelic(rng, wave, unlocked, boss ? 2 : 0);
        if (names.has(r.name)) continue;
        names.add(r.name);
        out.push(r);
    }
    return out;
}

export function relicLines(relic) {
    const lines = relic.affixes.map((a) => STATS[a.stat].text(a.v, a.key));
    if (relic.unique) lines.unshift(UNIQUES[relic.unique].text);
    return lines;
}

/** Fold relics and Ember ranks into one modifier table. Fractions, not percents. */
export function aggregateMods(relics, ember = {}) {
    const m = {
        dmg: 0, rate: 0, gold: 0, wallhp: 0, crit: 0, critdmg: 0, unithp: 0, splash: 0, slow: 0,
        recharge: 0, cost: 0, drop: 0, keepfire: 0, unit: {}, elem: {}, uniques: new Set(),
    };
    for (const k of UNIT_ORDER) m.unit[k] = 0;
    for (const k of Object.keys(DMG_TYPES)) m.elem[k] = 0;
    for (const r of relics) {
        for (const a of r.affixes) {
            const f = a.v / 100;
            if (a.stat === 'unit') m.unit[a.key] += f;
            else if (a.stat === 'elem') m.elem[a.key] += f;
            else m[a.stat] += f;
        }
        if (r.unique) m.uniques.add(r.unique);
    }
    m.dmg += 0.06 * (ember.hymns ?? 0);
    m.gold += 0.06 * (ember.prospect ?? 0);
    m.recharge += 0.06 * (ember.hands ?? 0);
    m.drop += 0.15 * (ember.scavenge ?? 0);
    m.wallhp += 0.08 * (ember.stones ?? 0);
    m.cost = Math.min(0.5, m.cost);
    m.recharge = Math.min(0.6, m.recharge);
    return m;
}

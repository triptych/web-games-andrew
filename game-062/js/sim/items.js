// Loot: item generation, names, prices and the monster drop table.

import { WEAPON_BASES, ARMOR_BASES, TRINKET_BASES, SLOT_OF_KIND, TWO_HANDED, PREFIXES, SUFFIXES, LEGENDARIES } from './data/items.js';
import { CLASSES } from './data/classes.js';
import { RARITY } from '../config.js';

let uid = 1;
export const nextUid = () => uid++;
export const bumpUid = (n) => { if (n >= uid) uid = n + 1; };

const lerp = (a, b, t) => a + (b - a) * t;
const affixRange = (af, ilvl) => {
    const t = Math.min(1, Math.max(0, (ilvl - 1) / 49));
    return [Math.round(lerp(af.a[0], af.b[0], t)), Math.round(lerp(af.a[1], af.b[1], t))];
};

function pickBase(rng, list, ilvl) {
    const ok = list.filter((b) => b[0] <= Math.max(1, ilvl));
    if (!ok.length) return list[0];
    const top = ok.slice(-3);
    // Favour the newest tier you qualify for, but older tiers still drop.
    return rng.weighted(top.map((b, i) => [b, i === top.length - 1 ? 5 : i === top.length - 2 ? 3 : 1]));
}

/** Pick a drop kind. Weapons and offhands lean 65% toward the hero's class. */
export function rollKind(rng, cls) {
    const c = CLASSES[cls] || CLASSES.knight;
    const k = rng.weighted({ weapon: 24, offhand: 9, head: 11, body: 11, hands: 9, feet: 9, neck: 5, ring: 7 });
    if (k === 'weapon') {
        if (rng.chance(0.65)) return rng.pick(c.weapons);
        return rng.pick(['melee1', 'melee2', 'bow', 'wand', 'staff']);
    }
    if (k === 'offhand') return rng.chance(0.65) ? rng.pick(c.offhands) : rng.pick(['shield', 'pouch', 'orb']);
    return k;
}

export function rollRarity(rng, mf = 0, boost = 1) {
    const eff = (mf * 250) / (mf + 250);
    const m = (1 + eff / 100) * boost;
    const r = rng.next();
    if (r < 0.007 * m) return 'legendary';
    if (r < 0.07 * m) return 'rare';
    if (r < 0.3 * Math.min(2.2, m)) return 'magic';
    return 'normal';
}

const RARE_A = ['Sour', 'Bitter', 'Tart', 'Grim', 'Wild', 'Dread', 'Mellow', 'Spiced', 'Candied', 'Pickled', 'Brined', 'Glazed', 'Rotten', 'Sugared', 'Feral', 'Smoky', 'Tangy', 'Crisp'];
const RARE_B = {
    weapon: ['Bite', 'Slicer', 'Thwack', 'Chopper', 'Edge', 'Whisk', 'Spike', 'Squisher', 'Peeler', 'Fang'],
    offhand: ['Ward', 'Guard', 'Lid', 'Sack', 'Bauble', 'Orb', 'Shell'],
    head: ['Cap', 'Crown', 'Dome', 'Visor', 'Lid', 'Stem'],
    body: ['Rind', 'Husk', 'Peel', 'Shell', 'Wrap', 'Hide'],
    hands: ['Grip', 'Claws', 'Mitts', 'Fists', 'Pinch'],
    feet: ['Stride', 'Treads', 'Hoppers', 'Soles', 'Skippers'],
    neck: ['Charm', 'Locket', 'Choker', 'Talisman'],
    ring: ['Loop', 'Band', 'Circle', 'Coil', 'Twist'],
};

export function makeItem(rng, kind, ilvl, rarity, opts = {}) {
    const slot = SLOT_OF_KIND[kind];
    const it = { id: nextUid(), kind, slot, ilvl, rarity, affixes: [], identified: true };
    if (WEAPON_BASES[kind]) {
        const b = opts.baseName ? WEAPON_BASES[kind].find((x) => x[1] === opts.baseName) || pickBase(rng, WEAPON_BASES[kind], ilvl) : pickBase(rng, WEAPON_BASES[kind], ilvl);
        const q = 1 + Math.max(0, ilvl - b[0]) * 0.025;   // a little growth inside a tier
        it.base = b[1]; it.lvl = b[0]; it.dmg = [Math.round(b[2] * q), Math.round(b[3] * q)]; it.aps = b[4];
        it.twoHanded = TWO_HANDED.has(kind);
    } else if (ARMOR_BASES[kind] || ARMOR_BASES[slot]) {
        const list = ARMOR_BASES[kind] || ARMOR_BASES[slot];
        const b = opts.baseName ? list.find((x) => x[1] === opts.baseName) || pickBase(rng, list, ilvl) : pickBase(rng, list, ilvl);
        const q = 1 + Math.max(0, ilvl - b[0]) * 0.03;
        it.base = b[1]; it.lvl = b[0]; it.armor = Math.round(b[2] * q * rng.range(0.9, 1.1));
    } else {
        const list = TRINKET_BASES[kind];
        const b = opts.baseName ? list.find((x) => x[1] === opts.baseName) || pickBase(rng, list, ilvl) : pickBase(rng, list, ilvl);
        it.base = b[1]; it.lvl = b[0]; it.implicit = { [b[2]]: Math.round(b[3] * (1 + Math.max(0, ilvl - b[0]) * 0.03)) };
    }
    // Jewellery is never plain.
    if (rarity === 'normal' && (kind === 'ring' || kind === 'neck')) it.rarity = rarity = 'magic';

    if (rarity === 'legendary') {
        const pool = LEGENDARIES.filter((l) => (opts.legendary ? l.id === opts.legendary : !l.questOnly && l.minLvl <= ilvl && (!opts.kind || l.kind === kind)));
        const L = pool.length ? rng.pick(pool) : null;
        if (!L) return makeItem(rng, kind, ilvl, 'rare', opts);
        if (L.kind !== kind) return makeItem(rng, L.kind, ilvl, 'legendary', { ...opts, legendary: L.id });
        const fixed = makeItem(rng, L.kind, Math.max(ilvl, L.minLvl), 'normal', { baseName: L.base });
        Object.assign(it, fixed, { id: it.id, rarity: 'legendary', legendary: L.id, name: L.name, flavour: L.flavour, affixes: [] });
        const t = Math.min(1, Math.max(0, (ilvl - 1) / 45));
        for (const [s, [a, b]] of Object.entries(L.stats)) it.affixes.push({ s, v: Math.round(lerp(a, b, t) * rng.range(0.92, 1.0)) || a });
        it.lvl = Math.max(it.lvl, Math.min(ilvl, Math.round(ilvl * 0.85)));
    } else if (rarity === 'magic' || rarity === 'rare') {
        const nPre = rarity === 'magic' ? rng.int(0, 1) : rng.int(1, 3);
        let nSuf = rarity === 'magic' ? rng.int(nPre ? 0 : 1, 1) : rng.int(1, 3);
        if (rarity === 'rare' && nPre + nSuf < 3) nSuf = 3 - nPre;
        const used = new Set();
        const take = (pool, n, pre) => {
            for (let i = 0; i < n; i++) {
                const opts2 = pool.filter((a) => (a.slots === '*' || a.slots.includes(slot) || a.slots.includes(kind)) && !used.has(a.s) && (!a.min || a.min <= ilvl));
                if (!opts2.length) return;
                const af = rng.weighted(opts2.map((a) => [a, a.w]));
                used.add(af.s);
                const [lo, hi] = affixRange(af, ilvl);
                it.affixes.push({ s: af.s, v: rng.int(lo, Math.max(lo, hi)), n: af.n, pre });
            }
        };
        take(PREFIXES, nPre, true);
        take(SUFFIXES, nSuf, false);
        it.lvl = Math.max(it.lvl, Math.round(ilvl * 0.82));
        if (rarity === 'rare') it.name = `${rng.pick(RARE_A)} ${rng.pick(RARE_B[slot] || RARE_B.weapon)}`;
    }
    it.lvl = Math.max(1, Math.min(it.lvl, 48));
    if (rarity === 'rare' || rarity === 'legendary') it.identified = !!opts.identified;
    finishItem(it);
    return it;
}

/** Name, value; call again after identification. */
export function finishItem(it) {
    if (it.rarity === 'magic') {
        const pre = it.affixes.find((a) => a.pre), suf = it.affixes.find((a) => !a.pre);
        it.name = `${pre ? pre.n + ' ' : ''}${it.base}${suf ? ' ' + suf.n : ''}`;
    } else if (it.rarity === 'normal') it.name = it.base;
    const r = RARITY[it.rarity] || RARITY.normal;
    it.value = Math.max(1, Math.round((6 + it.ilvl * 3.2 + it.affixes.length * 4) * r.mult * (it.slot === 'weapon' ? 1.25 : 1)));
    return it;
}

export function displayName(it) {
    if (!it.identified) return `Unidentified ${it.base}`;
    return it.name;
}

/** Item stats as a flat { stat: value } (affixes + implicit), excluding base damage / armour. */
export function itemStats(it) {
    const s = {};
    if (it.implicit) for (const [k, v] of Object.entries(it.implicit)) s[k] = (s[k] || 0) + v;
    if (it.identified) for (const a of it.affixes) s[a.s] = (s[a.s] || 0) + a.v;
    return s;
}

export const sellPrice = (it) => Math.max(1, Math.round(it.value * (it.identified ? 0.25 : 0.12)));
export const buyPrice = (it) => Math.round(it.value * 1.6);

/** Monster drops. Returns { items, sugar, potions } — the world places them on the floor. */
export function rollDrops(rng, mon, hero, mf) {
    const out = { items: [], sugar: 0, potion: null };
    const lvl = mon.lvl;
    let nItems = 0, boost = 1;
    if (mon.boss) { nItems = 4 + rng.int(0, 2); boost = 4; }
    else if (mon.elite === 'unique' || mon.elite === 'quest') { nItems = 2 + rng.int(0, 1); boost = 2.5; }
    else if (mon.elite === 'champion') { nItems = rng.chance(0.75) ? 1 : 0; boost = 1.8; }
    else if (mon.type === 'mimic') { nItems = 2; boost = 2.5; }
    else nItems = rng.chance(0.11) ? 1 : 0;
    for (let i = 0; i < nItems; i++) {
        let rarity = rollRarity(rng, mf, boost);
        if (mon.boss && i === 0) rarity = rng.chance(0.3) ? 'legendary' : 'rare';
        if (mon.boss && i === 1 && rarity === 'normal') rarity = 'magic';
        out.items.push(makeItem(rng, rollKind(rng, hero.cls), lvl, rarity));
    }
    const sugarChance = mon.boss ? 1 : mon.elite ? 0.9 : 0.3;
    if (rng.chance(sugarChance)) out.sugar = Math.round((3 + lvl * 2.2) * rng.range(0.6, 1.4) * (mon.boss ? 12 : mon.elite ? 3 : 1));
    if (rng.chance(mon.boss ? 1 : mon.elite ? 0.4 : 0.07)) out.potion = rng.chance(0.62) ? 'hp' : rng.chance(0.75) ? 'juice' : 'pie';
    return out;
}

/** Breakable / chest contents. */
export function rollContainer(rng, type, lvl, hero, mf) {
    const out = { items: [], sugar: 0, potion: null };
    const big = type === 'bigchest';
    const chest = type === 'chest' || big;
    const nItems = big ? rng.int(2, 3) : chest ? rng.int(1, 2) : rng.chance(0.08) ? 1 : 0;
    for (let i = 0; i < nItems; i++) out.items.push(makeItem(rng, rollKind(rng, hero.cls), lvl, rollRarity(rng, mf, big ? 2.5 : chest ? 1.6 : 1)));
    if (rng.chance(chest ? 0.9 : 0.28)) out.sugar = Math.round((2 + lvl * 1.8) * rng.range(0.5, 1.5) * (big ? 4 : chest ? 2 : 1));
    if (rng.chance(chest ? 0.5 : 0.12)) out.potion = rng.chance(0.6) ? 'hp' : rng.chance(0.75) ? 'juice' : 'pie';
    return out;
}

/** Shop stock. kind: 'smith' | 'oracle' | 'granny' */
export function shopStock(rng, kind, lvl, cls) {
    const items = [];
    const c = CLASSES[cls];
    const n = kind === 'granny' ? 0 : 14;
    for (let i = 0; i < n; i++) {
        let k;
        if (kind === 'smith') k = i < 6 ? rng.pick(c.weapons.concat(c.offhands)) : rng.pick(['head', 'body', 'hands', 'feet', 'shield', 'melee1', 'melee2', 'bow']);
        else k = i < 5 ? rng.pick(['wand', 'staff', 'orb', 'pouch']) : rng.pick(['ring', 'neck', 'ring', 'neck', 'head', 'orb']);
        const rar = rng.chance(0.08) ? 'rare' : rng.chance(0.55) ? 'magic' : 'normal';
        const it = makeItem(rng, k, Math.max(1, lvl + rng.int(-1, 2)), rar, { identified: true });
        it.identified = true; finishItem(it);
        items.push(it);
    }
    return items;
}

// GIANT'S VAULT: item generation, names, prices, gems and drops. Pure.
// Items live once in G.items[id]; the bag, the equipment, the pet and the floor hold ids.

import { ITEM, GLOBE } from '../config.js';
import { weighted } from '../rng.js';
import { lastFit } from './world.js';
import {
    BASES, BASE_LIST, WEAPONS, BASE_NAMES, AFFIXES, AFFIX_LIST, RARITIES, LEGENDARIES, SETS, GEMS, GEM_LIST, GEM_GRADES, MAX_SOCKETS,
} from './data/items.js';
import { MASTERIES } from './data/masteries.js';

export const slotOf = (baseId) => BASES[baseId]?.slot;
const slotFits = (a, slot) => a.slots === 'any' || a.slots.includes(slot) || (a.slots.includes('jewel') && (slot === 'amulet' || slot === 'ring'));

/** Rarity weights after magic find (diminishing: mf' = mf·100/(mf+100)) and the rift tier (mythics from tier 5). */
export function rarityWeights(mf = 0, riftTier = 0) {
    const m = 1 + (mf * 100) / (mf + 100) / 100;
    const w = {};
    for (const [k, r] of Object.entries(RARITIES)) w[k] = k === 'common' ? r.weight : r.weight * m;
    if (riftTier < ITEM.mythicMinTier) w.mythic = 0;
    else w.mythic *= 1 + (riftTier - ITEM.mythicMinTier) * 0.15;
    return w;
}

function pickAffix(rng, slot, have, rarity) {
    const pre = have.filter((a) => AFFIXES[a.k].pre).length, suf = have.length - pre;
    const pool = AFFIX_LIST.filter((k) => {
        const a = AFFIXES[k];
        if (!slotFits(a, slot) || have.some((h) => h.k === k)) return false;
        if (a.pre && pre >= 3) return false;
        if (!a.pre && suf >= 3) return false;
        if (a.rare && rarity === 'magic') return false;
        return true;
    });
    if (!pool.length) return null;
    const table = {};
    for (const k of pool) table[k] = AFFIXES[k].rare ? 0.25 : 1;
    return weighted(rng, table);
}

function rollAffix(rng, k, ilvl, perfect) {
    const a = AFFIXES[k], q = perfect ? 1 : rng();
    const t = a.flat ? 1 : ITEM.tier(ilvl);
    const v = Math.max(1, Math.round((a.lo + (a.hi - a.lo) * q) * t));
    const out = { k, v: a.cap ? Math.min(a.cap, v) : v, q: Math.round(q * 100) / 100 };
    if (a.mastery) out.m = rng.pick(Object.keys(MASTERIES));
    return out;
}

function socketsFor(rng, slot, rarity) {
    const max = MAX_SOCKETS[slot] ?? 0;
    if (!max) return 0;
    if (rarity === 'mythic') return max;
    const p = { common: 0.08, magic: 0.15, rare: 0.25, set: 0.3, legendary: 0.35 }[rarity] ?? 0;
    let n = 0;
    while (n < max && rng() < p) n++;
    return n;
}

/** Make an item. opts: { rarity, base, mf, riftTier, uniq, set } — anything left out is rolled. */
export function rollItem(G, ilvl, opts = {}) {
    const rng = G.rng;
    let rarity = opts.rarity ?? weighted(rng, rarityWeights(opts.mf || 0, opts.riftTier || 0));
    let base = opts.base, uniq = opts.uniq ?? null, set = opts.set ?? null, setIdx = -1;
    if ((rarity === 'legendary' || rarity === 'mythic') && !base) {
        uniq ??= rng.pick(Object.keys(LEGENDARIES));
        base = LEGENDARIES[uniq].base;
    }
    if (rarity === 'set') {
        set ??= rng.pick(Object.keys(SETS));
        const S = SETS[set];
        setIdx = base ? S.pieces.indexOf(BASES[base].slot) : rng.int(0, S.pieces.length - 1);
        if (setIdx < 0) { rarity = 'rare'; set = null; } else base = S.pieces[setIdx] === 'amulet' ? 'amulet' : S.pieces[setIdx];
    }
    if ((rarity === 'legendary' || rarity === 'mythic') && base && !uniq) {
        const fits = Object.keys(LEGENDARIES).filter((k) => LEGENDARIES[k].base === base);
        if (fits.length) uniq = rng.pick(fits); else rarity = 'rare';
    }
    base ??= rng.pick(BASE_LIST);
    const slot = slotOf(base);
    const item = { id: G.nextId++, base, rarity, ilvl, affixes: [], sockets: [] };
    if (uniq) item.uniq = uniq;
    if (set) { item.set = set; item.setIdx = setIdx; }
    const B = BASES[base];
    if (B.dmg) {
        const s = ITEM.weaponScale(ilvl) * (0.9 + rng() * 0.2);
        item.dmg = [Math.max(1, Math.round(B.dmg[0] * s)), Math.max(2, Math.round(B.dmg[1] * s))];
        item.spd = B.spd;
    }
    if (B.armor) item.armor = Math.round(B.armor * ITEM.armorScale(ilvl) * (0.9 + rng() * 0.2));
    if (set) {
        // set pieces carry two fixed, well-rolled stats of their theme
        const theme = set === 'asters' ? ['life', 'armorPct', 'might', 'vitality'] : ['lightningPct', 'shadowPct', 'spirit', 'cunning'];
        for (const k of [theme[setIdx % 2], theme[2 + (setIdx % 2)]]) if (slotFits(AFFIXES[k], slot)) item.affixes.push(rollAffix(rng, k, ilvl, false));
    }
    const [lo, hi] = RARITIES[rarity].affixes;
    const n = rng.int(lo, hi);
    for (let t = 0; t < 40 && item.affixes.length < n + (set ? 2 : 0); t++) {
        const k = pickAffix(rng, slot, item.affixes, rarity);
        if (!k) break;
        item.affixes.push(rollAffix(rng, k, ilvl, rarity === 'mythic'));
    }
    item.sockets = new Array(socketsFor(rng, slot, rarity)).fill(null);
    item.name = itemName(G, item);
    return item;
}

export function rollGem(G, grade = 0, kind) {
    const gem = kind ?? G.rng.pick(GEM_LIST);
    const item = { id: G.nextId++, gem, grade, rarity: 'magic' };
    item.name = `${GEM_GRADES[grade]} ${GEMS[gem].name}`;
    return item;
}

function itemName(G, it) {
    if (it.uniq) return LEGENDARIES[it.uniq].name;
    if (it.set) return SETS[it.set].names[it.setIdx];
    const band = Math.min(3, Math.floor((it.ilvl - 1) / 8));
    const baseName = BASE_NAMES[it.base]?.[band] ?? BASES[it.base].name;
    if (it.rarity === 'magic') {
        const p = it.affixes.find((a) => AFFIXES[a.k].pre), s = it.affixes.find((a) => !AFFIXES[a.k].pre);
        return [p && AFFIXES[p.k].name, baseName, s && AFFIXES[s.k].name].filter(Boolean).join(' ');
    }
    if (it.rarity === 'rare') {
        const A = ['Grim', 'Storm', 'Bone', 'Dusk', 'Iron', 'Tide', 'Ash', 'Giant', 'Raven', 'Ember', 'Oath', 'Gloom'];
        const B = ['Bite', 'Song', 'Ward', 'Mark', 'Coil', 'Fang', 'Veil', 'Crest', 'Brand', 'Grasp', 'Wake', 'Thorn'];
        return `${G.rng.pick(A)} ${G.rng.pick(B)}`;
    }
    return baseName;
}

/** A line of text for each affix of an item (for the tooltip and the tests). */
export function affixText(a) {
    const A = AFFIXES[a.k];
    return A.text.replace('{v}', a.v).replace('{m}', a.m ? MASTERIES[a.m].name : '');
}

export function itemPrice(it) {
    if (it.gem) return 30 * (it.grade + 1) ** 2;
    const base = ITEM.price[it.rarity] ?? 5;
    return Math.round(base * (1 + it.ilvl / 6) * (1 + it.affixes.length * 0.15));
}
export const sellPrice = (it) => Math.max(1, Math.round(itemPrice(it) * ITEM.sellFrac));

/** What a killed monster drops. Pushes floor drops into G.drops; returns how many items. */
export function dropLoot(G, m, { mf = 0 } = {}) {
    const rng = G.rng, P = G.player;
    const riftTier = G.rift?.tier || 0;
    const boss = !!m.boss;
    let n = 0;
    if (boss) n = rng.int(ITEM.bossDrops[0], ITEM.bossDrops[1]);
    else if (m.elite) n = rng.int(ITEM.eliteDrops[0], ITEM.eliteDrops[1]) - (m.elite.minion ? 1 : 0);
    else n = rng() < ITEM.dropChance ? 1 : 0;
    const ilvl = m.lvl;
    // spread the drops in a little spiral, never into a wall
    const at = (k) => lastFit(G.area, m.x, m.y, m.x + Math.cos(k * 2.4) * (0.5 + 0.35 * k), m.y + Math.sin(k * 2.4) * (0.5 + 0.35 * k), 0.2);
    let k = 0;
    for (let i = 0; i < n; i++) {
        P.pity = (P.pity || 0);
        let rarity;
        if (boss && i === 0) rarity = rng() < 0.5 ? 'legendary' : 'rare';
        if (P.pity >= ITEM.legendaryPity) rarity = 'legendary';
        const it = rollItem(G, ilvl, { rarity, mf, riftTier });
        if (it.rarity === 'legendary' || it.rarity === 'mythic') P.pity = 0;
        G.items[it.id] = it;
        const p = at(k++);
        G.drops.push({ id: G.nextId++, item: it.id, x: p.x, y: p.y });
        G.events.push({ type: 'drop', id: it.id, rarity: it.rarity, x: p.x, y: p.y });
    }
    if (!boss) P.pity = (P.pity || 0) + 1;
    if (rng() < ITEM.gemChance * (m.elite ? 4 : 1) * (boss ? 10 : 1)) {
        const g = rollGem(G, Math.min(3, Math.floor(ilvl / 12) + (rng() < 0.2 ? 1 : 0)));
        G.items[g.id] = g;
        const p = at(k++);
        G.drops.push({ id: G.nextId++, item: g.id, x: p.x, y: p.y });
        G.events.push({ type: 'drop', id: g.id, rarity: 'magic', x: p.x, y: p.y });
    }
    if (rng() < ITEM.goldChance * (m.elite ? 3 : 1) || boss) {
        const amount = Math.round(ITEM.gold(ilvl) * (0.6 + rng() * 0.8) * (boss ? 12 : m.elite ? 3 : 1));
        const p = at(k++);
        G.drops.push({ id: G.nextId++, gold: amount, x: p.x, y: p.y });
    }
    if (rng() < (m.elite || boss ? GLOBE.eliteChance : GLOBE.chance)) {
        const p = at(k++);
        G.drops.push({ id: G.nextId++, globe: true, x: p.x, y: p.y, life: GLOBE.life });
    }
    return n;
}


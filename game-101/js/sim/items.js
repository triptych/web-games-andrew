// Procedural items: weapons, armour, charms, potions, scrolls, wands, tomes and collectibles.
// Pure. Every generator takes an rng and an item level (about the floor it came from) and returns a
// plain object. `key` is the journal template ("w:sword:4" = a steel sword); `sig` merges stacks.

import { RARITY } from '../config.js';
import { clamp, roman } from './core.js';
import { personName } from './names.js';

// ------------------------------------------------------------------ tables
export const WEAPONS = [
    { id: 'dagger', name: 'Dagger', grp: 'dagger', atk: 0.62, mag: 0.1, hands: 1, p: 0.8, crit: 0.06 },
    { id: 'sword', name: 'Sword', grp: 'sword', atk: 0.92, mag: 0, hands: 1, p: 1 },
    { id: 'axe', name: 'Axe', grp: 'axe', atk: 1.08, mag: 0, hands: 1, p: 1.1 },
    { id: 'mace', name: 'Mace', grp: 'mace', atk: 0.95, mag: 0.15, hands: 1, p: 1 },
    { id: 'spear', name: 'Spear', grp: 'spear', atk: 1.0, mag: 0, hands: 2, p: 1 },
    { id: 'bow', name: 'Bow', grp: 'bow', atk: 1.0, mag: 0, hands: 2, p: 1.05 },
    { id: 'staff', name: 'Staff', grp: 'staff', atk: 0.5, mag: 1.0, hands: 2, p: 1.1 },
    { id: 'wand', name: 'Wand', grp: 'wand', atk: 0.25, mag: 0.85, hands: 1, p: 1 },
    { id: 'whip', name: 'Whip', grp: 'whip', atk: 0.78, mag: 0, hands: 1, p: 0.9, agi: 0.12 },
    { id: 'flail', name: 'Flail', grp: 'flail', atk: 0.98, mag: 0.05, hands: 1, p: 1 },
];
export const ARMORS = [
    { id: 'buckler', name: 'Buckler', slot: 'shield', wt: 0, def: 0.5, mdef: 0.1 },
    { id: 'kite', name: 'Kite Shield', slot: 'shield', wt: 1, def: 0.8, mdef: 0.2 },
    { id: 'tower', name: 'Tower Shield', slot: 'shield', wt: 2, def: 1.2, mdef: 0.2 },
    { id: 'cap', name: 'Cap', slot: 'head', wt: 0, def: 0.35, mdef: 0.4 },
    { id: 'hood', name: 'Hood', slot: 'head', wt: 0, def: 0.3, mdef: 0.5 },
    { id: 'helm', name: 'Helm', slot: 'head', wt: 1, def: 0.6, mdef: 0.2 },
    { id: 'greathelm', name: 'Great Helm', slot: 'head', wt: 2, def: 0.9, mdef: 0.15 },
    { id: 'robe', name: 'Robe', slot: 'body', wt: 0, def: 0.5, mdef: 0.8 },
    { id: 'tunic', name: 'Tunic', slot: 'body', wt: 0, def: 0.6, mdef: 0.4 },
    { id: 'jerkin', name: 'Jerkin', slot: 'body', wt: 1, def: 1.0, mdef: 0.3 },
    { id: 'hauberk', name: 'Hauberk', slot: 'body', wt: 1, def: 1.3, mdef: 0.25 },
    { id: 'cuirass', name: 'Cuirass', slot: 'body', wt: 2, def: 1.7, mdef: 0.2 },
    { id: 'plate', name: 'Plate Armour', slot: 'body', wt: 2, def: 2.0, mdef: 0.15 },
    { id: 'gloves', name: 'Gloves', slot: 'hands', wt: 0, def: 0.25, mdef: 0.3 },
    { id: 'bracers', name: 'Bracers', slot: 'hands', wt: 1, def: 0.38, mdef: 0.2 },
    { id: 'gauntlets', name: 'Gauntlets', slot: 'hands', wt: 2, def: 0.5, mdef: 0.1 },
    { id: 'sandals', name: 'Sandals', slot: 'feet', wt: 0, def: 0.2, mdef: 0.2, agi: 0.1 },
    { id: 'boots', name: 'Boots', slot: 'feet', wt: 1, def: 0.35, mdef: 0.15 },
    { id: 'greaves', name: 'Greaves', slot: 'feet', wt: 2, def: 0.55, mdef: 0.1 },
];
export const CHARMS = [
    { id: 'ring', name: 'Ring' }, { id: 'amulet', name: 'Amulet' }, { id: 'charm', name: 'Charm' },
    { id: 'bracelet', name: 'Bracelet' }, { id: 'cloak', name: 'Cloak' }, { id: 'talisman', name: 'Talisman' },
    { id: 'belt', name: 'Belt' }, { id: 'brooch', name: 'Brooch' },
];
const METAL = ['Wooden', 'Copper', 'Bronze', 'Iron', 'Steel', 'Silver', 'Mithril', 'Adamant', 'Dragonbone', 'Starmetal', 'Voidsteel', 'Aetherium'];
const MATS = {
    0: ['Rag', 'Linen', 'Wool', 'Silk', 'Moonsilk', 'Spidersilk', 'Starweave', 'Voidweave', 'Aetherweave'],
    1: ['Hide', 'Leather', 'Studded', 'Cured', 'Drake-hide', 'Wyrmhide', 'Phase-hide', 'Nightscale', 'Aeon-hide'],
    2: METAL,
};
export const matList = (it) => (it.t === 'w' ? METAL : it.t === 'a' ? MATS[it.wt] : null);
export const MAT_STEP = 6;                       // item levels per material tier
function matName(list, tier) {
    const i = Math.min(tier, list.length - 1);
    return { name: list[i] + (tier >= list.length ? ' ' + roman(tier - list.length + 2) : ''), idx: i };
}

const PRE = [   // prefixes
    { n: 'Sharp', w: 'atk', v: 0.18 }, { n: 'Mighty', st: 'str', v: 0.14 }, { n: 'Swift', st: 'agi', v: 0.14 },
    { n: 'Wise', st: 'int', v: 0.14 }, { n: 'Hardy', st: 'vit', v: 0.14 }, { n: 'Lucky', st: 'luk', v: 0.14 },
    { n: 'Sturdy', a: 'def', v: 0.2 }, { n: 'Warded', a: 'mdef', v: 0.25 },
    { n: 'Flaming', elem: 'fire' }, { n: 'Frozen', elem: 'ice' }, { n: 'Shocking', elem: 'shock' }, { n: 'Holy', elem: 'holy' }, { n: 'Shadow', elem: 'dark' },
    { n: 'Venomous', onhit: 'poison' }, { n: 'Keen', crit: 0.04 }, { n: 'Nimble', eva: 0.03 },
];
const SUF = [   // suffixes
    { n: 'of the Bear', st: { str: 0.1, vit: 0.1 } }, { n: 'of the Fox', st: { agi: 0.1, luk: 0.1 } },
    { n: 'of the Owl', st: { int: 0.12, mp: 1.2 } }, { n: 'of Vigor', st: { hp: 1.6 } },
    { n: 'of Warding', st: { mdef: 0.3, vit: 0.06 } }, { n: 'of the Giant', st: { str: 0.14, hp: 1.0 } },
    { n: 'of Speed', st: { agi: 0.16 } }, { n: 'of Slaying', st: { atk: 0.22 } }, { n: 'of Fortune', st: { luk: 0.16, crit: 0.02 } },
    { n: 'of the Sage', st: { int: 0.14, mag: 0.2 } }, { n: 'of Iron', st: { def: 0.25 } }, { n: 'of the Whale', st: { hp: 2.2, mp: 0.6 } },
];

export const POTIONS = {
    heal: { name: 'Healing Potion', base: 14, k: 'hp' },
    mana: { name: 'Mana Potion', base: 22, k: 'mp' },
    antidote: { name: 'Antidote', base: 8, k: 'cure', cures: ['poison'] },
    panacea: { name: 'Panacea', base: 26, k: 'cure', cures: ['poison', 'sleep', 'stun'] },
    revive: { name: 'Revival Draught', base: 70, k: 'revive' },
    elixir: { name: 'Elixir', base: 110, k: 'full' },
    might: { name: 'Potion of Might', base: 30, k: 'buff', stat: 'atk' },
    ward: { name: 'Potion of Warding', base: 30, k: 'buff', stat: 'def' },
    haste: { name: 'Potion of Haste', base: 34, k: 'buff', stat: 'agi' },
};
const POT_WORD = ['Minor', 'Lesser', '', 'Greater', 'Grand', 'Superior', 'Supreme', 'Ultimate'];
const POT_COLOR = { heal: 'red', mana: 'blue', antidote: 'green', panacea: 'silver', revive: 'gold', elixir: 'violet', might: 'amber', ward: 'blue', haste: 'green' };

export const SCROLLS = {
    fire: { name: 'Fire Scroll', k: 'dmg', elem: 'fire', base: 18 }, ice: { name: 'Frost Scroll', k: 'dmg', elem: 'ice', base: 18 },
    shock: { name: 'Lightning Scroll', k: 'dmg', elem: 'shock', base: 20 }, holy: { name: 'Smiting Scroll', k: 'dmg', elem: 'holy', base: 24 },
    sleep: { name: 'Slumber Scroll', k: 'status', st: 'sleep', base: 26 },
    escape: { name: 'Scroll of Escape', k: 'escape', base: 40 }, map: { name: 'Scroll of Mapping', k: 'map', base: 55 },
    teleport: { name: 'Scroll of Teleport', k: 'tele', base: 45 },
};
export const WANDS = {
    fire: { name: 'Wand of Fire', skill: 'fire' }, ice: { name: 'Wand of Frost', skill: 'ice' }, bolt: { name: 'Wand of Lightning', skill: 'bolt' },
    heal: { name: 'Wand of Mending', skill: 'heal' }, sleep: { name: 'Wand of Sleep', skill: 'sleep' }, smite: { name: 'Wand of Smiting', skill: 'smite' },
};
export const TOMES = { str: 'Strength', vit: 'Vitality', agi: 'Agility', int: 'Intellect', luk: 'Fortune' };

export const COLLECTIBLES = [
    { id: 'moonleaf', name: 'Moonleaf', kind: 'herb', tier: 0 }, { id: 'bloodmoss', name: 'Bloodmoss', kind: 'herb', tier: 1 },
    { id: 'glowcap', name: 'Glowcap', kind: 'herb', tier: 2 }, { id: 'ghostroot', name: 'Ghostroot', kind: 'herb', tier: 3 },
    { id: 'dragonwort', name: 'Dragonwort', kind: 'herb', tier: 4 }, { id: 'starbloom', name: 'Starbloom', kind: 'herb', tier: 5 },
    { id: 'copperchunk', name: 'Copper Chunk', kind: 'ore', tier: 0 }, { id: 'ironite', name: 'Ironite', kind: 'ore', tier: 1 },
    { id: 'silvervein', name: 'Silver Vein', kind: 'ore', tier: 2 }, { id: 'mithrilore', name: 'Mithril Ore', kind: 'ore', tier: 3 },
    { id: 'adamantore', name: 'Adamant Ore', kind: 'ore', tier: 4 }, { id: 'voidcrystal', name: 'Void Crystal', kind: 'ore', tier: 5 },
    { id: 'cavemoth', name: 'Cave Moth', kind: 'bug', tier: 0 }, { id: 'glowbeetle', name: 'Glow Beetle', kind: 'bug', tier: 1 },
    { id: 'emberroach', name: 'Ember Roach', kind: 'bug', tier: 2 }, { id: 'frostcricket', name: 'Frost Cricket', kind: 'bug', tier: 3 },
    { id: 'bonewasp', name: 'Bone Wasp', kind: 'bug', tier: 4 }, { id: 'nightlancer', name: 'Night Lancer', kind: 'bug', tier: 5 },
    { id: 'crackedidol', name: 'Cracked Idol', kind: 'relic', tier: 0 }, { id: 'oldcoin', name: 'Old Coin', kind: 'relic', tier: 1 },
    { id: 'fossiltooth', name: 'Fossil Tooth', kind: 'relic', tier: 2 }, { id: 'runeshard', name: 'Rune Shard', kind: 'relic', tier: 3 },
    { id: 'gildedmask', name: 'Gilded Mask', kind: 'relic', tier: 4 }, { id: 'ancientcrown', name: 'Ancient Crown', kind: 'relic', tier: 5 },
    { id: 'garnet', name: 'Garnet', kind: 'gem', tier: 0 }, { id: 'topaz', name: 'Topaz', kind: 'gem', tier: 1 },
    { id: 'emerald', name: 'Emerald', kind: 'gem', tier: 2 }, { id: 'sapphire', name: 'Sapphire', kind: 'gem', tier: 3 },
    { id: 'ruby', name: 'Ruby', kind: 'gem', tier: 4 }, { id: 'diamond', name: 'Diamond', kind: 'gem', tier: 5 },
];
export const COLL_BY_ID = Object.fromEntries(COLLECTIBLES.map((c) => [c.id, c]));
const QUALITY = [['Dusty', 0.6], ['Plain', 1], ['Fine', 1.4], ['Pristine', 2], ['Flawless', 3.2]];

// ------------------------------------------------------------------ rarity and price
export function rollRarity(rng, depth, luck = 0, o = {}) {
    const w = [60, 26 + depth * 0.2, 9 + depth * 0.25, 3 + depth * 0.12, 0.6 + depth * 0.04 + luck];
    let r = rng.weighted([0, 1, 2, 3, 4], (i) => w[i]);
    r = Math.max(r, o.minRarity ?? 0);
    return Math.min(r, o.maxRarity ?? 4);
}
const rmul = (r) => RARITY[r].mul;
export function priceOf(it) {
    if (it.t === 'w' || it.t === 'a' || it.t === 'c') {
        let p = (10 + it.ilvl * 14) * [1, 1.6, 2.8, 5.5, 12][it.rar];
        if (it.t === 'w') p *= 1.2;
        if (it.t === 'c') p *= 1.3;
        if (it.cursed) p *= 0.5;
        return Math.max(5, Math.round(p));
    }
    return it.price;
}

// ------------------------------------------------------------------ gear
function addSt(st, k, v) { if (v) st[k] = (st[k] || 0) + v; }
function affix(rng, it, n, ilvl) {
    const used = new Set();
    const names = { pre: [], suf: null };
    for (let i = 0; i < n; i++) {
        const wantSuffix = i === 1 || (i === 0 && rng() < 0.4);
        if (wantSuffix && !names.suf) {
            const s = rng.pick(SUF);
            if (used.has(s.n)) continue;
            used.add(s.n);
            for (const k in s.st) {
                const v = s.st[k];
                if (k === 'hp') addSt(it.st, 'hp', Math.round(v * (6 + ilvl * 4)));
                else if (k === 'mp') addSt(it.st, 'mp', Math.round(v * (3 + ilvl * 1.6)));
                else if (k === 'atk' || k === 'mag') addSt(it.st, k, Math.round(Math.max(1, v * (3 + ilvl * 1.7))));
                else if (k === 'def' || k === 'mdef') addSt(it.st, k, Math.round(Math.max(1, v * (3 + ilvl * 1.5))));
                else if (k === 'crit') addSt(it.st, 'crit', v);
                else addSt(it.st, k, Math.max(1, Math.round(v * ilvl * 1.6 + 1)));
            }
            names.suf = s.n;
        } else {
            const p = rng.pick(PRE);
            if (used.has(p.n)) continue;
            if (p.elem && it.t !== 'w' && it.t !== 'a') continue;
            if (p.onhit && it.t !== 'w') continue;
            if (p.w && it.t !== 'w') continue;
            if (p.a && it.t !== 'a') continue;
            used.add(p.n);
            if (p.w) addSt(it.st, p.w, Math.max(1, Math.round(p.v * (3 + ilvl * 1.7))));
            else if (p.st) addSt(it.st, p.st, Math.max(1, Math.round(p.v * ilvl * 1.6 + 1)));
            else if (p.a) addSt(it.st, p.a, Math.max(1, Math.round(p.v * (3 + ilvl * 1.5))));
            else if (p.crit) addSt(it.st, 'crit', p.crit);
            else if (p.eva) addSt(it.st, 'eva', p.eva);
            else if (p.elem) {
                if (it.t === 'w') it.elem = p.elem;
                else { it.res = it.res || {}; it.res[p.elem] = (it.res[p.elem] || 0) + 0.15 + Math.min(0.3, ilvl * 0.004); }
            } else if (p.onhit) it.onhit = p.onhit;
            names.pre.push(p.n);
        }
    }
    return names;
}

/** Lift a curse: the sticky penalty goes, the boosted stats stay. */
export function purify(it) {
    if (!it.cursed) return;
    for (const k in it.cdebuf || {}) it.st[k] -= it.cdebuf[k];
    if (it.st.agi === 0) delete it.st.agi;
    if (it.st.luk === 0) delete it.st.luk;
    delete it.cdebuf;
    it.cursed = false; it.known = true; it.name = it.name + ' (purified)';
}
function curse(rng, it, ilvl) {
    it.cursed = true; it.known = false;
    for (const k of Object.keys(it.st)) if (k === 'atk' || k === 'def' || k === 'mag' || k === 'mdef') it.st[k] = Math.round(it.st[k] * 1.45);
    it.cdebuf = { agi: -Math.max(1, Math.round(ilvl * 0.35 + 1)), luk: -Math.max(1, Math.round(ilvl * 0.3 + 1)) };
    for (const k in it.cdebuf) addSt(it.st, k, it.cdebuf[k]);
}

export function genWeapon(rng, ilvl, o = {}) {
    const base = o.base ? WEAPONS.find((b) => b.id === o.base) : rng.weighted(WEAPONS, (b) => (o.groups ? (o.groups.includes(b.grp) ? 4 : 1) : 1));
    const rar = o.rar ?? rollRarity(rng, ilvl, o.luck || 0, o);
    const mat = matName(METAL, Math.floor(ilvl / MAT_STEP));
    const pw = 3 + ilvl * 1.7, rm = rmul(rar);
    const it = {
        t: 'w', key: `w:${base.id}:${mat.idx}`, base: base.id, grp: base.grp, hands: base.hands, ilvl, rar, mat: mat.name, wt: 0,
        st: { atk: Math.max(1, Math.round(base.atk * pw * rm)) }, elem: null, onhit: null, cursed: false, known: true,
    };
    if (base.mag) it.st.mag = Math.round(base.mag * pw * rm);
    if (base.agi) it.st.agi = Math.round(1 + base.agi * ilvl * 1.6);
    if (base.crit) it.st.crit = base.crit;
    const n = [0, 1, 2, 3, 3][rar];
    const nm = affix(rng, it, n, ilvl);
    it.name = `${nm.pre.join(' ')} ${mat.name} ${base.name}${nm.suf ? ' ' + nm.suf : ''}`.trim().replace(/\s+/g, ' ');
    if (rar === 4) it.name = `${personName(rng)}'s ${mat.name} ${base.name}`;
    if (!o.noCurse && rng() < 0.05 + Math.min(0.06, ilvl * 0.002)) curse(rng, it, ilvl);
    it.price = priceOf(it);
    return it;
}

export function genArmor(rng, ilvl, o = {}) {
    const cands = ARMORS.filter((a) => (!o.slot || a.slot === o.slot) && (o.maxWt === undefined || a.wt <= o.maxWt));
    const base = o.base ? ARMORS.find((b) => b.id === o.base) : rng.pick(cands.length ? cands : ARMORS);
    const rar = o.rar ?? rollRarity(rng, ilvl, o.luck || 0, o);
    const mat = matName(MATS[base.wt], Math.floor(ilvl / MAT_STEP));
    const pw = 2 + ilvl * 1.15, rm = rmul(rar);
    const it = {
        t: 'a', key: `a:${base.id}:${mat.idx}`, base: base.id, slot: base.slot, wt: base.wt, ilvl, rar, mat: mat.name,
        st: { def: Math.max(1, Math.round(base.def * pw * rm)), mdef: Math.round(base.mdef * pw * rm) }, res: null, cursed: false, known: true,
    };
    if (base.agi) it.st.agi = Math.round(1 + base.agi * ilvl);
    const n = [0, 1, 2, 3, 3][rar];
    const nm = affix(rng, it, n, ilvl);
    it.name = `${nm.pre.join(' ')} ${mat.name} ${base.name}${nm.suf ? ' ' + nm.suf : ''}`.trim().replace(/\s+/g, ' ');
    if (rar === 4) it.name = `${personName(rng)}'s ${mat.name} ${base.name}`;
    if (!o.noCurse && rng() < 0.05 + Math.min(0.06, ilvl * 0.002)) curse(rng, it, ilvl);
    it.price = priceOf(it);
    return it;
}

export function genCharm(rng, ilvl, o = {}) {
    const base = o.base ? CHARMS.find((b) => b.id === o.base) : rng.pick(CHARMS);
    const rar = Math.max(o.rar ?? rollRarity(rng, ilvl, o.luck || 0, o), o.minRarity ?? 1);
    const it = { t: 'c', key: `c:${base.id}`, base: base.id, ilvl, rar, mat: '', st: {}, res: null, cursed: false, known: true };
    const n = Math.max(1, [0, 1, 2, 3, 3][rar] + (rng() < 0.3 ? 1 : 0));
    const nm = affix(rng, it, n, ilvl);
    if (!Object.keys(it.st).length && !it.res) addSt(it.st, rng.pick(['str', 'vit', 'agi', 'int', 'luk']), Math.max(1, Math.round(ilvl * 0.8 + 2)));
    addSt(it.st, 'def', Math.round(ilvl * 0.5 + 1));
    it.name = `${nm.pre.join(' ')} ${base.name}${nm.suf ? ' ' + nm.suf : ''}`.trim().replace(/\s+/g, ' ');
    if (rar === 4) it.name = `${personName(rng)}'s ${base.name}`;
    if (!o.noCurse && rng() < 0.05) curse(rng, it, ilvl);
    it.price = priceOf(it);
    return it;
}

// ------------------------------------------------------------------ consumables
export const potencyOf = (ilvl) => Math.max(0, Math.floor(ilvl / 5));
export function potionName(eff, pot) {
    const P = POTIONS[eff], w = POT_WORD[Math.min(POT_WORD.length - 1, Math.floor(pot / 2))];
    const extra = pot >= 16 ? ` Mk.${roman(pot - 14)}` : '';
    return `${w ? w + ' ' : ''}${P.name}${extra}`;
}
export function genPotion(rng, ilvl, eff = null) {
    eff = eff || rng.weighted(Object.keys(POTIONS), (k) => ({ heal: 10, mana: 5, antidote: 3, panacea: 2, revive: 1.5, elixir: 0.4, might: 1.2, ward: 1.2, haste: 1 }[k]));
    const pot = potencyOf(ilvl), P = POTIONS[eff];
    const price = Math.round(P.base * (1 + pot * 1.1) * (eff === 'antidote' || eff === 'revive' ? 0.6 + pot * 0.1 : 1));
    return {
        t: 'p', key: `p:${eff}`, eff, pot, ilvl, rar: eff === 'elixir' ? 3 : eff === 'revive' ? 2 : 0, name: potionName(eff, pot), price, n: 1,
        sig: `p:${eff}:${pot}`, color: POT_COLOR[eff],
    };
}
export function genScroll(rng, ilvl, id = null) {
    id = id || rng.weighted(Object.keys(SCROLLS), (k) => ({ fire: 4, ice: 4, shock: 4, holy: 2, sleep: 3, escape: 3, map: 2, teleport: 1.5 }[k]));
    const S = SCROLLS[id], pot = potencyOf(ilvl);
    const dmgish = S.k === 'dmg' || S.k === 'status';
    return {
        t: 's', key: `s:${id}`, eff: id, pot: dmgish ? pot : 0, ilvl, rar: 1, name: S.name + (dmgish && pot ? ` +${pot}` : ''),
        price: Math.round(S.base * (dmgish ? 1 + pot * 0.9 : 1 + Math.min(4, pot * 0.1))), n: 1, sig: `s:${id}:${dmgish ? pot : 0}`,
    };
}
export function genWand(rng, ilvl, id = null) {
    id = id || rng.pick(Object.keys(WANDS));
    const W = WANDS[id], pot = Math.floor(ilvl / 4), ch = rng.int(5, 12);
    return {
        t: 'm', key: `m:${id}`, eff: id, skill: W.skill, pot, ilvl, rar: 2, name: W.name + (pot ? ` +${pot}` : ''), charges: ch, max: ch,
        price: Math.round(70 * (1 + pot * 0.8)), n: 1, sig: null,
    };
}
export function genTome(rng, ilvl, stat = null) {
    stat = stat || rng.pick(Object.keys(TOMES));
    const amt = 1 + Math.floor(ilvl / 20);
    return { t: 't', key: `t:${stat}`, eff: stat, amt, ilvl, rar: 3, name: `Tome of ${TOMES[stat]}${amt > 1 ? ' +' + amt : ''}`, price: 400 * amt + ilvl * 30, n: 1, sig: `t:${stat}:${amt}` };
}
export function genCollectible(rng, depth, kind = null, id = null) {
    let c;
    if (id) c = COLL_BY_ID[id];
    else {
        const tier = clamp(Math.floor(depth / 6) + rng.int(-1, 1), 0, 5);
        const list = COLLECTIBLES.filter((x) => (!kind || x.kind === kind) && x.tier === tier);
        c = rng.pick(list.length ? list : COLLECTIBLES);
    }
    const q = QUALITY[rng.weighted([0, 1, 2, 3, 4], (i) => [3, 6, 4, 2, 0.6][i])];
    const price = Math.max(2, Math.round((8 + c.tier * 24 + depth * 1.4) * q[1]));
    return { t: 'x', key: `x:${c.id}`, cid: c.id, kind: c.kind, tier: c.tier, ilvl: depth, rar: q[1] >= 2 ? 2 : q[1] > 1 ? 1 : 0, name: `${q[0]} ${c.name}`, price, n: 1, sig: `x:${c.id}:${q[0]}` };
}

// ------------------------------------------------------------------ loot
export function genGear(rng, ilvl, o = {}) {
    const r = rng();
    if (r < 0.34) return genWeapon(rng, ilvl, o);
    if (r < 0.84) return genArmor(rng, ilvl, o);
    return genCharm(rng, ilvl, o);
}
/** A chest's contents. tier 0 wooden … 3 gilded. Returns { gold, items }. */
export function genChest(rng, depth, tier = 0, luck = 0) {
    const items = [];
    const n = 1 + tier + (rng() < 0.4 ? 1 : 0);
    for (let i = 0; i < n; i++) {
        const r = rng();
        const il = Math.max(1, depth + rng.int(-1, 2) + tier);
        if (r < 0.26) items.push(genGear(rng, il, { luck: luck + tier * 0.5, minRarity: tier >= 2 ? 1 : 0 }));
        else if (r < 0.52) items.push(genPotion(rng, il));
        else if (r < 0.64) items.push(genScroll(rng, il));
        else if (r < 0.7) items.push(genWand(rng, il));
        else if (r < 0.73 + tier * 0.01) items.push(genTome(rng, il));
        else items.push(genCollectible(rng, depth));
    }
    return { gold: Math.round((20 + depth * 14) * (1 + tier * 0.9) * rng.range(0.7, 1.4)), items };
}
/** What a defeated monster leaves behind. */
export function genDrop(rng, depth, boss = false, luck = 0) {
    const out = [];
    if (boss) {
        out.push(genGear(rng, depth + 2, { minRarity: 2, luck: luck + 1 }));
        out.push(genPotion(rng, depth, rng.pick(['elixir', 'revive', 'heal'])));
        if (rng() < 0.5) out.push(genTome(rng, depth));
        return out;
    }
    const r = rng();
    if (r < 0.1 + luck * 0.01) out.push(genGear(rng, depth, { luck }));
    else if (r < 0.2) out.push(genPotion(rng, depth));
    else if (r < 0.3) out.push(genCollectible(rng, depth));
    else if (r < 0.34) out.push(genScroll(rng, depth));
    return out;
}

// ------------------------------------------------------------------ description
const STAT_LABEL = { atk: 'ATK', mag: 'MAG', def: 'DEF', mdef: 'MDF', str: 'STR', vit: 'VIT', agi: 'AGI', int: 'INT', luk: 'LUK', hp: 'HP', mp: 'MP', crit: 'CRT', eva: 'EVA' };
export const statLabel = (k) => STAT_LABEL[k] || k.toUpperCase();
export function statText(it) {
    const out = [];
    for (const k in it.st) {
        const v = it.st[k];
        if (!v) continue;
        out.push(`${statLabel(k)} ${v > 0 ? '+' : ''}${k === 'crit' || k === 'eva' ? Math.round(v * 100) + '%' : v}`);
    }
    if (it.elem && it.elem !== 'phys') out.push(`Element: ${it.elem}`);
    if (it.onhit) out.push(`On hit: ${it.onhit}`);
    if (it.res) for (const e in it.res) out.push(`Resist ${e} ${Math.round(it.res[e] * 100)}%`);
    return out;
}
export function describe(it) {
    if (it.t === 'p') {
        const P = POTIONS[it.eff];
        const t = { hp: `Restores ${Math.min(100, 20 + it.pot * 6)}% HP +${20 + it.pot * 10}`, mp: `Restores ${Math.min(100, 20 + it.pot * 6)}% MP +${10 + it.pot * 4}`, cure: `Cures ${P.cures?.join(', ')}`, revive: `Revives a fallen ally (${Math.min(100, 25 + it.pot * 5)}% HP)`, full: 'Fully restores HP, MP and status', buff: `+${25 + it.pot}% ${P.stat === 'agi' ? 'speed' : P.stat === 'atk' ? 'attack' : 'defence'} for the battle` };
        return [t[P.k]];
    }
    if (it.t === 's') {
        const S = SCROLLS[it.eff];
        return [S.k === 'dmg' ? `${S.elem} damage to all enemies` : S.k === 'status' ? 'Puts enemies to sleep' : S.k === 'escape' ? 'Return to town from the dungeon' : S.k === 'map' ? 'Reveals this floor' : 'Teleports the party to a random place'];
    }
    if (it.t === 'm') return [`Casts ${it.skill} · ${it.charges}/${it.max} charges`];
    if (it.t === 't') return [`Permanently +${it.amt} ${TOMES[it.eff]}`];
    if (it.t === 'x') return [`A ${it.kind}. Worth a few coins, or a quest.`];
    return statText(it);
}
export const itemLabel = (it) => (it.n > 1 ? `${it.name} ×${it.n}` : it.name);

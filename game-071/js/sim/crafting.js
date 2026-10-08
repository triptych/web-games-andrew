/**
 * crafting.js — making and trading: smelting, tanning, forging, honing, alchemy (essence and
 * note), runecraft, cooking, merchants and their prices, lockpicking and pickpocketing odds,
 * training, and fines. Pure functions over the world; the UI calls them.
 */
import { ITEMS, WEAPON_MATERIALS, WEAPON_TYPES, ARMOR_SETS, itemDef, itemValue, itemName, registerItem, TEMPER, ESSENCE_IDS } from './items.js';
import { EFFECTS, effectText } from './effects.js';
import { ENCHANTS, ENCH_BASE, enchName, SPELLS } from './magic.js';
import { addItem, removeItem, countItem } from './inventory.js';
import { hasPerk, perkVal } from './stats.js';
import { Rng, hashStr } from './rng.js';

const has = (p, id, n = 1) => countItem(p, id) >= n;
const take = (p, id, n = 1) => { let left = n; for (const e of [...p.inv]) { if (e.id !== id || left <= 0) continue; const k = Math.min(left, e.n); removeItem(p, e, k); left -= k; } };

// ------------------------------------------------------------------ smelter and tanning frame
export const SMELT = [
    { out: 'ingot_iron', n: 1, need: [['ore_iron', 2]] },
    { out: 'ingot_steel', n: 1, need: [['ingot_iron', 1], ['ore_iron', 1]] },
    { out: 'ingot_bronze', n: 1, need: [['ore_copper', 2]] },
    { out: 'ingot_cobalt', n: 1, need: [['ore_cobalt', 2]] },
    { out: 'ingot_glimmer', n: 1, need: [['ore_glimmer', 2]] },
    { out: 'ingot_verdite', n: 1, need: [['ore_verdite', 2]] },
    { out: 'ingot_nightiron', n: 1, need: [['ore_nightiron', 2]] },
    { out: 'ingot_silver', n: 1, need: [['ore_silver', 2]] },
    { out: 'ingot_gold', n: 1, need: [['ore_gold', 2]] },
    { out: 'ingot_deep', n: 1, need: [['ingot_bronze', 1], ['ingot_iron', 1]] },
];
export const TAN = [
    ...['pelt_wolf', 'pelt_deer', 'pelt_goat', 'pelt_fox', 'pelt_icewolf'].map((id) => ({ out: 'leather', n: 1, need: [[id, 1]] })),
    ...['pelt_bear', 'pelt_snowbear', 'pelt_fangcat'].map((id) => ({ out: 'leather', n: 2, need: [[id, 1]] })),
    { out: 'leather_strips', n: 3, need: [['leather', 1]] },
];

// ------------------------------------------------------------------ the forge
const ARMOR_PERK = { hide: null, leather: null, iron: null, steel: 'smith_steel', scaled: 'smith_steel', plate: 'smith_steel', hill: 'smith_steel', deep: 'smith_arcane', glimmer: 'smith_glimmer', crystal: 'smith_crystal', night: 'smith_crystal', dread: 'smith_wyrm', dscale: 'smith_wyrm', dplate: 'smith_wyrm' };
const ARMOR_MAT = { hide: 'leather', leather: 'leather', scaled: 'ingot_bronze', plate: 'ingot_bronze', glimmer: 'ingot_glimmer', crystal: 'ingot_verdite', dscale: 'dragon_scale', iron: 'ingot_iron', steel: 'ingot_steel', deep: 'ingot_deep', hill: 'ingot_cobalt', night: 'ingot_nightiron', dread: 'ingot_nightiron', dplate: 'dragon_bone' };
export const FORGE = [];
for (const m of WEAPON_MATERIALS) for (const [t, w] of Object.entries(WEAPON_TYPES)) {
    const id = `${m.id}_${t}`;
    if (!ITEMS[id]) continue;
    const n = Math.max(1, Math.round(w.wt / 6));
    const need = t === 'bow' ? [[m.id === 'iron' ? 'firewood' : m.ingot, n + 1], ['leather_strips', 2]] : [[m.ingot, n], ['leather_strips', 1]];
    if (m.id === 'dread') need.push(['night_dust', 1]);
    if (m.id === 'iron' && t !== 'bow') need.push(['ingot_iron', 0]);
    FORGE.push({ out: id, n: 1, need: need.filter(([, k]) => k > 0), perk: m.perk, group: 'Weapons', tier: m.lvl });
}
for (const s of ARMOR_SETS) for (const slot of ['head', 'body', 'hands', 'feet', 'shield']) {
    const id = `${s.id}_${slot}`;
    if (!ITEMS[id]) continue;
    const mat = ARMOR_MAT[s.id] || 'ingot_iron';
    const n = { head: 2, body: 4, hands: 1, feet: 2, shield: 3 }[slot] + (s.kind === 'heavy' ? 1 : 0);
    FORGE.push({ out: id, n: 1, need: [[mat, mat === 'leather' ? Math.max(1, n - 1) : n], ['leather_strips', slot === 'body' ? 3 : 2]], perk: ARMOR_PERK[s.id], group: 'Armour', tier: s.lvl });
}
for (const m of ['iron', 'steel', 'glimmer', 'crystal', 'night']) FORGE.push({ out: `arrow_${m}`, n: 24, need: [['firewood', 1], [WEAPON_MATERIALS.find((x) => x.id === m).ingot, 1]], perk: WEAPON_MATERIALS.find((x) => x.id === m).perk, group: 'Arrows' });
FORGE.push({ out: 'ring_silver', n: 1, need: [['ingot_silver', 1]], group: 'Jewellery' }, { out: 'ring_gold', n: 1, need: [['ingot_gold', 1]], group: 'Jewellery' },
    { out: 'amulet_silver', n: 1, need: [['ingot_silver', 1], ['gem_garnet', 1]], group: 'Jewellery' }, { out: 'amulet_gold', n: 1, need: [['ingot_gold', 1], ['gem_ruby', 1]], group: 'Jewellery' },
    { out: 'lockpick', n: 5, need: [['ingot_iron', 1]], group: 'Misc' }, { out: 'pickaxe', n: 1, need: [['ingot_iron', 2], ['firewood', 1]], group: 'Misc' }, { out: 'leather_strips', n: 3, need: [['leather', 1]], group: 'Misc' });

export const COOK = [
    { out: 'venison_cooked', n: 1, need: [['venison', 1]] },
    { out: 'salmon_grilled', n: 1, need: [['salmon', 1]] },
    { out: 'stew_venison', n: 1, need: [['venison', 1], ['potato', 1], ['leek', 1], ['rock_salt', 1]] },
    { out: 'soup_veg', n: 1, need: [['cabbage', 1], ['potato', 1], ['leek', 1]] },
    { out: 'stew_beef', n: 1, need: [['walrus', 1], ['carrot', 1], ['garlic', 1], ['rock_salt', 1]] },
    { out: 'bread', n: 2, need: [['wheat', 2]] },
];

export const STATION_RECIPES = { smelter: SMELT, tanning: TAN, forge: FORGE, cookpot: COOK };
export const STATION_NAMES = { smelter: 'Smelter', tanning: 'Tanning Frame', forge: 'Forge', cookpot: 'Cooking Pot', grindstone: 'Whetstone', workbench: "Armourer's Bench", alchemy: 'Alchemy Still', runetable: 'Rune Table' };

export function canMake(p, r) {
    if (r.perk && !hasPerk(p.sheet, r.perk)) return false;
    return r.need.every(([id, n]) => has(p, id, n));
}
/** Craft a recipe once; returns the made entry or null. */
export function make(world, r, station) {
    const p = world.player;
    if (!canMake(p, r)) return null;
    for (const [id, n] of r.need) take(p, id, n);
    addItem(p, { id: r.out }, r.n);
    const v = (ITEMS[r.out]?.value || 5) * r.n;
    world.skillUse(p, station === 'cookpot' ? 'alchemy' : 'smithing', station === 'cookpot' ? 1 : 3 + Math.sqrt(v) * 0.9);
    world.stats.crafted++;
    world.emit('crafted', { id: r.out, n: r.n, station });
    return r.out;
}

// ------------------------------------------------------------------ honing at the whetstone / armourer's bench
export function honeMax(sheet, d) {
    const perk = d.type === 'weapon' ? WEAPON_MATERIALS.find((m) => m.id === d.material)?.perk : ARMOR_PERK[d.material];
    let g = Math.floor(sheet.skills.smithing / 20) + (perk && hasPerk(sheet, perk) ? 1 : 0) + (sheet.perks.smith_arcane && 0);
    return Math.min(TEMPER.length - 1, Math.max(1, g));
}
export function honeMaterial(d) { return d.type === 'weapon' ? (d.ingot || 'ingot_iron') : (ARMOR_MAT[d.material] || d.temperMat || 'ingot_iron'); }
export function canHone(p, entry, station) {
    const d = itemDef(entry);
    if (!d) return false;
    if (station === 'grindstone' && d.type !== 'weapon') return false;
    if (station === 'workbench' && d.type !== 'armor') return false;
    if ((entry.ench || d.ench) && !p.sheet.perks.smith_arcane) return false;
    if ((entry.temper || 0) >= honeMax(p.sheet, d)) return false;
    return has(p, honeMaterial(d));
}
export function hone(world, entry, station) {
    const p = world.player;
    if (!canHone(p, entry, station)) return false;
    take(p, honeMaterial(itemDef(entry)));
    entry.temper = (entry.temper || 0) + 1;
    world.skillUse(p, 'smithing', 2 + entry.temper * 1.5);
    world.emit('honed', { entry, grade: TEMPER[entry.temper] });
    p.dirty = true;
    return true;
}

// ------------------------------------------------------------------ alchemy: one lead ingredient, up to two supports
registerItem('brew', { type: 'potion', name: 'Brew', value: 0, weight: 0.5, effects: [] });
registerItem('brew_poison', { type: 'poison', name: 'Poison', value: 0, weight: 0.5, effects: [] });
const DUR = { restore: 0, damage: 0, elemental: 0, absorb: 0, fortify: 60, resist: 60, regen: 300, status: 30, weak: 30, special: 20 };

export function knownOf(world, id) { return world.alchemyKnown[id] || (world.alchemyKnown[id] = { essence: false, note: false }); }
/** Study an ingredient at the still: consumes one, reveals its essence (then its note). */
export function study(world, entry) {
    const k = knownOf(world, entry.id);
    const d = itemDef(entry);
    if (k.essence && k.note) return null;
    removeItem(world.player, entry, 1);
    if (!k.essence) k.essence = true; else k.note = true;
    world.skillUse(world.player, 'alchemy', 2);
    return k.note ? d.note : d.essence;
}
/** What a brew would make, without making it. */
export function previewBrew(world, lead, supports) {
    const p = world.player, sh = p.sheet;
    const L = itemDef(lead);
    if (!L || L.type !== 'ingredient') return null;
    const main = L.essence;
    const effs = new Map([[main, 1]]);
    for (const s of supports) {
        const d = itemDef(s); if (!d) continue;
        if (d.note === main || d.essence === main) effs.set(main, effs.get(main) + 0.4);
        else effs.set(d.note, (effs.get(d.note) || 0) + 0.5);
    }
    const skill = sh.skills.alchemy;
    const mult = 3 * (1 + skill / 100 * 1.5) * (1 + perkVal(sh, 'al_alchemist'));
    let hostileAll = true, value = 0;
    const out = [];
    for (const [id, k] of effs) {
        const E = EFFECTS[id]; if (!E) continue;
        let m = (E.kind === 'status' ? 1 : (E.kind === 'restore' ? 12 : 6) * mult * k);
        if (E.kind === 'restore' && sh.perks.al_physician) m *= 1.25;
        if (!E.hostile && E.kind !== 'damage' && sh.perks.al_benefactor) m *= 1.25;
        if ((E.hostile || E.kind === 'damage' || E.kind === 'weak') && sh.perks.al_poisoner) m *= 1.25;
        const dur = E.kind === 'status' ? Math.round(10 * mult * k) : DUR[E.kind] ?? 0;
        if (!(E.hostile || E.kind === 'damage' || E.kind === 'weak')) hostileAll = false;
        out.push({ id, mag: Math.round(m), dur });
        value += E.base * m * (dur ? Math.max(1, dur / 30) : 1) * 2;
    }
    if (sh.perks.al_purity && out.length > 1) {
        const leadHostile = EFFECTS[main].hostile || EFFECTS[main].kind === 'damage' || EFFECTS[main].kind === 'weak';
        const keep = out.filter((e) => { const E = EFFECTS[e.id]; const h = E.hostile || E.kind === 'damage' || E.kind === 'weak'; return h === leadHostile; });
        out.length = 0; out.push(...keep);
        hostileAll = leadHostile;
    }
    const poison = hostileAll;
    const name = `${poison ? 'Poison' : 'Potion'} of ${EFFECTS[main].name.replace(/^(Restore|Bolster|Resist|Regenerate|Damage) /, '$1 ')}`;
    return { poison, effects: out, name, value: Math.max(5, Math.round(value)) };
}
export function brew(world, lead, supports) {
    const pv = previewBrew(world, lead, supports);
    if (!pv) return null;
    const p = world.player;
    removeItem(p, lead, 1);
    for (const s of supports) removeItem(p, s, 1);
    const k = knownOf(world, lead.id); k.essence = true;
    for (const s of supports) { const ks = knownOf(world, s.id); ks.note = true; }
    const entry = { id: pv.poison ? 'brew_poison' : 'brew', name: pv.name, effects: pv.effects, value: pv.value };
    addItem(p, entry, 1);
    world.skillUse(p, 'alchemy', 2 + Math.sqrt(pv.value) * 0.8);
    world.stats.crafted++;
    world.emit('brewed', { name: pv.name });
    return entry;
}
export function brewText(pv) { return pv.effects.map((e) => effectText(e.id, e.mag, e.dur)).join(' '); }

// ------------------------------------------------------------------ runecraft
export const RUNE_IDS = [...new Set([...ENCHANTS.weapon, ...Object.values(ENCHANTS.armor).flat()])];
for (const id of RUNE_IDS) registerItem(`rune_${id}`, { type: 'book', name: `Rune-Book: ${EFFECTS[id]?.name || id}`, value: 120 + (ENCH_BASE[id] || 10) * 8, weight: 1, rune: id });
export const ESSENCE_FACTOR = { essence_faint: 0.3, essence_minor: 0.5, essence_fair: 0.7, essence_major: 0.85, essence_great: 1 };

export function learnRune(world, id) {
    world.flags.runes = world.flags.runes || {};
    if (world.flags.runes[id]) return false;
    world.flags.runes[id] = true;
    world.emit('runeLearned', { id, name: EFFECTS[id]?.name });
    return true;
}
export function runesKnown(world) { return Object.keys(world.flags.runes || {}); }
export function runeSlotOf(d) { if (d.type === 'weapon') return 'weapon'; if (d.type === 'jewelry') return d.slot; return d.slot; }
export function runeFits(d, id) {
    if (!d) return false;
    if (d.type === 'weapon') return ENCHANTS.weapon.includes(id);
    if (d.type === 'armor' || d.type === 'jewelry') return (ENCHANTS.armor[d.slot] || []).includes(id);
    return false;
}
export function inscribePreview(world, entry, runeId, essenceId) {
    const sh = world.player.sheet;
    const d = itemDef(entry);
    const f = ESSENCE_FACTOR[essenceId] || 0.3;
    let mag = (ENCH_BASE[runeId] || 10) * f * (1 + sh.skills.enchanting / 100) * (1 + perkVal(sh, 'en_enchanter'));
    if (['fireDamage', 'frostDamage', 'shockDamage'].includes(runeId)) mag *= 1 + perkVal(sh, 'en_fire');
    if (runeId.startsWith('fortify') && !['fortifyHealth', 'fortifyMana', 'fortifyStamina', 'fortifyCarry'].includes(runeId)) mag *= 1 + perkVal(sh, 'en_insight');
    mag = runeId === 'paralysis' || runeId === 'waterbreathing' || runeId === 'muffle' || runeId === 'hush' ? 1 : Math.round(mag);
    const ench = { id: runeId, mag, dur: runeId === 'paralysis' ? 2 : runeId === 'turnUndead' || runeId === 'fear' ? 15 : 0 };
    return { ench, name: enchName(itemName({ id: d.id }), ench), charge: d.type === 'weapon' ? Math.round(1000 * f) : null };
}
export function inscribe(world, entry, runeId, essenceEntry, customName = null) {
    const p = world.player;
    const d = itemDef(entry);
    if (!d || entry.ench || d.ench || !runeFits(d, runeId) || !world.flags.runes?.[runeId]) return false;
    const pv = inscribePreview(world, entry, runeId, essenceEntry.id);
    removeItem(p, essenceEntry, 1);
    // an inscribed item becomes its own entry (never stacks)
    removeItem(p, entry, 1);
    const ne = { id: entry.id, n: 1, temper: entry.temper, ench: pv.ench, name: customName || pv.name };
    if (pv.charge) { ne.charge = pv.charge; ne.chargeMax = pv.charge; }
    addItem(p, ne, 1);
    world.skillUse(p, 'enchanting', 4 + pv.ench.mag * 0.2);
    world.emit('inscribed', { name: ne.name });
    return ne;
}
export function recharge(world, entry, essenceEntry) {
    if (!entry.chargeMax) return false;
    const f = ESSENCE_FACTOR[essenceEntry.id] || 0.3;
    entry.charge = Math.min(entry.chargeMax, (entry.charge || 0) + 1000 * f * (world.player.sheet.perks.en_soul ? 1.5 : 1));
    removeItem(world.player, essenceEntry, 1);
    world.emit('recharged', { entry });
    return true;
}

// ------------------------------------------------------------------ merchants
const BUYS = {
    general: null, smith: ['weapon', 'armor', 'material', 'ammo'], alchemist: ['potion', 'poison', 'ingredient', 'food'], spells: ['spelltome', 'book', 'scroll', 'essence', 'gem', 'jewelry', 'staff'],
    inn: ['food', 'ingredient'], food: ['food', 'ingredient'], fence: null, healer: ['potion', 'ingredient', 'book'], horses: [],
};
const STOCK = {
    general: ['potion_restoreHealth_0', 'potion_restoreStamina_0', 'lockpick', 'torch', 'arrow_iron', 'arrow_steel', 'leather', 'leather_strips', 'firewood', 'bread', 'cheese', 'apple', 'mead', 'pickaxe', 'woodcutter_axe', 'iron_dagger', 'hide_body', 'hide_feet', 'iron_bow', 'tunic', 'shoes', 'hood', 'essence_faint', 'rock_salt'],
    smith: ['ingot_iron', 'ingot_steel', 'ore_iron', 'ore_copper', 'leather_strips', 'iron_sword', 'iron_waraxe', 'iron_mace', 'iron_greatsword', 'iron_battleaxe', 'steel_sword', 'steel_dagger', 'iron_body', 'iron_head', 'iron_shield', 'steel_body', 'steel_shield', 'leather_body', 'leather_hands', 'arrow_iron', 'arrow_steel', 'iron_bow', 'steel_bow'],
    alchemist: ['potion_restoreHealth_0', 'potion_restoreHealth_1', 'potion_restoreMana_0', 'potion_restoreMana_1', 'potion_restoreStamina_1', 'potion_resistFire', 'potion_resistFrost', 'poison_weak', 'blue_gentian', 'red_campion', 'heather', 'lavender', 'wheat', 'garlic', 'rock_salt', 'nightshade', 'wolfsbane', 'glowcap', 'spider_egg', 'troll_grease', 'ember_ash'],
    spells: ['tome_firebolt', 'tome_icespike', 'tome_lightning', 'tome_barkskin', 'tome_wisplight', 'tome_calm', 'tome_courage', 'tome_spiritwolf', 'tome_spectralblade', 'tome_quickmending', 'tome_ward', 'essence_faint', 'essence_minor', 'essence_fair', 'potion_restoreMana_1', 'staff_fire', 'rune_fireDamage', 'rune_frostDamage', 'rune_fortifyHealth', 'rune_resistFire', 'rune_fortifyMana', 'rune_fortifySneak'],
    inn: ['bread', 'cheese', 'apple', 'mead', 'ale', 'wine', 'stew_venison', 'soup_veg', 'salmon_grilled', 'honeycake'],
    food: ['bread', 'cheese', 'apple', 'cabbage', 'carrot', 'potato', 'leek', 'salmon', 'venison', 'honeycake', 'mead', 'garlic', 'wheat'],
    fence: ['lockpick', 'potion_invis', 'poison_paralyze', 'poison_lingering', 'gem_amethyst', 'gem_ruby', 'ring_silver', 'steel_dagger', 'leather_body', 'leather_feet', 'leather_hands', 'leather_head'],
    healer: ['potion_restoreHealth_1', 'potion_restoreHealth_2', 'potion_fortifyHealth', 'tome_quickmending', 'tome_turnundead', 'garlic', 'lavender', 'blue_gentian'],
    horses: [],
};
export function merchantOf(world, npc) {
    const kind = npc.merchant;
    if (!kind) return null;
    world.merchants = world.merchants || {};
    const window = Math.floor(world.time.total / 48);   // restock every two days
    let m = world.merchants[npc.npcId || npc.id];
    if (!m || m.window !== window) {
        const r = new Rng(hashStr(npc.npcId || npc.id) ^ window);
        const inv = [];
        for (const id of STOCK[kind] || []) {
            if (!ITEMS[id] || !r.chance(0.8)) continue;
            const d = ITEMS[id];
            const n = d.type === 'ammo' ? r.int(10, 40) : d.type === 'weapon' || d.type === 'armor' || d.type === 'spelltome' || d.type === 'book' ? 1 : r.int(1, 5);
            addItem({ inv, gold: 0 }, { id }, n);
        }
        m = { window, kind, gold: { general: 750, smith: 1000, alchemist: 600, spells: 1200, inn: 300, food: 250, fence: 1500, healer: 400, horses: 500 }[kind] + (m?.invested || 0), inv, invested: m?.invested || 0 };
        world.merchants[npc.npcId || npc.id] = m;
    }
    return m;
}
export function merchantBuys(kind, entry, sheet) {
    const d = itemDef(entry);
    if (!d || d.quest || d.type === 'gold') return false;
    if (sheet?.perks.sp_merchant) return true;
    const list = BUYS[kind];
    if (list === null) return true;
    return list.includes(d.type) || (kind === 'spells' && d.wtype === 'staff');
}
/** Price of one item: buying from (buy = true) or selling to a merchant. */
export function price(world, entry, buy) {
    const sh = world.player.sheet;
    const speech = Math.min(100, sh.skills.speech + (world.player.stats.skillMod.speech || 0));
    const hag = perkVal(sh, 'sp_haggle') + perkVal(sh, 'sp_allure') + (KIN_BARTER(sh));
    const v = itemValue(entry) || (entry.value || 0);
    if (buy) return Math.max(1, Math.round(v * Math.max(1.1, 2.6 - speech * 0.014) * (1 - hag)));
    const stolen = entry.stolen ? 0.6 : 1;
    return Math.max(0, Math.floor(v * Math.min(0.9, 0.3 + speech * 0.004) * (1 + hag) * stolen));
}
const KIN_BARTER = (sh) => (sh.kin === 'caldaran' ? 0.1 : 0);

export function buy(world, m, entry, n = 1) {
    const p = world.player, cost = price(world, entry, true) * n;
    if (p.gold < cost) return false;
    p.gold -= cost; m.gold += cost;
    removeItem({ inv: m.inv }, entry, n);
    addItem(p, { ...entry, n: undefined }, n);
    world.skillUse(p, 'speech', Math.sqrt(cost) * 0.25);
    world.emit('trade', { buy: true, cost });
    return true;
}
export function sell(world, m, entry, n = 1) {
    const p = world.player, got = price(world, entry, false) * n;
    if (m.gold < got || !merchantBuys(m.kind, entry, p.sheet)) return false;
    m.gold -= got; p.gold += got;
    removeItem(p, entry, n);
    addItem({ inv: m.inv, gold: 0 }, { ...entry, n: undefined, stolen: undefined }, n);
    world.skillUse(p, 'speech', Math.sqrt(got) * 0.25);
    world.emit('trade', { buy: false, got });
    return true;
}

// ------------------------------------------------------------------ locks, pockets, trainers
export const LOCKS = ['Open', 'Simple', 'Plain', 'Tricky', 'Stubborn', 'Master'];
/** Pin-tumbler parameters for a lock level 1–5: pins, how fast they bob, the shear-line window. */
export function lockParams(level, sheet) {
    let speed = 0.7 + level * 0.32;
    if (level <= 2 && sheet.perks.lp_novice) speed *= 0.6;
    if (level >= 3 && level <= 4 && sheet.perks.lp_adept) speed *= 0.65;
    speed *= 1 - sheet.skills.lockpicking / 260;
    const window = 0.2 - level * 0.022 + sheet.skills.lockpicking / 1200;
    return { pins: 2 + level, speed, window: Math.max(0.06, window), breakChance: sheet.perks.lp_unbreak ? 0 : 0.35 + level * 0.06 };
}
export function pickpocketChance(world, target, entry, gold = 0) {
    const sh = world.player.sheet;
    const d = entry ? itemDef(entry) : null;
    const v = entry ? itemValue(entry) : gold;
    const w = d ? d.weight : 0;
    let c = 0.35 + sh.skills.pickpocket / 140 - Math.sqrt(v) * 0.02 - w * 0.02;
    c *= 1 + perkVal(sh, 'pp_light');
    if (!entry && sh.perks.pp_cutpurse) c += 0.25;
    if (target.ai?.state === 'sleep' && sh.perks.pp_night) c += 0.25;
    if (target.detect > 0.4) c -= 0.25;
    if (d && target.equip && Object.values(target.equip).includes(entry) && !sh.perks.pp_misdirect) return 0;
    return Math.max(0.03, Math.min(0.95, c));
}
export function trainCost(level) { return Math.round(level * 10 + 20); }

// ------------------------------------------------------------------ fines
export function townOf(loc) { return { pinebrook: 'brightwater', hollowmere: 'brightwater', kelvik: 'mirefen', highcairn: 'mirefen' }[loc] || loc; }
export function fineFor(kind, value) { return { theft: Math.max(5, Math.round(value * 0.5)), pickpocket: 25, assault: 40, murder: 1000, trespass: 5, lockpick: 5 }[kind] || 10; }

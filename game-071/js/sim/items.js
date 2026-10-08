/**
 * items.js — every kind of thing the player can carry.
 *
 * ITEMS maps a base id to its definition. Inventory entries are { id, n } for plain stacks, or
 * unique entries { id, n: 1, ench: { id, mag, dur }, temper, name, charge } for enchanted,
 * tempered or player-made items. All value/weight/name questions go through the helpers here.
 */
import { EFFECTS } from './effects.js';

export const ITEMS = {};
const def = (id, d) => { ITEMS[id] = { id, ...d }; return ITEMS[id]; };

// ------------------------------------------------------------------ weapons
export const WEAPON_MATERIALS = [
    { id: 'iron', name: 'Iron', lvl: 1, dmg: 0, val: 1, wt: 1, perk: null, color: 0x6d6a66, ingot: 'ingot_iron' },
    { id: 'steel', name: 'Steel', lvl: 4, dmg: 1, val: 1.8, wt: 1.1, perk: 'smith_steel', color: 0x9aa0a6, ingot: 'ingot_steel' },
    { id: 'hill', name: 'Hillforged', lvl: 8, dmg: 2, val: 2.6, wt: 1.25, perk: 'smith_steel', color: 0x4f5a3c, ingot: 'ingot_cobalt' },
    { id: 'deep', name: 'Deepforged', lvl: 12, dmg: 3, val: 3.5, wt: 1.3, perk: 'smith_arcane', color: 0xb08a45, ingot: 'ingot_deep' },
    { id: 'glimmer', name: 'Glimmer', lvl: 16, dmg: 4, val: 5, wt: 0.85, perk: 'smith_glimmer', color: 0xd9c27a, ingot: 'ingot_glimmer' },
    { id: 'crystal', name: 'Crystal', lvl: 22, dmg: 5, val: 9, wt: 0.95, perk: 'smith_crystal', color: 0x7fd6a0, ingot: 'ingot_verdite' },
    { id: 'night', name: 'Nightsteel', lvl: 28, dmg: 6, val: 14, wt: 1.4, perk: 'smith_crystal', color: 0x262830, ingot: 'ingot_nightiron' },
    { id: 'dread', name: 'Dreadforged', lvl: 36, dmg: 7.5, val: 30, wt: 1.5, perk: 'smith_wyrm', color: 0x3a1210, ingot: 'ingot_nightiron' },
    { id: 'dragon', name: 'Wyrmbone', lvl: 40, dmg: 8, val: 34, wt: 1.45, perk: 'smith_wyrm', color: 0xd8d0b8, ingot: 'dragon_bone' },
];
export const WEAPON_TYPES = {
    dagger:     { name: 'Dagger', dmg: 4, speed: 1.35, reach: 1.6, wt: 2, val: 10, skill: 'oneHanded', two: false, dmgStep: 1 },
    sword:      { name: 'Sword', dmg: 7, speed: 1.0, reach: 2.1, wt: 9, val: 25, skill: 'oneHanded', two: false, dmgStep: 1 },
    waraxe:     { name: 'War Axe', dmg: 8, speed: 0.92, reach: 2.0, wt: 11, val: 30, skill: 'oneHanded', two: false, dmgStep: 1, bleed: true },
    mace:       { name: 'Mace', dmg: 9, speed: 0.82, reach: 2.0, wt: 13, val: 35, skill: 'oneHanded', two: false, dmgStep: 1, pierce: true },
    greatsword: { name: 'Greatsword', dmg: 15, speed: 0.72, reach: 2.6, wt: 17, val: 50, skill: 'twoHanded', two: true, dmgStep: 1.6 },
    battleaxe:  { name: 'Battleaxe', dmg: 16, speed: 0.68, reach: 2.6, wt: 20, val: 55, skill: 'twoHanded', two: true, dmgStep: 1.6, bleed: true },
    warhammer:  { name: 'Warhammer', dmg: 18, speed: 0.6, reach: 2.5, wt: 24, val: 60, skill: 'twoHanded', two: true, dmgStep: 1.8, pierce: true },
    bow:        { name: 'Bow', dmg: 6, speed: 1.0, reach: 0, wt: 9, val: 30, skill: 'archery', two: true, dmgStep: 1.6, bow: true },
};
for (const m of WEAPON_MATERIALS) {
    for (const [t, w] of Object.entries(WEAPON_TYPES)) {
        const name = t === 'bow' && m.id === 'iron' ? "Hunter's Bow" : `${m.name} ${w.name}`;
        def(`${m.id}_${t}`, {
            type: 'weapon', name, wtype: t, material: m.id, lvl: m.lvl,
            damage: Math.round(w.dmg + m.dmg * w.dmgStep), speed: w.speed, reach: w.reach, skill: w.skill, two: w.two, bow: !!w.bow,
            weight: Math.round(w.wt * m.wt * 10) / 10, value: Math.round(w.val * m.val), color: m.color, ingot: m.ingot,
        });
    }
}
def('woodcutter_axe', { type: 'weapon', name: "Hatchet", wtype: 'waraxe', material: 'iron', lvl: 1, damage: 5, speed: 0.9, reach: 2, skill: 'oneHanded', two: false, weight: 10, value: 5, color: 0x6d6a66 });
def('pickaxe', { type: 'weapon', name: 'Pickaxe', wtype: 'waraxe', material: 'iron', lvl: 1, damage: 5, speed: 0.9, reach: 2, skill: 'oneHanded', two: false, weight: 10, value: 5, color: 0x6d6a66, tool: 'mine' });
def('staff_fire', { type: 'weapon', name: 'Emberwood Staff', wtype: 'staff', lvl: 4, damage: 0, skill: 'destruction', two: false, weight: 8, value: 340, staff: 'firebolt', color: 0x5a3a22 });
def('staff_frost', { type: 'weapon', name: 'Rimewood Staff', wtype: 'staff', lvl: 8, damage: 0, skill: 'destruction', two: false, weight: 8, value: 420, staff: 'icespike', color: 0x5a3a22 });
def('staff_winds', { type: 'weapon', name: 'Staff of Hollow Winds', wtype: 'staff', lvl: 10, damage: 0, skill: 'destruction', two: false, weight: 8, value: 900, staff: 'chainlightning', color: 0x3d4a5a, quest: true });
def('dragonbane', { type: 'weapon', name: 'Wyrmwatch Blade', wtype: 'sword', material: 'steel', lvl: 10, damage: 12, speed: 1.1, reach: 2.2, skill: 'oneHanded', two: false, weight: 10, value: 1200, color: 0xc8ccd4, unique: true, ench: { id: 'shockDamage', mag: 15 } });

// ------------------------------------------------------------------ armour
export const ARMOR_SETS = [
    { id: 'hide', name: 'Hide', kind: 'light', lvl: 1, rating: [12, 20, 5, 5, 15], val: 1, wt: [2, 6, 1, 1, 4], color: 0x7a5a3a, mat: 'leather' },
    { id: 'leather', name: 'Leather', kind: 'light', lvl: 3, rating: [12, 26, 7, 7, 0], val: 1.6, wt: [2, 6, 2, 2, 0], color: 0x5c3e26, mat: 'leather' },
    { id: 'scaled', name: 'Lamellar', kind: 'light', lvl: 10, rating: [14, 32, 9, 9, 0], val: 3, wt: [2, 6, 2, 2, 0], color: 0x6b6a5a, mat: 'ingot_bronze' },
    { id: 'glimmer', name: 'Glimmer', kind: 'light', lvl: 16, rating: [15, 29, 8, 8, 21], val: 5, wt: [1, 4, 1, 1, 4], color: 0xd9c27a, mat: 'ingot_glimmer' },
    { id: 'crystal', name: 'Crystal', kind: 'light', lvl: 22, rating: [16, 38, 9, 9, 27], val: 9, wt: [2, 7, 2, 2, 6], color: 0x7fd6a0, mat: 'ingot_verdite' },
    { id: 'dscale', name: 'Wyrmscale', kind: 'light', lvl: 38, rating: [17, 41, 12, 12, 29], val: 22, wt: [4, 10, 3, 3, 6], color: 0x6a8a7a, mat: 'dragon_scale' },
    { id: 'iron', name: 'Iron', kind: 'heavy', lvl: 1, rating: [15, 25, 10, 10, 20], val: 1, wt: [5, 30, 5, 6, 12], color: 0x6d6a66, mat: 'ingot_iron' },
    { id: 'steel', name: 'Steel', kind: 'heavy', lvl: 4, rating: [17, 31, 12, 12, 24], val: 1.8, wt: [5, 35, 4, 8, 12], color: 0x9aa0a6, mat: 'ingot_steel' },
    { id: 'plate', name: 'Banded Steel', kind: 'heavy', lvl: 12, rating: [19, 40, 14, 14, 0], val: 4, wt: [6, 38, 5, 9, 0], color: 0xb4b8be, mat: 'ingot_bronze' },
    { id: 'deep', name: 'Deepforged', kind: 'heavy', lvl: 12, rating: [18, 34, 13, 13, 26], val: 3.5, wt: [12, 45, 8, 10, 12], color: 0xb08a45, mat: 'ingot_deep' },
    { id: 'hill', name: 'Hillforged', kind: 'heavy', lvl: 14, rating: [20, 40, 15, 15, 30], val: 4.4, wt: [8, 35, 7, 7, 14], color: 0x4f5a3c, mat: 'ingot_cobalt' },
    { id: 'night', name: 'Nightsteel', kind: 'heavy', lvl: 28, rating: [21, 43, 16, 16, 32], val: 14, wt: [10, 38, 7, 7, 14], color: 0x262830, mat: 'ingot_nightiron' },
    { id: 'dread', name: 'Dreadforged', kind: 'heavy', lvl: 36, rating: [23, 49, 18, 18, 36], val: 30, wt: [15, 50, 6, 10, 15], color: 0x3a1210, mat: 'ingot_nightiron' },
    { id: 'dplate', name: 'Wyrmplate', kind: 'heavy', lvl: 40, rating: [22, 46, 17, 17, 34], val: 26, wt: [8, 40, 8, 8, 15], color: 0xd8d0b8, mat: 'dragon_bone' },
];
export const SLOTS = ['head', 'body', 'hands', 'feet', 'shield'];
const SLOT_NAMES = { head: 'Helmet', body: 'Armor', hands: 'Gauntlets', feet: 'Boots', shield: 'Shield' };
const SLOT_VAL = [60, 125, 25, 25, 60];
for (const set of ARMOR_SETS) {
    SLOTS.forEach((slot, k) => {
        if (!set.rating[k]) return;
        let nm = SLOT_NAMES[slot];
        if (set.kind === 'light' && slot === 'hands') nm = 'Bracers';
        if (set.kind === 'light' && slot === 'head') nm = set.id === 'hide' || set.id === 'leather' ? 'Helmet' : 'Helmet';
        def(`${set.id}_${slot}`, {
            type: 'armor', name: `${set.name} ${nm}`, slot, armorType: set.kind, material: set.id, lvl: set.lvl, rating: set.rating[k],
            weight: set.wt[k], value: Math.round(SLOT_VAL[k] * set.val), color: set.color, temperMat: set.mat,
        });
    });
}
// clothing (rating 0) and jewellery
const CLOTHES = [
    ['rags', 'Roughspun Tunic', 'body', 1, 1, 0x7a6a55], ['tunic', 'Homespun Clothes', 'body', 2, 6, 0x6b5a40], ['fine', 'Embroidered Clothes', 'body', 1, 40, 0x6a2a3a],
    ['robe', 'Apprentice Robes', 'body', 1, 25, 0x3a4a6a], ['robe_ad', "Scholar's Robes", 'body', 1, 120, 0x5a2a6a], ['robe_elder', 'Watcher\'s Robes', 'body', 1, 80, 0x8a8070],
    ['hood', 'Hood', 'head', 1, 5, 0x4a4a4a], ['shoes', 'Shoes', 'feet', 1, 4, 0x4a3828], ['boots_fur', 'Fur Boots', 'feet', 2, 8, 0x6a5a48],
    ['gloves', 'Leather Gloves', 'hands', 1, 6, 0x4a3828], ['roadworn', 'Road-Worn Clothes', 'body', 1, 1, 0x6a6458], ['warden', 'Warden\'s Finery', 'body', 3, 300, 0x7a1a1a],
    ['guard_bw', 'Brightwater Guard Armor', 'body', 8, 40, 0xb8902a], ['reaver', 'Saltreaver Mail', 'body', 10, 45, 0x6a7078], ['hearth', 'Hearthguard Cuirass', 'body', 10, 45, 0x2c4a7a],
    ['hierophant_crown', 'Crown of Zahrakhul', 'head', 30, 2500, 0x3a5a3a],
];
for (const [id, name, slot, wt, val, color] of CLOTHES) {
    const armor = id.startsWith('guard') || id === 'reaver' || id === 'hearth';
    def(id, { type: 'armor', name, slot, armorType: armor ? 'light' : 'clothing', material: 'cloth', lvl: 1, rating: armor ? 24 : id === 'hierophant_crown' ? 23 : 0, weight: wt, value: val, color, clothing: !armor });
}
ITEMS.hierophant_crown.unique = true; ITEMS.hierophant_crown.ench = { id: 'fortifyMana', mag: 50 };
for (const [id, name, slot, val] of [['ring_silver', 'Silver Ring', 'ring', 30], ['ring_gold', 'Gold Ring', 'ring', 75], ['amulet_silver', 'Silver Necklace', 'amulet', 60], ['amulet_gold', 'Gold Necklace', 'amulet', 120], ['circlet', 'Silver Circlet', 'head', 200]]) {
    def(id, { type: 'jewelry', name, slot, weight: slot === 'ring' ? 0.25 : 0.5, value: val, rating: 0 });
}
def('amulet_sky', { type: 'jewelry', name: "Storm-Mother's Pendant", slot: 'amulet', weight: 0.5, value: 150, ench: { id: 'resistShock', mag: 10 } });
def('ring_quiet', { type: 'jewelry', name: 'Ring of the Quiet Hand', slot: 'ring', weight: 0.25, value: 400, unique: true, ench: { id: 'fortifyPickpocket', mag: 20 } });

// ------------------------------------------------------------------ ammunition
for (const m of WEAPON_MATERIALS) def(`arrow_${m.id}`, { type: 'ammo', name: `${m.name} Arrow`, damage: 8 + Math.round(m.dmg * 2.2), weight: 0, value: Math.max(1, Math.round(m.val)), color: m.color, lvl: m.lvl });

// ------------------------------------------------------------------ potions
const POT = [
    ['restoreHealth', 'Health', [25, 50, 75, 120]], ['restoreMana', 'Mana', [25, 50, 75, 120]], ['restoreStamina', 'Stamina', [25, 50, 75, 120]],
];
const POT_PREFIX = ['Weak ', '', 'Strong ', 'Potent '];
for (const [eff, nm, mags] of POT) mags.forEach((m, k) => def(`potion_${eff}_${k}`, { type: 'potion', name: `${POT_PREFIX[k]}Potion of ${nm}`.replace('  ', ' '), effects: [{ id: eff, mag: m, dur: 0 }], weight: 0.5, value: [17, 36, 61, 120][k] }));
def('potion_fortifyHealth', { type: 'potion', name: 'Draught of Vigor', effects: [{ id: 'fortifyHealth', mag: 40, dur: 60 }], weight: 0.5, value: 80 });
def('potion_resistFire', { type: 'potion', name: 'Potion of Resist Fire', effects: [{ id: 'resistFire', mag: 40, dur: 60 }], weight: 0.5, value: 70 });
def('potion_resistFrost', { type: 'potion', name: 'Potion of Resist Frost', effects: [{ id: 'resistFrost', mag: 40, dur: 60 }], weight: 0.5, value: 70 });
def('potion_resistShock', { type: 'potion', name: 'Potion of Resist Shock', effects: [{ id: 'resistShock', mag: 40, dur: 60 }], weight: 0.5, value: 70 });
def('potion_invis', { type: 'potion', name: 'Potion of Invisibility', effects: [{ id: 'invisibility', mag: 1, dur: 30 }], weight: 0.5, value: 180 });
def('potion_water', { type: 'potion', name: 'Potion of Waterbreathing', effects: [{ id: 'waterbreathing', mag: 1, dur: 60 }], weight: 0.5, value: 60 });
def('potion_smith', { type: 'potion', name: "Forge-Hand's Tonic", effects: [{ id: 'fortifySmithing', mag: 20, dur: 30 }], weight: 0.5, value: 90 });
def('poison_weak', { type: 'poison', name: 'Weak Poison', effects: [{ id: 'damageHealth', mag: 15, dur: 0 }], weight: 0.5, value: 30 });
def('poison_paralyze', { type: 'poison', name: 'Paralysis Poison', effects: [{ id: 'paralysis', mag: 1, dur: 6 }], weight: 0.5, value: 220 });
def('poison_lingering', { type: 'poison', name: 'Lingering Poison', effects: [{ id: 'lingering', mag: 4, dur: 10 }], weight: 0.5, value: 90 });

// ------------------------------------------------------------------ food & drink
const FOOD = [
    ['apple', 'Red Apple', 3, 0.1, 'restoreHealth', 2], ['bread', 'Bread', 2, 0.2, 'restoreHealth', 3], ['cheese', 'Cheese Wheel', 10, 2, 'restoreHealth', 15],
    ['cabbage', 'Cabbage', 2, 0.25, 'restoreHealth', 3], ['carrot', 'Carrot', 1, 0.1, 'restoreHealth', 2], ['potato', 'Potato', 1, 0.1, 'restoreHealth', 2], ['leek', 'Leek', 2, 0.1, 'restoreHealth', 2],
    ['salmon', 'Salmon Steak', 5, 0.1, 'restoreHealth', 5], ['venison', 'Raw Venison', 4, 1, 'restoreHealth', 2], ['walrus', 'Walrus Meat', 3, 1, 'restoreHealth', 2],
    ['honeycake', 'Honey Cake', 4, 0.5, 'restoreHealth', 5], ['mead', 'Honeywort Mead', 8, 0.5, 'restoreStamina', 15], ['ale', 'Ale', 5, 0.5, 'restoreStamina', 10], ['wine', 'Northvale Wine', 7, 0.5, 'restoreStamina', 15],
    ['stew_venison', 'Venison Stew', 20, 0.5, 'restoreStamina', 30], ['soup_veg', 'Vegetable Soup', 10, 0.5, 'restoreHealth', 20], ['stew_beef', 'Beef Stew', 25, 0.5, 'restoreStamina', 40],
    ['venison_cooked', 'Cooked Venison', 10, 0.5, 'restoreHealth', 15], ['salmon_grilled', 'Grilled Salmon', 9, 0.5, 'restoreHealth', 12],
];
for (const [id, name, val, wt, eff, mag] of FOOD) def(id, { type: 'food', name, value: val, weight: wt, effects: [{ id: eff, mag, dur: 0 }] });
ITEMS.stew_venison.effects.push({ id: 'regenHealth', mag: 25, dur: 300 });
ITEMS.stew_beef.effects.push({ id: 'fortifyStamina', mag: 20, dur: 300 });

// ------------------------------------------------------------------ ingredients (essence, note; the trailing pair are unused alternates)
const ING = [
    ['blue_gentian', 'Blue Gentian', ['restoreHealth', 'fortifyConjuration', 'fortifyHealth', 'damageMana'], 2, 0.1, 'plant'],
    ['red_campion', 'Red Campion', ['restoreMana', 'ravage', 'fortifyMana', 'damageHealth'], 2, 0.1, 'plant'],
    ['heather', 'Heather', ['restoreStamina', 'fortifySneak', 'damageMana', 'resistFrost'], 2, 0.1, 'plant'],
    ['wheat', 'Wheat', ['restoreHealth', 'fortifyHealth', 'damageStamina', 'lingering'], 5, 0.1, 'plant'],
    ['lavender', 'Lavender', ['resistMagic', 'fortifyStamina', 'damageMana', 'fortifyConjuration'], 1, 0.1, 'plant'],
    ['rimeberries', 'Rimeberries', ['resistFire', 'fortifyEnchanting', 'resistFrost', 'resistShock'], 4, 0.1, 'plant'],
    ['juniper', 'Juniper Berries', ['weakFire', 'fortifyLightArmor', 'regenHealth', 'damageStamina'], 1, 0.1, 'plant'],
    ['nightshade', 'Nightshade', ['damageHealth', 'damageStamina', 'lingering', 'fortifyDestruction'], 8, 0.1, 'plant'],
    ['wolfsbane', 'Wolfsbane', ['damageHealth', 'resistPoison', 'slow', 'weakFrost'], 4, 0.1, 'plant'],
    ['frostmint', 'Frost Mint', ['resistFire', 'fortifySneak', 'damageStamina', 'damageMana'], 1, 0.1, 'plant'],
    ['thistle', 'Thistle Branch', ['resistFrost', 'damageStamina', 'resistPoison', 'fortifyHeavyArmor'], 1, 0.1, 'plant'],
    ['cottongrass', 'Cottongrass', ['resistMagic', 'fortifyMana', 'fortifyBlock', 'fortifySpeech'], 1, 0.1, 'plant'],
    ['ashmoss', 'Ash Moss', ['restoreMana', 'damageStamina', 'fortifyCarry', 'weakShock'], 1, 0.2, 'plant'],
    ['glowcap', 'Glowcap Mushroom', ['resistShock', 'fortifyDestruction', 'fortifySmithing', 'fortifyHealth'], 5, 0.2, 'fungus'],
    ['trollcap', 'Trollcap', ['damageHealth', 'lingering', 'paralysis', 'restoreHealth'], 0, 0.3, 'fungus'],
    ['bloodcap', 'Blood Cap', ['weakFire', 'fortifyBlock', 'weakShock', 'resistMagic'], 10, 0.3, 'fungus'],
    ['scorchcap', 'Scorchcap', ['damageStamina', 'frenzy', 'restoreHealth', 'fortifySmithing'], 12, 0.2, 'fungus'],
    ['fly_amanita', 'Fly Amanita', ['resistFire', 'fortifyTwoHanded', 'frenzy', 'regenStamina'], 2, 0.1, 'fungus'],
    ['palecap', 'Pale Cap', ['weakFrost', 'fortifyHeavyArmor', 'restoreMana', 'ravage'], 0, 0.3, 'fungus'],
    ['gravecap', 'Gravecap', ['weakShock', 'fortifyLockpicking', 'regenHealth', 'invisibility'], 0, 0.5, 'fungus'],
    ['mandrake', 'Mandrake Root', ['damageStamina', 'fortifyOneHanded', 'fortifyArchery', 'paralysis'], 5, 0.1, 'plant'],
    ['beard_lichen', 'Beard Lichen', ['damageMana', 'fortifyHealth', 'damageStamina', 'fortifyOneHanded'], 1, 0.1, 'plant'],
    ['bogbean', 'Bog Bean', ['resistShock', 'lingering', 'paralysis', 'restoreMana'], 6, 0.3, 'fungus'],
    ['salt', 'Rock Salt', ['weakMagic', 'fortifyRestoration', 'slow', 'regenMana'], 2, 0.2, 'mineral'],
    ['garlic', 'Garlic', ['resistPoison', 'fortifyStamina', 'regenMana', 'regenHealth'], 1, 0.25, 'plant'],
    ['bear_claws', 'Bear Claws', ['restoreStamina', 'fortifyHealth', 'fortifyOneHanded', 'damageMana'], 2, 0.1, 'animal'],
    ['wolf_tooth', 'Wolf Tooth', ['fortifyArchery', 'damageMana', 'regenStamina', 'restoreStamina'], 2, 0.1, 'animal'],
    ['rat_tail', 'Rat Tail', ['damageStamina', 'ravage', 'damageHealth', 'fortifyLightArmor'], 3, 0.2, 'animal'],
    ['troll_grease', 'Troll Grease', ['resistPoison', 'fortifyTwoHanded', 'frenzy', 'damageHealth'], 15, 1, 'animal'],
    ['giant_knuckle', "Giant's Knucklebone", ['damageStamina', 'fortifyHealth', 'fortifyCarry', 'damageHealth'], 20, 1, 'animal'],
    ['rime_crystals', 'Rime Crystals', ['weakFire', 'resistFire', 'restoreMana', 'fortifyConjuration'], 100, 0.25, 'mineral'],
    ['ember_ash', 'Ember Ash', ['weakFrost', 'resistFrost', 'restoreMana', 'regenMana'], 50, 0.25, 'mineral'],
    ['night_dust', 'Night Dust', ['weakShock', 'resistMagic', 'damageHealth', 'fortifyMana'], 125, 0.2, 'mineral'],
    ['ghost_dust', 'Ghost Dust', ['restoreMana', 'fortifyDestruction', 'fortifyMana', 'damageHealth'], 25, 0.1, 'animal'],
    ['spider_egg', 'Spider Egg', ['damageStamina', 'damageMana', 'fortifyLockpicking', 'fortifyMarksman'], 5, 0.2, 'animal'],
    ['mudclaw_shell', 'Mudclaw Shell', ['restoreStamina', 'resistPoison', 'resistFire', 'fortifyHealth'], 2, 0.25, 'animal'],
    ['honeycomb', 'Honeycomb', ['restoreStamina', 'fortifyBlock', 'fortifyLightArmor', 'ravageStamina'], 5, 1, 'animal'],
    ['fire_lily', "Fire Lily", ['resistFire', 'fortifyBarter', 'fortifyIllusion', 'fortifyTwoHanded'], 5, 0.1, 'plant'],
    ['raven_feather', 'Raven Feathers', ['damageMana', 'fortifyConjuration', 'damageStamina', 'fortifyBlock'], 20, 0.1, 'animal'],
    ['shade_dust', 'Frost Shade Dust', ['weakFrost', 'fortifyHeavyArmor', 'invisibility', 'weakFire'], 30, 0.25, 'animal'],
];
// unify a few names onto the effect table
const ALIAS = { ravage: 'damageHealth', weakMagic: 'weakShock', fortifyMarksman: 'fortifyArchery', fortifyBarter: 'fortifySpeech', ravageStamina: 'damageStamina' };
for (const [id, name, effs, val, wt, kind] of ING) {
    const e = effs.map((x) => ALIAS[x] || x);
    for (const x of e) if (!EFFECTS[x]) throw new Error(`ingredient ${id}: unknown effect ${x}`);
    // alchemy uses a lead ingredient's essence and its supports' notes (see game-plan §7)
    def(id, { type: 'ingredient', name, effects: e.slice(0, 2), essence: e[0], note: e[1], value: val, weight: wt, kind });
}

// ------------------------------------------------------------------ crafting materials
const MATS = [
    ['ore_iron', 'Iron Ore', 'ore', 7, 1], ['ore_copper', 'Copper Ore', 'ore', 10, 1], ['ore_glimmer', 'Glimmerstone Ore', 'ore', 15, 1], ['ore_verdite', 'Verdite Ore', 'ore', 25, 1],
    ['ore_nightiron', 'Nightiron Ore', 'ore', 50, 1], ['ore_cobalt', 'Cobalt Ore', 'ore', 15, 1], ['ore_silver', 'Silver Ore', 'ore', 25, 1], ['ore_gold', 'Gold Ore', 'ore', 50, 1],
    ['ingot_iron', 'Iron Ingot', 'ingot', 7, 1], ['ingot_steel', 'Steel Ingot', 'ingot', 20, 1], ['ingot_bronze', 'Bronze Ingot', 'ingot', 40, 1], ['ingot_glimmer', 'Glimmer Ingot', 'ingot', 75, 1],
    ['ingot_verdite', 'Verdite Ingot', 'ingot', 100, 1], ['ingot_nightiron', 'Nightiron Ingot', 'ingot', 150, 1], ['ingot_cobalt', 'Cobalt Ingot', 'ingot', 45, 1], ['ingot_silver', 'Silver Ingot', 'ingot', 50, 1],
    ['ingot_gold', 'Gold Ingot', 'ingot', 100, 1], ['ingot_deep', 'Deepforged Metal Ingot', 'ingot', 30, 1],
    ['leather', 'Leather', 'leather', 10, 2], ['leather_strips', 'Leather Strips', 'leather', 3, 0.1], ['firewood', 'Firewood', 'misc', 5, 5],
    ['pelt_wolf', 'Wolf Pelt', 'pelt', 25, 2], ['pelt_bear', 'Bear Pelt', 'pelt', 50, 6], ['pelt_snowbear', 'Snow Bear Pelt', 'pelt', 70, 6], ['pelt_fangcat', 'Fangcat Pelt', 'pelt', 40, 4],
    ['pelt_deer', 'Deer Hide', 'pelt', 25, 2], ['pelt_fox', 'Fox Pelt', 'pelt', 15, 1], ['pelt_goat', 'Goat Hide', 'pelt', 5, 1], ['pelt_icewolf', 'Ice Wolf Pelt', 'pelt', 60, 2],
    ['dragon_bone', 'Dragon Bone', 'dragon', 500, 15], ['dragon_scale', 'Dragon Scales', 'dragon', 250, 10], ['bone_meal', 'Bone Meal', 'misc', 5, 0.5],
];
for (const [id, name, kind, val, wt] of MATS) def(id, { type: 'material', kind, name, value: val, weight: wt });
// gems & valuables
const GEMS = [['garnet', 'Garnet', 100], ['amethyst', 'Amethyst', 120], ['ruby', 'Ruby', 200], ['sapphire', 'Sapphire', 250], ['emerald', 'Emerald', 350], ['diamond', 'Diamond', 700]];
for (const [id, name, val] of GEMS) { def(`gem_${id}`, { type: 'gem', name, value: val, weight: 0.1 }); def(`gem_${id}_f`, { type: 'gem', name: `Flawless ${name}`, value: val * 2, weight: 0.1 }); }
const CLUTTER = [['goblet', 'Silver Goblet', 30, 1], ['tankard', 'Tankard', 2, 1], ['candlestick', 'Silver Candlestick', 50, 2], ['urn', 'Burial Urn', 15, 4], ['idol_iron', 'Iron Idol', 80, 1],
    ['plate', 'Pewter Plate', 3, 1], ['bowl', 'Wooden Bowl', 1, 1], ['jewel_box', 'Jewelled Box', 120, 2], ['torch', 'Torch', 2, 1], ['lockpick', 'Lockpick', 2, 0], ['note', 'Note', 0, 0]];
for (const [id, name, val, wt] of CLUTTER) def(id, { type: 'misc', name, value: val, weight: wt });
ITEMS.torch.type = 'torch';
// creature essences: stoppered vials of the life-light a creature leaves when it dies; enchanting fuel
export const ESSENCE_IDS = [];
for (const [id, name, power, val] of [['faint', 'Faint', 250, 10], ['minor', 'Minor', 500, 25], ['fair', 'Fair', 1000, 50], ['major', 'Major', 2000, 100], ['great', 'Great', 3000, 200]]) {
    def(`essence_${id}`, { type: 'essence', name: `${name} Essence`, power, value: val, weight: 0.2 });
    ESSENCE_IDS.push(`essence_${id}`);
}
def('gold', { type: 'gold', name: 'Gold', value: 1, weight: 0 });

// ------------------------------------------------------------------ quest items
for (const [id, name, val] of [
    ['lodestone', 'Storm Lodestone', 0], ['star_chart', 'Star-Chart Rubbing', 100], ['chronicle', 'Chronicle of the First Storm', 0], ['orrery_core', 'Orrery Core', 0],
    ['amulet_halvard', "Halvard's Token", 0], ['warden_writ', "Warden Sigrun's Writ", 0], ['torvik_notes', "Torvik's Notes", 0], ['cistern_key', 'Cistern Key', 0],
    ['staff_shard', 'Spire Shard', 0], ['hunter_spearhead', 'Old Hunter\'s Spearhead', 0], ['lost_ring', "Freya's Wedding Ring", 50], ['letter_brenna', 'Letter to Brenna', 0],
    ['key_coldmarrow', 'Coldmarrow Barrow Key', 0], ['key_cottage', 'Windward Cottage Key', 0], ['gilded_cask', 'The Gilded Cask', 500], ['debt_ledger', 'Ledger of Debts', 0],
]) def(id, { type: 'quest', name, value: val, weight: id === 'lodestone' ? 5 : id === 'gilded_cask' ? 3 : 0.5, quest: true });
ITEMS.star_chart.desc = 'The palm shows three animals: a bear, a moth and an owl.';

// spell tomes are generated in magic.js; books in books.js
export function registerItem(id, d) { return def(id, d); }

// ------------------------------------------------------------------ helpers
export const TEMPER = ['', 'Fine', 'Superior', 'Exquisite', 'Flawless', 'Epic', 'Legendary'];

export function itemDef(entry) { return ITEMS[typeof entry === 'string' ? entry : entry.id]; }

export function itemName(entry) {
    const d = itemDef(entry);
    if (!d) return '???';
    let n = entry.name || d.name;
    if (entry.temper) n += ` (${TEMPER[entry.temper]})`;
    return n;
}

export function itemValue(entry) {
    const d = itemDef(entry);
    if (!d) return 0;
    let v = d.value;
    if (entry.temper) v *= 1 + entry.temper * 0.08;
    const ench = entry.ench || d.ench;
    if (ench && EFFECTS[ench.id]) v += Math.round(EFFECTS[ench.id].base * ench.mag * 12 + 40);
    return Math.max(0, Math.round(v));
}

export function itemWeight(entry) { const d = itemDef(entry); return d ? d.weight : 0; }

/** Weapon damage including tempering. */
export function weaponDamage(entry) {
    const d = itemDef(entry);
    if (!d || d.type !== 'weapon') return 0;
    return d.damage + (entry.temper || 0) * (d.two ? 2 : 1);
}

export function armorRating(entry) {
    const d = itemDef(entry);
    if (!d || (d.type !== 'armor' && d.type !== 'jewelry')) return 0;
    return d.rating + (entry.temper || 0) * (d.slot === 'body' ? 3 : 1.5);
}

/** The inventory category a menu shows the item under. */
export function category(entry) {
    const d = itemDef(entry);
    if (!d) return 'misc';
    return { weapon: 'weapons', armor: 'apparel', jewelry: 'apparel', ammo: 'weapons', potion: 'potions', poison: 'potions', food: 'food', ingredient: 'ingredients', book: 'books', spelltome: 'books', scroll: 'scrolls', essence: 'misc', material: 'misc', gem: 'misc', misc: 'misc', torch: 'misc', key: 'keys', quest: 'misc', gold: 'misc' }[d.type] || 'misc';
}

export function stackable(entry) {
    if (entry.ench || entry.temper || entry.name || entry.charge != null) return false;
    const d = itemDef(entry);
    return d && d.type !== 'weapon' && d.type !== 'armor' && !d.unique;
}

export function sameStack(a, b) { return a.id === b.id && stackable(a) && stackable(b); }

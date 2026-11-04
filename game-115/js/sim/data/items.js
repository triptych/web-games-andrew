// Every item in the game, and every recipe. Pure data (plus two small generators for the gear
// ladder). Recipe id === the id of the thing it makes.

export const ITEMS = {};
export const RECIPES = {};

const item = (id, name, icon, cat, value, extra = {}) => { ITEMS[id] = { id, name, icon, cat, value, ...extra }; };
const recipe = (out, inn, time, station, lv = 1, extra = {}) => {
    RECIPES[out] = { id: out, out, n: extra.n || 1, in: inn, time, station, lv, kind: extra.kind || 'craft' };
};

// ---------------------------------------------------------------- raw goods (gathered)
item('wood', 'Wood', '🪵', 'raw', 2);
item('stone', 'Stone', '🪨', 'raw', 2);
item('fiber', 'Plant Fiber', '🧵', 'raw', 2);
item('wheat', 'Wheat', '🌾', 'raw', 2);
item('berry', 'Berries', '🍓', 'raw', 2, { food: 12 });
item('apple', 'Apples', '🍎', 'raw', 3, { food: 14 });
item('fish', 'Fish', '🐟', 'raw', 4);
item('herb', 'Herbs', '🌿', 'raw', 3);
item('mushroom', 'Mushrooms', '🍄', 'raw', 4);
item('egg', 'Eggs', '🥚', 'raw', 4);
item('honey', 'Honey', '🍯', 'raw', 8);
item('ore', 'Iron Ore', '🟠', 'raw', 5);
item('coal', 'Coal', '⚫', 'raw', 4);
item('gem', 'Gems', '💎', 'raw', 40);
item('lore', 'Lore', '📘', 'raw', 0, { noSell: true });
// quest finds
item('meat', 'Game Meat', '🍖', 'raw', 6);
item('hide', 'Hides', '🦌', 'raw', 8);
item('pelt', 'Frost Pelts', '🐺', 'raw', 22);
item('relic', 'Old Relics', '🏺', 'raw', 70);

// ---------------------------------------------------------------- materials (made)
item('plank', 'Planks', '📏', 'mat', 6);
item('flour', 'Flour', '🥡', 'mat', 6);
item('cloth', 'Cloth', '🧶', 'mat', 12);
item('ingot', 'Iron Ingots', '🔩', 'mat', 18);
item('steel', 'Steel', '⚙️', 'mat', 46);
recipe('plank', { wood: 3 }, 6, 'carpenter', 1, { kind: 'process', n: 2 });
recipe('flour', { wheat: 2 }, 8, 'mill', 1, { kind: 'process' });
recipe('cloth', { fiber: 3 }, 9, 'loom', 1, { kind: 'process', n: 2 });
recipe('ingot', { ore: 3, coal: 1 }, 12, 'smithy', 1, { kind: 'process', n: 2 });
recipe('steel', { ingot: 2, coal: 2 }, 22, 'smithy', 2, { kind: 'process' });

// ---------------------------------------------------------------- dishes and drinks (the tavern)
// food: hunger restored (of 100). mood: added to a hero's mood. buff: { stat, pct } for `quests` quests.
const dish = (id, name, icon, food, mood, price, inn, time, lv, buff = null, quests = 3) => {
    item(id, name, icon, 'dish', price, { food, mood, buff, quests, dish: true });
    recipe(id, inn, time, 'tavern', lv, { kind: 'cook' });
};
dish('ale', 'Brown Ale', '🍺', 5, 14, 5, { wheat: 2 }, 8, 1);
dish('porridge', 'Honeyless Porridge', '🥣', 24, 2, 6, { wheat: 2, berry: 1 }, 9, 1);
dish('fruit_bowl', 'Fruit Bowl', '🍇', 18, 4, 5, { berry: 3, apple: 1 }, 7, 1);
dish('bread', 'Crusty Bread', '🍞', 30, 3, 9, { flour: 2 }, 10, 1);
dish('fish_stew', 'Fish Stew', '🍲', 42, 4, 14, { fish: 2, herb: 1 }, 14, 2);
dish('omelette', 'Herb Omelette', '🍳', 36, 5, 13, { egg: 2, herb: 1 }, 11, 2);
dish('cider', 'Apple Cider', '🧃', 8, 16, 8, { apple: 3 }, 9, 2);
dish('mushroom_soup', 'Mushroom Soup', '🍜', 40, 4, 16, { mushroom: 3, herb: 1 }, 13, 2);
dish('apple_pie', 'Apple Pie', '🥧', 52, 8, 30, { flour: 2, apple: 3, honey: 1 }, 18, 3, { stat: 'luck', pct: 12 });
dish('honey_cake', 'Honey Cake', '🍰', 48, 10, 34, { flour: 2, egg: 2, honey: 2 }, 18, 3, { stat: 'xp', pct: 25 });
dish('mead', 'Golden Mead', '🍯', 6, 22, 20, { honey: 2, wheat: 2 }, 14, 3);
dish('hearty_roast', 'Hearty Roast', '🍗', 80, 6, 48, { meat: 2, herb: 1, flour: 1 }, 22, 4, { stat: 'atk', pct: 12 });
dish('harvest_feast', 'Harvest Feast', '🦃', 100, 14, 85, { meat: 2, apple: 2, flour: 2, honey: 1 }, 30, 4, { stat: 'all', pct: 8 });

// ---------------------------------------------------------------- potions (the alchemist)
// power: added to a quest's success chance when carried. Heroes carry up to two.
const potion = (id, name, icon, value, power, inn, time, lv, extra = {}) => {
    item(id, name, icon, 'potion', value, { power, ...extra });
    recipe(id, inn, time, 'alchemist', lv, { kind: 'brew' });
};
potion('bandage', 'Bandages', '🩹', 10, 0.04, { cloth: 1, herb: 1 }, 8, 1);
potion('heal_potion', 'Healing Potion', '🧪', 22, 0.08, { herb: 3 }, 12, 1);
potion('luck_elixir', 'Elixir of Fortune', '🍀', 46, 0.05, { herb: 3, honey: 2, mushroom: 2 }, 16, 2, { loot: 0.25 });
potion('greater_potion', 'Greater Potion', '⚗️', 64, 0.15, { herb: 4, mushroom: 2, gem: 1 }, 20, 3);

// ---------------------------------------------------------------- gear: a ladder of five tiers
export const CLASSES = ['warrior', 'archer', 'mage', 'rogue', 'cleric'];
export const WEAPON_TYPE = { warrior: 'sword', archer: 'bow', mage: 'staff', rogue: 'dagger', cleric: 'mace' };
export const TIER_ATK = [0, 5, 10, 18, 29, 45];
export const TIER_DEF = [0, 3, 7, 13, 22, 35];
export const TIER_HP = [0, 4, 9, 16, 28, 45];
export const TIER_LUCK = [0, 3, 6, 10, 15, 22];

const WEAPONS = {
    sword: { names: ['Wooden Sword', 'Iron Sword', 'Steel Sword', 'Gemblade', 'Dragonfang Blade'], icon: '🗡️',
        ins: [{ plank: 2, fiber: 1 }, { ingot: 2, plank: 1 }, { steel: 2, plank: 1, cloth: 1 }, { steel: 2, gem: 2, cloth: 1 }, { steel: 3, gem: 3, relic: 1 }],
        st: ['carpenter', 'smithy', 'smithy', 'smithy', 'smithy'] },
    bow: { names: ['Twig Bow', "Hunter's Bow", 'Longbow', 'Gem Bow', 'Sunfire Bow'], icon: '🏹',
        ins: [{ plank: 2, fiber: 2 }, { plank: 2, fiber: 2, ingot: 1 }, { plank: 3, cloth: 1, steel: 1 }, { plank: 3, gem: 2, steel: 1 }, { plank: 4, gem: 3, steel: 2, relic: 1 }],
        st: ['carpenter', 'carpenter', 'carpenter', 'carpenter', 'carpenter'] },
    staff: { names: ['Oak Staff', 'Sprig Staff', 'Crystal Staff', 'Moon Staff', 'Archmage Staff'], icon: '🪄',
        ins: [{ plank: 2, herb: 1 }, { plank: 2, herb: 2, cloth: 1 }, { plank: 2, gem: 1, cloth: 1 }, { plank: 3, gem: 2, cloth: 1 }, { plank: 3, gem: 4, relic: 1 }],
        st: ['carpenter', 'carpenter', 'carpenter', 'carpenter', 'carpenter'] },
    dagger: { names: ['Whittled Knife', 'Iron Dagger', 'Steel Dirk', 'Gem Stiletto', 'Shadowfang'], icon: '🔪',
        ins: [{ plank: 1, fiber: 1 }, { ingot: 1, plank: 1 }, { steel: 1, cloth: 1 }, { steel: 1, gem: 2, cloth: 1 }, { steel: 2, gem: 3, relic: 1 }],
        st: ['carpenter', 'smithy', 'smithy', 'smithy', 'smithy'] },
    mace: { names: ['Oak Club', 'Iron Mace', 'Steel Flail', 'Gem Hammer', 'Sunhammer'], icon: '🔨',
        ins: [{ plank: 3 }, { ingot: 3, plank: 1 }, { steel: 2, ingot: 1, plank: 1 }, { steel: 3, gem: 2 }, { steel: 4, gem: 3, relic: 1 }],
        st: ['carpenter', 'smithy', 'smithy', 'smithy', 'smithy'] },
};
const ARMOR = {
    names: ['Cloth Tunic', 'Leather Jerkin', 'Chainmail', 'Steel Plate', 'Dragon Mail'], icon: '🛡️',
    ins: [{ cloth: 2 }, { hide: 3, cloth: 1 }, { ingot: 4, cloth: 1 }, { steel: 4, cloth: 2 }, { steel: 4, gem: 2, relic: 2, cloth: 2 }],
    st: ['loom', 'loom', 'smithy', 'smithy', 'smithy'],
};
const CHARMS = {
    names: ['Four-Leaf Charm', 'Amber Pendant', 'Moonstone Ring', 'Phoenix Feather', 'Star Amulet'], icon: '📿',
    ins: [{ herb: 3, fiber: 1 }, { honey: 2, ore: 1 }, { gem: 1, ingot: 1 }, { relic: 1, gem: 2 }, { relic: 2, gem: 3, steel: 1 }],
};

const valueOf = (inn) => Math.ceil(Object.entries(inn).reduce((s, [k, n]) => s + (ITEMS[k]?.value || 0) * n, 0) * 1.5);
const stationLv = (tier) => (tier <= 2 ? 1 : tier <= 4 ? 2 : 3);

for (const [type, w] of Object.entries(WEAPONS)) {
    for (let t = 1; t <= 5; t++) {
        const id = `w_${type}_${t}`;
        item(id, w.names[t - 1], w.icon, 'gear', valueOf(w.ins[t - 1]), { slot: 'weapon', type, tier: t, atk: TIER_ATK[t], reqLv: t * 3 - 2 });
        recipe(id, w.ins[t - 1], 12 + t * 8, w.st[t - 1], stationLv(t), { kind: 'forge' });
    }
}
for (let t = 1; t <= 5; t++) {
    const id = `a_${t}`;
    item(id, ARMOR.names[t - 1], ARMOR.icon, 'gear', valueOf(ARMOR.ins[t - 1]), { slot: 'armor', tier: t, def: TIER_DEF[t], hp: TIER_HP[t], reqLv: t * 3 - 2 });
    recipe(id, ARMOR.ins[t - 1], 14 + t * 8, ARMOR.st[t - 1], stationLv(t), { kind: 'forge' });
    const cid = `c_${t}`;
    item(cid, CHARMS.names[t - 1], CHARMS.icon, 'gear', valueOf(CHARMS.ins[t - 1]), { slot: 'charm', tier: t, luck: TIER_LUCK[t], hp: Math.round(TIER_HP[t] * 0.6), reqLv: t * 3 - 2 });
    recipe(cid, CHARMS.ins[t - 1], 14 + t * 8, 'alchemist', stationLv(t) > 2 ? 2 : 1, { kind: 'brew' });
}

export const GEAR_IDS = Object.keys(ITEMS).filter((k) => ITEMS[k].cat === 'gear');
export const DISH_IDS = Object.keys(ITEMS).filter((k) => ITEMS[k].cat === 'dish');
export const POTION_IDS = Object.keys(ITEMS).filter((k) => ITEMS[k].cat === 'potion');
export const RAW_IDS = Object.keys(ITEMS).filter((k) => ITEMS[k].cat === 'raw');
export const MAT_IDS = Object.keys(ITEMS).filter((k) => ITEMS[k].cat === 'mat');
export const ALL_IDS = Object.keys(ITEMS);

/** Recipes a station can make, in a stable order. */
export function recipesFor(station) {
    return Object.values(RECIPES).filter((r) => r.station === station);
}

/** What a hero of this class may wear in a slot: weapons must match the class. */
export function canEquip(cls, it) {
    if (!it || it.cat !== 'gear') return false;
    if (it.slot === 'weapon') return it.type === WEAPON_TYPE[cls];
    return true;
}

// ============================================================
// Cooking, refining and crafting recipes.
// An ingredient key is an item id or 'tag:<tag>' (any item carrying it).
// ============================================================

import { registerItem, ITEM } from './items.js';

// ---------------------------------------------------------------- cooking
// tier: roughly where the recipe is found (0 known/early … 5 late)
const COOK = [
    ['fried_egg', 'Fried Egg', 0, [['tag:egg', 1]], 20, 30, null, 'plate', 50],
    ['baked_potato', 'Baked Potato', 0, [['potato', 1]], 40, 45, null, 'plate', 35],
    ['herb_tea', 'Herb Tea', 0, [['tag:herb', 1]], 15, 40, { spd: 1 }, 'cup', 120],
    ['garden_salad', 'Garden Salad', 0, [['tag:vegetable', 2]], 35, 55, null, 'bowl', 100],
    ['bread', 'Country Bread', 1, [['flour', 1]], 25, 45, null, 'bread', 35],
    ['omelette', 'Omelette', 1, [['tag:egg', 1], ['tag:milk', 1]], 45, 60, null, 'plate', 55],
    ['pancakes', 'Pancakes', 1, [['flour', 1], ['tag:egg', 1], ['tag:milk', 1]], 50, 80, { speed: 1 }, 'plate', 38],
    ['turnip_soup', 'Turnip Soup', 1, [['turnip', 1], ['tag:milk', 1]], 50, 60, null, 'bowl', 310],
    ['fruit_salad', 'Fruit Salad', 1, [['tag:fruit', 3]], 50, 75, null, 'bowl', 340],
    ['mushroom_stew', 'Mushroom Stew', 1, [['tag:mushroom', 2], ['tag:herb', 1]], 60, 60, { def: 1 }, 'bowl', 28],
    ['roasted_yam', 'Roasted Yam', 2, [['yam', 1]], 45, 60, null, 'plate', 22],
    ['tomato_soup', 'Tomato Soup', 2, [['tomato', 1], ['tag:herb', 1]], 55, 65, { atk: 1 }, 'bowl', 5],
    ['berry_tart', 'Berry Tart', 2, [['tag:fruit', 1], ['flour', 1], ['sugar', 1]], 60, 90, { luck: 3 }, 'pie', 340],
    ['cheese_toast', 'Cheese Toast', 2, [['flour', 1], ['tag:cheese', 1]], 55, 70, { def: 1 }, 'bread', 48],
    ['sweet_porridge', 'Sweet Porridge', 2, [['wheat', 1], ['tag:milk', 1], ['tag:sweet', 1]], 50, 75, null, 'bowl', 40],
    ['nut_granola', 'Nutty Granola', 2, [['tag:nut', 1], ['wheat', 1], ['tag:fruit', 1]], 50, 85, { spd: 1 }, 'bowl', 32],
    ['corn_chowder', 'Corn Chowder', 3, [['corn', 1], ['tag:milk', 1], ['potato', 1]], 75, 95, null, 'bowl', 52],
    ['blueberry_muffin', 'Blueberry Muffin', 3, [['blueberry', 1], ['flour', 1], ['tag:egg', 1]], 60, 85, { speed: 1 }, 'bread', 235],
    ['melon_sorbet', 'Melon Sorbet', 3, [['melon', 1], ['sugar', 1], ['tag:milk', 1]], 80, 110, { spd: 2 }, 'cup', 110],
    ['lake_chowder', 'Lake Chowder', 3, [['clam', 1], ['tag:milk', 1], ['potato', 1]], 90, 100, { def: 2 }, 'bowl', 25],
    ['mayo_sandwich', 'Mayo Sandwich', 3, [['mayo', 1], ['flour', 1], ['tag:vegetable', 1]], 70, 85, null, 'bread', 60],
    ['mushroom_skewer', 'Forager Skewer', 3, [['tag:mushroom', 1], ['tag:vegetable', 1], ['oil', 1]], 60, 60, { atk: 2 }, 'skewer', 30],
    ['pumpkin_soup', 'Pumpkin Soup', 4, [['pumpkin', 1], ['tag:milk', 1]], 90, 100, { def: 2 }, 'bowl', 28],
    ['cranberry_sauce', 'Cranberry Sauce', 4, [['cranberry', 1], ['sugar', 1]], 45, 60, { farm: 1 }, 'bowl', 345],
    ['beet_salad', 'Beet & Goat Cheese', 4, [['beet', 1], ['goat_cheese', 1]], 70, 75, { atk: 2 }, 'bowl', 330],
    ['cauli_gratin', 'Cauliflower Gratin', 4, [['cauliflower', 1], ['tag:cheese', 1]], 100, 100, { def: 3 }, 'pie', 55],
    ['ember_chili', 'Ember Chili', 4, [['tag:spicy', 1], ['tomato', 1], ['corn', 1]], 90, 90, { atk: 3 }, 'bowl', 8],
    ['pumpkin_pie', 'Pumpkin Pie', 5, [['pumpkin', 1], ['flour', 1], ['sugar', 1], ['tag:egg', 1]], 110, 130, { luck: 5 }, 'pie', 28],
    ['snowroot_stew', 'Snowroot Stew', 5, [['snowroot', 1], ['tag:mushroom', 1], ['tag:herb', 1]], 80, 90, { def: 2 }, 'bowl', 200],
    ['frost_cobbler', 'Frostberry Cobbler', 5, [['frostberry', 1], ['flour', 1], ['sugar', 1]], 80, 100, { spd: 2 }, 'pie', 190],
    ['glimmer_cake', 'Glimmer Cake', 5, [['starbloom', 1], ['flour', 1], ['sugar', 1], ['tag:egg', 1]], 200, 200, { atk: 2, def: 2, spd: 2, luck: 5 }, 'cake', 280],
    ['heartwood_feast', 'Heartwood Feast', 6, [['pumpkin', 1], ['cauliflower', 1], ['melon', 1], ['tag:cheese', 1], ['honey', 1]], 999, 999, { atk: 3, def: 3, spd: 3, luck: 8 }, 'cake', 120],
];

export const RECIPES = [];
export const RECIPE = {};
for (const [id, name, tier, ing, hp, en, buff, ic, hue] of COOK) {
    const sell = Math.round((hp + en) * 1.3 + ing.length * 20);
    registerItem({ id, name, cat: 'dish', sell, ic, hue, tags: ['dish'], food: { hp, en, buff } });
    registerItem({ id: 'scroll_' + id, name: 'Recipe: ' + name, cat: 'scroll', sell: 0, ic: 'scroll', hue, teaches: id, desc: 'Read to learn this recipe.' });
    const r = { id, name, tier, ing, out: id };
    RECIPES.push(r); RECIPE[id] = r;
}
export const STARTING_RECIPES = ['fried_egg', 'baked_potato', 'herb_tea', 'garden_salad'];

// ---------------------------------------------------------------- refining
// stations → recipes { in: [[key,n]...], out, n, min (game minutes) }
export const STATIONS = {
    furnace: { name: 'Clay Furnace', recipes: [
        { in: [['copper_ore', 5], ['coal', 1]], out: 'copper_bar', n: 1, min: 120 },
        { in: [['iron_ore', 5], ['coal', 1]], out: 'iron_bar', n: 1, min: 180 },
        { in: [['clay', 2]], out: 'brick', n: 1, min: 60 },
    ] },
    forge: { name: 'Forge', recipes: [
        { in: [['copper_ore', 4], ['coal', 1]], out: 'copper_bar', n: 1, min: 60 },
        { in: [['iron_ore', 4], ['coal', 1]], out: 'iron_bar', n: 1, min: 90 },
        { in: [['gold_ore', 4], ['coal', 1]], out: 'gold_bar', n: 1, min: 120 },
        { in: [['glim_ore', 4], ['coal', 2]], out: 'glim_bar', n: 1, min: 240 },
        { in: [['clay', 2]], out: 'brick', n: 1, min: 30 },
        { in: [['emerald', 1], ['gold_bar', 1]], out: 'emerald_ring', n: 1, min: 240 },
        { in: [['amethyst', 1], ['gold_bar', 1]], out: 'amethyst_ring', n: 1, min: 240 },
        { in: [['sapphire', 1], ['gold_bar', 1]], out: 'sapphire_ring', n: 1, min: 240 },
        { in: [['ruby', 1], ['gold_bar', 1]], out: 'ruby_ring', n: 1, min: 240 },
        { in: [['moonstone', 1], ['gold_bar', 1]], out: 'moon_ring', n: 1, min: 240 },
    ] },
    sawmill: { name: 'Sawmill', recipes: [
        { in: [['wood', 3]], out: 'plank', n: 1, min: 30 },
        { in: [['hardwood', 2]], out: 'beam', n: 1, min: 60 },
        { in: [['sap', 5]], out: 'oil', n: 1, min: 60 },
    ] },
    mill: { name: 'Mill', recipes: [
        { in: [['wheat', 1]], out: 'flour', n: 1, min: 30 },
        { in: [['beet', 1]], out: 'sugar', n: 2, min: 30 },
        { in: [['tag:nut', 2]], out: 'oil', n: 1, min: 60 },
    ] },
    loom: { name: 'Loom', recipes: [
        { in: [['tag:wool', 1]], out: 'cloth', n: 1, min: 120 },
        { in: [['fiber', 6]], out: 'rope', n: 1, min: 30 },
    ] },
    dairy: { name: 'Dairy', recipes: [
        { in: [['milk', 1]], out: 'cheese', n: 1, min: 180 },
        { in: [['milk_l', 1]], out: 'cheese', n: 2, min: 180 },
        { in: [['goat_milk', 1]], out: 'goat_cheese', n: 1, min: 180 },
        { in: [['tag:egg', 1]], out: 'mayo', n: 1, min: 90 },
    ] },
    jar: { name: 'Preserves Jar', recipes: [
        { in: [['tag:fruit', 2]], out: 'jam', n: 1, min: 480 },
        { in: [['tag:vegetable', 2]], out: 'pickles', n: 1, min: 480 },
    ] },
    still: { name: 'Herbal Still', recipes: [
        { in: [['tag:herb', 2]], out: 'tonic', n: 1, min: 60 },
        { in: [['wisp_dust', 1], ['tag:herb', 1]], out: 'ether', n: 1, min: 90 },
        { in: [['tag:mushroom', 2], ['tag:herb', 1]], out: 'smelling_salts', n: 1, min: 60 },
        { in: [['tonic', 1], ['ether', 1], ['moonstone', 1]], out: 'elixir', n: 1, min: 240 },
    ] },
};

// ---------------------------------------------------------------- workbench crafting
// lvl = village level needed; job = villager whose arrival unlocks it
export const CRAFTS = [
    { out: 'furnace', n: 1, in: [['stone', 20], ['clay', 5]], lvl: 1 },
    { out: 'sprinkler', n: 1, in: [['copper_bar', 1], ['stone', 5]], lvl: 1 },
    { out: 'fence', n: 4, in: [['wood', 4]], lvl: 1 },
    { out: 'chest_item', n: 1, in: [['wood', 40]], lvl: 1 },
    { out: 'jar', n: 1, in: [['wood', 20], ['stone', 10], ['coal', 1]], lvl: 1 },
    { out: 'tonic', n: 1, in: [['tag:herb', 3]], lvl: 1 },
    { out: 'bench', n: 1, in: [['plank', 4]], lvl: 2, job: 'carpenter' },
    { out: 'planter', n: 1, in: [['plank', 2], ['tag:flower', 2]], lvl: 2, job: 'carpenter' },
    { out: 'lamp', n: 1, in: [['copper_bar', 1], ['wood', 5], ['coal', 1]], lvl: 2 },
    { out: 'beehive', n: 1, in: [['plank', 5], ['tag:flower', 3]], lvl: 2 },
    { out: 'sprinkler2', n: 1, in: [['iron_bar', 1], ['copper_bar', 1], ['stone', 5]], lvl: 3 },
    { out: 'statue', n: 1, in: [['stone', 60], ['gold_bar', 1]], lvl: 4 },
];

// ---------------------------------------------------------------- blacksmith upgrades
export const TOOL_UPGRADE = [   // index = target tier (1..4)
    null,
    { bar: 'copper_bar', n: 5, gold: 250 },
    { bar: 'iron_bar', n: 5, gold: 800 },
    { bar: 'gold_bar', n: 5, gold: 2000 },
    { bar: 'glim_bar', n: 5, gold: 5000 },
];
export const SMITH_GEAR = [
    { out: 'copper_sword', in: [['copper_bar', 3]], gold: 150 },
    { out: 'iron_sword', in: [['iron_bar', 3]], gold: 500 },
    { out: 'gold_sword', in: [['gold_bar', 3]], gold: 1400 },
    { out: 'glim_sword', in: [['glim_bar', 3], ['moonstone', 1]], gold: 3500 },
    { out: 'leather_vest', in: [['fur', 6]], gold: 120 },
    { out: 'iron_mail', in: [['iron_bar', 4]], gold: 600 },
    { out: 'gold_mail', in: [['gold_bar', 4]], gold: 1600 },
];
export const TAILOR_GEAR = [
    { out: 'woolen_coat', in: [['cloth', 2], ['tag:wool', 1]], gold: 500 },
    { out: 'glim_robe', in: [['cloth', 3], ['glim_bar', 1], ['wisp_dust', 3]], gold: 2500 },
    { out: 'big_pack', in: [['cloth', 2], ['rope', 3]], gold: 1000, once: true },
];

export const ingLabel = key => key.startsWith('tag:') ? 'any ' + key.slice(4) : (ITEM[key]?.name ?? key);

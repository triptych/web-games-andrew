// ============================================================
// The item database. Every icon is drawn procedurally from `ic`
// (a shape painter in gen/art.js) and `hue`.
//   cat   : category (drives sorting, selling and some rules)
//   sell  : base shipping/sell price (0 = can't be sold)
//   tags  : used by recipe slots ("any fruit") and gift tastes
//   food  : { hp, en, buff? } when eaten
//   eq    : equipment stats { slot, atk, def, spd, sp, hp, luck, elem }
// ============================================================

import { CROPS } from './crops.js';

const I = [];
const add = (id, name, cat, sell, ic, hue, extra = {}) => I.push({ id, name, cat, sell, ic, hue, tags: [], ...extra });

// ---------------------------------------------------------------- tools
add('hoe', 'Hoe', 'tool', 0, 'hoe', 30, { desc: 'Tills farm soil so seeds can be planted.' });
add('can', 'Watering Can', 'tool', 0, 'can', 200, { desc: 'Waters tilled soil. Refill at any water.' });
add('axe', 'Axe', 'tool', 0, 'axe', 20, { desc: 'Chops trees, stumps and bushes.' });
add('pick', 'Pickaxe', 'tool', 0, 'pick', 220, { desc: 'Breaks rocks and ore.' });
add('scythe', 'Scythe', 'tool', 0, 'scythe', 90, { desc: 'Cuts grass into fiber and hay, clears weeds.' });

// ---------------------------------------------------------------- crops and seeds
for (const c of CROPS) {
    add(c.id, c.name, 'crop', c.sell, c.shape, c.hue, { tags: ['crop', ...c.tags], food: { hp: Math.round(c.sell / 6), en: Math.round(c.sell / 4) } });
    add('seed_' + c.id, c.name + ' Seeds', 'seed', Math.max(1, Math.round(c.seed / 2)), 'seed', c.hue, { buy: c.seed, crop: c.id, desc: `Plant in tilled soil. ${c.seasons === 'any' ? 'Grows in any season.' : ''}` });
}

// ---------------------------------------------------------------- animal products
add('egg', 'Egg', 'animal', 30, 'egg', 40, { tags: ['egg'] });
add('egg_l', 'Large Egg', 'animal', 55, 'egg', 45, { tags: ['egg'] });
add('duck_egg', 'Duck Egg', 'animal', 60, 'egg', 90, { tags: ['egg'] });
add('gold_feather', 'Golden Feather', 'animal', 250, 'feather', 48, { tags: ['feather'] });
add('milk', 'Milk', 'animal', 60, 'milk', 210, { tags: ['milk'] });
add('milk_l', 'Large Milk', 'animal', 100, 'milk', 200, { tags: ['milk'] });
add('goat_milk', 'Goat Milk', 'animal', 120, 'milk', 40, { tags: ['milk'] });
add('wool', 'Wool', 'animal', 150, 'wool', 50, { tags: ['wool'] });
add('wool_fine', 'Fine Wool', 'animal', 260, 'wool', 300, { tags: ['wool'] });
add('hay', 'Hay', 'mat', 5, 'hay', 55, { desc: 'Animal feed. One bale per animal per day.' });

// ---------------------------------------------------------------- forage (by biome)
const F = (id, name, sell, ic, hue, tags, en = 15) => add(id, name, 'forage', sell, ic, hue, { tags: ['forage', ...tags], food: { hp: Math.round(en / 2), en } });
F('wild_berry', 'Salmonberry', 12, 'berry', 20, ['fruit', 'sweet']);
F('mushroom', 'Brown Mushroom', 25, 'mushroom', 30, ['mushroom']);
F('mint', 'Wild Mint', 20, 'herb', 140, ['herb']);
F('daffodil', 'Daffodil', 30, 'flower', 55, ['flower']);
F('hazelnut', 'Hazelnut', 40, 'nut', 30, ['nut']);
F('leek', 'Wild Leek', 45, 'herb', 100, ['vegetable']);
F('dandelion', 'Dandelion', 25, 'flower', 50, ['flower', 'herb']);
F('clover', 'Four-leaf Clover', 60, 'herb', 120, ['herb', 'lucky']);
F('sunpetal', 'Sunpetal', 55, 'flower', 45, ['flower']);
F('honeycomb', 'Honeycomb', 90, 'honey', 42, ['sweet'], 40);
F('cattail', 'Cattail', 35, 'herb', 80, ['herb']);
F('clam', 'River Clam', 60, 'shell', 25, ['seafood'], 25);
F('frost_lily', 'Frost Lily', 80, 'flower', 190, ['flower']);
F('chestnut', 'Water Chestnut', 55, 'nut', 25, ['nut', 'vegetable']);
F('ember_pepper', 'Ember Pepper', 70, 'pepper', 8, ['vegetable', 'spicy']);
F('firecap', 'Firecap', 80, 'mushroom', 15, ['mushroom', 'spicy']);
F('sulfur', 'Sulfur Bloom', 50, 'crystal', 58, ['mineral'], 0);
F('snowcap', 'Snowcap', 90, 'mushroom', 210, ['mushroom']);
F('pine_nut', 'Pine Nut', 70, 'nut', 35, ['nut']);
F('ice_crystal', 'Ice Crystal', 100, 'crystal', 195, ['mineral'], 0);
F('winter_root', 'Winter Root', 65, 'root', 25, ['vegetable']);

// ---------------------------------------------------------------- materials
add('wood', 'Wood', 'mat', 2, 'wood', 28);
add('hardwood', 'Hardwood', 'mat', 15, 'wood', 12);
add('stone', 'Stone', 'mat', 2, 'stone', 220);
add('clay', 'Clay', 'mat', 5, 'clay', 18);
add('coal', 'Coal', 'mat', 15, 'coal', 0);
add('fiber', 'Fiber', 'mat', 1, 'fiber', 100);
add('sap', 'Sap', 'mat', 3, 'drop', 35);

// ores / bars
const ORES = [['copper', 'Copper', 22, 5], ['iron', 'Iron', 215, 10], ['gold', 'Gold', 48, 25], ['glim', 'Glimmerite', 280, 50]];
for (const [id, n, hue, s] of ORES) {
    add(id + '_ore', n + ' Ore', 'ore', s, 'ore', hue);
    add(id + '_bar', n + ' Bar', 'bar', s * 12, 'bar', hue);
}

// gems — each sets a weapon element at the Forge
export const GEM_ELEM = { emerald: 'leaf', amethyst: 'storm', sapphire: 'frost', ruby: 'ember', onyx: 'shadow', moonstone: 'light' };
add('emerald', 'Emerald', 'gem', 120, 'gem', 140, { tags: ['gem'] });
add('amethyst', 'Amethyst', 'gem', 100, 'gem', 275, { tags: ['gem'] });
add('sapphire', 'Sapphire', 'gem', 150, 'gem', 215, { tags: ['gem'] });
add('ruby', 'Ruby', 'gem', 180, 'gem', 355, { tags: ['gem'] });
add('onyx', 'Onyx', 'gem', 200, 'gem', 260, { tags: ['gem'], dark: true });
add('moonstone', 'Moonstone', 'gem', 260, 'gem', 60, { tags: ['gem'], pale: true });

// monster parts
const MP = [['gel', 'Slime Gel', 'gel', 150], ['fur', 'Soft Fur', 'fur', 30], ['feather', 'Feather', 'feather', 200],
    ['petal', 'Wild Petal', 'flower', 320], ['chitin', 'Chitin', 'shell', 90], ['wisp_dust', 'Wisp Dust', 'dust', 180],
    ['core_stone', 'Core Stone', 'stone', 30], ['spore', 'Spore Puff', 'dust', 80], ['scale', 'Scale', 'shell', 170],
    ['gear', 'Old Gear', 'gear', 40], ['bone', 'Old Bone', 'bone', 45]];
for (const [id, n, ic, hue] of MP) add(id, n, 'monster', 12, ic, hue, { tags: ['monster'] });

// ---------------------------------------------------------------- refined goods
add('plank', 'Plank', 'refined', 8, 'plank', 30);
add('beam', 'Hardwood Beam', 'refined', 40, 'plank', 15);
add('brick', 'Brick', 'refined', 10, 'brick', 10);
add('rope', 'Rope', 'refined', 8, 'rope', 40);
add('cloth', 'Cloth', 'refined', 320, 'cloth', 190);
add('flour', 'Flour', 'refined', 40, 'sack', 45, { tags: ['flour'] });
add('sugar', 'Sugar', 'refined', 50, 'sack', 0, { tags: ['sweet'], pale: true });
add('cheese', 'Cheese', 'refined', 200, 'cheese', 50, { tags: ['cheese'], food: { hp: 30, en: 40 } });
add('goat_cheese', 'Goat Cheese', 'refined', 360, 'cheese', 40, { tags: ['cheese'], food: { hp: 40, en: 50 } });
add('mayo', 'Mayonnaise', 'refined', 120, 'jar', 55, { tags: ['mayo'] });
add('jam', 'Jam', 'refined', 160, 'jar', 350, { tags: ['sweet'], food: { hp: 20, en: 50 } });
add('pickles', 'Pickles', 'refined', 150, 'jar', 90, { food: { hp: 20, en: 45 } });
add('honey', 'Honey', 'refined', 150, 'jar', 42, { tags: ['sweet'], food: { hp: 15, en: 40 } });
add('oil', 'Nut Oil', 'refined', 90, 'jar', 50, { tags: ['oil'] });

// potions (herbalist still, or found)
add('tonic', 'Herbal Tonic', 'potion', 60, 'potion', 120, { food: { hp: 60, en: 10 }, battle: true, desc: 'Restores 60 HP.' });
add('ether', 'Wisp Ether', 'potion', 90, 'potion', 260, { food: { sp: 15 }, battle: true, desc: 'Restores 15 SP.' });
add('elixir', 'Glimmer Elixir', 'potion', 300, 'potion', 50, { food: { hp: 999, sp: 99, en: 50 }, battle: true, desc: 'Fully restores HP and SP.' });
add('smelling_salts', 'Pep Salts', 'potion', 40, 'potion', 20, { food: { en: 60 }, desc: 'Restores 60 energy.' });

// ---------------------------------------------------------------- dishes are generated from recipes.js (see bottom)

// ---------------------------------------------------------------- equipment
const W = (id, name, atk, hue, extra = {}) => add(id, name, 'weapon', atk * 25, 'sword', hue, { eq: { slot: 'weapon', atk, ...extra } });
W('wood_sword', 'Wooden Sword', 2, 30);
W('copper_sword', 'Copper Sword', 5, 22);
W('iron_sword', 'Iron Sword', 9, 215);
W('gold_sword', 'Gold Sword', 14, 48);
W('glim_sword', 'Glimmer Sword', 20, 280);
W('ember_blade', 'Emberforged Blade', 17, 10, { spd: 1 });
W('oathkeeper', 'Oathkeeper', 16, 200, { def: 3 });
W('heart_staff', 'Heartwood Staff', 22, 120, { sp: 10 });
const A = (id, name, def, hue, extra = {}) => add(id, name, 'armor', def * 30, 'armor', hue, { eq: { slot: 'armor', def, ...extra } });
A('tunic', 'Traveler Tunic', 1, 100);
A('leather_vest', 'Leather Vest', 3, 25);
A('iron_mail', 'Iron Mail', 6, 215);
A('gold_mail', 'Gold Mail', 9, 48);
A('glim_robe', 'Glimmer Robe', 13, 280, { sp: 8 });
A('woolen_coat', 'Woolen Coat', 7, 330, { hp: 20 });
const C = (id, name, hue, eq) => add(id, name, 'charm', 150, 'ring', hue, { eq: { slot: 'charm', ...eq } });
C('emerald_ring', 'Emerald Ring', 140, { hp: 25 });
C('amethyst_ring', 'Amethyst Ring', 275, { spd: 3 });
C('sapphire_ring', 'Sapphire Ring', 215, { def: 3 });
C('ruby_ring', 'Ruby Ring', 355, { atk: 3 });
C('moon_ring', 'Moonstone Ring', 60, { sp: 12 });
C('clover_charm', 'Clover Charm', 120, { luck: 8 });
C('bard_pin', 'Minstrel Pin', 320, { spd: 2, luck: 4 });

// ---------------------------------------------------------------- key items / relics
const K = (id, name, ic, hue, desc) => add(id, name, 'relic', 0, ic, hue, { desc, key: true });
K('thornbreaker', 'Thornbreaker', 'sickle', 120, 'An old silver sickle that sings through thornwalls.');
K('stonebreaker', 'Stonebreaker', 'gauntlet', 30, 'Gauntlets that shatter great boulders.');
K('lilypad', 'Lilypad Charm', 'lily', 130, 'Shallow water holds you up like a lily pad.');
K('lantern', 'Glow Lantern', 'lantern', 50, 'Lights dark hollows and dungeon depths.');
K('heart_shard', 'Heart Shard', 'shard', 330, 'A piece of the Heartwood\'s heart. Warm to the touch.');
K('dungeon_key', 'Old Key', 'key', 45, 'Opens a locked door on this floor.');
K('big_pack', 'Big Pack', 'bag', 30, 'Your backpack holds 36 items.');
// villager story items (filled in by names at runtime)
K('keepsake', 'Keepsake', 'locket', 45, 'Something precious someone lost.');

// ---------------------------------------------------------------- placeables
const P = (id, name, ic, hue, sell, extra = {}) => add(id, name, 'place', sell, ic, hue, { place: true, ...extra });
P('sprinkler', 'Sprinkler', 'sprinkler', 22, 40, { desc: 'Waters the 4 tiles beside it each morning.' });
P('sprinkler2', 'Iron Sprinkler', 'sprinkler', 215, 100, { desc: 'Waters the 8 tiles around it each morning.' });
P('furnace', 'Clay Furnace', 'furnace', 18, 50, { station: 'furnace', desc: 'Smelts ore into bars.' });
P('jar', 'Preserves Jar', 'jar', 30, 50, { station: 'jar', desc: 'Turns fruit into jam and vegetables into pickles.' });
P('chest_item', 'Wood Chest', 'chest', 28, 20, { desc: 'Storage you can place anywhere in the Glen.' });
P('lamp', 'Lamp Post', 'lamp', 45, 30, { decor: true, desc: 'Glows at night. +coziness.' });
P('bench', 'Bench', 'bench', 25, 20, { decor: true, desc: 'A place to sit. +coziness.' });
P('planter', 'Flower Planter', 'planter', 330, 25, { decor: true, desc: 'Flowers in a box. +coziness.' });
P('fence', 'Fence', 'fence', 30, 2, { decor: true, fence: true, desc: 'A little fence.' });
P('statue', 'Glen Statue', 'statue', 210, 200, { decor: true, desc: 'A handsome statue. +coziness.' });
P('beehive', 'Bee House', 'beehive', 45, 60, { station: 'beehive', desc: 'Makes honey every 3 days (not in winter).' });

// scrolls are generated from recipes.js
export const ITEMS = I;
export const ITEM = Object.fromEntries(I.map(i => [i.id, i]));

export function registerItem(def) {
    const it = { tags: [], ...def };
    I.push(it); ITEM[it.id] = it;
    return it;
}

export const itemName = id => ITEM[id]?.name ?? id;
export const hasTag = (id, tag) => { const it = ITEM[id]; return !!it && (it.id === tag || it.tags.includes(tag)); };

export const TOOL_TIERS = ['Basic', 'Copper', 'Iron', 'Gold', 'Glimmer'];

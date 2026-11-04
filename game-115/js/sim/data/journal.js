// The Town Journal: a guided path from one hut to a legend. Each entry has a condition checked
// against the live game (see conditionProgress in sim/journal.js), a reward claimed by hand, and
// the entries that must be done first.

export const CHAPTERS = [
    { id: 1, name: 'A Small Beginning', blurb: 'One hut, one neighbour, a lot of trees.' },
    { id: 2, name: 'Neighbours', blurb: 'A town needs a tavern, and a tavern needs customers.' },
    { id: 3, name: 'Hands and Hammers', blurb: 'Planks, bread, beds and a shop for the brave.' },
    { id: 4, name: 'Forge and Fortune', blurb: 'Iron in the ground, steel in the fire.' },
    { id: 5, name: 'Renown', blurb: 'Word is getting around.' },
    { id: 6, name: "The Dragon's Roost", blurb: 'The last big thing on the list.' },
];

const J = [];
const j = (id, ch, title, text, cond, reward, after = []) => J.push({ id, ch, title, text, cond, reward, after });

// ---- 1
j('chop', 1, 'Gather Firewood', 'Tap the trees and boulders around the hut. Every swing counts.', { k: 'hits', n: 8 }, { gold: 10, wood: 10, renown: 1 });
j('rocks', 1, 'Break Some Stone', 'Collect 10 stone from the boulders.', { k: 'have', item: 'stone', n: 10 }, { wood: 15, renown: 1 }, ['chop']);
j('woodshed', 1, 'A Roof for the Woodpile', 'Build a Woodshed from the Build menu (🔨).', { k: 'build', type: 'woodshed' }, { gold: 20, renown: 2 }, ['chop']);
j('staff', 1, 'Put Mabel to Work', 'Open the Woodshed and assign a villager to it, or press Auto-assign.', { k: 'staffed', type: 'woodshed' }, { gold: 10, wood: 10, renown: 1 }, ['woodshed']);
j('quarry', 1, 'Stone Yard', 'Build a Stone Yard so the boulders come to you.', { k: 'build', type: 'quarry' }, { wood: 15, renown: 1 }, ['rocks']);
j('stockpile', 1, 'A Growing Stockpile', 'Hold 60 wood and 30 stone.', { k: 'haveAll', items: { wood: 60, stone: 30 } }, { gold: 40, renown: 2 }, ['staff', 'quarry']);
j('hall2', 1, 'Make Room', 'Upgrade the Hearth Hut to a Cozy Cottage (needs Renown too).', { k: 'hall', lv: 2 }, { gold: 50, renown: 3 }, ['stockpile']);
// ---- 2
j('pop3', 2, 'New Neighbours', 'Welcome newcomers until you have 3 villagers.', { k: 'pop', n: 3 }, { gold: 30, renown: 1 }, ['hall2']);
j('house', 2, 'A Place to Live', 'Build a House so more folk can settle.', { k: 'build', type: 'house' }, { gold: 30, wood: 30, renown: 1 }, ['hall2']);
j('market', 2, 'Open for Trade', 'Build a Market Stall. Pip the Peddler hears about it.', { k: 'build', type: 'market' }, { gold: 40, renown: 2, special: 'pip' }, ['hall2']);
j('farm', 2, 'First Fields', 'Build a Farm and put someone to work in it.', { k: 'staffed', type: 'farm' }, { wheat: 15, renown: 1 }, ['hall2']);
j('tavern', 2, 'The Mossy Mug', 'Build a Tavern.', { k: 'build', type: 'tavern' }, { gold: 60, renown: 3, special: 'tuck' }, ['pop3']);
j('cook', 2, 'A Hot Meal', 'Cook 3 dishes at the Tavern (open it, pick a recipe).', { k: 'cook', n: 3 }, { gold: 40, renown: 2 }, ['tavern', 'farm']);
j('guild', 2, 'Adventurers Wanted', 'Build the Adventurers\' Lodge.', { k: 'build', type: 'guild' }, { gold: 80, renown: 3 }, ['tavern']);
j('hero1', 2, 'Your First Hero', 'Hire a hero from the Lodge.', { k: 'heroes', n: 1 }, { gold: 60, bandage: 3, renown: 2 }, ['guild']);
j('quest1', 2, 'First Expedition', 'Send a hero out on a quest and bring them home.', { k: 'quests', n: 1 }, { gold: 80, renown: 4 }, ['hero1']);
j('hall3', 2, 'Hearth and Home', 'Upgrade the Hall to a Timber Lodge.', { k: 'hall', lv: 3 }, { gold: 100, renown: 5 }, ['quest1', 'market']);
// ---- 3
j('planks', 3, 'Fresh Planks', 'Build a Carpenter and saw 10 planks.', { k: 'craft', item: 'plank', n: 10 }, { gold: 60, renown: 2 }, ['hall3']);
j('bread', 3, 'Better Bread', 'Build a Windmill and bake 3 loaves of bread.', { k: 'cookItem', item: 'bread', n: 3 }, { gold: 60, renown: 2 }, ['hall3']);
j('inn', 3, 'A Warm Bed', 'Build an Inn so heroes can sleep indoors.', { k: 'build', type: 'inn' }, { gold: 80, renown: 2 }, ['hall3']);
j('weapon', 3, 'Armed for Adventure', 'Craft a weapon for your heroes.', { k: 'craftCat', cat: 'gear', n: 1 }, { gold: 60, renown: 2 }, ['planks']);
j('shop', 3, 'Open the Shop', 'Build the Item Shop.', { k: 'build', type: 'itemshop' }, { gold: 80, renown: 2 }, ['planks']);
j('sold', 3, 'Open for Business', 'Stock the shelves; sell 3 things to heroes.', { k: 'sold', n: 3 }, { gold: 120, renown: 3 }, ['shop', 'weapon', 'hero1']);
j('herbs', 3, 'Herbal Remedies', 'Build a Herb Garden and the Healing Garden. Brenna will come to help.', { k: 'buildAll', types: ['herbgarden', 'healer'] }, { gold: 100, renown: 2, special: 'brenna' }, ['hall3']);
j('orchard', 3, 'Fruit and Fish', 'Build an Orchard and a Fishing Dock. Cap\'n Fenn has opinions on the dock.', { k: 'buildAll', types: ['orchard', 'dock'] }, { gold: 100, renown: 2, special: 'fenn' }, ['hall3']);
j('hero3', 3, 'A Band of Three', 'Have 3 heroes.', { k: 'heroes', n: 3 }, { gold: 100, renown: 2 }, ['sold']);
j('raid1', 3, 'Defend the Hearth', 'Keep the town safe through its first raid.', { k: 'raids', n: 1 }, { gold: 100, renown: 4 }, ['hero1']);
j('marsh', 3, 'Into the Mist', 'Complete a quest in the Misty Marsh.', { k: 'region', id: 'marsh' }, { gold: 120, renown: 3 }, ['hero3']);
j('hall4', 3, 'A Manor of Stone', 'Upgrade the Hall to a Stone Manor.', { k: 'hall', lv: 4 }, { gold: 200, renown: 6 }, ['marsh', 'raid1']);
// ---- 4
j('mine', 4, 'Down the Shaft', 'Build a Mine.', { k: 'build', type: 'mine' }, { gold: 120, renown: 2 }, ['hall4']);
j('ingots', 4, 'Hot Iron', 'Build a Smithy and smelt 5 ingots.', { k: 'craft', item: 'ingot', n: 5 }, { gold: 120, renown: 3, special: 'thorne' }, ['mine']);
j('cloth', 4, 'Spun Fiber', 'Build a Weaver and make 5 cloth.', { k: 'craft', item: 'cloth', n: 5 }, { gold: 100, renown: 2 }, ['hall4']);
j('tier2', 4, 'Iron and Leather', 'Craft a tier-2 weapon or armor.', { k: 'gearTierMade', tier: 2 }, { gold: 140, renown: 3 }, ['ingots', 'cloth']);
j('hero5', 4, 'A Proper Company', 'Have 5 heroes.', { k: 'heroes', n: 5 }, { gold: 180, renown: 3 }, ['hall4']);
j('herolv', 4, 'Seasoned', 'Have a hero reach level 8.', { k: 'heroLv', n: 8 }, { gold: 160, renown: 3 }, ['hero5']);
j('caves', 4, 'Glimmer Caves', 'Complete a quest in the Glimmer Caves.', { k: 'region', id: 'caves' }, { gold: 220, gem: 2, renown: 4 }, ['herolv']);
j('hives', 4, 'Hens and Honey', 'Build a Hen House and an Apiary.', { k: 'buildAll', types: ['henhouse', 'apiary'] }, { gold: 140, renown: 2 }, ['hall4']);
j('tower', 4, 'Eyes on the Road', 'Build a Watchtower.', { k: 'build', type: 'watchtower' }, { gold: 120, renown: 2 }, ['hall4']);
j('hall5', 4, 'Town Hall', 'Upgrade the Hall to a Town Hall.', { k: 'hall', lv: 5 }, { gold: 400, renown: 8 }, ['caves', 'tier2']);
// ---- 5
j('library', 5, 'Books and Candles', 'Build a Library. Sage Orla heard about it from three counties away.', { k: 'build', type: 'library' }, { gold: 300, renown: 4, special: 'orla' }, ['hall5']);
j('alch', 5, 'Bubbling Pots', 'Build the Alchemist and brew a potion.', { k: 'craftCat', cat: 'potion', n: 1 }, { gold: 200, renown: 3 }, ['hall5']);
j('upg5', 5, 'Better Ways', 'Buy 5 town upgrades.', { k: 'upgrades', n: 5 }, { gold: 300, renown: 4 }, ['hall5']);
j('hero8', 5, 'Eight Is Plenty', 'Have 8 heroes.', { k: 'heroes', n: 8 }, { gold: 300, renown: 4 }, ['hall5']);
j('ruins', 5, 'The Drowned City', 'Complete a quest in the Sunken Ruins.', { k: 'region', id: 'ruins' }, { gold: 400, relic: 1, renown: 5 }, ['hero8']);
j('cozy150', 5, 'A Cozy Town', 'Bring the town\'s coziness to 150.', { k: 'cozy', n: 150 }, { gold: 300, renown: 4 }, ['hall5']);
j('frost', 5, 'Frostpeak', 'Complete a quest in Frostpeak Pass.', { k: 'region', id: 'frost' }, { gold: 600, pelt: 2, renown: 6 }, ['ruins']);
j('herolv15', 5, 'Veterans', 'Have a hero reach level 15.', { k: 'heroLv', n: 15 }, { gold: 400, renown: 5 }, ['hero8']);
j('hall6', 5, 'The Grand Hearthhall', 'Upgrade the Hall to its grandest form.', { k: 'hall', lv: 6 }, { gold: 1000, renown: 12 }, ['frost', 'upg5']);
// ---- 6
j('feast', 6, 'Prepare the Feast', 'Cook 2 Harvest Feasts. Dragons, it turns out, respond to hospitality.', { k: 'have', item: 'harvest_feast', n: 2 }, { gold: 500, renown: 5 }, ['hall6']);
j('gear4', 6, 'Armed for Legend', 'Have 4 heroes in tier-4 weapons and armor.', { k: 'gearTier', tier: 4, n: 4 }, { gold: 800, renown: 6 }, ['hall6']);
j('dragon', 6, "Cinderwing's Roost", 'Send a party of four to the Roost. They will come back, or the story ends here.', { k: 'boss' }, { gold: 3000, relic: 3, gem: 8, renown: 25 }, ['feast', 'gear4']);

export const JOURNAL = Object.fromEntries(J.map((e) => [e.id, e]));
export const JOURNAL_IDS = J.map((e) => e.id);

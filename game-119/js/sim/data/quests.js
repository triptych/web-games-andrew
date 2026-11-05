// Hand-written quests: the Hero's chain (s0-s7) and forty-odd town quests. Each is one-time.
// req: { t, n, lv? } - gear is satisfied by any piece of at least lv. turn = where you hand it in (default: where it was given).

const Q = (id, town, giver, title, text, req, gold, lv = 1, extra = {}) => ({
    id, town, giver, title, text, req: req.map(([t, n, l]) => (l ? { t, n, lv: l } : { t, n })), reward: { gold, xp: extra.xp ?? Math.round(gold * 0.55), rep: extra.rep ?? 1, items: extra.items || [] },
    lv, after: extra.after || null, turn: extra.turn || town, story: !!extra.story, call: !!extra.call,
});

export const STORY_QUESTS = [
    Q('s0', 'hearthmere', 'Pim the baker', 'Gran\'s Handcart', 'Pim needs six sacks of Grain delivered to Willowbrook. Buy them at the Hearthmere market and carry them over.', [['grain', 6]], 60, 1, { turn: 'willowbrook', story: true }),
    Q('s1', 'hearthmere', 'Kaelen Dawnward', 'The Broken Blade', 'A wandering hero has broken his sword. Craft him a sword at the village forge (or buy one) and bring it to the Hero\'s tent.', [['sword', 1, 1]], 170, 1, { after: 's0', story: true, xp: 110 }),
    Q('s2', 'stonebridge', 'Kaelen Dawnward', 'Supplies for the Heartland', 'The Hero\'s company needs three healing potions (level 2 or better) and four rations.', [['potion', 3, 2], ['rations', 4, 1]], 650, 4, { after: 's1', story: true, xp: 520 }),
    Q('s3', 'emberforge', 'Thorgrim Ironbeard', 'A Cuirass for a Legend', 'Thorgrim will forge nothing for free: bring the Hero a level 5 armor and a level 5 helm.', [['armor', 1, 5], ['helm', 1, 5]], 2100, 8, { after: 's2', story: true, xp: 1250 }),
    Q('s4', 'mistwood', 'Elowen', 'Moonlit Gifts', 'The elves ask for grown things: two level 6 elixirs, two level 5 potions and a level 6 amulet.', [['elixir', 2, 6], ['potion', 2, 5], ['amulet', 1, 6]], 2800, 9, { after: 's3', story: true, xp: 1700 }),
    Q('s5', 'frostpeak', 'Jarl Hrolf', 'Winter at the Hold', 'The Jarl wants level 7 boots, a level 7 shield and a level 6 camp kit for the Hero\'s winter.', [['boots', 1, 7], ['shield', 1, 7], ['kit', 1, 6]], 4300, 12, { after: 's4', story: true, xp: 2600 }),
    Q('s6', 'dragonwatch', 'Captain Rhea', 'Scales and Wounds', 'Three level 8 healing potions for the wounded and one level 8 sword that bites dragon-scale.', [['potion', 3, 8], ['sword', 1, 8]], 6200, 13, { after: 's5', story: true, xp: 3600 }),
    Q('s7', 'aurelion', 'Kaelen Dawnward', 'The Hero\'s Call', 'Kaelen is waiting at the Dawn Camp outside Aurelion. Go and hear his request.', [], 2500, 16, { after: 's6', story: true, call: true, xp: 2500 }),
];

export const SIDE_QUESTS = [
    // Greenmarch
    Q('h1', 'hearthmere', 'Pim', 'Bread for the Bakery', 'The bakery is out of flour money. Ten sacks of Grain will see Pim through the week.', [['grain', 10]], 55),
    Q('h2', 'hearthmere', 'Old Garrick', 'Gran\'s Old Debt', 'Your grandmother owed Garrick four copper ingots. He is not the type to forget.', [['copper_ingot', 4]], 90),
    Q('h3', 'hearthmere', 'Tilly', 'A Warm Winter', 'Tilly wants six bolts of Linen for the winter blankets.', [['linen', 6]], 60),
    Q('h4', 'hearthmere', 'Old Garrick', 'Garrick\'s Whetstones', 'Rose Quartz makes the finest whetstones, says Garrick. Three pieces, if you can find them.', [['quartz', 3]], 80, 2),
    Q('w1', 'willowbrook', 'Wren', 'Fever Tea', 'There is a fever in the hamlet. Wren needs ten Greenleaf for the tea.', [['greenleaf', 10]], 55),
    Q('w2', 'willowbrook', 'Marigold', 'Marigold\'s Loom', 'Eight bolts of Linen and two jars of Wild Honey for the harvest-fair banner.', [['linen', 8], ['honey', 2]], 130),
    Q('w3', 'willowbrook', 'Dobbin', 'The Ferryman\'s Thirst', 'Dobbin will ferry you free for life if you bring him two bottles of Hearthland Wine.', [['wine', 2]], 110, 2),
    Q('w4', 'willowbrook', 'Wren', 'A Draught for Dobbin', 'Dobbin\'s back is bad. A healing draught of any level would help.', [['potion', 2, 1]], 100, 1),
    Q('c1', 'copperfield', 'Hettie', 'Hungry Miners', 'Eight packets of Smoked Jerky for the night shift.', [['jerky', 8]], 100),
    Q('c2', 'copperfield', 'Brann', 'Shoring Timbers', 'Six Pine Planks to shore up the old shaft.', [['pine', 6]], 70),
    Q('c3', 'copperfield', 'Brann', 'Brann\'s Best Blade', 'Brann wants a sword of level 2 or better. He says it is "for the rats".', [['sword', 1, 2]], 220, 2),
    Q('c4', 'copperfield', 'Little Joss', 'Joss\'s First Boots', 'Joss has never owned boots. Any boots will do.', [['boots', 1, 1]], 90, 1),
    // Heartland
    Q('b1', 'stonebridge', 'Guildmistress Orla', 'The Guildmistress\'s Order', 'Six Iron Ingots for the guild\'s new strongroom door.', [['iron_ingot', 6]], 260, 4),
    Q('b2', 'stonebridge', 'Fenwick', 'Wagon Wheels', 'Six Oak Beams for a rush order of wagon wheels.', [['oak', 6]], 210, 4),
    Q('b3', 'stonebridge', 'Dame Vesper', 'A Gift for Dame Vesper', 'Dame Vesper wants two flasks of Rose Perfume and two pieces of fine Glassware.', [['perfume', 2], ['glassware', 2]], 620, 5),
    Q('b4', 'stonebridge', 'Fenwick', 'Fenwick\'s Fancy Axle', 'Two Steel Ingots for an axle that will not break.', [['steel_ingot', 2]], 330, 5),
    Q('b5', 'stonebridge', 'Guildmistress Orla', 'The Tournament', 'The spring tournament needs two level 3 swords and a level 3 helm.', [['sword', 2, 3], ['helm', 1, 3]], 1100, 6),
    Q('o1', 'oakhollow', 'Thistle', 'Beekeeper\'s Plea', 'Six jars of Wild Honey to feed the hives through winter.', [['honey', 6]], 240, 4),
    Q('o2', 'oakhollow', 'Ranger Alder', 'The Ranger\'s Pack', 'A level 2 camp kit and two level 2 rations for the patrol.', [['kit', 1, 2], ['rations', 2, 2]], 460, 4),
    Q('o3', 'oakhollow', 'Bessie', 'Hides for the Hall', 'Eight pieces of Soft Leather for the Great Hall\'s benches.', [['leather', 8]], 290, 4),
    Q('o4', 'oakhollow', 'Ranger Alder', 'Alder\'s Arrow Shafts', 'Four Oak Beams and four packets of Jerky for the long patrol.', [['oak', 4], ['jerky', 4]], 200, 4),
    Q('m1', 'saltmarsh', 'Nettie', 'Salt for the Stew', 'Fifteen sacks of Sea Salt for the fish-packers.', [['salt', 15]], 150, 4),
    Q('m2', 'saltmarsh', 'Captain Marlow', 'A String of Pearls', 'Four Sea Pearls for the captain\'s wedding necklace.', [['pearls', 4]], 560, 5),
    Q('m3', 'saltmarsh', 'Captain Marlow', 'The Captain\'s Cutlass', 'A sword of level 4 or better, with a good grip for the deck.', [['sword', 1, 4]], 640, 5),
    Q('m4', 'saltmarsh', 'Quill', 'Smuggler\'s Wine', 'Six bottles of Hearthland Wine, and no questions asked.', [['wine', 6]], 330, 4),
    // Sunreach & Emberlands
    Q('e1', 'emberforge', 'Bofur', 'Fuel for the Fires', 'Fifteen sacks of Coal. The dwarves never run out of anvils, only fuel.', [['coal', 15]], 340, 8),
    Q('e2', 'emberforge', 'Dagna', 'Dagna\'s First Helm', 'The apprentice must present a helm. She wants a level 4 helm to copy.', [['helm', 1, 4]], 700, 8),
    Q('e3', 'emberforge', 'Thorgrim Ironbeard', 'A Feast Underground', 'Six jars of Honey and four bottles of Wine for the Forge Day feast.', [['honey', 6], ['wine', 4]], 760, 8),
    Q('e4', 'emberforge', 'Bofur', 'Bofur\'s Gems', 'Six Garnets for the miners\' guild ring.', [['garnet', 6]], 580, 8),
    Q('u1', 'sunspire', 'Sultana Amira', 'Spice for the Sultana', 'Six jars of Desert Spice, finest grade.', [['spice', 6]], 880, 8),
    Q('u2', 'sunspire', 'Layla', 'Layla\'s Lenses', 'Six pieces of Glassware and two Sapphires for the great telescope.', [['glassware', 6], ['sapphire', 2]], 1050, 8),
    Q('u3', 'sunspire', 'Zahid', 'Rose Water', 'Four flasks of Rose Perfume for the festival of lights.', [['perfume', 4]], 1100, 9),
    Q('u4', 'sunspire', 'Zahid', 'Zahid\'s Rare Stones', 'Four Sapphires for a very important customer.', [['sapphire', 4]], 880, 9),
    Q('mi1', 'mistwood', 'Sylwen', 'Lanterns of the Grove', 'Four lumps of Amber to light the old lanterns.', [['amber', 4]], 800, 8),
    Q('mi2', 'mistwood', 'Faelar', 'The Bowyer\'s Wood', 'Three lengths of Elderwood for a bow that has not been made in ages.', [['elderwood', 3]], 950, 9),
    Q('mi3', 'mistwood', 'Elowen', 'The Herb-Sage\'s Order', 'Fifteen Moonpetal and four Fireroot for a rite the elves do not explain.', [['moonpetal', 15], ['fireroot', 4]], 820, 8),
    // Frostmark
    Q('f1', 'frostpeak', 'Old Bjorn', 'Winter Stores', 'Fifteen Jerky and fifteen Grain, before the pass closes.', [['jerky', 15], ['grain', 15]], 1000, 12),
    Q('f2', 'frostpeak', 'Jarl Hrolf', 'Mithril for the Jarl', 'Three Mithril Ingots for the Jarl\'s ancestral axe.', [['mithril_ingot', 3]], 1900, 12),
    Q('f3', 'frostpeak', 'Sigrid', 'Sigrid\'s Shield', 'A level 6 shield for the shield-maiden who has broken two this winter.', [['shield', 1, 6]], 1800, 12),
    Q('f4', 'frostpeak', 'Old Bjorn', 'Bjorn\'s Furs', 'Six Winter Furs. The old trapper has outlived his own supply.', [['furs', 6]], 1050, 12),
    Q('d1', 'dragonwatch', 'Scorch', 'Scales for the Smith', 'Four pieces of Drakeskin for a smith in a hurry.', [['drakeskin', 4]], 2100, 13),
    Q('d2', 'dragonwatch', 'Mother Ashby', 'Ashby\'s Hearth Fire', 'Fifteen Coal and six Fireroot for the inn\'s great hearth.', [['coal', 15], ['fireroot', 6]], 1250, 13),
    Q('d3', 'dragonwatch', 'Captain Rhea', 'Dragon-slayer\'s Draught', 'Two level 7 healing potions for the hunters.', [['potion', 2, 7]], 2300, 13),
    // Crownlands
    Q('a1', 'aurelion', 'Seneschal Idris', 'The Royal Banquet', 'Six Sunfruit and four jars of Spice for a banquet in the Hero\'s honour.', [['sunfruit', 6], ['spice', 4]], 4200, 16),
    Q('a2', 'aurelion', 'Seneschal Idris', 'The Seneschal\'s Order', 'Four Mithril Ingots and two bolts of Phoenix Silk for the royal tailors.', [['mithril_ingot', 4], ['phoenixsilk', 2]], 5800, 16),
    Q('a3', 'aurelion', 'Lady Corvane', 'Lady Corvane\'s Perfume', 'Six flasks of Rose Perfume, because it is Tuesday.', [['perfume', 6]], 2800, 16),
    Q('a4', 'aurelion', 'Pip', 'The Page\'s Helm', 'Pip wants a level 8 helm to look the part of a knight.', [['helm', 1, 8]], 4600, 16),
    Q('t1', 'starfall', 'Astra', 'The Star-seer\'s Offering', 'Eight jars of Honey and four bottles of Wine for the star rites.', [['honey', 8], ['wine', 4]], 2900, 16),
    Q('t2', 'starfall', 'Cinder', 'Cinder\'s Nest', 'Fifteen Coal and fifteen Grain for the phoenix fledglings.', [['coal', 15], ['grain', 15]], 2000, 16),
    Q('t3', 'starfall', 'Old Tam', 'The Prospector\'s Pick', 'Six Steel Ingots for a pick that can bite starmetal.', [['steel_ingot', 6]], 3600, 16),
];
export const QUESTS = {};
for (const q of [...STORY_QUESTS, ...SIDE_QUESTS]) QUESTS[q.id] = q;
export const STORY_ORDER = STORY_QUESTS.map((q) => q.id);

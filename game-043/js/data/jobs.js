// ============================================================
// Villager jobs: what they need, what they give, how they fight,
// what quests they are good at, and the shape of their story.
// Story text uses {name}, {they}, {them}, {their}, {place}, {item},
// {rival}, {friend}, {town} — filled in from the seed.
// ============================================================

export const JOBS = {
    carpenter: {
        name: 'Carpenter', building: 'workshop', level: 1,
        daily: [['wood', 8, 14], ['plank', 1, 3]],
        passive: 'Everything costs 20% less to build. Sells decorations.',
        fit: ['wood', 'hardwood', 'plank', 'fiber', 'sap'], questFit: { gather: 1.2, hunt: 0.8, delve: 0.8, expedition: 1.0 },
        skill: { name: 'Hammer Toss', kind: 'hit', pow: 1.1 },
        loves: ['hardwood', 'beam', 'mushroom_stew', 'pancakes'], likes: ['tag:nut', 'tag:mushroom', 'plank'], hates: ['tag:monster', 'clay'],
        story: [
            { title: 'Old Plans', need: 2, ask: "When I was an apprentice in {town}, my master drew up plans for a bridge that never got built. I think I left the drafting pencil in the {place}. Silly thing to miss… Could you look for it?", item: 'Drafting Pencil', where: 'dungeon', reward: { items: [['bench', 2]], gold: 200 } },
            { title: 'The Rival Joiner', need: 5, ask: "{rival} from {town} wrote to say our Glen is \"a pile of sticks\". I'd like to prove them wrong. Could you bring me 5 Hardwood Beams? I'll build something to make them eat those words.", deliver: [['beam', 5]], reward: { items: [['statue', 1]], xp: 30 } },
            { title: 'A Place to Rest', need: 8, ask: "I've got one last project: a bench under the Heartwood, carved with everyone's names. I need 10 Hardwood and a Golden Feather for the inlay.", deliver: [['hardwood', 10], ['gold_feather', 1]], reward: { items: [['glimmer_cake', 2]], blessing: 'build', xp: 50 } },
        ],
    },
    farmer: {
        name: 'Farmer', building: 'farmhouse', level: 1,
        daily: [['tag:seasonCrop', 2, 4], ['wheat', 2, 5]],
        passive: 'Waters 12 of your tilled tiles every morning. Sells seeds.',
        fit: ['crop', 'grain', 'forage'], questFit: { gather: 1.25, hunt: 0.7, delve: 0.7, expedition: 1.0 },
        skill: { name: 'Pitchfork', kind: 'hit', pow: 1.0 },
        loves: ['pumpkin', 'melon', 'corn_chowder', 'honey'], likes: ['tag:crop', 'tag:flower'], hates: ['tag:mineral', 'coal'],
        story: [
            { title: 'Heirloom Seeds', need: 2, ask: "My grandmother kept a tin of heirloom seeds from {town}. It went missing when I moved. A peddler said a tin like it was traded near the {place}. Would you look?", item: 'Seed Tin', where: 'dungeon', reward: { items: [['seed_melon', 5], ['seed_pumpkin', 5]] } },
            { title: 'The County Fair', need: 5, ask: "{rival} wins the county fair every year with the same giant pumpkin. Help me show them? Bring me a Pumpkin, a Melon and a Cauliflower — our best!", deliver: [['pumpkin', 1], ['melon', 1], ['cauliflower', 1]], reward: { gold: 1500, xp: 30 } },
            { title: 'Starseed', need: 8, ask: "The old stories say a Starbloom grew by the Heartwood. If you ever find its seed, plant it… and bring me the first bloom. I'd like to see one before I'm old.", deliver: [['starbloom', 1]], reward: { items: [['seed_starbloom', 3]], blessing: 'farm', xp: 50 } },
        ],
    },
    blacksmith: {
        name: 'Blacksmith', building: 'forge', level: 2,
        daily: [['copper_bar', 1, 2], ['coal', 1, 3]],
        passive: 'Upgrades tools and forges weapons, armour and rings.',
        fit: ['ore', 'bar', 'coal', 'gem'], questFit: { gather: 1.0, hunt: 1.15, delve: 1.1, expedition: 1.0 },
        skill: { name: 'Smash', kind: 'hit', pow: 1.6 },
        loves: ['ruby', 'gold_bar', 'ember_chili'], likes: ['tag:gem', 'coal', 'tag:spicy'], hates: ['tag:flower', 'tag:sweet'],
        story: [
            { title: "Master's Hammer", need: 2, ask: "My old master in {town} gave me a hammer when I earned my apron. I lost it running from a monster in the {place}. I'd give a lot to hold it again.", item: 'Old Hammer', where: 'dungeon', reward: { items: [['iron_bar', 5]] } },
            { title: 'Fire in the Belly', need: 5, ask: "I want to forge something worthy of the Glen. I need a Ruby, 3 Gold Bars and 5 Coal.", deliver: [['ruby', 1], ['gold_bar', 3], ['coal', 5]], reward: { items: [['ember_blade', 1]], xp: 30 } },
            { title: 'Letter to {rival}', need: 8, ask: "{rival} and I trained together and fell out over something stupid. I've written a letter. Would you post it through the Job Board runner — and bring me some Moonstone so I can send a gift?", deliver: [['moonstone', 1]], reward: { blessing: 'smith', gold: 2000, xp: 50 } },
        ],
    },
    rancher: {
        name: 'Rancher', building: 'ranch', level: 2,
        daily: [['hay', 6, 10], ['milk', 0, 2]],
        passive: 'Feeds your animals every morning and makes them happier. Sells animals and hay.',
        fit: ['animal', 'hay', 'fiber'], questFit: { gather: 1.1, hunt: 0.9, delve: 0.8, expedition: 1.1 },
        skill: { name: 'Lasso', kind: 'hit', pow: 1.0, stun: true },
        loves: ['wool_fine', 'cheese', 'pancakes'], likes: ['tag:milk', 'tag:egg', 'hay'], hates: ['tag:monster', 'coal'],
        story: [
            { title: 'The Runaway Bell', need: 2, ask: "My first cow wore a brass bell I'd had since {town}. The bell came off in the {place} while I was out looking for strays. Could you find it?", item: 'Brass Bell', where: 'dungeon', reward: { items: [['hay', 40]], gold: 300 } },
            { title: 'Prize Wool', need: 5, ask: "{rival}'s flock took the ribbon at the wool fair again. I think ours can do better. Bring me 3 Fine Wool?", deliver: [['wool_fine', 3]], reward: { gold: 1800, xp: 30 } },
            { title: 'A Golden Morning', need: 8, ask: "Legend says a hen with a golden feather brings a whole farm luck. Bring me a Golden Feather and I'll make you something special.", deliver: [['gold_feather', 1]], reward: { items: [['clover_charm', 1]], blessing: 'ranch', xp: 50 } },
        ],
    },
    cook: {
        name: 'Cook', building: 'cafe', level: 2,
        daily: [['bread', 1, 2], ['tag:dish', 0, 1]],
        passive: 'Runs the Café. Teaches you a recipe at every other heart.',
        fit: ['dish', 'crop', 'forage'], questFit: { gather: 1.0, hunt: 0.8, delve: 0.8, expedition: 1.0 },
        skill: { name: 'Snack Break', kind: 'heal', pow: 0.25 },
        loves: ['glimmer_cake', 'honey', 'tag:spicy'], likes: ['tag:dish', 'tag:fruit', 'tag:herb'], hates: ['tag:mineral', 'tag:monster'],
        story: [
            { title: 'The Lost Cookbook', need: 2, ask: "Mum's handwritten cookbook from {town}… I brought it on the road and lost it when the wagon tipped near the {place}. Every recipe I know is in there.", item: 'Handwritten Cookbook', where: 'dungeon', reward: { recipe: 3 } },
            { title: 'A Cook-off', need: 5, ask: "{rival} is coming through on their tour and challenged me to a cook-off! I need Pumpkin Soup, Berry Tart and Mushroom Stew — would you make them?", deliver: [['pumpkin_soup', 1], ['berry_tart', 1], ['mushroom_stew', 1]], reward: { gold: 1500, recipe: 1, xp: 30 } },
            { title: 'Feast for Everyone', need: 8, ask: "When the Heartwood blooms, I want to cook for the whole Glen. Bring me the rarest thing you can find: a Starbloom and 3 Honey.", deliver: [['starbloom', 1], ['honey', 3]], reward: { teach: 'heartwood_feast', blessing: 'cook', xp: 50 } },
        ],
    },
    herbalist: {
        name: 'Herbalist', building: 'apothecary', level: 3,
        daily: [['tag:herb', 2, 4], ['tonic', 1, 2]],
        passive: 'Brews tonics and potions. If you faint, you wake up at the Apothecary without losing gold.',
        fit: ['herb', 'forage', 'flower', 'mushroom'], questFit: { gather: 1.2, hunt: 0.9, delve: 1.0, expedition: 1.05 },
        skill: { name: 'Heal', kind: 'heal', pow: 0.35 },
        loves: ['frost_lily', 'clover', 'herb_tea'], likes: ['tag:herb', 'tag:flower', 'tag:mushroom'], hates: ['coal', 'tag:spicy'],
        story: [
            { title: 'The Pressed Flower', need: 2, ask: "I kept a book of pressed flowers from {town}. My favourite page — a flower from {friend} — slipped out somewhere in the {place}.", item: 'Pressed Flower', where: 'dungeon', reward: { items: [['tonic', 5]] } },
            { title: 'Rare Remedy', need: 5, ask: "{friend} back home has a cough nothing helps. I think a Frost Lily, a Snowcap and a Four-leaf Clover might. Would you gather them?", deliver: [['frost_lily', 1], ['snowcap', 1], ['clover', 1]], reward: { items: [['elixir', 2]], xp: 30 } },
            { title: 'Moonwell Water', need: 8, ask: "A moonwell's water under a full moon can cure anything, they say. Bring me 3 Wisp Dust and a Moonstone and I'll brew something rare for you.", deliver: [['wisp_dust', 3], ['moonstone', 1]], reward: { items: [['elixir', 3], ['moon_ring', 1]], blessing: 'herb', xp: 50 } },
        ],
    },
    merchant: {
        name: 'Merchant', building: 'store', level: 3,
        daily: [['gold', 80, 200]],
        passive: 'The General Store: seeds, supplies and rarities. Shipping prices +15%.',
        fit: ['refined', 'gem', 'dish'], questFit: { gather: 1.05, hunt: 0.8, delve: 0.8, expedition: 1.2 },
        skill: { name: 'Coin Toss', kind: 'hit', pow: 0.9, gold: true },
        loves: ['tag:gem', 'gold_bar', 'melon_sorbet'], likes: ['tag:refined', 'jam', 'honey'], hates: ['fiber', 'tag:monster'],
        story: [
            { title: 'The Ledger', need: 2, ask: "My family's trading ledger — sixty years of {town} accounts — fell off my cart near the {place}. It's worth nothing to anyone but me.", item: 'Trading Ledger', where: 'dungeon', reward: { gold: 800 } },
            { title: 'A Trade Route', need: 5, ask: "If I can show {rival}'s trading company our goods, they'll send a caravan here. I need Jam, Cheese and Cloth as samples.", deliver: [['jam', 1], ['cheese', 1], ['cloth', 1]], reward: { gold: 2500, xp: 30 } },
            { title: 'The Glimmer Exchange', need: 8, ask: "I dream of a market day in the Glen with folk from every land. Bring me 5 Glimmer Bars as the first stock and we'll have one.", deliver: [['glim_bar', 5]], reward: { gold: 8000, blessing: 'trade', xp: 50 } },
        ],
    },
    tailor: {
        name: 'Tailor', building: 'loft', level: 3,
        daily: [['cloth', 0, 1], ['rope', 1, 2]],
        passive: 'Weaves cloth and rope, sews armour, and can make you a Big Pack.',
        fit: ['wool', 'fiber', 'cloth', 'fur'], questFit: { gather: 1.1, hunt: 0.9, delve: 0.9, expedition: 1.05 },
        skill: { name: 'Needlepoint', kind: 'hit', pow: 1.2 },
        loves: ['wool_fine', 'sapphire', 'blueberry_muffin'], likes: ['tag:wool', 'cloth', 'tag:flower'], hates: ['clay', 'coal'],
        story: [
            { title: 'Silver Thimble', need: 2, ask: "My silver thimble — the one {friend} gave me when I left {town} — is gone. I last had it when I was sketching by the {place}.", item: 'Silver Thimble', where: 'dungeon', reward: { items: [['cloth', 3]] } },
            { title: 'Festival Banners', need: 5, ask: "I'd like to sew banners for the Glen. 3 Cloth, 2 Sunpetals and some Wild Petals for dye.", deliver: [['cloth', 3], ['sunpetal', 2], ['petal', 3]], reward: { items: [['woolen_coat', 1]], xp: 30 } },
            { title: 'The Starlight Cloak', need: 8, ask: "I want to make a cloak woven with starlight. {rival} said it can't be done. I need Fine Wool, 3 Wisp Dust and a Moonstone.", deliver: [['wool_fine', 1], ['wisp_dust', 3], ['moonstone', 1]], reward: { items: [['glim_robe', 1]], blessing: 'tailor', xp: 50 } },
        ],
    },
    miner: {
        name: 'Miner', building: 'lodge', level: 4,
        daily: [['stone', 10, 20], ['tag:regionOre', 3, 6], ['coal', 1, 3]],
        passive: 'Brings ore every morning. Great on gathering and delving quests.',
        fit: ['ore', 'stone', 'coal', 'gem', 'clay'], questFit: { gather: 1.25, hunt: 1.0, delve: 1.25, expedition: 1.1 },
        skill: { name: 'Rockfall', kind: 'all', pow: 0.8 },
        loves: ['tag:gem', 'ember_chili', 'lake_chowder'], likes: ['tag:ore', 'coal', 'tag:dish'], hates: ['tag:flower', 'tag:sweet'],
        story: [
            { title: 'The Lucky Lamp', need: 2, ask: "My old helmet lamp — the lucky one from the {town} pits — cracked and I dropped it down a shaft in the {place}.", item: 'Lucky Lamp', where: 'dungeon', reward: { items: [['gold_ore', 10]] } },
            { title: 'Deep Vein', need: 5, ask: "{rival} swears there's no glimmerite this side of the mountains. Bring me 10 Glimmerite Ore and I'll mail them a lump.", deliver: [['glim_ore', 10]], reward: { items: [['glim_bar', 2]], xp: 30 } },
            { title: 'A Gem for Every Colour', need: 8, ask: "I want to set a gem of every colour into the Glen's statue. Emerald, Amethyst, Sapphire, Ruby, Onyx. Help me?", deliver: [['emerald', 1], ['amethyst', 1], ['sapphire', 1], ['ruby', 1], ['onyx', 1]], reward: { gold: 5000, blessing: 'mine', xp: 50 } },
        ],
    },
    guard: {
        name: 'Guard', building: 'tower', level: 4,
        daily: [['tag:monster', 1, 3]],
        passive: 'Fewer monsters roam near the Glen. The best companion.',
        fit: ['monster'], questFit: { gather: 0.9, hunt: 1.35, delve: 1.2, expedition: 1.1 },
        skill: { name: 'Shield Bash', kind: 'hit', pow: 1.4, taunt: true },
        loves: ['iron_sword', 'ember_chili', 'pumpkin_pie'], likes: ['tag:dish', 'tag:bar', 'tag:monster'], hates: ['tag:flower'],
        story: [
            { title: 'The Oath Medal', need: 2, ask: "I was given a medal when I swore the guard's oath in {town}. It tore off my coat fighting in the {place}.", item: 'Oath Medal', where: 'dungeon', reward: { items: [['ruby_ring', 1]] } },
            { title: 'Patrol', need: 5, ask: "Let's make the roads safe. Defeat 15 monsters anywhere and tell me about it.", hunt: 15, reward: { items: [['iron_mail', 1]], xp: 30 } },
            { title: 'Old Debts', need: 8, ask: "{rival} was my captain once. They left me behind in a fight and I've never forgiven it. They've written, asking for help. I… want to go. Bring me 3 Tonics and a Sapphire Ring?", deliver: [['tonic', 3], ['sapphire_ring', 1]], reward: { items: [['oathkeeper', 1]], blessing: 'guard', xp: 50 } },
        ],
    },
    scholar: {
        name: 'Scholar', building: 'library', level: 4,
        daily: [['tag:scroll', 0, 1]],
        passive: 'Reveals a faded glimmer on your map every 7 days. Sells recipe scrolls.',
        fit: ['relic', 'scroll', 'gem'], questFit: { gather: 0.9, hunt: 0.9, delve: 1.2, expedition: 1.2 },
        skill: { name: 'Spark', kind: 'elem', pow: 1.5 },
        loves: ['moonstone', 'herb_tea', 'tag:scroll'], likes: ['tag:gem', 'tag:nut', 'tonic'], hates: ['hay', 'tag:monster'],
        story: [
            { title: 'Missing Folio', need: 2, ask: "The last folio of the Glen's history is missing — the librarian in {town} said it was taken to the {place} for safekeeping. Ironic.", item: 'Glen Folio', where: 'dungeon', reward: { recipe: 2 } },
            { title: 'Star Charts', need: 5, ask: "{rival} published a paper saying the Heartwood was a myth. With 3 Wisp Dust and an Ice Crystal I can make a lens to prove the stars moved when it fell.", deliver: [['wisp_dust', 3], ['ice_crystal', 1]], reward: { reveal: 3, xp: 30 } },
            { title: 'The Last Chapter', need: 8, ask: "I've written the Glen's history up to today. The last chapter is yours. Bring me an Onyx and a Moonstone to bind it with.", deliver: [['onyx', 1], ['moonstone', 1]], reward: { items: [['heart_staff', 1]], blessing: 'lore', xp: 50 } },
        ],
    },
    bard: {
        name: 'Bard', building: 'tavern', level: 5,
        daily: [['honey', 0, 1], ['gold', 50, 120]],
        passive: 'The Tavern: everyone is happier, and a visit gives you a buff for the day.',
        fit: ['dish', 'flower'], questFit: { gather: 0.9, hunt: 0.9, delve: 0.9, expedition: 1.3 },
        skill: { name: 'Rally Song', kind: 'buff', pow: 3 },
        loves: ['honey', 'glimmer_cake', 'frost_lily'], likes: ['tag:sweet', 'tag:flower', 'tag:dish'], hates: ['tag:mineral', 'fiber'],
        story: [
            { title: 'The Broken Lute', need: 2, ask: "My lute's tuning peg — carved by {friend} in {town} — snapped off and rolled away somewhere in the {place}.", item: 'Tuning Peg', where: 'dungeon', reward: { items: [['bard_pin', 1]] } },
            { title: 'A Song for the Glen', need: 5, ask: "I'm writing a song about the Glen. I need inspiration: bring me the prettiest things you can — a Sunpetal, a Frost Lily and a Golden Feather.", deliver: [['sunpetal', 1], ['frost_lily', 1], ['gold_feather', 1]], reward: { gold: 2000, xp: 30 } },
            { title: 'Encore', need: 8, ask: "{rival} says a small-town bard never plays the capital. Fine. I'll play here instead, at the festival. Bring Glimmer Cake for the band?", deliver: [['glimmer_cake', 1]], reward: { blessing: 'song', gold: 3000, xp: 50 } },
        ],
    },
};

export const JOB_ORDER = ['carpenter', 'farmer', 'blacksmith', 'rancher', 'cook', 'herbalist', 'merchant', 'tailor', 'miner', 'guard', 'scholar', 'bard'];
export const APPLICANTS_AT_LEVEL = { 1: ['carpenter', 'farmer'], 2: ['blacksmith', 'rancher', 'cook'], 3: ['herbalist', 'merchant', 'tailor'], 4: ['miner', 'guard', 'scholar'], 5: ['bard'] };

export const PERSONALITIES = ['cheerful', 'shy', 'grumpy', 'dreamy', 'bookish', 'bold'];

export const BLESSINGS = {
    build: 'Buildings cost 10% less (the Carpenter\'s bench).',
    farm: 'Crops have a 10% chance to grow twice overnight.',
    smith: 'Tool upgrades cost half.',
    ranch: 'Animals start happier and produce large goods more often.',
    cook: 'Dishes restore 25% more.',
    herb: 'Tonics restore twice as much.',
    trade: 'Shipping prices +10% more.',
    tailor: 'Energy costs of all tools −1.',
    mine: 'Ore nodes drop an extra ore.',
    guard: 'You take 10% less damage in battle.',
    lore: 'All faded glimmers show on your map.',
    song: 'Every villager is a little happier every day.',
};

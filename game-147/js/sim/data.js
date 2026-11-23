// Every table the game runs on: heroes, skills, chains, monsters, regions, recipes, items, guests, debt tiers,
// quests and bond scenes. Pure data; the rules live in hotel.js, battle.js, bonds.js and quests.js.

export const ELEMENTS = {
    fire: { name: 'Spice', icon: '🔥', color: '#ff7a45' },
    water: { name: 'Suds', icon: '💧', color: '#4cb8ff' },
    leaf: { name: 'Bloom', icon: '🌿', color: '#5fcf6a' },
    wind: { name: 'Breeze', icon: '🍃', color: '#9be8d8' },
    star: { name: 'Sugar', icon: '✨', color: '#ffd84d' },
    none: { name: 'Plain', icon: '•', color: '#ddd' },
};

// ------------------------------------------------------------------ heroes
// base = level-1 stats; grow = per level. crit and eva are percentages.
export const HEROES = {
    maple: {
        name: 'Maple Hearthwood', short: 'Maple', cls: 'Pastry Paladin', el: 'star', staff: 'innkeeper',
        color: '#ff8a8a', fav: 'honeyTart', favDecor: 'sunflowerVase',
        base: { hp: 120, mp: 30, atk: 14, def: 12, mag: 9, spd: 10, crit: 5, eva: 3 },
        grow: { hp: 14, mp: 3, atk: 2.2, def: 2, mag: 1.4, spd: 0.4 },
        skills: ['sugarRush', 'potLidGuard', 'warmWelcome'],
        weapon: 'oakPin', chain: 'rollingThunder',
        bio: 'Seventeen, freckled and stubborn. Inherited the Drowsy Dragonfly Inn from Great-Aunt Marigold, along with 40,000 gold of debt.',
    },
    ember: {
        name: 'Ember Pell', short: 'Ember', cls: 'Hearth Mage', el: 'fire', staff: 'cook',
        color: '#ff9d3d', fav: 'emberStew', favDecor: 'copperKettle',
        base: { hp: 85, mp: 45, atk: 8, def: 7, mag: 16, spd: 11, crit: 5, eva: 4 },
        grow: { hp: 9, mp: 5, atk: 1.2, def: 1.1, mag: 2.6, spd: 0.5 },
        skills: ['sizzle', 'flashFry', 'simmer'],
        weapon: 'brassLadle', chain: 'flambeFinale',
        bio: 'Former apprentice of the Royal Kitchens, until the Great Soufflé Explosion. Cooks with real fire. Mostly on purpose.',
    },
    kit: {
        name: 'Kit Quickstep', short: 'Kit', cls: 'Bellhop Rogue', el: 'wind', staff: 'concierge',
        color: '#4fd1c5', fav: 'honeyTart', favDecor: 'luggageCart',
        base: { hp: 90, mp: 30, atk: 15, def: 8, mag: 7, spd: 15, crit: 12, eva: 10 },
        grow: { hp: 10, mp: 3, atk: 2.4, def: 1.2, mag: 1, spd: 0.7 },
        skills: ['expressJab', 'pickpocketTip', 'doubleTrouble'],
        weapon: 'letterOpeners', chain: 'expressDelivery',
        bio: 'A reformed pickpocket who wanted a job where carrying other people\'s luggage is legal.',
    },
    fern: {
        name: 'Fern Willowbloom', short: 'Fern', cls: 'Botanist Bard', el: 'leaf', staff: 'gardener',
        color: '#7ed69a', fav: 'glowTea', favDecor: 'pottedFern',
        base: { hp: 95, mp: 42, atk: 8, def: 9, mag: 14, spd: 12, crit: 5, eva: 5 },
        grow: { hp: 10, mp: 4.5, atk: 1.1, def: 1.3, mag: 2.2, spd: 0.5 },
        skills: ['thornBallad', 'lullabyBloom', 'pollenWaltz'],
        weapon: 'gourdLute', chain: 'overtureOfBlossoms',
        bio: 'A wandering gardener who sings to seedlings. Arrived with a wilted sapling and a request for a sunny window.',
    },
    bru: {
        name: 'Brunhilde "Bru" Mopsworth', short: 'Bru', cls: 'Broom Knight', el: 'water', staff: 'housekeeper',
        color: '#8fb8ff', fav: 'puffcapPie', favDecor: 'armorStand',
        base: { hp: 140, mp: 28, atk: 13, def: 15, mag: 8, spd: 8, crit: 5, eva: 2 },
        grow: { hp: 16, mp: 2.5, atk: 2, def: 2.4, mag: 1, spd: 0.3 },
        skills: ['sudsSplash', 'spinMop', 'sparkleShield'],
        weapon: 'mopHalberd', chain: 'springCleaning',
        bio: 'Retired knight of the Order of the Spotless Shield. Read one bad review about dust bunnies and declared war.',
    },
};
export const HERO_ORDER = ['maple', 'ember', 'kit', 'fern', 'bru'];

export const STAFF_ROLES = {
    innkeeper: { name: 'Innkeeper', icon: '🛎️' },
    cook: { name: 'Cook', icon: '🍳', station: 'kitchen', perk: 'Cooking +15% quality and a wider stir zone; unlocks recipes' },
    concierge: { name: 'Concierge', icon: '🧳', station: 'lobby', perk: 'Checks in waiting guests by themselves; tips +25%' },
    gardener: { name: 'Gardener', icon: '🌻', station: 'garden', perk: 'Herbs grow twice as fast; forages wild ingredients' },
    housekeeper: { name: 'Housekeeper', icon: '🧹', station: 'rooms', perk: 'Pops a dust bunny every 7 s in the dirtiest room' },
};

// ------------------------------------------------------------------ skills
// kind: dmg | heal | buff | debuff | guard | steal. target: one | all | ally | allies | self. stat: atk | mag.
// poise: extra poise damage. tag is the element used by combo links.
export const SKILLS = {
    attack: { name: 'Attack', mp: 0, kind: 'dmg', target: 'one', stat: 'atk', power: 1.0, el: 'none', desc: 'A plain hit with your weapon.' },
    // Maple
    sugarRush: { name: 'Sugar Rush', mp: 6, kind: 'dmg', target: 'one', stat: 'atk', power: 1.45, el: 'star', desc: 'A sugar-fuelled rolling-pin swing. Sugar (✨) damage.' },
    potLidGuard: { name: 'Pot-Lid Guard', mp: 5, kind: 'buff', target: 'self', buff: { def: 0.4 }, turns: 2, taunt: 2, desc: 'Raise the pot lid: DEF +40% and draw every enemy\'s attention for 2 turns.' },
    warmWelcome: { name: 'Warm Welcome', mp: 12, kind: 'heal', target: 'allies', stat: 'mag', power: 1.1, flat: 18, desc: 'An innkeeper\'s hug for the whole party.' },
    // Ember
    sizzle: { name: 'Sizzle', mp: 6, kind: 'dmg', target: 'one', stat: 'mag', power: 1.55, el: 'fire', desc: 'A ladleful of hot spice. Spice (🔥) damage.' },
    flashFry: { name: 'Flash Fry', mp: 12, kind: 'dmg', target: 'all', stat: 'mag', power: 0.9, el: 'fire', desc: 'Flame sweeps every enemy. Spice (🔥) damage to all.' },
    simmer: { name: 'Simmer', mp: 8, kind: 'buff', target: 'ally', buff: { atk: 0.2, mag: 0.2 }, turns: 3, desc: 'Warm an ally up: ATK and MAG +20% for 3 turns.' },
    // Kit
    expressJab: { name: 'Express Jab', mp: 4, kind: 'dmg', target: 'one', stat: 'atk', power: 1.2, el: 'wind', poise: 2, desc: 'A lightning-fast poke that breaks guard. Breeze (🍃), heavy stagger.' },
    pickpocketTip: { name: 'Pickpocket Tip', mp: 5, kind: 'steal', target: 'one', stat: 'atk', power: 0.8, el: 'none', desc: 'Hit and "borrow" an ingredient or some gold.' },
    doubleTrouble: { name: 'Double Trouble', mp: 9, kind: 'dmg', target: 'one', stat: 'atk', power: 0.75, hits: 2, crit: 20, el: 'wind', desc: 'Two quick slashes, +20% crit. Breeze (🍃).' },
    // Fern
    thornBallad: { name: 'Thorn Ballad', mp: 6, kind: 'dmg', target: 'one', stat: 'mag', power: 1.4, el: 'leaf', desc: 'A song that grows brambles. Bloom (🌿) damage.' },
    lullabyBloom: { name: 'Lullaby Bloom', mp: 8, kind: 'heal', target: 'ally', stat: 'mag', power: 2.0, flat: 30, regen: 0.05, turns: 3, desc: 'Heal one ally and leave a gentle regeneration.' },
    pollenWaltz: { name: 'Pollen Waltz', mp: 10, kind: 'debuff', target: 'all', debuff: { spd: -0.25 }, turns: 3, desc: 'Sleepy pollen: every enemy SPD −25% for 3 turns.' },
    // Bru
    sudsSplash: { name: 'Suds Splash', mp: 5, kind: 'dmg', target: 'one', stat: 'atk', power: 1.35, el: 'water', desc: 'A soapy mop swing. Suds (💧) damage.' },
    spinMop: { name: 'Spin Mop', mp: 10, kind: 'dmg', target: 'all', stat: 'atk', power: 0.8, el: 'water', desc: 'A whirling mop that scrubs every enemy. Suds (💧) to all.' },
    sparkleShield: { name: 'Sparkle Shield', mp: 10, kind: 'buff', target: 'allies', buff: { def: 0.25 }, turns: 3, desc: 'Polish everyone\'s armour: party DEF +25% for 3 turns.' },
    // monsters
    bonk: { name: 'Bonk', mp: 0, kind: 'dmg', target: 'one', stat: 'atk', power: 1.0, el: 'none' },
    sneeze: { name: 'Sneeze', mp: 0, kind: 'dmg', target: 'all', stat: 'mag', power: 0.55, el: 'wind' },
    stickyGlob: { name: 'Sticky Glob', mp: 0, kind: 'debuff', target: 'one', debuff: { spd: -0.3 }, turns: 2, dmgPower: 0.6, stat: 'mag', el: 'leaf' },
    spineRoll: { name: 'Spine Roll', mp: 0, kind: 'dmg', target: 'all', stat: 'atk', power: 0.85, el: 'leaf' },
    huff: { name: 'Huff and Puff', mp: 0, kind: 'buff', target: 'self', buff: { atk: 0.3 }, turns: 3 },
    drowsySpores: { name: 'Drowsy Spores', mp: 0, kind: 'debuff', target: 'all', debuff: { spd: -0.2 }, turns: 2, dmgPower: 0.35, stat: 'mag', el: 'leaf' },
    shellUp: { name: 'Shell Up', mp: 0, kind: 'buff', target: 'self', buff: { def: 0.5 }, turns: 2 },
    sporeStorm: { name: 'Spore Storm', mp: 0, kind: 'dmg', target: 'all', stat: 'mag', power: 1.0, el: 'leaf' },
    mossyMend: { name: 'Mossy Mend', mp: 0, kind: 'heal', target: 'self', stat: 'mag', power: 2.2, flat: 40 },
    shriek: { name: 'Shriek', mp: 0, kind: 'dmg', target: 'one', stat: 'mag', power: 1.2, el: 'wind' },
    rockSmash: { name: 'Rock Smash', mp: 0, kind: 'dmg', target: 'one', stat: 'atk', power: 1.5, el: 'none' },
    geodeQuake: { name: 'Geode Quake', mp: 0, kind: 'dmg', target: 'all', stat: 'atk', power: 1.05, el: 'star' },
    gemShield: { name: 'Gem Shield', mp: 0, kind: 'buff', target: 'self', buff: { def: 0.4, mag: 0.2 }, turns: 3 },
};

// ------------------------------------------------------------------ chain attacks
// members: who must be in the party and standing. bond: min bond level between every pair (with Maple for trios).
// hits: [heroId, power, stat, el, target ('one' | 'all' | 'rand')]. after: an effect on the party.
export const CHAINS = {
    rollingThunder: { name: 'Rolling Thunder', members: ['maple'], hits: [['maple', 0.9, 'atk', 'star', 'one'], ['maple', 0.9, 'atk', 'star', 'one'], ['maple', 1.1, 'atk', 'star', 'one']], after: { buff: { def: 0.2 }, turns: 2 }, line: 'Rolling pin, don\'t fail me now!' },
    flambeFinale: { name: 'Flambé Finale', members: ['ember'], hits: [['ember', 2.1, 'mag', 'fire', 'all']], line: 'Order up! Extra crispy!' },
    expressDelivery: { name: 'Express Delivery', members: ['kit'], hits: [['kit', 0.55, 'atk', 'wind', 'rand'], ['kit', 0.55, 'atk', 'wind', 'rand'], ['kit', 0.55, 'atk', 'wind', 'rand'], ['kit', 0.55, 'atk', 'wind', 'rand'], ['kit', 0.7, 'atk', 'wind', 'rand']], poise: 1, line: 'Special delivery, sign here!' },
    overtureOfBlossoms: { name: 'Overture of Blossoms', members: ['fern'], hits: [['fern', 1.4, 'mag', 'leaf', 'all']], after: { healPct: 0.2 }, line: 'Bloom, little ones!' },
    springCleaning: { name: 'Spring Cleaning', members: ['bru'], hits: [['bru', 1.75, 'atk', 'water', 'all']], after: { cleanse: true }, line: 'Not one speck of dust remains!' },
    // duos (bond level 3)
    breakfastInBed: { name: 'Breakfast in Bed', members: ['maple', 'ember'], bond: 3, hits: [['maple', 1.9, 'atk', 'star', 'one'], ['ember', 2.0, 'mag', 'fire', 'one']], after: { regen: 0.06, turns: 3 }, line: 'Rise and shine, it\'s pancake time!' },
    roomServiceRush: { name: 'Room Service Rush', members: ['maple', 'kit'], bond: 3, hits: [['kit', 0.7, 'atk', 'wind', 'one'], ['maple', 0.9, 'atk', 'star', 'one'], ['kit', 0.7, 'atk', 'wind', 'one'], ['maple', 0.9, 'atk', 'star', 'one'], ['kit', 1.0, 'atk', 'wind', 'one']], line: 'Room service! Twice!' },
    turndownService: { name: 'Turndown Service', members: ['kit', 'bru'], bond: 3, hits: [['bru', 1.2, 'atk', 'water', 'all'], ['kit', 1.2, 'atk', 'wind', 'all']], poise: 3, line: 'Lights out, everybody!' },
    gardenBarbecue: { name: 'Garden Barbecue', members: ['ember', 'fern'], bond: 3, hits: [['fern', 1.3, 'mag', 'leaf', 'all'], ['ember', 1.5, 'mag', 'fire', 'all']], after: { healPct: 0.15 }, line: 'Fresh from the garden, straight onto the grill!' },
    rainAndShine: { name: 'Rain & Shine', members: ['fern', 'bru'], bond: 3, hits: [['bru', 1.3, 'atk', 'water', 'all'], ['fern', 1.3, 'mag', 'leaf', 'all']], after: { regen: 0.06, turns: 3 }, line: 'After the rain, flowers!' },
    // trios (bond level 4 with Maple for both others)
    fullCourseBanquet: { name: 'Full Course Banquet', members: ['maple', 'ember', 'fern'], bond: 4, hits: [['fern', 1.2, 'mag', 'leaf', 'all'], ['ember', 1.5, 'mag', 'fire', 'all'], ['maple', 1.8, 'atk', 'star', 'all']], after: { healPct: 0.3, buff: { atk: 0.2, mag: 0.2 }, turns: 3 }, line: 'Dinner is served!' },
    fiveStarService: { name: 'Five-Star Service', members: ['maple', 'kit', 'bru'], bond: 4, hits: [['kit', 1.2, 'atk', 'wind', 'all'], ['bru', 1.4, 'atk', 'water', 'all'], ['maple', 1.8, 'atk', 'star', 'all']], after: { chain: 30 }, poise: 2, line: 'Welcome to the Drowsy Dragonfly!' },
};

// Combo links: an ally's element followed by another hero's element on the same enemy, before it acts again.
export const COMBOS = [
    { a: 'fire', b: 'wind', name: 'Firestorm', effect: 'burn' },
    { a: 'water', b: 'fire', name: 'Steam Burst', effect: 'defDown' },
    { a: 'leaf', b: 'water', name: 'Overgrowth', effect: 'heal' },
    { a: 'wind', b: 'leaf', name: 'Petal Gale', effect: 'poise' },
    { a: 'star', b: 'fire', name: 'Caramelize', effect: 'atkDown' },
    { a: 'water', b: 'star', name: 'Bubble Glaze', effect: 'chain' },
];

// ------------------------------------------------------------------ monsters
// stats at level 1; scale ×(1 + 0.12 (lv − 1)). poise = hits to stagger. drops: [item, chance].
export const MONSTERS = {
    dustbunny: { name: 'Dust Bunny', el: 'wind', weak: ['water', 'fire'], resist: [], base: { hp: 40, atk: 9, def: 5, mag: 6, spd: 12, crit: 5, eva: 8 }, poise: 2, exp: 6, gold: 8, skills: [['bonk', 3], ['sneeze', 1]], drops: [['fluff', 0.6], ['pepper', 0.2]], scale: 0.8 },
    honeyslime: { name: 'Honey Slime', el: 'leaf', weak: ['fire'], resist: ['water'], base: { hp: 55, atk: 8, def: 6, mag: 8, spd: 8, crit: 3, eva: 0 }, poise: 3, exp: 8, gold: 10, skills: [['bonk', 2], ['stickyGlob', 1]], drops: [['honey', 0.7]], scale: 0.9 },
    thistlehog: { name: 'Sir Thistlehog', el: 'leaf', weak: ['fire', 'wind'], resist: ['leaf'], boss: true, base: { hp: 380, atk: 15, def: 10, mag: 8, spd: 9, crit: 5, eva: 0 }, poise: 7, exp: 80, gold: 150, skills: [['bonk', 2], ['spineRoll', 2], ['huff', 1]], drops: [['pepper', 1], ['marblePin', 1]], scale: 1.6 },
    puffcap: { name: 'Puffcap', el: 'leaf', weak: ['fire'], resist: ['water'], base: { hp: 66, atk: 10, def: 8, mag: 11, spd: 10, crit: 5, eva: 3 }, poise: 3, exp: 11, gold: 13, skills: [['bonk', 2], ['drowsySpores', 1]], drops: [['puffcap', 0.8]], scale: 0.85 },
    mosssnail: { name: 'Moss Snail', el: 'water', weak: ['leaf'], resist: ['fire'], base: { hp: 86, atk: 11, def: 14, mag: 9, spd: 6, crit: 3, eva: 0 }, poise: 4, exp: 13, gold: 15, skills: [['bonk', 3], ['shellUp', 1]], drops: [['glowmoss', 0.5], ['herbs', 0.4]], scale: 0.95 },
    grandmorel: { name: 'The Grand Morel', el: 'leaf', weak: ['fire', 'wind'], resist: ['leaf', 'water'], boss: true, base: { hp: 520, atk: 13, def: 11, mag: 15, spd: 8, crit: 5, eva: 0 }, poise: 9, exp: 220, gold: 400, skills: [['bonk', 1], ['sporeStorm', 2], ['mossyMend', 1]], drops: [['glowmoss', 1], ['starLadle', 1], ['moonLute', 1]], scale: 1.7 },
    crystalbat: { name: 'Crystal Bat', el: 'wind', weak: ['star', 'water'], resist: ['leaf'], base: { hp: 72, atk: 14, def: 9, mag: 13, spd: 17, crit: 8, eva: 14 }, poise: 3, exp: 17, gold: 18, skills: [['bonk', 2], ['shriek', 2]], drops: [['sugar', 0.45]], scale: 0.85 },
    pebblegolem: { name: 'Pebble Golem', el: 'star', weak: ['water', 'leaf'], resist: ['wind', 'fire'], base: { hp: 120, atk: 16, def: 18, mag: 6, spd: 5, crit: 5, eva: 0 }, poise: 5, exp: 21, gold: 22, skills: [['bonk', 2], ['rockSmash', 1]], drops: [['sugar', 0.4]], scale: 1.05 },
    molequeen: { name: 'Queen Gemma', el: 'star', weak: ['water', 'wind'], resist: ['star', 'fire'], boss: true, base: { hp: 640, atk: 16, def: 13, mag: 12, spd: 9, crit: 6, eva: 0 }, poise: 11, exp: 480, gold: 900, skills: [['bonk', 2], ['geodeQuake', 2], ['gemShield', 1]], drops: [['sugar', 1], ['silverOpeners', 1], ['sudsHalberd', 1], ['diary', 1]], scale: 1.8 },
};

// ------------------------------------------------------------------ regions
export const REGIONS = {
    meadow: { name: 'Sunny Meadow', lv: [1, 4], pool: ['dustbunny', 'honeyslime'], size: [2, 3], boss: 'thistlehog', bossLv: 5, unlock: 0, sky: '#bfe6ff', ground: '#8fd16a', blurb: 'Buttercups, honeybees and very cheeky dust bunnies.' },
    grove: { name: 'Mushroom Grove', lv: [5, 9], pool: ['puffcap', 'mosssnail', 'honeyslime'], size: [2, 3], boss: 'grandmorel', bossLv: 10, unlock: 1, sky: '#d9c6ff', ground: '#6dbb83', blurb: 'Glowing toadstools and a very old, very sleepy mushroom king.' },
    cave: { name: 'Crystal Cave', lv: [10, 14], pool: ['crystalbat', 'pebblegolem', 'puffcap'], size: [2, 3], boss: 'molequeen', bossLv: 15, unlock: 2, sky: '#a9c8ff', ground: '#9aa7d8', blurb: 'Singing crystals, and a queen who digs for gems.' },
};
export const REGION_ORDER = ['meadow', 'grove', 'cave'];

// ------------------------------------------------------------------ items
// cat: gear | tools | ingredient | battle | quest | decor. For gear: slot, hero (or null = anyone), stats.
export const ITEMS = {
    // ingredients
    honey: { name: 'Honey Jar', cat: 'ingredient', price: 20, desc: 'Golden meadow honey.' },
    pepper: { name: 'Fire Pepper', cat: 'ingredient', price: 24, desc: 'Hot enough to toast bread.' },
    puffcap: { name: 'Puffcap', cat: 'ingredient', price: 22, desc: 'A sleepy mushroom. Tastes like a nap.' },
    glowmoss: { name: 'Glow Moss', cat: 'ingredient', price: 30, desc: 'Soft green moss that glows at night.' },
    sugar: { name: 'Crystal Sugar', cat: 'ingredient', price: 45, desc: 'Sugar that grows in caves. Sparkles on the tongue.' },
    fluff: { name: 'Bunny Fluff', cat: 'ingredient', price: 6, desc: 'Left behind by dust bunnies. Good for pillows, not pies.' },
    herbs: { name: 'Garden Herbs', cat: 'ingredient', price: 10, desc: 'Mint, thyme and a little sage, from the courtyard.' },
    flour: { name: 'Flour Sack', cat: 'ingredient', price: 6, desc: 'Plain flour. Every recipe\'s best friend.' },
    // battle items (crafted in the workshop)
    honeyDrop: { name: 'Honey Drop', cat: 'battle', price: 30, use: { heal: 70 }, target: 'ally', desc: 'Heals 70 HP.' },
    mintTea: { name: 'Mint Tea', cat: 'battle', price: 30, use: { mp: 25 }, target: 'ally', desc: 'Restores 25 MP.' },
    smellingSalts: { name: 'Smelling Salts', cat: 'battle', price: 60, use: { revive: 0.35 }, target: 'down', desc: 'Wakes a fallen ally with 35% HP.' },
    pepperBomb: { name: 'Pepper Bomb', cat: 'battle', price: 50, use: { dmg: 55, el: 'fire' }, target: 'enemies', desc: '55 Spice (🔥) damage to every enemy.' },
    // gear: weapons
    oakPin: { name: 'Oak Rolling Pin', cat: 'gear', slot: 'weapon', hero: 'maple', stats: { atk: 2 }, price: 0, desc: 'Great-Aunt Marigold\'s. Well loved.' },
    marblePin: { name: 'Marble Rolling Pin', cat: 'gear', slot: 'weapon', hero: 'maple', stats: { atk: 9, crit: 4 }, price: 400, desc: 'Heavy, cool and very smooth.' },
    brassLadle: { name: 'Brass Ladle', cat: 'gear', slot: 'weapon', hero: 'ember', stats: { mag: 2 }, price: 0, desc: 'Never lets an ember go out.' },
    starLadle: { name: 'Star Ladle', cat: 'gear', slot: 'weapon', hero: 'ember', stats: { mag: 10, mp: 8 }, price: 520, desc: 'Stirs soup and starlight.' },
    letterOpeners: { name: 'Brass Letter Openers', cat: 'gear', slot: 'weapon', hero: 'kit', stats: { atk: 2 }, price: 0, desc: 'For opening letters. And arguments.' },
    silverOpeners: { name: 'Silver Letter Openers', cat: 'gear', slot: 'weapon', hero: 'kit', stats: { atk: 10, spd: 2 }, price: 600, desc: 'Fancy enough for a royal mailroom.' },
    gourdLute: { name: 'Gourd Lute', cat: 'gear', slot: 'weapon', hero: 'fern', stats: { mag: 2 }, price: 0, desc: 'Grown, not built.' },
    moonLute: { name: 'Moonflower Lute', cat: 'gear', slot: 'weapon', hero: 'fern', stats: { mag: 9, mp: 10 }, price: 520, desc: 'Its strings hum at moonrise.' },
    mopHalberd: { name: 'Mop Halberd', cat: 'gear', slot: 'weapon', hero: 'bru', stats: { atk: 2, def: 2 }, price: 0, desc: 'Regulation issue, Order of the Spotless Shield.' },
    sudsHalberd: { name: 'Bubblebright Halberd', cat: 'gear', slot: 'weapon', hero: 'bru', stats: { atk: 8, def: 6 }, price: 600, desc: 'Leaves everything it touches gleaming.' },
    // gear: accessories (anyone)
    luckyBell: { name: 'Lucky Bell', cat: 'gear', slot: 'acc', hero: null, stats: { crit: 6 }, price: 180, desc: 'A little brass desk bell. Ding for luck.' },
    silkScarf: { name: 'Silk Scarf', cat: 'gear', slot: 'acc', hero: null, stats: { eva: 6, spd: 1 }, price: 200, desc: 'Flutters out of the way of trouble.' },
    copperRing: { name: 'Copper Ring', cat: 'gear', slot: 'acc', hero: null, stats: { def: 5 }, price: 160, desc: 'Made from an old kettle handle.' },
    dragonflyPin: { name: 'Dragonfly Pin', cat: 'gear', slot: 'acc', hero: null, stats: { mp: 12, mag: 2 }, price: 220, desc: 'The inn\'s emblem, in enamel.' },
    // cookware & cleaning tools (passive)
    copperPot: { name: 'Copper Pot', cat: 'tools', price: 250, desc: 'Every meal +0.1 quality.' },
    goldenWhisk: { name: 'Golden Whisk', cat: 'tools', price: 350, desc: 'The stir zones are 30% wider.' },
    featherDuster: { name: 'Feather Duster', cat: 'tools', price: 0, desc: 'Click a dust bunny to shoo it.' },
    turboBroom: { name: 'Turbo Broom', cat: 'tools', price: 300, desc: 'Your housekeeper works 50% faster; every sweep has +20% fluff.' },
    sparkleSpray: { name: 'Sparkle Spray', cat: 'tools', price: 280, desc: 'Rooms gather 25% less dust.' },
    // quest items
    suitcase: { name: 'Lost Suitcase', cat: 'quest', price: 0, desc: 'Monogrammed "B.B.". Contains forty identical socks.' },
    diary: { name: 'Marigold\'s Diary', cat: 'quest', price: 0, desc: 'Great-Aunt Marigold\'s handwriting, and a pressed dragonfly.' },
    // decor (the lobby shows three)
    sunflowerVase: { name: 'Sunflower Vase', cat: 'decor', price: 120, rep: 2, desc: 'Sunshine in a jar. Maple\'s favourite.' },
    copperKettle: { name: 'Copper Kettle', cat: 'decor', price: 140, rep: 2, desc: 'Always just about to whistle. Ember\'s favourite.' },
    luggageCart: { name: 'Antique Luggage Cart', cat: 'decor', price: 160, rep: 3, desc: 'Brass, velvet and one squeaky wheel. Kit\'s favourite.' },
    pottedFern: { name: 'Potted Fern', cat: 'decor', price: 100, rep: 2, desc: 'Unfurls when complimented. Fern\'s favourite.' },
    armorStand: { name: 'Polished Armour Stand', cat: 'decor', price: 220, rep: 3, desc: 'You can see your face in it. Bru\'s favourite.' },
};
export const CATEGORIES = [
    ['gear', 'Weapons & Gear', '⚔️'], ['tools', 'Cookware & Cleaning', '🧹'], ['ingredient', 'Ingredients', '🍯'],
    ['meal', 'Meals', '🍲'], ['battle', 'Battle Items', '🧪'], ['quest', 'Quest Items', '📜'], ['decor', 'Hotel Decor', '🪴'],
];
export const MARKET = ['flour', 'herbs', 'honey', 'honeyDrop', 'mintTea', 'luckyBell', 'silkScarf', 'copperRing', 'dragonflyPin',
    'copperPot', 'goldenWhisk', 'turboBroom', 'sparkleSpray', 'sunflowerVase', 'copperKettle', 'luggageCart', 'pottedFern', 'armorStand'];

// ------------------------------------------------------------------ cooking
// buff is what eating it before an expedition gives the party (scaled by quality); price is what a guest pays.
export const RECIPES = {
    honeyTart: { name: 'Honey Tart', need: { honey: 1, flour: 1 }, price: 42, sat: 12, buff: { regen: 0.04 }, buffText: 'Regen 4% HP each turn', unlock: 'start' },
    herbSalad: { name: 'Garden Salad', need: { herbs: 2 }, price: 30, sat: 10, buff: { mpRegen: 3 }, buffText: '+3 MP each turn', unlock: 'start' },
    emberStew: { name: 'Ember Stew', need: { pepper: 1, herbs: 1, flour: 1 }, price: 58, sat: 14, buff: { atk: 0.15, mag: 0.15 }, buffText: 'ATK & MAG +15%', unlock: 'ember' },
    puffcapPie: { name: 'Puffcap Pie', need: { puffcap: 2, flour: 1 }, price: 72, sat: 15, buff: { def: 0.15 }, buffText: 'DEF +15%', unlock: 'ember' },
    glowTea: { name: 'Glowmoss Tea', need: { glowmoss: 1, herbs: 1 }, price: 55, sat: 14, buff: { resist: 0.25 }, buffText: 'Elemental damage taken −25%', unlock: 'fern' },
    crystalParfait: { name: 'Crystal Parfait', need: { sugar: 1, honey: 1 }, price: 120, sat: 18, buff: { crit: 15 }, buffText: 'Crit +15%', unlock: 'tier2' },
    cloudSouffle: { name: 'Cloud Soufflé', need: { sugar: 1, flour: 1, honey: 1 }, price: 160, sat: 20, buff: { spd: 0.15, eva: 10 }, buffText: 'SPD +15%, EVA +10', unlock: 'tier3' },
};
export const RECIPE_ORDER = ['honeyTart', 'herbSalad', 'emberStew', 'puffcapPie', 'glowTea', 'crystalParfait', 'cloudSouffle'];

// workshop: instant crafts into battle items
export const CRAFTS = {
    honeyDrop: { honey: 1, flour: 1 },
    mintTea: { herbs: 2 },
    smellingSalts: { glowmoss: 1, herbs: 1 },
    pepperBomb: { pepper: 2, flour: 1 },
};

// ------------------------------------------------------------------ guests
export const GUESTS = {
    adventurer: { name: 'Sleepy Adventurer', rate: 30, nights: [1, 2], minRep: 0, model: 'guest-adventurer', names: ['Rowan', 'Tobin', 'Ash', 'Perrin', 'Cass'] },
    merchant: { name: 'Travelling Merchant', rate: 45, nights: [1, 3], minRep: 5, model: 'guest-merchant', names: ['Barnaby', 'Mortimer', 'Gus', 'Hollis', 'Quill'] },
    noble: { name: 'Noble Lady', rate: 80, nights: [2, 3], minRep: 25, model: 'guest-noble', names: ['Lady Primrose', 'Lady Clementine', 'Lady Bellamy', 'Lady Tansy'] },
};
export const GUEST_REQUESTS = [
    { id: 'clean', text: 'A spotless room, please (keep it under 2 dust bunnies)' },
    { id: 'meal', text: 'Would love a meal: ' },
    { id: 'none', text: 'Just a quiet night' },
];

// ------------------------------------------------------------------ debt
export const TIERS = [
    { amount: 1500, due: 6, name: 'Dust & Dreams', unlock: 'Kitchen upgrade, the Mushroom Grove' },
    { amount: 3500, due: 13, name: 'Fresh Linens', unlock: 'The East Wing (rooms 3–4), the Crystal Cave, new recipes' },
    { amount: 7000, due: 21, name: 'Grand Reopening', unlock: 'Kitchen upgrade, a third decor shelf, the Cloud Soufflé' },
    { amount: 12000, due: 30, name: 'The Sunroom Suite', unlock: 'The Sunroom Suite (room 5, double rate)' },
    { amount: 16000, due: 40, name: 'The Deed', unlock: 'The Drowsy Dragonfly is yours' },
];
export const LATE = { feePct: 0.1, graceDays: 5 };

// ------------------------------------------------------------------ rooms
export const ROOMS = [
    { id: 'r1', name: 'Room 1 · Buttercup', tier: 0, rateMul: 1 },
    { id: 'r2', name: 'Room 2 · Bluebell', tier: 0, rateMul: 1 },
    { id: 'r3', name: 'Room 3 · Clover', tier: 2, rateMul: 1.1 },
    { id: 'r4', name: 'Room 4 · Larkspur', tier: 2, rateMul: 1.1 },
    { id: 'r5', name: 'The Sunroom Suite', tier: 4, rateMul: 2 },
];

// ------------------------------------------------------------------ the story
// Main quest: chapters of objectives. Each objective has a check name (quests.js) and optional arg.
export const CHAPTERS = [
    { title: 'Chapter 1 · A Dusty Inheritance', goals: [
        ['sweptRoom', null, 'Shoo the dust bunnies out of a guest room'],
        ['checkedIn', 1, 'Check in your first guest at the front desk'],
        ['cooked', 1, 'Cook a meal in the kitchen'],
        ['recruited', 'ember', 'Help the soot-faced stranger (Ember)'],
        ['tierPaid', 1, 'Pay Madame Goldmaw the first installment'],
    ] },
    { title: 'Chapter 2 · Room for One More', goals: [
        ['recruited', 'kit', 'Find the lost suitcase for the bellhop (Kit)'],
        ['bossBeaten', 'thistlehog', 'Defeat Sir Thistlehog in the Sunny Meadow'],
        ['recruited', 'fern', 'Give the gardener a sunny room (Fern)'],
        ['tierPaid', 2, 'Pay the second installment'],
    ] },
    { title: 'Chapter 3 · The Grand Reopening', goals: [
        ['recruited', 'bru', 'Win over the knight who hates dust (Bru)'],
        ['bossBeaten', 'grandmorel', 'Wake the Grand Morel in the Mushroom Grove'],
        ['tierPaid', 3, 'Pay the third installment'],
    ] },
    { title: 'Chapter 4 · Marigold\'s Secret', goals: [
        ['bossBeaten', 'molequeen', 'Find Great-Aunt Marigold\'s diary in the Crystal Cave'],
        ['tierPaid', 4, 'Pay the fourth installment'],
    ] },
    { title: 'Chapter 5 · The Deed', goals: [
        ['tierPaid', 5, 'Pay off the very last of the debt'],
    ] },
];

// Strangers at the front desk. arrive: when they show up. tasks: what wins them over.
export const RECRUITS = {
    ember: { arrive: ['goal', 0, 2], room: 'any', meal: 'emberStew', task: { kind: 'item', item: 'pepper', n: 1, text: 'Bring a Fire Pepper from the Sunny Meadow' }, gift: { pepper: 0 } },
    kit: { arrive: ['tier', 1], room: 'any', meal: 'honeyTart', task: { kind: 'item', item: 'suitcase', n: 1, text: 'Find the lost suitcase in the Mushroom Grove' } },
    fern: { arrive: ['boss', 'thistlehog'], room: 'clean', meal: 'glowTea', task: { kind: 'harvest', n: 6, text: 'Harvest 6 herbs from the courtyard' } },
    bru: { arrive: ['tier', 2], room: 'clean', meal: 'puffcapPie', task: { kind: 'sparkle', n: 4, text: 'Reach a 4★ Sparkle rating' } },
};

export const DAILIES = [
    { id: 'clean', text: 'Shoo {n} dust bunnies', n: [6, 10], gold: 60 },
    { id: 'serve', text: 'Serve {n} meals to guests', n: [2, 3], gold: 70 },
    { id: 'cook', text: 'Cook {n} meals', n: [2, 3], gold: 50 },
    { id: 'wins', text: 'Win {n} battles', n: [2, 4], gold: 80 },
    { id: 'checkin', text: 'Check in {n} guests', n: [2, 3], gold: 60 },
    { id: 'harvest', text: 'Harvest {n} herbs', n: [3, 6], gold: 40 },
];

// Bond scenes: [pair, level] → lines [speaker, text]. Lv 2 and 4 with Maple; Lv 3 for every duo pair.
export const VIGNETTES = {
    'ember|maple:2': { title: 'Burnt Toast Diplomacy', lines: [['ember', 'Maple, I may have... slightly... set the toast on fire.'], ['maple', 'Slightly?'], ['ember', 'It\'s a new technique! Charcoal crust!'], ['maple', 'Teach me. If the guests ask, it\'s artisanal.']] },
    'ember|maple:4': { title: 'The Soufflé Incident', lines: [['ember', 'Want to know why they really fired me? The soufflé didn\'t explode. I made it rise too high.'], ['ember', 'It went through the ceiling. The King\'s hat was never found.'], ['maple', 'Here, you can make it rise as high as you like.'], ['ember', '...You\'re the best boss I\'ve ever burnt something for.']] },
    'kit|maple:2': { title: 'Lost and Found', lines: [['kit', 'Found your spoon. It was in my pocket. I don\'t know how it got there.'], ['maple', 'Kit.'], ['kit', 'Old habits! I\'m returning things now. I\'m a returner.']] },
    'kit|maple:4': { title: 'The Luggage Tag', lines: [['kit', 'This tag on my belt? It\'s from the first bag I ever carried for someone. Legally.'], ['kit', 'Tipped me a whole copper. I\'ve never felt so rich.'], ['maple', 'Then here, a Drowsy Dragonfly tag. You\'re staff now. For good.']] },
    'fern|maple:2': { title: 'The Sapling', lines: [['fern', 'The sapling put out a new leaf. It likes it here.'], ['maple', 'It\'s not the only one, I hope?'], ['fern', '...No. Not the only one.']] },
    'fern|maple:4': { title: 'Marigold\'s Garden', lines: [['fern', 'I found old seed packets in the shed. Marigolds. Hundreds.'], ['maple', 'Great-Aunt Marigold planted them every spring.'], ['fern', 'Then let\'s plant them again. She\'d like the courtyard to remember her.']] },
    'bru|maple:2': { title: 'Inspection Day', lines: [['bru', 'Room Two: acceptable. Room One: EXEMPLARY. You\'ve been practising!'], ['maple', 'I learned from the best.'], ['bru', 'Flattery! I accept it! Carry on, soldier!']] },
    'bru|maple:4': { title: 'The Spotless Shield', lines: [['bru', 'I left the Order because nobody needed a knight anymore.'], ['bru', 'But a home needs someone to keep it safe and clean. That is a knight\'s work too.'], ['maple', 'Sir Bru of the Drowsy Dragonfly. It has a ring to it.']] },
    'ember|maple:3': { title: 'Breakfast in Bed', lines: [['ember', 'New plan: we serve breakfast so fast the monsters think it\'s still night!'], ['maple', 'Breakfast. In. Bed. Our new combo move.']] },
    'kit|maple:3': { title: 'Room Service Rush', lines: [['kit', 'You knock, I deliver?'], ['maple', 'I knock, you deliver, I knock again.']] },
    'bru|kit:3': { title: 'Turndown Service', lines: [['bru', 'Fold the corner, fluff the pillow, chocolate on the... Kit, where is the chocolate?'], ['kit', 'Delivered. To me.']] },
    'ember|fern:3': { title: 'Garden Barbecue', lines: [['fern', 'Please don\'t cook my tomatoes before they\'re ripe.'], ['ember', 'No promises. They look so roastable.']] },
    'bru|fern:3': { title: 'Rain & Shine', lines: [['fern', 'The garden needs rain.'], ['bru', 'I have a mop bucket and no fear.']] },
};

// Short story scenes the sim queues (main.js plays them through the dialogue box).
export const SCENES = {
    intro: [['goldmaw', 'Ahem! Miss Maple Hearthwood? Madame Goldmaw, of Goldmaw & Daughters Savings and Loan.'], ['goldmaw', 'Your Great-Aunt Marigold left you this charming inn. And forty thousand gold of debt! In five easy installments.'], ['maple', 'Forty THOUSAND?!'], ['goldmaw', 'The first, fifteen hundred, is due in six days. Do try to keep up, dear.'], ['maple', 'Then I\'ll restore every room, fill every bed and pay every coin. Watch me!']],
    tier1: [['goldmaw', 'Paid on time! Marigold would be insufferably proud.'], ['goldmaw', 'I\'ll lend the kitchen a better stove. Interest-free. Don\'t tell anyone I\'m nice.']],
    tier2: [['goldmaw', 'The East Wing is yours to open. Mind the creaky stair, it bites.']],
    tier3: [['goldmaw', 'The Grand Reopening! I\'ve booked a table for myself. Purely to audit the soufflé.']],
    tier4: [['goldmaw', 'The Sunroom Suite! Marigold\'s favourite room. She used to read there all afternoon.']],
    tier5: [['goldmaw', 'Paid. In full. Here is the deed.'], ['maple', 'It\'s ours. It\'s really ours!'], ['goldmaw', 'Between us: Marigold asked me to make the loan. She wanted the inn to go to someone who would fight for it.'], ['maple', 'You were her friend all along?'], ['goldmaw', 'I was her best friend. Now, about that reservation... the Sunroom, for the rest of my days?']],
    late: [['goldmaw', 'Tut tut! The installment is late. A small fee, a little more time.'], ['maple', 'I\'ll pay it, Madame. Every coin!']],
    recruit_ember: [['ember', 'Hi! Sorry! Is there any room with a stove I\'m allowed to use?'], ['ember', 'Long story. Involves a soufflé. And a king. And a hole in a ceiling.'], ['maple', 'You can have a room. But first, I\'m out of Fire Peppers...'], ['ember', 'Bring me one from the meadow and I\'ll cook my grandma\'s Ember Stew. Then you serve it to me. That\'s the deal!']],
    recruit_kit: [['kit', 'Evening! Carry your bags? Legally, I mean.'], ['kit', 'The suitcase I was carrying got lost. In the Mushroom Grove. Not by me! Find it and I\'m all yours.'], ['maple', 'Find that suitcase, and a honey tart, and we\'ll talk.']],
    recruit_fern: [['fern', 'Hello... do you have a room with a sunny window? My sapling is very sad.'], ['fern', 'Your courtyard is... hm. It could be lovely. If someone harvested the overgrowth.']],
    recruit_bru: [['bru', 'I read a review. Dust bunnies. UNACCEPTABLE!'], ['bru', 'Show me a four-star sparkle and I\'ll stay. Show me a speck and I\'ll mop it personally.']],
    joined: [['maple', 'Welcome to the Drowsy Dragonfly, for good!']],
    diary: [['maple', 'Marigold\'s diary... "To whoever runs my inn next: the debt was my idea. Goldmaw is a dear. Fight for this place."']],
};

export const SPEAKERS = {
    maple: 'Maple', ember: 'Ember', kit: 'Kit', fern: 'Fern', bru: 'Bru', goldmaw: 'Madame Goldmaw',
};

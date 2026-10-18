// WanderQuest — the realm: regions, towns, roads, goods, materials, travellers, monsters, upgrades and the story.
// Tables only (and a few pure helpers that describe them). Numbers that tune pacing live in ../config.js.

// ------------------------------------------------------------------ regions
// Six regions in a spiral: each one's Waystone, lit by beating its Warden, opens the roads into the next.
export const REGIONS = [
    {
        id: 0, name: 'Meadowmere', biome: 'meadow', lv: [1, 7], color: '#79b85a',
        monsters: ['wolf', 'goblin', 'bandit', 'boar', 'bramble'],
        warden: { id: 'thornback', name: 'The Thornback', title: 'boar-king of the hedgerows', town: 'thistlecross', level: 8, shape: 'beast', deco: 'tusks', col: ['#6b4a2e', '#3c2a1a', '#e0d0a0'] },
    },
    {
        id: 1, name: 'The Amber Wastes', biome: 'desert', lv: [7, 14], color: '#d9a45a',
        monsters: ['scorpion', 'raider', 'wraith', 'jackal', 'wyrm'],
        warden: { id: 'sphinx', name: 'The Glass Sphinx', title: 'who asks no riddles any more', town: 'sunspire', level: 15, shape: 'beast', deco: 'wings', col: ['#bfe6ff', '#6aa6c8', '#fff4c0'] },
    },
    {
        id: 2, name: 'Mirewood', biome: 'mire', lv: [14, 21], color: '#4f9a86',
        monsters: ['troll', 'wisp', 'spider', 'leech', 'bogling'],
        warden: { id: 'witch', name: 'The Drowned Witch', title: 'who keeps the fen-lights', town: 'hollowroot', level: 22, shape: 'spirit', col: ['#6fd0b0', '#20463e', '#d8ffe8'] },
    },
    {
        id: 3, name: 'Frostfang Peaks', biome: 'frost', lv: [21, 28], color: '#a9c8e6',
        monsters: ['icewolf', 'yeti', 'harpy', 'rime'],
        warden: { id: 'rimeclaw', name: 'Rimeclaw', title: 'the White Drake', town: 'whitecrown', level: 29, shape: 'drake', col: ['#eef6ff', '#8fb4d8', '#5ad0ff'] },
    },
    {
        id: 4, name: 'Emberreach', biome: 'ember', lv: [28, 35], color: '#d0583a',
        monsters: ['imp', 'golem', 'salamander', 'cultist'],
        warden: { id: 'colossus', name: 'The Cinder Colossus', title: 'that walks the lava-roads', town: 'cinderhold', level: 36, shape: 'golem', col: ['#3a2a28', '#ff7a2a', '#ffd060'] },
    },
    {
        id: 5, name: 'Starhaven', biome: 'star', lv: [35, 43], color: '#8f7ad8',
        monsters: ['knight', 'shade', 'stareater', 'hound'],
        warden: { id: 'hollowking', name: 'The Hollow King', title: 'who put out the Waystones', town: 'starhaven', level: 44, shape: 'king', col: ['#2a2040', '#9a86ff', '#ffe08a'] },
    },
];

// ------------------------------------------------------------------ goods (trade cargo, 1 hold slot each)
export const GOODS = [
    { id: 'grain', name: 'Grain', icon: '🌾', base: 6, region: 0 },
    { id: 'wool', name: 'Wool', icon: '🧶', base: 10, region: 0 },
    { id: 'cheese', name: 'Cheese', icon: '🧀', base: 14, region: 0 },
    { id: 'salt', name: 'Salt', icon: '🧂', base: 12, region: 1 },
    { id: 'spice', name: 'Spice', icon: '🌶️', base: 28, region: 1 },
    { id: 'glass', name: 'Glassware', icon: '🏺', base: 24, region: 1 },
    { id: 'moss', name: 'Lanternmoss', icon: '🍀', base: 20, region: 2 },
    { id: 'dye', name: 'Bog Dye', icon: '🧪', base: 32, region: 2 },
    { id: 'furs', name: 'Furs', icon: '🦊', base: 36, region: 3 },
    { id: 'iron', name: 'Iron Ingots', icon: '⛓️', base: 30, region: 3 },
    { id: 'obsidian', name: 'Obsidian', icon: '🪨', base: 44, region: 4 },
    { id: 'firesalt', name: 'Fire Salts', icon: '🔥', base: 52, region: 4 },
    { id: 'starsilk', name: 'Starsilk', icon: '✨', base: 80, region: 5 },
];
export const GOOD = Object.fromEntries(GOODS.map((g) => [g.id, g]));

// ------------------------------------------------------------------ materials (loot, used by the carts)
export const MATS = [
    { id: 'hide', name: 'Hide', icon: '🟫' },
    { id: 'meat', name: 'Meat', icon: '🍖' },
    { id: 'ore', name: 'Ore', icon: '⛏️' },
    { id: 'timber', name: 'Timber', icon: '🪵' },
    { id: 'herb', name: 'Herbs', icon: '🌿' },
    { id: 'crystal', name: 'Crystal', icon: '💎' },
];
export const MAT = Object.fromEntries(MATS.map((m) => [m.id, m]));

// ------------------------------------------------------------------ towns
// x, y on a 1000 × 700 map. danger is the level of the monsters on the roads out of the town.
export const TOWNS = [
    { id: 'hearthford', name: 'Hearthford', region: 0, x: 110, y: 610, danger: 1, produces: ['grain', 'wool'], wants: ['spice'], blurb: 'Where Grandmother\'s wagon has always wintered. Your grandmother\'s barn, a mill, a duck pond.' },
    { id: 'millbrook', name: 'Millbrook', region: 0, x: 240, y: 645, danger: 2, produces: ['grain', 'cheese'], wants: ['salt'], blurb: 'Waterwheels and cheese caves.' },
    { id: 'applewick', name: 'Applewick', region: 0, x: 150, y: 490, danger: 3, produces: ['cheese', 'wool'], wants: ['glass'], blurb: 'Orchards, cider, and a goblin problem.' },
    { id: 'thistlecross', name: 'Thistlecross', region: 0, x: 310, y: 540, danger: 5, produces: ['wool'], wants: ['salt', 'spice'], capital: true, blurb: 'A market town at the crossroads, and the first dark Waystone.' },
    { id: 'sandhollow', name: 'Sandhollow', region: 1, x: 440, y: 610, danger: 8, produces: ['salt'], wants: ['cheese'], blurb: 'Salt pans that glitter like snow.' },
    { id: 'dunmarrow', name: 'Dunmarrow', region: 1, x: 560, y: 515, danger: 10, produces: ['glass', 'salt'], wants: ['wool'], blurb: 'Glassblowers work the dunes\' own sand.' },
    { id: 'kesh', name: 'Kesh Oasis', region: 1, x: 650, y: 645, danger: 11, produces: ['spice'], wants: ['grain'], blurb: 'Date palms, spice tents, and the coolest water in the Wastes.' },
    { id: 'sunspire', name: 'Sunspire', region: 1, x: 790, y: 585, danger: 13, produces: ['glass', 'spice'], wants: ['cheese'], capital: true, blurb: 'A city of mirrors built around a glass needle.' },
    { id: 'bogwater', name: 'Bogwater', region: 2, x: 870, y: 455, danger: 15, produces: ['moss'], wants: ['salt'], blurb: 'Houses on stilts, boats for streets.' },
    { id: 'lanternfen', name: 'Lanternfen', region: 2, x: 745, y: 385, danger: 17, produces: ['moss', 'dye'], wants: ['spice'], blurb: 'The fen glows green at night with lanternmoss.' },
    { id: 'hollowroot', name: 'Hollowroot', region: 2, x: 905, y: 300, danger: 20, produces: ['dye'], wants: ['glass'], capital: true, blurb: 'A town inside the roots of one enormous drowned tree.' },
    { id: 'coldharbor', name: 'Coldharbor', region: 3, x: 830, y: 165, danger: 22, produces: ['furs'], wants: ['dye'], blurb: 'Trappers, fur-boats and a frozen harbour.' },
    { id: 'ironvein', name: 'Ironvein', region: 3, x: 680, y: 110, danger: 25, produces: ['iron'], wants: ['grain'], blurb: 'Mines and forges in the mountain\'s ribs.' },
    { id: 'whitecrown', name: 'Whitecrown', region: 3, x: 555, y: 70, danger: 27, produces: ['furs', 'iron'], wants: ['spice'], capital: true, blurb: 'The highest town in the realm, white walls on a white peak.' },
    { id: 'ashgate', name: 'Ashgate', region: 4, x: 385, y: 95, danger: 29, produces: ['obsidian'], wants: ['furs'], blurb: 'The gate into the burning country.' },
    { id: 'pyresrest', name: 'Pyre\'s Rest', region: 4, x: 250, y: 245, danger: 32, produces: ['firesalt'], wants: ['iron'], blurb: 'A pilgrim town around an everlasting fire.' },
    { id: 'cinderhold', name: 'Cinderhold', region: 4, x: 170, y: 120, danger: 34, produces: ['firesalt', 'obsidian'], wants: ['moss'], capital: true, blurb: 'A fortress of black glass above a lava lake.' },
    { id: 'duskmeet', name: 'Duskmeet', region: 5, x: 410, y: 300, danger: 37, produces: ['starsilk'], wants: ['firesalt'], blurb: 'Where it is always the last minute of evening.' },
    { id: 'starhaven', name: 'Starhaven', region: 5, x: 530, y: 330, danger: 41, produces: ['starsilk'], wants: ['obsidian', 'furs'], capital: true, blurb: 'The heart of the realm, where every road began.' },
];
export const TOWN = Object.fromEntries(TOWNS.map((t) => [t.id, t]));

// ------------------------------------------------------------------ roads
// gate: the Waystone (region index) that must be lit before the road opens. null = always open.
export const ROADS = [
    ['hearthford', 'millbrook'], ['hearthford', 'applewick'], ['millbrook', 'thistlecross'], ['applewick', 'thistlecross'], ['millbrook', 'applewick'],
    ['thistlecross', 'sandhollow', 0], ['millbrook', 'sandhollow', 0],
    ['sandhollow', 'dunmarrow'], ['sandhollow', 'kesh'], ['dunmarrow', 'kesh'], ['kesh', 'sunspire'], ['dunmarrow', 'sunspire'],
    ['sunspire', 'bogwater', 1], ['dunmarrow', 'lanternfen', 1],
    ['bogwater', 'lanternfen'], ['bogwater', 'hollowroot'], ['lanternfen', 'hollowroot'],
    ['hollowroot', 'coldharbor', 2], ['lanternfen', 'ironvein', 2],
    ['coldharbor', 'ironvein'], ['ironvein', 'whitecrown'], ['coldharbor', 'whitecrown'],
    ['whitecrown', 'ashgate', 3],
    ['ashgate', 'cinderhold'], ['ashgate', 'pyresrest'], ['cinderhold', 'pyresrest'],
    ['pyresrest', 'duskmeet', 4],
    ['duskmeet', 'starhaven'], ['ashgate', 'duskmeet', 4],
].map(([a, b, gate = null], i) => ({ id: i, a, b, gate }));

// ------------------------------------------------------------------ travellers
// hp/atk/def: [at level 1, per level]. Each traveller brings their own cart, and the cart is what they do for the caravan.
export const CLASSES = {
    captain: {
        name: 'Captain', icon: '🏮', color: '#e8b04a', cloth: '#a8452e', hp: [62, 12], atk: [9, 2.2], def: [4, 1.1], spd: 10,
        cart: 'Grandmother\'s Wagon', mat: null,
        role: 'You. Fights in the front rank and steers the caravan.',
        text: () => 'Carries the Great Lantern and the hold. Upgrade it below.',
    },
    guard: {
        name: 'Guard', icon: '🛡️', color: '#8aa0b8', cloth: '#45607a', hp: [88, 17], atk: [7, 1.6], def: [7, 1.8], spd: 8,
        cart: 'Armoury Cart', mat: 'hide',
        role: 'A sellsword. Monsters go for the guard first.',
        text: (l) => `Party defence +${5 + 2 * l}%. A rout loses ${Math.min(60, 20 + 4 * l)}% less.`,
    },
    cook: {
        name: 'Cook', icon: '🍲', color: '#e0a060', cloth: '#c8743a', hp: [56, 11], atk: [6, 1.4], def: [4, 1], spd: 9,
        cart: 'Kitchen Cart', mat: 'meat',
        role: 'Swings a heavy ladle. Hearty meals make everyone learn faster.',
        text: (l) => `1 meat → ${3 + l} rations every ${fmtS(cookTime(l))}. Well fed: +${4 + l}% experience.`,
    },
    smith: {
        name: 'Smith', icon: '⚒️', color: '#c86a40', cloth: '#5a4038', hp: [66, 13], atk: [10, 2.4], def: [5, 1.2], spd: 8,
        cart: 'Forge Cart', mat: 'ore',
        role: 'Hits hard with a hammer.',
        text: (l) => `2 ore + 1 hide or timber → a piece of gear every ${fmtS(forgeTime(l))}, better at higher levels.`,
    },
    alchemist: {
        name: 'Alchemist', icon: '⚗️', color: '#9adf6a', cloth: '#5a3a8a', hp: [46, 9], atk: [8, 2.0], def: [3, 0.8], spd: 11,
        cart: 'Apothecary Cart', mat: 'herb',
        role: 'Every third turn, a bomb that hits every foe.',
        text: (l) => `2 herbs → a potion every ${fmtS(brewTime(l))} (heals ${30 + 4 * l}%). Holds ${8 + 2 * l}.`,
    },
    trader: {
        name: 'Trader', icon: '⚖️', color: '#f0d070', cloth: '#2f6a5a', hp: [52, 10], atk: [6, 1.4], def: [4, 1], spd: 10,
        cart: 'Merchant Cart', mat: 'timber',
        role: 'Knows every price in the realm.',
        text: (l) => `+${8 * l} hold. Sells ${4 + 2 * l}% dearer, buys ${3 + l}% cheaper.`,
    },
    scout: {
        name: 'Scout', icon: '🏹', color: '#80c070', cloth: '#3a5a30', hp: [52, 10], atk: [9, 2.1], def: [3, 0.9], spd: 15,
        cart: 'Outrider\'s Cart', mat: 'hide',
        role: 'Strikes first; one shot in five is a critical.',
        text: (l) => `Travel speed +${4 + 2 * l}%. Finds ${50 + 10 * l}% more caches and wanderers.`,
    },
    healer: {
        name: 'Healer', icon: '🌿', color: '#f0f0d0', cloth: '#6a8ac8', hp: [52, 10], atk: [5, 1.0], def: [4, 1], spd: 11,
        cart: 'Chapel Wagon', mat: 'herb',
        role: 'Heals the most wounded friend instead of attacking.',
        text: (l) => `Party recovers ${60 + 15 * l}% faster on the road and in camp.`,
    },
    bard: {
        name: 'Bard', icon: '🪕', color: '#e080b0', cloth: '#8a2e5a', hp: [52, 10], atk: [6, 1.5], def: [4, 1], spd: 12,
        cart: 'Stage Wagon', mat: 'timber',
        role: 'A battle song: the whole party hits 10% harder.',
        text: (l) => `Plays every town for gold (×${(1 + 0.25 * (l - 1)).toFixed(2)}). +${3 + l}% experience and gold.`,
    },
};
// ------------------------------------------------------------------ the wagon's name
export const DEFAULT_WAGON = 'Grandmother\'s Wagon';
export const WAGON_NAMES = ['The Bramble Rose', 'Old Faithful', 'The Lantern Belle', 'The Merry Thistle', 'Hearthbound', 'The Copper Kettle', 'Brass Bessie', 'The Wandering Star', 'Odessa\'s Pride', 'The Lucky Ox', 'Slow and Steady', 'The Gilded Goose', 'Marigold', 'The Long Way Round', 'The Creaking Comet', 'Second Breakfast', 'The Patient Moth', 'Honeycomb', 'The Last Lantern', 'Little Thunder'];
/** A wagon's name as typed: trimmed, single-spaced, printable, at most 24 characters; empty gives the default. */
export function cleanName(s) {
    const t = String(s ?? '').replace(/[\u0000-\u001f\u007f]/g, '').replace(/\s+/g, ' ').trim().slice(0, 24).trim();
    return t || DEFAULT_WAGON;
}

export const HIRE_CLASSES = ['guard', 'cook', 'smith', 'alchemist', 'trader', 'scout', 'healer', 'bard'];
// who drinks in which region's taverns
export const TAVERN = [
    ['guard', 'cook', 'trader', 'scout', 'healer'],
    ['trader', 'alchemist', 'scout', 'bard', 'guard'],
    ['healer', 'alchemist', 'cook', 'smith'],
    ['smith', 'guard', 'healer', 'scout'],
    ['smith', 'alchemist', 'bard', 'guard'],
    HIRE_CLASSES,
];

export const cookTime = (l) => Math.round(110 / (1 + 0.15 * (l - 1)));
export const forgeTime = (l) => Math.round(260 / (1 + 0.15 * (l - 1)));
export const brewTime = (l) => Math.round(150 / (1 + 0.15 * (l - 1)));

function fmtS(s) { return s >= 60 ? `${Math.floor(s / 60)}m ${s % 60 ? (s % 60) + 's' : ''}`.trim() : `${s}s`; }

export const FIRST = ['Bram', 'Ysolde', 'Tamsin', 'Oren', 'Willa', 'Corin', 'Maud', 'Fenwick', 'Hester', 'Jory', 'Nell', 'Pip', 'Rowan', 'Sabine', 'Tobias', 'Ula', 'Vesna', 'Wystan', 'Agnes', 'Barnaby', 'Cressida', 'Dov', 'Edda', 'Florin', 'Greer', 'Hob', 'Ines', 'Jasper', 'Kit', 'Linnea', 'Mago', 'Nim', 'Odo', 'Petra', 'Quill', 'Rhosyn', 'Silas', 'Tilde', 'Una', 'Viggo', 'Wren', 'Xan', 'Yara', 'Zeb', 'Alder', 'Bryony', 'Cato', 'Dilys', 'Emrys', 'Farah', 'Gideon', 'Hazel', 'Idris', 'Juniper', 'Kasimir', 'Lark', 'Marigold', 'Nestor', 'Olwen', 'Piet'];
export const LAST = ['Hollis', 'Marrow', 'Thatch', 'Quickwater', 'Bellweather', 'Underhill', 'Ashby', 'Kettle', 'Brightwood', 'Fallow', 'Gamble', 'Harrow', 'Ives', 'Juniper', 'Larkspur', 'Mossgrove', 'Nettle', 'Oakes', 'Penhallow', 'Rook', 'Saltmarsh', 'Tanner', 'Vane', 'Wicker', 'Yew', 'Copperpot', 'Dunmore', 'Embery', 'Fairweather', 'Greaves'];

// ------------------------------------------------------------------ monsters
// shape picks the drawing; hp/atk/def multiply the level curve; drops are chances per monster.
export const FAMILIES = {
    wolf: { name: 'Wolf', plural: 'wolves', shape: 'beast', hp: 0.9, atk: 1.05, def: 0.8, spd: 13, drops: { hide: 0.5, meat: 0.6 }, col: ['#8a8f99', '#555a63', '#ffd84a'] },
    goblin: { name: 'Goblin', plural: 'goblins', shape: 'biped', hp: 0.8, atk: 1.0, def: 0.9, spd: 11, drops: { ore: 0.35, timber: 0.35 }, gold: 1.4, col: ['#6fae4a', '#3e6a2a', '#ff5040'] },
    bandit: { name: 'Bandit', plural: 'bandits', shape: 'biped', hp: 1.0, atk: 1.1, def: 1.0, spd: 10, drops: { ore: 0.3, timber: 0.2 }, gold: 2.2, col: ['#a8794a', '#5a3a2a', '#ffffff'] },
    boar: { name: 'Wild Boar', plural: 'wild boars', shape: 'beast', hp: 1.3, atk: 0.95, def: 1.1, spd: 8, drops: { hide: 0.5, meat: 0.8 }, col: ['#7a5a3a', '#4a3424', '#f0e8d0'] },
    bramble: { name: 'Bramble Imp', plural: 'bramble imps', shape: 'spirit', hp: 0.75, atk: 1.0, def: 0.8, spd: 12, drops: { herb: 0.6, timber: 0.4 }, col: ['#8acc5a', '#3a6a2a', '#ffe060'] },
    scorpion: { name: 'Giant Scorpion', plural: 'giant scorpions', shape: 'crawler', hp: 1.1, atk: 1.1, def: 1.3, spd: 9, drops: { hide: 0.4, crystal: 0.12 }, col: ['#c8803a', '#7a4a20', '#201810'] },
    raider: { name: 'Sand Raider', plural: 'sand raiders', shape: 'biped', hp: 1.0, atk: 1.15, def: 1.0, spd: 11, drops: { ore: 0.35, timber: 0.2 }, gold: 2.2, col: ['#e0c090', '#8a5a3a', '#40c0e0'] },
    wraith: { name: 'Dust Wraith', plural: 'dust wraiths', shape: 'spirit', hp: 0.85, atk: 1.2, def: 0.7, spd: 13, drops: { crystal: 0.3, herb: 0.2 }, col: ['#e8d0a0', '#a08060', '#ff9040'] },
    jackal: { name: 'Jackal', plural: 'jackals', shape: 'beast', hp: 0.85, atk: 1.05, def: 0.8, spd: 14, drops: { hide: 0.5, meat: 0.5 }, col: ['#c8a060', '#7a5a30', '#ffe060'] },
    wyrm: { name: 'Sand Wyrm', plural: 'sand wyrms', shape: 'serpent', hp: 1.6, atk: 1.15, def: 1.2, spd: 7, drops: { hide: 0.7, crystal: 0.3 }, rare: 0.35, col: ['#d8b070', '#8a6030', '#ff4020'] },
    troll: { name: 'Bog Troll', plural: 'bog trolls', shape: 'brute', hp: 1.6, atk: 1.15, def: 1.1, spd: 7, drops: { hide: 0.4, meat: 0.4, ore: 0.2 }, col: ['#6a8a5a', '#3a4a30', '#ffe0a0'] },
    wisp: { name: 'Will-o\'-wisp', plural: 'wisps', shape: 'spirit', hp: 0.7, atk: 1.25, def: 0.7, spd: 15, drops: { crystal: 0.35, herb: 0.25 }, col: ['#9affd8', '#2a8a7a', '#ffffff'] },
    spider: { name: 'Fen Spider', plural: 'fen spiders', shape: 'crawler', hp: 0.95, atk: 1.15, def: 0.9, spd: 13, drops: { hide: 0.4, herb: 0.3 }, col: ['#4a3a5a', '#201828', '#ff3050'] },
    leech: { name: 'Leechman', plural: 'leechmen', shape: 'biped', hp: 1.1, atk: 1.05, def: 1.0, spd: 10, drops: { herb: 0.4, ore: 0.2 }, gold: 1.5, col: ['#7a7a3a', '#4a4a20', '#ff8080'] },
    bogling: { name: 'Bogling', plural: 'boglings', shape: 'blob', hp: 1.2, atk: 0.95, def: 1.0, spd: 8, drops: { herb: 0.5, meat: 0.3 }, col: ['#5a7a4a', '#2a3a20', '#e0ff80'] },
    icewolf: { name: 'Ice Wolf', plural: 'ice wolves', shape: 'beast', hp: 1.0, atk: 1.1, def: 0.9, spd: 14, drops: { hide: 0.6, meat: 0.5 }, col: ['#dfeaff', '#8aa0c0', '#40c0ff'] },
    yeti: { name: 'Yeti', plural: 'yetis', shape: 'brute', hp: 1.7, atk: 1.15, def: 1.0, spd: 8, drops: { hide: 0.7, meat: 0.5 }, col: ['#f4f4f8', '#a0a8c0', '#4a80ff'] },
    harpy: { name: 'Storm Harpy', plural: 'storm harpies', shape: 'flyer', hp: 0.85, atk: 1.2, def: 0.8, spd: 15, drops: { crystal: 0.2, hide: 0.3 }, col: ['#8a9ab8', '#4a5a7a', '#ffe060'] },
    rime: { name: 'Rime Spirit', plural: 'rime spirits', shape: 'spirit', hp: 0.9, atk: 1.2, def: 1.1, spd: 12, drops: { crystal: 0.45 }, col: ['#cff4ff', '#6ab0e0', '#ffffff'] },
    imp: { name: 'Fire Imp', plural: 'fire imps', shape: 'flyer', hp: 0.8, atk: 1.25, def: 0.8, spd: 15, drops: { crystal: 0.3, herb: 0.15 }, col: ['#ff6a3a', '#8a2010', '#ffe060'] },
    golem: { name: 'Magma Golem', plural: 'magma golems', shape: 'golem', hp: 1.8, atk: 1.1, def: 1.4, spd: 6, drops: { ore: 0.7, crystal: 0.25 }, col: ['#3a2a28', '#ff6a20', '#ffd040'] },
    salamander: { name: 'Salamander', plural: 'salamanders', shape: 'serpent', hp: 1.1, atk: 1.2, def: 1.0, spd: 12, drops: { hide: 0.5, meat: 0.4 }, col: ['#ff8a30', '#a03a10', '#ffe0a0'] },
    cultist: { name: 'Ash Cultist', plural: 'ash cultists', shape: 'biped', hp: 1.0, atk: 1.25, def: 0.9, spd: 11, drops: { herb: 0.3, ore: 0.3 }, gold: 2.2, col: ['#2a2224', '#8a1a1a', '#ff6040'] },
    knight: { name: 'Hollow Knight', plural: 'hollow knights', shape: 'biped', hp: 1.4, atk: 1.15, def: 1.4, spd: 9, drops: { ore: 0.5, crystal: 0.25 }, gold: 1.8, col: ['#4a4060', '#201a30', '#b0a0ff'] },
    shade: { name: 'Shade', plural: 'shades', shape: 'spirit', hp: 0.9, atk: 1.3, def: 0.8, spd: 14, drops: { crystal: 0.4, herb: 0.2 }, col: ['#3a3050', '#100c1c', '#d0c0ff'] },
    stareater: { name: 'Star-eater', plural: 'star-eaters', shape: 'flyer', hp: 1.1, atk: 1.2, def: 1.0, spd: 13, drops: { crystal: 0.5 }, col: ['#2a2a6a', '#10103a', '#ffffff'] },
    hound: { name: 'Void Hound', plural: 'void hounds', shape: 'beast', hp: 1.1, atk: 1.2, def: 1.0, spd: 14, drops: { hide: 0.5, meat: 0.3, crystal: 0.15 }, col: ['#3a2a5a', '#120a24', '#c080ff'] },
};

// a monster's numbers at level L, before its family's multipliers
export const monsterBase = (L) => ({ hp: 40 + 18 * L, atk: 7 + 3.2 * L, def: 2 + 1.3 * L });
// Wardens act several times a round, and the later ones more often
export const WARDEN_MULT = { hp: [6, 7, 8, 9, 10, 12], atk: 1.3, def: 1.25, acts: [2, 3, 3, 4, 4, 5] };

// ------------------------------------------------------------------ gear
export const SLOTS = ['weapon', 'armor', 'charm'];
export const SLOT_NAME = { weapon: 'Weapon', armor: 'Armour', charm: 'Charm' };
export const GEAR_BASE = {
    weapon: ['Sword', 'Spear', 'Axe', 'Longbow', 'Mace', 'Staff', 'Dagger', 'Halberd', 'Cleaver', 'Sling'],
    armor: ['Jerkin', 'Mail', 'Breastplate', 'Robe', 'Cloak', 'Brigandine', 'Scale Coat', 'Gambeson'],
    charm: ['Ring', 'Amulet', 'Talisman', 'Brooch', 'Locket', 'Charm', 'Bangle'],
};
export const GEAR_MATERIAL = [[1, 'Copper'], [7, 'Bronze'], [14, 'Iron'], [21, 'Steel'], [29, 'Mithril'], [36, 'Starsteel'], [46, 'Dawnforged']];
export const GEAR_SUFFIX = ['of the Fox', 'of Embers', 'of the Long Road', 'of Hearthford', 'of the Owl', 'of Thorns', 'of the Tide', 'of Dawn', 'of the Bear', 'of Whispers', 'of the Waystones', 'of Starlight'];

// ------------------------------------------------------------------ the wagon's own upgrades
export const UPGRADES = {
    wheels: { name: 'Iron-shod Wheels', icon: '🛞', max: 20, cost: (l) => Math.round(60 * Math.pow(1.6, l)), text: (l) => `Travel speed +${6 * l}%` },
    hold: { name: 'Deeper Hold', icon: '📦', max: 20, cost: (l) => Math.round(50 * Math.pow(1.5, l)), text: (l) => `Hold ${20 + 10 * l} goods` },
    lantern: { name: 'Great Lantern', icon: '🏮', max: 8, cost: (l) => Math.round(150 * Math.pow(2, l)), text: (l) => `Travels ${8 + 2 * l} h while you're away` },
    larder: { name: 'Larder', icon: '🥫', max: 12, cost: (l) => Math.round(40 * Math.pow(1.55, l)), text: (l) => `Stores ${40 + 25 * l} rations` },
    banner: { name: 'Caravan Banner', icon: '🚩', max: 20, cost: (l) => Math.round(160 * Math.pow(1.6, l)), text: (l) => `+${3 * l}% experience and gold` },
};
export const cartUpCost = (cls, l) => {
    const mat = CLASSES[cls].mat;
    const mats = mat ? { [mat]: 2 * l + 1 } : {};
    if (l >= 4) mats.crystal = l - 3;
    return { gold: Math.round(70 * Math.pow(1.75, l - 1)), mats };
};
export const cartCap = (caravanLevel) => Math.min(10, 1 + Math.floor(caravanLevel / 3));

// ------------------------------------------------------------------ story
// Letters from Grandmother Odessa, who drove the wagon for fifty years.
export const STORY = {
    intro: {
        title: 'The Wagon',
        text: 'My dear,\n\nThe wagon is yours now. I drove her for fifty years, and the Lantern on her pole is the last one in the realm still lit.\n\nWhen the Hollow King\'s fog came, the Waystones went dark one by one, and the roads between the towns went dark with them. Towns that traded for a thousand years can\'t see each other any more. Monsters walk where carts used to.\n\nA caravan that keeps its lantern lit can still find the roads. So go. Trade, take on travellers who need a road, and light the Waystones again, starting at Thistlecross.\n\nDon\'t worry about watching her every minute. She knows the way. Come back each day and see what the road brought you.\n\n— Odessa',
    },
    waystones: [
        { title: 'The Thistlecross Waystone', text: 'Thistlecross! I can see its light from my window, you know. The road south to the Amber Wastes is open again. Take salt north and cheese south, and don\'t pay more than twenty for spice in Kesh, whatever they tell you.\n\nThe Glass Sphinx keeps Sunspire\'s stone. She used to ask riddles. I hear she doesn\'t any more, and that is worse.' },
        { title: 'The Sunspire Waystone', text: 'Two stones lit! The glassblowers will be singing. The roads north into Mirewood are open: take a healer if you can find one, the fen-fevers are no joke, and never follow a light off the road.\n\nThe Drowned Witch was a ferry-woman once. Be kind if you can, and quick if you can\'t.' },
        { title: 'The Hollowroot Waystone', text: 'The fen-lights are guiding carts again instead of drowning them. The passes into Frostfang are clear. Buy furs in Coldharbor, wrap the oxen\'s hooves, and keep the larder full: nothing grows up there but trouble.\n\nRimeclaw sleeps on the Whitecrown stone. He is old and very proud. So is your grandmother, and I beat him at cards once.' },
        { title: 'The Whitecrown Waystone', text: 'I felt that one in my knees. The way down into Emberreach is open. The Colossus walks the lava-roads around Cinderhold, and nothing your smith can make will be too heavy.\n\nYou are nearly at the heart of it. I am so proud of you I could spit.' },
        { title: 'The Cinderhold Waystone', text: 'Five stones. Five! From my window the whole realm is a string of lights.\n\nThe road to Duskmeet is open, and past it Starhaven, where all the roads began. The Hollow King is there. He wasn\'t always hollow. Nobody was ever going to come to him, so he made sure nobody could go anywhere.\n\nGo anyway. Take everyone.' },
        { title: 'The Starhaven Waystone', text: 'The fog is gone. Every road in the realm is lit, and I can hear carts on the Hearthford road at night again, which I didn\'t think I would.\n\nThe road goes on, of course. It always does. The Night Roads are still out there, darker and richer than anything you\'ve driven, and the wagon will take you down them whenever you\'re ready.\n\nThank you, my dear. Keep the lantern lit.\n\n— Odessa' },
    ],
    regionIntro: [
        null,
        'The Amber Wastes: salt, glass and spice, and scorpions the size of carts. Sand Raiders strip caravans that wander off the road.',
        'Mirewood: the fen-towns trade lanternmoss and dye. Wisps lure the careless off the causeways.',
        'Frostfang Peaks: furs and iron, yetis and harpies, and passes that close in a blizzard.',
        'Emberreach: obsidian and fire salts, carried along roads of cooling lava.',
        'Starhaven: always dusk, always quiet. Hollow Knights walk the roads without looking at them.',
    ],
};

// ------------------------------------------------------------------ helpers over the tables
export const regionOf = (townId) => TOWN[townId].region;
export const roadBetween = (a, b) => ROADS.find((r) => (r.a === a && r.b === b) || (r.a === b && r.b === a));
export const otherEnd = (road, from) => (road.a === from ? road.b : road.a);
export function roadMiles(road, milesPerUnit) {
    const A = TOWN[road.a], B = TOWN[road.b];
    return Math.round(Math.hypot(A.x - B.x, A.y - B.y) * milesPerUnit);
}

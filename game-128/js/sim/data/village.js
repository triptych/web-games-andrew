// Gemheart Saga — Briarwick, the village that backs you: buildings, the villagers who run them, and their requests.
// Pure data.
//
// Every building has levels 0..5 (0 = not built yet). No building may outgrow the Town Hall (hall level caps the rest).
// cost(L): what it takes to reach level L. Production buildings pay per real hour (see sim/village.js), up to the
// storage cap (CAP_HOURS + 2 h per Town Hall level). icon: cell in art/buildings.webp (3x3).

const C = (gold, wood = 0, ore = 0, grain = 0, crystal = 0) => ({ gold, wood, ore, grain, crystal });

export const BUILDINGS = [
    { id: 'hall', name: 'Town Hall', npc: 'maren', start: 1, icon: 4,
        what: 'The heart of Briarwick. Every level lets the other buildings grow one level higher, holds more idle output and makes the daily gift bigger.',
        costs: [null, null, C(150, 60, 30), C(450, 160, 100, 60), C(1100, 360, 240, 160, 20), C(2400, 700, 480, 320, 60)],
        art: 'a two-storey timber-framed village town hall with a slate roof, a small clock tower with a bell, a green banner and stone steps' },
    { id: 'inn', name: 'The Gilded Goose', npc: 'bess', start: 1, icon: 1,
        what: 'Travellers pay for beds: gold every hour. Good stories at the hearth: more experience from every battle.',
        costs: [null, null, C(100, 50), C(300, 140, 40, 60), C(800, 300, 120, 160), C(1800, 600, 300, 320, 40)],
        art: 'a cosy two-storey village inn with warm glowing windows, a thatched roof, a smoking chimney and a hanging sign shaped like a golden goose' },
    { id: 'market', name: 'Market', npc: 'pell', start: 1, icon: 2,
        what: 'Pell sells potions, scrolls and gear. Each level brings better stock and a better price.',
        costs: [null, null, C(120, 60, 20), C(360, 150, 80, 40), C(900, 320, 200, 100, 20), C(2000, 640, 420, 220, 50)],
        art: 'a busy market stall square with striped red and yellow awnings, crates of fruit, barrels, hanging lanterns and shelves of potions' },
    { id: 'temple', name: 'Temple of the Lantern', npc: 'ilse', start: 0, icon: 3,
        what: 'Blessings: heart gems heal more. At level 3 you start each battle with mana; at level 5, once a quest, you rise again when you fall.',
        costs: [null, C(150, 80, 40), C(300, 120, 100, 40), C(700, 240, 200, 100, 20), C(1500, 420, 360, 200, 50), C(3000, 800, 600, 400, 100)],
        art: 'a small white stone village temple with a golden dome, stained glass windows and a great brass lantern glowing above the door' },
    { id: 'armory', name: 'Armory', npc: 'garrick', start: 0, icon: 0,
        what: 'Garrick upgrades your gear with gold and ore, up to +2 per level, and his drills add attack.',
        costs: [null, C(120, 60, 60), C(280, 120, 140), C(650, 240, 300, 60), C(1400, 420, 600, 120, 30), C(2800, 800, 1100, 240, 80)],
        art: 'a stone blacksmith forge and armory with a glowing furnace, an anvil out front, racks of swords and shields and a smoking chimney' },
    { id: 'farm', name: 'Thistledown Farm', npc: 'tobin', start: 1, icon: 5,
        what: 'Grain every hour, and well-fed heroes: +5% max health per level.',
        costs: [null, null, C(80, 50), C(240, 120, 30), C(600, 260, 90, 60), C(1400, 520, 200, 140, 30)],
        art: 'a cheerful farmstead with a red barn, golden wheat fields, a windmill, a scarecrow and hay bales' },
    { id: 'mill', name: 'Lumber Mill', start: 0, icon: 6,
        what: 'Wood every hour.',
        costs: [null, C(60, 20), C(160, 60, 20, 20), C(400, 120, 60, 60), C(1000, 260, 140, 140), C(2200, 520, 300, 280, 40)],
        art: 'a wooden lumber mill on a stream with a turning water wheel, stacked logs and a big saw' },
    { id: 'mine', name: 'Copperhill Mine', start: 0, icon: 7,
        what: 'Ore every hour.',
        costs: [null, C(80, 50), C(200, 100, 20), C(480, 200, 60, 60), C(1100, 400, 140, 140), C(2400, 760, 300, 280, 40)],
        art: 'a hillside mine entrance shored up with timber beams, a mine cart full of ore on rails and a lantern' },
    { id: 'tower', name: 'Mage Tower', start: 0, icon: 8,
        what: 'Crystal every hour, and your skills strike harder: +6% skill damage per level.',
        costs: [null, C(300, 120, 80, 0, 10), C(600, 240, 160, 0, 30), C(1200, 400, 300, 0, 70), C(2400, 700, 500, 0, 140), C(4500, 1200, 900, 0, 260)],
        art: 'a slender stone wizard tower with a pointed blue roof, glowing crystal windows, a telescope at the top and floating runes' },
];

// Production per real hour at levels 0..5.
export const PRODUCE = {
    inn: { gold: [0, 15, 30, 50, 75, 110] },
    farm: { grain: [0, 10, 20, 34, 52, 75] },
    mill: { wood: [0, 10, 20, 34, 52, 75] },
    mine: { ore: [0, 8, 16, 27, 42, 60] },
    tower: { crystal: [0, 2, 4, 7, 11, 16] },
};
export const CAP_HOURS = 4;          // + 2 per Town Hall level
export const BOOST_HOURS = 2;        // the daily Harvest Festival doubles production for this long
export const RESOURCES = ['gold', 'wood', 'ore', 'grain', 'crystal'];
export const RES_NAMES = { gold: 'Gold', wood: 'Wood', ore: 'Ore', grain: 'Grain', crystal: 'Crystal' };
export const RES_ICON = { gold: 0, wood: 1, ore: 2, grain: 3, crystal: 4 };   // cells in art/icons/misc.webp

export const NPCS = [
    { id: 'maren', name: 'Elder Maren', role: 'Town Hall', voiceHint: 'old woman, kind, wise, a little dry',
        greet: 'Briarwick stands because people like you come back to it. Mind you keep coming back.',
        art: 'an elderly village elder woman with silver hair in a bun, half-moon spectacles, a shawl and a wooden walking staff, kind but shrewd eyes' },
    { id: 'bess', name: 'Bess Tallow', role: 'Innkeeper', voiceHint: 'middle-aged woman, hearty, loud, motherly',
        greet: 'Sit down before you fall down, love! Stew\'s on, and so\'s the gossip.',
        art: 'a plump cheerful middle-aged innkeeper woman with rosy cheeks, curly red hair tied up in a kerchief, an apron and a frothing tankard' },
    { id: 'pell', name: 'Pell Farthing', role: 'Merchant', voiceHint: 'young man, fast-talking, charming salesman',
        greet: 'Pell\'s Wares! Potions, polish and pointy things. Everything\'s a bargain if you squint!',
        art: 'a young lanky merchant with a thin moustache, a feathered cap, a colourful patchwork coat covered in pockets and a pair of brass scales' },
    { id: 'ilse', name: 'Mother Ilse', role: 'Priestess', voiceHint: 'older woman, serene, soft, gentle',
        greet: 'The lantern burns for you too, child. Come, let it warm you.',
        art: 'a serene older priestess with grey eyes, white and gold robes, a hood, a small lantern pendant and gentle hands folded in prayer' },
    { id: 'garrick', name: 'Garrick Ironhand', role: 'Smith', voiceHint: 'big gruff man, deep, few words, Scottish or northern',
        greet: 'Bring me ore and I\'ll bring you an edge. That\'s the whole deal.',
        art: 'a huge bald blacksmith with a braided ginger beard, soot-smudged arms, a leather apron and a hammer resting on his shoulder' },
    { id: 'tobin', name: 'Tobin Thistledown', role: 'Farmer', voiceHint: 'young farm boy, cheerful, enthusiastic, country',
        greet: 'Morning! The wheat\'s high and the chickens are plotting something. Good day for it!',
        art: 'a cheerful freckled young farmer with a straw hat, a piece of straw in his mouth, overalls and a pitchfork' },
];
export const NPC = Object.fromEntries(NPCS.map((n) => [n.id, n]));
export const BUILDING = Object.fromEntries(BUILDINGS.map((b) => [b.id, b]));

// Villagers' requests: always open, claimed once when done. test(G) reads G.stats / G.village / G.hero.
// kind: kill (stats.kills[region] or stats.killsTotal), build (building level), stat (a stats counter), level.
export const REQUESTS = [
    { id: 'rq_slimes', npc: 'tobin', title: 'Slime in the Turnips', text: 'Defeat 6 foes in Greenmarch.', need: { kills: 'greenmarch', n: 6 }, reward: { gold: 80, grain: 40 } },
    { id: 'rq_mill', npc: 'maren', title: 'Timber for the Vale', text: 'Build the Lumber Mill.', need: { build: 'mill', n: 1 }, reward: { gold: 60, ore: 30 } },
    { id: 'rq_chain', npc: 'bess', title: 'A Tale Worth Telling', text: 'Make a cascade of 4 in one battle.', need: { stat: 'chainMax', n: 4 }, reward: { gold: 100, wood: 40 } },
    { id: 'rq_temple', npc: 'ilse', title: 'Light a Lamp', text: 'Build the Temple.', need: { build: 'temple', n: 1 }, reward: { gold: 120, crystal: 5 } },
    { id: 'rq_specials', npc: 'pell', title: 'Sparkly Things', text: 'Make 10 special gems (match 4 or more).', need: { stat: 'specials', n: 10 }, reward: { gold: 150, item: 'tonic' } },
    { id: 'rq_armory', npc: 'garrick', title: 'A Proper Forge', text: 'Build the Armory.', need: { build: 'armory', n: 1 }, reward: { gold: 100, ore: 60 } },
    { id: 'rq_marsh', npc: 'tobin', title: 'Rice and Reeds', text: 'Defeat 10 foes in Mirefen Marsh.', need: { kills: 'mirefen', n: 10 }, reward: { gold: 200, grain: 120 } },
    { id: 'rq_level', npc: 'maren', title: 'A Seasoned Hand', text: 'Reach level 8.', need: { level: 8 }, reward: { gold: 250, crystal: 10 } },
    { id: 'rq_upgrade', npc: 'garrick', title: 'Sharper', text: 'Upgrade any gear to +3.', need: { stat: 'bestPlus', n: 3 }, reward: { gold: 200, ore: 120 } },
    { id: 'rq_mines', npc: 'garrick', title: 'The Deep Seams', text: 'Defeat 12 foes in Emberdeep.', need: { kills: 'emberdeep', n: 12 }, reward: { gold: 300, ore: 200 } },
    { id: 'rq_hall', npc: 'maren', title: 'Briarwick Grows', text: 'Raise the Town Hall to level 3.', need: { build: 'hall', n: 3 }, reward: { gold: 300, wood: 150, crystal: 15 } },
    { id: 'rq_daily', npc: 'bess', title: 'Regulars', text: 'Claim the daily gift 3 days in a row.', need: { stat: 'streakBest', n: 3 }, reward: { gold: 200, item: 'feather' } },
    { id: 'rq_peaks', npc: 'ilse', title: 'Ice and Silence', text: 'Defeat 12 foes in Frostfang Peaks.', need: { kills: 'frostfang', n: 12 }, reward: { gold: 400, crystal: 30 } },
    { id: 'rq_tower', npc: 'maren', title: 'Starlight Studies', text: 'Build the Mage Tower.', need: { build: 'tower', n: 1 }, reward: { gold: 300, crystal: 25 } },
    { id: 'rq_doom', npc: 'ilse', title: 'Defuse the Dark', text: 'Clear 15 doom gems before they burst.', need: { stat: 'doomCleared', n: 15 }, reward: { gold: 250, item: 'greatpotion' } },
    { id: 'rq_rich', npc: 'pell', title: 'Patron of the Arts', text: 'Spend 3000 gold in Briarwick.', need: { stat: 'goldSpent', n: 3000 }, reward: { crystal: 40, item: 'feather' } },
];

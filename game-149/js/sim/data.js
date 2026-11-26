// Echoheart Academy — the game's tables. Pure data: the sim, the view, the UI and the tests all read these.

// ------------------------------------------------------------------ people
// sprites: the expressions art/spr/<id>-<expr>.webp exists for. model: the Meshy GLB in models/.
export const CAST = {
    kai: { name: 'Kai', full: 'Kai Amano', color: '#9fb6ff', sprites: ['normal', 'determined', 'surprised'], model: 'kai' },
    hana: {
        name: 'Hana', full: 'Hana Kirishima', color: '#ff6b5b', el: 'fire', home: 'arena', mini: 'fireball',
        sprites: ['normal', 'happy', 'angry', 'sad', 'blush'], model: 'hana',
        loves: ['chestnuts', 'fireopal'], likes: ['honeybun', 'tart', 'candy'],
        blurb: 'Fire mage. Loud, competitive, secretly soft. Will challenge you to anything.',
    },
    lys: {
        name: 'Lys', full: 'Lys Moonwell', color: '#c7b6ff', el: 'star', home: 'library', mini: 'stars',
        sprites: ['normal', 'happy', 'surprised', 'sad', 'blush'], model: 'lys',
        loves: ['starchart', 'bookmark'], likes: ['moonflower', 'tart', 'candy'],
        blurb: 'Star mage and library assistant. Shy, brilliant, braver than she knows.',
    },
    pip: {
        name: 'Pip', full: 'Pip Brightwater', color: '#4fd6c4', el: 'water', home: 'lab', mini: 'potion',
        sprites: ['normal', 'happy', 'surprised', 'sad', 'blush'], model: 'pip',
        loves: ['gears', 'bubblesoap'], likes: ['honeybun', 'moonflower', 'candy'],
        blurb: 'Water alchemist and inventor. Cheerful, curious, occasionally explosive.',
    },
    ren: {
        name: 'Ren', full: 'Ren Takeda', color: '#8fe07a', el: 'wind', home: 'skyfield', mini: 'rings',
        sprites: ['normal', 'happy', 'serious', 'sad', 'blush'], model: 'ren',
        loves: ['windchime', 'honeybun'], likes: ['chestnuts', 'tart', 'candy'],
        blurb: 'Wind mage, your roommate, the academy\'s fastest broom and worst prankster.',
    },
    veymont: { name: 'Principal Veymont', color: '#d9a8ff', sprites: ['kind', 'think', 'sinister'], model: 'veymont' },
    hollow: { name: 'Hollow Veymont', color: '#b070ff', sprites: ['menace'], model: 'hollow', voice: 'veymont' },
    graves: { name: 'Professor Graves', color: '#7fc79a', sprites: ['stern', 'soft', 'alarm'], model: 'graves' },
    theo: { name: 'Theo', color: '#e0b080', sprites: ['normal'], model: 'theo' },
    yuki: { name: 'Yuki', color: '#a8e4ff', sprites: ['normal'], model: 'yuki' },
    mochi: { name: 'Mochi', color: '#ffffff', sprites: ['mochi'], model: 'mochi' },
    nurse: { name: 'Nurse Pell', color: '#ffd0e0' },
    acolyte: { name: 'Masked Acolyte', color: '#b9a3d6' },
    crowd: { name: 'Students', color: '#ffe39a' },
};
export const FRIENDS = ['hana', 'lys', 'pip', 'ren'];

// ------------------------------------------------------------------ battle
// Base stats at level 1; every level adds GROW of each.
export const HEROES = {
    kai: { hp: 92, mp: 30, atk: 10, mag: 14, def: 8, spd: 12, el: 'echo', skills: ['echo', 'harmony'] },
    hana: { hp: 96, mp: 22, atk: 15, mag: 13, def: 9, spd: 13, el: 'fire', skills: ['blaze'] },
    lys: { hp: 72, mp: 36, atk: 7, mag: 16, def: 6, spd: 11, el: 'star', skills: ['starfall'] },
    pip: { hp: 82, mp: 34, atk: 9, mag: 13, def: 8, spd: 10, el: 'water', skills: ['tonic'] },
    ren: { hp: 86, mp: 26, atk: 12, mag: 12, def: 7, spd: 16, el: 'wind', skills: ['cyclone'] },
    graves: { hp: 140, mp: 60, atk: 12, mag: 20, def: 14, spd: 12, el: 'star', skills: ['glyph'] },
};
export const GROW = 0.085;

export const SKILLS = {
    // heroes
    strike: { name: 'Strike', mp: 0, target: 'foe', kind: 'dmg', stat: 'atk', power: 1.0 },
    echo: { name: 'Echo', mp: 6, target: 'auto', kind: 'echo', power: 1.25, desc: 'Copy the last spell anyone cast, at 125%. With nothing to copy, a sonic burst.' },
    sonic: { name: 'Sonic Burst', mp: 0, target: 'foe', kind: 'dmg', stat: 'mag', power: 1.2, el: 'echo' },
    harmony: { name: 'Harmony', mp: 8, target: 'allies', kind: 'heal', stat: 'mag', power: 1.1, el: 'echo', desc: 'A chord that heals the whole party.' },
    blaze: { name: 'Blaze Burst', mp: 6, target: 'foe', kind: 'dmg', stat: 'mag', power: 2.0, el: 'fire', desc: 'A huge fireball at one foe.' },
    starfall: { name: 'Starfall', mp: 8, target: 'foes', kind: 'dmg', stat: 'mag', power: 1.15, el: 'star', desc: 'Stars rain on every foe.' },
    tonic: { name: 'Tidal Tonic', mp: 7, target: 'allies', kind: 'heal', stat: 'mag', power: 1.35, el: 'water', desc: 'A splash of healing for everyone.' },
    cyclone: { name: 'Cyclone', mp: 7, target: 'foes', kind: 'dmg', stat: 'mag', power: 0.95, el: 'wind', haste: 35, desc: 'Wind hits every foe and hurries the party.' },
    glyph: { name: 'Warding Glyph', mp: 10, target: 'allies', kind: 'shield', turns: 2, el: 'star', desc: 'Halves the damage the party takes for two turns.' },
    // the Hollow Choir
    flicker: { name: 'Hollow Flicker', mp: 0, target: 'foe', kind: 'dmg', stat: 'mag', power: 1.0, el: 'hollow' },
    drain: { name: 'Magic Drain', mp: 0, target: 'foe', kind: 'dmg', stat: 'mag', power: 0.9, el: 'hollow', drainMp: 6 },
    smash: { name: 'Gauntlet Smash', mp: 0, target: 'foe', kind: 'dmg', stat: 'atk', power: 1.35 },
    dive: { name: 'Stone Dive', mp: 0, target: 'foe', kind: 'dmg', stat: 'atk', power: 1.2 },
    requiem: { name: 'Hollow Requiem', mp: 0, target: 'foes', kind: 'dmg', stat: 'mag', power: 0.7, el: 'hollow' },
    siphon: { name: 'Siphon', mp: 0, target: 'foe', kind: 'dmg', stat: 'mag', power: 1.2, el: 'hollow', drainMp: 10 },
    lance: { name: 'Moon Lance', mp: 0, target: 'foe', kind: 'dmg', stat: 'mag', power: 1.45, el: 'hollow' },
    choir: { name: 'Choir Call', mp: 0, target: 'self', kind: 'summon', summon: 'acolyte' },
    bonk: { name: 'Wobble Bonk', mp: 0, target: 'foe', kind: 'dmg', stat: 'atk', power: 0.8 },
};

// Foes: stats at level 1 grow like heroes'. ai: the moves it picks from, weighted.
export const FOES = {
    wisp: { name: 'Hollow Wisp', model: 'wisp', hp: 44, atk: 8, mag: 11, def: 4, spd: 12, weak: ['star', 'water'], resist: ['hollow'], ai: [['flicker', 3], ['drain', 1]], xp: 8, lumens: 6, h: 1.1 },
    acolyte: { name: 'Masked Acolyte', model: 'acolyte', hp: 74, atk: 10, mag: 13, def: 7, spd: 11, weak: ['fire'], resist: [], ai: [['drain', 2], ['flicker', 2], ['strike', 1]], xp: 12, lumens: 9, h: 1.75 },
    armor: { name: 'Enchanted Armor', model: 'armor', hp: 140, atk: 17, mag: 5, def: 16, spd: 7, weak: ['water', 'wind'], resist: ['fire'], ai: [['smash', 2], ['strike', 1]], xp: 22, lumens: 16, h: 2.1 },
    gargoyle: { name: 'Gargoyle', model: 'gargoyle', hp: 108, atk: 15, mag: 6, def: 12, spd: 9, weak: ['wind'], resist: ['star'], ai: [['dive', 2], ['strike', 1]], xp: 18, lumens: 13, h: 1.5 },
    dummy: { name: 'Practice Golem', model: 'armor', hp: 60, atk: 7, mag: 5, def: 5, spd: 8, weak: ['fire', 'star', 'water', 'wind'], resist: [], ai: [['bonk', 1]], xp: 7, lumens: 4, h: 1.8 },
    boss: { name: 'Hollow Veymont', model: 'hollow', hp: 560, atk: 15, mag: 17, def: 11, spd: 12, weak: [], resist: ['hollow'], ai: [['requiem', 3], ['siphon', 2], ['lance', 2], ['choir', 1]], xp: 0, lumens: 0, h: 2.0, boss: true },
};

// Encounters: foes and their level. Party levels in a normal playthrough: ~2 on day 4, ~4 on day 7, ~6 on day 12.
export const ENCOUNTERS = {
    tutorial: { foes: [['wisp', 1], ['wisp', 1]], where: 'forest', music: 'battle' },
    archive: { foes: [['armor', 2]], where: 'archive', music: 'battle' },
    yuki: { foes: [['acolyte', 3], ['wisp', 3], ['acolyte', 3]], where: 'forest', music: 'battle' },
    gargoyles: { foes: [['gargoyle', 4], ['gargoyle', 4]], where: 'courtyard-night', music: 'battle', guest: 'graves' },
    training: { foes: [['dummy', 0], ['dummy', 0]], where: 'arena', music: 'battle', optional: true, scale: 'party' },
    explore: { foes: 'random', where: 'forest', music: 'battle', optional: true },
    resLibrary: { foes: [['armor', 7], ['acolyte', 7]], where: 'library', music: 'climax' },
    resForest: { foes: [['wisp', 7], ['acolyte', 7], ['wisp', 7]], where: 'forest', music: 'climax' },
    resSky: { foes: [['gargoyle', 7], ['gargoyle', 7]], where: 'skyfield', music: 'climax' },
    resHall: { foes: [['acolyte', 8], ['armor', 8], ['acolyte', 8]], where: 'hall', music: 'climax' },
    boss: { foes: [['boss', 9]], where: 'undercroft', music: 'climax', guest: 'graves' },
};

// ------------------------------------------------------------------ items
// kind: heal (hp), mp, revive, healall, gift, key (story), collect.
export const ITEMS = {
    healing: { name: 'Healing Draught', kind: 'heal', value: 70, price: 25, desc: 'Restores 70 HP to one ally.' },
    mana: { name: 'Mana Tonic', kind: 'mp', value: 25, price: 30, desc: 'Restores 25 MP to one ally.' },
    phoenix: { name: 'Phoenix Feather', kind: 'revive', value: 0.5, price: 80, desc: 'Revives a fallen ally with half their HP.' },
    tart: { name: 'Starfruit Tart', kind: 'healall', value: 45, price: 40, desc: 'Restores 45 HP to the whole party. Also a nice gift.' },
    candy: { name: 'Lemon Candy', kind: 'heal', value: 30, price: 0, desc: 'The principal hands these out. Restores 30 HP.' },
    chime: { name: 'Echo Chime', kind: 'mpall', value: 12, price: 45, desc: 'Restores 12 MP to the whole party.' },
    chestnuts: { name: 'Spicy Chestnuts', kind: 'gift', price: 15, desc: 'Roasted with chili. Somebody\'s favourite.' },
    starchart: { name: 'Star Chart', kind: 'gift', price: 30, desc: 'A hand-inked map of the autumn sky.' },
    gears: { name: 'Brass Gears', kind: 'gift', price: 20, desc: 'Shiny, springy, full of potential.' },
    honeybun: { name: 'Honey Bun', kind: 'gift', price: 12, desc: 'Sticky, warm, irresistible.' },
    moonflower: { name: 'Pressed Moonflower', kind: 'gift', price: 25, desc: 'A pale blue bloom in a little glass frame.' },
    fireopal: { name: 'Fire Opal', kind: 'gift', price: 45, desc: 'A stone with a flame trapped inside.' },
    windchime: { name: 'Glass Wind Chime', kind: 'gift', price: 28, desc: 'Sings in the slightest breeze.' },
    bubblesoap: { name: 'Rainbow Bubble Soap', kind: 'gift', price: 18, desc: 'Makes bubbles that change colour.' },
    bookmark: { name: 'Ribbon Bookmark', kind: 'gift', price: 14, desc: 'Lavender satin with a tiny gold star.' },
    moonpetal: { name: 'Moonpetal', kind: 'collect', desc: 'Glows faintly. Pip wants five for an experiment.' },
    librarybook: { name: 'Overdue Library Book', kind: 'key', desc: '"Resonance and Its Echoes". Theo\'s. Very overdue.' },
    silverkey: { name: 'Silver Key', kind: 'key', desc: 'Opens the Restricted Archive. Lys "borrowed" it.' },
    maskshard: { name: 'Mask Shard', kind: 'key', desc: 'A piece of a white porcelain mask. Cold to the touch.' },
    hollowshard: { name: 'Hollow Crystal', kind: 'key', desc: 'Violet, with a dark empty core. It hums when you hold it.' },
    mochitreat: { name: 'Cloud Marshmallow', kind: 'collect', desc: 'Mochi\'s favourite snack.' },
    lantern: { name: 'Star Lantern', kind: 'key', desc: 'For the Starfall Festival.' },
    cagekey: { name: 'Crystal Key', kind: 'key', desc: 'Opens a Hollow cage.' },
};
export const SHOP = ['healing', 'mana', 'tart', 'chime', 'phoenix', 'chestnuts', 'honeybun', 'gears', 'bubblesoap', 'bookmark', 'starchart', 'moonflower', 'windchime', 'fireopal'];
// each item's icon in art/icons (most are the same name)
export const ICON = { healing: 'healing', mana: 'mana', phoenix: 'phoenix', tart: 'tart', candy: 'candy', chime: 'chime', chestnuts: 'chestnuts', starchart: 'starchart', gears: 'gears', honeybun: 'honeybun', moonflower: 'moonflower', fireopal: 'fireopal', windchime: 'windchime', bubblesoap: 'bubblesoap', bookmark: 'bookmark', moonpetal: 'moonpetal', librarybook: 'librarybook', silverkey: 'silverkey', maskshard: 'maskshard', hollowshard: 'hollowshard', mochitreat: 'mochitreat', lantern: 'lantern', cagekey: 'cagekey', charm: 'charm', lumens: 'coin' };

// ------------------------------------------------------------------ the campus
// x east, z south, world units. r: how close counts as "here". bg: the VN background for scenes there.
export const PLACES = {
    gate: { name: 'Sky Bridge Gate', x: 0, z: 38, r: 4, bg: 'gate' },
    courtyard: { name: 'Fountain Courtyard', x: 0, z: 8, r: 5, bg: 'courtyard', shop: true },
    hall: { name: 'Great Hall', x: 0, z: -14, r: 5, bg: 'hall' },
    library: { name: 'Grand Library', x: -24, z: -6, r: 4.5, bg: 'library', friend: 'lys' },
    lab: { name: 'Alchemy Lab', x: 24, z: -6, r: 4.5, bg: 'lab', friend: 'pip' },
    arena: { name: 'Dueling Grounds', x: 22, z: 20, r: 5, bg: 'arena', friend: 'hana', train: true },
    skyfield: { name: 'Sky Tower Field', x: 30, z: -28, r: 5, bg: 'skyfield', friend: 'ren' },
    dorm: { name: 'Dormitory', x: -22, z: 22, r: 4.5, bg: 'dorm', sleep: true },
    infirmary: { name: 'Infirmary', x: -12, z: -24, r: 3.5, bg: 'infirmary' },
    tower: { name: 'Principal\'s Tower', x: -30, z: -28, r: 4, bg: 'office' },
    forest: { name: 'Whispering Wood', x: -38, z: 6, r: 5, bg: 'forest', explore: true },
};
export const PLACE_IDS = Object.keys(PLACES);

// The twelve Echo Charms hidden around the island, and the moonpetals (Pip's quest) and marshmallows (Mochi's).
export const CHARMS = [
    { id: 'c1', x: -8, z: 30, text: 'A charm humming with your first nervous footsteps onto the bridge.' },
    { id: 'c2', x: 10, z: 14, text: 'It rings like the fountain on a bright morning.' },
    { id: 'c3', x: -33, z: -12, text: 'Tucked under a gnarled root. It sounds like rustling pages.' },
    { id: 'c4', x: 33, z: 3, text: 'Smells faintly of burnt sugar. Pip was definitely here.' },
    { id: 'c5', x: 30, z: 28, text: 'Warm to the touch, like a cheering crowd.' },
    { id: 'c6', x: 38, z: -20, text: 'It whistles in the wind off the cliff.' },
    { id: 'c7', x: -30, z: 30, text: 'It sounds like someone snoring. Ren, probably.' },
    { id: 'c8', x: -4, z: -30, text: 'A low note, like the great bell, very far away.' },
    { id: 'c9', x: -42, z: -4, text: 'It echoes like a voice calling between trees.' },
    { id: 'c10', x: 14, z: -22, text: 'Bright and brassy, like a fanfare.' },
    { id: 'c11', x: -16, z: 2, text: 'Soft and sweet, like a lullaby.' },
    { id: 'c12', x: 6, z: 42, text: 'It hums a melody you almost remember. Home.' },
];
export const PETALS = [
    { id: 'p1', x: -36, z: 14 }, { id: 'p2', x: -40, z: -2 }, { id: 'p3', x: -30, z: 10 },
    { id: 'p4', x: -18, z: 34 }, { id: 'p5', x: 12, z: -34 }, { id: 'p6', x: 38, z: 6 },
];
export const TREATS = [{ id: 't1', x: 18, z: 4 }, { id: 't2', x: -8, z: -8 }, { id: 't3', x: 26, z: 34 }];

// ------------------------------------------------------------------ the school week
// Each day: the morning class (a mini-game, or null) and the story scenes that open the morning and close the night.
export const MINIS = {
    echo: { name: 'Resonance', teacher: 'graves', desc: 'Repeat the crystal song.' },
    runes: { name: 'Rune Strokes', teacher: 'graves', desc: 'Trace each rune\'s strokes before it fades.' },
    potion: { name: 'Potion Brewing', teacher: 'pip', desc: 'Add each ingredient as the needle crosses the glow.' },
    stars: { name: 'Star Catcher', teacher: 'lys', desc: 'Catch falling stars; dodge the comets.' },
    rings: { name: 'Sky Rings', teacher: 'ren', desc: 'Fly your broom through every ring.' },
    fireball: { name: 'Fireball Gallery', teacher: 'hana', desc: 'Blast the masked targets; spare the Mochi plushies.' },
};
export const SCHEDULE = {
    1: { morning: 'd1m', night: 'd1n' },
    2: { morning: 'd2m', cls: ['runes', 1], night: 'd2n' },
    3: { morning: 'd3m', cls: ['potion', 1], night: 'd3n' },
    4: { morning: 'd4m', cls: ['stars', 1], night: 'd4n' },
    5: { morning: 'd5m', cls: ['rings', 1], night: 'd5n' },
    6: { morning: 'd6m', cls: ['fireball', 1], night: 'd6n' },
    7: { morning: 'd7m', cls: ['echo', 2], night: 'd7n' },
    8: { morning: 'd8m', cls: ['runes', 2], night: 'd8n' },
    9: { morning: 'd9m', cls: ['potion', 2], night: 'd9n' },
    10: { morning: 'd10m', cls: ['stars', 2], night: 'd10n' },
    11: { morning: 'd11m', night: 'd11n' },
};
// Party members join at these story beats (flags set by the story).
export const CHAPTERS = [
    { n: 1, name: 'The Boy Who Echoes', from: 1 },
    { n: 2, name: 'Moonfade', from: 3 },
    { n: 3, name: 'Whispers in the Stacks', from: 6 },
    { n: 4, name: 'Starfall Festival', from: 9 },
    { n: 5, name: 'The Hollow Moon', from: 11 },
];

// The rescue at the climax: who is held where.
export const RESCUES = [
    { id: 'theo', place: 'library', enc: 'resLibrary', label: 'Theo' },
    { id: 'yuki', place: 'forest', enc: 'resForest', label: 'Yuki' },
    { id: 'firsties', place: 'skyfield', enc: 'resSky', label: 'the first-years' },
    { id: 'best', place: 'hall', enc: 'resHall', label: '{best}' },
];

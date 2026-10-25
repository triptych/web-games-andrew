// Wyrmbond — the tables: elements, terrain, dragon species, the Chain's soldiers, skills, traits and
// commanders. Pure data; the rules that read it live in the other sim modules.

// ------------------------------------------------------------------ elements
// The five-fold wheel: each element beats the next. Lumen and Umbra are each other's bane. Aether has
// no edge and no weakness. Iron (the Chain's steel) is neutral.
export const ELEMENTS = {
    ember:   { name: 'Ember',   icon: '🔥', color: 0xff6a2a, css: '#ff7a33', beats: 'verdant' },
    verdant: { name: 'Verdant', icon: '🌿', color: 0x5fd04a, css: '#62d44c', beats: 'stone' },
    stone:   { name: 'Stone',   icon: '🪨', color: 0xc8a064, css: '#d0a86a', beats: 'storm' },
    storm:   { name: 'Storm',   icon: '⚡', color: 0xffdc3a, css: '#ffd93a', beats: 'tide' },
    tide:    { name: 'Tide',    icon: '💧', color: 0x3aa6ff, css: '#45aaff', beats: 'ember' },
    lumen:   { name: 'Lumen',   icon: '☀️', color: 0xfff0a0, css: '#ffeea0', beats: 'umbra' },
    umbra:   { name: 'Umbra',   icon: '🌑', color: 0xa060ff, css: '#a868ff', beats: 'lumen' },
    aether:  { name: 'Aether',  icon: '✨', color: 0xff9af0, css: '#ff9cf2', beats: null },
    iron:    { name: 'Iron',    icon: '⛓️', color: 0x9aa4b4, css: '#a8b0c0', beats: null },
};
export const WHEEL = ['ember', 'verdant', 'stone', 'storm', 'tide'];

// ------------------------------------------------------------------ movement and terrain
// Move types. A null cost is impassable.
export const MOVETYPES = ['walk', 'fly', 'swim', 'ride', 'wheel'];

// Terrain. `def` is the number of defence stars (each cuts damage; fliers get none). Property tiles are
// written with an owner in the map strings (see story.js) and read back as their base type.
export const TERRAIN = {
    plains:  { name: 'Grassland', def: 1, cost: { walk: 1, fly: 1, swim: 2, ride: 1, wheel: 1 } },
    forest:  { name: 'Forest',    def: 2, cost: { walk: 2, fly: 1, swim: 3, ride: 3, wheel: 2 } },
    hills:   { name: 'Hills',     def: 2, cost: { walk: 2, fly: 1, swim: 3, ride: 2, wheel: 2 } },
    mount:   { name: 'Mountain',  def: 4, cost: { walk: 3, fly: 2, swim: null, ride: null, wheel: null } },
    sea:     { name: 'Sea',       def: 0, cost: { walk: null, fly: 1, swim: 1, ride: null, wheel: null } },
    shoal:   { name: 'Shallows',  def: 0, cost: { walk: 2, fly: 1, swim: 1, ride: null, wheel: null } },
    road:    { name: 'Road',      def: 0, cost: { walk: 1, fly: 1, swim: 2, ride: 1, wheel: 1 } },
    bridge:  { name: 'Bridge',    def: 0, cost: { walk: 1, fly: 1, swim: 1, ride: 1, wheel: 1 } },
    swamp:   { name: 'Bog',       def: 0, cost: { walk: 3, fly: 1, swim: 1, ride: null, wheel: null } },
    lava:    { name: 'Lava',      def: 0, cost: { walk: null, fly: 1, swim: null, ride: null, wheel: null } },
    snow:    { name: 'Snowfield', def: 1, cost: { walk: 2, fly: 1, swim: 3, ride: 2, wheel: 2 } },
    ruins:   { name: 'Ruins',     def: 2, cost: { walk: 1, fly: 1, swim: 2, ride: 2, wheel: 2 } },
    crystal: { name: 'Wyrm Shrine', def: 2, cost: { walk: 1, fly: 1, swim: 2, ride: 1, wheel: 1 }, heal: 0.2 },
    cliff:   { name: 'Crag',      def: 0, cost: { walk: null, fly: 2, swim: null, ride: null, wheel: null } },
    village: { name: 'Village',   def: 3, cost: { walk: 1, fly: 1, swim: 2, ride: 1, wheel: 1 }, prop: true },
    roost:   { name: 'Roost',     def: 3, cost: { walk: 1, fly: 1, swim: 2, ride: 1, wheel: 1 }, prop: true, deploy: true },
    hq:      { name: 'Stronghold', def: 4, cost: { walk: 1, fly: 1, swim: 2, ride: 1, wheel: 1 }, prop: true, hq: true },
};

/** Map characters → [terrain, owner]. Owners: 'p' the player, 'e' the Chain, null neutral. */
export const TILE_CHARS = {
    '.': ['plains', null], f: ['forest', null], h: ['hills', null], m: ['mount', null],
    '~': ['sea', null], w: ['shoal', null], '=': ['road', null], b: ['bridge', null],
    s: ['swamp', null], l: ['lava', null], '*': ['snow', null], t: ['ruins', null],
    c: ['crystal', null], '#': ['cliff', null],
    v: ['village', null], 1: ['village', 'p'], 2: ['village', 'e'],
    r: ['roost', null], R: ['roost', 'p'], K: ['roost', 'e'],
    H: ['hq', 'p'], E: ['hq', 'e'],
};

// ------------------------------------------------------------------ classes
// Body plans. Fliers ignore terrain defence (and get none); ground dragons dig in.
export const CLASSES = {
    wyvern:   { name: 'Wyvern',  flier: true },
    drake:    { name: 'Drake' },
    serpent:  { name: 'Serpent' },
    wyrm:     { name: 'Wyrm' },
    tamer:    { name: 'Tamer',   human: true },
    infantry: { name: 'Footman', human: true },
    lancer:   { name: 'Lancer',  human: true },
    siege:    { name: 'Siege',   human: true },
    mage:     { name: 'Hexer',   human: true },
    beast:    { name: 'Beast' },
    lord:     { name: 'Lord',    human: true },
    pylon:    { name: 'Pylon' },
};

/** Who hurts whom more, Advance Wars style. Missing pairs are 1. */
export const CLASS_MULT = {
    siege:    { wyvern: 1.7, wyrm: 1.25, pylon: 0 },
    lancer:   { drake: 1.3, wyrm: 1.2, serpent: 1.15 },
    mage:     { wyrm: 1.25, wyvern: 1.1 },
    wyvern:   { siege: 1.4, mage: 1.25, tamer: 1.1 },
    drake:    { infantry: 1.25, lancer: 1.15, beast: 1.2 },
    wyrm:     { infantry: 1.3, lancer: 1.2, siege: 1.3, lord: 1.1 },
    serpent:  { siege: 1.2, lancer: 1.1 },
    beast:    { tamer: 1.25, mage: 1.2 },
    infantry: { siege: 1.2 },
    tamer:    { pylon: 1.4 },
};

// ------------------------------------------------------------------ dragon species
// base = level 1 stats, grow = per level. Genes (0–15 per stat) scale both by 0.85–1.15.
// rarity 1–5 sets hatch time and market odds. `hybrid` species only come from breeding.
// look: body plan details for the procedural model (see view/dragons.js).
export const SPECIES = {
    cinderwing: {
        name: 'Cinderwing', el: 'ember', cls: 'wyvern', mt: 'fly', mv: 6, rng: [1, 1], rarity: 2,
        base: { hp: 18, atk: 9, def: 4, spd: 8 }, grow: { hp: 2.1, atk: 1.6, def: 0.8, spd: 1.3 },
        skill: 'flare', trait: 'swift',
        look: { body: '#e8542a', belly: '#ffc36a', accent: '#ffe27a', horns: 2, wing: 1.1, tail: 1.1, frill: false },
        desc: 'A quick, bright-scaled wyvern that rides thermals and spits sparks when it laughs.',
    },
    ripplefin: {
        name: 'Ripplefin', el: 'tide', cls: 'serpent', mt: 'swim', mv: 5, rng: [1, 1], rarity: 2,
        base: { hp: 20, atk: 8, def: 5, spd: 7 }, grow: { hp: 2.2, atk: 1.5, def: 0.9, spd: 1.1 },
        skill: 'tidal', trait: 'aquatic',
        look: { body: '#2a8ee8', belly: '#a8f0ff', accent: '#ffffff', horns: 0, wing: 0, tail: 1.3, frill: true },
        desc: 'A river serpent with sail-like fins. Slow on land, a torrent in water.',
    },
    mossling: {
        name: 'Mossling', el: 'verdant', cls: 'drake', mt: 'walk', mv: 5, rng: [1, 1], rarity: 2,
        base: { hp: 22, atk: 7, def: 6, spd: 5 }, grow: { hp: 2.4, atk: 1.3, def: 1.1, spd: 0.9 },
        skill: 'bloom', trait: 'regrowth',
        look: { body: '#4fb848', belly: '#d8f0a0', accent: '#ff8ac8', horns: 2, wing: 0.5, tail: 0.9, frill: false, leaves: true },
        desc: 'A round, gentle drake with flowers sprouting from its back. It mends what it touches.',
    },
    magmaback: {
        name: 'Magmaback', el: 'ember', cls: 'drake', mt: 'walk', mv: 4, rng: [1, 1], rarity: 2,
        base: { hp: 26, atk: 9, def: 8, spd: 3 }, grow: { hp: 2.8, atk: 1.5, def: 1.4, spd: 0.5 },
        skill: 'magmashell', trait: 'lavaborn',
        look: { body: '#5a3a34', belly: '#ff8a3a', accent: '#ffb030', horns: 4, wing: 0, tail: 0.9, frill: false, plates: true },
        desc: 'A slow, armoured drake whose back plates glow with banked fire.',
    },
    pyrewyrm: {
        name: 'Pyrewyrm', el: 'ember', cls: 'wyrm', mt: 'walk', mv: 4, rng: [1, 2], rarity: 4,
        base: { hp: 28, atk: 12, def: 7, spd: 4 }, grow: { hp: 2.9, atk: 2.0, def: 1.2, spd: 0.7 },
        skill: 'inferno', trait: 'lavaborn',
        look: { body: '#b8241a', belly: '#ffcf5a', accent: '#2a1410', horns: 6, wing: 1.3, tail: 1.2, frill: true },
        desc: 'An old-blooded fire wyrm. Its breath reaches two leagues, or so the bards say.',
    },
    frostmaw: {
        name: 'Frostmaw', el: 'tide', cls: 'drake', mt: 'walk', mv: 4, rng: [1, 1], rarity: 3,
        base: { hp: 24, atk: 9, def: 7, spd: 4 }, grow: { hp: 2.5, atk: 1.6, def: 1.3, spd: 0.7 },
        skill: 'frostbite', trait: 'thickhide',
        look: { body: '#9ad8f0', belly: '#ffffff', accent: '#3a7ac8', horns: 4, wing: 0.4, tail: 1, frill: false, crystals: true },
        desc: 'A shaggy ice drake. Its bite freezes a foe where it stands.',
    },
    abyssal: {
        name: 'Abyssal Leviathan', el: 'tide', cls: 'serpent', mt: 'swim', mv: 5, rng: [1, 2], rarity: 4,
        base: { hp: 30, atk: 12, def: 8, spd: 5 }, grow: { hp: 3.0, atk: 1.9, def: 1.3, spd: 0.8 },
        skill: 'maelstrom', trait: 'aquatic',
        look: { body: '#1a3a8a', belly: '#5af0d0', accent: '#d0fff8', horns: 2, wing: 0, tail: 1.6, frill: true, glow: true },
        desc: 'A deep-sea wyrm lit by its own lanterns. Whirlpools follow it.',
    },
    thornback: {
        name: 'Thornback', el: 'verdant', cls: 'drake', mt: 'walk', mv: 4, rng: [1, 1], rarity: 2,
        base: { hp: 26, atk: 8, def: 9, spd: 3 }, grow: { hp: 2.7, atk: 1.4, def: 1.5, spd: 0.5 },
        skill: 'thornwall', trait: 'thorns',
        look: { body: '#2f7a3a', belly: '#b8d878', accent: '#7a4a20', horns: 3, wing: 0, tail: 1, frill: false, spikes: true },
        desc: 'Bramble-armoured and stubborn. Anything that bites it regrets it.',
    },
    sylvara: {
        name: 'Sylvan Wyrm', el: 'verdant', cls: 'wyrm', mt: 'fly', mv: 5, rng: [1, 1], rarity: 4,
        base: { hp: 26, atk: 10, def: 7, spd: 6 }, grow: { hp: 2.8, atk: 1.6, def: 1.2, spd: 1.0 },
        skill: 'lifebloom', trait: 'regrowth',
        look: { body: '#6ad8a0', belly: '#fff0c0', accent: '#ff9ad8', horns: 4, wing: 1.4, tail: 1.3, frill: true, leaves: true },
        desc: 'A forest guardian with petal wings. Wounded trees lean towards it.',
    },
    zephyrling: {
        name: 'Zephyrling', el: 'storm', cls: 'wyvern', mt: 'fly', mv: 7, rng: [1, 1], rarity: 2,
        base: { hp: 16, atk: 8, def: 3, spd: 10 }, grow: { hp: 1.9, atk: 1.4, def: 0.6, spd: 1.6 },
        skill: 'tailwind', trait: 'swift',
        look: { body: '#9ad0ff', belly: '#ffffff', accent: '#ffe04a', horns: 2, wing: 1.3, tail: 1.3, frill: false, feathers: true },
        desc: 'A feathery breeze-dragon. It can carry an ally on its slipstream.',
    },
    thunderhorn: {
        name: 'Thunderhorn', el: 'storm', cls: 'wyvern', mt: 'fly', mv: 5, rng: [1, 2], rarity: 3,
        base: { hp: 20, atk: 10, def: 5, spd: 7 }, grow: { hp: 2.2, atk: 1.8, def: 0.9, spd: 1.1 },
        skill: 'chainbolt', trait: 'skybreaker',
        look: { body: '#3a3a6a', belly: '#ffe85a', accent: '#ffe85a', horns: 1, wing: 1.2, tail: 1, frill: false, bighorn: true },
        desc: 'Lightning crackles along its single horn. Fliers fear it.',
    },
    tempestra: {
        name: 'Tempest Wyrm', el: 'storm', cls: 'wyrm', mt: 'fly', mv: 6, rng: [1, 2], rarity: 4,
        base: { hp: 28, atk: 12, def: 7, spd: 8 }, grow: { hp: 2.8, atk: 1.9, def: 1.2, spd: 1.2 },
        skill: 'thunderstorm', trait: 'firststrike',
        look: { body: '#5a6ad8', belly: '#d0e0ff', accent: '#ffffff', horns: 4, wing: 1.5, tail: 1.4, frill: true },
        desc: 'Storm clouds gather wherever it lands. Sky-knights of the Gale ride its kin.',
    },
    pebblescale: {
        name: 'Pebblescale', el: 'stone', cls: 'drake', mt: 'walk', mv: 4, rng: [1, 1], rarity: 1,
        base: { hp: 24, atk: 8, def: 10, spd: 3 }, grow: { hp: 2.5, atk: 1.4, def: 1.6, spd: 0.5 },
        skill: 'stoneskin', trait: 'mountainlord',
        look: { body: '#9a8a7a', belly: '#d8c8a8', accent: '#6a5a4a', horns: 2, wing: 0, tail: 0.8, frill: false, plates: true },
        desc: 'A pebble-backed little drake. Hardy, cheerful and almost impossible to dent.',
    },
    gargoyle: {
        name: 'Granitewing', el: 'stone', cls: 'wyvern', mt: 'fly', mv: 5, rng: [1, 1], rarity: 3,
        base: { hp: 22, atk: 9, def: 8, spd: 5 }, grow: { hp: 2.4, atk: 1.6, def: 1.4, spd: 0.8 },
        skill: 'petrify', trait: 'thickhide',
        look: { body: '#7a8088', belly: '#a8b0b8', accent: '#5af0c0', horns: 4, wing: 1.1, tail: 1, frill: false },
        desc: 'A living statue. Its gaze turns muscle to stone, for a little while.',
    },
    geodon: {
        name: 'Geode Wyrm', el: 'stone', cls: 'wyrm', mt: 'walk', mv: 3, rng: [1, 1], rarity: 4,
        base: { hp: 34, atk: 13, def: 11, spd: 2 }, grow: { hp: 3.4, atk: 2.0, def: 1.7, spd: 0.4 },
        skill: 'quake', trait: 'mountainlord',
        look: { body: '#6a5a8a', belly: '#c8b0e0', accent: '#d08aff', horns: 3, wing: 0.6, tail: 1, frill: false, crystals: true },
        desc: 'A mountain that walks. Amethyst grows in the cracks of its hide.',
    },
    solaris: {
        name: 'Solaris', el: 'lumen', cls: 'wyvern', mt: 'fly', mv: 6, rng: [1, 1], rarity: 5,
        base: { hp: 26, atk: 12, def: 7, spd: 9 }, grow: { hp: 2.7, atk: 2.0, def: 1.2, spd: 1.3 },
        skill: 'radiance', trait: 'firststrike',
        look: { body: '#fff0b0', belly: '#ffffff', accent: '#ffb020', horns: 4, wing: 1.5, tail: 1.3, frill: true, glow: true },
        desc: 'The dawn-dragon of the old songs. Its wings shed warm light.',
    },
    noctyx: {
        name: 'Noctyx', el: 'umbra', cls: 'wyvern', mt: 'fly', mv: 6, rng: [1, 1], rarity: 5,
        base: { hp: 24, atk: 13, def: 6, spd: 10 }, grow: { hp: 2.5, atk: 2.1, def: 1.0, spd: 1.5 },
        skill: 'shadowbite', trait: 'nightstalker',
        look: { body: '#2a1a4a', belly: '#8a5ad8', accent: '#ff5ad0', horns: 3, wing: 1.5, tail: 1.4, frill: false, glow: true },
        desc: 'A dusk-dragon with starry wings. It hunts where the light gives out.',
    },
    // hybrids: only from breeding (see BREED_RECIPES)
    obsidrake: {
        name: 'Obsidian Drake', el: 'ember', cls: 'drake', mt: 'walk', mv: 4, rng: [1, 1], rarity: 4, hybrid: true,
        base: { hp: 30, atk: 11, def: 11, spd: 3 }, grow: { hp: 3.1, atk: 1.9, def: 1.7, spd: 0.6 },
        skill: 'magmashell', trait: 'lavaborn',
        look: { body: '#1a1418', belly: '#ff5a2a', accent: '#ff8a2a', horns: 5, wing: 0.5, tail: 1, frill: false, plates: true, glow: true },
        desc: 'Volcanic glass scales over a heart of magma. Bred, never found.',
    },
    mistral: {
        name: 'Mistral Serpent', el: 'storm', cls: 'serpent', mt: 'swim', mv: 6, rng: [1, 2], rarity: 4, hybrid: true,
        base: { hp: 24, atk: 11, def: 6, spd: 9 }, grow: { hp: 2.5, atk: 1.8, def: 1.0, spd: 1.4 },
        skill: 'chainbolt', trait: 'swift',
        look: { body: '#4ac8d8', belly: '#ffffff', accent: '#ffe04a', horns: 1, wing: 0.7, tail: 1.5, frill: true },
        desc: 'Sea-spray and lightning. A breed only the patient keeper ever sees.',
    },
    lotuswyrm: {
        name: 'Lotus Wyrm', el: 'verdant', cls: 'serpent', mt: 'swim', mv: 5, rng: [1, 1], rarity: 4, hybrid: true,
        base: { hp: 28, atk: 9, def: 8, spd: 6 }, grow: { hp: 2.9, atk: 1.4, def: 1.4, spd: 0.9 },
        skill: 'lifebloom', trait: 'aquatic',
        look: { body: '#e88ad0', belly: '#fff8d0', accent: '#5ad08a', horns: 2, wing: 0, tail: 1.3, frill: true, leaves: true },
        desc: 'A pond-serpent crowned with lotus blossoms. Healers prize its company.',
    },
    blazewing: {
        name: 'Blazewing', el: 'ember', cls: 'wyvern', mt: 'fly', mv: 7, rng: [1, 1], rarity: 4, hybrid: true,
        base: { hp: 20, atk: 12, def: 5, spd: 11 }, grow: { hp: 2.2, atk: 2.0, def: 0.8, spd: 1.6 },
        skill: 'flare', trait: 'nightstalker',
        look: { body: '#ff8a1a', belly: '#fff07a', accent: '#5ad0ff', horns: 2, wing: 1.4, tail: 1.4, frill: false, feathers: true },
        desc: 'Fire on the wind. Faster than any wyvern born of one element.',
    },
    aurelion: {
        name: 'Aurelion', el: 'aether', cls: 'wyrm', mt: 'fly', mv: 6, rng: [1, 2], rarity: 5, hybrid: true,
        base: { hp: 32, atk: 14, def: 9, spd: 9 }, grow: { hp: 3.2, atk: 2.2, def: 1.4, spd: 1.3 },
        skill: 'prism', trait: 'sturdy',
        look: { body: '#ffd8f8', belly: '#ffffff', accent: '#8af0ff', horns: 6, wing: 1.6, tail: 1.5, frill: true, glow: true },
        desc: 'Born of dawn and dusk together. The first of a new kind.',
    },
};

/** Two parents of these elements may produce a hybrid instead of a parent's species. */
export const BREED_RECIPES = [
    { els: ['ember', 'stone'], sp: 'obsidrake', chance: 0.25 },
    { els: ['tide', 'storm'], sp: 'mistral', chance: 0.25 },
    { els: ['verdant', 'tide'], sp: 'lotuswyrm', chance: 0.25 },
    { els: ['ember', 'storm'], sp: 'blazewing', chance: 0.25 },
    { els: ['lumen', 'umbra'], sp: 'aurelion', chance: 0.6 },
];

// ------------------------------------------------------------------ humans and the Chain
// Stats are the same shape as a species. `capture` units claim at full speed.
export const UNITS = {
    tamer: {
        name: 'Kestrel', el: 'aether', cls: 'tamer', mt: 'walk', mv: 5, rng: [1, 1], capture: 1,
        base: { hp: 24, atk: 6, def: 6, spd: 6 }, grow: { hp: 1.9, atk: 0.8, def: 0.95, spd: 0.6 }, tamer: true,
        desc: 'A dragon tamer of Emberfall. Claims villages, calls dragons, and can break a Chain-collar.',
    },
    brannoc: {
        name: 'Brannoc', el: 'aether', cls: 'tamer', mt: 'walk', mv: 5, rng: [1, 1], capture: 1,
        base: { hp: 30, atk: 10, def: 8, spd: 5 }, grow: { hp: 1.4, atk: 0.8, def: 0.6, spd: 0.4 }, tamer: true,
        desc: 'Old roostkeeper of Emberfall. He has forgotten more dragon-lore than most keepers learn.',
    },
    sera: {
        name: 'Sera & Skyla', el: 'storm', cls: 'wyrm', mt: 'fly', mv: 6, rng: [1, 2], capture: 0.5, species: 'tempestra',
        base: { hp: 30, atk: 12, def: 8, spd: 9 }, grow: { hp: 2.2, atk: 1.4, def: 1.0, spd: 1.0 }, skill: 'thunderstorm', trait: 'firststrike',
        desc: 'Sera Vael, sky-knight of the Gale Order, on her Tempest Wyrm Skyla.',
    },
    varekally: {
        name: 'Varek', el: 'iron', cls: 'lord', mt: 'ride', mv: 6, rng: [1, 1], capture: 1,
        base: { hp: 40, atk: 13, def: 11, spd: 7 }, grow: { hp: 1.6, atk: 1.0, def: 0.8, spd: 0.4 }, skill: 'warcry', trait: 'sturdy',
        desc: 'Varek Duskmantle, once the Chain\'s general. He rides with you now.',
    },
    chainknight: {
        name: 'Chain Knight', el: 'iron', cls: 'infantry', mt: 'walk', mv: 3, rng: [1, 1], capture: 1, cost: 150,
        base: { hp: 18, atk: 8, def: 5, spd: 4 }, grow: { hp: 1.7, atk: 1.2, def: 0.8, spd: 0.5 },
        desc: 'Foot soldier of the Obsidian Chain. Slow, stubborn, claims what it stands on.',
    },
    chainhound: {
        name: 'Chainhound', el: 'umbra', cls: 'beast', mt: 'walk', mv: 5, rng: [1, 1], cost: 200,
        base: { hp: 16, atk: 8, def: 4, spd: 8 }, grow: { hp: 1.6, atk: 1.3, def: 0.6, spd: 1.0 },
        desc: 'A shadow-wolf bound with iron. Goes for the tamer.',
    },
    lancer: {
        name: 'Chain Lancer', el: 'iron', cls: 'lancer', mt: 'ride', mv: 6, rng: [1, 1], capture: 1, cost: 300,
        base: { hp: 22, atk: 9, def: 6, spd: 6 }, grow: { hp: 1.9, atk: 1.4, def: 0.9, spd: 0.7 },
        desc: 'Heavy horse with a drake-lance. Deadly to anything that walks on four legs.',
    },
    ballista: {
        name: 'Skyhook Ballista', el: 'iron', cls: 'siege', mt: 'wheel', mv: 4, rng: [2, 3], indirect: true, cost: 400,
        base: { hp: 16, atk: 13, def: 3, spd: 1 }, grow: { hp: 1.3, atk: 1.6, def: 0.5, spd: 0.1 },
        desc: 'Fires harpoons at fliers from afar. Cannot move and shoot in one turn, and cannot strike back.',
    },
    hexer: {
        name: 'Chain Hexer', el: 'umbra', cls: 'mage', mt: 'walk', mv: 4, rng: [1, 2], cost: 350, skill: 'bind',
        base: { hp: 16, atk: 10, def: 3, spd: 5 }, grow: { hp: 1.3, atk: 1.5, def: 0.5, spd: 0.7 },
        desc: 'Sings the binding-hymns that keep chained dragons obedient.',
    },
    grisk: {
        name: 'Captain Grisk', el: 'iron', cls: 'lord', mt: 'walk', mv: 4, rng: [1, 1], capture: 1, boss: true,
        base: { hp: 38, atk: 12, def: 8, spd: 6 }, grow: { hp: 1.8, atk: 1.1, def: 0.7, spd: 0.4 }, skill: 'warcry',
        desc: 'A slaver-captain of the Chain with a hound-skull helm and a very loud voice.',
    },
    varek: {
        name: 'General Varek', el: 'iron', cls: 'lord', mt: 'ride', mv: 5, rng: [1, 1], capture: 1, boss: true,
        base: { hp: 44, atk: 14, def: 12, spd: 7 }, grow: { hp: 1.8, atk: 1.1, def: 0.8, spd: 0.4 }, skill: 'warcry', trait: 'sturdy',
        desc: 'Varek Duskmantle, the Iron General. He believes chains are kinder than extinction.',
    },
    sablethorn: {
        name: 'Mother Sablethorn', el: 'umbra', cls: 'mage', mt: 'walk', mv: 4, rng: [1, 2], boss: true, skill: 'bind',
        base: { hp: 36, atk: 15, def: 6, spd: 8 }, grow: { hp: 1.6, atk: 1.3, def: 0.6, spd: 0.6 }, trait: 'regrowth',
        desc: 'The bog-witch of Mirewood, who taught the Chain its binding-hymns.',
    },
    nyxara: {
        name: 'Empress Nyxara', el: 'umbra', cls: 'lord', mt: 'fly', mv: 5, rng: [1, 2], boss: true, skill: 'eclipse',
        base: { hp: 52, atk: 17, def: 11, spd: 10 }, grow: { hp: 1.8, atk: 1.2, def: 0.8, spd: 0.5 }, trait: 'sturdy',
        desc: 'The Obsidian Empress. She means to pour every dragon\'s fire into one chained god.',
    },
    vorthax: {
        name: 'Vorthax the World-Eater', el: 'umbra', cls: 'wyrm', mt: 'fly', mv: 2, rng: [1, 3], boss: true, skill: 'quake', species: 'vorthax',
        base: { hp: 90, atk: 19, def: 14, spd: 4 }, grow: { hp: 2.0, atk: 1.0, def: 0.6, spd: 0.2 }, trait: 'thickhide',
        desc: 'The eldest dragon, bound in the Great Chain beneath the Obsidian Throne.',
    },
    pylon: {
        name: 'Chain Pylon', el: 'iron', cls: 'pylon', mt: 'walk', mv: 0, rng: [0, 0], structure: true,
        base: { hp: 36, atk: 0, def: 8, spd: 0 }, grow: { hp: 1.2, atk: 0, def: 0.4, spd: 0 },
        desc: 'An obsidian spike that feeds the Great Chain. Break them all.',
    },
};

// ------------------------------------------------------------------ skills
// kind: blast (area damage), bolt (one target), push, heal, ward (+DEF%), rally (+ATK%), stun
// (damage then lose a turn), refresh (an ally acts again), chain (jumps), drain, nova (heal allies and
// hurt foes around you). Damage skills use the normal formula with `power`, and are never countered.
export const SKILLS = {
    flare:       { name: 'Flare Burst',   icon: '🔥', kind: 'bolt',  range: [1, 3], power: 0.85, cd: 2, desc: 'A spitting fireball at a foe up to 3 tiles away.' },
    inferno:     { name: 'Inferno',       icon: '🌋', kind: 'blast', range: [1, 3], area: 1, power: 0.8, cd: 4, desc: 'Burns a 3×3 area up to 3 tiles away. Foes only.' },
    tidal:       { name: 'Tidal Crash',   icon: '🌊', kind: 'push',  range: [1, 1], power: 0.8, cd: 2, desc: 'Slam a neighbour and push it 2 tiles. Hitting a wall or unit hurts more.' },
    maelstrom:   { name: 'Maelstrom',     icon: '🌀', kind: 'blast', range: [1, 3], area: 1, power: 0.8, cd: 4, desc: 'A whirlpool over a 3×3 area. Foes only.' },
    bloom:       { name: 'Bloom',         icon: '🌸', kind: 'heal',  range: [0, 2], amount: 0.4, cd: 3, desc: 'Heal an ally (or itself) within 2 by 40%.' },
    lifebloom:   { name: 'Lifebloom',     icon: '🌺', kind: 'heal',  range: [0, 2], area: 1, amount: 0.3, cd: 4, desc: 'Heal every ally in a 3×3 area by 30%.' },
    magmashell:  { name: 'Magma Shell',   icon: '🛡️', kind: 'ward',  range: [0, 1], amount: 0.35, turns: 2, cd: 3, desc: 'An ally within 1 takes 35% less damage for 2 turns.' },
    thornwall:   { name: 'Thornwall',     icon: '🌵', kind: 'ward',  range: [0, 1], amount: 0.3, turns: 2, cd: 3, thorns: true, desc: 'An ally within 1 takes 30% less damage and pricks attackers, 2 turns.' },
    stoneskin:   { name: 'Stoneskin',     icon: '🪨', kind: 'ward',  range: [0, 1], amount: 0.4, turns: 2, cd: 3, desc: 'An ally within 1 takes 40% less damage for 2 turns.' },
    frostbite:   { name: 'Frostbite',     icon: '❄️', kind: 'stun',  range: [1, 1], power: 0.55, cd: 3, desc: 'Bite and freeze a neighbour: it loses its next turn.' },
    petrify:     { name: 'Petrify Gaze',  icon: '🗿', kind: 'stun',  range: [1, 2], power: 0.3, cd: 3, desc: 'Turn a foe within 2 to stone for a turn.' },
    tailwind:    { name: 'Tailwind',      icon: '🌬️', kind: 'refresh', range: [1, 1], cd: 4, desc: 'A neighbour who has acted may act again.' },
    chainbolt:   { name: 'Chain Lightning', icon: '⚡', kind: 'chain', range: [1, 3], power: 0.7, jumps: 2, cd: 3, desc: 'A bolt that leaps to up to 2 more foes nearby.' },
    thunderstorm:{ name: 'Thunderstorm',  icon: '⛈️', kind: 'blast', range: [2, 4], area: 1, power: 0.75, cd: 4, desc: 'Lightning over a 3×3 area 2–4 tiles away.' },
    quake:       { name: 'Quake',         icon: '💥', kind: 'blast', range: [0, 0], area: 1, power: 0.8, cd: 3, desc: 'Shakes every foe next to it.' },
    radiance:    { name: 'Radiance',      icon: '🌞', kind: 'nova',  range: [0, 0], area: 1, power: 0.6, amount: 0.25, cd: 4, desc: 'Heals neighbouring allies 25% and sears neighbouring foes.' },
    shadowbite:  { name: 'Shadow Bite',   icon: '🦷', kind: 'drain', range: [1, 1], power: 1.15, cd: 3, desc: 'A biting strike that heals for the damage dealt. No counter.' },
    prism:       { name: 'Prism Breath',  icon: '🌈', kind: 'blast', range: [1, 3], area: 1, power: 0.95, cd: 3, desc: 'Rainbow fire over a 3×3 area. Foes only.' },
    warcry:      { name: 'War Cry',       icon: '📯', kind: 'rally', range: [0, 0], area: 1, amount: 0.25, turns: 1, cd: 3, desc: 'It and allies next to it deal 25% more damage this turn and next.' },
    bind:        { name: 'Binding Hymn',  icon: '⛓️', kind: 'stun',  range: [1, 2], power: 0.35, cd: 3, desc: 'Chains a foe within 2: it loses its next turn.' },
    eclipse:     { name: 'Eclipse',       icon: '🌘', kind: 'blast', range: [1, 3], area: 1, power: 0.75, cd: 3, desc: 'Black fire over a 3×3 area.' },
};

// ------------------------------------------------------------------ traits
// Passive. A dragon has one from its species and may inherit or mutate a second through breeding.
export const TRAITS = {
    swift:        { name: 'Swift',        icon: '💨', desc: '+1 move.' },
    aquatic:      { name: 'Aquatic',      icon: '🐠', desc: 'Takes 25% less damage on water, bog or shallows.' },
    regrowth:     { name: 'Regrowth',     icon: '🌱', desc: 'Heals 10% at the start of each turn.' },
    lavaborn:     { name: 'Lavaborn',     icon: '🌋', desc: 'Walks on lava and heals 20% there. Takes 25% less Ember damage.' },
    thickhide:    { name: 'Thick Hide',   icon: '🦏', desc: 'Takes 12% less damage.' },
    thorns:       { name: 'Thorns',       icon: '🌵', desc: 'Close attackers take 20% of what they deal.' },
    skybreaker:   { name: 'Skybreaker',   icon: '🏹', desc: '+35% damage to fliers.' },
    firststrike:  { name: 'First Strike', icon: '⚔️', desc: 'Strikes back before the attacker lands its blow.' },
    mountainlord: { name: 'Mountain-born', icon: '⛰️', desc: 'Hills and mountains cost 1 move; +1 defence star there.' },
    nightstalker: { name: 'Nightstalker', icon: '🌙', desc: '+12% critical chance.' },
    sturdy:       { name: 'Sturdy',       icon: '🧱', desc: 'Survives one fatal blow per battle with 1 HP.' },
    brave:        { name: 'Brave',        icon: '🦁', desc: '+15% damage while at full health.' },
    keen:         { name: 'Keen Eye',     icon: '🎯', desc: '+8% critical chance.' },
    hardy:        { name: 'Hardy',        icon: '❤️', desc: '+12% max HP.' },
    loyal:        { name: 'Loyal',        icon: '💞', desc: 'Bonds twice as fast; +10% damage next to the tamer.' },
    vigilant:     { name: 'Vigilant',     icon: '👁️', desc: 'Counterattacks deal 20% more.' },
};
/** Traits a breeding mutation can roll. */
export const MUTATIONS = ['brave', 'keen', 'hardy', 'loyal', 'vigilant', 'swift', 'thickhide', 'sturdy', 'regrowth', 'nightstalker'];

// ------------------------------------------------------------------ commanders and their powers
// Kestrel's Wyrmsong grows with the story (level 1–3). Enemy commanders use their power when full.
export const POWERS = {
    wyrmsong: [
        { name: 'Ember Song',      desc: 'Your dragons deal 20% more and move +1 this turn.', atk: 0.2, mv: 1 },
        { name: 'Storm Song',      desc: 'Your dragons deal 25% more, move +1 and heal 20%.', atk: 0.25, mv: 1, heal: 0.2 },
        { name: 'Wyrmbond Anthem', desc: 'Your dragons deal 30% more, move +2, heal 30% and shrug off chains.', atk: 0.3, mv: 2, heal: 0.3, cleanse: true },
    ],
    grisk:      { name: 'Pack Howl',       desc: 'The Chain deals 20% more and moves +1.', atk: 0.2, mv: 1 },
    varek:      { name: 'Iron Discipline', desc: 'The Chain takes 30% less damage this turn and next.', guard: 0.3 },
    sablethorn: { name: 'Bog Hex',         desc: 'Your units lose 10% health and move −1 next turn.', hex: 0.1 },
    nyxara:     { name: 'Obsidian Eclipse', desc: 'The Chain deals 25% more and heals 20%.', atk: 0.25, heal: 0.2 },
};

export const COS = {
    kestrel:    { name: 'Kestrel',          portrait: 'kestrel',    power: 'wyrmsong' },
    grisk:      { name: 'Captain Grisk',    portrait: 'grisk',      power: 'grisk' },
    varek:      { name: 'General Varek',    portrait: 'varek',      power: 'varek' },
    sablethorn: { name: 'Mother Sablethorn', portrait: 'sablethorn', power: 'sablethorn' },
    nyxara:     { name: 'Empress Nyxara',   portrait: 'nyxara',     power: 'nyxara' },
};

/** Names for hatchlings. A keeper may rename them. */
export const DRAGON_NAMES = [
    'Ash', 'Bramble', 'Cinder', 'Dapple', 'Ember', 'Fable', 'Gale', 'Hearth', 'Ivy', 'Jasper', 'Kindle', 'Lumen',
    'Moss', 'Nimbus', 'Onyx', 'Pip', 'Quill', 'Rune', 'Sable', 'Thistle', 'Umber', 'Vesper', 'Wisp', 'Yarrow',
    'Zephyr', 'Bolt', 'Coral', 'Dusk', 'Flint', 'Glimmer', 'Hollow', 'Juniper', 'Kelp', 'Lark', 'Marrow', 'Nettle',
    'Opal', 'Pumice', 'Ripple', 'Sorrel', 'Tansy', 'Velvet', 'Willow', 'Brisk', 'Clover', 'Drizzle', 'Fennel',
    'Granite', 'Hazel', 'Inkcap', 'Marigold', 'Pepper', 'Saffron', 'Sprocket', 'Tumble', 'Whistle', 'Biscuit',
];

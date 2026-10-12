// ============================================================
// RUNEBORE — data and tunables.
// Pure data: imported by the simulation (Node-safe) and the view alike.
// ============================================================

export const VERSION = '1.0.1';
export const SAVE_KEY = 'runebore.v1';

// --- World grid ---
// Row 0 is the first row under the grass; world y of a tile's centre is -(row + 0.5).
export const W = 36;                 // columns
export const H = 400;                // rows
export const GATE_ROW = 368;         // the Rune Gate spans the whole width here
export const ARENA_TOP = 369;
export const ARENA_BOTTOM = 396;     // rows below are bedrock

// Tile kinds (world.tiles)
export const T = {
    EMPTY: 0,
    SOIL: 1,        // stratum rock; hardness from the stratum
    ORE: 2,         // aux = ore id
    GAS: 3,         // bogwind pocket: explodes when drilled
    LAVA: 4,        // molten: drillable, burns
    BOULDER: 5,     // loose: falls when undermined, can't be drilled
    RUNESTONE: 6,   // warded: only a blast rune breaks it
    RELIC: 7,       // aux = relic id
    ARTIFACT: 8,    // aux = artifact id
    BRICK: 9,       // dwarven masonry (ruins, vaults)
    GATE: 10,       // the Rune Gate
    SHARD: 11,      // a heart-shard of the Gloamwyrm
    CACHE: 12,      // dwarven coffer (crowns)
    BEDROCK: 13,    // unbreakable
    WAYSTONE: 14,   // aux = waystone id; solid plinth you stand on
    WRECK: 15,      // Corvin's wrecked rig (story)
    HEART: 16,      // the Wyrmheart, revealed after the fight
};

// --- Strata ---
export const STRATA = [
    { id: 0, name: 'The Rootloam',        top: 0,   hard: 1, ambient: 1.00, tint: [0.55, 0.38, 0.22], fog: [0.10, 0.07, 0.05],
      blurb: 'Dark soil laced with old roots and fairy-mushrooms. Copper and tin lie shallow here.' },
    { id: 1, name: 'The Greystone Halls', top: 40,  hard: 2, ambient: 0.55, tint: [0.48, 0.50, 0.56], fog: [0.05, 0.06, 0.08],
      blurb: 'Cold slate and the first worked stone: watch-halls the dwarves cut and abandoned. Iron and silver.' },
    { id: 2, name: 'The Glimmerdeep',     top: 90,  hard: 3, ambient: 0.35, tint: [0.36, 0.40, 0.62], fog: [0.04, 0.05, 0.10],
      blurb: 'Caverns of singing crystal where the fae once traded. Moonquartz glows in the dark.' },
    { id: 3, name: 'Sunken Kharadun',     top: 150, hard: 4, ambient: 0.24, tint: [0.62, 0.50, 0.32], fog: [0.07, 0.05, 0.03],
      blurb: 'The drowned dwarf-city. Sandstone, gold, sapphires and the bones of a kingdom.' },
    { id: 4, name: 'The Emberdeep',       top: 220, hard: 5, ambient: 0.20, tint: [0.50, 0.24, 0.18], fog: [0.10, 0.03, 0.02],
      blurb: 'Basalt and magma. The heat cooks a hull from the inside; Frostward runes help.' },
    { id: 5, name: 'The Gloam',           top: 290, hard: 6, ambient: 0.10, tint: [0.30, 0.22, 0.40], fog: [0.03, 0.02, 0.06],
      blurb: 'Rock gone black with shadow. Wisps of living dark drift through it, hungry for light.' },
    { id: 6, name: 'The Wyrmheart',       top: GATE_ROW, hard: 7, ambient: 0.18, tint: [0.40, 0.30, 0.55], fog: [0.04, 0.02, 0.07],
      blurb: 'The great chamber at the root of the world.' },
];
export const HEAT_DEPTH = 220;

// --- Ores --- value in crowns per piece
export const ORES = [
    { id: 0,  key: 'copper',     name: 'Copper',      value: 12,   glow: 0.0, min: 0,   peak: 14,  max: 95,  col: '#d07a3a', col2: '#f2a86a' },
    { id: 1,  key: 'tin',        name: 'Tin',         value: 20,   glow: 0.0, min: 4,   peak: 34,  max: 115, col: '#b9bcc0', col2: '#e8ecef' },
    { id: 2,  key: 'iron',       name: 'Iron',        value: 34,   glow: 0.0, min: 22,  peak: 60,  max: 155, col: '#8a5a48', col2: '#c48f74' },
    { id: 3,  key: 'amber',      name: 'Amberglass',  value: 55,   glow: 0.5, min: 14,  peak: 72,  max: 135, col: '#f0a020', col2: '#ffe08a' },
    { id: 4,  key: 'silver',     name: 'Silver',      value: 85,   glow: 0.1, min: 52,  peak: 105, max: 195, col: '#c8d4e0', col2: '#ffffff' },
    { id: 5,  key: 'moonquartz', name: 'Moonquartz',  value: 130,  glow: 0.9, min: 84,  peak: 135, max: 225, col: '#9fd8ff', col2: '#eaffff' },
    { id: 6,  key: 'gold',       name: 'Gold',        value: 210,  glow: 0.2, min: 128, peak: 178, max: 275, col: '#f2c230', col2: '#fff3a0' },
    { id: 7,  key: 'sapphire',   name: 'Sapphire',    value: 320,  glow: 0.4, min: 148, peak: 212, max: 305, col: '#2860e8', col2: '#9ac0ff' },
    { id: 8,  key: 'mithril',    name: 'Mithril',     value: 480,  glow: 0.6, min: 168, peak: 242, max: 335, col: '#b8f0e8', col2: '#ffffff' },
    { id: 9,  key: 'emberstone', name: 'Emberstone',  value: 700,  glow: 1.0, min: 214, peak: 266, max: 352, col: '#ff3a20', col2: '#ffb070' },
    { id: 10, key: 'dragonglass',name: 'Dragonglass', value: 950,  glow: 0.3, min: 232, peak: 300, max: 366, col: '#204030', col2: '#70ffb0' },
    { id: 11, key: 'starmetal',  name: 'Starmetal',   value: 1400, glow: 1.0, min: 284, peak: 330, max: 367, col: '#c0b0ff', col2: '#ffffff' },
    { id: 12, key: 'voidpearl',  name: 'Voidpearl',   value: 2200, glow: 0.8, min: 300, peak: 356, max: 367, col: '#6a2a90', col2: '#f0c0ff' },
];

// --- Relics: the magical treasures that upgrade Thimble's heartcore ---
export const RELICS = [
    { id: 0, key: 'lens',    name: 'The Lumen Lens',        depth: 30,  icon: '◉', col: '#7fe0ff',
      power: 'Ore-sight: ores, relics and pockets of bogwind glimmer through the rock nearby.' },
    { id: 1, key: 'feather', name: 'The Featherfall Sigil', depth: 76,  icon: '❦', col: '#e8f4ff',
      power: 'Falls no longer harm Thimble, and the vanes lift a little stronger.' },
    { id: 2, key: 'gear',    name: 'The Dwarven Heartgear', depth: 126, icon: '✲', col: '#ffc860',
      power: 'The auger turns forty percent faster.' },
    { id: 3, key: 'satchel', name: 'The Hollowing Satchel', depth: 186, icon: '❖', col: '#c890ff',
      power: 'The cargo hold carries half again as much.' },
    { id: 4, key: 'scale',   name: 'The Salamander Scale',  depth: 252, icon: '♨', col: '#ff7040',
      power: 'Heat cannot touch Thimble, and magma burns only half as badly.' },
    { id: 5, key: 'heart',   name: 'The Heart of Kharadun', depth: 316, icon: '♥', col: '#ff90c0',
      power: 'The hull slowly mends itself and aether burns a quarter slower. Wisps fear the light.' },
    { id: 6, key: 'lance',   name: 'The Starforged Lance',  depth: 356, icon: '✦', col: '#fff0a0',
      power: 'An auger of star-iron. It can open the Rune Gate and break a wyrm\'s heart-shards.' },
];

// --- Artifacts: one-off finds worth crowns, each adds to the Codex ---
export const ARTIFACTS = [
    { id: 0,  name: "A Gnome's Clay Pipe",         value: 60,   depth: [8, 36],    lore: 'pipe' },
    { id: 1,  name: "Maren's Journal, Page I",      value: 0,    depth: [18, 34],   lore: 'page1' },
    { id: 2,  name: "The Hall-Warden's Signet",     value: 280,  depth: [45, 85],   lore: 'signet' },
    { id: 3,  name: "Maren's Journal, Page II",     value: 0,    depth: [60, 88],   lore: 'page2' },
    { id: 4,  name: 'A Fae Music Box',              value: 420,  depth: [95, 145],  lore: 'musicbox' },
    { id: 5,  name: "Maren's Journal, Page III",    value: 0,    depth: [110, 146], lore: 'page3' },
    { id: 6,  name: 'The Crown of King Durrak',     value: 1600, depth: [160, 215], lore: 'crown' },
    { id: 7,  name: 'A Kharadun Ledger-Tablet',     value: 600,  depth: [152, 210], lore: 'ledger' },
    { id: 8,  name: "Maren's Journal, Page IV",     value: 0,    depth: [190, 214], lore: 'page4' },
    { id: 9,  name: 'A Cold Salamander Egg',        value: 900,  depth: [225, 285], lore: 'egg' },
    { id: 10, name: "Maren's Journal, Page V",      value: 0,    depth: [258, 286], lore: 'page5' },
    { id: 11, name: 'A Wyrmling Skull',             value: 1300, depth: [295, 350], lore: 'skull' },
    { id: 12, name: "Maren's Journal, Page VI",     value: 0,    depth: [322, 360], lore: 'page6' },
];

// --- Waystones: ancient dwarven aether-wells, found deep and linked to the Spire ---
export const WAYSTONES = [
    { id: 0, name: 'The Kharadun Waystone', depth: 200 },
    { id: 1, name: 'The Gloam Waystone',    depth: 338 },
];

// --- Upgrades: the Forge ---
export const UPGRADES = {
    drill: {
        label: 'Auger', stat: 'Drills rock up to hardness',
        tiers: [
            { name: 'Bronze Auger',      power: 1, speed: 1.00, price: 0 },
            { name: 'Iron Bit',          power: 2, speed: 1.25, price: 720 },
            { name: 'Steel Spiral',      power: 3, speed: 1.55, price: 3050 },
            { name: 'Moonsilver Bore',   power: 4, speed: 1.90, price: 9900 },
            { name: 'Mithril Spiral',    power: 5, speed: 2.30, price: 24000 },
            { name: 'Runeforged Auger',  power: 6, speed: 2.80, price: 49600 },
            { name: 'Dragonfang Bore',   power: 6, speed: 3.40, price: 92800 },
        ],
    },
    hull: {
        label: 'Hull', stat: 'Integrity',
        tiers: [
            { name: 'Oak & Rivets',     value: 30,  price: 0 },
            { name: 'Iron Plating',     value: 50,  price: 610 },
            { name: 'Dwarfsteel',       value: 80,  price: 2550 },
            { name: 'Mithril Mail',     value: 120, price: 8300 },
            { name: 'Dragonscale',      value: 170, price: 20800 },
            { name: 'Runeward Aegis',   value: 240, price: 44800 },
            { name: 'Wyrmbone Bulwark', value: 330, price: 83200 },
        ],
    },
    tank: {
        label: 'Aether Tank', stat: 'Aether',
        tiers: [
            { name: 'Copper Flask',      value: 12,  price: 0 },
            { name: 'Brass Cask',        value: 18,  price: 510 },
            { name: 'Iron Reservoir',    value: 28,  price: 2100 },
            { name: 'Glimmer Vessel',    value: 42,  price: 6900 },
            { name: 'Dwarven Cistern',   value: 60,  price: 17600 },
            { name: 'Starglass Heart',   value: 85,  price: 38400 },
            { name: 'Wellspring Core',   value: 120, price: 72000 },
        ],
    },
    vanes: {
        label: 'Vanes', stat: 'Lift',
        tiers: [
            { name: 'Canvas Vanes',      value: 1.00, price: 0 },
            { name: 'Lacquered Vanes',   value: 1.18, price: 640 },
            { name: 'Griffin-Quill',     value: 1.38, price: 2700 },
            { name: 'Windrune Vanes',    value: 1.60, price: 8950 },
            { name: 'Stormglass Vanes',  value: 1.85, price: 22400 },
            { name: 'Skyforged Vanes',   value: 2.15, price: 48000 },
        ],
    },
    cargo: {
        label: 'Cargo Hold', stat: 'Pieces',
        tiers: [
            { name: 'Wicker Panniers',   value: 8,  price: 0 },
            { name: 'Oaken Hold',        value: 12, price: 480 },
            { name: 'Iron-bound Hold',   value: 18, price: 2150 },
            { name: 'Dwarven Strongbox', value: 26, price: 7350 },
            { name: 'Deepdelver Hold',   value: 36, price: 19200 },
            { name: 'Pocket of Plenty',  value: 50, price: 41600 },
            { name: 'Dragon\'s Hoard',   value: 70, price: 76800 },
        ],
    },
    lantern: {
        label: 'Lantern', stat: 'Light radius',
        tiers: [
            { name: 'Tallow Lantern',    value: 3.4, price: 0 },
            { name: 'Oil Lamp',          value: 4.6, price: 420 },
            { name: 'Glowmoss Globe',    value: 6.0, price: 1850 },
            { name: 'Moonquartz Lamp',   value: 7.4, price: 6250 },
            { name: 'Sunstone Beacon',   value: 9.0, price: 16000 },
            { name: 'Phoenix Lantern',   value: 10.8, price: 35200 },
        ],
    },
    ward: {
        label: 'Frostward', stat: 'Heat shielding',
        tiers: [
            { name: 'No ward',           value: 0.00, price: 0 },
            { name: 'Chalked Runes',     value: 0.30, price: 1440 },
            { name: 'Frost Sigils',      value: 0.50, price: 5100 },
            { name: 'Rimeglass Plates',  value: 0.70, price: 14400 },
            { name: 'Winterheart Ward',  value: 0.85, price: 32000 },
            { name: 'Everfrost Aegis',   value: 0.95, price: 64000 },
        ],
    },
};
export const UPGRADE_ORDER = ['drill', 'hull', 'tank', 'vanes', 'cargo', 'lantern', 'ward'];

// --- Consumables: Runes & Remedies ---
export const ITEMS = [
    { key: 'blast',  name: 'Blast Rune',       price: 180, max: 9, key1: '1', icon: '✸', desc: 'Shatters the rock around Thimble (3×3), runestone and boulders too.' },
    { key: 'great',  name: 'Great Blast Rune', price: 480, max: 5, key1: '2', icon: '✺', desc: 'A bigger blast (5×5). Mind the ceiling.' },
    { key: 'recall', name: 'Recall Scroll',    price: 650, max: 5, key1: '3', icon: '⇮', desc: 'Whisks Thimble, and the cargo, back to the surface.' },
    { key: 'mend',   name: 'Mending Draught',  price: 420, max: 5, key1: '4', icon: '✚', desc: 'Restores 40% of the hull.' },
    { key: 'flask',  name: 'Aether Flask',     price: 300, max: 5, key1: '5', icon: '⚗', desc: 'Pours 40% of a tank of aether into Thimble.' },
];

// --- Economy ---
export const FUEL_PRICE = 2;        // crowns per unit of aether
export const REPAIR_PRICE = 2.5;    // crowns per point of hull
export const RESCUE_FEE = 0.15;     // fraction of crowns taken when the Guild hauls you up
export const WAYSTONE_MARKUP = 1.5; // deep services cost more

// --- Rig physics (tiles, seconds) ---
export const RIG = {
    halfW: 0.40,
    halfH: 0.38,
    gravity: 17,
    thrust: 31,           // × vanes
    maxUp: 6.2,           // × sqrt(vanes)
    maxFall: 15,
    accel: 26,
    maxRun: 4.6,          // × (0.75 + 0.25·vanes)
    friction: 14,
    airDrag: 3.2,
    fallSafe: 8.6,        // impact speed with no damage
    fallDmg: 2.6,         // per unit above
    drillBase: 0.28,
    drillPerHard: 0.42,
    burnIdle: 0.045,
    burnMove: 0.07,
    burnThrust: 0.33,
    burnDrill: 0.24,
};

// --- Buildings on the surface (x range in tiles) ---
export const BUILDINGS = [
    { key: 'well',    name: 'The Aether Well',     x0: 1,  x1: 5,  who: 'well' },
    { key: 'assay',   name: "Sedge's Assay House", x0: 6,  x1: 10, who: 'sedge' },
    { key: 'forge',   name: "Fennick's Forge",     x0: 11, x1: 15, who: 'pell' },
    { key: 'spire',   name: 'The Lumen Spire',     x0: 16, x1: 20, who: 'ansel' },
    { key: 'guild',   name: 'The Delvers\' Guild', x0: 21, x1: 26, who: 'orla' },
    { key: 'runes',   name: 'Runes & Remedies',    x0: 27, x1: 31, who: 'mirabel' },
];
export const START_X = 18.5;

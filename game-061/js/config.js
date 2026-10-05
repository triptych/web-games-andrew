// STARWRIGHT — every tunable table lives here. Pure data (imported by sim, view and ui).

export const VERSION = '1.0.0';
export const SAVE_KEY = 'starwright.v1';
export const SIM_DT = 1 / 60;

// ------------------------------------------------------------------ items
// cat: raw | refined | goods. price = galactic base price (credits per unit).
export const ITEMS = {
    ferrite:   { name: 'Ferrite',       cat: 'raw', tier: 1, price: 8,   color: '#d0866a', desc: 'Iron-nickel ore. The backbone of everything.' },
    silicate:  { name: 'Silicate',      cat: 'raw', tier: 1, price: 7,   color: '#d8c7a4', desc: 'Rocky silicates, refined into wafers and glass.' },
    ice:       { name: 'Water Ice',     cat: 'raw', tier: 1, price: 9,   color: '#9fe6ff', desc: 'Frozen water. Coolant, fuel, life.' },
    carbon:    { name: 'Carbon',        cat: 'raw', tier: 1, price: 8,   color: '#9a9aae', desc: 'Carbonaceous dust and tar for polymers.' },
    titanium:  { name: 'Titanium',      cat: 'raw', tier: 2, price: 22,  color: '#e2ecf6', desc: 'Light, strong, stubborn. Needs a Mk II laser.' },
    cuprite:   { name: 'Cuprite',       cat: 'raw', tier: 2, price: 20,  color: '#f09455', desc: 'Copper ore for circuitry.' },
    helium3:   { name: 'Helium-3',      cat: 'raw', tier: 2, price: 26,  color: '#ffe98a', desc: 'Fusion fuel skimmed from gas giants.' },
    iridium:   { name: 'Iridium',       cat: 'raw', tier: 3, price: 48,  color: '#c3cbff', desc: 'Dense crystal-bound metal from rich belts.' },
    voidstone: { name: 'Voidstone',     cat: 'raw', tier: 4, price: 110, color: '#b876ff', desc: 'Black crystal that hums. Found only in dangerous space.' },
    exotic:    { name: 'Exotic Matter', cat: 'raw', tier: 4, price: 160, color: '#ff72da', desc: 'Matter with negative opinions about physics.' },

    steel:     { name: 'Steel Plate',   cat: 'refined', tier: 1, price: 32,  color: '#b9c2cc', desc: 'Rolled ferrite plate.' },
    silicon:   { name: 'Silicon Wafer', cat: 'refined', tier: 1, price: 28,  color: '#8fb3d9', desc: 'Pure silicon wafers.' },
    coolant:   { name: 'Coolant',       cat: 'refined', tier: 1, price: 24,  color: '#6fdcff', desc: 'Purified water-glycol coolant.' },
    polymer:   { name: 'Polymer',       cat: 'refined', tier: 1, price: 34,  color: '#9de38f', desc: 'Flexible structural polymer.' },
    fuelcell:  { name: 'Warp Cell',     cat: 'refined', tier: 1, price: 40,  color: '#7af7ff', desc: 'Fuel for the warp drive. One cell per 4 ly.' },
    alloy:     { name: 'Ti-Alloy',      cat: 'refined', tier: 2, price: 75,  color: '#e8f2ff', desc: 'Titanium-steel alloy for hulls.' },
    circuit:   { name: 'Circuitry',     cat: 'refined', tier: 2, price: 55,  color: '#ffb36b', desc: 'Copper-on-silicon logic boards.' },
    lattice:   { name: 'Iridium Lattice', cat: 'refined', tier: 3, price: 190, color: '#a9b4ff', desc: 'Load-bearing crystal lattice.' },
    voidcore:  { name: 'Void Core',     cat: 'refined', tier: 4, price: 520, color: '#d58bff', desc: 'A caged knot of Voidstone and exotic matter.' },

    rations:     { name: 'Food Rations', cat: 'goods', price: 14,  color: '#e8d27a', desc: 'Calories in a tin.' },
    medkits:     { name: 'Med Kits',     cat: 'goods', price: 40,  color: '#ff8a8a', desc: 'Broad-spectrum xenomedicine.' },
    machinery:   { name: 'Machinery',    cat: 'goods', price: 55,  color: '#c4c9b0', desc: 'Pumps, drills, fabricators.' },
    electronics: { name: 'Electronics',  cat: 'goods', price: 70,  color: '#7ad7ff', desc: 'Consumer and industrial electronics.' },
    silks:       { name: 'Starsilk',     cat: 'goods', price: 90,  color: '#ffc2f0', desc: 'Woven from the threads of void spiders.' },
    spices:      { name: 'Spice',        cat: 'goods', price: 60,  color: '#ff9f4a', desc: 'Pungent, prized and slightly psychoactive.' },
    art:         { name: 'Xeno Art',     cat: 'goods', price: 150, color: '#ff7ad1', desc: 'Sculpture, song-stones and stranger things.' },
    wine:        { name: 'Nebula Wine',  cat: 'goods', price: 80,  color: '#c06bff', desc: 'Aged in zero-g. Sparkles faintly.' },
    arms:        { name: 'Arms',         cat: 'goods', price: 110, color: '#ff6b6b', desc: 'Personal weapons. Contraband in some space.' },
    biogel:      { name: 'Bio-Gel',      cat: 'goods', price: 45,  color: '#7affb2', desc: 'Living tissue scaffold.' },
    datacores:   { name: 'Data Cores',   cat: 'goods', price: 120, color: '#74a8ff', desc: 'Archived knowledge in crystal.' },
    gems:        { name: 'Gemstones',    cat: 'goods', price: 130, color: '#7affea', desc: 'Cut stones from a hundred worlds.' },
    relics:      { name: 'Antiquities',  cat: 'goods', price: 220, color: '#ffd27a', desc: 'Artifacts of fallen civilisations.' },
    stims:       { name: 'Stims',        cat: 'goods', price: 95,  color: '#b3ff4a', desc: 'Stimulants. Contraband in some space.' },
};
export const RAW = Object.keys(ITEMS).filter((k) => ITEMS[k].cat === 'raw');
export const REFINED = Object.keys(ITEMS).filter((k) => ITEMS[k].cat === 'refined');
export const GOODS = Object.keys(ITEMS).filter((k) => ITEMS[k].cat === 'goods');
export const ALL_ITEMS = Object.keys(ITEMS);

// Refinery recipes (base module "refinery"). minLevel = refinery level required.
export const RECIPES = [
    { id: 'steel',    in: { ferrite: 3 },                  out: { steel: 1 },    minLevel: 1 },
    { id: 'silicon',  in: { silicate: 3 },                 out: { silicon: 1 },  minLevel: 1 },
    { id: 'coolant',  in: { ice: 2 },                      out: { coolant: 1 },  minLevel: 1 },
    { id: 'polymer',  in: { carbon: 2, ice: 1 },           out: { polymer: 1 },  minLevel: 1 },
    { id: 'cell_ice', in: { ice: 4, carbon: 1 },           out: { fuelcell: 1 }, minLevel: 1 },
    { id: 'alloy',    in: { titanium: 2, steel: 1 },       out: { alloy: 1 },    minLevel: 2 },
    { id: 'circuit',  in: { cuprite: 1, silicon: 1 },      out: { circuit: 1 },  minLevel: 2 },
    { id: 'cell_he3', in: { helium3: 2 },                  out: { fuelcell: 2 }, minLevel: 2 },
    { id: 'lattice',  in: { iridium: 2, alloy: 1 },        out: { lattice: 1 },  minLevel: 3 },
    { id: 'voidcore', in: { voidstone: 2, exotic: 1, circuit: 1 }, out: { voidcore: 1 }, minLevel: 4 },
];

// Fabricator recipes (instant).
export const FAB = [
    { id: 'fuelcell', name: 'Warp Cell ×2', in: { coolant: 2, carbon: 2 }, out: { fuelcell: 2 }, desc: 'Brew warp fuel from coolant and carbon.' },
    { id: 'nanites', name: 'Hull Repair', in: { steel: 2, polymer: 1 }, special: 'repair', desc: 'Fully repairs your hull.' },
    { id: 'goods_machinery', name: 'Machinery ×2', in: { steel: 4, circuit: 1 }, out: { machinery: 2 }, desc: 'Assemble machinery for trade.' },
    { id: 'goods_electronics', name: 'Electronics ×2', in: { circuit: 2, polymer: 1 }, out: { electronics: 2 }, desc: 'Assemble electronics for trade.' },
    { id: 'goods_medkits', name: 'Med Kits ×3', in: { polymer: 2, coolant: 2 }, out: { medkits: 3 }, desc: 'Sterile kits for trade.' },
    { id: 'drone', name: 'Mining Drone', in: { steel: 6, circuit: 2 }, special: 'drone', desc: '+1 drone for the Drone Bay (max 3 per level).' },
    { id: 'key', name: 'Lattice Key', in: { voidcore: 3, lattice: 4 }, special: 'key', story: true, desc: 'Fuse the three Precursor Shards into a key.' },
];

// ------------------------------------------------------------------ ship
export const HULLS = [
    null,
    { name: 'Skiff',      hull: 100, cargo: 40,  scale: 1.0, cost: null },
    { name: 'Prospector', hull: 180, cargo: 70,  scale: 1.25, cost: { credits: 1500, steel: 35, polymer: 12, silicon: 12 } },
    { name: 'Corsair',    hull: 300, cargo: 110, scale: 1.5, cost: { credits: 4500, alloy: 25, circuit: 15, polymer: 25 } },
    { name: 'Voyager',    hull: 460, cargo: 160, scale: 1.8, cost: { credits: 7000, alloy: 40, lattice: 6, circuit: 25 } },
    { name: 'Leviathan',  hull: 700, cargo: 240, scale: 2.2, cost: { credits: 30000, lattice: 14, voidcore: 4, alloy: 60 } },
];

// Each component: per-Mk stats (index = Mk; Mk 0 only meaningful for warp/scoop).
export const COMPONENTS = {
    engine:    { name: 'Engine',       w: 1.0, min: 1, stats: [null, { speed: 50, accel: 30 }, { speed: 70, accel: 40 }, { speed: 92, accel: 52 }, { speed: 115, accel: 64 }, { speed: 140, accel: 80 }], desc: 'Top speed and acceleration.' },
    thrusters: { name: 'Thrusters',    w: 0.8, min: 1, stats: [null, { turn: 1.25 }, { turn: 1.55 }, { turn: 1.85 }, { turn: 2.2 }, { turn: 2.6 }], desc: 'Turn rate.' },
    shield:    { name: 'Shield',       w: 1.0, min: 1, stats: [null, { shield: 40, regen: 4 }, { shield: 80, regen: 6 }, { shield: 140, regen: 9 }, { shield: 220, regen: 13 }, { shield: 320, regen: 18 }], desc: 'Shield capacity and regeneration.' },
    armor:     { name: 'Armor',        w: 0.9, min: 1, stats: [null, { hullMul: 1 }, { hullMul: 1.25 }, { hullMul: 1.5 }, { hullMul: 1.75 }, { hullMul: 2 }], desc: 'Hull strength multiplier.' },
    cargo:     { name: 'Cargo Hold',   w: 0.9, min: 1, stats: [null, { cargo: 0 }, { cargo: 40 }, { cargo: 100 }, { cargo: 180 }, { cargo: 300 }], desc: 'Extra cargo capacity.' },
    mining:    { name: 'Mining Laser', w: 1.0, min: 1, stats: [null, { rate: 2.2, hard: 1, range: 160 }, { rate: 3.6, hard: 2, range: 185 }, { rate: 5.6, hard: 3, range: 210 }, { rate: 8.2, hard: 4, range: 235 }, { rate: 12, hard: 5, range: 260 }], desc: 'Yield rate, rock hardness and range.' },
    weapon:    { name: 'Weapons',      w: 1.1, min: 1, stats: [null, { dmg: 6, rate: 4, twin: false }, { dmg: 9, rate: 4.5, twin: false }, { dmg: 9, rate: 5, twin: true }, { dmg: 14, rate: 5.5, twin: true }, { dmg: 26, rate: 6.5, twin: true, plasma: true }], desc: 'Bolt damage and fire rate.' },
    scanner:   { name: 'Scanner',      w: 0.8, min: 1, stats: [null, { range: 2500, speed: 1 }, { range: 4000, speed: 1.4 }, { range: 5500, speed: 1.8 }, { range: 7200, speed: 2.3 }, { range: 9000, speed: 3 }], desc: 'Detection range and scan speed. Mk II shows rock composition, Mk III finds hidden anomalies.' },
    warp:      { name: 'Warp Drive',   w: 1.4, min: 0, stats: [{ range: 0 }, { range: 7 }, { range: 11 }, { range: 16 }, { range: 22 }, { range: 30 }], desc: 'Jump range in light-years.' },
    tank:      { name: 'Fuel Tank',    w: 0.7, min: 1, stats: [null, { fuel: 4 }, { fuel: 6 }, { fuel: 9 }, { fuel: 12 }, { fuel: 16 }], desc: 'Warp Cell capacity.' },
    scoop:     { name: 'Scoop',        w: 0.8, min: 0, max: 2, stats: [{}, { fuel: true }, { fuel: true, gas: true }], desc: 'Mk I scoops fuel from stars. Mk II also skims Helium-3 from gas giants.' },
};
export const COMP_ORDER = ['engine', 'thrusters', 'shield', 'armor', 'cargo', 'mining', 'weapon', 'scanner', 'warp', 'tank', 'scoop'];

// Material ladder for component Mk n (n = 1 only used by warp/scoop which start at 0).
const COMP_MATS = [
    null,
    { credits: 900, steel: 16, silicon: 8, coolant: 8 },
    { credits: 350, steel: 12, silicon: 8 },
    { credits: 1300, alloy: 8, circuit: 6, polymer: 8 },
    { credits: 4000, alloy: 16, circuit: 12, lattice: 3 },
    { credits: 10000, lattice: 8, voidcore: 2, circuit: 16 },
];
export function componentCost(id, mk) {
    const c = COMPONENTS[id];
    const base = COMP_MATS[mk];
    const out = {};
    for (const [k, v] of Object.entries(base)) out[k] = Math.round(v * (k === 'credits' ? c.w : Math.max(0.6, c.w)));
    if (id === 'warp' && mk === 1) { out.credits = 1200; out.steel = 20; out.silicon = 12; out.coolant = 10; }
    if (id === 'scoop' && mk === 1) { out.credits = 700; out.steel = 8; out.coolant = 6; delete out.silicon; }
    if (id === 'scoop' && mk === 2) { out.credits = 2400; out.alloy = 5; out.polymer = 10; out.circuit = 3; }
    return out;
}
// Alien shipyards sell components for credits only, at a mark-up.
export const ALIEN_SHIPYARD_MARKUP = 2.6;

export const PAINTS = [
    { name: 'Guild Ivory',   a: '#e9e4d8', b: '#2b3a55', c: '#ffb547' },
    { name: 'Nebula Teal',   a: '#2fb7c4', b: '#1c2433', c: '#ffe36b' },
    { name: 'Ember Red',     a: '#c8402f', b: '#2a2a2e', c: '#ffd36b' },
    { name: 'Solar Gold',    a: '#e3b23c', b: '#3a2e1c', c: '#5ef0ff' },
    { name: 'Void Violet',   a: '#6a4ad8', b: '#15122a', c: '#6bffb0' },
    { name: 'Frost White',   a: '#f2f6ff', b: '#5d7ea6', c: '#ff5470' },
    { name: 'Moss Green',    a: '#5f8f4a', b: '#22301d', c: '#ff9f4a' },
    { name: 'Midnight',      a: '#2a3050', b: '#0c0f1c', c: '#ff5ec4' },
];

// ------------------------------------------------------------------ Hearth (base)
// cost(level) gives the cost to reach `level` (1 = build).
export const BASE_START_STORAGE = 300;
export const MODULES = {
    core:      { name: 'Command Core', icon: '◈', max: 8, power: 6, unique: true, desc: 'Sets module slots (5, +2 per level), module level cap and base power.' },
    solar:     { name: 'Solar Array',  icon: '☀', max: 5, power: 8, core: 1, desc: '+8 power per level.' },
    silo:      { name: 'Storage Silo', icon: '▣', max: 5, use: 1, core: 1, desc: '+250 storage per level.' },
    refinery:  { name: 'Refinery',     icon: '⚗', max: 5, use: 3, core: 1, unique: true, desc: 'Refines raw resources from storage: every enabled recipe runs a batch each cycle (6 s, faster per level).' },
    fabricator:{ name: 'Fabricator',   icon: '⚙', max: 3, use: 2, core: 1, unique: true, desc: 'Crafts warp cells, repairs, trade goods, drones and the Lattice Key.' },
    shipyard:  { name: 'Shipyard',     icon: '⚓', max: 5, use: 3, core: 1, unique: true, desc: 'Ship upgrades up to Mk = level, and new hulls.' },
    lab:       { name: 'Research Lab', icon: '⚛', max: 5, use: 2, core: 1, unique: true, desc: 'Converts Data into research. Higher levels convert more efficiently.' },
    hydro:     { name: 'Hydroponics',  icon: '❦', max: 5, use: 2, core: 1, desc: 'Grows Food Rations (and Bio-Gel at Lv 3+).' },
    drones:    { name: 'Drone Bay',    icon: '✦', max: 5, use: 2, core: 2, unique: true, desc: 'Mining drones harvest the home belt while you are away.' },
    depot:     { name: 'Trade Depot',  icon: '⇄', max: 3, use: 1, core: 2, unique: true, desc: 'Auto-sells marked surplus at 75% of base price.' },
    defense:   { name: 'Defense Grid', icon: '⛨', max: 5, use: 2, core: 3, desc: 'Turrets. Protects Hearth from raids.' },
    embassy:   { name: 'Embassy',      icon: '✧', max: 3, use: 2, core: 3, unique: true, desc: '+50% standing gains per level, better prices.' },
    beacon:    { name: 'Warp Beacon',  icon: '⌖', max: 1, use: 4, core: 5, unique: true, desc: 'Recall: warp home from anywhere for 2 cells.' },
};
export const MODULE_ORDER = ['solar', 'silo', 'refinery', 'fabricator', 'shipyard', 'lab', 'hydro', 'drones', 'depot', 'defense', 'embassy', 'beacon'];

const MOD_BASE = { solar: 1, silo: 0.8, refinery: 1.2, fabricator: 1.1, shipyard: 1.3, lab: 1.2, hydro: 0.9, drones: 1.4, depot: 1.1, defense: 1.2, embassy: 1.3, beacon: 3 };
export function moduleCost(id, level) {
    if (id === 'core') return CORE_COSTS[level] || null;
    const w = MOD_BASE[id] || 1;
    const L = [null,
        { credits: 300, steel: 10, silicon: 6 },
        { credits: 600, steel: 20, silicon: 12, polymer: 4 },
        { credits: 1600, alloy: 12, polymer: 14, circuit: 6 },
        { credits: 4500, alloy: 20, circuit: 14, lattice: 3 },
        { credits: 11000, lattice: 8, voidcore: 2, circuit: 20 },
    ][level];
    if (!L) return null;
    const out = {};
    for (const [k, v] of Object.entries(L)) out[k] = Math.max(1, Math.round(v * w));
    if (id === 'refinery' && level === 1) { delete out.steel; delete out.silicon; out.credits = 250; out.ferrite = 25; out.silicate = 15; }
    if (id === 'lab' && level === 1) { delete out.steel; delete out.silicon; out.credits = 400; out.ferrite = 20; out.silicate = 25; out.ice = 10; }
    if (id === 'beacon') { out.credits = 20000; out.lattice = 6; out.voidcore = 1; out.circuit = 20; }
    return out;
}
const CORE_COSTS = [null, null,
    { credits: 700, steel: 25, silicon: 15, coolant: 8 },
    { credits: 1600, steel: 30, silicon: 20, polymer: 10 },
    { credits: 3500, alloy: 15, polymer: 20, circuit: 8 },
    { credits: 6000, alloy: 30, circuit: 20, lattice: 2 },
    { credits: 15000, lattice: 6, circuit: 30, alloy: 30 },
    { credits: 30000, lattice: 12, voidcore: 2, circuit: 30 },
    { credits: 50000, voidcore: 5, lattice: 16, alloy: 60 },
];
export const moduleCap = (coreLevel) => [0, 1, 2, 2, 3, 4, 5, 5, 5][coreLevel] ?? 5;
export const moduleSlots = (coreLevel) => 5 + 2 * (coreLevel - 1);

// ------------------------------------------------------------------ research
export const TECHS = [
    { id: 'warp',      name: 'Warp Theory',          rp: 20,  desc: 'Unlocks the Warp Drive Mk I.' },
    { id: 'refining',  name: 'Efficient Refining',   rp: 30,  desc: 'Refinery output +30%.' },
    { id: 'cartog',    name: 'Cartography',          rp: 35,  desc: 'Survey data sells for +50%.' },
    { id: 'deepcore',  name: 'Deep Core Mining',     rp: 40,  desc: 'Mining yield +20%.' },
    { id: 'ion',       name: 'Ion Thrusters',        rp: 40,  desc: '+10% speed and turn rate.' },
    { id: 'xeno',      name: 'Xenolinguistics',      rp: 45,  desc: '+10% sell prices with aliens, faster standing.' },
    { id: 'harmonics', name: 'Shield Harmonics',     rp: 60,  desc: 'Shields +25% and regenerate faster.' },
    { id: 'swarm',     name: 'Drone Swarm',          rp: 60,  desc: 'Drone output ×2.' },
    { id: 'advfab',    name: 'Advanced Fabrication', rp: 90,  req: 'refining', desc: 'Unlocks Mk IV components.' },
    { id: 'folding',   name: 'Subspace Folding',     rp: 120, req: 'warp', desc: 'Warp jumps cost 25% fewer cells.' },
    { id: 'exotic',    name: 'Exotic Physics',       rp: 180, req: 'advfab', desc: 'Unlocks Mk V components and the Lattice Key.' },
];

// ------------------------------------------------------------------ worlds
export const STAR_CLASSES = {
    M: { color: '#ff7a52', radius: 320, lum: 0.5, weight: 30, name: 'Red dwarf' },
    K: { color: '#ffb36b', radius: 420, lum: 0.75, weight: 22, name: 'Orange dwarf' },
    G: { color: '#fff1c4', radius: 520, lum: 1.0, weight: 18, name: 'Yellow dwarf' },
    F: { color: '#fbf8ff', radius: 600, lum: 1.25, weight: 11, name: 'White star' },
    A: { color: '#d8e6ff', radius: 700, lum: 1.55, weight: 7, name: 'Blue-white star' },
    B: { color: '#9fc0ff', radius: 820, lum: 2.0, weight: 4, name: 'Blue giant' },
    O: { color: '#7d9dff', radius: 900, lum: 2.6, weight: 1.5, name: 'Blue supergiant' },
    D: { color: '#e9f4ff', radius: 180, lum: 0.35, weight: 3, name: 'White dwarf' },
};

export const PLANET_TYPES = {
    lava:    { name: 'Volcanic',   scan: 1.1, inner: true },
    desert:  { name: 'Desert',     scan: 1.0, inner: true },
    rocky:   { name: 'Barren',     scan: 0.8, inner: true },
    terran:  { name: 'Terran',     scan: 1.8, inner: true, life: true },
    ocean:   { name: 'Ocean',      scan: 1.5, inner: true, life: true },
    toxic:   { name: 'Toxic',      scan: 1.2, inner: true },
    ice:     { name: 'Frozen',     scan: 0.9 },
    gas:     { name: 'Gas Giant',  scan: 1.3, giant: true },
    icegiant:{ name: 'Ice Giant',  scan: 1.3, giant: true },
};

// Asteroid compositions: weights per resource; hard = laser Mk required.
export const ROCK_TYPES = {
    stony:    { name: 'Stony',        hard: 1, mix: { silicate: 0.6, ferrite: 0.4 },                      color: '#8c7b6b' },
    metallic: { name: 'Metallic',     hard: 1, mix: { ferrite: 0.7, silicate: 0.3 },                      color: '#8a8f99' },
    titanic:  { name: 'Titanic',      hard: 2, mix: { titanium: 0.6, ferrite: 0.25, cuprite: 0.15 },     color: '#aeb8c6' },
    cupric:   { name: 'Cupric',       hard: 2, mix: { cuprite: 0.55, titanium: 0.25, ferrite: 0.2 },       color: '#9a6a4e' },
    icy:      { name: 'Icy',          hard: 1, mix: { ice: 0.75, carbon: 0.25 },                          color: '#b8dcef' },
    carbon:   { name: 'Carbonaceous', hard: 1, mix: { carbon: 0.65, silicate: 0.2, ice: 0.15 },           color: '#3e3a40' },
    iridium:  { name: 'Crystalline',  hard: 3, mix: { iridium: 0.7, titanium: 0.2, silicate: 0.1 },    color: '#7c86c8', glow: '#9fb0ff' },
    void:     { name: 'Void Crystal', hard: 4, mix: { voidstone: 0.6, iridium: 0.2, exotic: 0.2 },     color: '#3a2456', glow: '#c27bff' },
};

export const ECONOMIES = {
    agri:     { name: 'Agricultural', makes: ['rations', 'biogel', 'spices', 'wine'],      wants: ['machinery', 'polymer', 'coolant', 'medkits'] },
    mining:   { name: 'Mining',       makes: ['ferrite', 'silicate', 'titanium', 'gems'],  wants: ['rations', 'machinery', 'medkits', 'stims'] },
    industry: { name: 'Industrial',   makes: ['machinery', 'steel', 'alloy', 'polymer'],   wants: ['ferrite', 'titanium', 'cuprite', 'carbon', 'rations'] },
    hitech:   { name: 'High-Tech',    makes: ['electronics', 'circuit', 'datacores', 'medkits'], wants: ['silicon', 'cuprite', 'iridium', 'gems'] },
    refinery: { name: 'Refinery',     makes: ['fuelcell', 'coolant', 'silicon', 'steel'],  wants: ['ice', 'helium3', 'ferrite', 'silicate'] },
    military: { name: 'Military',     makes: ['arms', 'alloy', 'medkits'],                 wants: ['rations', 'electronics', 'fuelcell', 'lattice'] },
    tourism:  { name: 'Tourism',      makes: ['art', 'wine', 'silks'],                     wants: ['rations', 'relics', 'gems', 'spices'] },
    frontier: { name: 'Frontier',     makes: ['ice', 'carbon', 'relics'],                  wants: ['machinery', 'medkits', 'arms', 'fuelcell', 'rations'] },
};

// ------------------------------------------------------------------ enemies
export const ENEMIES = {
    skiff:   { name: 'Reaver Skiff',   faction: 'reaver', hp: 36,  shield: 0,   speed: 92,  turn: 2.1, dmg: 4,  rate: 2.0, range: 650, size: 1.0, bounty: 110, flee: 0.25, cls: 1 },
    gunship: { name: 'Reaver Gunship', faction: 'reaver', hp: 110, shield: 40,  speed: 68,  turn: 1.4, dmg: 7,  rate: 1.8, range: 700, size: 1.6, bounty: 280, flee: 0, cls: 3 },
    warlord: { name: 'Reaver Warlord', faction: 'reaver', hp: 520, shield: 220, speed: 74,  turn: 1.35, dmg: 9, rate: 3.0, range: 750, size: 2.6, bounty: 2400, flee: 0, cls: 4, boss: true },
    drone:   { name: 'Swarm Drone',    faction: 'swarm',  hp: 22,  shield: 0,   speed: 118, turn: 2.9, dmg: 3,  rate: 2.6, range: 520, size: 0.8, bounty: 70, flee: 0, cls: 1 },
    lancer:  { name: 'Swarm Lancer',   faction: 'swarm',  hp: 140, shield: 60,  speed: 78,  turn: 1.5, dmg: 10, rate: 1.2, range: 800, size: 1.8, bounty: 340, flee: 0, cls: 3 },
    warden:  { name: 'Lattice Warden', faction: 'warden', hp: 380, shield: 300, speed: 86,  turn: 1.8, dmg: 11, rate: 2.2, range: 800, size: 2.2, bounty: 1500, flee: 0, cls: 4 },
};

export const STANDING_BANDS = [
    { min: -101, name: 'Hostile', color: '#ff5470' },
    { min: -50, name: 'Wary', color: '#ff9f4a' },
    { min: 0, name: 'Neutral', color: '#c9d4e8' },
    { min: 25, name: 'Friendly', color: '#6bffb0' },
    { min: 60, name: 'Allied', color: '#5ef0ff' },
];
export const standingBand = (v) => { let b = STANDING_BANDS[0]; for (const s of STANDING_BANDS) if (v >= s.min) b = s; return b; };

// ------------------------------------------------------------------ galaxy
export const GALAXY = {
    systems: 230,
    radius: 82,        // ly
    arms: 4,
    minSpacing: 4,
    coreVoid: 23.5,
    species: 8,
};
export const CRUISE = { max: 3000, accel: 900, charge: 1.5, massLock: 650, hostileLock: 1200 };
export const AU = 1; // world units are just "units"
export const ROCK_REGROW = 20 * 60; // seconds of game time
export const BOARD_EPOCH = 8 * 60;
export const MAX_ACTIVE_QUESTS = 6;

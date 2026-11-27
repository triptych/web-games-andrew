// Content tables. Pure data: numbers here, rules in the other js/sim modules.

/** Enemy kinds. hp, contact radius, score, cores dropped; where: 'water' or 'bank'. */
export const ENEMIES = {
    patrol:  { name: 'Patrol Boat',   hp: 4,  r: 1.4, score: 100, cores: 1, where: 'water', speed: 4,  fire: { every: 2.4, tele: 0.55, pattern: 'aimed', n: 1 } },
    gunboat: { name: 'Gunboat',       hp: 11, r: 1.8, score: 250, cores: 2, where: 'water', speed: 3,  fire: { every: 2.8, tele: 0.65, pattern: 'fan', n: 3, spread: 0.32 } },
    raider:  { name: 'Speed Raider',  hp: 3,  r: 1.2, score: 150, cores: 1, where: 'water', speed: 0,  charge: 30 },
    mine:    { name: 'Mine',          hp: 2,  r: 1.1, score: 50,  cores: 0, where: 'water', speed: 0,  mine: true, blast: 4.5 },
    barge:   { name: 'Fuel Barge',    hp: 14, r: 2.2, score: 300, cores: 2, where: 'water', speed: 6,  fuel: 40, fire: { every: 3.2, tele: 0.6, pattern: 'aimed', n: 2 } },
    tank:    { name: 'River Tank',    hp: 8,  r: 1.6, score: 200, cores: 2, where: 'bank',  speed: 0,  fire: { every: 3.0, tele: 1.0, pattern: 'shell', n: 1, laser: true } },
    turret:  { name: 'Cliff Turret',  hp: 12, r: 1.8, score: 250, cores: 2, where: 'bank',  speed: 0,  fire: { every: 3.4, tele: 0.8, pattern: 'fan', n: 5, spread: 0.5 } },
    blockade:{ name: 'Blockade',      hp: 16, r: 0,   score: 120, cores: 1, where: 'water', speed: 0,  blockade: true },
    depot:   { name: 'Fuel Depot',    hp: 6,  r: 2.2, score: 80,  cores: 0, where: 'water', speed: 0,  depot: true },
};

/**
 * Bosses and mini-bosses. Each has parts (offsets from its centre, in metres; +y is further from the boat),
 * and phases. A phase lists the patterns it fires; `until` says how it ends:
 *   'parts'  — every part tagged with this phase's `kill` group is destroyed
 *   number   — the core's hp falls below this share of its max
 * A mini-boss is a boss with one phase and no core shield.
 */
export const BOSSES = {
    kabuto: {
        name: 'KABUTO', title: 'Armored Dreadnought Barge', mini: true, w: 8, model: 'kabuto', score: 3000, cores: 14,
        parts: [
            { id: 'fore', role: 'turret', dx: -2.6, dy: -3.2, r: 1.6, hp: 22, group: 'guns' },
            { id: 'aft', role: 'turret', dx: 2.6, dy: 3.2, r: 1.6, hp: 22, group: 'guns' },
            { id: 'core', role: 'core', dx: 0, dy: 0, r: 2.4, hp: 60 },
        ],
        phases: [
            { until: 0, shielded: false, patterns: [
                { p: 'fan', from: 'fore', every: 1.9, n: 5, spread: 0.6, tele: 0.6 },
                { p: 'aimed', from: 'aft', every: 1.3, n: 2, tele: 0.4 },
                { p: 'sweep', from: 'core', every: 4.5, n: 10, arc: 1.6, tele: 0.8 },
            ] },
        ],
        sway: 5, swaySpeed: 0.5,
    },
    torii: {
        name: 'TORII GATE', title: 'Fortified River Gate', mini: true, w: 13, model: 'torii', score: 3500, cores: 16, gate: true,
        parts: [
            { id: 'left', role: 'tower', dx: -9, dy: 0, r: 2.6, hp: 30, group: 'guns' },
            { id: 'right', role: 'tower', dx: 9, dy: 0, r: 2.6, hp: 30, group: 'guns' },
            { id: 'port1', role: 'turret', dx: -4, dy: -0.6, r: 1.4, hp: 14, group: 'guns' },
            { id: 'port2', role: 'turret', dx: 0, dy: -0.6, r: 1.4, hp: 14, group: 'guns' },
            { id: 'port3', role: 'turret', dx: 4, dy: -0.6, r: 1.4, hp: 14, group: 'guns' },
            { id: 'core', role: 'core', dx: 0, dy: 0.4, r: 2.2, hp: 40 },
        ],
        phases: [
            { until: 0, shielded: false, patterns: [
                { p: 'aimed', from: 'port1', every: 1.6, n: 1, tele: 0.45 },
                { p: 'aimed', from: 'port2', every: 1.7, n: 1, tele: 0.45 },
                { p: 'aimed', from: 'port3', every: 1.8, n: 1, tele: 0.45 },
                { p: 'fan', from: 'left', every: 3.1, n: 4, spread: 0.5, tele: 0.7 },
                { p: 'fan', from: 'right', every: 3.3, n: 4, spread: 0.5, tele: 0.7 },
                { p: 'lane', from: 'core', every: 6.5, w: 3.2, tele: 1.3, dur: 0.7 },
            ] },
        ],
        sway: 0, swaySpeed: 0,
    },
    zero: {
        name: 'ZERO', title: 'Hydrofoil Gunship', mini: true, w: 6, model: 'zero', score: 4000, cores: 18,
        parts: [
            { id: 'podL', role: 'turret', dx: -2.6, dy: 0, r: 1.3, hp: 20, group: 'guns' },
            { id: 'podR', role: 'turret', dx: 2.6, dy: 0, r: 1.3, hp: 20, group: 'guns' },
            { id: 'core', role: 'core', dx: 0, dy: 0.6, r: 2.0, hp: 70 },
        ],
        phases: [
            { until: 0, shielded: false, patterns: [
                { p: 'aimed', from: 'podL', every: 1.1, n: 3, tele: 0.35 },
                { p: 'aimed', from: 'podR', every: 1.2, n: 3, tele: 0.35 },
                { p: 'missile', from: 'core', every: 3.4, n: 2, tele: 0.6 },
                { p: 'ring', from: 'core', every: 4.8, n: 14, tele: 0.8 },
            ] },
        ],
        sway: 9, swaySpeed: 0.9,
    },

    souen: {
        name: 'SOUEN', title: 'Twin-Hull Fortress', w: 12, model: 'souen', score: 12000, cores: 40,
        parts: [
            { id: 'hullL', role: 'hull', dx: -6, dy: 0, r: 2.8, hp: 50, group: 'hulls' },
            { id: 'hullR', role: 'hull', dx: 6, dy: 0, r: 2.8, hp: 50, group: 'hulls' },
            { id: 'core', role: 'core', dx: 0, dy: 0.6, r: 2.8, hp: 120 },
        ],
        phases: [
            { name: 'TWIN HULLS', until: 'parts', kill: 'hulls', shielded: true, patterns: [
                { p: 'sweep', from: 'hullL', every: 3.2, n: 12, arc: 1.4, tele: 0.7 },
                { p: 'sweep', from: 'hullR', every: 3.2, n: 12, arc: 1.4, tele: 0.7, offset: 1.6 },
                { p: 'aimed', from: 'hullL', every: 2.1, n: 2, tele: 0.45 },
                { p: 'aimed', from: 'hullR', every: 2.3, n: 2, tele: 0.45 },
            ] },
            { name: 'CORE EXPOSED', until: 0.4, shielded: false, patterns: [
                { p: 'aimed', from: 'core', every: 1.0, n: 3, tele: 0.35 },
                { p: 'missile', from: 'core', every: 3.0, n: 2, tele: 0.6 },
                { p: 'fan', from: 'core', every: 2.4, n: 7, spread: 0.9, tele: 0.6 },
            ] },
            { name: 'OVERDRIVE', until: 0, shielded: false, overdrive: true, patterns: [
                { p: 'ring', from: 'core', every: 2.2, n: 16, tele: 0.6 },
                { p: 'lane', from: 'core', every: 4.2, w: 3.4, tele: 1.2, dur: 0.7 },
                { p: 'aimed', from: 'core', every: 1.4, n: 3, tele: 0.3 },
            ] },
        ],
        sway: 6, swaySpeed: 0.4,
    },
    raijin: {
        name: 'RAIJIN', title: 'Storm Hydrofoil', w: 11, model: 'raijin', score: 15000, cores: 50,
        parts: [
            { id: 'rod1', role: 'pylon', dx: -6, dy: -3, r: 1.5, hp: 26, group: 'rods' },
            { id: 'rod2', role: 'pylon', dx: 6, dy: -3, r: 1.5, hp: 26, group: 'rods' },
            { id: 'rod3', role: 'pylon', dx: -6, dy: 3, r: 1.5, hp: 26, group: 'rods' },
            { id: 'rod4', role: 'pylon', dx: 6, dy: 3, r: 1.5, hp: 26, group: 'rods' },
            { id: 'core', role: 'core', dx: 0, dy: 0, r: 2.6, hp: 140 },
        ],
        phases: [
            { name: 'STORM PYLONS', until: 'parts', kill: 'rods', shielded: true, patterns: [
                { p: 'lane', from: 'rod1', every: 5.0, w: 2.8, tele: 1.2, dur: 0.6 },
                { p: 'lane', from: 'rod2', every: 5.0, w: 2.8, tele: 1.2, dur: 0.6, offset: 2.5 },
                { p: 'aimed', from: 'rod3', every: 1.8, n: 2, tele: 0.4 },
                { p: 'aimed', from: 'rod4', every: 1.9, n: 2, tele: 0.4 },
                { p: 'sweep', from: 'core', every: 4.0, n: 14, arc: 1.8, tele: 0.8 },
            ] },
            { name: 'CORE EXPOSED', until: 0.4, shielded: false, patterns: [
                { p: 'ring', from: 'core', every: 2.6, n: 14, tele: 0.6 },
                { p: 'missile', from: 'core', every: 2.8, n: 3, tele: 0.6 },
                { p: 'aimed', from: 'core', every: 1.2, n: 3, tele: 0.35 },
            ] },
            { name: 'OVERDRIVE', until: 0, shielded: false, overdrive: true, patterns: [
                { p: 'lane', from: 'core', every: 2.8, w: 3.0, tele: 1.1, dur: 0.6 },
                { p: 'sweep', from: 'core', every: 2.4, n: 18, arc: 2.4, tele: 0.6 },
                { p: 'missile', from: 'core', every: 3.2, n: 2, tele: 0.5 },
            ] },
        ],
        sway: 8, swaySpeed: 0.55,
    },
    tetsuren: {
        name: 'TETSUREN', title: 'Iron Lotus Flagship', w: 13, model: 'tetsuren', score: 20000, cores: 70,
        parts: [
            { id: 'batL', role: 'turret', dx: -7, dy: -2, r: 2.0, hp: 34, group: 'batteries' },
            { id: 'batR', role: 'turret', dx: 7, dy: -2, r: 2.0, hp: 34, group: 'batteries' },
            { id: 'bow', role: 'hull', dx: 0, dy: -5.5, r: 2.4, hp: 44, group: 'batteries' },
            { id: 'core', role: 'core', dx: 0, dy: -0.5, r: 3.0, hp: 170 },
        ],
        phases: [
            { name: 'BROADSIDE', until: 'parts', kill: 'batteries', shielded: true, patterns: [
                { p: 'fan', from: 'batL', every: 2.2, n: 6, spread: 0.8, tele: 0.6 },
                { p: 'fan', from: 'batR', every: 2.4, n: 6, spread: 0.8, tele: 0.6 },
                { p: 'missile', from: 'bow', every: 3.6, n: 2, tele: 0.6 },
                { p: 'sweep', from: 'core', every: 4.4, n: 14, arc: 1.6, tele: 0.8 },
            ] },
            { name: 'LOTUS CORE', until: 0.4, shielded: false, patterns: [
                { p: 'ring', from: 'core', every: 2.3, n: 18, tele: 0.6 },
                { p: 'aimed', from: 'core', every: 0.95, n: 3, tele: 0.3 },
                { p: 'lane', from: 'core', every: 5.0, w: 3.4, tele: 1.2, dur: 0.7 },
            ] },
            { name: 'IRON OVERDRIVE', until: 0, shielded: false, overdrive: true, patterns: [
                { p: 'ring', from: 'core', every: 1.8, n: 20, tele: 0.5 },
                { p: 'lane', from: 'core', every: 3.4, w: 3.4, tele: 1.1, dur: 0.7 },
                { p: 'missile', from: 'core', every: 2.6, n: 3, tele: 0.5 },
                { p: 'fan', from: 'core', every: 2.0, n: 9, spread: 1.1, tele: 0.5 },
            ] },
        ],
        sway: 7, swaySpeed: 0.45,
    },
};

/** Sectors in order. Palette names are read by the view; river shape numbers by the generator. */
export const SECTOR_DATA = [
    { id: 'sakura', name: 'SAKURA GORGE', sub: 'Sector 1', mini: 'kabuto', boss: 'souen', palette: 'sakura',
      width: [13, 19], wind: 1.0, density: 1.0, kinds: { patrol: 5, gunboat: 2, raider: 2, mine: 3, barge: 1, tank: 2, turret: 1, blockade: 1 } },
    { id: 'jade', name: 'JADE TORRENT', sub: 'Sector 2', mini: 'torii', boss: 'raijin', palette: 'jade',
      width: [12, 18], wind: 1.25, density: 1.2, kinds: { patrol: 4, gunboat: 3, raider: 3, mine: 3, barge: 1, tank: 3, turret: 2, blockade: 2 } },
    { id: 'kurogane', name: 'KUROGANE DAM', sub: 'Sector 3', mini: 'zero', boss: 'tetsuren', palette: 'dusk',
      width: [11, 17], wind: 1.45, density: 1.4, kinds: { patrol: 3, gunboat: 4, raider: 3, mine: 4, barge: 1, tank: 3, turret: 3, blockade: 2 } },
];

/** Pickups that float on the river. weight = how often a drop or a placed pickup is this kind. */
export const PICKUPS = {
    core:     { label: 'Core',          weight: 0 },
    cell:     { label: 'Energy Cell',   weight: 5 },
    repair:   { label: 'Repair Kit',    weight: 3 },
    jump:     { label: 'Jump Cell',     weight: 3 },
    overdrive:{ label: 'Overdrive',     weight: 2 },
    spread:   { label: 'Spread Shot',   weight: 2 },
    plasma:   { label: 'Plasma Cannon', weight: 2 },
    rapid:    { label: 'Rapid Fire',    weight: 2 },
    shield:   { label: 'Barrier',       weight: 2 },
    magnet:   { label: 'Magnet',        weight: 2 },
};

/**
 * The skill tree: three branches of five nodes. A node needs the node above it at rank 1.
 * cost[r] is the price of rank r + 1. `fx` is read by applySkills() in skills.js.
 */
export const SKILLS = [
    { branch: 'hull', name: 'Hull & Jump', color: '#ff5a7a', nodes: [
        { id: 'hull', name: 'Reinforced Hull', ranks: 3, cost: [12, 24, 42], desc: (r) => `Max hull +${20 * r}` },
        { id: 'foil', name: 'Spring Hydrofoils', ranks: 3, cost: [16, 28, 44], desc: (r) => `Jump height and air time +${15 * r}%` },
        { id: 'charge', name: 'Twin Charge', ranks: 2, cost: [30, 60], desc: (r) => `+${r} jump charge${r > 1 ? 's' : ''}` },
        { id: 'shock', name: 'Shockwave Landing', ranks: 2, cost: [32, 60], desc: (r) => `Landing blast: ${[0, 6, 12][r]} damage, ${[0, 7, 9][r]} m` },
        { id: 'barrage', name: 'Landing Barrage', ranks: 1, cost: [76], desc: () => 'Landing fires a ring of 14 cannon shells' },
    ] },
    { branch: 'guns', name: 'Weapons & Ordnance', color: '#ffb63c', nodes: [
        { id: 'rounds', name: 'Hot Rounds', ranks: 3, cost: [16, 28, 44], desc: (r) => `Cannon damage +${20 * r}%` },
        { id: 'racks', name: 'Missile Racks', ranks: 3, cost: [18, 32, 52], desc: (r) => `+${2 * r} missiles, reload ${20 * r}% faster` },
        { id: 'barrels', name: 'Extra Barrels', ranks: 2, cost: [36, 66], desc: (r) => `${2 + r} cannon barrels` },
        { id: 'pierce', name: 'Piercing Shells', ranks: 2, cost: [36, 64], desc: (r) => `Shells pierce ${r} enem${r > 1 ? 'ies' : 'y'}` },
        { id: 'seeker', name: 'Seeker Rounds', ranks: 2, cost: [40, 66], desc: (r) => `Shells curve toward targets (${r === 1 ? 'gently' : 'hard'})` },
    ] },
    { branch: 'sys', name: 'Systems & Boosts', color: '#46e0ff', nodes: [
        { id: 'fuel', name: 'Fuel Efficiency', ranks: 3, cost: [12, 24, 40], desc: (r) => `Fuel drain −${15 * r}%` },
        { id: 'amp', name: 'Boost Amplifier', ranks: 3, cost: [16, 28, 42], desc: (r) => `Boosts last ${20 * r}% longer` },
        { id: 'barrier', name: 'Starting Barrier', ranks: 2, cost: [28, 52], desc: (r) => `Start each sector with a ${r === 1 ? '2' : '4'}-hit barrier` },
        { id: 'magnet', name: 'Core Magnet', ranks: 2, cost: [20, 40], desc: (r) => `Pickup reach +${r === 1 ? 4 : 9} m` },
        { id: 'recharge', name: 'Jump Capacitor', ranks: 2, cost: [30, 54], desc: (r) => `Jump recharges ${25 * r}% faster` },
    ] },
];

export const SKILL_IDS = SKILLS.flatMap((b) => b.nodes.map((n) => n.id));

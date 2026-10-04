/**
 * config.js — every tuning number in Hivebreaker: the marine, weapons, the
 * Brood, bosses, sectors, field upgrades, power-ups and the shop.
 *
 * Pure data, imported by both the simulation (Node-safe) and the view.
 * Distances are metres (1 tile = 1 m), times are seconds, colours 0xRRGGBB.
 */

export const SIM_DT = 1 / 60;
export const SAVE_KEY = 'hivebreaker.save.v1';
export const WALL_H = 1.9;

export const PLAYER = {
    r: 0.36,
    hp: 100,
    armorMax: 100,
    speed: 6.3,
    accel: 60,
    rollSpeed: 13.5,
    rollTime: 0.32,
    rollCd: 0.55,
    hurtInv: 0.7,
    pickupR: 1.25,
    magnetR: 2.6,
    grenades: 3,
    grenadeMax: 5,
    pulses: 2,
    pulseMax: 3,
    slots: 4,
};

export const DIFFICULTY = {
    recruit:   { name: 'Recruit',   desc: 'More health, slower enemy fire, generous drops.', playerHp: 1.4, enemyHp: 0.8, enemyDmg: 0.6, bulletSpeed: 0.8, budget: 0.8, drops: 1.35, alpha: 0, fireRate: 0.8 },
    marine:    { name: 'Marine',    desc: 'The intended experience.',                         playerHp: 1,   enemyHp: 1,   enemyDmg: 1,   bulletSpeed: 1,   budget: 1,   drops: 1,    alpha: 0, fireRate: 1 },
    nightmare: { name: 'Nightmare', desc: 'Bigger swarms, faster bullets, alphas everywhere.', playerHp: 1,  enemyHp: 1.25, enemyDmg: 1.35, bulletSpeed: 1.15, budget: 1.35, drops: 0.85, alpha: 0.12, fireRate: 1.2 },
};

// ------------------------------------------------------------------ Weapons
// kind: bullet | flame | arc | rail | grenade | plasma
export const WEAPONS = {
    pulse: {
        name: 'M41 Pulse Rifle', short: 'PULSE', kind: 'bullet', color: 0x7fe8ff,
        dmg: 11, rate: 9, mag: 40, reserve: Infinity, reload: 1.15, spread: 0.035, speed: 30, life: 0.9, knock: 0.5, pellets: 1,
        special: 'Every 6th shot is a micro-grenade', price: 0,
    },
    scatter: {
        name: 'Scattergun', short: 'SCATTER', kind: 'bullet', color: 0xffc46a,
        dmg: 8, rate: 1.7, mag: 6, reserve: 48, reload: 1.35, spread: 0.42, speed: 25, life: 0.4, knock: 2.6, pellets: 8,
        special: 'Pellets ricochet once', price: 70,
    },
    flame: {
        name: 'Flamethrower', short: 'FLAME', kind: 'flame', color: 0xff7a26,
        dmg: 4.2, rate: 30, mag: 120, reserve: 360, reload: 1.6, spread: 0.2, speed: 11.5, life: 0.42, knock: 0.15, pellets: 1, burn: 7, burnTime: 2.5,
        special: 'Blue flame: double burn, longer reach', price: 85,
    },
    smart: {
        name: 'Smartgun', short: 'SMART', kind: 'bullet', color: 0xb6ff6a,
        dmg: 8, rate: 13, mag: 120, reserve: 480, reload: 2.0, spread: 0.12, speed: 21, life: 1.25, knock: 0.3, pellets: 1, homing: 7.5,
        special: 'Bullets fork when they kill', price: 90,
    },
    arc: {
        name: 'Arc Caster', short: 'ARC', kind: 'arc', color: 0xa98bff,
        dmg: 24, rate: 4, mag: 30, reserve: 120, reload: 1.5, range: 9, chains: 3, chainR: 5, knock: 0.4, pellets: 1,
        special: '6 jumps that stun', price: 95,
    },
    rail: {
        name: 'Rail Lance', short: 'RAIL', kind: 'rail', color: 0x6af0ff,
        dmg: 150, rate: 1.25, charge: 0.5, mag: 5, reserve: 30, reload: 1.8, range: 40, knock: 3, pellets: 1,
        special: 'The beam detonates where it ends', price: 110,
    },
    gl: {
        name: 'Grenade Launcher', short: 'GL', kind: 'grenade', color: 0xffe066,
        dmg: 72, rate: 1.6, mag: 6, reserve: 36, reload: 2.0, radius: 3.2, speed: 15, life: 1.4, knock: 4, pellets: 1,
        special: 'Splits into four bomblets', price: 100,
    },
    minigun: {
        name: 'M56 Minigun', short: 'MINIGUN', kind: 'bullet', color: 0xffe9a8,
        dmg: 7, rate: 26, spinup: 0.55, mag: 300, reserve: 900, reload: 3.0, spread: 0.13, speed: 32, life: 0.8, knock: 0.35, pellets: 1,
        special: 'Incendiary rounds', price: 120,
    },
    plasma: {
        name: 'Plasma Cannon', short: 'PLASMA', kind: 'plasma', color: 0xff5ce1,
        dmg: 90, rate: 1.1, mag: 4, reserve: 24, reload: 2.2, radius: 4, speed: 10, life: 2.4, knock: 5, pellets: 1,
        special: 'The orb arcs lightning as it flies', price: 130,
    },
};
export const WEAPON_ORDER = ['pulse', 'scatter', 'flame', 'smart', 'arc', 'rail', 'gl', 'minigun', 'plasma'];
/** Weapons that can drop from crates, by the earliest sector they appear in. */
export const WEAPON_SECTOR = { scatter: 0, flame: 0, smart: 0, gl: 1, arc: 1, minigun: 2, rail: 2, plasma: 3 };
export const MK_DMG = [1, 1.3, 1.6];
export const MK_RATE = [1, 1.15, 1.3];

// ------------------------------------------------------------------ The Brood
// r = body radius, speed m/s, dmg = contact bite, cost = wave budget points
export const ENEMIES = {
    skitter:  { name: 'Skitter',  hp: 14,  speed: 5.4, r: 0.3,  dmg: 6,  cost: 1,  salvage: 0.25, mass: 0.4, color: 0x5b3d2a, glow: 0xff9a3a, desc: 'Small, fast and never alone. They pour out of vents by the dozen.' },
    drone:    { name: 'Drone',    hp: 48,  speed: 3.7, r: 0.5,  dmg: 12, cost: 3,  salvage: 1,    mass: 1,   color: 0x2b2f3a, glow: 0x7cf0ff, desc: 'The warrior caste. It stalks, rears back and lunges.' },
    spitter:  { name: 'Spitter',  hp: 40,  speed: 2.5, r: 0.46, dmg: 8,  cost: 4,  salvage: 1.2,  mass: 0.9, color: 0x3a4a1e, glow: 0xb6ff3a, desc: 'Keeps its distance and sprays acid. Roll through the gaps.' },
    bloater:  { name: 'Bloater',  hp: 70,  speed: 1.6, r: 0.62, dmg: 25, cost: 5,  salvage: 1.5,  mass: 2,   color: 0x5a6a20, glow: 0xd8ff4a, desc: 'A walking acid sac. Kill it from range; it leaves a pool.' },
    burrower: { name: 'Burrower', hp: 55,  speed: 4.2, r: 0.5,  dmg: 14, cost: 5,  salvage: 1.5,  mass: 1.2, color: 0x4a3426, glow: 0xff6a3a, desc: 'Swims under the deck plating and erupts in a ring of spines.' },
    brute:    { name: 'Brute',    hp: 230, speed: 2.3, r: 0.85, dmg: 26, cost: 12, salvage: 4,    mass: 6,   color: 0x2a2228, glow: 0xff4a4a, desc: 'Armoured in front. Sidestep its charge; it stuns itself on walls.' },
    husk:     { name: 'Husk',     hp: 52,  speed: 2.0, r: 0.4,  dmg: 10, cost: 4,  salvage: 1.6,  mass: 1,   color: 0x4a5040, glow: 0xff3a2a, desc: 'What is left of the garrison. It still remembers how to shoot.' },
    wasp:     { name: 'Wasp',     hp: 30,  speed: 6.2, r: 0.4,  dmg: 9,  cost: 3,  salvage: 1,    mass: 0.5, color: 0x2a2a1a, glow: 0xffe23a, desc: 'Flies erratically and swoops. Hard to pin down.' },
    stalker:  { name: 'Stalker',  hp: 95,  speed: 5.6, r: 0.5,  dmg: 18, cost: 7,  salvage: 2.5,  mass: 1.4, color: 0x1a1d26, glow: 0xb46aff, desc: 'A shimmer in the air until it is close enough to cut.' },
    clone:    { name: 'Zero Clone', hp: 260, speed: 3.4, r: 0.75, dmg: 14, cost: 0,  salvage: 3,    mass: 3,   color: 0xc8d2c8, glow: 0x6affd8, desc: 'A piece of Specimen Zero that walked away on its own.' },
    sac:      { name: 'Brood Sac', hp: 150, speed: 0,  r: 0.8,  dmg: 0,  cost: 8,  salvage: 3,    mass: 99,  color: 0x6a2a4a, glow: 0xff5ab4, desc: 'A pulsing nest. Destroy it before the room fills with skitters.' },
};
export const ENEMY_ORDER = ['skitter', 'drone', 'spitter', 'bloater', 'burrower', 'brute', 'husk', 'wasp', 'stalker', 'sac'];
export const ALPHA = { hp: 3, scale: 1.35, dmg: 1.4, salvage: 4, speed: 1.08 };

export const BOSSES = {
    ravager: { name: 'RAVAGER',         title: 'Hangar Deck Apex',         hp: 1700, r: 1.7, color: 0x3a2a22, glow: 0xff7a2a },
    goliath: { name: 'GOLIATH',         title: 'Infested Walker Mk IV',    hp: 2500, r: 1.8, color: 0x50565e, glow: 0xff3a2a },
    zero:    { name: 'SPECIMEN ZERO',   title: 'Containment Breach Origin', hp: 2300, r: 1.2, color: 0xd0d8d0, glow: 0x6affd8 },
    widow:   { name: 'MAGMA WIDOW',     title: 'Reactor Broodkeeper',      hp: 3100, r: 1.9, color: 0x241414, glow: 0xff5a1a },
    mother:  { name: 'THE BROOD MOTHER', title: 'Queen of the Erebus Hive', hp: 5200, r: 2.6, color: 0x2a1a30, glow: 0xff4ad8 },
};

// ------------------------------------------------------------------ Sectors
export const SECTORS = [
    {
        id: 'hangar', name: 'Hangar Deck', roman: 'I', boss: 'ravager',
        floor: 0x46505c, floor2: 0x323a44, wall: 0x5a6878, strip: 0x46c8ff, lamp: 0xbfe2ff, alarm: 0xff3a2a, accent: 0xffc23a,
        creep: 0.0, fog: 0x05080c, ambient: 0x1a2430,
        pool: { skitter: 6, drone: 3, spitter: 2 }, late: { bloater: 1 },
        budget: 22, alpha: 0, props: ['crate', 'crate', 'barrel', 'pillar', 'cargo', 'console'],
        music: { root: 45, tempo: 104, scale: 'minor' },
    },
    {
        id: 'barracks', name: 'Barracks & Armory', roman: 'II', boss: 'goliath',
        floor: 0x4c4a42, floor2: 0x36342e, wall: 0x6a6252, strip: 0xffa83a, lamp: 0xffd9a0, alarm: 0xff3a2a, accent: 0xffd23a,
        creep: 0.12, fog: 0x0a0806, ambient: 0x2a2218,
        pool: { skitter: 6, drone: 3, spitter: 2, husk: 3, burrower: 1.5 }, late: { brute: 1 },
        budget: 28, alpha: 0.03, props: ['locker', 'crate', 'barrel', 'sandbag', 'pillar', 'console'],
        music: { root: 43, tempo: 110, scale: 'phrygian' },
    },
    {
        id: 'labs', name: 'Bio-Research Labs', roman: 'III', boss: 'zero',
        floor: 0x5c6668, floor2: 0x434b4d, wall: 0x7e8a8a, strip: 0x3affd0, lamp: 0xdafff4, alarm: 0x3aff7a, accent: 0x3affd0,
        creep: 0.28, fog: 0x040a08, ambient: 0x18302a,
        pool: { skitter: 6, drone: 2.5, spitter: 2, bloater: 2, wasp: 2.5, husk: 1 }, late: { sac: 1, brute: 0.7 },
        budget: 34, alpha: 0.06, props: ['tank', 'tank', 'console', 'crate', 'barrel', 'rack'],
        music: { root: 47, tempo: 116, scale: 'dorian' },
    },
    {
        id: 'reactor', name: 'Reactor Core', roman: 'IV', boss: 'widow',
        floor: 0x4a3c36, floor2: 0x30241f, wall: 0x6a4a3a, strip: 0xff5a1a, lamp: 0xffb070, alarm: 0xff2a1a, accent: 0xff6a1a,
        creep: 0.4, fog: 0x0c0402, ambient: 0x301610,
        pool: { skitter: 6, drone: 2.5, spitter: 2, bloater: 1.5, burrower: 1.5, stalker: 2, husk: 1.5, brute: 0.8 }, late: { sac: 1, wasp: 1.5 },
        budget: 40, alpha: 0.1, props: ['pipe', 'pipe', 'barrel', 'barrel', 'rack', 'pillar'],
        music: { root: 41, tempo: 124, scale: 'phrygian' },
    },
    {
        id: 'hive', name: 'The Hive', roman: 'V', boss: 'mother',
        floor: 0x3a2a3e, floor2: 0x24182a, wall: 0x4a2a4a, strip: 0xff4ad8, lamp: 0xff9ae8, alarm: 0xff2a8a, accent: 0xff4ad8,
        creep: 0.95, fog: 0x0a020a, ambient: 0x2a1030,
        pool: { skitter: 7, drone: 3, spitter: 2, bloater: 1.5, burrower: 1.5, stalker: 2, wasp: 2, brute: 1, sac: 1 }, late: {},
        budget: 46, alpha: 0.16, props: ['cocoon', 'cocoon', 'pod', 'pillar', 'barrel', 'cocoon'],
        music: { root: 40, tempo: 128, scale: 'locrian' },
    },
];
export const ESCAPE_TIME = 180;
export const ESCAPE_THEME = { ...SECTORS[4], id: 'escape', name: 'Escape', roman: '!', boss: null, creep: 0.6, music: { root: 40, tempo: 140, scale: 'phrygian' } };
export const HORDE_THEME = { ...SECTORS[0], id: 'horde', name: 'Infestation Protocol', roman: '∞', creep: 0.35, music: { root: 42, tempo: 132, scale: 'minor' } };

// ------------------------------------------------------------------ Power-ups (timed)
export const POWERUPS = {
    overdrive: { name: 'OVERDRIVE', desc: 'Double damage', dur: 12, color: 0xff3a5a },
    hyperfire: { name: 'HYPERFIRE', desc: '+60% fire rate, no reloads', dur: 12, color: 0xffd23a },
    aegis:     { name: 'AEGIS',     desc: 'Invulnerable', dur: 7, color: 0x5ad8ff },
    drone:     { name: 'SENTRY DRONE', desc: 'An orbiting gun drone', dur: 22, color: 0x8aff6a },
    stim:      { name: 'STIM',      desc: 'Faster, rolls recharge twice as fast', dur: 12, color: 0x6affd0 },
    cryo:      { name: 'CRYO FIELD', desc: 'All bugs slowed', dur: 7, color: 0xa8e8ff },
    nova:      { name: 'NOVA',      desc: 'Instant blast around you', dur: 0, color: 0xffffff },
};
export const POWERUP_ORDER = ['overdrive', 'hyperfire', 'aegis', 'drone', 'stim', 'cryo', 'nova'];

// ------------------------------------------------------------------ Field upgrades (perks)
export const PERKS = {
    plating:    { name: 'Reinforced Plating', desc: '+25 max health, heal 25',               glyph: '⬢' },
    kinetic:    { name: 'Kinetic Rounds',     desc: '+18% damage with every weapon',          glyph: '✦' },
    quickhands: { name: 'Quickhands',         desc: 'Reload 35% faster',                      glyph: '↻' },
    ricochet:   { name: 'Ricochet Rounds',    desc: 'Bullets bounce off walls once',          glyph: '⟲' },
    combatroll: { name: 'Combat Roll',        desc: 'Roll cooldown −40%; rolls shove bugs',   glyph: '➰' },
    scavenger:  { name: 'Scavenger',          desc: '+50% salvage and more ammo drops',       glyph: '⛭' },
    leech:      { name: 'Leech Serum',        desc: 'Heal 1 for every 6 kills',               glyph: '✚' },
    demolition: { name: 'Demolitions',        desc: '+1 grenade capacity, +30% blast radius', glyph: '✹' },
    volatile:   { name: 'Volatile Biology',   desc: '15% of kills explode',                   glyph: '☢' },
    crit:       { name: 'Crit Optics',        desc: '12% chance to deal triple damage',       glyph: '◎' },
    companion:  { name: 'Companion Drone',    desc: 'A permanent gun drone',                  glyph: '◈' },
    adrenal:    { name: 'Adrenal Gland',      desc: 'Below 35% health: +30% damage and speed', glyph: '♥' },
    capacitor:  { name: 'Pulse Capacitor',    desc: '+1 Shock Pulse; pulses deal 60 damage',  glyph: '◉' },
    magnet:     { name: 'Mag-Boots',          desc: 'Pickups fly to you from far away',       glyph: '⊛' },
    thickhide:  { name: 'Ablative Weave',     desc: 'Take 18% less damage',                   glyph: '▣' },
    secondwind: { name: 'Second Wind',        desc: 'Once per sector, survive a lethal hit',  glyph: '✧' },
};
export const PERK_ORDER = Object.keys(PERKS);

// ------------------------------------------------------------------ Shop
export const SHOP = {
    medkit:  { name: 'Medkit',        desc: 'Restore 40 health',       price: 30, glyph: '✚' },
    armor:   { name: 'Armour Plate',  desc: '+50 armour',              price: 35, glyph: '⬢' },
    ammo:    { name: 'Ammo Crate',    desc: 'Refill half of all reserves', price: 25, glyph: '▤' },
    grenade: { name: 'Grenade x2',    desc: '+2 grenades',             price: 25, glyph: '●' },
    pulse:   { name: 'Shock Pulse',   desc: '+1 pulse charge',         price: 40, glyph: '◉' },
    mod:     { name: 'Mod Chip',      desc: 'Upgrade the gun in your hands', price: 80, glyph: '⬆' },
    stim:    { name: 'Random Stim',   desc: 'A random power-up',       price: 30, glyph: '?' },
};

// ------------------------------------------------------------------ Misc
export const PICKUP_KINDS = ['salvage', 'health', 'bighealth', 'armor', 'ammo', 'grenade', 'pulse', 'mod', 'weapon', 'power', 'keycard'];
export const SALVAGE_VALUE = 2;

export const HORDE = { waveTime: 32, crateEvery: 5, startBudget: 22, growth: 1.16 };

export function sectorTheme(index) {
    if (index === 'escape') return ESCAPE_THEME;
    if (index === 'horde') return HORDE_THEME;
    return SECTORS[index];
}

export function weaponDamage(id, mk) { return WEAPONS[id].dmg * MK_DMG[mk - 1]; }

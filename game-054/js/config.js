// ============================================================
// PALE ENGINE — configuration and data tables
// ============================================================

export const VERSION = '1.0.0';
export const SAVE_KEY = 'pale-engine-v1';

// --- World grid ---
export const CELL = 2;            // metres per grid cell
export const STEP = 0.55;         // highest ledge you can walk up
export const GRAVITY = 26;

// --- Player ---
export const PLAYER = {
    radius: 0.36,
    height: 1.75,
    eye: 1.58,
    walk: 7.2,            // m/s
    run: 10.4,            // with run held (or always-run on)
    accel: 70,
    friction: 11,
    airControl: 0.35,
    jump: 7.2,
    maxHealth: 100,
    overHealth: 200,
    maxArmor: 200,
};

// --- Ammo ---
export const AMMO = {
    bullets: { name: 'Bullets', max: 200, color: '#ffd36b', icon: '▮' },
    shells:  { name: 'Shells',  max: 50,  color: '#ff8a4c', icon: '▰' },
    rockets: { name: 'Rockets', max: 50,  color: '#ff5d5d', icon: '▲' },
    cells:   { name: 'Cells',   max: 300, color: '#7fe3ff', icon: '◆' },
};

// --- Weapons (slot = number key) ---
// dmg is [min,max] per pellet / hit. spread in degrees (x, y).
export const WEAPONS = [
    { id: 'blade',    slot: 1, name: 'Arc Blade',          kind: 'melee',      dmg: [28, 44], range: 2.4, rate: 2.3, ammo: null, use: 0,
      blurb: 'A plasma-edged breaching blade. Executes staggered demons.' },
    { id: 'pistol',   slot: 2, name: 'M-9 Warden',         kind: 'hitscan',    dmg: [14, 20], pellets: 1,  spread: [0.5, 0.5], rate: 3.2, ammo: null, use: 0,
      blurb: 'Your service sidearm. Self-charging — it never runs dry.' },
    { id: 'shotgun',  slot: 3, name: 'Scattergun',         kind: 'hitscan',    dmg: [9, 13],  pellets: 8,  spread: [5.5, 3.2], rate: 1.15, ammo: 'shells', use: 1,
      blurb: 'Pump-action, eight pellets. The great equaliser.' },
    { id: 'ssg',      slot: 4, name: 'Twin Reaper',        kind: 'hitscan',    dmg: [9, 13],  pellets: 20, spread: [11, 4.5], rate: 0.72, ammo: 'shells', use: 2,
      blurb: 'Double-barrelled, twenty pellets. Point at problem.' },
    { id: 'chaingun', slot: 5, name: 'Shredder',           kind: 'hitscan',    dmg: [11, 15], pellets: 1,  spread: [2.4, 1.6], rate: 12, ammo: 'bullets', use: 1, auto: true, spinup: 0.32,
      blurb: 'Rotary cannon. Spins up, never wants to stop.' },
    { id: 'rocket',   slot: 6, name: 'Hellfire RL',        kind: 'projectile', proj: 'rocket', dmg: [80, 100], splash: 128, radius: 4.4, speed: 34, rate: 1.4, ammo: 'rockets', use: 1,
      blurb: 'Rockets. Mind the splash.' },
    { id: 'plasma',   slot: 7, name: 'Ion Lance',          kind: 'projectile', proj: 'plasma', dmg: [17, 25], splash: 6, radius: 0.9, speed: 52, rate: 11, ammo: 'cells', use: 1, auto: true,
      blurb: 'Rapid ion bolts that melt through hide.' },
    { id: 'rail',     slot: 8, name: 'Rail Driver',        kind: 'rail',       dmg: [170, 200], rate: 0.85, ammo: 'cells', use: 6,
      blurb: 'A magnetic slug that passes through every body in a line.' },
    { id: 'bfg',      slot: 9, name: 'Singularity Cannon', kind: 'projectile', proj: 'singularity', dmg: [500, 600], splash: 420, radius: 9, speed: 15, rate: 0.6, charge: 0.8, ammo: 'cells', use: 40,
      blurb: 'Fires a pocket black hole that arcs lightning through everything near it, then collapses.' },
];
export const WEAPON_BY_ID = Object.fromEntries(WEAPONS.map((w) => [w.id, w]));

// --- Pickups ---
// kind: health | armor | ammo | weapon | power | key | backpack | map
export const PICKUPS = {
    stim:      { kind: 'health', amount: 10,  cap: 100, name: 'Stim Pack',       color: 0x55ff88 },
    medkit:    { kind: 'health', amount: 25,  cap: 100, name: 'Medkit',          color: 0x44ff77 },
    vial:      { kind: 'health', amount: 2,   cap: 200, name: 'Vital Vial',      color: 0x55aaff },
    soul:      { kind: 'health', amount: 100, cap: 200, name: 'Soul Orb',        color: 0x66ccff, power: true },
    shard:     { kind: 'armor',  amount: 5,   cap: 200, name: 'Armor Shard',     color: 0x8cff6a },
    vest:      { kind: 'armor',  set: 100,             name: 'Combat Vest',     color: 0x5cff6a },
    mega:      { kind: 'armor',  set: 200,             name: 'Bulwark Plate',   color: 0x4aa8ff, power: true },
    clip:      { kind: 'ammo', ammo: 'bullets', amount: 20, name: 'Ammo Clip' },
    ammobox:   { kind: 'ammo', ammo: 'bullets', amount: 60, name: 'Box of Bullets' },
    shells:    { kind: 'ammo', ammo: 'shells',  amount: 6,  name: 'Shells' },
    shellbox:  { kind: 'ammo', ammo: 'shells',  amount: 20, name: 'Box of Shells' },
    rocket1:   { kind: 'ammo', ammo: 'rockets', amount: 2,  name: 'Rockets' },
    rocketbox: { kind: 'ammo', ammo: 'rockets', amount: 8,  name: 'Rocket Crate' },
    cell:      { kind: 'ammo', ammo: 'cells',   amount: 30, name: 'Energy Cell' },
    cellpack:  { kind: 'ammo', ammo: 'cells',   amount: 90, name: 'Cell Pack' },
    backpack:  { kind: 'backpack', name: 'Backpack' },
    berserk:   { kind: 'power', power: 'berserk',  time: 40, name: 'Berserk',          color: 0xff3344 },
    overdrive: { kind: 'power', power: 'overdrive', time: 30, name: 'Overdrive',       color: 0xb455ff },
    haste:     { kind: 'power', power: 'haste',    time: 25, name: 'Haste',            color: 0x55ffee },
    invuln:    { kind: 'power', power: 'invuln',   time: 30, name: 'Aegis Field',      color: 0x99ff55 },
    cloak:     { kind: 'power', power: 'cloak',    time: 40, name: 'Phase Cloak',      color: 0xaabbff },
    suit:      { kind: 'power', power: 'suit',     time: 60, name: 'Hazard Suit',      color: 0x77ff44 },
    surveyor:  { kind: 'map', name: 'Survey Drone', color: 0xffee66 },
    key_blue:   { kind: 'key', key: 'blue',   name: 'Blue Keycard',   color: 0x3a8bff },
    key_yellow: { kind: 'key', key: 'yellow', name: 'Yellow Keycard', color: 0xffd23a },
    key_red:    { kind: 'key', key: 'red',    name: 'Red Keycard',    color: 0xff3a3a },
};
for (const w of WEAPONS) {
    if (w.id === 'blade' || w.id === 'pistol') continue;
    PICKUPS['w_' + w.id] = { kind: 'weapon', weapon: w.id, name: w.name, color: 0xffcc66 };
}

export const POWER_INFO = {
    berserk:   { label: 'BERSERK',   color: '#ff3344' },
    overdrive: { label: 'OVERDRIVE', color: '#c070ff' },
    haste:     { label: 'HASTE',     color: '#55ffee' },
    invuln:    { label: 'AEGIS',     color: '#a6ff5c' },
    cloak:     { label: 'CLOAK',     color: '#aabbff' },
    suit:      { label: 'HAZARD',    color: '#77ff44' },
};

export const KEY_COLORS = { blue: 0x3a8bff, yellow: 0xffd23a, red: 0xff3a3a };
export const KEY_ORDER = ['blue', 'yellow', 'red'];

// --- Difficulty ---
export const DIFFICULTIES = [
    { id: 'recruit',   name: 'Recruit',   blurb: 'Learning the trade. Demons hit softly.',             dmg: 0.5,  count: 0.7,  hp: 0.85, speed: 0.9,  ammo: 1.6, aggro: 0.75 },
    { id: 'marine',    name: 'Warden',    blurb: 'The intended fight.',                                dmg: 1.0,  count: 1.0,  hp: 1.0,  speed: 1.0,  ammo: 1.0, aggro: 1.0 },
    { id: 'veteran',   name: 'Veteran',   blurb: 'More of them, and they hit harder.',                 dmg: 1.3,  count: 1.3,  hp: 1.0,  speed: 1.05, ammo: 1.0, aggro: 1.15 },
    { id: 'nightmare', name: 'Nightmare', blurb: 'Fast, numerous and merciless. Projectiles are quicker.', dmg: 1.7, count: 1.55, hp: 1.15, speed: 1.25, ammo: 0.9, aggro: 1.4 },
];

// --- Rendering ---
export const FOV = 78;
export const MAX_DYN_LIGHTS = 8;
export const LIGHTMAP_RES = 4;    // texels per cell

export const QUALITY = [
    { name: 'High',   pixelRatio: 2,    scale: 1,    bloom: true,  lights: 8, particles: 1.0 },
    { name: 'Medium', pixelRatio: 1.25, scale: 1,    bloom: true,  lights: 6, particles: 0.7 },
    { name: 'Low',    pixelRatio: 1,    scale: 0.75, bloom: false, lights: 4, particles: 0.45 },
];

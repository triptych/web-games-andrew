/**
 * config.js — every tunable in Quiverspire: the player, arrows, enemies,
 * bosses, chapters, stage plan, talents and difficulty curve.
 *
 * Shared by the pure simulation (js/sim/) and the three.js view (js/view/),
 * so nothing in here may touch the DOM or import three.js.
 *
 * Units: one grid cell = 1 world unit. Rooms are 11 cells wide
 * (x ∈ [-5.5, 5.5]) and `rows` cells tall (y ∈ [0, rows]); the player
 * enters at the bottom and leaves through the door in the top wall.
 */

export const TICK = 1 / 120;                 // fixed simulation step

export const ROOM = {
    cols: 11,
    half: 5.5,
    doorHalf: 1.5,                           // door opening: x ∈ [-1.5, 1.5]
    spawnY: 1.3,
};

export const PLAYER = {
    r: 0.36,
    speed: 4.4,
    hp: 750,
    atk: 100,
    aspd: 1.25,                              // volleys per second while standing still
    crit: 0.05,
    critMul: 2,
    iframes: 0.5,
    magnet: 1.8,
    firstShot: 0.45,                         // fraction of the cooldown before the first shot after stopping
};

export const ARROW = { speed: 16, r: 0.14, life: 1.6 };

// ------------------------------------------------------------------ Abilities
// tier drives the card colour; weight the roll chance; max the stack cap.
export const ABILITIES = {
    multishot:  { name: 'Multishot',        icon: '🏹', tier: 'epic',   max: 3, weight: 6, desc: 'Fire an extra volley right after each shot. Arrow damage −10%.' },
    front:      { name: 'Front Arrow +1',   icon: '⬆️', tier: 'epic',   max: 3, weight: 6, desc: 'One more arrow side by side in every volley. Arrow damage −12%.' },
    diagonal:   { name: 'Diagonal Arrows',  icon: '↗️', tier: 'rare',   max: 3, weight: 7, desc: 'Two more arrows fan out at an angle.' },
    side:       { name: 'Side Arrows',      icon: '↔️', tier: 'rare',   max: 2, weight: 5, desc: 'Arrows fly out to your left and right.' },
    rear:       { name: 'Rear Arrow',       icon: '⬇️', tier: 'common', max: 2, weight: 5, desc: 'An arrow flies out behind you.' },
    pierce:     { name: 'Piercing Shot',    icon: '📌', tier: 'rare',   max: 2, weight: 6, desc: 'Arrows pass through enemies (−33% damage per enemy).' },
    ricochet:   { name: 'Ricochet',         icon: '🔀', tier: 'epic',   max: 3, weight: 6, desc: 'Arrows bounce to two more nearby enemies.' },
    bouncy:     { name: 'Bouncy Wall',      icon: '🧱', tier: 'common', max: 2, weight: 5, desc: 'Arrows rebound off walls and rocks twice.' },
    atk:        { name: 'Attack Boost',     icon: '⚔️', tier: 'common', max: 6, weight: 9, desc: 'Attack +25%.' },
    aspd:       { name: 'Attack Speed',     icon: '⚡', tier: 'common', max: 6, weight: 9, desc: 'Attack speed +15%.' },
    crit:       { name: 'Crit Master',      icon: '🎯', tier: 'common', max: 4, weight: 7, desc: 'Crit chance +12%, crit damage +40%.' },
    hpboost:    { name: 'HP Boost',         icon: '❤️', tier: 'common', max: 6, weight: 7, desc: 'Max HP +20%, and heal that much.' },
    giant:      { name: 'Giant Arrows',     icon: '🗡️', tier: 'rare',   max: 1, weight: 4, desc: 'Arrows are huge and hit 35% harder.' },
    fire:       { name: 'Blaze',            icon: '🔥', tier: 'rare',   max: 2, weight: 6, desc: 'Arrows set enemies on fire.' },
    frost:      { name: 'Freeze',           icon: '❄️', tier: 'rare',   max: 2, weight: 6, desc: 'Arrows chill enemies and can freeze them solid.' },
    poison:     { name: 'Poison Touch',     icon: '☠️', tier: 'rare',   max: 2, weight: 6, desc: 'Arrows poison enemies until they die.' },
    bolt:       { name: 'Bolt',             icon: '🌩️', tier: 'rare',   max: 2, weight: 6, desc: 'Hits arc lightning to nearby enemies.' },
    orbFire:    { name: 'Flame Circle',     icon: '☀️', tier: 'rare',   max: 2, weight: 5, desc: 'Two fireballs orbit you, burning what they touch.' },
    orbIce:     { name: 'Frost Circle',     icon: '💠', tier: 'rare',   max: 2, weight: 5, desc: 'Two ice shards orbit you, chilling what they touch.' },
    spirit:     { name: 'Spirit Wisp',      icon: '👻', tier: 'rare',   max: 2, weight: 5, desc: 'A wisp follows you and shoots even while you move.' },
    bloodthirst:{ name: 'Bloodthirst',      icon: '🩸', tier: 'rare',   max: 2, weight: 5, desc: 'Every kill heals 2.5% of max HP.' },
    rage:       { name: 'Rage',             icon: '😤', tier: 'common', max: 2, weight: 4, desc: 'The lower your HP, the harder you hit (up to +40%).' },
    dodge:      { name: 'Dodge Master',     icon: '💨', tier: 'common', max: 3, weight: 5, desc: '+12% chance to dodge a hit.' },
    speed:      { name: 'Swift Feet',       icon: '👟', tier: 'common', max: 3, weight: 5, desc: 'Move 12% faster.' },
    headshot:   { name: 'Headshot',         icon: '💀', tier: 'epic',   max: 2, weight: 3, desc: 'Each volley has a 5% chance to slay the first normal enemy it hits.' },
    star:       { name: 'Invincibility Star', icon: '⭐', tier: 'epic', max: 1, weight: 3, desc: 'Every 10 s you are invincible for 2 s.' },
    aegis:      { name: 'Aegis',            icon: '🛡️', tier: 'rare',   max: 1, weight: 4, desc: 'A ward blocks one hit, recharging every 8 s.' },
    extralife:  { name: 'Extra Life',       icon: '💖', tier: 'epic',   max: 1, weight: 3, desc: 'Revive once at half HP.' },
    heal:       { name: 'Heal',             icon: '🍖', tier: 'common', max: 99, weight: 6, desc: 'Recover 35% of max HP.' },
};

/** Abilities the Devil will offer (strong ones, for a slice of max HP). */
export const DEVIL_POOL = ['multishot', 'front', 'ricochet', 'pierce', 'extralife', 'headshot', 'star', 'giant'];
export const DEVIL_HP_COST = 0.2;

// ------------------------------------------------------------------ Enemies
// hp / dmg are chapter-1 values; difficulty() scales them per chapter & stage.
// cost is the spawn-budget price; xp is dropped as orbs.
export const ENEMIES = {
    slime:   { name: 'Slime',        hp: 240, r: 0.42, speed: 3.1, contact: 60,  xp: 2, cost: 1, ground: true },
    slimelet:{ name: 'Slimelet',     hp: 90,  r: 0.28, speed: 3.4, contact: 40,  xp: 1, cost: 0, ground: true },
    bat:     { name: 'Bat',          hp: 140, r: 0.34, speed: 2.4, contact: 50,  xp: 1, cost: 1, fly: true },
    archer:  { name: 'Bone Archer',  hp: 220, r: 0.36, speed: 1.9, contact: 40,  xp: 2, cost: 2, ground: true, shot: 70 },
    plant:   { name: 'Spitter Bloom',hp: 320, r: 0.42, speed: 0,   contact: 40,  xp: 2, cost: 2, ground: true, shot: 55 },
    mage:    { name: 'Hex Mage',     hp: 260, r: 0.36, speed: 1.4, contact: 40,  xp: 2, cost: 2, ground: true, shot: 60 },
    spider:  { name: 'Leaper',       hp: 250, r: 0.36, speed: 1.6, contact: 60,  xp: 2, cost: 2, ground: true, shot: 90 },
    boar:    { name: 'Tusker',       hp: 380, r: 0.46, speed: 1.6, contact: 80,  xp: 3, cost: 3, ground: true },
    bomber:  { name: 'Bombardier',   hp: 240, r: 0.38, speed: 1.6, contact: 40,  xp: 3, cost: 3, ground: true, shot: 115 },
    ghost:   { name: 'Wraith',       hp: 280, r: 0.4,  speed: 1.3, contact: 55,  xp: 3, cost: 3, fly: true, phase: true, shot: 70 },
    golem:   { name: 'Stone Golem',  hp: 900, r: 0.62, speed: 1.15,contact: 120, xp: 4, cost: 4, ground: true, shot: 110 },
    worm:    { name: 'Burrower',     hp: 420, r: 0.44, speed: 3.2, contact: 60,  xp: 3, cost: 3, ground: true, shot: 60 },
    eye:     { name: 'Watcher',      hp: 330, r: 0.42, speed: 0.9, contact: 40,  xp: 3, cost: 3, fly: true, shot: 125 },
};

/** Order in which enemy types enter the rotation, one or two per chapter. */
export const ENEMY_UNLOCK = [
    ['slime', 'bat', 'archer', 'plant'],       // chapter 1
    ['mage', 'spider'],                        // 2
    ['boar', 'bomber'],                        // 3
    ['ghost', 'golem'],                        // 4
    ['worm', 'eye'],                           // 5
];

export const ELITE = { hp: 7, r: 1.45, dmg: 1.25, cd: 0.75, xp: 6 };

export const BOSSES = {
    slimeKing:  { name: 'Gorgomire, the Swelling King', hp: 6200, r: 1.2,  contact: 100, fly: false },
    boneArcher: { name: 'Hollow Marksman',              hp: 5800, r: 0.8,  contact: 90, fly: false },
    cinderGolem:{ name: 'Cinder Colossus',              hp: 7400, r: 1.25, contact: 110, fly: false },
    tideSerpent:{ name: 'Tidecoil Serpent',             hp: 6600, r: 1.05, contact: 95, fly: true },
    voidLich:   { name: 'The Unlit Lich',               hp: 6200, r: 0.9,  contact: 90, fly: true },
};
export const BOSS_ORDER = ['slimeKing', 'boneArcher', 'cinderGolem', 'tideSerpent', 'voidLich'];

// ------------------------------------------------------------------ Chapters
// gen: obstacle recipe — pit = share of obstacles that are pits instead of
// rock, spikes = spike-trap density, patterns = generator weights.
export const CHAPTERS = [
    { name: 'Verdant Glade',   biome: 'glade',   favored: ['slime', 'bat'],     gen: { pit: 0.25, spikes: 0,    patterns: { scatter: 3, pillars: 2, bars: 1, pools: 1, lanes: 0, ring: 1, noise: 1 } } },
    { name: 'Sunken Crypt',    biome: 'crypt',   favored: ['archer', 'mage'],   gen: { pit: 0.2,  spikes: 0.02, patterns: { scatter: 2, pillars: 3, bars: 2, pools: 1, lanes: 1, ring: 1, noise: 1 } } },
    { name: 'Ember Wastes',    biome: 'ember',   favored: ['bomber', 'boar'],   gen: { pit: 0.5,  spikes: 0.02, patterns: { scatter: 2, pillars: 1, bars: 1, pools: 3, lanes: 2, ring: 1, noise: 1 } } },
    { name: 'Frostpeak Hollow',biome: 'frost',   favored: ['golem', 'spider'],  gen: { pit: 0.3,  spikes: 0.03, patterns: { scatter: 3, pillars: 1, bars: 2, pools: 1, lanes: 1, ring: 2, noise: 1 } } },
    { name: 'Fungal Deep',     biome: 'fungal',  favored: ['plant', 'worm'],    gen: { pit: 0.35, spikes: 0.03, patterns: { scatter: 3, pillars: 1, bars: 1, pools: 2, lanes: 1, ring: 1, noise: 2 } } },
    { name: 'Drowned Ruins',   biome: 'tidal',   favored: ['ghost', 'eye'],     gen: { pit: 0.65, spikes: 0.02, patterns: { scatter: 1, pillars: 2, bars: 1, pools: 3, lanes: 3, ring: 1, noise: 1 } } },
    { name: 'Obsidian Forge',  biome: 'forge',   favored: ['golem', 'bomber'],  gen: { pit: 0.45, spikes: 0.05, patterns: { scatter: 2, pillars: 2, bars: 3, pools: 2, lanes: 1, ring: 1, noise: 1 } } },
    { name: 'Crystal Caverns', biome: 'crystal', favored: ['eye', 'mage'],      gen: { pit: 0.3,  spikes: 0.04, patterns: { scatter: 3, pillars: 2, bars: 1, pools: 1, lanes: 1, ring: 2, noise: 2 } } },
    { name: 'Sky Temple',      biome: 'sky',     favored: ['archer', 'bat'],    gen: { pit: 0.6,  spikes: 0.04, patterns: { scatter: 1, pillars: 3, bars: 2, pools: 2, lanes: 2, ring: 2, noise: 1 } } },
    { name: 'The Void Crown',  biome: 'void',    favored: ['ghost', 'worm'],    gen: { pit: 0.5,  spikes: 0.06, patterns: { scatter: 2, pillars: 2, bars: 2, pools: 2, lanes: 2, ring: 2, noise: 2 } } },
];

/** One chapter = 12 stages. Endless mode repeats this with rising difficulty. */
export const STAGE_PLAN = [
    'combat', 'combat', 'combat', 'angel', 'combat', 'miniboss',
    'combat', 'combat', 'angel', 'combat', 'combat', 'boss',
];

export const DEVIL_CHANCE = 0.5;

/**
 * Enemy multipliers for a chapter (1-based; fractional in endless mode) and
 * a stage index within it (0-based).
 */
export function difficulty(chapter, stage) {
    const c = chapter - 1;
    // Past chapter-10 strength (Endless only) the curve turns exponential, so even a
    // fully stacked build is eventually outgrown.
    const over = Math.max(0, c - 9);
    return {
        hp: (1 + 0.42 * c) * (1 + 0.035 * stage) * Math.pow(1.22, over),
        dmg: (1 + 0.24 * c) * (1 + 0.02 * stage) * Math.pow(1.12, over),
        budget: Math.min(15, 3.6 + stage * 0.38 + c * 0.55),
        tempo: Math.min(1.35, 1 + 0.035 * c),       // attack cadence multiplier
    };
}

/** XP needed to go from `level` to `level + 1`. */
export const xpToNext = (level) => 6 + level * 4;

// ------------------------------------------------------------------ Talents
// Permanent upgrades bought with coins between runs.
export const TALENTS = {
    power:    { name: 'Power',     icon: '⚔️', max: 10, desc: (l) => `Attack +${8 * l}%` },
    vitality: { name: 'Vitality',  icon: '❤️', max: 10, desc: (l) => `Max HP +${10 * l}%` },
    agility:  { name: 'Agility',   icon: '⚡', max: 10, desc: (l) => `Attack speed +${4 * l}%` },
    armor:    { name: 'Iron Skin', icon: '🛡️', max: 10, desc: (l) => `Damage taken −${3 * l}%` },
    recover:  { name: 'Recover',   icon: '🍖', max: 10, desc: (l) => `Healing +${8 * l}%` },
    greed:    { name: 'Greed',     icon: '🪙', max: 10, desc: (l) => `Coins +${10 * l}%` },
};
export const talentCost = (level) => Math.round(40 * Math.pow(1.45, level));

export const COIN = { chapterClear: 120, perStage: 6 };

/**
 * config.js — every tuning table in one place: the battlefield, the party,
 * castle upgrades, monster archetypes, regions, powerups and the Ember tree.
 *
 * Pure data (plus a few tiny formulas). Imported by both the simulation and
 * the view, so it must not import three.js or touch the DOM.
 */

export const VERSION = '1.0.0';

// ------------------------------------------------------------------ Battlefield

export const LANES = 5;
export const LANE_W = 1.15;            // z spacing between lanes (world units)
export const FIELD_COLS_MAX = 6;       // deepest the bailey can grow
export const FIELD_END = 10.3;         // monsters are targetable once x < FIELD_END
export const SPAWN_X = 10.9;
export const WALL_X = 0;               // the wall's front face
export const WALL_HIT_X = 0.28;        // where a monster stands to hit the wall
export const TOWER_TIERS = 3;
export const SIM_DT = 1 / 60;
export const WAVES_PER_REGION = 10;

export const laneZ = (lane) => (lane - (LANES - 1) / 2) * LANE_W;
export const cellX = (col) => col + 0.5;
export const wallSlotX = (tier) => -0.55 - 0.9 * tier;

/** Lanes that monsters use on a given wave (PvZ-style opening). */
export function activeLanes(wave) {
    if (wave <= 2) return [2];
    if (wave <= 4) return [1, 2, 3];
    return [0, 1, 2, 3, 4];
}

// ------------------------------------------------------------------ Scaling

export const hpMul = (w) => (1 + 0.1 * (w - 1)) * Math.pow(1.085, w - 1);
export const dmgMul = (w) => (1 + 0.06 * (w - 1)) * Math.pow(1.03, w - 1);
export const bountyMul = (w) => 1 + 0.12 * (w - 1);
/** Powerups and the Keepfire keep pace with monster health. */
export const powerMul = (w) => Math.pow(hpMul(w), 0.92);
export const waveBudget = (w) => 7 + 4.4 * w + 0.12 * w * w;
export const waveClearBonus = (w) => Math.round(25 + 14 * w);

// ------------------------------------------------------------------ Damage types

export const DMG_TYPES = {
    phys:  { name: 'Physical', color: '#e8dcc0' },
    fire:  { name: 'Fire',     color: '#ff7a2a' },
    frost: { name: 'Frost',    color: '#8fd8ff' },
    shock: { name: 'Shock',    color: '#c9a8ff' },
    holy:  { name: 'Holy',     color: '#ffe680' },
};

// ------------------------------------------------------------------ Party

/**
 * atk.kind decides the projectile/behaviour; see world.js `unitAttack`.
 * Stats are level-1 values; world.js scales them by level, forge, relics.
 */
export const UNITS = {
    archer: {
        name: 'Archer', title: 'Longbow of the Greenwatch', cost: 75, recharge: 4, place: 'any', hp: 120, unlock: 1,
        atk: { kind: 'arrow', dmg: 12, cd: 1.1, speed: 14, air: true, type: 'phys' },
        desc: 'Looses arrows down her lane. Hits flyers.',
        perks: { 3: 'Piercing arrows pass through one more foe', 6: 'Twin shot: two arrows a volley', 10: 'Hawkeye: +25% critical chance' },
        color: '#6fbf4a',
    },
    alchemist: {
        name: 'Alchemist', title: 'Gnome of the Gilded Still', cost: 50, recharge: 6, place: 'any', hp: 100, unlock: 2,
        gen: { gold: 12, cd: 10 },
        desc: 'Brews gold every few seconds. Build these early.',
        perks: { 3: '+30% gold per brew', 6: 'Mending draught: heals neighbours', 10: "Philosopher's Stone: +60% gold per brew" },
        color: '#e6c34a',
    },
    knight: {
        name: 'Knight', title: 'Sworn Shield of Emberhold', cost: 100, recharge: 8, place: 'field', hp: 520, unlock: 3, block: true,
        atk: { kind: 'melee', dmg: 20, cd: 0.9, reach: 0.9, air: false, type: 'phys' },
        desc: 'Holds the line in the field and cuts down what reaches him.',
        perks: { 3: 'Shield wall: −25% damage taken', 6: 'Cleave: hits every foe in reach', 10: 'Bulwark: neighbouring lanes take −20% damage' },
        color: '#b9c4d6',
    },
    palisade: {
        name: 'Palisade', title: 'Sharpened stakes', cost: 75, recharge: 14, place: 'field', hp: 1100, unlock: 4, block: true, structure: true,
        desc: 'A cheap wall of stakes that soaks punishment.',
        perks: { 3: 'Spikes: attackers take damage', 6: 'Iron-shod: +50% health', 10: 'Thornwall: attackers are slowed' },
        color: '#a07a4a',
    },
    pyro: {
        name: 'Pyromancer', title: 'Adept of the Cinder Choir', cost: 175, recharge: 10, place: 'any', hp: 110, unlock: 6,
        atk: { kind: 'fireball', dmg: 30, cd: 1.9, speed: 9, splash: 0.85, burn: 5, air: true, type: 'fire' },
        desc: 'Fireballs that burst and set foes alight.',
        perks: { 3: 'Wider blasts', 6: 'Burning ground where fireballs land', 10: 'Twin fireballs' },
        color: '#ff6a2a',
    },
    frost: {
        name: 'Frost Witch', title: 'Rime-crowned of Frostfell', cost: 150, recharge: 8, place: 'any', hp: 110, unlock: 8,
        atk: { kind: 'ice', dmg: 10, cd: 1.3, speed: 12, slow: 0.45, slowT: 2.6, air: true, type: 'frost' },
        desc: 'Ice shards that slow whatever they strike.',
        perks: { 3: 'Longer chill', 6: '15% chance to freeze solid', 10: 'Shatter: frozen foes take double damage' },
        color: '#8fd8ff',
    },
    dwarf: {
        name: 'Dwarf Bombardier', title: 'Kegmaster of Deepforge', cost: 200, recharge: 14, place: 'any', hp: 240, unlock: 11,
        atk: { kind: 'barrel', dmg: 72, cd: 3.4, splash: 1.35, lob: true, air: false, type: 'fire' },
        desc: 'Lobs exploding barrels. Big splash, ground only.',
        perks: { 3: 'Blasts knock foes back', 6: 'Barrels burst into bomblets', 10: 'Mega keg: +60% blast' },
        color: '#c8823a',
    },
    cleric: {
        name: 'Cleric', title: 'Lightbearer of the Hearth', cost: 125, recharge: 12, place: 'any', hp: 140, unlock: 14,
        heal: { amt: 24, cd: 2.2, radius: 1.75, wall: 5 },
        atk: { kind: 'holy', dmg: 11, cd: 1.6, speed: 15, air: true, type: 'holy' },
        desc: 'Heals nearby allies and mends the wall. Holy bolts sear the undead.',
        perks: { 3: 'Stronger heals', 6: 'Blessing shields the most hurt ally', 10: 'Sanctuary: the whole lane regenerates' },
        color: '#ffe680',
    },
    ballista: {
        name: 'Ballista', title: 'Siege engine of the Watch', cost: 250, recharge: 18, place: 'any', hp: 300, unlock: 18, structure: true,
        atk: { kind: 'bolt', dmg: 82, cd: 3.6, speed: 24, pierce: 99, air: true, type: 'phys' },
        desc: 'A bolt that skewers everything in the lane.',
        perks: { 3: 'Faster reload', 6: 'Bolts stagger foes', 10: 'Twin bolts' },
        color: '#8a6a4a',
    },
    druid: {
        name: 'Druid', title: 'Antlered Keeper of the Wood', cost: 175, recharge: 12, place: 'field', hp: 280, unlock: 22, block: true,
        root: { cd: 5.5, dur: 2.2, reach: 4.2, dmg: 26, count: 2 },
        desc: 'Calls up thorned roots that hold foes in place.',
        perks: { 3: 'Longer roots', 6: 'Roots four foes', 10: 'Entangle the whole lane' },
        color: '#5aa860',
    },
    storm: {
        name: 'Storm Caller', title: 'Voice of the High Tempest', cost: 300, recharge: 20, place: 'any', hp: 140, unlock: 26,
        atk: { kind: 'chain', dmg: 42, cd: 2.4, range: 7.5, jumps: 4, jumpR: 2.5, air: true, type: 'shock' },
        desc: 'Chain lightning that leaps between lanes.',
        perks: { 3: '+2 jumps', 6: 'Lightning stuns', 10: 'Storm surge: double strikes' },
        color: '#c9a8ff',
    },
};

export const UNIT_ORDER = ['archer', 'alchemist', 'knight', 'palisade', 'pyro', 'frost', 'dwarf', 'cleric', 'ballista', 'druid', 'storm'];
export const UNIT_MAX_LEVEL = 10;
export const PERK_LEVELS = [3, 6, 10];

export const unitDmgMul = (lv) => 1 + 0.42 * (lv - 1);
export const unitHpMul = (lv) => 1 + 0.3 * (lv - 1);
export const unitRateMul = (lv) => 1 + 0.04 * (lv - 1);
export const upgradeCost = (def, lv) => Math.round(def.cost * 0.8 * Math.pow(1.65, lv - 1));
export const SELL_REFUND = 0.6;

// ------------------------------------------------------------------ Castle

export const CASTLE = {
    walls:    { name: 'Walls', max: 15, start: 1, desc: 'Wall strength', icon: 'wall',
                cost: (lv) => Math.round(110 * Math.pow(1.62, lv - 1)) },
    bailey:   { name: 'Bailey', max: 6, start: 3, desc: 'Build one column deeper into the field', icon: 'bailey',
                cost: (lv) => [0, 0, 0, 260, 750, 1800][lv] },
    forge:    { name: 'Forge', max: 20, start: 0, desc: '+12% damage for the whole party', icon: 'forge',
                cost: (lv) => Math.round(220 * Math.pow(1.6, lv)) },
    treasury: { name: 'Treasury', max: 12, start: 0, desc: '+8% gold per kill, interest and slow income', icon: 'treasury',
                cost: (lv) => Math.round(160 * Math.pow(1.75, lv)) },
    keepfire: { name: 'Keepfire Beacon', max: 10, start: 0, desc: 'A firestorm down a whole lane, charged by kills', icon: 'keepfire',
                cost: (lv) => Math.round(180 * Math.pow(1.85, lv)) },
    ramparts: { name: 'Spiked Ramparts', max: 8, start: 0, desc: 'Monsters hitting the wall are hurt', icon: 'ramparts',
                cost: (lv) => Math.round(150 * Math.pow(1.8, lv)) },
};
export const CASTLE_ORDER = ['walls', 'bailey', 'forge', 'treasury', 'keepfire', 'ramparts'];
export const towerCost = (tier, built) => Math.round([0, 130, 380, 950][tier] * (1 + 0.1 * built));
export const wallMaxHp = (lv) => Math.round(220 * Math.pow(1.28, lv - 1));
export const keepfireDmg = (lv) => 160 * (1 + 0.6 * (lv - 1));
export const rampartDmg = (lv) => 4 * lv * lv + 6 * lv;
export const treasuryIncome = (lv) => lv * 0.6;                    // gold per second during waves
export const treasuryInterest = (lv) => 0.02 * lv;                  // fraction of held gold at wave end
export const interestCap = (w) => 60 + 25 * w;

// ------------------------------------------------------------------ Monsters

/**
 * Archetype stats at wave 1. world.js scales hp/dmg/bounty by the wave.
 * cost is the wave-budget price.
 */
export const ARCH = {
    grunt:    { hp: 70,  speed: 0.38, dmg: 8,  cd: 1.2, cost: 1,   bounty: 4,  size: 1.0 },
    runner:   { hp: 42,  speed: 0.85, dmg: 5,  cd: 0.8, cost: 1.2, bounty: 4,  size: 0.9 },
    shield:   { hp: 80,  speed: 0.32, dmg: 9,  cd: 1.3, cost: 2,   bounty: 6,  size: 1.05, shield: 0.9 },
    ranged:   { hp: 52,  speed: 0.36, dmg: 7,  cd: 2.1, cost: 2,   bounty: 6,  size: 0.95, range: 3.6 },
    flyer:    { hp: 48,  speed: 0.55, dmg: 6,  cd: 1.0, cost: 1.8, bounty: 5,  size: 0.9, fly: true },
    sapper:   { hp: 52,  speed: 0.62, dmg: 70, cd: 1.0, cost: 2.5, bounty: 6,  size: 0.85 },
    shaman:   { hp: 72,  speed: 0.3,  dmg: 6,  cd: 1.4, cost: 3,   bounty: 8,  size: 1.0, heal: 0.12 },
    leaper:   { hp: 74,  speed: 0.55, dmg: 9,  cd: 1.1, cost: 2,   bounty: 6,  size: 1.0 },
    burrower: { hp: 88,  speed: 0.5,  dmg: 10, cd: 1.2, cost: 2.6, bounty: 7,  size: 1.0 },
    splitter: { hp: 110,  speed: 0.3,  dmg: 8,  cd: 1.2, cost: 3,   bounty: 7,  size: 1.15 },
    brute:    { hp: 360, speed: 0.24, dmg: 30, cd: 1.6, cost: 6,   bounty: 18, size: 1.55 },
    siege:    { hp: 270, speed: 0.22, dmg: 26, cd: 4.6, cost: 7,   bounty: 20, size: 1.4, range: 7.2 },
    treasure: { hp: 110,  speed: 0.95, dmg: 0,  cd: 1.0, cost: 0,   bounty: 60, size: 0.9 },
    boss:     { hp: 1,   speed: 0.2,  dmg: 40, cd: 1.6, cost: 0,   bounty: 400, size: 2.6 },
    icewall:  { hp: 140, speed: 0,    dmg: 0,  cd: 9,   cost: 0,   bounty: 2,  size: 1.2 },
};

export const ARCH_INFO = {
    grunt: 'Walks the lane and batters whatever stands in the way.',
    runner: 'Fast and fragile.',
    shield: 'Its shield soaks projectiles. Barrels, lightning and the Keepfire go around it.',
    ranged: 'Stops at range and shoots your field units or the wall.',
    flyer: 'Flies over blockers. Barrels cannot reach it.',
    sapper: 'Rushes in and explodes.',
    shaman: 'Heals the monsters around it.',
    leaper: 'Vaults over the first blocker it meets.',
    burrower: 'Tunnels under the field; only explosions reach it until it surfaces.',
    splitter: 'Splits in two when it dies.',
    brute: 'Huge, slow, and smashes blockers.',
    siege: 'Stops far out and hurls boulders at the wall.',
    treasure: 'Carries loot. Kill it before it escapes!',
};

export const AFFIXES = {
    armored:  { name: 'Armoured',     color: '#b8c0cc', desc: '−40% physical damage taken' },
    warded:   { name: 'Warded',       color: '#b48cff', desc: '−40% magic damage taken' },
    swift:    { name: 'Swift',        color: '#7affd0', desc: '+50% speed' },
    regen:    { name: 'Regenerating', color: '#6aff6a', desc: 'Regenerates 3% health a second' },
    giant:    { name: 'Giant',        color: '#ffb35a', desc: 'Bigger, tougher, hits harder' },
    vampiric: { name: 'Vampiric',     color: '#ff4a6a', desc: 'Heals when it hits' },
    explosive:{ name: 'Explosive',    color: '#ff7a2a', desc: 'Bursts when it dies' },
    frenzied: { name: 'Frenzied',     color: '#ff3a3a', desc: 'Faster as it bleeds' },
};

// ------------------------------------------------------------------ Regions

/**
 * roster: the order archetypes are introduced in the region. `fam` names a
 * body family in species.js. resist: damage-type multipliers (<1 resists).
 */
export const REGIONS = [
    {
        id: 'greenmarch', numeral: 'I', name: 'Greenmarch', sub: 'the spring meadows',
        resist: {},
        roster: [['grunt', 'goblin'], ['runner', 'wolf'], ['ranged', 'goblinArcher'], ['flyer', 'bat'], ['sapper', 'goblinSapper'], ['shield', 'hobgoblin'], ['brute', 'troll']],
        boss: { kind: 'warg', name: 'Bramblejaw', title: 'the Warg King', taunt: 'Your little fire smells of fear, keep-rat. My pack can smell it from the hills.' },
        intro: ['Goblins out of the Bramble Hills, Warden. Just goblins, so far.', 'Put the archer to work. Build an alchemist or two: gold wins wars.'],
        sky: { top: '#5ea8e8', bottom: '#cfe8f2', sun: '#fff1c4' }, fog: '#b9d8e0',
        ground: ['#5c9a3c', '#6aa846'], path: '#8a7a50', accent: '#e8d36a',
        weather: 'pollen',
    },
    {
        id: 'mirefen', numeral: 'II', name: 'Mirefen', sub: 'the drowned marches',
        resist: { frost: 0.8, shock: 1.3 },
        roster: [['grunt', 'bogGhoul'], ['runner', 'marshLizard'], ['splitter', 'slime'], ['shield', 'lizardfolk'], ['flyer', 'wisp'], ['burrower', 'mudLurker'], ['shaman', 'bogHag'], ['brute', 'bogTroll']],
        boss: { kind: 'toad', name: 'The Mire Mother', title: 'Queen of the Sunken Pools', taunt: 'Glrrrk. So warm. So dry. I will drown your little candle in my belly.' },
        intro: ['The fens have come alive. Slimes split when they die: burn them.', 'Lurkers tunnel under the mud. Only a blast will reach them below.'],
        sky: { top: '#3d5a52', bottom: '#a8b894', sun: '#e8e0a8' }, fog: '#7d9078',
        ground: ['#4a5e34', '#56693a'], path: '#5a4e34', accent: '#9ad06a',
        weather: 'fireflies',
    },
    {
        id: 'ashen', numeral: 'III', name: 'Ashen Pass', sub: 'the burning road',
        resist: { fire: 0.6, frost: 1.25 },
        roster: [['grunt', 'orc'], ['runner', 'hellhound'], ['ranged', 'orcWarlock'], ['flyer', 'imp'], ['leaper', 'orcReaver'], ['sapper', 'koboldSapper'], ['siege', 'orcCatapult'], ['brute', 'ogre']],
        boss: { kind: 'warlord', name: 'Warlord Skarn', title: 'Breaker of Gates', taunt: 'I have broken a hundred gates. Yours is kindling.' },
        intro: ['Orcs through the Ashen Pass. They shrug off fire; the cold bites them.', 'Catapults out past the fields. Reach them before your wall cracks.'],
        sky: { top: '#2a1414', bottom: '#b8562a', sun: '#ff9a4a' }, fog: '#6a3424',
        ground: ['#3a302c', '#443832'], path: '#2a201c', accent: '#ff6a2a',
        weather: 'ash',
    },
    {
        id: 'frostfell', numeral: 'IV', name: 'Frostfell', sub: 'the white wastes',
        resist: { frost: 0.4, fire: 1.3 },
        roster: [['grunt', 'frostkin'], ['runner', 'snowWolf'], ['shield', 'iceKnight'], ['flyer', 'frostWraith'], ['shaman', 'frostShaman'], ['burrower', 'iceWorm'], ['siege', 'frostGiant'], ['brute', 'yeti']],
        boss: { kind: 'colossus', name: 'The Rime Colossus', title: 'Heart of the Long Winter', taunt: 'ALL FIRES GO OUT. ALL OF THEM. IN THE END.' },
        intro: ['Frostfell marches on us. Frost barely touches them, but fire does.', 'Yetis and ice giants. Raise the walls, Warden.'],
        sky: { top: '#6a8cb8', bottom: '#e4eef8', sun: '#ffffff' }, fog: '#c8d8ea',
        ground: ['#dfe8f0', '#e9f0f6'], path: '#b8c8d8', accent: '#8fd8ff',
        weather: 'snow',
    },
    {
        id: 'gloamhold', numeral: 'V', name: 'Gloamhold', sub: 'the restless necropolis',
        resist: { holy: 2.0, fire: 1.2, phys: 0.9 }, undead: true,
        roster: [['grunt', 'skeleton'], ['runner', 'ghoulHound'], ['ranged', 'skeletonArcher'], ['shield', 'deathKnight'], ['flyer', 'banshee'], ['leaper', 'ghoul'], ['shaman', 'necromancer'], ['splitter', 'plagueBlob'], ['brute', 'boneGiant']],
        boss: { kind: 'lich', name: 'Morvane', title: 'the Lich of Gloamhold', taunt: 'Every warden who held that wall serves me now. You will make a fine one.' },
        intro: ['The dead walk out of Gloamhold. Holy light burns them twice over.', 'Kill the necromancers first.'],
        sky: { top: '#141228', bottom: '#4a3a5a', sun: '#b8ffb0' }, fog: '#2e2a3e',
        ground: ['#3a3a34', '#42423a'], path: '#2e2c28', accent: '#8aff8a',
        weather: 'mist',
    },
    {
        id: 'dragonspire', numeral: 'VI', name: 'Dragonspire', sub: 'beneath the Black Sun',
        resist: { fire: 0.5, shock: 1.3, frost: 1.1 },
        roster: [['grunt', 'kobold'], ['runner', 'drakeling'], ['shield', 'dragonguard'], ['ranged', 'cultist'], ['flyer', 'drake'], ['leaper', 'dragonkin'], ['sapper', 'koboldBomber'], ['siege', 'koboldBallista'], ['brute', 'wyrmspawn']],
        boss: { kind: 'dragon', name: 'Vael', title: 'the Black Sun', taunt: 'Little flame. I have eaten the sun. Did you think I would choke on you?' },
        intro: ["The Black Sun rises over Dragonspire. This is Vael's own host.", 'Fire means nothing to them. Lightning, frost and steel.'],
        sky: { top: '#1a0606', bottom: '#8a2a14', sun: '#120400' }, fog: '#4a1a10',
        ground: ['#2a2220', '#32282a'], path: '#1a1414', accent: '#ff4a1a',
        weather: 'embers',
    },
];

export const regionOf = (wave) => REGIONS[Math.floor((wave - 1) / WAVES_PER_REGION) % REGIONS.length];
export const regionIndex = (wave) => Math.floor((wave - 1) / WAVES_PER_REGION) % REGIONS.length;
export const localWave = (wave) => ((wave - 1) % WAVES_PER_REGION) + 1;
export const isBossWave = (wave) => localWave(wave) === WAVES_PER_REGION;
export const isLongNight = (wave) => wave > WAVES_PER_REGION * REGIONS.length;
export const FINAL_WAVE = WAVES_PER_REGION * REGIONS.length;

// ------------------------------------------------------------------ Powerups

export const POWERS = {
    meteor: { name: 'Meteor',        target: 'spot', color: '#ff6a2a', desc: 'A falling star on the spot you tap.' },
    nova:   { name: 'Frost Nova',    target: 'none', color: '#8fd8ff', desc: 'Freezes every monster.' },
    storm:  { name: 'Thunderstorm',  target: 'none', color: '#c9a8ff', desc: 'Lightning strikes the strongest foes.' },
    rally:  { name: 'Rally Horn',    target: 'none', color: '#ffd24a', desc: 'The whole party attacks faster.' },
    mend:   { name: 'Mending Light', target: 'none', color: '#a8ff8a', desc: 'Repairs the wall and heals the party.' },
    midas:  { name: 'Midas Touch',   target: 'none', color: '#ffe680', desc: 'Kills pay double for a while.' },
    arrows: { name: 'Arrow Rain',    target: 'lane', color: '#e8dcc0', desc: 'Arrows rain down a whole lane.' },
    quake:  { name: 'Earthquake',    target: 'none', color: '#c8823a', desc: 'Damages and stuns everything on the ground.' },
};
export const POWER_ORDER = Object.keys(POWERS);
export const RARITIES = [
    { id: 'common',    name: 'Common',    mul: 1.0, color: '#d8d8d8' },
    { id: 'rare',      name: 'Rare',      mul: 1.5, color: '#4aa8ff' },
    { id: 'epic',      name: 'Epic',      mul: 2.2, color: '#c06aff' },
    { id: 'legendary', name: 'Legendary', mul: 3.0, color: '#ffa82a' },
];

// ------------------------------------------------------------------ Ember tree (meta)

export const EMBER_TREE = {
    warmth:   { name: "Hearth's Warmth", max: 10, base: 4,  desc: '+20% starting gold' },
    stones:   { name: 'Old Stones',      max: 10, base: 5,  desc: '+8% wall health' },
    hymns:    { name: 'Battle Hymns',    max: 10, base: 6,  desc: '+6% party damage' },
    hands:    { name: 'Quick Hands',     max: 5,  base: 6,  desc: '−6% card recharge' },
    prospect: { name: 'Prospector',      max: 10, base: 5,  desc: '+6% gold from foes' },
    veterans: { name: 'Veterans',        max: 3,  base: 30, desc: 'New party members arrive a level higher' },
    scavenge: { name: 'Scavenger',       max: 5,  base: 8,  desc: '+15% powerup drops' },
    lodestone:{ name: 'Lodestone',       max: 1,  base: 25, desc: 'Motes and orbs collect themselves' },
    masonry:  { name: 'Masonry',         max: 4,  base: 20, desc: 'Start with another tower' },
    warp:     { name: 'Time Warp',       max: 1,  base: 15, desc: 'Unlocks ×3 game speed' },
    lore:     { name: 'Relic Lore',      max: 1,  base: 40, desc: 'Choose from four relics' },
    camp:     { name: 'Forward Camp',    max: 3,  base: 35, desc: 'Start at wave 6 / 11 / 16 with gold to match' },
    pockets:  { name: 'Deep Pockets',    max: 1,  base: 30, desc: 'One more powerup slot' },
};
export const EMBER_ORDER = Object.keys(EMBER_TREE);
export const emberRankCost = (key, rank) => Math.round(EMBER_TREE[key].base * Math.pow(1.6, rank));
export const REKINDLE_MIN_WAVE = 15;
export const embersFor = (bestWave) => Math.floor(0.5 * Math.pow(Math.max(0, bestWave), 1.4));
export const START_GOLD = 150;
export const RELIC_SLOTS = 8;

/**
 * world.js — places and content: campaign regions, monsters, bosses, rifts,
 * Spire blessings, expedition vocabulary, Overlord talents/spells, buildings.
 */

export const SPECIES = {
    slime:    { name: 'Slime',     cls: 'druid',       plan: 'slime',    mult: { hp: 1.1, atk: 0.85, def: 0.9, spd: -6 },  size: 0.9 },
    wolf:     { name: 'Wolf',      cls: 'assassin',    plan: 'wolf',     mult: { hp: 0.9, atk: 1.0, def: 0.85, spd: 4 },   size: 1.0 },
    goblin:   { name: 'Goblin',    cls: 'berserker',   plan: 'goblin',   mult: { hp: 0.85, atk: 0.95, def: 0.85, spd: 2 }, size: 0.8 },
    mushroom: { name: 'Shroomling', cls: 'necromancer', plan: 'mushroom', mult: { hp: 1.0, atk: 0.85, def: 0.95, spd: -2 }, size: 0.85 },
    imp:      { name: 'Imp',       cls: 'warlock',     plan: 'imp',      mult: { hp: 0.85, atk: 1.0, def: 0.85, spd: 4 },  size: 0.8 },
    golem:    { name: 'Golem',     cls: 'knight',      plan: 'golem',    mult: { hp: 1.25, atk: 0.85, def: 1.25, spd: -8 }, size: 1.25 },
    whelp:    { name: 'Whelp',     cls: 'mage',        plan: 'whelp',    mult: { hp: 1.0, atk: 1.05, def: 0.95, spd: 0 },  size: 1.0 },
    harpy:    { name: 'Harpy',     cls: 'ranger',      plan: 'harpy',    mult: { hp: 0.85, atk: 1.0, def: 0.85, spd: 6 },  size: 0.95 },
    wisp:     { name: 'Wisp',      cls: 'cleric',      plan: 'wisp',     mult: { hp: 0.8, atk: 0.9, def: 0.9, spd: 8 },    size: 0.75 },
    skeleton: { name: 'Skeleton',  cls: 'knight',      plan: 'skeleton', mult: { hp: 0.95, atk: 0.95, def: 1.05, spd: -2 }, size: 1.0 },
    spider:   { name: 'Spider',    cls: 'assassin',    plan: 'spider',   mult: { hp: 0.9, atk: 1.0, def: 0.9, spd: 3 },    size: 0.95 },
    crab:     { name: 'Crab',      cls: 'paladin',     plan: 'crab',     mult: { hp: 1.1, atk: 0.9, def: 1.2, spd: -5 },   size: 0.95 },
    cultist:  { name: 'Cultist',   cls: 'warlock',     plan: 'humanoid', mult: { hp: 0.95, atk: 1.0, def: 0.95, spd: 0 },  size: 1.0, humanoid: true },
    knight:   { name: 'Dread Knight', cls: 'knight',   plan: 'humanoid', mult: { hp: 1.1, atk: 0.95, def: 1.1, spd: -2 },  size: 1.0, humanoid: true },
};
export const SPECIES_IDS = Object.keys(SPECIES);

export const BOSSES = {
    thornmaw:  { name: 'Thornmaw, Elder Treant',   plan: 'treant',   cls: 'druid',     element: 'wind',  size: 1.9 },
    pyrrhax:   { name: 'Pyrrhax the Cinder Wyrm',  plan: 'dragon',   cls: 'mage',      element: 'fire',  size: 1.8 },
    corallia:  { name: 'Corallia, Kraken Queen',   plan: 'kraken',   cls: 'warlock',   element: 'water', size: 1.8 },
    aurex:     { name: 'Aurex, the Sun Colossus',  plan: 'golem',    cls: 'paladin',   element: 'light', size: 2.0 },
    hollowking:{ name: 'The Hollow King',          plan: 'lich',     cls: 'necromancer', element: 'dark', size: 1.6 },
    rimefang:  { name: 'Rimefang, Winter Alpha',   plan: 'wolf',     cls: 'assassin',  element: 'water', size: 2.0 },
    prisma:    { name: 'Prisma, Crystal Matriarch', plan: 'spider',  cls: 'mage',      element: 'light', size: 1.9 },
    vaelzor:   { name: 'Vael\'zor the Usurper',    plan: 'usurper',  cls: 'warlock',   element: 'dark',  size: 1.7 },
};

export const REGIONS = [
    { id: 'verdant', name: 'Verdant Vale', element: 'wind', boss: 'thornmaw', species: ['slime', 'wolf', 'goblin', 'mushroom'], elements: ['wind', 'wind', 'water', 'fire'],
      biome: { ground: '#6fbf4a', ground2: '#4f9a36', sky: ['#8fd3ff', '#e8f7ff'], fog: '#cfeeff', props: ['tree', 'tree', 'bush', 'rock', 'flower'], particles: 'pollen' },
      blurb: 'Rolling meadows where the first sigil-shards fell.' },
    { id: 'ember', name: 'Emberfall Crags', element: 'fire', boss: 'pyrrhax', species: ['imp', 'golem', 'whelp', 'goblin'], elements: ['fire', 'fire', 'wind', 'dark'],
      biome: { ground: '#5a3a30', ground2: '#3a2420', sky: ['#ff8a4a', '#2a1020'], fog: '#5a2a20', props: ['rock', 'spire', 'lava', 'deadtree'], particles: 'embers' },
      blurb: 'Volcanic crags where the earth still bleeds fire.' },
    { id: 'tide', name: 'Tidewater Coast', element: 'water', boss: 'corallia', species: ['crab', 'slime', 'harpy', 'wisp'], elements: ['water', 'water', 'fire', 'light'],
      biome: { ground: '#d8c088', ground2: '#b89a62', sky: ['#3aa8f0', '#cff4ff'], fog: '#a8dcf4', props: ['palm', 'coral', 'rock', 'shell'], particles: 'bubbles' },
      blurb: 'White sands and drowned shrines under a restless sea.' },
    { id: 'sunspire', name: 'Sunspire Steppe', element: 'light', boss: 'aurex', species: ['golem', 'wisp', 'harpy', 'skeleton'], elements: ['light', 'light', 'wind', 'fire'],
      biome: { ground: '#e8c870', ground2: '#c8a050', sky: ['#ffd88a', '#fff6dc'], fog: '#ffe8b0', props: ['pillar', 'ruin', 'rock', 'bush'], particles: 'motes' },
      blurb: 'Golden ruins of the sun-kings, guarded still.' },
    { id: 'gloom', name: 'Gloomwood', element: 'dark', boss: 'hollowking', species: ['skeleton', 'spider', 'mushroom', 'cultist'], elements: ['dark', 'dark', 'water', 'wind'],
      biome: { ground: '#3a3a4a', ground2: '#2a2838', sky: ['#3a2a5a', '#0a0814'], fog: '#2a2040', props: ['deadtree', 'gravestone', 'mushroomBig', 'rock'], particles: 'wisps' },
      blurb: 'A forest that forgot the sun. Something wears a crown here.' },
    { id: 'frost', name: 'Frostpeak Pass', element: 'water', boss: 'rimefang', species: ['wolf', 'golem', 'harpy', 'slime'], elements: ['water', 'wind', 'water', 'light'],
      biome: { ground: '#e8f4ff', ground2: '#b8d0ea', sky: ['#9ab8e0', '#f0f8ff'], fog: '#dceeff', props: ['pine', 'pine', 'icecrystal', 'rock'], particles: 'snow' },
      blurb: 'A mountain pass where the wind has teeth.' },
    { id: 'crystal', name: 'Prismatic Caverns', element: 'light', boss: 'prisma', species: ['spider', 'golem', 'wisp', 'imp'], elements: ['light', 'dark', 'water', 'fire'],
      biome: { ground: '#3a3060', ground2: '#2a2048', sky: ['#4a3a8a', '#100a24'], fog: '#3a2a6a', props: ['crystal', 'crystal', 'rock', 'mushroomBig'], particles: 'sparkles' },
      blurb: 'Caverns of singing crystal, every surface a mirror.' },
    { id: 'throne', name: 'The Shattered Throne', element: 'dark', boss: 'vaelzor', species: ['knight', 'cultist', 'imp', 'whelp'], elements: ['dark', 'fire', 'light', 'water'],
      biome: { ground: '#2a2030', ground2: '#1a1420', sky: ['#5a1a3a', '#0a0410'], fog: '#3a1a30', props: ['pillar', 'ruin', 'brazier', 'spire'], particles: 'embers' },
      blurb: 'The broken seat of the old Sigil Throne. The Usurper waits.' },
];
export const STAGES_PER_REGION = 8;
export const TOTAL_STAGES = REGIONS.length * STAGES_PER_REGION;

export const RIFTS = {
    fire:  { name: 'Hall of Cinders',  kind: 'essence', element: 'fire',  species: ['imp', 'whelp', 'golem'] },
    water: { name: 'Hall of Tides',    kind: 'essence', element: 'water', species: ['slime', 'crab', 'wisp'] },
    wind:  { name: 'Hall of Gales',    kind: 'essence', element: 'wind',  species: ['harpy', 'wolf', 'mushroom'] },
    light: { name: 'Hall of Dawn',     kind: 'essence', element: 'light', species: ['wisp', 'golem', 'harpy'] },
    dark:  { name: 'Hall of Dusk',     kind: 'essence', element: 'dark',  species: ['skeleton', 'spider', 'imp'] },
    gold:  { name: 'Gilded Vault',     kind: 'gold',    element: null,    species: ['goblin', 'golem', 'imp'] },
    gear:  { name: 'The Armory',       kind: 'gear',    element: null,    species: ['knight', 'skeleton', 'golem'] },
};
export const RIFT_TIERS = 10;

export const BLESSINGS = [
    { id: 'might',   name: 'Spire Might',     desc: '+{v}% ATK',                     key: 'atkP', vals: [0.06, 0.1, 0.16] },
    { id: 'vital',   name: 'Spire Vitality',  desc: '+{v}% HP',                      key: 'hpP',  vals: [0.08, 0.13, 0.2] },
    { id: 'ward',    name: 'Spire Ward',      desc: '+{v}% DEF',                     key: 'defP', vals: [0.08, 0.13, 0.2] },
    { id: 'haste',   name: 'Windstep',        desc: '+{v} SPD',                      key: 'spd',  vals: [3, 5, 8] },
    { id: 'keen',    name: 'Hawk Sight',      desc: '+{v}% Crit Rate',               key: 'cr',   vals: [0.04, 0.07, 0.1] },
    { id: 'ruin',    name: 'Ruinous Edge',    desc: '+{v}% Crit Damage',             key: 'cd',   vals: [0.1, 0.16, 0.25] },
    { id: 'start',   name: 'Head Start',      desc: 'Start each wave with +{v}% ATB', key: 'openAtb', vals: [0.1, 0.18, 0.28] },
    { id: 'mend',    name: 'Spring of Life',  desc: 'Heal {v}% HP each turn',        key: 'regen', vals: [0.02, 0.035, 0.05] },
    { id: 'slayer',  name: 'Giantslayer',     desc: '+{v}% damage to bosses',        key: 'bossDmg', vals: [0.12, 0.2, 0.3] },
    { id: 'leech',   name: 'Blood Pact',      desc: 'Heal for {v}% of damage dealt', key: 'lifesteal', vals: [0.05, 0.09, 0.14] },
    { id: 'mana',    name: 'Sigil Surge',     desc: '+{v}% Overlord mana gain',      key: 'mana', vals: [0.15, 0.25, 0.4] },
    { id: 'resist',  name: 'Stoic Heart',     desc: '+{v}% Resistance',              key: 'res',  vals: [0.08, 0.13, 0.2] },
];
export const BLESSING_RARITY = [
    { name: 'Common', color: '#b9c2cc', w: 60 },
    { name: 'Rare', color: '#53b4ff', w: 30 },
    { name: 'Epic', color: '#c879ff', w: 10 },
];

export const EXPEDITION = {
    adj: ['Whispering', 'Sunken', 'Forgotten', 'Crimson', 'Hollow', 'Silver', 'Ashen', 'Moonlit', 'Thorned', 'Gilded', 'Drowned', 'Shrouded', 'Starfallen', 'Howling', 'Amber', 'Frozen'],
    noun: ['Hollow', 'Ruins', 'Grotto', 'Spire', 'Marsh', 'Barrow', 'Glade', 'Catacombs', 'Pass', 'Observatory', 'Shrine', 'Mines', 'Archive', 'Reef', 'Orchard', 'Battlefield'],
    durations: [15, 30, 60, 120, 240, 480],
    events: [
        'stumbled on a hidden shrine and left an offering.',
        'outwitted a band of goblin smugglers.',
        'mapped a passage nobody had walked in a century.',
        'helped a lost merchant find the road home.',
        'found an abandoned camp with supplies still in it.',
        'drove off a wyvern nesting in the ruins.',
        'solved the riddle of a talking door.',
        'traded stories with a wandering spirit.',
        'pulled a chest out of a flooded cellar.',
        'followed glowing moths to a forgotten vault.',
        'waited out a storm in a cave full of crystals.',
        'rescued a farmer\'s prize goat. It followed them for a mile.',
    ],
    fail: [
        'were turned back by a rockslide.',
        'got hopelessly lost in the fog.',
        'were chased off by something far too large.',
        'found the vault already looted.',
    ],
};

export const TALENTS = {
    might:       { name: 'Might',       desc: '+2% ATK to all heroes per rank',               per: 0.02, icon: 'sword' },
    fortitude:   { name: 'Fortitude',   desc: '+2% HP to all heroes per rank',                per: 0.02, icon: 'heart' },
    bastion:     { name: 'Bastion',     desc: '+2% DEF to all heroes per rank',               per: 0.02, icon: 'shield' },
    celerity:    { name: 'Celerity',    desc: '+1 SPD to all heroes per rank',                per: 1, icon: 'boots' },
    fortune:     { name: 'Fortune',     desc: '+4% gold and +1% drop chance per rank',        per: 0.04, icon: 'coin' },
    sovereignty: { name: 'Sovereignty', desc: '+6% Overlord spell power and mana per rank',   per: 0.06, icon: 'crown' },
};
export const TALENT_MAX = 10;

export const SPELLS = {
    smite:  { name: 'Smite',        level: 1,  cost: 50, tgt: 'enemy',   desc: '450% team ATK to one enemy and removes a buff', color: '#ffe27a' },
    rally:  { name: 'Rally',        level: 3,  cost: 60, tgt: 'none',    desc: 'Heal allies 22% HP and grant ATK Up for 2 turns', color: '#7be08a' },
    haste:  { name: 'Time Warp',    level: 6,  cost: 55, tgt: 'none',    desc: 'All allies gain 35% ATB', color: '#7cf0e0' },
    meteor: { name: 'Meteor',       level: 10, cost: 80, tgt: 'none',    desc: '260% team ATK to all enemies, 60% chance to Burn', color: '#ff7a3a' },
    aegis:  { name: 'Aegis',        level: 15, cost: 70, tgt: 'none',    desc: 'Shield allies for 20% HP and grant Immunity for 1 turn', color: '#9fe7ff' },
    doom:   { name: 'Doom',         level: 20, cost: 80, tgt: 'none',    desc: 'DEF Break and Slow on all enemies for 2 turns', color: '#b07aff' },
};
export const SPELL_IDS = Object.keys(SPELLS);
export const OVERLORD_MAX_LEVEL = 60;

export const BUILDINGS = {
    treasury: { name: 'Treasury',          max: 10, desc: 'Idle gold, XP and loot accrue here while you are away.' },
    mine:     { name: 'Mine',              max: 10, desc: 'More pick energy, faster regen, more miners, richer idle ore.' },
    farm:     { name: 'Farm',              max: 10, desc: 'More plots and faster growth.' },
    forge:    { name: 'Forge',             max: 10, desc: 'Better crafting odds and cheaper enhancing.' },
    training: { name: 'Training Grounds',  max: 10, desc: 'More training slots and more XP per minute.' },
    tavern:   { name: 'Tavern',            max: 10, desc: 'More expedition slots and a bigger board.' },
};
export const BUILDING_ORE = ['copper', 'copper', 'iron', 'iron', 'silver', 'gold', 'mithril', 'adamant', 'starmetal', 'starmetal'];

export const ARENA_RANKS = [
    { name: 'Bronze', min: 0, color: '#cd8a52' },
    { name: 'Silver', min: 1100, color: '#c8d4e0' },
    { name: 'Gold', min: 1300, color: '#ffd24a' },
    { name: 'Platinum', min: 1550, color: '#7fe0e0' },
    { name: 'Diamond', min: 1800, color: '#9fb8ff' },
    { name: 'Legend', min: 2100, color: '#ff5d8f' },
];

export const OVERLORD_TITLES = [
    'Novice Summoner', 'Sigil Adept', 'Warden of the Vale', 'Spirebreaker', 'Hoardkeeper', 'Arena Tyrant',
    'Master Delver', 'Harvest Lord', 'Radiant Collector', 'Throne Reclaimer', 'Mythmaker',
];

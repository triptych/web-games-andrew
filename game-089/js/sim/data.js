// Dragonroll — the content tables. Pure data: heroes, companions, skills, monsters, gear, items,
// recipes and fate cards. The rules live in game.js and battle.js; numbers that tune the whole
// game live in ../config.js.

export const ELEMENTS = ['fire', 'frost', 'storm', 'holy'];
export const ELEMENT_ICON = { fire: '🔥', frost: '❄️', storm: '⚡', holy: '✨' };

// ================================================================== regions
export const REGIONS = [
    { id: 'meadow', name: 'Meadowvale', tier: 0, color: '#7bd36a', blurb: 'Rolling hills, orchards and windmills' },
    { id: 'woods', name: 'Whisperwood', tier: 1, color: '#3fa46a', blurb: 'An old forest of giant mushrooms and fireflies' },
    { id: 'coast', name: 'Glimmer Coast', tier: 2, color: '#3ec6d8', blurb: 'White sand, coral and a pirate lighthouse' },
    { id: 'frost', name: 'Frostfang Peaks', tier: 3, color: '#9fd6ff', blurb: 'Snowfields, ice caves and a dwarven forge' },
];

// ================================================================== heroes (you pick one)
// base = level 1, grow = per level. Weapons: the kinds the member can hold.
export const CLASSES = {
    knight: {
        name: 'Knight', title: 'the Bold', role: 'Tough front-liner with shield skills',
        base: { hp: 66, mp: 12, atk: 12, def: 11, mag: 4, res: 6, spd: 8 },
        grow: { hp: 12, mp: 1.8, atk: 2.4, def: 2.1, mag: 0.6, res: 1.2, spd: 0.55 },
        weapons: ['blade', 'hammer'], start: { weapon: 'blade1', armor: 'armor1' },
        skills: ['bash', 'rally', 'valor', 'cleave', 'radiant'], burst: 'lionheart',
        look: { skin: '#ffd9b8', hair: '#8a4a22', outfit: '#3a6fd8', trim: '#ffd25a', cape: '#d83a3a', helm: true },
    },
    ranger: {
        name: 'Ranger', title: 'the Swift', role: 'Fast archer: many hits and critical shots',
        base: { hp: 52, mp: 16, atk: 11, def: 7, mag: 6, res: 7, spd: 12 },
        grow: { hp: 9.5, mp: 2.4, atk: 2.3, def: 1.4, mag: 1, res: 1.3, spd: 1 },
        weapons: ['bow', 'blade'], start: { weapon: 'bow1', armor: 'armor1' },
        skills: ['twin', 'snare', 'volley', 'thunder', 'eagle'], burst: 'starfall',
        look: { skin: '#f5c9a0', hair: '#e8b04a', outfit: '#3a9a4a', trim: '#8a5a2a', cape: '#2a6a3a', hood: true },
    },
    mage: {
        name: 'Mage', title: 'the Wise', role: 'Spells of fire, frost and lightning',
        base: { hp: 44, mp: 26, atk: 6, def: 6, mag: 13, res: 10, spd: 9 },
        grow: { hp: 8, mp: 3.8, atk: 1, def: 1.1, mag: 2.6, res: 2, spd: 0.7 },
        weapons: ['staff'], start: { weapon: 'staff1', armor: 'armor1' },
        skills: ['fire', 'frost', 'bolt', 'ward', 'meteor'], burst: 'cataclysm',
        look: { skin: '#ffe0c8', hair: '#f4f4ff', outfit: '#7a4ad8', trim: '#ffd25a', cape: '#3a2a8a', wizardHat: true },
    },
};

// ================================================================== companions (hired at taverns)
export const COMPANIONS = {
    pip: {
        name: 'Pip Thistledown', short: 'Pip', town: 'brookhollow', cost: 120, role: 'Halfling cleric: healing and holy light',
        base: { hp: 46, mp: 24, atk: 7, def: 7, mag: 11, res: 11, spd: 10 },
        grow: { hp: 8.5, mp: 3.4, atk: 1.2, def: 1.3, mag: 2.2, res: 2, spd: 0.8 },
        weapons: ['staff', 'hammer'], start: { weapon: 'staff1', armor: 'armor1' },
        skills: ['mend', 'smite', 'purify', 'prayer', 'revive', 'bless'], burst: 'sanctuary',
        look: { skin: '#ffd6b0', hair: '#c86a2a', outfit: '#f4f0e0', trim: '#ffd25a', cape: '#5ab0f0', small: true, curls: true },
        line: '"Oh! A real adventure? I\'ll fetch my good socks."',
    },
    sylva: {
        name: 'Sylva Moonleaf', short: 'Sylva', town: 'fernwick', cost: 200, role: 'Elven druid archer: thorns, regrowth, moonlight',
        base: { hp: 44, mp: 20, atk: 10, def: 6, mag: 10, res: 9, spd: 13 },
        grow: { hp: 8.2, mp: 3, atk: 2.1, def: 1.2, mag: 2, res: 1.7, spd: 1.1 },
        weapons: ['bow'], start: { weapon: 'bow1', armor: 'armor1' },
        skills: ['thorn', 'regrow', 'moonshot', 'entangle'], burst: 'wildhunt',
        look: { skin: '#f8e0c8', hair: '#bfe86a', outfit: '#2a8a5a', trim: '#e8d890', cape: '#6ac08a', elf: true, longHair: true },
        line: '"The forest says you\'re kind. The forest is rarely wrong."',
    },
    bram: {
        name: 'Captain Bram Barnacle', short: 'Bram', town: 'saltbreeze', cost: 260, role: 'Pirate brawler: cutlass flurries and cannon fire',
        base: { hp: 64, mp: 10, atk: 13, def: 8, mag: 4, res: 5, spd: 9 },
        grow: { hp: 12, mp: 1.5, atk: 2.6, def: 1.7, mag: 0.5, res: 1, spd: 0.8 },
        weapons: ['blade'], start: { weapon: 'blade1', armor: 'armor1' },
        skills: ['flurry', 'grog', 'cannon', 'shanty'], burst: 'broadside',
        look: { skin: '#d9a070', hair: '#2a1a14', outfit: '#c83a3a', trim: '#ffd25a', cape: '#2a2a4a', beard: '#2a1a14', pirateHat: true, eyepatch: true },
        line: '"Slay a dragon? Har! I\'ve wrestled worse at breakfast."',
    },
    grumli: {
        name: 'Grumli Stoneboots', short: 'Grumli', town: 'hammerhold', cost: 320, role: 'Dwarf rune-smith: frost runes and stone skin',
        base: { hp: 60, mp: 14, atk: 11, def: 12, mag: 7, res: 8, spd: 7 },
        grow: { hp: 11, mp: 2, atk: 2.2, def: 2.3, mag: 1.2, res: 1.5, spd: 0.5 },
        weapons: ['hammer'], start: { weapon: 'hammer1', armor: 'armor1' },
        skills: ['rune', 'stone', 'quake', 'imbue'], burst: 'mountain',
        look: { skin: '#f0b890', hair: '#e86a2a', outfit: '#6a5a4a', trim: '#c8c8d8', cape: '#3a5a8a', beard: '#e86a2a', small: true, horns: true, wide: true },
        line: '"Frost runes. Dragons hate \'em. That\'s why I carve \'em."',
    },
};

// ================================================================== skills
// kind: phys | mag | heal | buff | revive | cure | debuff
// target: enemy | enemies | random (a random enemy per hit) | ally | allies | self | ko (a fallen ally)
export const SKILLS = {
    // ---- knight
    bash: { name: 'Shield Bash', mp: 4, kind: 'phys', power: 1.3, target: 'enemy', status: { id: 'stun', chance: 0.35, turns: 1 }, lv: 1, fx: 'bash', desc: 'Strike with your shield. May stun.' },
    rally: { name: 'Rally', mp: 6, kind: 'buff', target: 'allies', buffs: [{ id: 'defUp', turns: 3 }], lv: 3, fx: 'rally', desc: 'Raise the whole party\'s defence.' },
    valor: { name: 'Valor Strike', mp: 8, kind: 'phys', power: 2.2, target: 'enemy', lv: 6, fx: 'slashBig', desc: 'A mighty two-handed blow.' },
    cleave: { name: 'Whirlwind', mp: 10, kind: 'phys', power: 1.15, target: 'enemies', lv: 10, fx: 'whirl', desc: 'Spin and hit every enemy.' },
    radiant: { name: 'Radiant Blade', mp: 14, kind: 'phys', power: 2.7, target: 'enemy', element: 'holy', lv: 15, fx: 'holySlash', desc: 'A blade of holy light.' },
    // ---- ranger
    twin: { name: 'Twin Shot', mp: 4, kind: 'phys', power: 0.85, hits: 2, target: 'enemy', lv: 1, fx: 'arrow', desc: 'Two arrows, one after the other.' },
    snare: { name: 'Snare Arrow', mp: 5, kind: 'phys', power: 1.0, target: 'enemy', status: { id: 'slow', chance: 0.8, turns: 3 }, lv: 3, fx: 'arrow', desc: 'Pins the foot. Slows the target.' },
    volley: { name: 'Arrow Rain', mp: 9, kind: 'phys', power: 0.95, target: 'enemies', lv: 6, fx: 'rain', desc: 'Arrows fall on every enemy.' },
    thunder: { name: 'Thunder Arrow', mp: 11, kind: 'phys', power: 2.1, target: 'enemy', element: 'storm', lv: 10, fx: 'bolt', desc: 'An arrow wrapped in lightning.' },
    eagle: { name: 'Eagle Eye', mp: 8, kind: 'buff', target: 'self', buffs: [{ id: 'critUp', turns: 4 }, { id: 'atkUp', turns: 4 }], lv: 15, fx: 'rally', desc: 'Focus: more power and critical hits.' },
    // ---- mage
    fire: { name: 'Fireball', mp: 4, kind: 'mag', power: 1.55, target: 'enemy', element: 'fire', lv: 1, fx: 'fireball', desc: 'A ball of fire.' },
    frost: { name: 'Frost Nova', mp: 7, kind: 'mag', power: 1.0, target: 'enemies', element: 'frost', status: { id: 'slow', chance: 0.3, turns: 2 }, lv: 3, fx: 'nova', desc: 'Ice bursts round every enemy. May slow.' },
    bolt: { name: 'Chain Lightning', mp: 9, kind: 'mag', power: 1.3, target: 'enemies', element: 'storm', lv: 6, fx: 'bolt', desc: 'Lightning leaps between enemies.' },
    ward: { name: 'Arcane Ward', mp: 8, kind: 'buff', target: 'allies', buffs: [{ id: 'resUp', turns: 3 }, { id: 'defUp', turns: 3 }], lv: 10, fx: 'ward', desc: 'A shimmering shield over the party.' },
    meteor: { name: 'Meteor', mp: 18, kind: 'mag', power: 2.25, target: 'enemies', element: 'fire', lv: 15, fx: 'meteor', desc: 'Call down a burning star.' },
    // ---- pip
    mend: { name: 'Mend', mp: 4, kind: 'heal', power: 1.7, target: 'ally', lv: 1, fx: 'heal', desc: 'Heal one ally.' },
    smite: { name: 'Smite', mp: 5, kind: 'mag', power: 1.45, target: 'enemy', element: 'holy', lv: 1, fx: 'holy', desc: 'A column of holy light.' },
    purify: { name: 'Purify', mp: 3, kind: 'cure', target: 'ally', lv: 2, fx: 'heal', desc: 'Cure poison, burns, slow and stun.' },
    prayer: { name: 'Prayer', mp: 9, kind: 'heal', power: 1.0, target: 'allies', lv: 4, fx: 'healAll', desc: 'Heal the whole party.' },
    revive: { name: 'Revive', mp: 12, kind: 'revive', power: 0.4, target: 'ko', lv: 7, fx: 'revive', desc: 'Raise a fallen ally.' },
    bless: { name: 'Blessing', mp: 8, kind: 'buff', target: 'allies', buffs: [{ id: 'atkUp', turns: 3 }], lv: 11, fx: 'rally', desc: 'The party hits harder.' },
    // ---- sylva
    thorn: { name: 'Thorn Volley', mp: 6, kind: 'phys', power: 0.85, target: 'enemies', status: { id: 'poison', chance: 0.35, turns: 3 }, lv: 1, fx: 'rain', desc: 'Thorny arrows on every enemy. May poison.' },
    regrow: { name: 'Regrowth', mp: 6, kind: 'buff', target: 'allies', buffs: [{ id: 'regen', turns: 3 }], lv: 2, fx: 'healAll', desc: 'The party heals a little each turn.' },
    moonshot: { name: 'Moonshot', mp: 7, kind: 'phys', power: 1.9, target: 'enemy', element: 'holy', lv: 5, fx: 'holy', desc: 'An arrow of moonlight.' },
    entangle: { name: 'Vine Snare', mp: 7, kind: 'debuff', target: 'enemies', status: { id: 'slow', chance: 0.75, turns: 3 }, lv: 9, fx: 'vines', desc: 'Vines slow every enemy.' },
    // ---- bram
    flurry: { name: 'Cutlass Flurry', mp: 5, kind: 'phys', power: 0.62, hits: 3, target: 'random', lv: 1, fx: 'slash', desc: 'Three slashes at random enemies.' },
    grog: { name: 'Swig o\' Grog', mp: 4, kind: 'heal', power: 0.3, pct: true, target: 'self', buffs: [{ id: 'atkUp', turns: 3 }], lv: 2, fx: 'heal', desc: 'Heal yourself and hit harder.' },
    cannon: { name: 'Cannonball', mp: 9, kind: 'phys', power: 1.55, target: 'enemies', element: 'fire', lv: 6, fx: 'cannon', desc: 'Boom. Every enemy.' },
    shanty: { name: 'Sea Shanty', mp: 8, kind: 'buff', target: 'allies', buffs: [{ id: 'haste', turns: 3 }], lv: 10, fx: 'rally', desc: 'A rousing song: the party acts faster.' },
    // ---- grumli
    rune: { name: 'Rune Hammer', mp: 5, kind: 'phys', power: 1.6, target: 'enemy', element: 'frost', lv: 1, fx: 'rune', desc: 'A hammer blow with a frost rune.' },
    stone: { name: 'Stoneskin', mp: 6, kind: 'buff', target: 'allies', buffs: [{ id: 'defUp', turns: 3 }], lv: 3, fx: 'ward', desc: 'The party\'s skin turns to stone.' },
    quake: { name: 'Earthquake', mp: 9, kind: 'phys', power: 1.15, target: 'enemies', status: { id: 'stun', chance: 0.15, turns: 1 }, lv: 6, fx: 'quake', desc: 'Shake every enemy. May stun.' },
    imbue: { name: 'Rune of Frost', mp: 8, kind: 'buff', target: 'allies', buffs: [{ id: 'imbue', turns: 4 }], lv: 11, fx: 'rune', desc: 'The party\'s weapons strike with frost.' },
};

// Bursts: one per member, usable when the party's Valor gauge is full.
export const BURSTS = {
    lionheart: { name: 'Lionheart', kind: 'phys', power: 3.6, target: 'enemies', element: 'holy', fx: 'burstHoly', desc: 'A blazing charge through every foe.' },
    starfall: { name: 'Starfall Barrage', kind: 'phys', power: 1.15, hits: 7, target: 'random', fx: 'burstStars', desc: 'Seven star-arrows.' },
    cataclysm: { name: 'Arcane Cataclysm', kind: 'mag', power: 3.4, target: 'enemies', fx: 'burstArcane', desc: 'Raw magic tears through the field.' },
    sanctuary: { name: 'Sanctuary', kind: 'heal', power: 1, pct: true, target: 'allies', revive: true, fx: 'burstHeal', desc: 'Fully heal and raise the whole party.' },
    wildhunt: { name: 'Wild Hunt', kind: 'phys', power: 3.0, target: 'enemies', buffs: [{ id: 'regen', turns: 3 }], fx: 'burstWild', desc: 'Spirit wolves charge; the party regrows.' },
    broadside: { name: 'Broadside', kind: 'phys', power: 3.2, target: 'enemies', element: 'fire', fx: 'burstCannon', desc: 'A ghost ship fires every cannon.' },
    mountain: { name: 'Mountain\'s Wrath', kind: 'phys', power: 3.4, target: 'enemies', element: 'frost', fx: 'burstFrost', desc: 'A glacier falls from the sky.' },
};

export const STATUS = {
    poison: { name: 'Poison', icon: '☠️', bad: true },
    burn: { name: 'Burn', icon: '🔥', bad: true },
    stun: { name: 'Stun', icon: '💫', bad: true },
    slow: { name: 'Slow', icon: '🐌', bad: true },
    weak: { name: 'Weakened', icon: '💧', bad: true },
    haste: { name: 'Haste', icon: '💨' },
    atkUp: { name: 'Power', icon: '⚔️' },
    defUp: { name: 'Guard', icon: '🛡️' },
    resUp: { name: 'Ward', icon: '🔮' },
    regen: { name: 'Regen', icon: '🌿' },
    imbue: { name: 'Frost Rune', icon: '❄️' },
    critUp: { name: 'Focus', icon: '🎯' },
};

// ================================================================== monsters
// Stats at level 1; battle.js scales them by level. model: the view's archetype and colours.
export const ESKILLS = {
    hit: { name: 'Attack', kind: 'phys', power: 1.0, target: 'one', fx: 'claw' },
    tackle: { name: 'Bounce', kind: 'phys', power: 1.0, target: 'one', fx: 'bump' },
    goo: { name: 'Sticky Goo', kind: 'phys', power: 0.6, target: 'one', status: { id: 'slow', chance: 0.6, turns: 2 }, fx: 'goo' },
    stab: { name: 'Rusty Stab', kind: 'phys', power: 1.1, target: 'one', fx: 'claw' },
    pilfer: { name: 'Pilfer', kind: 'phys', power: 0.6, target: 'one', steal: true, fx: 'claw' },
    charge: { name: 'Charge', kind: 'phys', power: 1.45, target: 'one', fx: 'bump' },
    sting: { name: 'Sting', kind: 'phys', power: 0.8, target: 'one', status: { id: 'poison', chance: 0.6, turns: 3 }, fx: 'claw' },
    spores: { name: 'Spore Puff', kind: 'mag', power: 0.55, target: 'all', status: { id: 'poison', chance: 0.35, turns: 3 }, fx: 'spores' },
    spark: { name: 'Spark', kind: 'mag', power: 1.2, target: 'one', element: 'storm', fx: 'zap' },
    web: { name: 'Web Spit', kind: 'phys', power: 0.5, target: 'one', status: { id: 'slow', chance: 0.8, turns: 2 }, fx: 'goo' },
    slam: { name: 'Slam', kind: 'phys', power: 1.35, target: 'one', fx: 'bump' },
    pinch: { name: 'Pinch', kind: 'phys', power: 1.2, target: 'one', fx: 'claw' },
    shell: { name: 'Hunker', kind: 'buff', buff: 'defUp', fx: 'shield' },
    rattle: { name: 'Bone Rattle', kind: 'buff', buff: 'atkUp', fx: 'shield' },
    gust: { name: 'Gale', kind: 'mag', power: 0.75, target: 'all', element: 'storm', fx: 'gust' },
    zap: { name: 'Shock', kind: 'mag', power: 1.3, target: 'one', element: 'storm', fx: 'zap' },
    shard: { name: 'Ice Shard', kind: 'mag', power: 1.25, target: 'one', element: 'frost', fx: 'iceShard' },
    howl: { name: 'Howl', kind: 'buff', buff: 'atkUp', fx: 'roar' },
    bite: { name: 'Bite', kind: 'phys', power: 1.25, target: 'one', fx: 'claw' },
    maul: { name: 'Maul', kind: 'phys', power: 1.5, target: 'one', fx: 'bump' },
    freeze: { name: 'Freeze', kind: 'mag', power: 0.6, target: 'one', element: 'frost', status: { id: 'stun', chance: 0.4, turns: 1 }, fx: 'iceShard' },
    // bosses
    royal: { name: 'Royal Smash', kind: 'phys', power: 1.6, target: 'one', fx: 'bump' },
    guards: { name: 'Call the Guards', kind: 'summon', summon: 'goblin', fx: 'roar' },
    feast: { name: 'Greedy Feast', kind: 'heal', power: 0.15, fx: 'heal' },
    roots: { name: 'Root Crush', kind: 'phys', power: 1.5, target: 'one', fx: 'roots' },
    sporeStorm: { name: 'Spore Storm', kind: 'mag', power: 0.8, target: 'all', status: { id: 'poison', chance: 0.5, turns: 3 }, fx: 'spores' },
    bloom: { name: 'Regrowth', kind: 'heal', power: 0.12, fx: 'heal' },
    tentacles: { name: 'Tentacle Lash', kind: 'phys', power: 0.7, target: 'all', fx: 'lash' },
    ink: { name: 'Ink Cloud', kind: 'debuff', target: 'all', status: { id: 'weak', chance: 0.7, turns: 2 }, fx: 'ink' },
    tidal: { name: 'Tidal Wave', kind: 'mag', power: 1.1, target: 'all', element: 'frost', fx: 'wave' },
    glacier: { name: 'Glacier Fist', kind: 'phys', power: 1.7, target: 'one', fx: 'bump' },
    blizzard: { name: 'Blizzard', kind: 'mag', power: 1.0, target: 'all', element: 'frost', status: { id: 'slow', chance: 0.3, turns: 2 }, fx: 'blizzard' },
    iceArmor: { name: 'Ice Armor', kind: 'buff', buff: 'defUp', fx: 'shield' },
    // the dragon
    claw: { name: 'Rending Claws', kind: 'phys', power: 1.35, target: 'one', fx: 'claw' },
    tail: { name: 'Tail Sweep', kind: 'phys', power: 0.85, target: 'all', fx: 'lash' },
    breath: { name: 'Fire Breath', kind: 'mag', power: 1.05, target: 'all', element: 'fire', status: { id: 'burn', chance: 0.35, turns: 3 }, fx: 'breath' },
    inferno: { name: 'INFERNO', kind: 'mag', power: 1.55, target: 'all', element: 'fire', status: { id: 'burn', chance: 0.5, turns: 3 }, fx: 'inferno' },
    roar: { name: 'Molten Roar', kind: 'debuff', target: 'all', status: { id: 'weak', chance: 0.6, turns: 2 }, fx: 'roar' },
    whelps: { name: 'Hatch Whelps', kind: 'summon', summon: 'whelp', count: 2, fx: 'roar' },
    ember: { name: 'Ember Spit', kind: 'mag', power: 1.0, target: 'one', element: 'fire', fx: 'fireball' },
};

export const MONSTERS = {
    // ---- Meadowvale
    slime: { name: 'Jellybounce Slime', region: 'meadow', base: { hp: 30, atk: 8, def: 4, mag: 5, res: 4, spd: 7 }, weak: ['fire'], skills: [['tackle', 3], ['goo', 1]], drops: [['jelly', 0.55]], xp: 9, gold: 9, model: { type: 'slime', color: '#6ae86a', color2: '#c8ffb0' } },
    goblin: { name: 'Goblin Scrapper', region: 'meadow', base: { hp: 36, atk: 10, def: 6, mag: 3, res: 4, spd: 9 }, weak: ['holy'], skills: [['stab', 3], ['pilfer', 1]], drops: [['scrap', 0.5]], xp: 11, gold: 14, model: { type: 'goblin', color: '#7ac84a', color2: '#8a5a3a', weapon: 'dagger' } },
    boar: { name: 'Thornback Boar', region: 'meadow', base: { hp: 48, atk: 12, def: 8, mag: 2, res: 4, spd: 6 }, weak: ['frost'], skills: [['hit', 2], ['charge', 2]], drops: [['hide', 0.55]], xp: 13, gold: 11, model: { type: 'boar', color: '#a86a4a', color2: '#5a3a2a' } },
    bee: { name: 'Bumble Brute', region: 'meadow', base: { hp: 26, atk: 9, def: 4, mag: 4, res: 5, spd: 13 }, weak: ['fire', 'storm'], skills: [['hit', 2], ['sting', 2]], drops: [['jelly', 0.3]], xp: 10, gold: 10, model: { type: 'bee', color: '#ffd03a', color2: '#2a2a2a' } },
    // ---- Whisperwood
    shroom: { name: 'Shroomling', region: 'woods', base: { hp: 40, atk: 9, def: 6, mag: 10, res: 7, spd: 8 }, weak: ['fire'], skills: [['hit', 2], ['spores', 2]], drops: [['cap', 0.55]], xp: 12, gold: 12, model: { type: 'shroom', color: '#e84a4a', color2: '#fff0d8' } },
    wisp: { name: 'Will-o\'-Wisp', region: 'woods', base: { hp: 30, atk: 6, def: 4, mag: 13, res: 12, spd: 14 }, weak: ['holy'], resist: ['storm'], skills: [['spark', 3], ['hit', 1]], drops: [['cap', 0.25]], xp: 13, gold: 13, model: { type: 'wisp', color: '#6af0ff', color2: '#e0ffff' } },
    spider: { name: 'Webweaver Spider', region: 'woods', base: { hp: 44, atk: 12, def: 7, mag: 4, res: 5, spd: 11 }, weak: ['fire'], skills: [['bite', 3], ['web', 1]], drops: [['silk', 0.55]], xp: 14, gold: 13, model: { type: 'spider', color: '#5a3a8a', color2: '#ff6ab0' } },
    treant: { name: 'Mossy Treant', region: 'woods', base: { hp: 72, atk: 13, def: 12, mag: 6, res: 6, spd: 5 }, weak: ['fire'], resist: ['frost'], skills: [['slam', 3], ['hit', 1]], drops: [['heartwood', 0.5]], xp: 17, gold: 14, model: { type: 'treant', color: '#7a5a3a', color2: '#5ac84a' } },
    // ---- Glimmer Coast
    crab: { name: 'Crusher Crab', region: 'coast', base: { hp: 54, atk: 13, def: 16, mag: 4, res: 6, spd: 7 }, weak: ['storm'], resist: ['fire'], skills: [['pinch', 3], ['shell', 1]], drops: [['pearl', 0.35], ['glass', 0.3]], xp: 15, gold: 16, model: { type: 'crab', color: '#ff6a4a', color2: '#ffd0a0' } },
    skeleton: { name: 'Drowned Deckhand', region: 'coast', base: { hp: 50, atk: 14, def: 9, mag: 4, res: 6, spd: 10 }, weak: ['holy'], skills: [['stab', 3], ['rattle', 1]], drops: [['scrap', 0.4]], xp: 15, gold: 20, model: { type: 'skeleton', color: '#f4f0e0', color2: '#3a6a8a', weapon: 'cutlass', hat: true } },
    harpy: { name: 'Gale Harpy', region: 'coast', base: { hp: 42, atk: 12, def: 7, mag: 11, res: 8, spd: 15 }, weak: ['frost'], skills: [['hit', 2], ['gust', 2]], drops: [['glass', 0.45]], xp: 15, gold: 15, model: { type: 'harpy', color: '#6ac0e8', color2: '#ffe0c8' } },
    eel: { name: 'Volt Eel', region: 'coast', base: { hp: 48, atk: 8, def: 8, mag: 14, res: 10, spd: 12 }, weak: ['frost'], resist: ['storm'], skills: [['zap', 3], ['bite', 1]], drops: [['glass', 0.4], ['pearl', 0.2]], xp: 16, gold: 16, model: { type: 'eel', color: '#3a8ad8', color2: '#ffe84a' } },
    // ---- Frostfang Peaks
    imp: { name: 'Frost Imp', region: 'frost', base: { hp: 46, atk: 10, def: 8, mag: 15, res: 14, spd: 13 }, weak: ['fire'], resist: ['frost'], skills: [['shard', 3], ['hit', 1]], drops: [['crystal', 0.5]], xp: 17, gold: 18, model: { type: 'imp', color: '#8ad8ff', color2: '#ffffff' } },
    wolf: { name: 'Rime Wolf', region: 'frost', base: { hp: 58, atk: 16, def: 10, mag: 4, res: 8, spd: 14 }, weak: ['fire'], resist: ['frost'], skills: [['bite', 3], ['howl', 1]], drops: [['fur', 0.45]], xp: 18, gold: 17, model: { type: 'wolf', color: '#dfe8f4', color2: '#6a8ab0' } },
    yeti: { name: 'Snowpaw Yeti', region: 'frost', base: { hp: 92, atk: 18, def: 13, mag: 4, res: 8, spd: 6 }, weak: ['fire'], resist: ['frost'], skills: [['maul', 3], ['howl', 1]], drops: [['fur', 0.6]], xp: 22, gold: 20, model: { type: 'yeti', color: '#f4f8ff', color2: '#6ab0e8' } },
    golem: { name: 'Ice Golem', region: 'frost', base: { hp: 100, atk: 17, def: 22, mag: 8, res: 10, spd: 4 }, weak: ['fire', 'storm'], resist: ['frost'], skills: [['slam', 3], ['freeze', 1]], drops: [['iron', 0.55], ['crystal', 0.3]], xp: 24, gold: 22, model: { type: 'golem', color: '#9fd6ff', color2: '#4a7ab0' } },
    // ---- treasure
    mimic: { name: 'Mimic', region: 'any', base: { hp: 70, atk: 15, def: 12, mag: 6, res: 10, spd: 10 }, weak: ['holy'], skills: [['bite', 3], ['pilfer', 1]], drops: [['pearl', 0.5]], xp: 22, gold: 40, model: { type: 'mimic', color: '#c8843a', color2: '#ffd25a' } },
    // ---- bosses
    grubnose: { name: 'King Grubnose', region: 'meadow', boss: true, base: { hp: 250, atk: 15, def: 10, mag: 6, res: 8, spd: 9 }, weak: ['holy'], skills: [['royal', 3], ['stab', 2], ['guards', 1], ['feast', 1]], drops: [['scrap', 1], ['hide', 1]], xp: 30, gold: 70, model: { type: 'goblin', color: '#6ab84a', color2: '#8a3ad8', crown: true, scale: 1.8, weapon: 'club' } },
    mossback: { name: 'Mother Mossback', region: 'woods', boss: true, base: { hp: 360, atk: 16, def: 14, mag: 14, res: 10, spd: 6 }, weak: ['fire'], resist: ['frost'], skills: [['roots', 3], ['sporeStorm', 2], ['bloom', 1]], drops: [['heartwood', 2], ['silk', 1]], xp: 33, gold: 90, model: { type: 'treant', color: '#6a4a2a', color2: '#ff8ac8', scale: 1.9, elder: true } },
    brinetooth: { name: 'Queen Brinetooth', region: 'coast', boss: true, base: { hp: 460, atk: 17, def: 14, mag: 16, res: 12, spd: 8 }, weak: ['storm'], resist: ['frost'], skills: [['tentacles', 2], ['pinch', 2], ['ink', 1], ['tidal', 2]], drops: [['pearl', 2], ['glass', 2]], xp: 36, gold: 110, model: { type: 'kraken', color: '#c84ab0', color2: '#ffd0f0', scale: 1.6 } },
    warden: { name: 'The Frost Warden', region: 'frost', boss: true, base: { hp: 580, atk: 20, def: 22, mag: 14, res: 14, spd: 5 }, weak: ['fire'], resist: ['frost'], skills: [['glacier', 3], ['blizzard', 2], ['iceArmor', 1]], drops: [['iron', 2], ['crystal', 2], ['fur', 1]], xp: 40, gold: 130, model: { type: 'golem', color: '#bfe8ff', color2: '#3a6ad8', scale: 1.8, crown: true } },
    // ---- the dragon and its brood
    whelp: { name: 'Ember Whelp', region: 'dragon', base: { hp: 60, atk: 14, def: 10, mag: 14, res: 10, spd: 12 }, weak: ['frost'], resist: ['fire'], skills: [['bite', 2], ['ember', 2]], drops: [], xp: 30, gold: 30, model: { type: 'whelp', color: '#ff6a2a', color2: '#ffd25a' } },
    pyrrhax: { name: 'Pyrrhax the Ember Wyrm', region: 'dragon', boss: true, dragon: true, base: { hp: 720, atk: 18, def: 13, mag: 18, res: 13, spd: 9 }, weak: ['frost'], resist: ['fire'], skills: [['claw', 3], ['tail', 2], ['breath', 2], ['roar', 1]], skills2: [['claw', 2], ['inferno', 2], ['breath', 2], ['tail', 1], ['roar', 1]], drops: [], xp: 0, gold: 0, model: { type: 'dragon' } },
};

/** Each region's random encounter table and its dungeon. */
export const ENCOUNTERS = {
    meadow: ['slime', 'goblin', 'boar', 'bee'],
    woods: ['shroom', 'wisp', 'spider', 'treant'],
    coast: ['crab', 'skeleton', 'harpy', 'eel'],
    frost: ['imp', 'wolf', 'yeti', 'golem'],
};

export const DUNGEONS = {
    warren: { name: 'Goblin Warren', region: 'meadow', boss: 'grubnose', floors: 2, lv: 3, shard: 'shardEmber', blurb: 'Tunnels under the hills, full of stolen pies.' },
    crypt: { name: 'Hollow Oak Crypt', region: 'woods', boss: 'mossback', floors: 2, lv: 7, shard: 'shardVerdant', blurb: 'Roots have swallowed an elven tomb.' },
    grotto: { name: 'Sunken Grotto', region: 'coast', boss: 'brinetooth', floors: 2, lv: 11, shard: 'shardTide', blurb: 'A sea cave where a queen of the deep sleeps on gold.' },
    caverns: { name: 'Frostfang Caverns', region: 'frost', boss: 'warden', floors: 2, lv: 15, shard: 'shardRime', blurb: 'Blue ice halls with a giant at the bottom.' },
};

// ================================================================== materials
export const MATERIALS = {
    jelly: { name: 'Slime Jelly', icon: '🟢', region: 'meadow' },
    scrap: { name: 'Goblin Scrap', icon: '⚙️', region: 'meadow' },
    hide: { name: 'Boar Hide', icon: '🟫', region: 'meadow' },
    cap: { name: 'Glowcap', icon: '🍄', region: 'woods' },
    silk: { name: 'Spider Silk', icon: '🕸️', region: 'woods' },
    heartwood: { name: 'Heartwood', icon: '🪵', region: 'woods' },
    pearl: { name: 'Sea Pearl', icon: '⚪', region: 'coast' },
    glass: { name: 'Sea Glass', icon: '🔷', region: 'coast' },
    crystal: { name: 'Frost Crystal', icon: '💠', region: 'frost' },
    fur: { name: 'Yeti Fur', icon: '🤍', region: 'frost' },
    iron: { name: 'Star Iron', icon: '🌟', region: 'frost' },
    shardEmber: { name: 'Shard of Embers', icon: '🔶', shard: true },
    shardVerdant: { name: 'Shard of Leaves', icon: '🟩', shard: true },
    shardTide: { name: 'Shard of Tides', icon: '🔹', shard: true },
    shardRime: { name: 'Shard of Rime', icon: '🔷', shard: true },
};
export const SHARDS = ['shardEmber', 'shardVerdant', 'shardTide', 'shardRime'];

// ================================================================== gear
// slot: weapon | armor | charm. kind (weapons): blade | bow | hammer | staff | any.
// Bonuses are flat stats; pct.hp etc. are fractions. element: plain attacks use it.
const W = (id, name, kind, tier, b, price, extra = {}) => ({ id, name, slot: 'weapon', kind, tier, bonus: b, price, ...extra });
export const GEAR = {};
const add = (g) => { GEAR[g.id] = g; };
const WT = [
    ['blade', ['Bronze Sword', 'Iron Longsword', 'Steel Saber', 'Mithril Blade', 'Sunforged Brand'], (t) => ({ atk: [6, 13, 22, 34, 48][t] })],
    ['bow', ['Hunting Bow', 'Yew Longbow', 'Elvenwood Bow', 'Mithril Recurve', 'Galewind Bow'], (t) => ({ atk: [5, 11, 19, 30, 43][t], spd: t + 1 })],
    ['hammer', ['Oak Mallet', 'Iron Warhammer', 'Steel Maul', 'Mithril Crusher', 'Titan Hammer'], (t) => ({ atk: [7, 15, 25, 38, 54][t], spd: -Math.ceil((t + 1) / 2) })],
    ['staff', ['Ash Wand', 'Oak Staff', 'Crystal Rod', 'Mithril Scepter', 'Archmage Staff'], (t) => ({ atk: [2, 4, 7, 10, 14][t], mag: [6, 13, 22, 34, 48][t] })],
];
const WPRICE = [50, 130, 290, 540, 920];
for (const [kind, names, fn] of WT) names.forEach((n, t) => add(W(kind + (t + 1), n, kind, t + 1, fn(t), WPRICE[t])));
['Padded Tunic', 'Chain Vest', 'Steel Cuirass', 'Mithril Mail', 'Aegis Plate'].forEach((n, t) => add({
    id: 'armor' + (t + 1), name: n, slot: 'armor', tier: t + 1, price: [40, 120, 270, 520, 880][t],
    bonus: { def: [4, 9, 16, 25, 36][t], res: [2, 5, 9, 14, 20][t], hp: [0, 10, 22, 40, 64][t] },
}));
const C = (id, name, tier, price, bonus, extra = {}) => add({ id, name, slot: 'charm', tier, price, bonus, ...extra });
C('clover', 'Lucky Clover', 1, 90, {}, { crit: 0.1, desc: '+10% critical hits' });
C('feather', 'Swift Feather', 1, 110, { spd: 4 }, { desc: '+4 speed' });
C('ruby', 'Ruby Pendant', 2, 220, {}, { pct: { hp: 0.15 }, desc: '+15% max HP' });
C('sapphire', 'Sapphire Ring', 2, 240, { mag: 4 }, { pct: { mp: 0.25 }, desc: '+25% max MP, +4 magic' });
C('lion', 'Lion Badge', 3, 380, { atk: 8 }, { desc: '+8 attack' });
C('turtle', 'Turtle Amulet', 3, 360, { def: 10, res: 6 }, { desc: '+10 defence, +6 resistance' });
C('bracelet', 'Mossy Bracelet', 3, 420, {}, { regen: 0.04, desc: 'Heals 4% HP every turn' });
C('star', 'Star Locket', 4, 600, {}, { valor: 0.5, desc: 'The Valor gauge fills 50% faster' });

// Forged gear (no shop sells these).
add(W('thornbow', 'Thornbark Bow', 'bow', 2, { atk: 17, spd: 3 }, 0, { forged: true, onHit: { id: 'poison', chance: 0.25, turns: 3 }, desc: 'Arrows may poison' }));
add(W('shroomstaff', 'Glowcap Staff', 'staff', 2, { atk: 4, mag: 18 }, 0, { forged: true, pct: { mp: 0.2 }, desc: '+20% max MP' }));
add(W('pearlsaber', 'Pearlsteel Saber', 'blade', 3, { atk: 28 }, 0, { forged: true, element: 'holy', desc: 'Holy edge' }));
add(W('tidestaff', 'Tidecaller Staff', 'staff', 3, { atk: 8, mag: 30 }, 0, { forged: true, amp: { frost: 1.35, storm: 1.2 }, desc: 'Frost spells +35%, lightning +20%' }));
add(W('frostbite', 'Frostbite Blade', 'blade', 4, { atk: 40 }, 0, { forged: true, element: 'frost', desc: 'Frozen edge' }));
add(W('glacier', 'Glacier Maul', 'hammer', 4, { atk: 45, spd: -2 }, 0, { forged: true, element: 'frost', desc: 'Frozen head' }));
add(W('rimebow', 'Rimefrost Bow', 'bow', 4, { atk: 36, spd: 5 }, 0, { forged: true, element: 'frost', desc: 'Frost arrows' }));
add(W('dragonbane', 'Dragonbane', 'any', 6, { atk: 58, mag: 40, spd: 3 }, 0, { forged: true, element: 'frost', bane: 1.6, desc: 'Any hero can wield it. ×1.6 damage to dragons' }));
add({ id: 'boarjerkin', name: 'Boarhide Jerkin', slot: 'armor', tier: 2, price: 0, forged: true, bonus: { def: 11, res: 5, hp: 20 } });
add({ id: 'silkrobe', name: 'Silkweave Robe', slot: 'armor', tier: 3, price: 0, forged: true, bonus: { def: 12, res: 18 }, pct: { mp: 0.2 }, desc: '+20% max MP' });
add({ id: 'coralmail', name: 'Coral Mail', slot: 'armor', tier: 4, price: 0, forged: true, bonus: { def: 24, res: 13, hp: 44 } });
add({ id: 'yeticoat', name: 'Yeti Furcoat', slot: 'armor', tier: 5, price: 0, forged: true, bonus: { def: 32, res: 20, hp: 66 }, resist: ['frost'], desc: 'Resists frost' });
add({ id: 'dragonward', name: 'Dragonward Amulet', slot: 'charm', tier: 5, price: 0, forged: true, bonus: { res: 6 }, fireGuard: 0.4, desc: 'Fire damage −40%' });

export const RECIPES = [
    { out: 'boarjerkin', mats: { hide: 3 }, gold: 90 },
    { out: 'shroomstaff', mats: { cap: 3, jelly: 2 }, gold: 140 },
    { out: 'thornbow', mats: { heartwood: 2, silk: 2 }, gold: 180 },
    { out: 'silkrobe', mats: { silk: 3, cap: 1 }, gold: 240 },
    { out: 'pearlsaber', mats: { pearl: 2, scrap: 3 }, gold: 300 },
    { out: 'tidestaff', mats: { glass: 3, pearl: 1 }, gold: 380 },
    { out: 'coralmail', mats: { glass: 2, pearl: 1, scrap: 2 }, gold: 420 },
    { out: 'frostbite', mats: { crystal: 3, iron: 2 }, gold: 500 },
    { out: 'glacier', mats: { crystal: 2, iron: 3 }, gold: 520 },
    { out: 'rimebow', mats: { crystal: 2, silk: 2, heartwood: 1 }, gold: 480 },
    { out: 'yeticoat', mats: { fur: 3, iron: 1 }, gold: 640 },
    { out: 'dragonward', mats: { fur: 1, pearl: 1, crystal: 1, heartwood: 1 }, gold: 380 },
    { out: 'dragonbane', mats: { shardEmber: 1, shardVerdant: 1, shardTide: 1, shardRime: 1 }, gold: 600 },
];

// ================================================================== consumables
// use: battle | field | board (dice) — where it can be used
export const ITEMS = {
    potion: { name: 'Potion', icon: '🧪', price: 22, use: ['battle', 'field'], heal: 0.4, min: 30, target: 'ally', desc: 'Heals 40% HP' },
    hipotion: { name: 'Hi-Potion', icon: '⚗️', price: 70, use: ['battle', 'field'], heal: 0.8, min: 80, target: 'ally', desc: 'Heals 80% HP' },
    ether: { name: 'Ether', icon: '🔮', price: 45, use: ['battle', 'field'], mp: 0.5, min: 12, target: 'ally', desc: 'Restores 50% MP' },
    phoenix: { name: 'Phoenix Feather', icon: '🪶', price: 110, use: ['battle', 'field'], revive: 0.5, target: 'ko', desc: 'Raises a fallen ally with half HP' },
    remedy: { name: 'Remedy', icon: '🌿', price: 18, use: ['battle'], cure: true, target: 'ally', desc: 'Cures poison, burns, slow and stun' },
    bomb: { name: 'Fire Bomb', icon: '💣', price: 55, use: ['battle'], damage: 40, perLap: 16, element: 'fire', target: 'enemies', desc: 'Fire damage to every enemy' },
    flask: { name: 'Frost Flask', icon: '🧊', price: 65, use: ['battle'], damage: 75, perLap: 26, element: 'frost', target: 'enemy', desc: 'Heavy frost damage to one enemy' },
    smoke: { name: 'Smoke Bomb', icon: '💨', price: 30, use: ['battle'], flee: true, target: 'none', desc: 'Escape any normal battle' },
    picnic: { name: 'Picnic Basket', icon: '🧺', price: 80, use: ['field'], heal: 1, mp: 1, target: 'party', desc: 'Fully restores the party outside battle' },
    die: { name: 'Loaded Die', icon: '🎲', price: 90, use: ['board'], desc: 'Choose your roll (2–12)' },
    boots: { name: 'Swift Boots', icon: '👢', price: 60, use: ['board'], desc: 'Roll three dice this turn' },
    warp: { name: 'Warp Scroll', icon: '📜', price: 120, use: ['board'], desc: 'Fly to any town' },
};

/** What each town's shop sells (tiers unlock with laps). */
export const TOWNS = {
    brookhollow: { name: 'Brookhollow', region: 'meadow', tierBonus: 0, companion: 'pip', inn: 20, items: ['potion', 'ether', 'remedy', 'phoenix', 'smoke', 'picnic', 'boots', 'die'], charms: ['clover', 'feather'], blurb: 'A cosy village of thatch, pies and gossip.' },
    fernwick: { name: 'Fernwick', region: 'woods', tierBonus: 1, companion: 'sylva', inn: 30, items: ['potion', 'hipotion', 'ether', 'remedy', 'phoenix', 'bomb', 'warp'], charms: ['clover', 'ruby', 'sapphire', 'bracelet'], blurb: 'Elven treehouses joined by rope bridges.' },
    saltbreeze: { name: 'Saltbreeze Harbor', region: 'coast', tierBonus: 1, companion: 'bram', inn: 40, items: ['potion', 'hipotion', 'ether', 'phoenix', 'bomb', 'flask', 'smoke', 'die', 'warp'], charms: ['feather', 'lion', 'turtle', 'ruby'], blurb: 'Gulls, rope and the smell of fried fish.' },
    hammerhold: { name: 'Hammerhold', region: 'frost', tierBonus: 2, companion: 'grumli', inn: 50, items: ['hipotion', 'ether', 'phoenix', 'flask', 'bomb', 'picnic', 'boots'], charms: ['lion', 'turtle', 'bracelet', 'star'], blurb: 'A dwarven hall dug into the mountain.' },
};

// ================================================================== fate cards (the Chance deck)
// fx is resolved by game.js. w: weight. minLap: not before this lap.
export const FATE = [
    { id: 'windfall', title: 'Lucky Find', text: 'A purse of gold lies in the long grass.', w: 3, fx: { gold: [40, 30] } },
    { id: 'bard', title: 'A Bard\'s Ballad', text: 'A travelling bard sings of your deeds. Villagers press coins on you.', w: 2, fx: { gold: [25, 20], fame: 15 } },
    { id: 'fairy', title: 'Fairy Ring', text: 'You doze in a fairy ring and wake fully rested.', w: 2, fx: { healAll: true } },
    { id: 'tailwind', title: 'Tailwind', text: 'A warm wind lifts your boots. Move ahead 3 spaces.', w: 2, fx: { move: 3 } },
    { id: 'shortcut', title: 'Secret Path', text: 'An old map shows a path to the next town.', w: 2, fx: { toNext: 'town' } },
    { id: 'pickpocket', title: 'Pickpockets!', text: 'Goblin pickpockets bump into you in a crowd. Your purse feels lighter.', w: 2, minLap: 2, fx: { loseGold: 0.12 } },
    { id: 'ambush', title: 'Ambush!', text: 'Monsters leap from the bushes!', w: 2, fx: { battle: 1 } },
    { id: 'festival', title: 'Harvest Festival', text: 'It\'s your name day! Every rival gives you 30 gold.', w: 1, fx: { fromRivals: 30 } },
    { id: 'tax', title: 'The Crown\'s Tax', text: 'The tax collector wants 15 gold for every deed you own. It goes in the Fountain.', w: 1, minLap: 2, fx: { tax: 15 } },
    { id: 'blessing', title: 'Wandering Priest', text: 'A priest blesses your weapons for the next battle.', w: 2, fx: { blessing: true } },
    { id: 'egg', title: 'A Strange Bundle', text: 'A peddler trades you a bundle of crafting goods for a song.', w: 2, fx: { mats: 2 } },
    { id: 'merchant', title: 'Travelling Merchant', text: 'A merchant\'s cart has a spare potion or two.', w: 2, fx: { items: { potion: 2 } } },
    { id: 'rumble', title: 'The Mountain Rumbles', text: 'Pyrrhax stirs in his sleep. Ash falls. Everyone loses a little health.', w: 1, minLap: 3, fx: { hurtAll: 0.15 } },
    { id: 'portal', title: 'Shimmering Door', text: 'A door of light opens in the air. It leads to the Wyrm Portal.', w: 1, fx: { goto: 30 } },
    { id: 'clover', title: 'Four-Leaf Clover', text: 'Your next roll gets +2.', w: 2, fx: { nextRoll: 2 } },
    { id: 'storm', title: 'Sudden Storm', text: 'Rain! You shelter at the Crossroads Shrine.', w: 1, fx: { goto: 10 } },
    { id: 'dungeonmap', title: 'Treasure Map', text: 'An X marks a dungeon. You know the way.', w: 1, minLap: 2, fx: { toNext: 'dungeon' } },
    { id: 'xp', title: 'Old Hermit\'s Lesson', text: 'A hermit teaches your party a trick or two.', w: 2, fx: { xp: [30, 30] } },
];

export const TREASURE = {
    mimicChance: 0.14,    // from lap 2
};

// ================================================================== rivals
export const RIVALS = [
    { id: 'baron', name: 'Baron Goldbuckle', short: 'Baron', color: '#ffc83a', greed: 0.8, bravery: 0.5, look: { skin: '#ffd9b8', hair: '#f4f4f4', outfit: '#d8a02a', trim: '#8a3a2a', cape: '#8a2a5a', beard: '#f4f4f4', crownHat: true, wide: true }, blurb: 'A rich, round knight who wants to buy the whole island.' },
    { id: 'mira', name: 'Mirabel Moonshade', short: 'Mirabel', color: '#b06aff', greed: 0.45, bravery: 0.9, look: { skin: '#f0d0e0', hair: '#3a2a6a', outfit: '#6a3ab0', trim: '#e0e0ff', cape: '#2a1a4a', hood: true, longHair: true }, blurb: 'A rogue who says she\'s only here for the dragon\'s gold.' },
];

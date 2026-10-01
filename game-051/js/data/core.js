/**
 * core.js — the vocabulary of the game: elements, rarities, races, traits,
 * stats and battle statuses. Pure data, no logic beyond tiny helpers.
 */

export const ELEMENTS = ['fire', 'water', 'wind', 'light', 'dark'];

export const ELEMENT = {
    fire:  { name: 'Fire',  color: '#ff6a3d', glow: '#ffb15a', dark: '#7a1e0c', adj: ['Cinder', 'Ember', 'Blazing', 'Inferno', 'Pyre', 'Scorch', 'Molten', 'Flare'] },
    water: { name: 'Water', color: '#3da5ff', glow: '#9fe0ff', dark: '#0b3a73', adj: ['Tidal', 'Frost', 'Riptide', 'Glacial', 'Brine', 'Mist', 'Abyssal', 'Rime'] },
    wind:  { name: 'Wind',  color: '#4fd36a', glow: '#b8ff9a', dark: '#155f2a', adj: ['Gale', 'Thorn', 'Verdant', 'Zephyr', 'Bramble', 'Storm', 'Wild', 'Cyclone'] },
    light: { name: 'Light', color: '#ffd84a', glow: '#fff4b8', dark: '#8a6a10', adj: ['Radiant', 'Dawn', 'Halo', 'Solar', 'Gleaming', 'Holy', 'Aurora', 'Prism'] },
    dark:  { name: 'Dark',  color: '#a65cff', glow: '#e0b8ff', dark: '#3a1470', adj: ['Shadow', 'Dusk', 'Void', 'Umbral', 'Hex', 'Night', 'Grim', 'Eclipse'] },
};

/** attacker element → defender element it beats */
export const BEATS = { fire: 'wind', wind: 'water', water: 'fire', light: 'dark', dark: 'light' };
export function advantage(att, def) {
    if (BEATS[att] === def) return 1;
    if (BEATS[def] === att && !(att === 'light' || att === 'dark')) return -1;
    return 0;
}

export const RARITY = [
    null,
    { name: 'Common',    color: '#b9c2cc', frame: '#6f7884', glow: 'rgba(200,210,220,.35)' },
    { name: 'Uncommon',  color: '#6ee07a', frame: '#2f8f3c', glow: 'rgba(110,224,122,.45)' },
    { name: 'Rare',      color: '#53b4ff', frame: '#1f62b8', glow: 'rgba(83,180,255,.5)' },
    { name: 'Epic',      color: '#c879ff', frame: '#7a2fc0', glow: 'rgba(200,121,255,.55)' },
    { name: 'Legendary', color: '#ffc94a', frame: '#c48a12', glow: 'rgba(255,201,74,.65)' },
    { name: 'Mythic',    color: '#ff5d8f', frame: '#c21f55', glow: 'rgba(255,93,143,.7)' },
];

export const MAX_LEVEL = [0, 15, 20, 25, 30, 35, 40];
export const NAT_MULT = [0, 0.8, 0.86, 0.92, 1.0, 1.1, 1.18];
export const LEVEL_GROWTH = 0.03;
/** G[star] — evolving keeps ~90 % of the previous star's max-level power. */
export const STAR_MULT = (() => {
    const g = [0, 1];
    for (let s = 2; s <= 6; s++) g[s] = g[s - 1] * (1 + LEVEL_GROWTH * (MAX_LEVEL[s - 1] - 1)) * 0.9;
    return g;
})();

export const STATS = ['hp', 'atk', 'def', 'spd', 'cr', 'cd', 'res', 'acc'];
export const STAT_NAME = { hp: 'HP', atk: 'ATK', def: 'DEF', spd: 'SPD', cr: 'Crit Rate', cd: 'Crit Dmg', res: 'Resist', acc: 'Accuracy' };
export const STAT_SHORT = { hp: 'HP', atk: 'ATK', def: 'DEF', spd: 'SPD', cr: 'CRI', cd: 'CDM', res: 'RES', acc: 'ACC' };
export const PCT_STATS = new Set(['cr', 'cd', 'res', 'acc']);

export const ROLES = {
    attack:  { name: 'Attack',  color: '#ff7a59' },
    defense: { name: 'Defense', color: '#7fb3ff' },
    hp:      { name: 'HP',      color: '#7be08a' },
    support: { name: 'Support', color: '#ffd66b' },
};

// ---------------------------------------------------------------- races

export const RACES = {
    human: {
        name: 'Human', skins: ['#ffdcc2', '#f3c39e', '#e0a87c', '#c48659', '#9a6440', '#6e4428'],
        ears: ['human'], horns: 0, tail: 0, wings: 0, height: [0.95, 1.05], head: [1.0, 1.06],
        mods: { hp: 1, atk: 1, def: 1, spd: 0 }, syl: [['Al', 'Bran', 'Ced', 'Da', 'El', 'Gar', 'Hal', 'Is', 'Jor', 'Kat', 'Lu', 'Mar', 'Ro', 'Sa', 'Tor', 'Wil'], ['ric', 'den', 'ra', 'vin', 'win', 'ella', 'on', 'eth', 'a', 'ian', 'ys', 'mund', 'ard', 'ine']],
        hairs: null,
    },
    elf: {
        name: 'Elf', skins: ['#fff0dc', '#f6dcc0', '#e6c7a4', '#cfe8d8', '#d8c6f0'],
        ears: ['elf'], horns: 0, tail: 0, wings: 0.05, height: [1.0, 1.1], head: [0.96, 1.02],
        mods: { hp: 0.95, atk: 1.02, def: 0.95, spd: 3, acc: 0.05 }, syl: [['Ae', 'Ela', 'Fae', 'Gal', 'Ith', 'Lae', 'Mir', 'Nim', 'Syl', 'Tha', 'Vael', 'Ye'], ['wen', 'driel', 'lan', 'riel', 'thas', 'ion', 'rae', 'nor', 'vyn', 'lith', 'anor', 'ssa']],
    },
    dwarf: {
        name: 'Dwarf', skins: ['#f7cfae', '#e3b08a', '#c88f68', '#a8714c'],
        ears: ['human'], horns: 0, tail: 0, wings: 0, height: [0.78, 0.86], head: [1.06, 1.12], beard: 0.75, build: 1.25,
        mods: { hp: 1.06, atk: 1, def: 1.08, spd: -3 }, syl: [['Bal', 'Bor', 'Dur', 'Gim', 'Grom', 'Thra', 'Dor', 'Hil', 'Kaz', 'Bru'], ['in', 'grim', 'dek', 'li', 'dal', 'mund', 'rak', 'da', 'gar', 'nor']],
    },
    orc: {
        name: 'Orc', skins: ['#8fbf6a', '#77a957', '#6a9a6e', '#9c8c5a', '#7e9a9a'],
        ears: ['elf'], horns: 0, tail: 0, wings: 0, height: [1.05, 1.14], head: [0.98, 1.04], tusks: 1, build: 1.2,
        mods: { hp: 1.06, atk: 1.06, def: 1, spd: -2 }, syl: [['Gro', 'Ur', 'Mok', 'Zug', 'Thra', 'Gar', 'Krug', 'Dur', 'Og', 'Sha'], ['mash', 'gak', 'thar', 'rok', 'ga', 'nak', 'zul', 'gul', 'ka', 'rim']],
    },
    beastkin: {
        name: 'Beastkin', skins: ['#ffdcc2', '#f0c49c', '#d9a37a', '#b07a52'],
        ears: ['cat', 'wolf', 'fox', 'bunny'], horns: 0, tail: 1, wings: 0, height: [0.92, 1.04], head: [1.0, 1.08],
        mods: { hp: 1, atk: 1.02, def: 0.97, spd: 4 }, syl: [['Ki', 'Ru', 'Mi', 'Fen', 'Lo', 'Ta', 'Ny', 'Sho', 'Ra', 'Yu', 'Pa'], ['ra', 'ko', 'ma', 'rin', 'ki', 'zu', 'na', 'ri', 'fang', 'paw']],
    },
    undead: {
        name: 'Undead', skins: ['#cfd6d2', '#b9c4c0', '#a8b4c6', '#c6bfd6'],
        ears: ['human', 'elf'], horns: 0.15, tail: 0, wings: 0.08, height: [0.95, 1.05], head: [0.98, 1.04], pale: 1,
        mods: { hp: 1.04, atk: 1, def: 0.98, spd: 0, res: 0.05 }, syl: [['Mor', 'Vex', 'Sar', 'Cal', 'Nec', 'Lich', 'Gho', 'Ash', 'Rev', 'Bel'], ['dred', 'ix', 'thos', 'vane', 'ra', 'gore', 'ul', 'ith', 'enant', 'mire']],
    },
    demonkin: {
        name: 'Demonkin', skins: ['#e86a6a', '#c95060', '#9b5ad6', '#6a6ad6', '#f0a0a0', '#d0c0ff'],
        ears: ['elf'], horns: 1, tail: 0.6, wings: 0.35, height: [1.0, 1.1], head: [0.98, 1.04],
        mods: { hp: 0.98, atk: 1.06, def: 0.98, spd: 1 }, syl: [['Az', 'Bel', 'Mal', 'Xer', 'Zar', 'Ly', 'Ash', 'Bal', 'Mor', 'Va'], ['azel', 'phegor', 'thas', 'xis', 'ith', 'ria', 'goth', 'mon', 'zael', 'loch']],
    },
    fae: {
        name: 'Fae', skins: ['#fff0f4', '#f0e0ff', '#e0f6ff', '#e8ffe4', '#ffe8cc'],
        ears: ['elf'], horns: 0.1, tail: 0, wings: 1, height: [0.82, 0.92], head: [1.06, 1.14],
        mods: { hp: 0.94, atk: 1, def: 0.94, spd: 5, res: 0.05 }, syl: [['Pip', 'Twi', 'Bel', 'Lu', 'Fi', 'Mo', 'Thi', 'Wis', 'Pe', 'Ro'], ['nkle', 'la', 'mi', 'ssa', 'ttle', 'wyn', 'bell', 'sie', 'ra', 'lune']],
    },
    dragonkin: {
        name: 'Dragonkin', skins: ['#e8c890', '#d89a6a', '#b8d0a0', '#a0c0e0', '#e0a0a0'],
        ears: ['fin'], horns: 1, tail: 1, wings: 0.4, height: [1.04, 1.14], head: [0.98, 1.04], scales: 1, build: 1.1,
        mods: { hp: 1.05, atk: 1.04, def: 1.04, spd: -1 }, syl: [['Dra', 'Vyr', 'Kael', 'Sca', 'Ign', 'Thra', 'Rha', 'Zy', 'Aur', 'Gor'], ['kon', 'mir', 'thrax', 'gon', 'is', 'zar', 'eth', 'ryn', 'ion', 'vax']],
    },
    golem: {
        name: 'Golem', skins: ['#b8b2a6', '#9aa4b0', '#a89a8a', '#8ab0a0', '#c0a890'],
        ears: ['none'], horns: 0.2, tail: 0, wings: 0, height: [1.05, 1.15], head: [0.92, 0.98], construct: 1, build: 1.3,
        mods: { hp: 1.08, atk: 1, def: 1.1, spd: -4 }, syl: [['Gol', 'Tor', 'Mag', 'Cog', 'Basal', 'Obel', 'Gran', 'Quar', 'Iron', 'Flint'], ['os', 'ax', 'nus', 'tite', 'th', 'grim', 'ok', 'ion', 'heart', 'fist']],
    },
};
export const RACE_IDS = Object.keys(RACES);

// ---------------------------------------------------------------- traits

/** mod: flat or percent stat changes; flag: behaviour hooks read by battle / idle sims */
export const TRAITS = {
    swift:       { name: 'Swift',          desc: '+6 SPD',                                   mod: { spd: 6 } },
    brutal:      { name: 'Brutal',         desc: '+12% ATK',                                 mod: { atkP: 0.12 } },
    stalwart:    { name: 'Stalwart',       desc: '+12% DEF',                                 mod: { defP: 0.12 } },
    hale:        { name: 'Hale',           desc: '+12% HP',                                  mod: { hpP: 0.12 } },
    keen:        { name: 'Keen',           desc: '+8% Crit Rate',                            mod: { cr: 0.08 } },
    deadly:      { name: 'Deadly',         desc: '+20% Crit Damage',                         mod: { cd: 0.2 } },
    resolute:    { name: 'Resolute',       desc: '+15% Resistance',                          mod: { res: 0.15 } },
    precise:     { name: 'Precise',        desc: '+15% Accuracy',                            mod: { acc: 0.15 } },
    vampiric:    { name: 'Vampiric',       desc: 'Heals for 10% of damage dealt',            flag: { lifesteal: 0.1 } },
    thorned:     { name: 'Thorned',        desc: 'Reflects 10% of damage taken',             flag: { reflect: 0.1 } },
    laststand:   { name: 'Last Stand',     desc: '+35% ATK while below 35% HP',              flag: { lastStand: 0.35 } },
    opener:      { name: 'Opener',         desc: 'Starts each wave with 30% ATB',            flag: { openAtb: 0.3 } },
    vengeful:    { name: 'Vengeful',       desc: '15% chance to counter when hit',           flag: { counter: 0.15 } },
    regenerator: { name: 'Regenerator',    desc: 'Recovers 4% HP each turn',                 flag: { regen: 0.04 } },
    glass:       { name: 'Glass Cannon',   desc: '+25% ATK, −15% HP',                        mod: { atkP: 0.25, hpP: -0.15 } },
    bulwark:     { name: 'Bulwark',        desc: '+25% DEF, −5 SPD',                         mod: { defP: 0.25, spd: -5 } },
    elementalist:{ name: 'Elementalist',   desc: '+15% damage with element advantage',       flag: { advDmg: 0.15 } },
    executioner: { name: 'Executioner',    desc: '+30% damage to targets below 35% HP',      flag: { execute: 0.3 } },
    angel:       { name: 'Guardian Angel', desc: 'Survives one lethal blow per battle',      flag: { angel: 1 } },
    scholar:     { name: 'Scholar',        desc: '+25% hero XP from all sources',            flag: { xp: 0.25 } },
    miner:       { name: 'Miner',          desc: 'Doubles ore when assigned to the Mine',    flag: { miner: 1 } },
    greenthumb:  { name: 'Green Thumb',    desc: 'Doubles yield bonus as a Farmer',          flag: { farmer: 1 } },
    explorer:    { name: 'Explorer',       desc: '+15% expedition success',                  flag: { explorer: 0.15 } },
    lucky:       { name: 'Lucky',          desc: '+10% gold and +5% drops in battle',        flag: { lucky: 1 } },
};
export const TRAIT_IDS = Object.keys(TRAITS);
export const TRAIT_COUNT = [0, 0, 1, 1, 2, 2, 3];

// ---------------------------------------------------------------- statuses

export const STATUS = {
    atkUp:     { name: 'ATK Up',      buff: true,  short: 'ATK', glyph: '⚔', color: '#ff8a5c', desc: '+50% ATK' },
    defUp:     { name: 'DEF Up',      buff: true,  short: 'DEF', glyph: '⛊', color: '#6fb6ff', desc: '+70% DEF' },
    spdUp:     { name: 'SPD Up',      buff: true,  short: 'SPD', glyph: '»', color: '#7cf0b0', desc: '+30% SPD' },
    critUp:    { name: 'Crit Up',     buff: true,  short: 'CRI', glyph: '✦', color: '#ffd24a', desc: '+30% Crit Rate' },
    shield:    { name: 'Shield',      buff: true,  short: 'SHD', glyph: '◈', color: '#9fe7ff', desc: 'Absorbs damage' },
    immunity:  { name: 'Immunity',    buff: true,  short: 'IMM', glyph: '✚', color: '#fff3a8', desc: 'Immune to debuffs' },
    regen:     { name: 'Regen',       buff: true,  short: 'RGN', glyph: '♥', color: '#7be08a', desc: 'Heals 12% HP per turn' },
    counter:   { name: 'Counter',     buff: true,  short: 'CTR', glyph: '↺', color: '#ffb35c', desc: 'Counterattacks when hit' },
    endure:    { name: 'Endure',      buff: true,  short: 'END', glyph: '♦', color: '#ffe08a', desc: 'Cannot fall below 1 HP' },
    atkDown:   { name: 'ATK Down',    buff: false, short: 'ATK', glyph: '⚔', color: '#c25050', desc: '−50% ATK' },
    defDown:   { name: 'DEF Break',   buff: false, short: 'DEF', glyph: '⛊', color: '#c25050', desc: '−70% DEF' },
    slow:      { name: 'Slow',        buff: false, short: 'SLW', glyph: '«', color: '#7a8cc2', desc: '−30% SPD' },
    stun:      { name: 'Stun',        buff: false, short: 'STN', glyph: '✷', color: '#ffe14a', desc: 'Skips turns', hard: true },
    silence:   { name: 'Silence',     buff: false, short: 'SIL', glyph: '∅', color: '#9a7ad6', desc: 'Basic attacks only' },
    burn:      { name: 'Burn',        buff: false, short: 'BRN', glyph: '♨', color: '#ff6a2a', desc: '5% max HP damage per turn', stack: 5 },
    poison:    { name: 'Poison',      buff: false, short: 'PSN', glyph: '☠', color: '#8ad64a', desc: '4% max HP damage per turn, halves healing', stack: 5 },
    healBlock: { name: 'Heal Block',  buff: false, short: 'HBK', glyph: '✖', color: '#d04a7a', desc: 'Cannot be healed' },
    mark:      { name: 'Marked',      buff: false, short: 'MRK', glyph: '◎', color: '#ff4a6a', desc: 'Takes +25% damage' },
    provoke:   { name: 'Provoke',     buff: false, short: 'PRV', glyph: '!', color: '#ff7a3a', desc: 'Forced to attack the provoker', hard: true },
    blind:     { name: 'Blind',       buff: false, short: 'BLD', glyph: '◐', color: '#8a8a9a', desc: '+50% chance to glance' },
};

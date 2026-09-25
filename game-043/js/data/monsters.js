// ============================================================
// Monster archetypes, elements and region themes. Species are
// generated per seed in gen/monsters.js from these building blocks.
// ============================================================

export const ELEMENTS = ['none', 'leaf', 'storm', 'frost', 'ember', 'shadow', 'light'];
export const ELEM_ICON = { none: '', leaf: '🍃', storm: '⚡', frost: '❄', ember: '🔥', shadow: '🌑', light: '✦' };
export const ELEM_HUE = { none: 0, leaf: 110, storm: 270, frost: 195, ember: 12, shadow: 265, light: 52 };

// ember › leaf › storm › frost › ember ; shadow ⇄ light
const BEATS = { ember: 'leaf', leaf: 'storm', storm: 'frost', frost: 'ember' };
export function elemMult(atk, def) {
    if (!atk || atk === 'none' || !def || def === 'none') return 1;
    if ((atk === 'shadow' && def === 'light') || (atk === 'light' && def === 'shadow')) return 1.5;
    if (BEATS[atk] === def) return 1.5;
    if (BEATS[def] === atk) return 0.66;
    return 1;
}

// hp/atk/def/spd multipliers; `ai` names an intent script in sim/combat.js
export const ARCHETYPES = {
    slime:     { noun: ['Slime', 'Blob', 'Jelly'],     hp: 1.1, atk: 0.8, def: 0.9, spd: 0.7, ai: 'slime',   drop: 'gel',       template: 'dome' },
    beast:     { noun: ['Fox', 'Boar', 'Wolfling', 'Badger'], hp: 1.0, atk: 1.15, def: 0.9, spd: 1.1, ai: 'brute', drop: 'fur', template: 'quad' },
    bird:      { noun: ['Moth', 'Bat', 'Wren', 'Owlet'], hp: 0.75, atk: 1.0, def: 0.7, spd: 1.5, ai: 'swift',  drop: 'feather',   template: 'wings' },
    plant:     { noun: ['Sprout', 'Bloom', 'Thistle'], hp: 1.0, atk: 0.85, def: 1.0, spd: 0.8, ai: 'healer',  drop: 'petal',     template: 'plant' },
    bug:       { noun: ['Beetle', 'Mite', 'Crawler'],  hp: 0.9, atk: 1.0, def: 1.3, spd: 1.0, ai: 'guarder', drop: 'chitin',    template: 'bug' },
    spirit:    { noun: ['Wisp', 'Shade', 'Will'],      hp: 0.8, atk: 1.1, def: 0.7, spd: 1.2, ai: 'caster',  drop: 'wisp_dust', template: 'ghost' },
    golem:     { noun: ['Golem', 'Cairn', 'Lump'],     hp: 1.5, atk: 1.2, def: 1.4, spd: 0.5, ai: 'charger', drop: 'core_stone',template: 'block' },
    fungus:    { noun: ['Shroom', 'Puffcap', 'Mold'],  hp: 1.0, atk: 0.9, def: 1.0, spd: 0.8, ai: 'debuff',  drop: 'spore',     template: 'cap' },
    serpent:   { noun: ['Eel', 'Newt', 'Serpent'],     hp: 1.0, atk: 1.2, def: 0.9, spd: 1.2, ai: 'brute',   drop: 'scale',     template: 'snake' },
    construct: { noun: ['Sentry', 'Clockwork', 'Idol'],hp: 1.3, atk: 1.1, def: 1.3, spd: 0.8, ai: 'charger', drop: 'gear',      template: 'block' },
    skeleton:  { noun: ['Rattler', 'Bones', 'Knight'], hp: 1.0, atk: 1.2, def: 1.0, spd: 1.0, ai: 'brute',   drop: 'bone',      template: 'humanoid' },
};

// Biomes in story order. Everything here is a *pool*; the seed picks.
export const BIOMES = [
    { id: 'forest',  elem: 'leaf',   gate: null,       relic: 'thornbreaker', nouns: ['Wood', 'Weald', 'Thicket', 'Forest'],
      arche: ['slime', 'beast', 'plant', 'bird', 'fungus'], forage: ['wild_berry', 'mushroom', 'mint', 'hazelnut', 'leek', 'daffodil'],
      ore: ['copper_ore', 'copper_ore', 'coal'], gem: ['emerald', 'amethyst'], dungeon: ['Rootwarren', 'Hollow Oak', 'Mossvault'], cave: ['Burrow', 'Den', 'Grotto'] },
    { id: 'downs',   elem: 'storm',  gate: 'thorn',    relic: 'stonebreaker', nouns: ['Downs', 'Meadow', 'Heath', 'Fields'],
      arche: ['bird', 'beast', 'bug', 'plant', 'construct'], forage: ['dandelion', 'clover', 'sunpetal', 'honeycomb', 'wild_berry'],
      ore: ['copper_ore', 'iron_ore', 'coal'], gem: ['amethyst', 'emerald'], dungeon: ['Old Barrow', 'Windmill Keep', 'Stormcairn'], cave: ['Quarry', 'Hollow Hill'] },
    { id: 'lake',    elem: 'frost',  gate: 'boulder',  relic: 'lilypad',      nouns: ['Mere', 'Marsh', 'Fen', 'Water'],
      arche: ['serpent', 'slime', 'spirit', 'bird', 'fungus'], forage: ['cattail', 'clam', 'frost_lily', 'chestnut', 'mushroom'],
      ore: ['iron_ore', 'iron_ore', 'coal'], gem: ['sapphire', 'moonstone'], dungeon: ['Sunken Chapel', 'Drowned Abbey', 'Mirror Halls'], cave: ['Grotto', 'Wet Cave'] },
    { id: 'crags',   elem: 'ember',  gate: 'shallows', relic: 'lantern',      nouns: ['Crags', 'Scarp', 'Cinders', 'Reach'],
      arche: ['golem', 'serpent', 'bug', 'construct', 'spirit'], forage: ['ember_pepper', 'firecap', 'sulfur'],
      ore: ['gold_ore', 'iron_ore', 'coal'], gem: ['ruby', 'onyx'], dungeon: ['Cinder Deep', 'Ashen Forge', 'Magma Vault'], cave: ['Mine', 'Lava Tube'] },
    { id: 'heights', elem: 'shadow', gate: 'dark',     relic: null,           nouns: ['Heights', 'Peaks', 'Snowfields', 'Spires'],
      arche: ['spirit', 'golem', 'beast', 'skeleton', 'bird'], forage: ['snowcap', 'pine_nut', 'ice_crystal', 'winter_root'],
      ore: ['gold_ore', 'glim_ore', 'coal'], gem: ['moonstone', 'onyx', 'sapphire'], dungeon: ['Starfall Spire', 'Frost Citadel', 'Moon Tower'], cave: ['Ice Cave', 'Frost Mine'] },
];

export const GATE_RELIC = { thorn: 'thornbreaker', boulder: 'stonebreaker', shallows: 'lilypad', dark: 'lantern' };

// Base stats of a tier-t (1..5) monster before archetype multipliers.
export function baseStats(tier, floor = 0) {
    const t = tier + floor * 0.18;
    return {
        hp: Math.round(8 + t * 14 + t * t * 3),
        atk: Math.round(4 + t * 4.2),
        def: Math.round(1 + t * 2.2),
        spd: Math.round(4 + t * 1.6),
        xp: Math.round(6 + t * 9 + t * t * 1.5),
        gold: Math.round(5 + t * 8),
    };
}

export const BOSS_TITLES = ['the Old', 'the Hungry', 'the Sleepless', 'the Warden', 'Queen', 'King', 'the Hollow', 'the Ancient'];

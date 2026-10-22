// STARSPIN — content tables: reel symbols, enemies, sectors and the Constellation's nodes.
// Pure data. Numbers that tune the whole game live in ../config.js.

/** Reel symbols. `base` is the value of one copy on the payline before matches multiply it. */
export const SYMBOLS = {
    blade:  { name: 'Starblade',  base: 5, color: '#7fe9ff', text: 'Damage to your target.' },
    comet:  { name: 'Comet',      base: 3, color: '#ffb347', text: 'Damage to every enemy.' },
    hex:    { name: 'Hex Moon',   base: 2, color: '#d98bff', text: 'Burn on your target: it loses that much HP each turn, one less every turn.' },
    shield: { name: 'Aegis',      base: 5, color: '#8fa8ff', text: 'Block: stops that much damage this turn.' },
    mend:   { name: 'Nova Mend',  base: 3, color: '#7dffa1', text: 'Repair your hull.' },
    charge: { name: 'Ion Charge', base: 1, color: '#ffe95c', text: '+1 Energy next turn per copy (never multiplied).' },
    wild:   { name: 'Wild Star',  base: 0, color: '#ffffff', text: 'Joins the biggest group on the payline.' },
    static: { name: 'Static',     base: 0, color: '#6b6f80', text: 'Junk an enemy jammed into your reels. Does nothing. Gone after the fight.' },
};
/** Ties between groups of the same size go to the earlier symbol here. */
export const SYMBOL_ORDER = ['blade', 'comet', 'hex', 'shield', 'mend', 'charge'];
export const STARTER_STRIP = ['blade', 'blade', 'blade', 'shield', 'shield', 'comet', 'mend', 'charge'];
/** Reward weights: what a victory may offer to add to every reel. */
export const REWARD_POOL = { blade: 3, comet: 2, hex: 2, shield: 2, mend: 1.4, charge: 1.4, wild: 0.7 };

/**
 * Enemies. Moves cycle in order; normal enemies start at a random one, bosses at the first.
 * Intent kinds: atk (v damage, n times, optional b block), block, buff (strength), heal (the
 * most hurt ally), jam (n Static into your reels for this fight).
 */
export const ENEMIES = {
    drone:    { name: 'Scrap Drone',   hp: 20,  model: 'drone',    color: 0x6fe0ff, moves: [{ k: 'atk', v: 6 }, { k: 'atk', v: 5, b: 4 }, { k: 'block', v: 7 }] },
    moth:     { name: 'Void Moth',     hp: 16,  model: 'moth',     color: 0xc88bff, moves: [{ k: 'atk', v: 3, n: 2 }, { k: 'jam', n: 1 }, { k: 'atk', v: 5 }] },
    gunner:   { name: 'Ring Pirate',   hp: 32,  model: 'gunner',   color: 0xff8a5c, moves: [{ k: 'atk', v: 9 }, { k: 'buff', v: 2 }, { k: 'atk', v: 6, b: 5 }] },
    croupier: { name: 'Croupier Δ',    hp: 120, model: 'croupier', color: 0xffd166, boss: true, moves: [{ k: 'jam', n: 2 }, { k: 'atk', v: 11 }, { k: 'atk', v: 4, n: 3 }, { k: 'block', v: 14 }, { k: 'buff', v: 2 }] },

    jackal:   { name: 'Comet Jackal',  hp: 28,  model: 'jackal',   color: 0xffa94d, moves: [{ k: 'atk', v: 8 }, { k: 'atk', v: 3, n: 3 }, { k: 'jam', n: 1 }] },
    squid:    { name: 'Nebula Squid',  hp: 42,  model: 'squid',    color: 0xff5ce1, moves: [{ k: 'atk', v: 4, n: 3 }, { k: 'heal', v: 8 }, { k: 'atk', v: 11 }] },
    knight:   { name: 'Prism Knight',  hp: 54,  model: 'knight',   color: 0x9fd8ff, moves: [{ k: 'block', v: 12 }, { k: 'atk', v: 14 }, { k: 'buff', v: 3 }] },
    wyrm:     { name: 'Nebula Wyrm',   hp: 210, model: 'wyrm',     color: 0xb06cff, boss: true, moves: [{ k: 'atk', v: 7, n: 2 }, { k: 'jam', n: 2 }, { k: 'atk', v: 18 }, { k: 'block', v: 16 }, { k: 'buff', v: 3 }] },

    dealer:   { name: 'Dealer Unit',   hp: 58,  model: 'dealer',   color: 0xff4d6d, moves: [{ k: 'jam', n: 2 }, { k: 'atk', v: 13 }, { k: 'atk', v: 5, n: 3 }] },
    leech:    { name: 'Luck Leech',    hp: 40,  model: 'leech',    color: 0xa6ff4d, moves: [{ k: 'atk', v: 7 }, { k: 'heal', v: 10 }, { k: 'jam', n: 1 }, { k: 'atk', v: 4, n: 3 }] },
    golem:    { name: 'Chip Golem',    hp: 78,  model: 'golem',    color: 0x5cffb0, moves: [{ k: 'block', v: 16 }, { k: 'atk', v: 19 }, { k: 'atk', v: 9, b: 9 }] },
    house:    { name: 'The House',     hp: 320, model: 'house',    color: 0xffe066, boss: true, moves: [{ k: 'jam', n: 3 }, { k: 'atk', v: 14 }, { k: 'atk', v: 6, n: 4 }, { k: 'block', v: 20 }, { k: 'buff', v: 3 }, { k: 'atk', v: 24 }] },
};

/** The stops of every sector, in order. */
export const COURSE = ['fight', 'fight', 'way', 'fight', 'boss'];

export const SECTORS = [
    {
        name: 'The Rust Rings', blurb: 'Junk-belt pirates and their drones guard the first gate.',
        early: [['drone'], ['moth', 'moth']],
        mid: [['gunner'], ['drone', 'moth'], ['drone', 'drone']],
        boss: ['croupier'],
    },
    {
        name: 'Nebula Reach', blurb: 'A violet sea of gas where the stolen stars were towed.',
        early: [['jackal'], ['squid']],
        mid: [['knight'], ['jackal', 'jackal'], ['squid', 'jackal']],
        boss: ['wyrm'],
    },
    {
        name: 'The House', blurb: 'The casino station at the end of space. The House always wins. Until now.',
        early: [['dealer'], ['leech', 'leech']],
        mid: [['golem'], ['dealer', 'leech'], ['golem', 'leech']],
        boss: ['house'],
    },
];

/**
 * The Constellation's nodes. `minor` nodes fill most rows; `key` nodes fill the keystone rows;
 * `top` is the single star at the top every path leads to.
 */
export const NODES = {
    hull:        { name: 'Hull Plating',   tier: 'minor', w: 2,   icon: 'mend',   text: '+8 max HP, and repair 8.' },
    plating:     { name: 'Deflector',      tier: 'minor', w: 1,   icon: 'shield', text: 'Start every fight with 6 Block.' },
    sharp:       { name: 'Focusing Lens',  tier: 'minor', w: 1.5, icon: 'blade',  text: '+1 to every Starblade and Comet on the payline.' },
    etch_blade:  { name: 'Etch Starblade', tier: 'minor', w: 1,   icon: 'blade',  text: 'Starblades hit 50% harder.' },
    etch_comet:  { name: 'Etch Comet',     tier: 'minor', w: 1,   icon: 'comet',  text: 'Comets hit 50% harder.' },
    etch_hex:    { name: 'Etch Hex Moon',  tier: 'minor', w: 1,   icon: 'hex',    text: 'Hex Moons burn 50% more.' },
    etch_shield: { name: 'Etch Aegis',     tier: 'minor', w: 1,   icon: 'shield', text: 'Aegis blocks 50% more.' },
    etch_mend:   { name: 'Etch Nova Mend', tier: 'minor', w: 0.8, icon: 'mend',   text: 'Nova Mend repairs 50% more.' },
    wild:        { name: 'Lucky Star',     tier: 'minor', w: 1,   icon: 'wild',   text: 'Add a Wild Star to every reel.' },
    leech:       { name: 'Siphon Edge',    tier: 'minor', w: 1,   icon: 'blade',  text: 'Each Starblade in a firing group repairs 1.' },
    spark:       { name: 'Spark Coil',     tier: 'minor', w: 1,   icon: 'charge', text: 'Your first nudge or respin each turn is free.' },
    salvage:     { name: 'Salvage Drones', tier: 'minor', w: 1,   icon: 'mend',   text: 'Repair 5 after every won fight.' },

    reel:        { name: 'Extra Reel',     tier: 'key', icon: 'reel',   text: '+1 reel: one more symbol on the payline (up to five).' },
    capacitor:   { name: 'Capacitor',      tier: 'key', icon: 'charge', text: '+1 Energy every turn.' },
    jackpot:     { name: 'Jackpot Core',   tier: 'key', icon: 'wild',   text: 'Three or more of a kind are multiplied one step more (+1×).' },
    twin:        { name: 'Twin Suns',      tier: 'key', icon: 'comet',  text: 'Pairs hit ×2 instead of ×1.5.' },
    filter:      { name: 'Static Filter',  tier: 'key', icon: 'static', text: 'Static on the payline counts as a Wild Star.' },
    aegis:       { name: 'Aegis Memory',   tier: 'key', icon: 'shield', text: 'Block halves at the end of your turn instead of vanishing.' },

    supernova:   { name: 'Supernova Heart', tier: 'top', icon: 'wild',  text: 'All damage +25% and +1 Energy every turn.' },
};

/** Constellation shape: rows from the bottom; these rows hold keystones. */
export const TREE = { rows: 11, cols: 4, keyRows: [3, 7], paths: 6 };

/**
 * data.js — static tables: gems, stats, classes, spells, potions, blessings, resources.
 *
 * Spell effects are lists of ops interpreted by battle.js:
 *   dmg n · heal n · shield n · burn n,turns · stun turns · mana color|all,n · drain color|all,n
 *   destroyColor gem,per,collect · convert from,to,count · destroyRandom count,collect
 *   destroyRows count · destroyArea (3×3 centre) · special kind,count · buff key,n,turns
 * Numbers in dmg/heal/shield/burn/per are multiplied by the caster's spell power.
 */

// ------------------------------------------------------------------ Gems

export const G = { FIRE: 0, WATER: 1, LEAF: 2, SPARK: 3, SKULL: 4, COIN: 5, STAR: 6, PRISM: 7 };
export const GEM_COUNT = 7;                 // regular gem types that spawn
export const MANA = ['fire', 'water', 'leaf', 'spark'];
export const GEM_INFO = [
    { id: 'fire',  name: 'Fire',  icon: '🔥', color: '#ff4a3d' },
    { id: 'water', name: 'Water', icon: '💧', color: '#2f9bff' },
    { id: 'leaf',  name: 'Leaf',  icon: '🍃', color: '#3fd26a' },
    { id: 'spark', name: 'Spark', icon: '⚡', color: '#ffd23a' },
    { id: 'skull', name: 'Skull', icon: '💀', color: '#f4efe6' },
    { id: 'coin',  name: 'Coin',  icon: '🪙', color: '#ffb52e' },
    { id: 'star',  name: 'Star',  icon: '⭐', color: '#b46bff' },
    { id: 'prism', name: 'Prism', icon: '🌈', color: '#ffffff' },
];
export const GEM_BY_ID = Object.fromEntries(GEM_INFO.map((g, i) => [g.id, i]));

/** Special overlays on a gem. */
export const SP = { NONE: 0, LINE_H: 1, LINE_V: 2, BOMB: 3 };

// ------------------------------------------------------------------ Resources

export const RES = ['gold', 'wood', 'stone', 'herbs', 'crystal', 'ink'];
export const RES_INFO = {
    gold:    { name: 'Gold',    icon: '🪙', color: '#ffc531' },
    wood:    { name: 'Wood',    icon: '🪵', color: '#c47a3a' },
    stone:   { name: 'Stone',   icon: '🪨', color: '#a9b4c2' },
    herbs:   { name: 'Herbs',   icon: '🌿', color: '#4fdc7a' },
    crystal: { name: 'Crystal', icon: '💎', color: '#7fd8ff' },
    ink:     { name: 'Ink',     icon: '🖋️', color: '#b48cff' },
};

// ------------------------------------------------------------------ Stats

export const STATS = ['might', 'arcana', 'vitality', 'focus', 'fortune'];
export const STAT_INFO = {
    might:    { name: 'Might',    icon: '💪', desc: '+1 skull damage per 3 points. Powers warrior spells.' },
    arcana:   { name: 'Arcana',   icon: '✨', desc: 'Powers mage spells (+7% per point).' },
    vitality: { name: 'Vitality', icon: '❤️', desc: '+6 max HP per point.' },
    focus:    { name: 'Focus',    icon: '🔮', desc: '+1 mana capacity per colour per point.' },
    fortune:  { name: 'Fortune',  icon: '🍀', desc: '+3% gold, +2% XP and +1.5% skull crit chance per point.' },
};
export const POINTS_PER_LEVEL = 3;
export const MAX_LEVEL = 50;

export const CLASSES = {
    mage: {
        id: 'mage', name: 'Mage', icon: '🧙', scale: 'arcana',
        base: { might: 2, arcana: 7, vitality: 5, focus: 6, fortune: 3 },
        prefer: ['arcana', 'vitality', 'focus', 'arcana', 'vitality', 'fortune'],
        blurb: 'Bends the board with spells. Fragile, clever, extremely well-read.',
        startName: 'Wren',
    },
    warrior: {
        id: 'warrior', name: 'Warrior', icon: '🛡️', scale: 'might',
        base: { might: 7, arcana: 2, vitality: 6, focus: 3, fortune: 3 },
        prefer: ['might', 'vitality', 'focus', 'might', 'fortune', 'vitality'],
        blurb: 'Turns skulls into big numbers. Sturdy, loud, surprisingly polite.',
        startName: 'Rowan',
    },
};

export function xpToNext(level) { return Math.round(50 + 34 * level + 4.2 * level * level); }

// ------------------------------------------------------------------ Spells

export const SPELLS = {
    // ---- Mage
    firebolt:   { name: 'Firebolt', cls: 'mage', lvl: 1, icon: '🔥', cost: { fire: 6 }, ops: [{ op: 'dmg', n: 10, el: 'fire' }], desc: 'Hurl a bolt of fire for {dmg} damage.' },
    frostward:  { name: 'Frost Ward', cls: 'mage', lvl: 1, icon: '❄️', cost: { water: 6 }, ops: [{ op: 'shield', n: 13 }], desc: 'Gain a {shield}-point ice shield.' },
    chainspark: { name: 'Chain Spark', cls: 'mage', lvl: 3, icon: '⚡', cost: { spark: 7 }, ops: [{ op: 'destroyColor', gem: 3, per: 2.2, collect: false, el: 'spark' }], desc: 'Shatter every Spark gem; {per} damage each.' },
    manabloom:  { name: 'Mana Bloom', cls: 'mage', lvl: 5, icon: '🌸', cost: { leaf: 6 }, quick: true, ops: [{ op: 'mana', color: 'fire', n: 4 }, { op: 'mana', color: 'water', n: 4 }, { op: 'mana', color: 'spark', n: 4 }], desc: 'Quick: gain 4 Fire, Water and Spark mana.' },
    iceprison:  { name: 'Ice Prison', cls: 'mage', lvl: 8, icon: '🧊', cost: { water: 9, spark: 3 }, ops: [{ op: 'dmg', n: 7, el: 'water' }, { op: 'stun', turns: 1 }], desc: '{dmg} damage and freeze the foe for a turn.' },
    inferno:    { name: 'Inferno', cls: 'mage', lvl: 12, icon: '🌋', cost: { fire: 12 }, ops: [{ op: 'dmg', n: 15, el: 'fire' }, { op: 'burn', n: 4, turns: 3 }], desc: '{dmg} damage, then burn for {burn} a turn for 3 turns.' },
    arcaneprism:{ name: 'Arcane Prism', cls: 'mage', lvl: 16, icon: '🌈', cost: { spark: 6, water: 6 }, quick: true, ops: [{ op: 'special', kind: 'prism', count: 1 }, { op: 'special', kind: 'line', count: 1 }], desc: 'Quick: conjure a Prism gem and a Line gem.' },
    meteor:     { name: 'Meteor', cls: 'mage', lvl: 22, icon: '☄️', cost: { fire: 14, leaf: 6 }, ops: [{ op: 'dmg', n: 26, el: 'fire' }, { op: 'destroyArea' }], desc: '{dmg} damage and blast the centre of the board.' },
    starfall:   { name: 'Starfall', cls: 'mage', lvl: 28, icon: '🌠', cost: { water: 10, spark: 10 }, ops: [{ op: 'dmg', n: 12, el: 'spark' }, { op: 'destroyRandom', count: 14, collect: true }], desc: '{dmg} damage, then 14 gems fall to you.' },
    // ---- Warrior
    cleave:     { name: 'Cleave', cls: 'warrior', lvl: 1, icon: '🪓', cost: { fire: 5 }, ops: [{ op: 'dmg', n: 9, el: 'fire' }], desc: 'A mighty swing for {dmg} damage.' },
    secondwind: { name: 'Second Wind', cls: 'warrior', lvl: 1, icon: '🌿', cost: { leaf: 6 }, ops: [{ op: 'heal', n: 14 }], desc: 'Catch your breath and heal {heal}.' },
    shieldwall: { name: 'Shield Wall', cls: 'warrior', lvl: 3, icon: '🛡️', cost: { water: 6 }, ops: [{ op: 'shield', n: 15 }], desc: 'Raise a {shield}-point shield.' },
    battlecry:  { name: 'Battle Cry', cls: 'warrior', lvl: 5, icon: '📯', cost: { spark: 6 }, quick: true, ops: [{ op: 'buff', key: 'skull', n: 2, turns: 3 }], desc: 'Quick: skulls deal +2 each for 3 turns.' },
    bonecrusher:{ name: 'Bonecrusher', cls: 'warrior', lvl: 8, icon: '🦴', cost: { fire: 8, leaf: 3 }, ops: [{ op: 'convert', from: 3, to: 4 }], desc: 'Turn every Spark gem into a Skull.' },
    whirlwind:  { name: 'Whirlwind', cls: 'warrior', lvl: 12, icon: '🌪️', cost: { spark: 10 }, ops: [{ op: 'destroyRows', count: 2 }], desc: 'Sweep two rows clean; every gem counts for you.' },
    warstomp:   { name: 'War Stomp', cls: 'warrior', lvl: 16, icon: '🦶', cost: { leaf: 10, water: 4 }, ops: [{ op: 'dmg', n: 11 }, { op: 'stun', turns: 1 }], desc: '{dmg} damage and stun the foe for a turn.' },
    berserk:    { name: 'Berserk', cls: 'warrior', lvl: 22, icon: '😤', cost: { fire: 12, spark: 6 }, quick: true, ops: [{ op: 'buff', key: 'skullMult', n: 2, turns: 2 }], desc: 'Quick: skulls deal double damage for 2 turns.' },
    titansfury: { name: "Titan's Fury", cls: 'warrior', lvl: 28, icon: '⚔️', cost: { fire: 10, water: 6, leaf: 6 }, ops: [{ op: 'dmg', n: 16 }, { op: 'destroyColor', gem: 4, per: 0, collect: true }], desc: '{dmg} damage, then smash every Skull for you.' },
    // ---- Book
    clockbomb:  { name: 'Clockwork Bomb', cls: 'book', lvl: 1, icon: '⏰', cost: { spark: 8, water: 4 }, quick: true, ops: [{ op: 'special', kind: 'bomb', count: 3 }], desc: 'Quick: wind up three Bomb gems.' },
};
export const SPELL_IDS = Object.keys(SPELLS);
export const MAX_RANK = 5;
export function rankMult(rank) { return 1 + 0.15 * ((rank || 1) - 1); }

// ------------------------------------------------------------------ Potions

export const POTIONS = {
    heal:  { name: 'Healing Draught', icon: '🧪', alch: 1, cost: { herbs: 12, gold: 15 }, desc: 'Heal 30% of your max HP.' },
    mana:  { name: 'Mana Tonic', icon: '🫙', alch: 1, cost: { herbs: 10, crystal: 4 }, desc: 'Gain 6 mana of every colour.' },
    bomb:  { name: 'Bomb Flask', icon: '💣', alch: 2, cost: { herbs: 8, stone: 18 }, desc: 'Turn two gems into Bombs.' },
    skull: { name: 'Skull Oil', icon: '☠️', alch: 3, cost: { herbs: 12, stone: 12 }, desc: 'Turn six random gems into Skulls.' },
    prism: { name: 'Prism Phial', icon: '🔮', alch: 4, cost: { crystal: 16, herbs: 6 }, desc: 'Turn a gem into a Prism.' },
    swift: { name: 'Swiftness Brew', icon: '🥤', alch: 5, cost: { herbs: 16, crystal: 10 }, desc: 'Your next move grants an extra turn.' },
};
export const POTION_IDS = Object.keys(POTIONS);

// ------------------------------------------------------------------ Blessings (shrines)

export const BLESSINGS = {
    ember:   { name: 'Blessing of Embers', icon: '🔥', desc: 'Start battles with +6 Fire mana.' },
    tide:    { name: 'Blessing of Tides', icon: '🌊', desc: 'Start battles with +6 Water mana.' },
    grove:   { name: 'Blessing of the Grove', icon: '🌳', desc: 'Start battles with +6 Leaf mana.' },
    storm:   { name: 'Blessing of Storms', icon: '🌩️', desc: 'Start battles with +6 Spark mana.' },
    might:   { name: 'Blessing of Might', icon: '💪', desc: 'Skulls deal +2 damage.' },
    aegis:   { name: 'Blessing of the Aegis', icon: '🛡️', desc: 'Start battles with a 15-point shield.' },
    fortune: { name: 'Blessing of Fortune', icon: '🍀', desc: '+40% gold from battles.' },
    wisdom:  { name: 'Blessing of Wisdom', icon: '🦉', desc: '+40% XP from battles.' },
};
export const BLESSING_IDS = Object.keys(BLESSINGS);
export const BLESSING_BATTLES = 4;

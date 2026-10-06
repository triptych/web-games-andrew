// Monster table. hp / dmg are level-1 values; js/sim/world.js scales them by monster level
// (hpScale / dmgScale below) and by difficulty. `ai` picks a brain in js/sim/ai.js;
// `model` picks a body in js/view/actors.js.

export const MONSTERS = {
    grape: {
        name: 'Moldy Grape', model: 'grape', ai: 'melee', hp: 15, dmg: [2, 4], speed: 2.3, r: 0.32,
        range: 0.95, windup: 0.42, cd: 1.15, xp: 6, pack: [3, 6], elem: 'phys',
        quips: ['Braaains... no wait, raisins...', 'Grrrape.'],
    },
    fly: {
        name: 'Fruit Fly', model: 'fly', ai: 'swarm', hp: 7, dmg: [1, 3], speed: 4.6, r: 0.24, flying: true,
        range: 0.85, windup: 0.22, cd: 0.8, xp: 4, pack: [4, 8], elem: 'phys',
    },
    peelton: {
        name: 'Banana Peelton', model: 'peelton', ai: 'melee', hp: 20, dmg: [3, 5], speed: 2.7, r: 0.34,
        range: 1.05, windup: 0.4, cd: 1.1, xp: 8, pack: [2, 4], elem: 'phys', reassemble: 0.3,
    },
    archer: {
        name: 'Peelton Pitcher', model: 'archer', ai: 'ranged', hp: 14, dmg: [2, 4], speed: 2.5, r: 0.32,
        range: 7.5, keep: 5, windup: 0.55, cd: 1.9, xp: 8, pack: [2, 3], elem: 'phys', proj: 'peel', projSpeed: 9,
    },
    worm: {
        name: 'Apple Worm', model: 'worm', ai: 'burrow', hp: 18, dmg: [3, 6], speed: 3.4, r: 0.3,
        range: 1.0, windup: 0.35, cd: 1.0, xp: 9, pack: [1, 3], elem: 'pois',
    },
    eggplant: {
        name: 'Eggplant Shaman', model: 'eggplant', ai: 'shaman', hp: 16, dmg: [2, 4], speed: 2.4, r: 0.32,
        range: 6.5, keep: 6, windup: 0.6, cd: 2.4, xp: 12, pack: [1, 2], elem: 'pois', proj: 'spore', projSpeed: 7,
        heal: 0.35, revive: true,
    },
    tomato: {
        name: 'Rotten Tomato', model: 'tomato', ai: 'kamikaze', hp: 12, dmg: [7, 11], speed: 3.6, r: 0.33,
        range: 1.1, windup: 0.55, cd: 0, xp: 7, pack: [3, 5], elem: 'pois', blast: 1.9,
    },
    lemon: {
        name: 'Sour Lemon', model: 'lemon', ai: 'ranged', hp: 17, dmg: [3, 5], speed: 2.4, r: 0.32,
        range: 7, keep: 5, windup: 0.5, cd: 2.1, xp: 10, pack: [2, 4], elem: 'pois', proj: 'acid', projSpeed: 8, puddle: true,
    },
    cactus: {
        name: 'Prickly Pear', model: 'cactus', ai: 'turret', hp: 30, dmg: [3, 5], speed: 0, r: 0.42,
        range: 8, windup: 0.7, cd: 2.6, xp: 12, pack: [1, 2], elem: 'phys', proj: 'needle', projSpeed: 10, needles: 10,
    },
    crab: {
        name: 'Coconut Crab', model: 'crab', ai: 'charger', hp: 42, dmg: [5, 9], speed: 2.1, r: 0.44,
        range: 1.15, windup: 0.5, cd: 1.4, xp: 16, pack: [1, 3], elem: 'phys', armor: 0.3,
    },
    pumpkin: {
        name: "Jack o' Lantern", model: 'pumpkin', ai: 'caster', hp: 26, dmg: [5, 8], speed: 2.4, r: 0.4, flying: true,
        range: 8, keep: 6, windup: 0.65, cd: 2.2, xp: 16, pack: [1, 3], elem: 'fire', proj: 'ember', projSpeed: 9, blink: true,
    },
    chili: {
        name: 'Chili Imp', model: 'chili', ai: 'melee', hp: 18, dmg: [5, 8], speed: 4.1, r: 0.3,
        range: 0.95, windup: 0.3, cd: 0.9, xp: 11, pack: [3, 6], elem: 'fire', deathBlast: 1.5,
    },
    durian: {
        name: 'Durian Brute', model: 'durian', ai: 'brute', hp: 70, dmg: [8, 13], speed: 1.9, r: 0.58,
        range: 1.35, windup: 0.7, cd: 1.6, xp: 30, pack: [1, 2], elem: 'phys', stink: true,
    },
    mimic: {
        name: 'Pie Mimic', model: 'mimic', ai: 'mimic', hp: 55, dmg: [7, 12], speed: 3.2, r: 0.46,
        range: 1.2, windup: 0.4, cd: 1.0, xp: 40, pack: [1, 1], elem: 'phys',
    },

    // ---------------------------------------------------------------- bosses
    juicer: {
        name: 'The Juicer', model: 'juicer', ai: 'juicer', hp: 340, dmg: [8, 13], speed: 2.5, r: 0.85, boss: true,
        range: 1.7, windup: 0.6, cd: 1.3, xp: 400, elem: 'phys',
        intro: 'Ahh… FRESH FRUIT!', title: 'Butcher of the Root Cellar',
    },
    mango: {
        name: 'Mangophisto', model: 'mango', ai: 'mango', hp: 900, dmg: [14, 22], speed: 2.3, r: 0.8, boss: true, flying: true,
        range: 9, keep: 5, windup: 0.6, cd: 1.6, xp: 1400, elem: 'fire', proj: 'chutney', projSpeed: 9,
        intro: 'You dare disturb the CHUTNEY LORD?', title: 'Lord of Chutney',
    },
    durianlord: {
        name: 'Durian the Diabolical', model: 'durianlord', ai: 'durianlord', hp: 2000, dmg: [22, 34], speed: 2.4, r: 1.05, boss: true,
        range: 2.0, windup: 0.7, cd: 1.5, xp: 4000, elem: 'pois',
        intro: 'SMELL… MY… POWER!', title: 'Prime Evil of the Orchard',
    },
    thief: {
        name: 'Toothpick Thief', model: 'peelton', ai: 'melee', hp: 26, dmg: [5, 8], speed: 3.3, r: 0.36,
        range: 1.05, windup: 0.4, cd: 1.0, xp: 60, elem: 'phys',
    },
};

/** Monster level → multiplier on base hp / damage / xp. */
export const hpScale = (L) => 1 + 0.3 * (L - 1) + 0.012 * (L - 1) ** 2;
export const dmgScale = (L) => 1 + 0.17 * (L - 1) + 0.0035 * (L - 1) ** 2;
export const xpScale = (L) => 1 + 0.28 * (L - 1) + 0.006 * (L - 1) ** 2;

/** Champion / unique modifiers. */
export const ELITE_MODS = {
    juicy:  { name: 'Extra Juicy', hp: 1.0 },
    speedy: { name: 'Speedy',      speed: 0.45 },
    spicy:  { name: 'Spicy',       elem: 'fire', deathBlast: 2.2 },
    frosty: { name: 'Frosty',      elem: 'cold', chill: true },
    stinky: { name: 'Stinky',      aura: 'pois' },
    bouncy: { name: 'Bouncy',      knock: 3 },
    thorny: { name: 'Thorny',      thorns: 0.25 },
    sticky: { name: 'Sticky',      trail: true },
};

const FIRST = ['Gary', 'Barbara', 'Mo', 'Pete', 'Fred', 'Doris', 'Kevin', 'Brenda', 'Nigel', 'Mildred', 'Chad', 'Gus', 'Tilly', 'Rupert', 'Wanda', 'Clive', 'Bertha', 'Stan'];
const TITLE = ['the Overripe', 'the Squishy', 'the Bruised', 'the Fermented', 'the Mushy', 'the Sticky', 'Moldbeard', 'the Pungent', 'the Unwashed', 'the Pulpy', 'Squishface', 'the Gnarly', 'the Wrinkly', 'the Soggy', 'of the Compost', 'the Fuzzy'];
export function uniqueName(rng) { return `${rng.pick(FIRST)} ${rng.pick(TITLE)}`; }

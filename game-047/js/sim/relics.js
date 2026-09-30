/**
 * relics.js — passive relics and one-shot elixirs.
 *
 * A relic's effect is a fixed rule, checked by id where it applies (combat.js,
 * run.js). Its *name* is procedural: every run gives each relic an owner from
 * the syllable tables, so the same Whetstone is "Old Marrow's Whetstone" in one
 * run and "Tamsin Vey's Whetstone" in the next.
 */

import { makeRng, hashSeed, hashStr } from './rng.js';

// rarity: 1 common, 2 uncommon, 3 rare, 'hero' starter, 'crown' boss drop
export const RELICS = {
    // --- hero starters
    oathbrand: { name: 'Oath-Brand', rarity: 'hero', icon: 'sword', text: 'The first line each turn that holds Blades deals +30% damage.' },
    kettle: { name: 'Ember Kettle', rarity: 'hero', icon: 'kettle', text: 'Hearts also deal half their healing as damage to your target.' },
    loadedDie: { name: 'Loaded Die', rarity: 'hero', icon: 'die', text: '+1 Redraw each turn. Gain 15% more gold.' },

    // --- suit & rank chips
    whetstone: { name: 'Whetstone', rarity: 1, icon: 'sword', text: 'Blades cards score +2 chips.' },
    runestaff: { name: 'Runestaff', rarity: 1, icon: 'staff', text: 'Staves cards score +2 chips.' },
    ironring: { name: 'Iron Ring', rarity: 1, icon: 'ring', text: 'Coins cards score +2 chips.' },
    heartwood: { name: 'Heartwood Locket', rarity: 1, icon: 'heart', text: 'Hearts cards score +2 chips.' },
    smallPips: { name: 'Pauper\'s Dice', rarity: 1, icon: 'die', text: 'Cards ranked 2–5 score +3 chips.' },
    portrait: { name: 'Portrait Locket', rarity: 1, icon: 'face', text: 'Jacks, Queens and Kings score +4 chips.' },
    aceband: { name: 'Ace Band', rarity: 2, icon: 'ring', text: 'Aces score +8 chips.' },

    // --- hand types
    twinStones: { name: 'Twin Stones', rarity: 1, icon: 'stones', text: 'Pairs and Two Pairs get +0.75 mult.' },
    lonelyCrown: { name: 'Lonely Crown', rarity: 1, icon: 'crown', text: 'High Card lines score double.' },
    monoSeal: { name: 'Monochrome Seal', rarity: 2, icon: 'seal', text: 'Flushes get +1.5 mult.' },
    stair: { name: 'Stair of Kings', rarity: 2, icon: 'stair', text: 'Straights get +1.5 mult.' },
    kinMirror: { name: 'Mirror of Kin', rarity: 2, icon: 'mirror', text: 'Three and Four of a Kind get +1.5 mult.' },
    hearth: { name: 'Hearth and Home', rarity: 2, icon: 'house', text: 'Full Houses get +2 mult and heal 5.' },

    // --- geometry
    crossroads: { name: 'Crossroads Sigil', rarity: 2, icon: 'cross', text: 'Crosses give ×2 instead of ×1.5.' },
    compass: { name: 'Slanted Compass', rarity: 1, icon: 'compass', text: 'Diagonals give ×2 instead of ×1.25.' },
    firstBlood: { name: 'Tallow of First Blood', rarity: 1, icon: 'candle', text: 'The first line you fire each combat scores double.' },

    // --- tempo
    lantern: { name: 'Early Lantern', rarity: 1, icon: 'lantern', text: '+1 Deal on the first turn of each combat.' },
    hourglass: { name: 'Sand Hourglass', rarity: 1, icon: 'hourglass', text: '+1 Redraw each turn.' },
    pockets: { name: 'Deep Pockets', rarity: 2, icon: 'bag', text: 'Draw up to 6 cards instead of 5.' },
    quickHand: { name: 'Quickened Hand', rarity: 3, icon: 'hand', text: '+1 Deal each turn.' },
    philosopher: { name: 'Philosopher\'s Ink', rarity: 2, icon: 'quill', text: 'Arcana cost 0 on your first turn.' },

    // --- defence & sustain
    bastion: { name: 'Bastion Charm', rarity: 1, icon: 'shield', text: 'Start each combat with 10 Ward.' },
    stoneskin: { name: 'Stoneskin Salve', rarity: 2, icon: 'shield', text: 'Gain 4 Ward at the start of each turn.' },
    bloodVial: { name: 'Blood Vial', rarity: 1, icon: 'vial', text: 'Heal 5 at the end of each combat.' },
    regenMoss: { name: 'Mending Moss', rarity: 1, icon: 'leaf', text: 'Start each combat with 4 Regen.' },
    chalice: { name: 'Pilgrim\'s Chalice', rarity: 1, icon: 'cup', text: 'Healing from Hearts is 50% stronger.' },
    vampFang: { name: 'Vampire Fang', rarity: 2, icon: 'fang', text: 'Heal 10% of the damage your Blades deal.' },
    thornmail: { name: 'Thornmail', rarity: 2, icon: 'thorn', text: 'When an enemy hits you, it takes 3 damage.' },
    phoenix: { name: 'Phoenix Feather', rarity: 3, icon: 'feather', text: 'The first time you would die, revive at 40% HP instead. Then it crumbles.' },

    // --- offence
    emberCoal: { name: 'Everburning Coal', rarity: 2, icon: 'flame', text: 'Whenever you fire a line, apply 1 Burn to every enemy.' },
    warhorn: { name: 'War Horn', rarity: 2, icon: 'horn', text: 'Enemies start each combat with 2 Exposed.' },
    veil: { name: 'Mourning Veil', rarity: 1, icon: 'veil', text: 'Enemies start each combat with 2 Weak.' },
    brazier: { name: 'Brazier of Wrath', rarity: 2, icon: 'flame', text: 'Burn you apply is doubled.' },
    whalebone: { name: 'Whalebone Tally', rarity: 1, icon: 'bone', text: 'Start each combat with 1 Might.' },

    // --- economy & meta
    idol: { name: 'Golden Idol', rarity: 1, icon: 'idol', text: 'Gain 2 gold for every line you fire.' },
    badge: { name: 'Merchant\'s Badge', rarity: 1, icon: 'coin', text: 'Merchants charge 20% less.' },
    clover: { name: 'Four-leaf Clover', rarity: 1, icon: 'leaf', text: 'Card rewards offer 4 choices.' },
    satchel: { name: 'Alchemist\'s Satchel', rarity: 2, icon: 'bag', text: '+1 elixir slot.' },
    pillow: { name: 'Goose-down Pillow', rarity: 1, icon: 'pillow', text: 'Resting heals an extra 15% of your max HP.' },
    seerEye: { name: 'Seer\'s Eye', rarity: 2, icon: 'eye', text: 'Seals and Frost on the table last 1 turn.' },

    // --- Warden crowns
    crownAsh: { name: 'Crown of Ash', rarity: 'crown', icon: 'crown', text: 'Staves cards score +3 chips. +1 Deal on the first turn of each combat.' },
    crownTides: { name: 'Crown of Tides', rarity: 'crown', icon: 'crown', text: 'Heal 3 whenever you fire a line.' },
    crownBriars: { name: 'Crown of Briars', rarity: 'crown', icon: 'crown', text: 'When an enemy hits you, it takes 5 damage.' },
    crownMirage: { name: 'Crown of Mirages', rarity: 'crown', icon: 'crown', text: 'Draw up to 1 more card. +1 Redraw each turn.' },
    crownRime: { name: 'Crown of Rime', rarity: 'crown', icon: 'crown', text: 'Gain 6 Ward at the start of each turn.' },
    crownMammon: { name: 'Mammon\'s Crown', rarity: 'crown', icon: 'crown', text: 'Gain 50% more gold. Coins also deal half their Ward as damage.' },
    crownStorm: { name: 'Crown of Storms', rarity: 'crown', icon: 'crown', text: 'Whenever you fire a Cross, deal 20 damage to every enemy.' },
    crownJoker: { name: 'The Harlequin\'s Joker', rarity: 'crown', icon: 'joker', text: 'Start each combat with a Joker in hand. Something about it is unfinished.' },
    crownDeep: { name: 'Crown of the Deep', rarity: 'crown', icon: 'crown', text: 'Every line gets +0.75 mult.' },
};
export const RELIC_KEYS = Object.keys(RELICS);

const OWNER_FIRST = ['Old', 'Mother', 'Brother', 'Sister', 'Widow', 'Captain', 'Saint', 'Blind', 'Grey', 'Little', 'Lady', 'Lord', 'Magister', 'Hedge-witch', 'Ferryman'];
const OWNER_NAME = ['Marrow', 'Tamsin', 'Oswin', 'Vey', 'Hollis', 'Brannoc', 'Idra', 'Corvel', 'Ysolde', 'Pell', 'Anwen', 'Dunstan', 'Merrow', 'Sabine', 'Thackery', 'Ilse', 'Rook', 'Fenna', 'Aldous', 'Wynn'];

/** Procedural relic name for this run. Crowns and hero relics keep their names. */
export function relicName(id, runSeed) {
    const r = RELICS[id];
    if (!r) return id;
    if (r.rarity === 'crown' || r.rarity === 'hero') return r.name;
    const rng = makeRng(hashSeed(runSeed, hashStr(id)));
    const owner = rng.chance(0.5) ? `${rng.pick(OWNER_FIRST)} ${rng.pick(OWNER_NAME)}` : rng.pick(OWNER_NAME);
    return `${owner}'s ${r.name}`;
}

export function rollRelic(rng, owned, { rarity = null } = {}) {
    const have = new Set(owned);
    let pool = RELIC_KEYS.filter((k) => !have.has(k) && typeof RELICS[k].rarity === 'number');
    if (rarity) {
        const p = pool.filter((k) => RELICS[k].rarity === rarity);
        if (p.length) pool = p;
    } else {
        // weight by rarity: commons 3, uncommon 2, rare 1
        const weighted = [];
        for (const k of pool) for (let i = 0; i < 4 - RELICS[k].rarity; i++) weighted.push(k);
        pool = weighted;
    }
    return pool.length ? rng.pick(pool) : null;
}

export function relicPrice(id) {
    const r = RELICS[id].rarity;
    return r === 1 ? 150 : r === 2 ? 210 : 290;
}

// ------------------------------------------------------------------ elixirs

export const ELIXIRS = {
    heal: { name: 'Healing Draught', color: '#ff5a6a', text: (w) => `Heal ${healAmt(w)} HP.` },
    ironbark: { name: 'Ironbark Tonic', color: '#c8a060', text: (w) => `Gain ${12 + w * 5} Ward.` },
    dragonfire: { name: 'Dragonfire Flask', color: '#ff8a20', text: (w) => `Deal ${12 + w * 6} damage to ALL enemies.` },
    quicken: { name: 'Quickening Draught', color: '#60e0ff', text: () => 'Gain 2 Deals this turn.' },
    fortune: { name: 'Fortune\'s Tea', color: '#90ff90', text: () => 'Discard your hand and draw a fresh one. +1 Redraw.' },
    luck: { name: 'Liquid Luck', color: '#ffe060', text: () => 'The next line you fire this combat scores double.' },
    antidote: { name: 'Antidote', color: '#a0ffd0', text: () => 'Remove all your debuffs. Gain 4 Regen.' },
    strength: { name: 'Giant\'s Tincture', color: '#ff6040', text: () => 'Gain 3 Might for this combat.' },
};
export const ELIXIR_KEYS = Object.keys(ELIXIRS);
export function healAmt(w) { return 18 + w * 4; }
export function elixirPrice() { return 55; }

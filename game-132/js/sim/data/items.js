// TITAN'S VAULT: item bases, rarities, affixes, gems, sets and legendary powers. Pure data.
// An item instance is plain JSON: { id, base, rarity, ilvl, affixes: [{ k, v }], sockets: [gemId|null], uniq?, set? }.
// Affix values are rolled from [lo, hi] × the tier of the item level (ITEM.tier in config.js), so a level-30 ring
// rolls about three times a level-1 ring and a perfect roll is something you can see and chase.

export const SLOTS = ['weapon', 'helm', 'chest', 'gloves', 'boots', 'amulet', 'ring1', 'ring2'];
export const SLOT_NAMES = { weapon: 'Weapon', helm: 'Helm', chest: 'Chest', gloves: 'Gloves', boots: 'Boots', amulet: 'Amulet', ring1: 'Ring', ring2: 'Ring' };

/** Rarity tiers, Common → Mythic. weight: drop share at magic find 0. affixes: [min, max] random affixes. */
export const RARITIES = {
    common: { name: 'Common', color: '#d8d8d8', hex: 0xd8d8d8, weight: 600, affixes: [0, 0], beam: false },
    magic: { name: 'Magic', color: '#5b8cff', hex: 0x5b8cff, weight: 300, affixes: [1, 2], beam: false },
    rare: { name: 'Rare', color: '#ffd84a', hex: 0xffd84a, weight: 85, affixes: [3, 5], beam: true },
    set: { name: 'Set', color: '#3fe07a', hex: 0x3fe07a, weight: 7, affixes: [0, 0], beam: true },
    legendary: { name: 'Legendary', color: '#ff8a1e', hex: 0xff8a1e, weight: 7, affixes: [3, 4], beam: true },
    mythic: { name: 'Mythic', color: '#ff3b5c', hex: 0xff3b5c, weight: 0.6, affixes: [4, 4], beam: true },
};
export const RARITY_ORDER = ['common', 'magic', 'rare', 'set', 'legendary', 'mythic'];

/**
 * Bases. dmg: weapon damage [lo, hi] at ilvl 1 (scaled by ITEM.weaponScale); spd: attacks a second.
 * armor: armour at ilvl 1. Some bases carry an implicit (always there, not counted as an affix).
 */
export const BASES = {
    sword: { slot: 'weapon', name: 'Sword', dmg: [6, 10], spd: 1.35, icon: 0, implicit: { k: 'critPct', v: 4 } },
    axe: { slot: 'weapon', name: 'War Axe', dmg: [8, 13], spd: 1.15, icon: 1, implicit: { k: 'critDmgPct', v: 15 } },
    mace: { slot: 'weapon', name: 'Mace', dmg: [9, 12], spd: 1.1, icon: 2, implicit: { k: 'staggerPct', v: 20 } },
    staff: { slot: 'weapon', name: 'Staff', dmg: [7, 12], spd: 1.1, icon: 3, implicit: { k: 'lightningPct', v: 10 } },
    wand: { slot: 'weapon', name: 'Wand', dmg: [5, 9], spd: 1.4, icon: 4, implicit: { k: 'shadowPct', v: 10 } },
    helm: { slot: 'helm', name: 'Helm', armor: 8, icon: 5 },
    chest: { slot: 'chest', name: 'Cuirass', armor: 14, icon: 6 },
    gloves: { slot: 'gloves', name: 'Gauntlets', armor: 5, icon: 7 },
    boots: { slot: 'boots', name: 'Greaves', armor: 5, icon: 8, implicit: { k: 'movePct', v: 5 } },
    amulet: { slot: 'amulet', name: 'Amulet', icon: 9 },
    ring: { slot: 'ring', name: 'Ring', icon: 10 },
};
export const WEAPONS = ['sword', 'axe', 'mace', 'staff', 'wand'];
export const BASE_LIST = Object.keys(BASES);

/** Names that go with each base by level band (for flavour; the stats come from the roll). */
export const BASE_NAMES = {
    sword: ['Rusted Gladius', 'Bronze Xiphos', 'Oathblade', 'Titansteel Falchion'],
    axe: ['Hatchet', 'Bearded Axe', 'Labrys', 'Titan Cleaver'],
    mace: ['Club', 'Flanged Mace', 'Warden\'s Maul', 'Starfall Hammer'],
    staff: ['Gnarled Staff', 'Oracle Staff', 'Skyreach Staff', 'Thunder Pillar'],
    wand: ['Bone Wand', 'Ebon Wand', 'Lich Wand', 'Dusk Sceptre'],
    helm: ['Leather Cap', 'Bronze Helm', 'Crested Helm', 'Titan Visage'],
    chest: ['Padded Vest', 'Bronze Cuirass', 'Scale Hauberk', 'Titanplate'],
    gloves: ['Wraps', 'Bronze Gauntlets', 'Warden\'s Grips', 'Titan Fists'],
    boots: ['Sandals', 'Bronze Greaves', 'Strider Boots', 'Titan Treads'],
    amulet: ['Cord Charm', 'Bronze Torc', 'Silver Locket', 'Titan\'s Eye'],
    ring: ['Copper Band', 'Silver Ring', 'Gold Signet', 'Star Ring'],
};

/**
 * Affixes. pre: prefix (true) or suffix. slots: where it can roll ('any' or a list; 'jewel' = amulet + rings).
 * [lo, hi] at tier 1; the roll is multiplied by the item level tier. flat: the value is never scaled.
 */
export const AFFIXES = {
    // prefixes
    physPct: { pre: true, name: 'Cruel', text: '+{v}% physical damage', lo: 8, hi: 18, slots: ['weapon', 'gloves', 'jewel'] },
    lightningPct: { pre: true, name: 'Crackling', text: '+{v}% lightning damage', lo: 8, hi: 18, slots: ['weapon', 'helm', 'jewel'] },
    shadowPct: { pre: true, name: 'Dusk-touched', text: '+{v}% shadow damage', lo: 8, hi: 18, slots: ['weapon', 'chest', 'jewel'] },
    dmgPct: { pre: true, name: 'Titanic', text: '+{v}% damage', lo: 4, hi: 9, slots: ['weapon', 'amulet', 'ring'] },
    weaponDmg: { pre: true, name: 'Honed', text: '+{v} weapon damage', lo: 2, hi: 5, slots: ['weapon'] },
    armorPct: { pre: true, name: 'Sturdy', text: '+{v}% armour', lo: 10, hi: 30, slots: ['helm', 'chest', 'gloves', 'boots'] },
    life: { pre: true, name: 'Hale', text: '+{v} maximum life', lo: 8, hi: 18, slots: 'any' },
    atkSpeedPct: { pre: true, name: 'Swift', text: '+{v}% attack speed', lo: 3, hi: 7, slots: ['weapon', 'gloves', 'ring'], cap: 30 },
    critDmgPct: { pre: true, name: 'Savage', text: '+{v}% critical damage', lo: 10, hi: 22, slots: ['weapon', 'gloves', 'amulet'] },
    minionPct: { pre: true, name: 'Graveborn', text: '+{v}% companion and shade damage', lo: 10, hi: 25, slots: ['helm', 'amulet', 'weapon'] },
    // suffixes
    might: { pre: false, name: 'of the Bear', text: '+{v} Might', lo: 2, hi: 5, slots: 'any' },
    cunning: { pre: false, name: 'of the Fox', text: '+{v} Cunning', lo: 2, hi: 5, slots: 'any' },
    spirit: { pre: false, name: 'of the Owl', text: '+{v} Spirit', lo: 2, hi: 5, slots: 'any' },
    vitality: { pre: false, name: 'of the Ox', text: '+{v} Vitality', lo: 2, hi: 5, slots: 'any' },
    critPct: { pre: false, name: 'of Precision', text: '+{v}% critical chance', lo: 1, hi: 3, slots: ['weapon', 'helm', 'gloves', 'jewel'], cap: 12 },
    resAll: { pre: false, name: 'of Warding', text: '+{v}% to all resistances', lo: 3, hi: 7, slots: ['chest', 'helm', 'boots', 'jewel'], cap: 30 },
    lifeOnHit: { pre: false, name: 'of the Leech', text: '+{v} life per hit', lo: 1, hi: 3, slots: ['weapon', 'gloves', 'ring'] },
    lifeRegen: { pre: false, name: 'of Mending', text: '+{v} life a second', lo: 1, hi: 3, slots: ['chest', 'amulet', 'ring'] },
    resRegenPct: { pre: false, name: 'of Focus', text: '+{v}% mana, rage and essence gain', lo: 5, hi: 12, slots: ['helm', 'amulet', 'weapon', 'ring'], cap: 40 },
    cdrPct: { pre: false, name: 'of Haste', text: '{v}% shorter cooldowns', lo: 2, hi: 5, slots: ['helm', 'amulet', 'gloves'], cap: 25 },
    movePct: { pre: false, name: 'of the Wind', text: '+{v}% movement speed', lo: 3, hi: 7, slots: ['boots'], cap: 20, flat: true },
    magicFind: { pre: false, name: 'of Fortune', text: '+{v}% magic find', lo: 5, hi: 12, slots: ['helm', 'boots', 'jewel'] },
    goldFind: { pre: false, name: 'of Greed', text: '+{v}% gold found', lo: 10, hi: 25, slots: ['gloves', 'boots', 'jewel'] },
    skillRank: { pre: false, name: 'of the Titan', text: '+1 to all {m} skills', lo: 1, hi: 1, slots: ['amulet', 'helm', 'weapon'], flat: true, mastery: true, rare: true },
    staggerPct: { pre: false, name: 'of Ruin', text: '+{v}% stagger', lo: 10, hi: 20, slots: ['weapon'] },
    critStat: { pre: false, name: 'of Ferocity', text: '+{v}% critical chance', lo: 1, hi: 2, slots: ['ring'], cap: 6 },
};
export const AFFIX_LIST = Object.keys(AFFIXES);

/** Socketable gems: one stat in a weapon, another in armour or jewellery. Three of a grade make one of the next. */
export const GEMS = {
    ruby: { name: 'Ruby', color: '#ff4060', weapon: { k: 'physPct', v: [6, 10, 15, 22] }, armor: { k: 'life', v: [12, 24, 40, 64] }, icon: 11 },
    topaz: { name: 'Topaz', color: '#ffd040', weapon: { k: 'lightningPct', v: [6, 10, 15, 22] }, armor: { k: 'magicFind', v: [6, 10, 15, 22] }, icon: 12 },
    amethyst: { name: 'Amethyst', color: '#b070ff', weapon: { k: 'shadowPct', v: [6, 10, 15, 22] }, armor: { k: 'lifeRegen', v: [2, 4, 7, 11] }, icon: 13 },
    emerald: { name: 'Emerald', color: '#40e080', weapon: { k: 'critDmgPct', v: [12, 20, 30, 45] }, armor: { k: 'resAll', v: [3, 5, 8, 12] }, icon: 14 },
};
export const GEM_GRADES = ['Chipped', 'Flawed', 'Flawless', 'Perfect'];
export const GEM_LIST = Object.keys(GEMS);
/** Sockets a base can have at most. */
export const MAX_SOCKETS = { weapon: 2, helm: 1, chest: 2, gloves: 0, boots: 0, amulet: 1, ring: 0 };

/**
 * Legendary powers: they change how a skill works, not just its numbers. The sim checks `G.player.powers[id]`.
 * Each legendary drops on a fixed base and rolls 3–4 random affixes besides its power.
 */
export const LEGENDARIES = {
    thunderguard: {
        name: 'Thunderguard\'s Edge', base: 'sword', icon: 0, power: 'cleaveArc',
        text: 'Cleave deals lightning damage and arcs to 2 more enemies beyond its reach.',
        art: 'an ornate bronze sword with a blue lightning-veined blade and a storm-cloud pommel',
    },
    wrathforge: {
        name: 'Wrathforge Maul', base: 'mace', icon: 1, power: 'wrathCd',
        text: 'Titan\'s Wrath cooldown is halved, and every third Cleave releases a shockwave for 200% weapon damage.',
        art: 'a massive glowing-orange forge hammer with molten cracks and a golden head',
    },
    soulreaper: {
        name: 'Soulreaper Scythe-Staff', base: 'staff', icon: 2, power: 'rendSplit',
        text: 'Soul Rend strikes 3 targets, and its healing also mends your companion and Shades.',
        art: 'a black staff topped with a curved violet scythe blade and hanging soul lanterns',
    },
    tideeye: {
        name: 'Eye of the Tide', base: 'amulet', icon: 3, power: 'sparkSplit',
        text: 'Spark Bolt pierces 2 more enemies and splits into three bolts on its first hit.',
        art: 'a gold amulet holding a glowing teal eye-shaped pearl with wave engravings',
    },
    drownedgrasp: {
        name: 'Grasp of the Drowned', base: 'gloves', icon: 4, power: 'chainMore',
        text: 'Chain Lightning jumps 3 more times, and each jump deals 15% more than the last.',
        art: 'barnacle-covered bronze gauntlets dripping seawater with teal glowing knuckles',
    },
    ossuarycrown: {
        name: 'Ossuary Crown', base: 'helm', icon: 5, power: 'shadeArmy',
        text: '+2 Shades at once. When a Shade dies or fades it bursts for 150% weapon damage as shadow.',
        art: 'a crown made of interlocked finger bones and violet gems',
    },
    titantread: {
        name: 'Titan\'s Tread', base: 'boots', icon: 6, power: 'leapFree',
        text: 'Leap Slam costs no Rage, and killing an enemy with it resets its cooldown.',
        art: 'heavy bronze titan boots with winged ankle guards and glowing orange soles',
    },
    hollowmantle: {
        name: 'Mantle of the Hollow Shepherd', base: 'chest', icon: 7, power: 'painToPower',
        text: '20% of the damage you take is turned into Rage, Mana and Essence.',
        art: 'a ragged shepherd\'s mantle of grey wool over bronze scale armour, with a crook-shaped clasp',
    },
    endlessgale: {
        name: 'Ring of the Endless Gale', base: 'ring', icon: 8, power: 'whirlSpark',
        text: 'While you Whirlwind, Spark Bolts fly out of the spin at nearby enemies.',
        art: 'a silver ring with a swirling miniature tornado trapped in a crystal',
    },
    unbinding: {
        name: 'Band of Unbinding', base: 'ring', icon: 9, power: 'stepDecoy',
        text: 'Shadow Step leaves a decoy that draws enemies for 2 s and then bursts for 250% weapon damage as shadow.',
        art: 'a broken black iron ring held together by violet shadow',
    },
    stormcirclet: {
        name: 'Stormcaller\'s Circlet', base: 'helm', icon: 10, power: 'thunderThrice',
        text: 'Thunderstrike falls three times on the same spot.',
        art: 'a silver circlet with three upright lightning-bolt spikes and blue gems',
    },
    cinderheart: {
        name: 'Cinderheart', base: 'amulet', icon: 11, power: 'petFury',
        text: 'Your companion deals 100% more damage, and its bites set the enemy alight.',
        art: 'a glowing ember heart-shaped stone in a blackened iron amulet setting',
    },
};

/** Sets: green items, fixed bases, bonuses at 2 and 4 pieces. */
export const SETS = {
    asters: {
        name: 'Aster\'s Bulwark', pieces: ['helm', 'chest', 'gloves', 'boots'],
        names: ['Aster\'s Lion Helm', 'Aster\'s Oath Cuirass', 'Aster\'s Iron Grip', 'Aster\'s March'],
        icons: [12, 13, 14, 15],
        bonus: { 2: { armorPct: 40, life: 60 }, 4: { power: 'bulwark' } },
        text: { 2: '+40% armour, +60 maximum life', 4: 'War Cry also makes you take 40% less damage and resets Leap Slam.' },
        art: 'heavy ornate bronze lion-themed Greek armour set with red plumes',
    },
    skythief: {
        name: 'Raiment of the Sky-Thief', pieces: ['helm', 'chest', 'gloves', 'amulet'],
        names: ['Sky-Thief\'s Cowl', 'Sky-Thief\'s Robe', 'Sky-Thief\'s Fingers', 'Sky-Thief\'s Stolen Star'],
        icons: [16, 17, 18, 19],
        bonus: { 2: { lightningPct: 25, shadowPct: 25 }, 4: { power: 'skystep' } },
        text: { 2: '+25% lightning and shadow damage', 4: 'Shadow Step casts Chain Lightning where you leave and where you arrive.' },
        art: 'a dark blue hooded robe set embroidered with silver constellations',
    },
};

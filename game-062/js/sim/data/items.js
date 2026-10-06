// Item bases, affixes and Golden (legendary) uniques.
// Slots: weapon, offhand, head, body, hands, feet, neck, ring (ring fits ring1/ring2).

// weapon kinds → which class may wield them is in data/classes.js (weapons / offhands).
export const WEAPON_BASES = {
    melee1: [
        [1, 'Butter Knife', 2, 5, 1.5], [4, 'Spork', 4, 8, 1.6], [8, 'Cleaver', 7, 13, 1.35], [12, 'Bread Knife', 10, 18, 1.45],
        [17, 'Pizza Wheel', 14, 25, 1.4], [23, "Chef's Cleaver", 19, 33, 1.35], [30, 'Santoku', 25, 42, 1.45], [38, 'Mythril Mandoline', 32, 54, 1.45],
        [46, 'Obsidian Peeler', 40, 66, 1.5],
    ],
    melee2: [
        [3, 'Rolling Pin', 6, 13, 1.05], [9, 'Baguette', 11, 22, 1.05], [15, 'Giant Spatula', 17, 33, 1.05], [21, 'Garden Hoe', 23, 44, 1.0],
        [28, 'Cast-Iron Skillet', 30, 57, 0.95], [36, 'Grand Cleaver', 40, 72, 1.0], [44, 'Meat-Free Tenderiser', 50, 88, 1.0],
    ],
    bow: [
        [1, 'Straw Shooter', 2, 5, 1.4], [5, 'Slingshot', 4, 9, 1.4], [10, 'Rubber-band Bow', 8, 15, 1.35], [15, 'Licorice Longbow', 12, 22, 1.3],
        [21, 'Bamboo Bow', 16, 30, 1.35], [28, 'Crossbow of Crumbs', 22, 40, 1.3], [36, 'Seedcannon', 29, 52, 1.3], [44, 'Harpoon of Plenty', 37, 64, 1.35],
    ],
    wand: [
        [1, 'Pretzel Wand', 2, 5, 1.35], [6, 'Chopstick', 4, 9, 1.4], [12, 'Cinnamon Stick', 8, 15, 1.4], [19, 'Vanilla Pod', 12, 22, 1.4],
        [27, 'Star-Anise Wand', 17, 30, 1.4], [35, 'Saffron Scepter', 23, 39, 1.4], [43, 'Truffle Baton', 30, 50, 1.4],
    ],
    staff: [
        [3, 'Celery Staff', 5, 11, 1.1], [10, 'Licorice Staff', 10, 20, 1.1], [18, 'Candy-Cane Staff', 16, 31, 1.1], [26, 'Rhubarb Rod', 23, 43, 1.1],
        [34, 'Sugarcane Stave', 31, 57, 1.1], [42, 'Bamboo of Ages', 40, 72, 1.1],
    ],
};

export const ARMOR_BASES = {
    head:  [[1, 'Bottle Cap', 3], [5, 'Paper Chef Hat', 6], [10, 'Colander Helm', 11], [16, 'Tea Cozy', 16], [22, 'Jelly-Mold Helm', 22], [30, 'Melon-Rind Helm', 30], [38, 'Crown Cork', 38], [46, 'Pressure-Lid Visor', 47]],
    body:  [[1, 'Cupcake Wrapper', 5], [5, 'Apron', 9], [10, 'Foil Wrap', 15], [15, 'Wicker Basket Mail', 22], [21, 'Tin-Can Plate', 30], [28, 'Cast-Iron Corset', 40], [36, 'Pressure-Cooker Plate', 52], [44, 'Dutch-Oven Armour', 64]],
    hands: [[2, 'Rubber Gloves', 2], [8, 'Oven Mitts', 5], [15, 'Pot Holders', 9], [23, 'Baking Gauntlets', 14], [32, 'Waffle-Iron Grips', 20], [42, 'Tongs of Might', 27]],
    feet:  [[2, 'Sponge Slippers', 2], [8, 'Cork Boots', 5], [15, 'Rain Boots', 9], [23, 'Clogs', 14], [32, 'Bottle Boots', 20], [42, 'Kettle Treads', 27]],
    shield:[[1, 'Pot Lid', 4], [6, 'Pie Tin', 8], [12, 'Cutting Board', 13], [19, 'Trash-Can Lid', 19], [27, 'Wok', 27], [35, 'Paella Pan', 36], [43, 'Cauldron Lid', 45]],
};

// Offhands and jewellery have an implicit stat instead of armour.
export const TRINKET_BASES = {
    pouch: [[1, 'Seed Pouch', 'crit', 3], [12, 'Seed Satchel', 'crit', 5], [26, 'Bottomless Bag', 'crit', 7], [40, 'Cornucopia', 'crit', 9]],
    orb:   [[1, 'Gumball', 'juice', 8], [12, 'Jawbreaker', 'juice', 16], [26, 'Snow Globe', 'juice', 26], [40, 'Crystal Melon', 'juice', 38]],
    neck:  [[1, 'Candy Necklace', 'hp', 6], [14, 'Bottle-Cap Pendant', 'hp', 14], [28, 'Fortune-Cookie Charm', 'hp', 26]],
    ring:  [[1, 'Gummy Ring', 'resAll', 2], [12, 'Onion Ring', 'resAll', 4], [26, 'Pineapple Ring', 'resAll', 7]],
};

export const SLOT_OF_KIND = {
    melee1: 'weapon', melee2: 'weapon', bow: 'weapon', wand: 'weapon', staff: 'weapon',
    shield: 'offhand', pouch: 'offhand', orb: 'offhand',
    head: 'head', body: 'body', hands: 'hands', feet: 'feet', neck: 'neck', ring: 'ring',
};
export const TWO_HANDED = new Set(['melee2', 'bow', 'staff']);
export const EQUIP_SLOTS = ['weapon', 'offhand', 'head', 'body', 'hands', 'feet', 'neck', 'ring1', 'ring2'];

// Stat labels for tooltips. `v` formats the value.
const P = (v) => `+${v}%`;
const F = (v) => `+${v}`;
export const STAT_LABEL = {
    dmgPct: [P, 'Damage'], minDmg: [F, 'Minimum Damage'], maxDmg: [F, 'Maximum Damage'],
    fireDmg: [F, 'Spicy Damage'], coldDmg: [F, 'Frosty Damage'], lightDmg: [F, 'Fizzy Damage'], poisDmg: [F, 'Moldy Damage'],
    armor: [F, 'Armour'], armorPct: [P, 'Armour'], hp: [F, 'Freshness'], juice: [F, 'Juice'],
    str: [F, 'Crunch'], dex: [F, 'Zip'], mag: [F, 'Zest'], vit: [F, 'Pulp'], allStats: [F, 'All Attributes'],
    ias: [P, 'Attack Speed'], crit: [P, 'Critical Chance'], critDmg: [P, 'Critical Damage'],
    lifeOnHit: [F, 'Freshness per Hit'], lifeSteal: [P, 'Juice Stolen as Freshness'], hpRegen: [F, 'Freshness per Second'], juiceRegen: [F, 'Juice per Second'],
    resFire: [P, 'Spicy Resistance'], resCold: [P, 'Frosty Resistance'], resLight: [P, 'Fizzy Resistance'], resPois: [P, 'Mold Resistance'], resAll: [P, 'All Resistances'],
    moveSpeed: [P, 'Movement Speed'], goldFind: [P, 'Extra Sugar'], magicFind: [P, 'Better Loot'], thorns: [F, 'Thorns'],
    spellDmg: [P, 'Spell Damage'], costReduce: [P, 'Lower Juice Costs'], cdr: [P, 'Cooldown Reduction'],
    extraProj: [F, 'Extra Projectiles'], stunChance: [P, 'Chance to Stun'], freezeChance: [P, 'Chance to Freeze'], healOnKill: [P, 'Freshness on Kill'],
    skills: [F, 'to All Skills'], xpPct: [P, 'Experience'],
};

// Affixes: stat, value at ilvl 1 → value at ilvl 50 (linear), allowed slots ('*' = all), weight.
// Prefixes and suffixes are separate pools; magic items get ≤1 of each, rares ≤3 of each.
const W = ['weapon'];
const ARM = ['head', 'body', 'hands', 'feet', 'offhand'];
const JEW = ['neck', 'ring'];
export const PREFIXES = [
    { n: 'Crunchy',  s: 'dmgPct',    a: [8, 18],  b: [55, 90],  slots: W, w: 10 },
    { n: 'Sharp',    s: 'maxDmg',    a: [1, 3],   b: [14, 26],  slots: [...W, ...JEW, 'hands'], w: 7 },
    { n: 'Zesty',    s: 'fireDmg',   a: [1, 4],   b: [18, 34],  slots: [...W, ...JEW, 'hands'], w: 6 },
    { n: 'Frosty',   s: 'coldDmg',   a: [1, 3],   b: [16, 30],  slots: [...W, ...JEW, 'hands'], w: 6 },
    { n: 'Fizzy',    s: 'lightDmg',  a: [1, 5],   b: [12, 40],  slots: [...W, ...JEW, 'hands'], w: 6 },
    { n: 'Mouldy',   s: 'poisDmg',   a: [1, 4],   b: [17, 32],  slots: [...W, ...JEW], w: 4 },
    { n: 'Sturdy',   s: 'armorPct',  a: [10, 25], b: [60, 100], slots: ARM, w: 10 },
    { n: 'Thick-Skinned', s: 'armor', a: [3, 8],  b: [50, 90],  slots: [...ARM, ...JEW], w: 7 },
    { n: 'Juicy',    s: 'hp',        a: [5, 10],  b: [70, 120], slots: [...ARM, ...JEW], w: 9 },
    { n: 'Sweet',    s: 'juice',     a: [4, 8],   b: [40, 70],  slots: [...ARM, ...JEW, ...W], w: 6 },
    { n: 'Speedy',   s: 'ias',       a: [4, 8],   b: [14, 22],  slots: [...W, 'hands', ...JEW], w: 5 },
    { n: 'Tangy',    s: 'crit',      a: [2, 3],   b: [6, 9],    slots: [...W, 'hands', 'head', ...JEW], w: 5 },
    { n: 'Hearty',   s: 'lifeOnHit', a: [1, 2],   b: [14, 24],  slots: [...W, ...JEW, 'hands'], w: 4 },
    { n: 'Thirsty',  s: 'lifeSteal', a: [1, 2],   b: [4, 6],    slots: [...W, ...JEW], w: 3, min: 6 },
    { n: 'Wise',     s: 'spellDmg',  a: [6, 12],  b: [40, 70],  slots: [...W, 'offhand', 'head', ...JEW], w: 6 },
    { n: 'Ripe',     s: 'allStats',  a: [1, 2],   b: [12, 20],  slots: [...JEW, 'head', 'body'], w: 3, min: 8 },
    { n: 'Thorny',   s: 'thorns',    a: [2, 5],   b: [40, 80],  slots: ['body', 'offhand'], w: 4 },
];
export const SUFFIXES = [
    { n: 'of Crunch',      s: 'str',        a: [2, 5],   b: [24, 36], slots: '*', w: 8 },
    { n: 'of Zip',         s: 'dex',        a: [2, 5],   b: [24, 36], slots: '*', w: 8 },
    { n: 'of Zest',        s: 'mag',        a: [2, 5],   b: [24, 36], slots: '*', w: 8 },
    { n: 'of Pulp',        s: 'vit',        a: [2, 5],   b: [24, 36], slots: '*', w: 9 },
    { n: 'of Vitamin C',   s: 'hpRegen',    a: [1, 2],   b: [10, 18], slots: [...ARM, ...JEW], w: 6 },
    { n: 'of Refreshment', s: 'juiceRegen', a: [1, 1],   b: [4, 7],   slots: [...JEW, 'head', 'offhand', ...W], w: 5 },
    { n: 'of Fibre',       s: 'armor',      a: [3, 7],   b: [40, 70], slots: ARM, w: 6 },
    { n: 'of the Smoothie',s: 'resAll',     a: [3, 5],   b: [14, 20], slots: [...ARM, ...JEW], w: 4 },
    { n: 'of the Peel',    s: 'resFire',    a: [6, 12],  b: [30, 45], slots: [...ARM, ...JEW], w: 5 },
    { n: 'of the Freezer', s: 'resCold',    a: [6, 12],  b: [30, 45], slots: [...ARM, ...JEW], w: 5 },
    { n: 'of Static',      s: 'resLight',   a: [6, 12],  b: [30, 45], slots: [...ARM, ...JEW], w: 5 },
    { n: 'of Pickling',    s: 'resPois',    a: [6, 12],  b: [30, 45], slots: [...ARM, ...JEW], w: 5 },
    { n: 'of the Fruit Fly', s: 'moveSpeed', a: [5, 8],  b: [14, 20], slots: ['feet'], w: 8 },
    { n: 'of Sugar',       s: 'goldFind',   a: [10, 20], b: [50, 80], slots: [...JEW, 'hands', 'head'], w: 4 },
    { n: 'of Fortune',     s: 'magicFind',  a: [5, 10],  b: [25, 40], slots: [...JEW, 'head', 'feet'], w: 4 },
    { n: 'of Ferocity',    s: 'critDmg',    a: [8, 15],  b: [40, 70], slots: [...W, ...JEW, 'hands'], w: 4 },
    { n: 'of Haste',       s: 'ias',        a: [4, 7],   b: [12, 18], slots: [...W, 'hands'], w: 4 },
    { n: 'of Learning',    s: 'xpPct',      a: [3, 5],   b: [8, 12],  slots: [...JEW, 'head'], w: 2 },
];

// Golden items: a fixed name, base, flavour and stats. `{lvl}` scaling: values grow with item level.
export const LEGENDARIES = [
    { id: 'bigsqueeze', name: 'The Big Squeeze', kind: 'melee1', base: 'Cleaver', minLvl: 6,
      stats: { dmgPct: [40, 120], lifeSteal: [4, 6], healOnKill: [3, 3], str: [5, 30] },
      flavour: 'Every fruit has a breaking point. This finds it.' },
    { id: 'rollingpin', name: "Grandma's Rolling Pin", kind: 'melee2', base: 'Rolling Pin', minLvl: 3,
      stats: { dmgPct: [50, 140], stunChance: [15, 25], vit: [5, 30], hp: [10, 90] },
      flavour: '"Who wants pie?" — a threat, not a question.' },
    { id: 'seedstorm', name: 'Seedstorm', kind: 'bow', base: 'Slingshot', minLvl: 5,
      stats: { dmgPct: [40, 110], extraProj: [2, 2], dex: [6, 32], ias: [8, 15] },
      flavour: 'Fires three seeds at once. Your dentist would be horrified.' },
    { id: 'lemonade', name: 'The Lemonade Stand', kind: 'staff', base: 'Licorice Staff', minLvl: 8,
      stats: { spellDmg: [40, 110], costReduce: [25, 25], mag: [6, 32], juiceRegen: [2, 6] },
      flavour: 'When life gives you lemons, cast them at things.' },
    { id: 'snowcone', name: 'Snow-Cone Globe', kind: 'orb', base: 'Jawbreaker', minLvl: 10,
      stats: { coldDmg: [4, 28], freezeChance: [10, 18], spellDmg: [20, 60], juice: [10, 50] },
      flavour: 'Shake it and a tiny orchard gets a blizzard.' },
    { id: 'peeloffortune', name: 'The Peel of Fortune', kind: 'ring', base: 'Gummy Ring', minLvl: 2,
      stats: { magicFind: [30, 60], goldFind: [40, 100], allStats: [2, 14] },
      flavour: 'Lucky, slippery, and slightly sticky.' },
    { id: 'pineapplecrown', name: 'Crown of the Pineapple King', kind: 'head', base: 'Tea Cozy', minLvl: 12,
      stats: { armorPct: [50, 110], thorns: [10, 80], vit: [8, 32], resAll: [6, 16] },
      flavour: 'Heavy is the head that wears the leaves.' },
    { id: 'blenderboots', name: 'Blender Boots', kind: 'feet', base: 'Cork Boots', minLvl: 6,
      stats: { moveSpeed: [25, 25], dex: [5, 25], armorPct: [30, 80], resAll: [4, 12] },
      flavour: 'Pulse. Pulse. PULSE.' },
    { id: 'melancollie', name: 'Melon Collie', kind: 'neck', base: 'Candy Necklace', minLvl: 4,
      stats: { resAll: [10, 20], hp: [12, 90], hpRegen: [2, 14] },
      flavour: 'A very sad amulet. It protects you so it has something to do.' },
    { id: 'belpear', name: 'Fresh Prince of Bel-Pear', kind: 'body', base: 'Wicker Basket Mail', minLvl: 14,
      stats: { armorPct: [60, 120], hpRegen: [6, 20], hp: [30, 120], moveSpeed: [8, 8] },
      flavour: 'Now this is a story all about how my rind got flipped, turned upside down.' },
    { id: 'ovenmitts', name: 'Oven Mitts of Fury', kind: 'hands', base: 'Oven Mitts', minLvl: 8,
      stats: { fireDmg: [4, 30], ias: [10, 18], crit: [4, 8], resFire: [20, 40] },
      flavour: 'Hot hot hot. Very hot. Please put them down.' },
    { id: 'kiwileg', name: "Kiwirt's Spare Leg", kind: 'melee2', base: 'Baguette', minLvl: 1, questOnly: true,
      stats: { dmgPct: [80, 160], ias: [10, 10], moveSpeed: [6, 6], magicFind: [20, 20] },
      flavour: 'A toothpick leg. Kiwirt says you can keep it. He has several.' },
    { id: 'zestament', name: 'Zest Testament', kind: 'wand', base: 'Chopstick', minLvl: 6,
      stats: { spellDmg: [40, 100], lightDmg: [3, 30], cdr: [10, 18], mag: [5, 25] },
      flavour: 'The collected sour wisdom of nine generations of lemons.' },
    { id: 'woklord', name: 'The Wok Lord', kind: 'shield', base: 'Pie Tin', minLvl: 9,
      stats: { armorPct: [60, 120], thorns: [8, 60], resAll: [8, 16], stunChance: [8, 12] },
      flavour: 'Stir-fries enemies on contact. Mostly figuratively.' },
];

export const POTIONS = {
    hp:    { name: 'Strawberry Jam',  icon: '🍓', heal: 0.55, over: 1.4, price: 15 },
    juice: { name: 'Orange Juice',    icon: '🍊', heal: 0.6,  over: 1.0, price: 15 },
    pie:   { name: 'Portal Pie',      icon: '🥧', price: 40 },
};

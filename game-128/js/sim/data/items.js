// Gemheart Saga — equipment and consumables. Pure data.
//
// Equipment: slot weapon | armor | charm, tier 1–5 (the Market sells tiers up to its level), stats atk / def / hp
// plus modifier keys (same as skill passives: sword, heart, skill, crit, gain_r…, slow, loot). Each upgrade (+1) at the
// Armory adds 15% of the base stats; the Armory caps upgrades at twice its level.
// icon: [sheet, cell] in art/icons/<sheet>.webp (4x4 atlases). art: what the fal icon prompt says.

export const EQUIP = [
    // weapons
    { id: 'shortsword', slot: 'weapon', tier: 1, name: 'Iron Shortsword', atk: 4, icon: ['gear', 0], art: 'a plain iron shortsword with a leather-wrapped grip' },
    { id: 'huntbow', slot: 'weapon', tier: 1, name: 'Hunter\'s Bow', atk: 3, mods: { crit: 0.05 }, icon: ['gear', 1], art: 'a simple curved wooden hunting bow with a string' },
    { id: 'oakstaff', slot: 'weapon', tier: 1, name: 'Oak Staff', atk: 3, mods: { skill: 0.1 }, icon: ['gear', 2], art: 'a gnarled oak wizard staff with a small green gem in its knot' },
    { id: 'longsword', slot: 'weapon', tier: 2, name: 'Steel Longsword', atk: 9, icon: ['gear', 3], art: 'a polished steel longsword with a brass crossguard' },
    { id: 'moonbow', slot: 'weapon', tier: 3, name: 'Moonwood Bow', atk: 13, mods: { crit: 0.08 }, icon: ['gear', 4], art: 'an elegant pale silver-wood longbow with crescent moon tips' },
    { id: 'tidestaff', slot: 'weapon', tier: 3, name: 'Tidecaller Staff', atk: 12, mods: { skill: 0.2, gain_s: 0.15 }, icon: ['gear', 5], art: 'a staff of twisted driftwood with a glowing blue sapphire orb and a seashell' },
    { id: 'emberbrand', slot: 'weapon', tier: 4, name: 'Emberbrand', atk: 20, mods: { gain_r: 0.2 }, icon: ['gear', 6], art: 'a broadsword with a blade of glowing red-hot steel and flames licking along its edge' },
    { id: 'dawnbreaker', slot: 'weapon', tier: 5, name: 'Dawnbreaker', atk: 30, mods: { sword: 0.15 }, icon: ['gear', 7], art: 'a radiant golden holy greatsword with a sunburst crossguard, glowing with light' },
    // armour
    { id: 'tunic', slot: 'armor', tier: 1, name: 'Padded Tunic', def: 3, hp: 10, icon: ['gear', 8], art: 'a quilted brown padded cloth tunic' },
    { id: 'jerkin', slot: 'armor', tier: 1, name: 'Leather Jerkin', def: 4, hp: 5, icon: ['gear', 9], art: 'a studded leather jerkin with buckles' },
    { id: 'chain', slot: 'armor', tier: 2, name: 'Chainmail', def: 8, hp: 20, icon: ['gear', 10], art: 'a shirt of iron chainmail rings' },
    { id: 'robe', slot: 'armor', tier: 2, name: 'Starlit Robe', def: 5, hp: 15, mods: { gain: 0.1 }, icon: ['gear', 11], art: 'a deep blue mage robe embroidered with silver stars' },
    { id: 'scale', slot: 'armor', tier: 3, name: 'Scale Hauberk', def: 13, hp: 35, icon: ['gear', 12], art: 'a hauberk of overlapping bronze scales' },
    { id: 'cloak', slot: 'armor', tier: 3, name: 'Ranger\'s Mantle', def: 10, hp: 30, mods: { crit: 0.05 }, icon: ['gear', 13], art: 'a forest green hooded ranger cloak with a leaf clasp' },
    { id: 'plate', slot: 'armor', tier: 4, name: 'Plate of the Vale', def: 20, hp: 60, icon: ['gear', 14], art: 'a full suit of shining steel plate armour with a green-enamelled crest' },
    { id: 'starweave', slot: 'armor', tier: 5, name: 'Starweave Mantle', def: 26, hp: 90, mods: { skill: 0.1 }, icon: ['gear', 15], art: 'a shimmering midnight-blue and gold enchanted mantle that sparkles with starlight' },
    // charms
    { id: 'clover', slot: 'charm', tier: 1, name: 'Lucky Clover', mods: { loot: 0.15 }, icon: ['misc', 6], art: 'a four-leaf clover pressed in a small gold locket' },
    { id: 'ruby_pend', slot: 'charm', tier: 2, name: 'Ruby Pendant', mods: { gain_r: 0.25 }, icon: ['goods', 0], art: 'a gold pendant set with a large faceted red ruby' },
    { id: 'saph_ring', slot: 'charm', tier: 2, name: 'Sapphire Ring', mods: { gain_s: 0.25 }, icon: ['goods', 1], art: 'a silver ring set with a deep blue sapphire' },
    { id: 'emer_brooch', slot: 'charm', tier: 2, name: 'Emerald Brooch', mods: { gain_e: 0.25 }, icon: ['misc', 7], art: 'a leaf-shaped brooch set with a green emerald' },
    { id: 'amet_ear', slot: 'charm', tier: 3, name: 'Amethyst Charm', mods: { gain_a: 0.25 }, icon: ['goods', 2], art: 'a teardrop violet amethyst charm on a silver chain' },
    { id: 'locket', slot: 'charm', tier: 3, name: 'Heart Locket', hp: 25, mods: { heart: 0.2 }, icon: ['goods', 3], art: 'a heart-shaped rose-gold locket glowing faintly pink' },
    { id: 'torc', slot: 'charm', tier: 4, name: 'Warrior\'s Torc', atk: 5, mods: { sword: 0.12 }, icon: ['goods', 4], art: 'a heavy twisted bronze neck torc with wolf-head ends' },
    { id: 'hourglass', slot: 'charm', tier: 5, name: 'Hourglass Amulet', mods: { slow: 0.1, skill: 0.1 }, icon: ['goods', 5], art: 'an amulet holding a tiny hourglass of glowing golden sand' },
];

// Consumables: carried in the bag, used in battle (one every ITEM_COOLDOWN seconds).
export const CONSUMABLES = [
    { id: 'potion', name: 'Health Potion', price: 30, eff: { kind: 'heal', pct: 0.35 }, desc: 'Restore 35% of your health.', icon: ['goods', 6], art: 'a round glass potion bottle of glowing red liquid with a cork' },
    { id: 'greatpotion', name: 'Great Potion', price: 80, tier: 3, eff: { kind: 'heal', pct: 0.7 }, desc: 'Restore 70% of your health.', icon: ['goods', 7], art: 'a tall ornate crystal flask of glowing crimson liquid with a gold stopper' },
    { id: 'tonic', name: 'Mana Tonic', price: 45, eff: { kind: 'mana', n: 8 }, desc: '+8 mana of every colour.', icon: ['goods', 8], art: 'a small flask of swirling blue and violet liquid with golden sparkles' },
    { id: 'bomb', name: 'Fire Bomb', price: 40, eff: { kind: 'dmg', mult: 3 }, desc: 'Throw it: 3× attack damage.', icon: ['goods', 9], art: 'a round black bomb with a lit sparking fuse' },
    { id: 'scroll', name: 'Shuffle Scroll', price: 25, eff: { kind: 'shuffle' }, desc: 'Reshuffle the whole board and clear stone and doom gems.', icon: ['goods', 10], art: 'a rolled parchment scroll tied with a purple ribbon and glowing runes' },
    { id: 'feather', name: 'Phoenix Feather', price: 150, tier: 2, eff: { kind: 'revive', pct: 0.5 }, desc: 'Kept in the bag: when you fall, rise again with 50% health.', icon: ['goods', 11], art: 'a glowing orange and gold phoenix feather trailing embers' },
];

export const ITEM = Object.fromEntries([...EQUIP, ...CONSUMABLES].map((i) => [i.id, i]));
export const SLOTS = ['weapon', 'armor', 'charm'];
/** What an equipment piece is worth at the Market before discounts. */
export const equipPrice = (it) => Math.round(60 * Math.pow(2.3, it.tier - 1));

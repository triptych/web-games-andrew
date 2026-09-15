// ============================================================
// data/items.js - base items, materials, affixes, appearances (GDD §15)
// APPEND ONLY. Reordering changes every weighted draw in every world.
// ============================================================

// ---- base items ---------------------------------------------------------
// pattern: how the attack is shaped. This, not damage, is what differs.
const w = (key, name, o) => ({ key, name, slot: 'hand', kind: 'weapon', usesMaterial: true, stack: false, ...o });

export const BASE_ITEMS = {
  // weapons (GDD §15.3)
  knife: w('knife', 'knife', { damage: 3, energy: 70, weight: 1, pattern: 'single', dmgType: 'cut', ilvl: 1, unawareBonus: 0.5 }),
  hatchet: w('hatchet', 'hatchet', { damage: 5, energy: 100, weight: 3, pattern: 'single', dmgType: 'cut', ilvl: 1, chops: true }),
  sword: w('sword', 'sword', { damage: 6, energy: 100, weight: 3, pattern: 'cleave', dmgType: 'cut', ilvl: 4 }),
  spear: w('spear', 'spear', { damage: 5, energy: 100, weight: 3, pattern: 'reach', dmgType: 'pierce', ilvl: 3 }),
  maul: w('maul', 'maul', { damage: 9, energy: 140, weight: 6, pattern: 'knockback', dmgType: 'blunt', ilvl: 6, breaks: true }),
  sling: w('sling', 'sling', { damage: 4, energy: 100, weight: 1, pattern: 'ranged', range: 6, ammo: 'stone', dmgType: 'blunt', ilvl: 2 }),
  bow: w('bow', 'bow', { damage: 5, energy: 110, weight: 2, pattern: 'ranged', range: 8, ammo: 'arrow', dmgType: 'pierce', ilvl: 5 }),
  staff: w('staff', 'staff', { damage: 4, energy: 90, weight: 3, pattern: 'single', dmgType: 'blunt', ilvl: 3, charges: 1 }),
  flail: w('flail', 'flail', { damage: 6, energy: 130, weight: 5, pattern: 'sweep', dmgType: 'blunt', ilvl: 7 }),

  // armour
  coat: { key: 'coat', name: 'coat', slot: 'body', kind: 'armour', armour: 2, weight: 2, usesMaterial: false, ilvl: 1 },
  jerkin: { key: 'jerkin', name: 'jerkin', slot: 'body', kind: 'armour', armour: 4, weight: 4, usesMaterial: true, ilvl: 4 },
  mail: { key: 'mail', name: 'mail', slot: 'body', kind: 'armour', armour: 7, weight: 9, usesMaterial: true, ilvl: 10 },
  robe: { key: 'robe', name: 'robe', slot: 'body', kind: 'armour', armour: 1, weight: 1, usesMaterial: false, ilvl: 2, toolCharge: 1 },
  hood: { key: 'hood', name: 'hood', slot: 'head', kind: 'armour', armour: 1, weight: 1, usesMaterial: false, ilvl: 1 },
  cap: { key: 'cap', name: 'cap', slot: 'head', kind: 'armour', armour: 2, weight: 2, usesMaterial: true, ilvl: 4 },
  helm: { key: 'helm', name: 'helm', slot: 'head', kind: 'armour', armour: 4, weight: 4, usesMaterial: true, ilvl: 9 },

  // offhand
  buckler: { key: 'buckler', name: 'buckler', slot: 'offhand', kind: 'armour', armour: 3, weight: 2, usesMaterial: true, ilvl: 3 },
  board_shield: { key: 'board_shield', name: 'board shield', slot: 'offhand', kind: 'armour', armour: 5, weight: 5, usesMaterial: true, ilvl: 8, evasion: -2 },
  lantern: { key: 'lantern', name: 'lantern', slot: 'offhand', kind: 'lantern', weight: 2, usesMaterial: false, ilvl: 1, radius: 5 },

  // trinkets - always fully unidentified
  trinket: { key: 'trinket', name: 'trinket', slot: 'trinket', kind: 'trinket', weight: 0.2, usesMaterial: false, ilvl: 1, unidentified: true },

  // consumables
  bread: { key: 'bread', name: 'bread', kind: 'food', weight: 0.5, stack: true, nutrition: 1200, value: 4 },
  pottage: { key: 'pottage', name: 'pottage', kind: 'food', weight: 0.8, stack: true, nutrition: 1800, value: 6, buff: 'heartened' },
  dried_fish: { key: 'dried_fish', name: 'dried fish', kind: 'food', weight: 0.3, stack: true, nutrition: 1000, value: 5 },
  oil_flask: { key: 'oil_flask', name: 'flask of oil', kind: 'oil', weight: 0.8, stack: true, value: 12 },
  bandage: { key: 'bandage', name: 'bandage', kind: 'consumable', weight: 0.2, stack: true, value: 6, effect: 'heal', power: 8, cures: ['bleeding'] },
  antidote: { key: 'antidote', name: 'antidote', kind: 'consumable', weight: 0.2, stack: true, value: 14, effect: 'cure', cures: ['poisoned'] },
  tonic: { key: 'tonic', name: 'tonic', kind: 'tonic', weight: 0.3, stack: false, value: 22, unidentified: true },
  seed_packet: { key: 'seed_packet', name: 'seed packet', kind: 'consumable', weight: 0.1, stack: true, value: 8, effect: 'plant' },
  stone: { key: 'stone', name: 'sling-stone', kind: 'ammo', weight: 0.1, stack: true, value: 1 },
  arrow: { key: 'arrow', name: 'arrow', kind: 'ammo', weight: 0.05, stack: true, value: 2 },

  // reagents
  nettle: { key: 'nettle', name: 'nettle', kind: 'reagent', weight: 0.1, stack: true, value: 3, tags: ['bitter', 'green'], tonic: 'steadying' },
  bell_cap: { key: 'bell_cap', name: 'bell-cap', kind: 'reagent', weight: 0.1, stack: true, value: 8, tags: ['fungal'], tonic: 'clearing' },
  river_clay: { key: 'river_clay', name: 'river clay', kind: 'reagent', weight: 0.4, stack: true, value: 4, tags: ['earth'], tonic: 'stone-skin' },
  wool: { key: 'wool', name: 'wool', kind: 'reagent', weight: 0.3, stack: true, value: 5, tags: ['warm'] },
  tallow: { key: 'tallow', name: 'tallow', kind: 'reagent', weight: 0.3, stack: true, value: 5, tags: ['fat'], tonic: 'warming' },
  salt: { key: 'salt', name: 'salt', kind: 'reagent', weight: 0.2, stack: true, value: 6, tags: ['salt'], tonic: 'salt-sight' },
  name_shard: { key: 'name_shard', name: 'name-shard', kind: 'reagent', weight: 0.1, stack: true, value: 20, tags: ['quiet'], tonic: 'remembering' },
  moon_cap: { key: 'moon_cap', name: 'moon-cap', kind: 'reagent', weight: 0.1, stack: true, value: 14, tags: ['fungal', 'night'], tonic: 'night-eye' },
  heart_root: { key: 'heart_root', name: 'heart-root', kind: 'reagent', weight: 0.2, stack: true, value: 16, tags: ['green', 'warm'], tonic: 'mending' },
  berries: { key: 'berries', name: 'berries', kind: 'food', weight: 0.2, stack: true, nutrition: 500, value: 2, tags: ['sweet'] },
  honey: { key: 'honey', name: 'honey', kind: 'food', weight: 0.3, stack: true, nutrition: 700, value: 9, tags: ['sweet'] },
  samphire: { key: 'samphire', name: 'samphire', kind: 'reagent', weight: 0.1, stack: true, value: 5, tags: ['salt', 'green'] },
  greens: { key: 'greens', name: 'garden greens', kind: 'food', weight: 0.3, stack: true, nutrition: 700, value: 3, tags: ['green'] },
  firewood: { key: 'firewood', name: 'firewood', kind: 'reagent', weight: 1.5, stack: true, value: 2, tags: ['wood'] },
  repair_kit: { key: 'repair_kit', name: 'repair kit', kind: 'consumable', weight: 0.6, stack: true, value: 30, effect: 'repair' },

  // quest and key items - weightless, unloseable
  floor_key: { key: 'floor_key', name: 'key', kind: 'key', weight: 0, stack: true, value: 0, quest: true },
  vigor_shard: { key: 'vigor_shard', name: 'vigor shard', kind: 'shard', weight: 0, stack: true, value: 0, quest: true },
  ledger_fragment: { key: 'ledger_fragment', name: 'ledger fragment', kind: 'lore', weight: 0, stack: true, value: 0, quest: true },
  loom_weights: { key: 'loom_weights', name: 'loom-weights', kind: 'quest', weight: 0, stack: true, value: 0, quest: true },
};

for (const k of Object.keys(BASE_ITEMS)) {
  const it = BASE_ITEMS[k];
  if (it.value === undefined) it.value = Math.round(4 + (it.damage || 0) * 3 + (it.armour || 0) * 4 + (it.ilvl || 1) * 2);
  Object.freeze(it);
}
Object.freeze(BASE_ITEMS);

export const WEAPON_KEYS = Object.freeze(['knife', 'hatchet', 'sword', 'spear', 'maul', 'sling', 'bow', 'staff', 'flail']);
export const BODY_KEYS = Object.freeze(['coat', 'jerkin', 'mail', 'robe']);
export const HEAD_KEYS = Object.freeze(['hood', 'cap', 'helm']);
export const OFFHAND_KEYS = Object.freeze(['buckler', 'board_shield']);

// ---- materials (GDD §33.5) ---------------------------------------------
export const MATERIALS = {
  wood: { key: 'wood', name: 'wood', band: [1, 5], dmg: 0, armour: 0, weight: 0.8, hue: 30 },
  bone: { key: 'bone', name: 'bone', band: [2, 8], dmg: 1, armour: 0, weight: 0.7, hue: 48, vs: 'beast' },
  'bog-iron': { key: 'bog-iron', name: 'bog-iron', band: [3, 10], dmg: 2, armour: 1, weight: 1.0, hue: 26 },
  'river-iron': { key: 'river-iron', name: 'river-iron', band: [6, 16], dmg: 3, armour: 2, weight: 1.0, hue: 205 },
  'bell-bronze': { key: 'bell-bronze', name: 'bell-bronze', band: [9, 20], dmg: 4, armour: 2, weight: 1.1, hue: 40, vs: 'forgotten' },
  blackstone: { key: 'blackstone', name: 'blackstone', band: [14, 26], dmg: 6, armour: 4, weight: 1.4, hue: 250, energy: 10 },
  'hearth-steel': { key: 'hearth-steel', name: 'hearth-steel', band: [18, 32], dmg: 7, armour: 5, weight: 1.0, hue: 20, slowDecay: true },
  quietglass: { key: 'quietglass', name: 'quietglass', band: [22, 36], dmg: 9, armour: 3, weight: 0.6, hue: 160, fragile: true, dmgType: 'name' },
};
for (const k of Object.keys(MATERIALS)) Object.freeze(MATERIALS[k]);
Object.freeze(MATERIALS);

export const QUALITY_NAMES = Object.freeze(['poor', 'plain', 'good', 'fine', 'masterwork']);
export const QUALITY_DMG = Object.freeze([-1, 0, 1, 2, 4]);
export const QUALITY_ARMOUR = Object.freeze([-1, 0, 1, 2, 3]);

// ---- affixes (GDD §15.6) -----------------------------------------------
// tags prevent conflicting co-rolls.
const pre = (key, name, tags, effect) => ({ key, name, kind: 'prefix', tags, effect });
const suf = (key, name, tags, effect) => ({ key, name, kind: 'suffix', tags, effect });

export const AFFIXES = {
  keen: pre('keen', 'keen', ['crit'], { crit: [0.04, 0.07, 0.11] }),
  heavy: pre('heavy', 'heavy', ['dmg', 'speed'], { dmg: [2, 4, 6], energy: [15, 20, 25] }),
  quick: pre('quick', 'quick', ['speed'], { energy: [-10, -18, -25] }),
  ember: pre('ember', 'ember', ['elem'], { fire: [2, 4, 7], lights: true }),
  salt: pre('salt', 'salt', ['vs'], { vs: 'drowned', mult: [1.25, 1.4, 1.6] }),
  bright: pre('bright', 'bright', ['light'], { light: [1, 1, 2] }),
  old: pre('old', 'old', ['vs'], { vs: 'forgotten', mult: [1.25, 1.4, 1.6] }),
  kindly: pre('kindly', 'kindly', ['onkill'], { healOnKill: [1, 2, 4] }),
  sure: pre('sure', 'sure', ['acc'], { acc: [0.1, 0.2, 0.3] }),
  thick: pre('thick', 'thick', ['armour'], { armour: [1, 2, 4] }),
  oiled: pre('oiled', 'oiled', ['elem'], { resistWater: [0.2, 0.35, 0.5] }),
  lined: pre('lined', 'lined', ['elem'], { resistCold: [0.2, 0.35, 0.5] }),
  quiet: pre('quiet', 'quiet', ['stealth'], { stealth: [1, 2, 4] }),
  warded: pre('warded', 'warded', ['elem'], { resistName: [0.25, 0.4, 0.5] }),
  mended: pre('mended', 'mended', ['condition'], { slowDecay: [1, 2, 3] }),

  of_the_fen: suf('of_the_fen', 'of the Fen', ['move'], { wetMove: [20, 35, 50] }),
  of_the_hearth: suf('of_the_hearth', 'of the Hearth', ['quiet'], { warmth: [0.15, 0.25, 0.4] }),
  of_the_long_walk: suf('of_the_long_walk', 'of the Long Walk', ['carry'], { carry: [3, 6, 10] }),
  of_quiet_hands: suf('of_quiet_hands', 'of Quiet Hands', ['stealth'], { stealth: [1, 2, 3] }),
  of_waking: suf('of_waking', 'of Waking', ['wake'], { wakeCost: [-0.1, -0.2, -0.3] }),
  of_the_bell: suf('of_the_bell', 'of the Bell', ['status'], { statusShorten: [1, 1, 2] }),
  of_small_mercies: suf('of_small_mercies', 'of Small Mercies', ['regen'], { regen: [1, 2, 3] }),
  of_the_orchard: suf('of_the_orchard', 'of the Orchard', ['forage'], { forage: [1, 1, 2] }),
  of_patience: suf('of_patience', 'of Patience', ['dmg'], { patience: [1, 2, 3] }),
};
for (const k of Object.keys(AFFIXES)) Object.freeze(AFFIXES[k]);
Object.freeze(AFFIXES);

export const WEAPON_PREFIXES = Object.freeze(['keen', 'heavy', 'quick', 'ember', 'salt', 'bright', 'old', 'kindly', 'sure']);
export const ARMOUR_PREFIXES = Object.freeze(['thick', 'oiled', 'lined', 'quiet', 'warded', 'mended']);
export const ALL_SUFFIXES = Object.freeze(['of_the_fen', 'of_the_hearth', 'of_the_long_walk', 'of_quiet_hands',
  'of_waking', 'of_the_bell', 'of_small_mercies', 'of_the_orchard', 'of_patience']);

// ---- unidentified appearances (GDD §15.5) ------------------------------
export const TONIC_APPEARANCES = Object.freeze([
  'cloudy', 'bramble-green', 'settled', 'bright as rain', 'the colour of weak tea',
  'tarry', 'faintly fizzing', 'smelling of the shed', 'oily', 'pale', 'still', 'thick',
]);

export const TRINKET_APPEARANCES = Object.freeze([
  'a bone ring', 'a knot of copper wire', 'a smooth grey stone, drilled', 'a child\'s tooth in wax',
  'a folded tin star', 'a ring of woven hair', 'a hook of black horn', 'a coin with the face worn off',
  'a whistle of green glass', 'a knuckle of river iron', 'a bundle of dry thread', 'a pressed flower in resin',
]);

/** Tonic effects. Never straightforwardly bad - the worst is a wasted turn. */
export const TONIC_EFFECTS = Object.freeze([
  { key: 'steadying', name: 'tonic of steadying', effect: 'status', status: 'steadied', turns: 15 },
  { key: 'clearing', name: 'tonic of clearing', effect: 'cure', cures: ['blinded', 'dazed', 'unnamed'] },
  { key: 'mending', name: 'tonic of mending', effect: 'heal', power: 20 },
  { key: 'warming', name: 'tonic of warming', effect: 'status', status: 'heartened', turns: 60 },
  { key: 'quickening', name: 'tonic of quickening', effect: 'status', status: 'hasted', turns: 8 },
  { key: 'night-eye', name: 'tonic of night-eye', effect: 'light', turns: 80 },
  { key: 'stone-skin', name: 'tonic of stone-skin', effect: 'status', status: 'steadied', turns: 25 },
  { key: 'salt-sight', name: 'tonic of salt-sight', effect: 'reveal', radius: 12 },
  { key: 'remembering', name: 'tonic of remembering', effect: 'cure', cures: ['unnamed'], quiet: -0.05 },
  { key: 'heavy-head', name: 'tonic of heavy head', effect: 'status', status: 'slowed', turns: 6 },
  { key: 'green-dream', name: 'tonic of green dream', effect: 'heal', power: 10, status: 'heartened', turns: 30 },
  { key: 'wick-thrift', name: 'tonic of wick-thrift', effect: 'oil', power: 25 },
]);

/** Trinket effects, the weird slot. */
export const TRINKET_EFFECTS = Object.freeze([
  { key: 'ember_knot', name: 'ember-knot', mods: { fire: 3 }, blurb: 'Warm, always.' },
  { key: 'walkers_stone', name: 'walker\'s stone', mods: { carry: 8 }, blurb: 'It makes the pack sit better.' },
  { key: 'wakeful_tooth', name: 'wakeful tooth', mods: { regen: 2 }, blurb: 'You sleep badly and heal well.' },
  { key: 'hedge_star', name: 'hedge-star', mods: { forage: 2 }, blurb: 'Things worth picking catch your eye.' },
  { key: 'quiet_wire', name: 'quiet wire', mods: { stealth: 3 }, blurb: 'Your boots make less of an argument.' },
  { key: 'keepers_ring', name: 'keeper\'s ring', mods: { light: 1 }, blurb: 'The flame stands taller.' },
  { key: 'iron_knuckle', name: 'iron knuckle', mods: { dmg: 3 }, blurb: 'Your arm remembers work.' },
  { key: 'thread_bundle', name: 'thread bundle', mods: { disposition: 3 }, blurb: 'People start talking before you do.' },
  { key: 'bronze_button', name: 'bronze button', mods: { armour: 2 }, blurb: 'It sits over your heart.' },
  { key: 'wax_charm', name: 'wax charm', mods: { resistName: 0.3 }, blurb: 'Your name stays where you put it.' },
  { key: 'glass_whistle', name: 'glass whistle', mods: { crit: 0.06 }, blurb: 'A thin note, then nothing.' },
  { key: 'flat_river_stone', name: 'flat river stone', mods: { wetMove: 40 }, blurb: 'Water seems to mind you less.' },
]);

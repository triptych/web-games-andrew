// ============================================================
// data/items.js - every item in the game (GDD 10)
// One shape, ten kinds. `effect` is data; game/effects.js is the only
// thing that interprets it, so an item behaves identically in battle,
// in the field menu and in a shop preview.
//
// kind:   restorative cure battle binding food training relic material breeding key
// where:  'battle' | 'field' | 'both' | 'none'
// ============================================================

const I = (id, name, kind, price, o = {}) => ({
  id, name, kind, price,
  rarity: o.rarity ?? 1,
  where: o.where ?? (kind === 'battle' || kind === 'binding' ? 'battle' : kind === 'relic' || kind === 'material' || kind === 'key' || kind === 'breeding' ? 'none' : 'both'),
  icon: o.icon ?? '❖',
  stack: o.stack ?? 99,
  ...o,
});

export const ITEMS = {
  // --- restoratives ----------------------------------------------------
  ember_salve:   I('ember_salve',   'Ember Salve',     'restorative', 40,   { icon: '\u{1F9F4}', desc: 'Restores 60 health to one dragon.',                 effect: { heal: 60 } }),
  greater_salve: I('greater_salve', 'Greater Salve',   'restorative', 120,  { icon: '\u{1F9F4}', rarity: 2, desc: 'Restores 180 health.',                    effect: { heal: 180 } }),
  wardens_salve: I('wardens_salve', "Warden's Salve",  'restorative', 320,  { icon: '\u{1F9F4}', rarity: 3, desc: 'Restores 450 health.',                    effect: { heal: 450 } }),
  full_salve:    I('full_salve',    'Full Salve',      'restorative', 700,  { icon: '✨',    rarity: 4, desc: 'Restores a dragon completely.',           effect: { healPctMax: 1 } }),
  brood_balm:    I('brood_balm',    'Brood Balm',      'restorative', 260,  { icon: '\u{1F33A}', rarity: 3, desc: 'Restores 120 health to the whole party.', effect: { heal: 120, target: 'allies' } }),
  ley_tonic:     I('ley_tonic',     'Ley Tonic',       'restorative', 60,   { icon: '\u{1F9EA}', desc: 'Restores 25 ley (MP).',                              effect: { mp: 25 } }),
  deep_ley:      I('deep_ley',      'Deep Ley Tonic',  'restorative', 180,  { icon: '\u{1F9EA}', rarity: 3, desc: 'Restores 70 ley.',                        effect: { mp: 70 } }),
  line_draught:  I('line_draught',  'Line Draught',    'restorative', 520,  { icon: '\u{1F376}', rarity: 4, desc: 'Restores all ley to the whole party.',    effect: { mpPctMax: 1, target: 'allies' } }),
  phoenix_cinder:I('phoenix_cinder','Phoenix Cinder',  'restorative', 450,  { icon: '\u{1F426}', rarity: 4, desc: 'Wakes a fainted dragon at half health.',  effect: { revive: 0.5 } }),
  hearth_ember:  I('hearth_ember',  'Hearth Ember',    'restorative', 900,  { icon: '\u{1F31F}', rarity: 5, desc: 'Wakes a fainted dragon at full health.',  effect: { revive: 1 } }),

  // --- cures -----------------------------------------------------------
  ashwash:    I('ashwash',    'Ashwash',        'cure', 45,  { icon: '\u{1F4A7}', desc: 'Puts out a Burn.',                       effect: { cure: ['burn'] } }),
  saltcloth:  I('saltcloth',  'Saltcloth',      'cure', 45,  { icon: '\u{1F9FB}', desc: 'Dries out a Soak.',                      effect: { cure: ['soak'] } }),
  frostroot:  I('frostroot',  'Frostroot',      'cure', 50,  { icon: '\u{1FAD8}', desc: 'Warms a Chill out of the blood.',        effect: { cure: ['chill'] } }),
  venomdraw:  I('venomdraw',  'Venomdraw',      'cure', 55,  { icon: '\u{1F48A}', desc: 'Draws a Blight out of a wound.',         effect: { cure: ['blight'] } }),
  clearmind:  I('clearmind',  'Clearmind',      'cure', 60,  { icon: '\u{1F300}', desc: 'Clears Stun and Muzzle.',                effect: { cure: ['stun', 'muzzle'] } }),
  braveleaf:  I('braveleaf',  'Braveleaf',      'cure', 55,  { icon: '\u{1F343}', desc: 'Steadies a frightened dragon.',          effect: { cure: ['fear'] } }),
  clearwater: I('clearwater', 'Clearwater Draught', 'cure', 150, { icon: '\u{1F4A0}', rarity: 3, desc: 'Cleanses the ash from an ashbound dragon, in or out of battle. It remembers its name.', effect: { cure: ['ashen'], cleanse: true } }),
  panacea:    I('panacea',    'Panacea',        'cure', 300, { icon: '\u{1F48E}', rarity: 4, desc: 'Clears every affliction at once.', effect: { cureAll: true } }),

  // --- battle items ----------------------------------------------------
  cinder_flask: I('cinder_flask', 'Cinder Flask', 'battle', 70,  { icon: '\u{1F9E8}', desc: 'Ember damage to one enemy.',            effect: { damage: 70, element: 'ember', status: { id: 'burn', chance: 0.3, turns: 3 } } }),
  shock_vial:   I('shock_vial',   'Shock Vial',   'battle', 80,  { icon: '⚡',    desc: 'Storm damage; may stun.',               effect: { damage: 72, element: 'storm', status: { id: 'stun', chance: 0.25, turns: 1 } } }),
  frost_shard:  I('frost_shard',  'Frost Shard',  'battle', 75,  { icon: '❄',    desc: 'Tide damage; usually chills.',          effect: { damage: 66, element: 'tide', status: { id: 'chill', chance: 0.6, turns: 3 } } }),
  stone_bolus:  I('stone_bolus',  'Stone Bolus',  'battle', 85,  { icon: '\u{1FAA8}', desc: 'Heavy Stone damage to one enemy.',      effect: { damage: 90, element: 'stone' } }),
  thorn_sachet: I('thorn_sachet', 'Thorn Sachet', 'battle', 90,  { icon: '\u{1F33F}', desc: 'Verdant damage to every enemy.',        effect: { damage: 58, element: 'verdant', target: 'enemies' } }),
  smoke_veil:   I('smoke_veil',   'Smoke Veil',   'battle', 60,  { icon: '\u{1F32B}', desc: 'Guarantees escape from a battle.',      effect: { flee: true } }),
  wardens_whistle: I('wardens_whistle', "Warden's Whistle", 'battle', 200, { icon: '\u{1F3BA}', rarity: 3, desc: 'Your dragons act first next round.', effect: { partyStatus: { id: 'haste', turns: 3 } } }),
  surge_horn:   I('surge_horn',   'Surge Horn',   'battle', 400, { icon: '\u{1F4EF}', rarity: 4, desc: 'Fills a third of the Ember Surge meter.', effect: { surge: 34 } }),
  binding_powder: I('binding_powder', 'Binding Powder', 'battle', 110, { icon: '\u{1F9C2}', rarity: 2, desc: 'Weakens a wild dragon: the next binding this battle is far likelier.', effect: { bindBoost: 1.5 } }),

  // --- bindings --------------------------------------------------------
  rune_cord:    I('rune_cord',    'Rune Cord',    'binding', 60,  { icon: '\u{1FAA2}', desc: 'A plain binding. Holds a weakened dragon, sometimes.',      effect: { bind: 1.0 } }),
  bind_chain:   I('bind_chain',   'Bind Chain',   'binding', 160, { icon: '⛓',    rarity: 2, desc: 'Holds better, and holds bigger things.',          effect: { bind: 1.5 } }),
  sigil_snare:  I('sigil_snare',  'Sigil Snare',  'binding', 380, { icon: '\u{1F52F}', rarity: 3, desc: 'Warden-made. Holds most things you can hurt.',    effect: { bind: 2.2 } }),
  soulglass:    I('soulglass',    'Soulglass',    'binding', 850, { icon: '\u{1F52E}', rarity: 4, desc: 'The best binding money can buy.',                 effect: { bind: 3.2 } }),
  moonlit_snare:I('moonlit_snare','Moonlit Snare','binding', 420, { icon: '\u{1F319}', rarity: 3, desc: 'Twice as strong underground or after dark.',      effect: { bind: 1.6, nightMult: 2.0 } }),
  elder_snare:  I('elder_snare',  'Elder Snare',  'binding', 0,   { icon: '\u{1F30C}', rarity: 5, stack: 5, desc: 'Maerin made five of these. The only thing that will hold an elder wyrm.', effect: { bind: 6.0, elder: true } }),

  // --- food (bond, and a buff that lasts one battle) --------------------
  sunmelon:     I('sunmelon',     'Sunmelon',     'food', 35,  { icon: '\u{1F349}', where: 'field', desc: '+6 bond. A hatchling will eat the rind too.',       effect: { bond: 6 } }),
  salt_cod:     I('salt_cod',     'Salt Cod',     'food', 45,  { icon: '\u{1F41F}', where: 'field', desc: '+8 bond, and +10% Defence in the next battle.',     effect: { bond: 8, meal: { def: 1.1 } } }),
  char_root:    I('char_root',    'Char Root',    'food', 45,  { icon: '\u{1F955}', where: 'field', desc: '+8 bond, and +10% Attack in the next battle.',      effect: { bond: 8, meal: { atk: 1.1 } } }),
  skyberry:     I('skyberry',     'Skyberry',     'food', 50,  { icon: '\u{1FAD0}', where: 'field', desc: '+8 bond, and +10% Speed in the next battle.',       effect: { bond: 8, meal: { spd: 1.1 } } }),
  gilded_haunch:I('gilded_haunch','Gilded Haunch','food', 180, { icon: '\u{1F356}', where: 'field', rarity: 3, desc: '+20 bond. An extravagance, and they know it.', effect: { bond: 20 } }),
  hearth_bread: I('hearth_bread', 'Hearth Bread', 'food', 30,  { icon: '\u{1F35E}', where: 'field', desc: '+5 bond and a little health.',                    effect: { bond: 5, heal: 40 } }),
  ash_pear:     I('ash_pear',     'Ash Pear',     'food', 70,  { icon: '\u{1F350}', where: 'field', rarity: 2, desc: '+10 bond. Ashbound dragons will take one from your hand.', effect: { bond: 10, ashbondBonus: 2 } }),

  // --- training (permanent essence, cap 15 per stat) --------------------
  ember_root:   I('ember_root',   'Ember Root',    'training', 250, { icon: '\u{1F33F}', where: 'field', rarity: 3, desc: '+1 Attack essence, permanently.',  effect: { essence: 'atk' } }),
  sagebloom:    I('sagebloom',    'Sagebloom',     'training', 250, { icon: '\u{1F338}', where: 'field', rarity: 3, desc: '+1 Magic essence, permanently.',   effect: { essence: 'mag' } }),
  ironbark:     I('ironbark',     'Ironbark',      'training', 250, { icon: '\u{1FAB5}', where: 'field', rarity: 3, desc: '+1 Defence essence, permanently.', effect: { essence: 'def' } }),
  wardstone_dust:I('wardstone_dust','Wardstone Dust','training',250,{ icon: '\u{1FAA8}', where: 'field', rarity: 3, desc: '+1 Ward essence, permanently.',    effect: { essence: 'res' } }),
  windfeather:  I('windfeather',  'Windfeather',   'training', 250, { icon: '\u{1FAB6}', where: 'field', rarity: 3, desc: '+1 Speed essence, permanently.',   effect: { essence: 'spd' } }),
  heartseed:    I('heartseed',    'Heartseed',     'training', 300, { icon: '\u{1F495}', where: 'field', rarity: 3, desc: '+1 Health essence, permanently.',  effect: { essence: 'hp' } }),
  dreamsilt:    I('dreamsilt',    'Dreamsilt',     'training', 280, { icon: '\u{1F4AB}', where: 'field', rarity: 3, desc: '+1 Ley essence, permanently.',     effect: { essence: 'mp' } }),
  memory_stone: I('memory_stone', 'Memory Stone',  'training', 600, { icon: '\u{1F4DC}', where: 'field', rarity: 4, desc: 'Teaches one dragon a skill it could never learn on its own.', effect: { teach: true } }),
  brood_ledger: I('brood_ledger', 'Brood Ledger',  'training', 800, { icon: '\u{1F4D3}', where: 'field', rarity: 4, desc: 'Grants one dragon a second trait, chosen from what suits it.', effect: { trait: true } }),

  // --- relics (equipment: harness slot / relic slot) --------------------
  scale_harness:  I('scale_harness',  'Scale Harness',   'relic', 220, { icon: '\u{1F9BA}', rarity: 2, slot: 'harness', mods: { def: 1.15 }, desc: '+15% Defence.' }),
  talon_sheaths:  I('talon_sheaths',  'Talon Sheaths',   'relic', 220, { icon: '\u{1F52A}', rarity: 2, slot: 'harness', mods: { atk: 1.15 }, desc: '+15% Attack.' }),
  featherweight:  I('featherweight',  'Featherweight Yoke','relic', 240,{ icon: '\u{1FAB6}', rarity: 2, slot: 'harness', mods: { spd: 1.20 }, desc: '+20% Speed.' }),
  ley_harness:    I('ley_harness',    'Ley Harness',     'relic', 260, { icon: '\u{1F9F5}', rarity: 3, slot: 'harness', mods: { mag: 1.18, mp: 1.10 }, desc: '+18% Magic, +10% Ley.' }),
  bulwark_rig:    I('bulwark_rig',    'Bulwark Rig',     'relic', 380, { icon: '\u{1F6E1}', rarity: 3, slot: 'harness', mods: { def: 1.25, res: 1.15, spd: 0.92 }, desc: '+25% Defence, +15% Ward, a little slower.' }),
  broodmother_rig:I('broodmother_rig','Broodmother Rig', 'relic', 500, { icon: '\u{1FAB9}', rarity: 4, slot: 'harness', mods: { hp: 1.20 }, incubateMult: 0.7, desc: '+20% Health; eggs it parents hatch sooner.' }),
  emberheart:     I('emberheart',     'Emberheart Amulet','relic', 420,{ icon: '❤',    rarity: 3, slot: 'relic', mods: { atk: 1.10 }, elementBoost: { ember: 1.20 }, desc: '+10% Attack and +20% Ember damage.' }),
  tidesong:       I('tidesong',       'Tidesong Pendant','relic', 420, { icon: '\u{1F41A}', rarity: 3, slot: 'relic', mods: { res: 1.12 }, elementBoost: { tide: 1.20 }, desc: '+12% Ward and +20% Tide damage.' }),
  stormring:      I('stormring',      'Stormring',       'relic', 460, { icon: '\u{1F48D}', rarity: 3, slot: 'relic', mods: { spd: 1.10 }, elementBoost: { storm: 1.20 }, desc: '+10% Speed and +20% Storm damage.' }),
  greenwreath:    I('greenwreath',    'Green Wreath',    'relic', 440, { icon: '\u{1F33F}', rarity: 3, slot: 'relic', mods: { hp: 1.12 }, regenPct: 0.04, desc: '+12% Health and slow regeneration in battle.' }),
  bloodstone:     I('bloodstone',     'Bloodstone',      'relic', 520, { icon: '\u{1FA78}', rarity: 4, slot: 'relic', mods: { atk: 1.25, def: 0.90 }, desc: '+25% Attack at the cost of some Defence.' }),
  wardens_seal_r: I('wardens_seal_r', "Warden's Signet", 'relic', 600, { icon: '\u{1F4DC}', rarity: 4, slot: 'relic', bindBonus: 1.25, mods: { res: 1.10 }, desc: 'Bindings thrown while this dragon fights are 25% likelier.' }),
  hollow_lens:    I('hollow_lens',    'Hollow Lens',     'relic', 560, { icon: '\u{1F50D}', rarity: 4, slot: 'relic', mods: { mag: 1.20 }, elementBoost: { gloam: 1.25 }, desc: '+20% Magic and +25% Gloam damage.' }),
  dawn_collar:    I('dawn_collar',    'Dawn Collar',     'relic', 700, { icon: '☀',    rarity: 5, slot: 'relic', mods: { mag: 1.15, res: 1.15 }, elementBoost: { radiant: 1.25 }, desc: 'Line-fire, worn. +15% Magic and Ward, +25% Radiant.' }),
  quiet_bell:     I('quiet_bell',     'Quiet Bell',      'relic', 480, { icon: '\u{1F514}', rarity: 4, slot: 'relic', statusResist: 0.5, desc: 'Halves the chance of catching any affliction.' }),
  surge_idol:     I('surge_idol',     'Surge Idol',      'relic', 750, { icon: '\u{1F5FF}', rarity: 5, slot: 'relic', surgeBonus: 0.5, desc: 'The Ember Surge meter fills half again as fast.' }),

  // --- materials -------------------------------------------------------
  scale_shard:  I('scale_shard',  'Scale Shard',  'material', 25,  { icon: '\u{1FAB5}', desc: 'Shed scale. The forge takes these.' }),
  sinew:        I('sinew',        'Dragon Sinew', 'material', 40,  { icon: '\u{1F9B4}', desc: 'Tough cord, good for harnesses.' }),
  cinder_glass: I('cinder_glass', 'Cinder Glass', 'material', 60,  { icon: '\u{1F3FA}', rarity: 2, desc: 'Sand fused by dragonfire.' }),
  ley_crystal:  I('ley_crystal',  'Ley Crystal',  'material', 120, { icon: '\u{1F48E}', rarity: 3, desc: 'A splinter of an Emberline, still warm.' }),
  dragonbone:   I('dragonbone',   'Dragonbone',   'material', 150, { icon: '\u{1F9B4}', rarity: 3, desc: 'Light, hollow, stronger than iron.' }),
  ashsalt:      I('ashsalt',      'Ashsalt',      'material', 55,  { icon: '\u{1F9C2}', rarity: 2, desc: 'What is left where an ashbound dragon slept.' }),
  stormglass:   I('stormglass',   'Stormglass',   'material', 140, { icon: '\u{1F5A4}', rarity: 3, desc: 'Lightning caught in sand.' }),
  bright_ore:   I('bright_ore',   'Bright Ore',   'material', 200, { icon: '\u{1FA99}', rarity: 4, desc: 'Ore from under an Emberline. Hums faintly.' }),

  // --- breeding --------------------------------------------------------
  warmth_stone: I('warmth_stone', 'Warmth Stone', 'breeding', 200, { icon: '\u{1F525}', rarity: 2, desc: 'An incubating egg needs three fewer battles.',   effect: { incubate: -3 } }),
  brood_incense:I('brood_incense','Brood Incense','breeding', 380, { icon: '\u{1F56F}', rarity: 3, desc: 'Halves the remaining incubation of one egg.',     effect: { incubateHalf: true } }),
  lineage_charm:I('lineage_charm','Lineage Charm','breeding', 650, { icon: '\u{1F9FF}', rarity: 4, desc: 'Forces a pairing to keep one parent’s lineage.', effect: { forceLineage: true } }),
  prism_dust:   I('prism_dust',   'Prism Dust',   'breeding', 720, { icon: '\u{1F308}', rarity: 4, desc: 'Triples the chance of a mutation in the next egg.', effect: { mutate: 3 } }),
  ember_yolk:   I('ember_yolk',   'Ember Yolk',   'breeding', 900, { icon: '\u{1F95A}', rarity: 5, desc: 'The hatchling takes the better of each parent’s essence.', effect: { perfectEssence: true } }),
  brood_tithe:  I('brood_tithe',  'Brood Tithe',  'breeding', 1200,{ icon: '\u{1F31F}', rarity: 5, desc: 'Guarantees an Elder lineage throwback, if one is possible at all.', effect: { forceThrowback: true } }),

  // --- key items -------------------------------------------------------
  wardens_seal: I('wardens_seal', "Warden's Seal", 'key', 0, { icon: '\u{1F396}', rarity: 5, stack: 1, desc: "Maerin's seal. It opens Concord doors, and closes Concord arguments." }),
  broodwell_key:I('broodwell_key','Broodwell Key', 'key', 0, { icon: '\u{1F511}', rarity: 5, stack: 1, desc: 'The hatchery under the old house.' }),
  concord_writ: I('concord_writ', 'Concord Writ',  'key', 0, { icon: '\u{1F4C3}', rarity: 5, stack: 1, desc: 'Permission to enter Cindermarch, signed by someone who regrets it.' }),
  emberline_lens:I('emberline_lens','Emberline Lens','key', 0,{ icon: '\u{1F50E}', rarity: 5, stack: 1, desc: 'Shows where a line still runs under the ground.' }),
  chorus_shell: I('chorus_shell', 'Chorus Shell',  'key', 0, { icon: '\u{1F41A}', rarity: 5, stack: 1, desc: 'Hold it to your ear and the Drowned Chorus answers.' }),
  riven_token:  I('riven_token',  'Riven Token',   'key', 0, { icon: '\u{1FA99}', rarity: 5, stack: 1, desc: 'The Riven Throne recognises whoever carries this.' }),
  spire_pass:   I('spire_pass',   'Spire Pass',    'key', 0, { icon: '\u{1F39F}', rarity: 5, stack: 1, desc: 'Down, into the Hollow Sun.' }),
  elder_egg:    I('elder_egg',    'The Elder Egg', 'key', 0, { icon: '\u{1F95A}', rarity: 5, stack: 1, desc: 'Maerin never got it to hatch. She thought that was her fault.' }),
};

export const ITEM_IDS = Object.keys(ITEMS);
export const item = id => ITEMS[id] || null;
export const itemName = id => (ITEMS[id] ? ITEMS[id].name : id);

export const byKind = kind => ITEM_IDS.filter(id => ITEMS[id].kind === kind);

export const KIND_LABEL = {
  restorative: 'Restoratives', cure: 'Cures', battle: 'Battle', binding: 'Bindings',
  food: 'Food', training: 'Training', relic: 'Relics', material: 'Materials',
  breeding: 'Breeding', key: 'Key items',
};
export const KIND_ORDER = ['restorative', 'cure', 'battle', 'binding', 'food', 'training', 'relic', 'breeding', 'material', 'key'];

/** Forge recipes at Cindermarch (GDD 10). */
export const RECIPES = [
  { out: 'scale_harness',  cost: 120,  parts: { scale_shard: 6, sinew: 2 } },
  { out: 'talon_sheaths',  cost: 120,  parts: { scale_shard: 4, dragonbone: 1 } },
  { out: 'featherweight',  cost: 140,  parts: { sinew: 4, scale_shard: 3 } },
  { out: 'ley_harness',    cost: 180,  parts: { ley_crystal: 2, sinew: 3 } },
  { out: 'bulwark_rig',    cost: 260,  parts: { scale_shard: 10, dragonbone: 2, cinder_glass: 2 } },
  { out: 'emberheart',     cost: 300,  parts: { cinder_glass: 3, ley_crystal: 2 } },
  { out: 'tidesong',       cost: 300,  parts: { ashsalt: 4, ley_crystal: 2 } },
  { out: 'stormring',      cost: 320,  parts: { stormglass: 3, ley_crystal: 1 } },
  { out: 'greenwreath',    cost: 300,  parts: { sinew: 5, ley_crystal: 2 } },
  { out: 'bloodstone',     cost: 400,  parts: { dragonbone: 3, cinder_glass: 3 } },
  { out: 'hollow_lens',    cost: 420,  parts: { ashsalt: 6, cinder_glass: 2, ley_crystal: 2 } },
  { out: 'quiet_bell',     cost: 380,  parts: { bright_ore: 1, stormglass: 2 } },
  { out: 'dawn_collar',    cost: 600,  parts: { bright_ore: 3, ley_crystal: 4 } },
  { out: 'surge_idol',     cost: 650,  parts: { bright_ore: 2, dragonbone: 3, stormglass: 2 } },
  { out: 'sigil_snare',    cost: 200,  parts: { cinder_glass: 2, ley_crystal: 1 } },
  { out: 'soulglass',      cost: 500,  parts: { cinder_glass: 4, bright_ore: 1, ley_crystal: 3 } },
  { out: 'phoenix_cinder', cost: 260,  parts: { cinder_glass: 2, ashsalt: 3 } },
  { out: 'warmth_stone',   cost: 120,  parts: { cinder_glass: 1, ashsalt: 2 } },
];

/** Battle drops, by lineage rarity band. */
export const DROP_TABLE = {
  1: ['scale_shard', 'scale_shard', 'sinew', 'ashsalt'],
  2: ['scale_shard', 'sinew', 'cinder_glass', 'ashsalt'],
  3: ['sinew', 'cinder_glass', 'ley_crystal', 'stormglass', 'dragonbone'],
  4: ['ley_crystal', 'dragonbone', 'stormglass', 'bright_ore'],
  5: ['bright_ore', 'ley_crystal', 'dragonbone'],
};

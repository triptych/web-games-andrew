// ============================================================
// data/moves.js - every skill in the game (GDD 6)
// kind:   'phys' | 'magic' | 'support'
// target: 'one' | 'all' | 'self' | 'ally' | 'allies'
// Everything else is optional data read by game/battle.js. Moves never
// contain logic, so the same table drives the AI, the UI preview and the log.
// ============================================================

const M = (id, name, element, kind, power, mp, o = {}) => ({
  id, name, element, kind, power, mp,
  acc: o.acc ?? 95, target: o.target ?? (kind === 'support' ? 'self' : 'one'),
  ...o,
});

export const MOVES = {
  // --- universal strikes (free, learned at level 1) ---------------------
  strike_claw:  M('strike_claw',  'Claw',        null, 'phys', 40, 0, { desc: 'A plain raking strike.' }),
  strike_fang:  M('strike_fang',  'Fang',        null, 'phys', 42, 0, { acc: 92, desc: 'A bite with some weight behind it.' }),
  strike_talon: M('strike_talon', 'Talon',       null, 'phys', 36, 0, { acc: 98, priority: 1, desc: 'Quick enough to land first.' }),
  strike_tail:  M('strike_tail',  'Tail Swipe',  null, 'phys', 44, 0, { acc: 90, desc: 'Heavy, slow, and it knows it.' }),
  strike_coil:  M('strike_coil',  'Coil',        null, 'phys', 38, 0, { desc: 'Wraps and squeezes.', status: { id: 'chill', chance: 0.12, turns: 2 } }),

  // --- ember -----------------------------------------------------------
  cinder_spit:  M('cinder_spit',  'Cinder Spit', 'ember', 'magic', 45, 4,  { status: { id: 'burn', chance: 0.25, turns: 3 }, desc: 'A mouthful of live coals.' }),
  scorch:       M('scorch',       'Scorch',      'ember', 'magic', 58, 7,  { status: { id: 'burn', chance: 0.35, turns: 3 }, desc: 'A close, flat wash of heat.' }),
  flare_wing:   M('flare_wing',   'Flare Wing',  'ember', 'phys',  62, 8,  { acc: 90, desc: 'Beats fire down onto a single target.' }),
  emberlash:    M('emberlash',    'Emberlash',   'ember', 'magic', 74, 12, { target: 'all', status: { id: 'burn', chance: 0.30, turns: 3 }, desc: 'A whip of line-fire across the whole field.' }),
  kindle:       M('kindle',       'Kindle',      'ember', 'support', 0, 6, { buff: { stat: 'atk', amount: 1.35, turns: 4 }, desc: 'Stokes its own furnace.' }),
  immolate:     M('immolate',     'Immolate',    'ember', 'magic', 108, 18,{ acc: 88, recoil: 0.15, status: { id: 'burn', chance: 0.5, turns: 3 }, desc: 'Burns hot enough to hurt itself.' }),
  ash_roar:     M('ash_roar',     'Ash Roar',    'gloam', 'magic', 50, 8,  { target: 'all', status: { id: 'fear', chance: 0.40, turns: 3 }, desc: 'A noise with no name in it.' }),

  // --- tide ------------------------------------------------------------
  brine_jet:    M('brine_jet',    'Brine Jet',   'tide', 'magic', 46, 4,  { status: { id: 'soak', chance: 0.30, turns: 3 }, desc: 'A needle of seawater.' }),
  undertow:     M('undertow',     'Undertow',    'tide', 'magic', 66, 9,  { status: { id: 'chill', chance: 0.30, turns: 3 }, desc: 'Drags the footing out from under.' }),
  lull:         M('lull',         'Lull',        'tide', 'support', 0, 7, { target: 'one', status: { id: 'muzzle', chance: 0.75, turns: 3 }, acc: 90, desc: 'A hum that stops the throat.' }),
  chorus_song:  M('chorus_song',  'Chorus Song', 'tide', 'magic', 80, 14, { target: 'all', status: { id: 'soak', chance: 0.35, turns: 3 }, desc: 'Every drowned name at once.' }),
  mend_scale:   M('mend_scale',   'Mend Scale',  'tide', 'support', 0, 8, { target: 'ally', healPctMax: 0.35, desc: 'Closes a wound with salt and patience.' }),
  deluge:       M('deluge',       'Deluge',      'tide', 'magic', 100, 17,{ target: 'all', status: { id: 'soak', chance: 0.5, turns: 3 }, desc: 'The marsh, arriving all at once.' }),
  salt_veil:    M('salt_veil',    'Salt Veil',   'tide', 'support', 0, 9, { target: 'allies', status: { id: 'barrier', chance: 1, turns: 3 }, desc: 'A crust of salt over everyone.' }),

  // --- gale ------------------------------------------------------------
  gust:         M('gust',         'Gust',        'gale', 'magic', 42, 3,  { priority: 1, desc: 'Fast, light, always lands somewhere.' }),
  updraft:      M('updraft',      'Updraft',     'gale', 'support', 0, 6, { buff: { stat: 'spd', amount: 1.4, turns: 4 }, desc: 'Finds a column of warm air and sits on it.' }),
  razor_wind:   M('razor_wind',   'Razor Wind',  'gale', 'phys', 68, 9,   { acc: 92, critBonus: 0.15, desc: 'Wind sharpened on a ridge.' }),
  skysunder:    M('skysunder',    'Skysunder',   'gale', 'phys', 96, 16,  { acc: 88, target: 'all', desc: 'A dive that splits the air behind it.' }),
  quicken:      M('quicken',      'Quicken',     'gale', 'support', 0, 8, { target: 'ally', status: { id: 'haste', chance: 1, turns: 4 }, desc: 'Lends its own tempo to a friend.' }),
  cyclone:      M('cyclone',      'Cyclone',     'gale', 'magic', 88, 15, { target: 'all', status: { id: 'stun', chance: 0.18, turns: 1 }, desc: 'Picks the field up and puts it down wrong.' }),
  featherfall:  M('featherfall',  'Featherfall', 'gale', 'support', 0, 7, { target: 'allies', healPctMax: 0.20, desc: 'Sets everyone gently back on their feet.' }),

  // --- stone -----------------------------------------------------------
  shard_toss:   M('shard_toss',   'Shard Toss',  'stone', 'phys', 48, 4,  { desc: 'Slings a piece of the road.' }),
  harden:       M('harden',       'Harden',      'stone', 'support', 0, 5,{ buff: { stat: 'def', amount: 1.45, turns: 4 }, desc: 'Locks its plates down.' }),
  quake:        M('quake',        'Quake',       'stone', 'phys', 78, 12, { target: 'all', acc: 90, desc: 'Drops its weight through the ground.' }),
  tectonic:     M('tectonic',     'Tectonic',    'stone', 'phys', 112, 19,{ target: 'all', acc: 85, status: { id: 'stun', chance: 0.25, turns: 1 }, desc: 'Something under the valley moves.' }),
  stoneskin:    M('stoneskin',    'Stoneskin',   'stone', 'support', 0, 9,{ target: 'ally', status: { id: 'barrier', chance: 1, turns: 3 }, desc: 'Grey rind over a friend.' }),
  avalanche:    M('avalanche',    'Avalanche',   'stone', 'phys', 104, 16,{ acc: 86, status: { id: 'stun', chance: 0.3, turns: 1 }, desc: 'All of it, downhill, at you.' }),
  root_deep:    M('root_deep',    'Root Deep',   'stone', 'support', 0, 10,{ healPctMax: 0.4, status: { id: 'regen', chance: 1, turns: 4 }, desc: 'Draws from whatever is below.' }),
  gore:         M('gore',         'Gore',        'stone', 'phys', 72, 10, { acc: 88, critBonus: 0.2, desc: 'Horns first, questions later.' }),

  // --- verdant ---------------------------------------------------------
  thornspit:    M('thornspit',    'Thornspit',   'verdant', 'magic', 44, 4, { status: { id: 'blight', chance: 0.3, turns: 4 }, desc: 'Seeds that take root in a wound.' }),
  entangle:     M('entangle',     'Entangle',    'verdant', 'support', 0, 6,{ target: 'one', status: { id: 'chill', chance: 0.85, turns: 3 }, acc: 92, desc: 'The ground grows up around its legs.' }),
  bloomburst:   M('bloomburst',   'Bloomburst',  'verdant', 'magic', 70, 10,{ target: 'all', desc: 'A season of growth in one second.' }),
  greenbind:    M('greenbind',    'Greenbind',   'verdant', 'magic', 86, 14,{ status: { id: 'blight', chance: 0.55, turns: 4 }, drain: 0.35, desc: 'Takes what it binds.' }),
  photosleep:   M('photosleep',   'Photosleep',  'verdant', 'support', 0, 7,{ healPctMax: 0.45, desc: 'Stands very still and mends.' }),
  rot_breath:   M('rot_breath',   'Rot Breath',  'verdant', 'magic', 76, 12,{ target: 'all', status: { id: 'blight', chance: 0.4, turns: 4 }, desc: 'Everything it touches goes soft.' }),
  grove_ward:   M('grove_ward',   'Grove Ward',  'verdant', 'support', 0, 11,{ target: 'allies', status: { id: 'regen', chance: 1, turns: 4 }, desc: 'A green field over the whole party.' }),
  mire:         M('mire',         'Mire',        'verdant', 'magic', 54, 7, { status: { id: 'soak', chance: 0.4, turns: 3 }, desc: 'Marsh water, up to the knee.' }),

  // --- storm -----------------------------------------------------------
  spark:        M('spark',        'Spark',       'storm', 'magic', 46, 4,  { acc: 100, status: { id: 'stun', chance: 0.12, turns: 1 }, desc: 'Never misses. Rarely impresses.' }),
  static_field: M('static_field', 'Static Field','storm', 'magic', 62, 8,  { target: 'all', status: { id: 'stun', chance: 0.15, turns: 1 }, desc: 'The air stops being neutral.' }),
  thunderhead:  M('thunderhead',  'Thunderhead', 'storm', 'magic', 98, 15, { acc: 90, status: { id: 'stun', chance: 0.3, turns: 1 }, desc: 'Calls the anvil cloud down on one head.' }),
  overcharge:   M('overcharge',   'Overcharge',  'storm', 'support', 0, 9, { buff: { stat: 'mag', amount: 1.45, turns: 4 }, status: { id: 'haste', chance: 1, turns: 3 }, desc: 'Winds itself far too tight.' }),
  chain_arc:    M('chain_arc',    'Chain Arc',   'storm', 'magic', 58, 11, { target: 'all', desc: 'Jumps target to target and back.' }),

  // --- gloam -----------------------------------------------------------
  gloamspit:    M('gloamspit',    'Gloamspit',   'gloam', 'magic', 52, 5,  { status: { id: 'fear', chance: 0.25, turns: 3 }, desc: 'Ash with something moving in it.' }),
  unname:       M('unname',       'Unname',      'gloam', 'magic', 70, 12, { status: { id: 'muzzle', chance: 0.5, turns: 3 }, desc: 'Takes a word out of its target.' }),
  fearful_screech: M('fearful_screech', 'Screech', 'gloam', 'support', 0, 7, { target: 'all', status: { id: 'fear', chance: 0.7, turns: 3 }, acc: 90, desc: 'The sound of a brood with no line.' }),
  dusk_veil:    M('dusk_veil',    'Dusk Veil',   'gloam', 'support', 0, 8, { buff: { stat: 'res', amount: 1.4, turns: 4 }, desc: 'Pulls the evening over itself.' }),
  oblivion:     M('oblivion',     'Oblivion',    'gloam', 'magic', 116, 20,{ acc: 85, target: 'all', status: { id: 'ashen', chance: 0.3, turns: 3 }, desc: 'What the Emberlines are for, in reverse.' }),
  grey_tide:    M('grey_tide',    'Grey Tide',   'gloam', 'magic', 84, 13, { target: 'all', mpBurn: 6, desc: 'Ash in the lungs and the ley both.' }),

  // --- radiant ---------------------------------------------------------
  glimmer:      M('glimmer',      'Glimmer',     'radiant', 'magic', 48, 5, { status: { id: 'fear', chance: 0.15, turns: 2 }, desc: 'A hard little flash of line-light.' }),
  namecall:     M('namecall',     'Namecall',    'radiant', 'support', 0, 9,{ target: 'one', cleanse: true, acc: 100, desc: "Says a dragon's true name. Ash cannot hold against it." }),
  sunlance:     M('sunlance',     'Sunlance',    'radiant', 'magic', 92, 14,{ acc: 92, desc: 'A line drawn from the sun to one point.' }),
  dawnbreak:    M('dawnbreak',    'Dawnbreak',   'radiant', 'magic', 106, 18,{ target: 'all', desc: 'Morning, whether the sky agrees or not.' }),
  cleanse:      M('cleanse',      'Cleanse',     'radiant', 'support', 0, 8,{ target: 'ally', cureAll: true, healPctMax: 0.25, desc: 'Burns the bad out of a friend.' }),
  warding_light:M('warding_light','Warding Light','radiant','support', 0, 12,{ target: 'allies', status: { id: 'barrier', chance: 1, turns: 4 }, healPctMax: 0.15, desc: 'Line-fire held over the party like a roof.' }),

  // --- boss / unique ---------------------------------------------------
  furnace_breath: M('furnace_breath', 'Furnace Breath', 'ember', 'magic', 128, 0, { target: 'all', acc: 90, status: { id: 'burn', chance: 0.6, turns: 3 }, boss: true, desc: 'The Spire, exhaling.' }),
  drowned_chorus: M('drowned_chorus', 'Drowned Chorus', 'tide', 'magic', 118, 0, { target: 'all', acc: 92, status: { id: 'muzzle', chance: 0.45, turns: 3 }, boss: true, desc: 'Every name the marsh ever took.' }),
  riven_bolt:     M('riven_bolt',     'Riven Bolt',     'storm', 'magic', 124, 0, { acc: 95, status: { id: 'stun', chance: 0.45, turns: 1 }, boss: true, desc: 'The Throne answers its caller.' }),
  stitched_howl:  M('stitched_howl',  'Stitched Howl',  'gloam', 'magic', 110, 0, { target: 'all', acc: 90, status: { id: 'fear', chance: 0.5, turns: 3 }, boss: true, desc: 'Three throats, none of them its own.' }),
  sundering_flame:M('sundering_flame','Sundering Flame','radiant','magic', 150, 0, { target: 'all', acc: 90, boss: true, windup: 'The air goes very still. Something enormous is drawing breath.', desc: 'A hundred years of held fire, let go.' }),
  bind_the_line:  M('bind_the_line',  'Bind the Line',  'radiant', 'support', 0, 0, { target: 'self', status: { id: 'barrier', chance: 1, turns: 3 }, healPctMax: 0.07, boss: true, desc: 'Draws the Emberline back into itself.' }),
};

export const MOVE_IDS = Object.keys(MOVES);
export const move = id => MOVES[id] || MOVES.strike_claw;

/** Moves a Memory Stone can teach: everything not boss-only and not a basic strike. */
export const TEACHABLE = MOVE_IDS.filter(id => !MOVES[id].boss && !id.startsWith('strike_'));

/** Lineage ultimates, spent from the shared Ember Surge meter (GDD 6.4). */
export const SURGES = {
  emberwyrm:  { id: 'surge_forgefall',  name: 'Forgefall',      element: 'ember',   power: 160, target: 'all', desc: 'The first Emberline, briefly, in one animal.' },
  tidechorus: { id: 'surge_namesong',   name: 'Name-Song',      element: 'tide',    power: 145, target: 'all', healPctMax: 0.25, desc: 'Sings the party whole and the enemy under.' },
  skyward:    { id: 'surge_skyfall',    name: 'Skyfall',        element: 'gale',    power: 175, target: 'one', critBonus: 0.4, desc: 'One dive from too high up.' },
  stonefather:{ id: 'surge_worldweight',name: 'World-Weight',   element: 'stone',   power: 150, target: 'all', status: { id: 'stun', chance: 0.5, turns: 1 }, desc: 'Puts the whole valley on them.' },
  verdantcoil:{ id: 'surge_greenyear',  name: 'Green Year',     element: 'verdant', power: 140, target: 'all', status: { id: 'blight', chance: 0.7, turns: 4 }, desc: 'A decade of growth and rot in a breath.' },
  cinderling: { id: 'surge_flashfire',  name: 'Flashfire',      element: 'ember',   power: 130, target: 'all', desc: 'Everything it has, immediately.' },
  saltdrake:  { id: 'surge_springtide', name: 'Springtide',     element: 'tide',    power: 135, target: 'all', status: { id: 'soak', chance: 0.7, turns: 3 }, desc: 'The marsh comes in early.' },
  ridgeback:  { id: 'surge_ridgefall',  name: 'Ridgefall',      element: 'stone',   power: 155, target: 'one', desc: 'A whole spine, swung once.' },
  glimmerwing:{ id: 'surge_prismbreak', name: 'Prismbreak',     element: 'radiant', power: 138, target: 'all', desc: 'Splits the light and all of it cuts.' },
  boglurk:    { id: 'surge_mirecall',   name: 'Mirecall',       element: 'verdant', power: 128, target: 'all', status: { id: 'chill', chance: 0.7, turns: 3 }, desc: 'The bog, standing up.' },
  stormcaller:{ id: 'surge_anvilsky',   name: 'Anvil Sky',      element: 'storm',   power: 165, target: 'all', status: { id: 'stun', chance: 0.35, turns: 1 }, desc: 'Every charge it has been saving.' },
  ashbound:   { id: 'surge_greyhour',   name: 'Grey Hour',      element: 'gloam',   power: 150, target: 'all', status: { id: 'fear', chance: 0.6, turns: 3 }, desc: 'A little of what took it.' },
};

/** Elder-stage dragons hit harder with their surge and it costs the same. */
export function surgeFor(lineageId, stage) {
  const base = SURGES[lineageId] || SURGES.cinderling;
  if (stage !== 'elder') return base;
  return { ...base, name: base.name + ' — Elder', power: Math.round(base.power * 1.35), elder: true };
}

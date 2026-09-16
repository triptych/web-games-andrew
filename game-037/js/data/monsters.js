// ============================================================
// data/monsters.js - monster archetypes (GDD §15.7). APPEND ONLY.
// ============================================================

const m = (key, name, o) => ({
  key, name, family: o.family, tier: o.tier, threat: o.threat,
  base: o.base, behavior: o.behavior, tags: o.tags || [],
  resist: o.resist || {}, weak: o.weak || {},
  loot: o.loot || 'beast_small', xp: o.xp,
  sprite: o.sprite, tells: o.tells || {}, ability: o.ability || null,
  hostile: o.hostile !== false, dmgType: o.dmgType || 'blunt',
});

export const MONSTERS = {
  // --- tier 0-1, the gentle end ---
  hare: m('hare', 'hare', {
    family: 'beast', tier: 0, threat: 1, hostile: false,
    base: { hp: 4, atk: 1, def: 0, speed: 130, sight: 7, hearing: 9 },
    behavior: 'wanderer', tags: ['day', 'field'], loot: 'beast_small', xp: 2,
    sprite: { silhouette: 'quadruped_low', palette: 'beast_brown', size: 0.8 },
    tells: { windup: 'freezes' },
  }),
  crag_goat: m('crag_goat', 'crag goat', {
    family: 'beast', tier: 1, threat: 4, hostile: false,
    base: { hp: 14, atk: 3, def: 1, speed: 100, sight: 8, hearing: 7 },
    behavior: 'wanderer', tags: ['day', 'upland'], loot: 'beast_small', xp: 6,
    sprite: { silhouette: 'quadruped', palette: 'beast_grey', size: 1 },
    tells: { windup: 'lowers its horns', ability: 'butt' },
    ability: { key: 'butt', range: 1, cooldown: 3, telegraph: 1, knockback: 1 },
  }),
  rat_swarm: m('rat_swarm', 'rats', {
    family: 'swarm', tier: 0, threat: 3,
    base: { hp: 7, atk: 2, def: 0, speed: 110, sight: 5, hearing: 10 },
    behavior: 'swarm', tags: ['indoor', 'night'], loot: 'none', xp: 4,
    sprite: { silhouette: 'swarm_low', palette: 'beast_brown', size: 0.7 },
  }),
  midge_swarm: m('midge_swarm', 'midge cloud', {
    family: 'swarm', tier: 1, threat: 4,
    base: { hp: 9, atk: 2, def: 0, speed: 130, sight: 6, hearing: 4 },
    behavior: 'swarm', tags: ['fen', 'day'], loot: 'none', xp: 5, dmgType: 'pierce',
    sprite: { silhouette: 'swarm_air', palette: 'fen', size: 0.8 },
  }),
  crow_swarm: m('crow_swarm', 'crows', {
    family: 'swarm', tier: 1, threat: 5,
    base: { hp: 11, atk: 3, def: 0, speed: 120, sight: 9, hearing: 8 },
    behavior: 'swarm', tags: ['field', 'day'], loot: 'none', xp: 6, dmgType: 'cut',
    sprite: { silhouette: 'swarm_air', palette: 'dark', size: 0.9 },
  }),
  fen_lurcher: m('fen_lurcher', 'fen lurcher', {
    family: 'beast', tier: 1, threat: 6,
    base: { hp: 12, atk: 4, def: 1, speed: 100, sight: 6, hearing: 8 },
    behavior: 'ambusher', tags: ['water', 'night', 'fen'],
    resist: { cold: 0.5 }, weak: { fire: 1.5 }, loot: 'beast_small', xp: 8, dmgType: 'cut',
    sprite: { silhouette: 'quadruped_low', palette: 'fen', size: 1 },
    tells: { windup: 'lowers its head', ability: 'lunge' },
    ability: { key: 'lunge', range: 3, cooldown: 4, telegraph: 1 },
  }),
  crab_thing: m('crab_thing', 'shore-crab', {
    family: 'beast', tier: 1, threat: 5,
    base: { hp: 16, atk: 3, def: 3, speed: 80, sight: 5, hearing: 6 },
    behavior: 'sentry', tags: ['shore', 'water'], resist: { blunt: 0.6 }, weak: { fire: 1.3 },
    loot: 'beast_small', xp: 7, dmgType: 'cut',
    sprite: { silhouette: 'low_wide', palette: 'shore', size: 1 },
  }),
  wolf: m('wolf', 'wolf', {
    family: 'beast', tier: 2, threat: 8,
    base: { hp: 18, atk: 5, def: 1, speed: 120, sight: 9, hearing: 11 },
    behavior: 'pack', tags: ['wood', 'night'], loot: 'beast_medium', xp: 12, dmgType: 'cut',
    sprite: { silhouette: 'quadruped', palette: 'beast_grey', size: 1.1 },
    tells: { windup: 'circles' },
  }),
  pale_hound: m('pale_hound', 'pale hound', {
    family: 'beast', tier: 2, threat: 9,
    base: { hp: 20, atk: 6, def: 2, speed: 120, sight: 8, hearing: 12 },
    behavior: 'pack', tags: ['upland', 'night', 'cold'], resist: { cold: 0.5 },
    loot: 'beast_medium', xp: 14, dmgType: 'cut',
    sprite: { silhouette: 'quadruped', palette: 'pale', size: 1.1 },
  }),
  bandit: m('bandit', 'bandit', {
    family: 'folk', tier: 2, threat: 9,
    base: { hp: 22, atk: 5, def: 3, speed: 100, sight: 9, hearing: 8 },
    behavior: 'wanderer', tags: ['road', 'day'], loot: 'folk', xp: 15, dmgType: 'cut',
    sprite: { silhouette: 'biped', palette: 'folk_drab', size: 1 },
    tells: { windup: 'shifts their grip' },
  }),
  shore_folk: m('shore_folk', 'wrecker', {
    family: 'folk', tier: 2, threat: 10,
    base: { hp: 24, atk: 6, def: 3, speed: 100, sight: 8, hearing: 8 },
    behavior: 'charger', tags: ['shore'], loot: 'folk', xp: 16, dmgType: 'blunt',
    sprite: { silhouette: 'biped', palette: 'salt', size: 1 },
  }),
  drowned_thing: m('drowned_thing', 'drowned', {
    family: 'drowned', tier: 3, threat: 12,
    base: { hp: 30, atk: 7, def: 3, speed: 80, sight: 6, hearing: 6 },
    behavior: 'charger', tags: ['water', 'hollow'], resist: { cold: 0.5, pierce: 0.7 }, weak: { fire: 1.5 },
    loot: 'drowned', xp: 22, dmgType: 'blunt',
    sprite: { silhouette: 'biped_hunched', palette: 'drowned', size: 1.1 },
    tells: { windup: 'draws a long breath it does not need' },
  }),
  stone_walker: m('stone_walker', 'stone-walker', {
    family: 'stone', tier: 3, threat: 13,
    base: { hp: 38, atk: 7, def: 6, speed: 70, sight: 6, hearing: 5 },
    behavior: 'sentry', tags: ['stone', 'hollow'], resist: { cut: 0.5, pierce: 0.5 }, weak: { blunt: 1.5 },
    loot: 'stone', xp: 26, dmgType: 'blunt',
    sprite: { silhouette: 'bulk', palette: 'stone', size: 1.3 },
    tells: { windup: 'grinds', ability: 'slam' },
    ability: { key: 'slam', range: 1, cooldown: 4, telegraph: 1, knockback: 1 },
  }),
  root_thing: m('root_thing', 'root-thing', {
    family: 'root', tier: 2, threat: 10,
    base: { hp: 26, atk: 5, def: 4, speed: 80, sight: 5, hearing: 9 },
    behavior: 'ambusher', tags: ['wood', 'hollow'], resist: { pierce: 0.6 }, weak: { fire: 2.0 },
    loot: 'root', xp: 18, dmgType: 'blunt',
    sprite: { silhouette: 'tangle', palette: 'root', size: 1.1 },
    tells: { windup: 'creaks', ability: 'grasp' },
    ability: { key: 'grasp', range: 2, cooldown: 5, telegraph: 1, status: 'slowed' },
  }),
  wisp: m('wisp', 'quiet-wisp', {
    family: 'forgotten', tier: 2, threat: 8,
    base: { hp: 14, atk: 5, def: 0, speed: 130, sight: 10, hearing: 10 },
    behavior: 'erratic', tags: ['quiet', 'night'], resist: { cut: 0.4, pierce: 0.4 }, weak: { name: 2.0 },
    loot: 'quiet', xp: 16, dmgType: 'name',
    sprite: { silhouette: 'wisp', palette: 'quiet', size: 0.9 },
    tells: { windup: 'dims' },
  }),
  bell_shade: m('bell_shade', 'shade', {
    family: 'forgotten', tier: 3, threat: 14,
    base: { hp: 28, atk: 8, def: 2, speed: 110, sight: 9, hearing: 12 },
    behavior: 'caster', tags: ['quiet', 'hollow'], resist: { cut: 0.5 }, weak: { name: 1.6, fire: 1.2 },
    loot: 'quiet', xp: 30, dmgType: 'name',
    sprite: { silhouette: 'tall_thin', palette: 'quiet', size: 1.2 },
    tells: { windup: 'says a name that is not yours', ability: 'unname' },
    ability: { key: 'unname', range: 5, cooldown: 6, telegraph: 1, status: 'unnamed' },
  }),
  salt_thing: m('salt_thing', 'salt-thing', {
    family: 'stone', tier: 4, threat: 16,
    base: { hp: 40, atk: 9, def: 5, speed: 90, sight: 7, hearing: 6 },
    behavior: 'charger', tags: ['salt', 'hollow'], resist: { pierce: 0.6, cold: 0.5 }, weak: { blunt: 1.4 },
    loot: 'stone', xp: 36, dmgType: 'cut',
    sprite: { silhouette: 'bulk', palette: 'salt', size: 1.2 },
  }),
  hollow_hound: m('hollow_hound', 'hollow hound', {
    family: 'beast', tier: 4, threat: 15,
    base: { hp: 34, atk: 10, def: 3, speed: 130, sight: 9, hearing: 12 },
    behavior: 'pack', tags: ['hollow', 'night'], loot: 'beast_medium', xp: 34, dmgType: 'cut',
    sprite: { silhouette: 'quadruped', palette: 'dark', size: 1.2 },
  }),
  mill_thing: m('mill_thing', 'grinder', {
    family: 'stone', tier: 4, threat: 17,
    base: { hp: 46, atk: 10, def: 6, speed: 80, sight: 6, hearing: 8 },
    behavior: 'charger', tags: ['mill', 'hollow'], resist: { cut: 0.5 }, weak: { blunt: 1.3 },
    loot: 'stone', xp: 40, dmgType: 'blunt',
    sprite: { silhouette: 'bulk', palette: 'stone', size: 1.3 },
    tells: { windup: 'winds up', ability: 'sweep' },
    ability: { key: 'sweep', range: 1, cooldown: 4, telegraph: 1, sweep: true },
  }),
  deep_folk: m('deep_folk', 'the desperate', {
    family: 'folk', tier: 5, threat: 19,
    base: { hp: 44, atk: 11, def: 5, speed: 110, sight: 9, hearing: 9 },
    behavior: 'pack', tags: ['hollow'], loot: 'folk', xp: 46, dmgType: 'cut',
    sprite: { silhouette: 'biped', palette: 'folk_dark', size: 1 },
  }),

  // --- wardens (bosses) ---
  drowned_warden: m('drowned_warden', 'drowned warden', {
    family: 'warden', tier: 2, threat: 30,
    base: { hp: 90, atk: 10, def: 5, speed: 100, sight: 9, hearing: 9 },
    behavior: 'warden', tags: ['water', 'boss'], resist: { cold: 0.5, pierce: 0.7 }, weak: { fire: 1.4 },
    loot: 'boss', xp: 120, dmgType: 'blunt',
    sprite: { silhouette: 'bulk_tall', palette: 'drowned', size: 1.5 },
    tells: { windup: 'draws the water up with it', ability: 'surge' },
    ability: { key: 'surge', range: 3, cooldown: 5, telegraph: 1, knockback: 2 },
  }),
  stone_warden: m('stone_warden', 'stone warden', {
    family: 'warden', tier: 3, threat: 34,
    base: { hp: 110, atk: 11, def: 8, speed: 80, sight: 8, hearing: 7 },
    behavior: 'warden', tags: ['stone', 'boss'], resist: { cut: 0.5, pierce: 0.5 }, weak: { blunt: 1.4 },
    loot: 'boss', xp: 140, dmgType: 'blunt',
    sprite: { silhouette: 'bulk_tall', palette: 'stone', size: 1.6 },
    tells: { windup: 'raises both arms', ability: 'quake' },
    ability: { key: 'quake', range: 2, cooldown: 5, telegraph: 1, sweep: true },
  }),
  root_warden: m('root_warden', 'root warden', {
    family: 'warden', tier: 3, threat: 32,
    base: { hp: 100, atk: 11, def: 6, speed: 90, sight: 7, hearing: 10 },
    behavior: 'warden', tags: ['root', 'boss'], resist: { pierce: 0.6 }, weak: { fire: 1.8 },
    loot: 'boss', xp: 135, dmgType: 'cut',
    sprite: { silhouette: 'tangle_tall', palette: 'root', size: 1.5 },
    tells: { windup: 'puts roots into the floor', ability: 'ensnare' },
    ability: { key: 'ensnare', range: 4, cooldown: 4, telegraph: 1, status: 'slowed' },
  }),
  quiet_warden: m('quiet_warden', 'the quiet warden', {
    family: 'warden', tier: 4, threat: 36,
    base: { hp: 105, atk: 12, def: 5, speed: 110, sight: 10, hearing: 12 },
    behavior: 'warden', tags: ['quiet', 'boss'], resist: { cut: 0.5, pierce: 0.5 }, weak: { name: 1.8 },
    loot: 'boss', xp: 150, dmgType: 'name',
    sprite: { silhouette: 'tall_thin', palette: 'quiet', size: 1.5 },
    tells: { windup: 'starts to say your name', ability: 'unname' },
    ability: { key: 'unname', range: 6, cooldown: 4, telegraph: 1, status: 'unnamed' },
  }),
  salt_warden: m('salt_warden', 'salt warden', {
    family: 'warden', tier: 4, threat: 38,
    base: { hp: 120, atk: 13, def: 7, speed: 90, sight: 8, hearing: 8 },
    behavior: 'warden', tags: ['salt', 'boss'], resist: { pierce: 0.6, cold: 0.5 }, weak: { blunt: 1.3 },
    loot: 'boss', xp: 165, dmgType: 'cut',
    sprite: { silhouette: 'bulk_tall', palette: 'salt', size: 1.5 },
    tells: { windup: 'crusts over', ability: 'shardfall' },
    ability: { key: 'shardfall', range: 4, cooldown: 5, telegraph: 1 },
  }),
  the_one_who_stayed: m('the_one_who_stayed', 'the one who stayed', {
    family: 'warden', tier: 6, threat: 48,
    base: { hp: 170, atk: 15, def: 8, speed: 110, sight: 12, hearing: 12 },
    behavior: 'warden', tags: ['quiet', 'boss', 'person'], resist: { cut: 0.6, pierce: 0.6, name: 0.5 },
    loot: 'boss', xp: 400, dmgType: 'name',
    sprite: { silhouette: 'biped_tall', palette: 'quiet', size: 1.4 },
    tells: { windup: 'looks at you the way you look at a door', ability: 'forget' },
    ability: { key: 'forget', range: 7, cooldown: 4, telegraph: 1, status: 'unnamed' },
  }),
};
for (const k of Object.keys(MONSTERS)) { Object.freeze(MONSTERS[k].base); Object.freeze(MONSTERS[k]); }
Object.freeze(MONSTERS);

export const WARDEN_KEYS = Object.freeze(['drowned_warden', 'stone_warden', 'root_warden', 'quiet_warden', 'salt_warden']);

export const ELITE_MODS = Object.freeze({
  swift: { name: 'swift', speed: 30 },
  armoured: { name: 'armoured', def: 3 },
  venomous: { name: 'venomous', status: 'poisoned' },
  great: { name: 'great', hpMult: 1.6, atkMult: 1.25, size: 1 },
  paired: { name: 'paired', twin: true },
  keening: { name: 'keening', calls: true },
});

/** Loot tables by archetype family. Values are item keys with weights. */
export const LOOT_TABLES = Object.freeze({
  none: {},
  beast_small: { berries: 3, nettle: 3, tallow: 2, bone: 0 },
  beast_medium: { tallow: 4, wool: 2, heart_root: 1, bandage: 1 },
  folk: { bread: 3, bandage: 2, oil_flask: 2, arrow: 2, repair_kit: 1 },
  drowned: { salt: 4, river_clay: 2, oil_flask: 1, name_shard: 1 },
  stone: { river_clay: 4, salt: 2, repair_kit: 1 },
  root: { heart_root: 4, bell_cap: 3, nettle: 2 },
  quiet: { name_shard: 5, moon_cap: 2 },
  boss: { oil_flask: 3, repair_kit: 2, name_shard: 2, heart_root: 2 },
});

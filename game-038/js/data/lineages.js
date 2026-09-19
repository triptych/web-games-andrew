// ============================================================
// data/lineages.js - the twelve dragon families (GDD 4.2)
// base: stat spread at level 1 · growth: per-level multiplier weight
// geneBias: what this family tends to look like, so a Ridgeback reads as one
// ============================================================

const L = (o) => o;

export const LINEAGES = {
  emberwyrm: L({
    id: 'emberwyrm', name: 'Emberwyrm', elder: true, rarity: 4,
    elements: ['ember', null], altSecondary: ['stone', 'radiant'],
    base: { hp: 42, mp: 20, atk: 15, mag: 13, def: 12, res: 10, spd: 11 },
    growth: { hp: 1.05, mp: 0.85, atk: 1.15, mag: 1.00, def: 0.95, res: 0.85, spd: 0.90 },
    geneBias: { body: ['drake', 'quad'], wings: ['membrane'], horns: ['crown', 'swept'], tail: ['spade', 'spikes'], crest: ['plates', 'sail'], pattern: ['banded', 'veined'], hue: [8, 36] },
    signature: 'emberlash', trait: 'forgeheart',
    learn: ['strike_claw', 'cinder_spit', 'scorch', 'flare_wing', 'emberlash', 'kindle', 'immolate', 'ash_roar'],
    blurb: 'Line-keepers of the first Emberline. Warm to the touch even asleep.',
  }),
  tidechorus: L({
    id: 'tidechorus', name: 'Tidechorus', elder: true, rarity: 4,
    elements: ['tide', null], altSecondary: ['gale', 'verdant'],
    base: { hp: 40, mp: 30, atk: 10, mag: 16, def: 11, res: 15, spd: 11 },
    growth: { hp: 0.95, mp: 1.20, atk: 0.85, mag: 1.15, def: 0.90, res: 1.10, spd: 0.95 },
    geneBias: { body: ['serpent', 'amphithere'], wings: ['finned', 'membrane'], horns: ['spiral', 'none'], tail: ['fan', 'whip'], crest: ['frill', 'sail'], pattern: ['gradient', 'spotted'], hue: [185, 215] },
    signature: 'chorus_song', trait: 'saltmemory',
    learn: ['strike_fang', 'brine_jet', 'lull', 'undertow', 'chorus_song', 'mend_scale', 'deluge', 'salt_veil'],
    blurb: 'They sing the names of drowned things. Water remembers; so do they.',
  }),
  skyward: L({
    id: 'skyward', name: 'Skyward', elder: true, rarity: 4,
    elements: ['gale', null], altSecondary: ['storm', 'radiant'],
    base: { hp: 35, mp: 24, atk: 13, mag: 13, def: 9, res: 11, spd: 18 },
    growth: { hp: 0.85, mp: 1.00, atk: 1.00, mag: 1.00, def: 0.80, res: 0.90, spd: 1.30 },
    geneBias: { body: ['wyvern', 'amphithere'], wings: ['feathered', 'twin'], horns: ['swept', 'none'], tail: ['fan', 'whip'], crest: ['mane', 'frill'], pattern: ['gradient', 'plain'], hue: [150, 195] },
    signature: 'skysunder', trait: 'swiftwing',
    learn: ['strike_talon', 'gust', 'updraft', 'razor_wind', 'skysunder', 'quicken', 'cyclone', 'featherfall'],
    blurb: 'Nests above the weather. A Skyward on the ground is a Skyward in trouble.',
  }),
  stonefather: L({
    id: 'stonefather', name: 'Stonefather', elder: true, rarity: 4,
    elements: ['stone', null], altSecondary: ['ember', 'verdant'],
    base: { hp: 55, mp: 16, atk: 14, mag: 9, def: 19, res: 14, spd: 7 },
    growth: { hp: 1.30, mp: 0.75, atk: 1.05, mag: 0.75, def: 1.30, res: 1.05, spd: 0.65 },
    geneBias: { body: ['quad'], wings: ['vestigial', 'membrane'], horns: ['antler', 'crown'], tail: ['club', 'spikes'], crest: ['plates'], pattern: ['mottled', 'veined'], hue: [24, 44] },
    signature: 'tectonic', trait: 'bedrock',
    learn: ['strike_tail', 'shard_toss', 'harden', 'quake', 'tectonic', 'stoneskin', 'avalanche', 'root_deep'],
    blurb: 'Older than the Concord and slower than its paperwork.',
  }),
  verdantcoil: L({
    id: 'verdantcoil', name: 'Verdant Coil', elder: true, rarity: 4,
    elements: ['verdant', null], altSecondary: ['tide', 'gloam'],
    base: { hp: 44, mp: 28, atk: 11, mag: 15, def: 13, res: 13, spd: 10 },
    growth: { hp: 1.10, mp: 1.10, atk: 0.90, mag: 1.15, def: 1.00, res: 1.00, spd: 0.85 },
    geneBias: { body: ['serpent', 'amphithere'], wings: ['finned', 'vestigial'], horns: ['antler', 'spiral'], tail: ['whip', 'fan'], crest: ['mane', 'frill'], pattern: ['spotted', 'veined'], hue: [85, 125] },
    signature: 'greenbind', trait: 'quickening',
    learn: ['strike_coil', 'thornspit', 'entangle', 'bloomburst', 'greenbind', 'photosleep', 'rot_breath', 'grove_ward'],
    blurb: 'Grows into whatever it nests on. Do not let one nest on your house.',
  }),

  cinderling: L({
    id: 'cinderling', name: 'Cinderling', elder: false, rarity: 1,
    elements: ['ember', null], altSecondary: ['gloam', null],
    base: { hp: 30, mp: 14, atk: 12, mag: 10, def: 9, res: 8, spd: 13 },
    growth: { hp: 0.85, mp: 0.80, atk: 1.00, mag: 0.85, def: 0.80, res: 0.75, spd: 1.05 },
    geneBias: { body: ['drake', 'wyvern'], wings: ['membrane', 'vestigial'], horns: ['swept', 'none'], tail: ['spade', 'whip'], crest: ['none', 'frill'], pattern: ['spotted', 'plain'], hue: [10, 40] },
    signature: 'cinder_spit', trait: 'emberhide',
    learn: ['strike_claw', 'cinder_spit', 'scorch', 'flare_wing', 'kindle', 'ash_roar'],
    blurb: 'Vale-common, pan-sized as a hatchling, and entirely convinced it is enormous.',
  }),
  saltdrake: L({
    id: 'saltdrake', name: 'Saltdrake', elder: false, rarity: 2,
    elements: ['tide', null], altSecondary: ['stone', 'gale'],
    base: { hp: 38, mp: 20, atk: 13, mag: 12, def: 14, res: 12, spd: 9 },
    growth: { hp: 1.05, mp: 0.95, atk: 1.05, mag: 0.95, def: 1.05, res: 0.95, spd: 0.85 },
    geneBias: { body: ['quad', 'drake'], wings: ['finned', 'membrane'], horns: ['crown', 'spiral'], tail: ['fan', 'club'], crest: ['sail', 'plates'], pattern: ['banded', 'mottled'], hue: [175, 210] },
    signature: 'undertow', trait: 'saltmemory',
    learn: ['strike_fang', 'brine_jet', 'undertow', 'harden', 'mend_scale', 'salt_veil'],
    blurb: 'Marsh-hauler. Patient, heavy, and impossible to move if it has decided to sit.',
  }),
  ridgeback: L({
    id: 'ridgeback', name: 'Ridgeback', elder: false, rarity: 2,
    elements: ['stone', null], altSecondary: ['gale', 'ember'],
    base: { hp: 46, mp: 14, atk: 16, mag: 8, def: 16, res: 10, spd: 9 },
    growth: { hp: 1.15, mp: 0.70, atk: 1.20, mag: 0.70, def: 1.10, res: 0.85, spd: 0.85 },
    geneBias: { body: ['quad', 'drake'], wings: ['vestigial', 'membrane'], horns: ['antler', 'crown'], tail: ['club', 'spikes'], crest: ['plates', 'sail'], pattern: ['banded', 'mottled'], hue: [20, 50] },
    signature: 'quake', trait: 'thickscale',
    learn: ['strike_tail', 'shard_toss', 'harden', 'quake', 'stoneskin', 'gore'],
    blurb: 'Peak-dweller with a spine like a broken wall. Used for haulage before the Concord.',
  }),
  glimmerwing: L({
    id: 'glimmerwing', name: 'Glimmerwing', elder: false, rarity: 2,
    elements: ['gale', null], altSecondary: ['radiant', 'storm'],
    base: { hp: 30, mp: 26, atk: 9, mag: 15, def: 8, res: 13, spd: 16 },
    growth: { hp: 0.80, mp: 1.15, atk: 0.80, mag: 1.10, def: 0.75, res: 1.00, spd: 1.20 },
    geneBias: { body: ['amphithere', 'serpent'], wings: ['feathered', 'twin'], horns: ['none', 'spiral'], tail: ['fan', 'whip'], crest: ['frill', 'mane'], pattern: ['gradient', 'spotted'], hue: [140, 200] },
    signature: 'razor_wind', trait: 'dazzle',
    learn: ['strike_talon', 'gust', 'glimmer', 'razor_wind', 'quicken', 'featherfall'],
    blurb: 'Half of what you see is refraction. The biting half is real.',
  }),
  boglurk: L({
    id: 'boglurk', name: 'Boglurk', elder: false, rarity: 1,
    elements: ['verdant', null], altSecondary: ['tide', 'gloam'],
    base: { hp: 40, mp: 18, atk: 12, mag: 12, def: 12, res: 11, spd: 8 },
    growth: { hp: 1.10, mp: 0.90, atk: 0.95, mag: 1.00, def: 1.00, res: 0.90, spd: 0.75 },
    geneBias: { body: ['serpent', 'quad'], wings: ['vestigial', 'finned'], horns: ['none', 'antler'], tail: ['whip', 'club'], crest: ['frill', 'none'], pattern: ['mottled', 'spotted'], hue: [70, 120] },
    signature: 'rot_breath', trait: 'clingfast',
    learn: ['strike_coil', 'thornspit', 'entangle', 'rot_breath', 'photosleep', 'mire'],
    blurb: 'Sits in the reeds. Has sat in the reeds for years. Will outsit you.',
  }),
  stormcaller: L({
    id: 'stormcaller', name: 'Stormcaller', elder: false, rarity: 3,
    elements: ['storm', null], altSecondary: ['gale', 'tide'],
    base: { hp: 34, mp: 28, atk: 12, mag: 17, def: 9, res: 12, spd: 15 },
    growth: { hp: 0.90, mp: 1.15, atk: 0.95, mag: 1.25, def: 0.80, res: 0.95, spd: 1.15 },
    geneBias: { body: ['wyvern', 'drake'], wings: ['twin', 'feathered'], horns: ['spiral', 'swept'], tail: ['spikes', 'fan'], crest: ['mane', 'sail'], pattern: ['veined', 'gradient'], hue: [45, 70] },
    signature: 'thunderhead', trait: 'stormborn',
    learn: ['strike_talon', 'spark', 'static_field', 'thunderhead', 'quicken', 'overcharge'],
    blurb: 'Charges the air until your teeth ache, then apologises by way of lightning.',
  }),
  ashbound: L({
    id: 'ashbound', name: 'Ashbound', elder: false, rarity: 3, feral: true,
    elements: ['gloam', null], altSecondary: ['ember', 'storm'],
    base: { hp: 42, mp: 18, atk: 15, mag: 13, def: 11, res: 11, spd: 12 },
    growth: { hp: 1.05, mp: 0.85, atk: 1.15, mag: 1.00, def: 0.90, res: 0.90, spd: 1.00 },
    geneBias: { body: ['drake', 'serpent', 'wyvern'], wings: ['membrane', 'vestigial'], horns: ['swept', 'antler'], tail: ['spikes', 'whip'], crest: ['none', 'plates'], pattern: ['mottled', 'veined'], hue: [255, 290] },
    signature: 'ash_roar', trait: 'hollowed',
    learn: ['strike_claw', 'ash_roar', 'gloamspit', 'unname', 'fearful_screech', 'cinder_spit'],
    blurb: 'It was something else once. Under the grey it still is, for a while longer.',
  }),
};

export const LINEAGE_IDS = Object.keys(LINEAGES);
export const ELDER_LINEAGES = LINEAGE_IDS.filter(id => LINEAGES[id].elder);
export const WILD_LINEAGES = LINEAGE_IDS.filter(id => !LINEAGES[id].feral);

export const lineage = id => LINEAGES[id] || LINEAGES.cinderling;

/** Lineages that can appear as wild encounters in a region, by element affinity. */
export function lineagesByElement(elementId) {
  return LINEAGE_IDS.filter(id => LINEAGES[id].elements[0] === elementId);
}

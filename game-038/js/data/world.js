// ============================================================
// data/world.js - the node map (GDD 12)
// 28 places across five regions. Map coordinates are in a 0-100 space and
// scaled to whatever canvas the player has; links are bidirectional.
// ============================================================

export const REGIONS = {
  vale:   { id: 'vale',   name: 'The Guttering Vale', act: 1, colour: '#7ba05b', elements: ['ember', 'verdant', 'stone'],   band: [2, 8],   blurb: 'Thin pasture under a sky that used to be warmer.' },
  march:  { id: 'march',  name: 'The Salt Marches',   act: 2, colour: '#4f8fa8', elements: ['tide', 'verdant', 'gloam'],    band: [9, 18],  blurb: 'Reed, water, and the sound of something singing badly.' },
  cinder: { id: 'cinder', name: 'Cindermarch',        act: 3, colour: '#a86a3c', elements: ['ember', 'gloam', 'storm'],     band: [18, 30], blurb: 'The Concord’s furnace city. Everything here is warm and nothing is comfortable.' },
  peaks:  { id: 'peaks',  name: 'The Riven Peaks',    act: 4, colour: '#8d93b8', elements: ['gale', 'storm', 'stone'],      band: [28, 42], blurb: 'Above the weather, where the Skyward brood used to nest.' },
  spire:  { id: 'spire',  name: 'The Hollow Sun',     act: 5, colour: '#d8b24a', elements: ['radiant', 'ember', 'gloam'],   band: [40, 55], blurb: 'Inside the Spire. The light here is a hundred years old and very tired.' },
};

const N = (id, name, region, kind, x, y, links, o = {}) => ({ id, name, region, kind, x, y, links, ...o });

export const NODES = {
  // --- Act I: the Guttering Vale ---------------------------------------
  broodwell:     N('broodwell', 'The Broodwell', 'vale', 'home', 14, 76, ['lowfields', 'hollowbridge'], {
    services: ['rest', 'brood', 'board', 'shop'], act: 1, home: true,
    blurb: "Maerin's house, her hatchery, and a hill with a hole in it that has been warm for two hundred years." }),
  lowfields:     N('lowfields', 'The Low Fields', 'vale', 'wild', 30, 84, ['broodwell', 'thornwatch', 'old_line'], {
    act: 1, blurb: 'Grazing gone to seed. Cinderlings dig here for grubs and set the stubble alight doing it.' }),
  thornwatch:    N('thornwatch', 'Thornwatch', 'vale', 'wild', 44, 90, ['lowfields', 'hollowbridge'], {
    act: 1, blurb: 'A hedgerow nobody has cut since the line went out. Something green lives in it.' }),
  hollowbridge:  N('hollowbridge', 'Hollowbridge', 'vale', 'town', 30, 64, ['broodwell', 'thornwatch', 'cinder_roost', 'old_line'], {
    services: ['shop', 'board', 'rest'], act: 1,
    blurb: 'Six houses and an inn, built on a bridge over a river that has moved since.' }),
  old_line:      N('old_line', 'The Old Line', 'vale', 'landmark', 46, 70, ['lowfields', 'hollowbridge', 'cinder_roost'], {
    act: 1, blurb: 'A scar of scorched ground running dead straight for eleven miles. Nothing grows on it. Nothing ever did.' }),
  cinder_roost:  N('cinder_roost', 'The Guttering Roost', 'vale', 'roost', 56, 58, ['hollowbridge', 'old_line', 'saltley'], {
    act: 1, boss: 'cinderfang', depth: 3,
    blurb: "A chimney of old basalt. Maerin's last hatchling died here and she never said much about it." }),

  // --- Act II: the Salt Marches ----------------------------------------
  saltley:       N('saltley', 'Saltley', 'march', 'town', 66, 72, ['cinder_roost', 'reedflats', 'tidewatch'], {
    services: ['shop', 'board', 'rest', 'relics'], act: 2,
    blurb: 'Stilts, salt, and a market that opens when the water says so.' }),
  reedflats:     N('reedflats', 'The Reed Flats', 'march', 'wild', 78, 82, ['saltley', 'ossuary', 'drowned_stair'], {
    act: 2, blurb: 'Waist-deep for a mile in every direction. Boglurks consider it excellent.' }),
  ossuary:       N('ossuary', 'The Salt Ossuary', 'march', 'wild', 88, 72, ['reedflats', 'tidewatch'], {
    act: 2, blurb: 'Where the marsh puts the bones it has finished with. Some of them are very large.' }),
  tidewatch:     N('tidewatch', 'Tidewatch', 'march', 'landmark', 74, 58, ['saltley', 'ossuary', 'drowned_stair', 'chorus_hall'], {
    act: 2, blurb: 'A Concord watchtower, unmanned since the Tide line thinned. The lamp still turns.' }),
  drowned_stair: N('drowned_stair', 'The Drowned Stair', 'march', 'roost', 88, 62, ['reedflats', 'tidewatch'], {
    act: 2, depth: 4, blurb: 'Steps going down into clear water. You can see the bottom. It is much further than it looks.' }),
  chorus_hall:   N('chorus_hall', 'The Sunken Chorus-Hall', 'march', 'spire', 70, 46, ['tidewatch', 'cinder_gate'], {
    act: 2, boss: 'morvaleth', depth: 4,
    blurb: 'They sang the Tide line here every evening for three hundred years. Then they stopped, and then they drowned.' }),

  // --- Act III: Cindermarch --------------------------------------------
  cinder_gate:   N('cinder_gate', 'The Slag Gate', 'cinder', 'landmark', 58, 38, ['chorus_hall', 'cindermarch', 'ashfields'], {
    act: 3, blurb: 'Where the road stops being a road and starts being Concord property.' }),
  cindermarch:   N('cindermarch', 'Cindermarch', 'cinder', 'town', 46, 32, ['cinder_gate', 'furnace_yard', 'ashfields', 'slagways'], {
    services: ['shop', 'board', 'rest', 'relics', 'forge'], act: 3, capital: true,
    blurb: 'Nine furnaces, one Spire, and forty thousand people who have never seen a dragon that was not chained.' }),
  furnace_yard:  N('furnace_yard', 'The Furnace Yards', 'cinder', 'wild', 34, 26, ['cindermarch', 'concord_hall'], {
    act: 3, blurb: 'Where the Concord keeps what it burns. The air shimmers even at night.' }),
  ashfields:     N('ashfields', 'The Ashfields', 'cinder', 'wild', 60, 26, ['cinder_gate', 'cindermarch', 'slagways'], {
    act: 3, blurb: 'A hundred years of Spire-fall, ankle deep. Ashbound dragons come here to sleep and forget faster.' }),
  slagways:      N('slagways', 'The Slagways', 'cinder', 'roost', 56, 18, ['cindermarch', 'ashfields'], {
    act: 3, depth: 5, blurb: 'Service tunnels under the furnaces. Warm, dark, and full of things the Concord did not intend to make.' }),
  concord_hall:  N('concord_hall', 'The Concord Hall', 'cinder', 'spire', 30, 16, ['furnace_yard', 'windward'], {
    act: 3, boss: 'kessa', blurb: 'Where they voted, once, and have been defending the vote ever since.' }),

  // --- Act IV: the Riven Peaks -----------------------------------------
  windward:      N('windward', 'Windward Camp', 'peaks', 'town', 22, 26, ['concord_hall', 'screes', 'skyward_shelf'], {
    services: ['shop', 'board', 'rest', 'relics'], act: 4,
    blurb: 'Four tents, a stove, and eleven people who climb for a living and think you are being silly.' }),
  screes:        N('screes', 'The Long Screes', 'peaks', 'wild', 14, 38, ['windward', 'thin_air', 'eyrie'], {
    act: 4, blurb: 'Loose rock at the angle of repose. One wrong step and the whole slope comes with you.' }),
  thin_air:      N('thin_air', 'Thin Air', 'peaks', 'wild', 8, 26, ['screes', 'skyward_shelf'], {
    act: 4, blurb: 'High enough that the fire is hard to keep lit and so is the conversation.' }),
  eyrie:         N('eyrie', 'The Broken Eyrie', 'peaks', 'roost', 10, 50, ['screes'], {
    act: 4, depth: 5, blurb: 'A Skyward nest, abandoned in a hurry. The eggs went cold a long time ago.' }),
  skyward_shelf: N('skyward_shelf', 'The Skyward Shelf', 'peaks', 'landmark', 12, 14, ['windward', 'thin_air', 'riven_throne'], {
    act: 4, blurb: 'A ledge the width of a road, sixty miles long, that no road ever needed.' }),
  riven_throne:  N('riven_throne', 'The Riven Throne', 'peaks', 'spire', 24, 8, ['skyward_shelf', 'spire_skirt'], {
    act: 4, boss: 'ythrax', depth: 5, blurb: 'A peak split to the root by something that wanted somewhere to sit.' }),

  // --- Act V: the Hollow Sun -------------------------------------------
  spire_skirt:   N('spire_skirt', "The Spire's Skirt", 'spire', 'landmark', 40, 8, ['riven_throne', 'spire_stair'], {
    act: 5, blurb: 'The base of the Spire, where all five lines come in and none go out.' }),
  spire_stair:   N('spire_stair', 'The Long Stair', 'spire', 'roost', 54, 6, ['spire_skirt', 'furnace_heart'], {
    act: 5, depth: 6, blurb: 'Down. Eleven hundred steps, and the light gets older the whole way.' }),
  furnace_heart: N('furnace_heart', 'The Furnace Heart', 'spire', 'wild', 68, 8, ['spire_stair', 'hollow_sun'], {
    act: 5, blurb: 'The chamber the Concord built around a sleeping animal.' }),
  hollow_sun:    N('hollow_sun', 'The Hollow Sun', 'spire', 'spire', 82, 12, ['furnace_heart'], {
    act: 5, boss: 'vaelorax', final: true, blurb: 'It has been awake for some time. It has been listening.' }),
};

export const NODE_IDS = Object.keys(NODES);
export const node = id => NODES[id] || NODES.broodwell;
export const region = id => REGIONS[id] || REGIONS.vale;

/** Links are declared once and mirrored here, so the graph cannot be one-way. */
export const ADJACENCY = (() => {
  const adj = {};
  for (const id of NODE_IDS) adj[id] = new Set(NODES[id].links);
  for (const id of NODE_IDS) for (const other of NODES[id].links) {
    if (adj[other]) adj[other].add(id);
  }
  const out = {};
  for (const id of NODE_IDS) out[id] = [...adj[id]];
  return out;
})();

export const neighbours = id => ADJACENCY[id] || [];

export function nodesInRegion(regionId) {
  return NODE_IDS.filter(id => NODES[id].region === regionId);
}

/** Level band for a node, widened slightly by how far the player has come. */
export function levelBand(nodeId) {
  const n = node(nodeId);
  const r = region(n.region);
  const bump = n.kind === 'roost' ? 2 : n.kind === 'spire' ? 3 : 0;
  return [r.band[0] + bump, r.band[1] + bump];
}

/** Forage tables: what the ground gives up at a node, by region. */
export const FORAGE = {
  vale:   ['hearth_bread', 'sunmelon', 'char_root', 'scale_shard', 'ashwash', 'ember_salve', 'sinew'],
  march:  ['salt_cod', 'saltcloth', 'ashsalt', 'ember_salve', 'scale_shard', 'frostroot', 'ley_tonic'],
  cinder: ['cinder_glass', 'ashsalt', 'ashwash', 'greater_salve', 'scale_shard', 'ash_pear', 'ley_crystal'],
  peaks:  ['skyberry', 'stormglass', 'windfeather', 'greater_salve', 'dragonbone', 'braveleaf', 'deep_ley'],
  spire:  ['bright_ore', 'ley_crystal', 'wardens_salve', 'panacea', 'dragonbone', 'cinder_glass'],
};

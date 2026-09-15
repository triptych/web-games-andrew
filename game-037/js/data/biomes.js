// ============================================================
// data/biomes.js - biome definitions (GDD §9.5). APPEND ONLY.
// Each biome carries ground weights, object weights, decor, monsters,
// forage, ambient palette and a name style.
// ============================================================
import { T } from './tiles.js';
import { O } from './objects.js';

const b = (key, name, o) => ({ key, name, ...o });

export const BIOMES = {
  sea: b('sea', 'open water', {
    ground: { [T.deep_water]: 1 }, objects: {}, objectDensity: 0, decor: {}, decorDensity: 0,
    monsters: {}, forage: [], ambient: [42, 0.30, 0.30], nameStyle: 'salt', land: false,
    flavour: ['Water all the way out, and a line where it stops being water.'],
  }),
  shore: b('shore', 'shore', {
    ground: { [T.sand]: 6, [T.shingle]: 4 }, objects: { [O.boat_wreck]: 2, [O.rock]: 6, [O.bush]: 3 },
    objectDensity: 0.04, decor: { wrack: 8, shell: 5 }, decorDensity: 0.10,
    monsters: { crab_thing: 6, fen_lurcher: 2, shore_folk: 3 }, forage: ['samphire', 'salt'],
    ambient: [45, 0.22, 0.56], nameStyle: 'salt',
    flavour: ['Wrack in a line, and the smell of it.', 'Somebody\'s boat, pulled up past the tide.'],
  }),
  peak: b('peak', 'peak', {
    ground: { [T.bare_stone]: 6, [T.snow]: 5 }, objects: { [O.rock]: 8, [O.cairn]: 2, [O.boulder]: 4 },
    objectDensity: 0.08, decor: { lichen: 6 }, decorDensity: 0.05,
    monsters: { stone_walker: 6, crag_goat: 5 }, forage: ['moon-cap'],
    ambient: [210, 0.08, 0.72], nameStyle: 'stone',
    flavour: ['Wind, and nothing to stop it.', 'Cairns. Someone walked up here on purpose.'],
  }),
  snowfield: b('snowfield', 'snowfield', {
    ground: { [T.snow]: 9, [T.ice]: 1 }, objects: { [O.pine]: 4, [O.rock]: 3, [O.dead_tree]: 2 },
    objectDensity: 0.07, decor: { tracks_old: 4 }, decorDensity: 0.06,
    monsters: { stone_walker: 3, pale_hound: 6 }, forage: [],
    ambient: [205, 0.06, 0.80], nameStyle: 'stone',
    flavour: ['Snow with one line of tracks across it. Not yours.'],
  }),
  crag: b('crag', 'crag', {
    ground: { [T.scree]: 6, [T.bare_stone]: 4 }, objects: { [O.rock]: 8, [O.boulder]: 4, [O.old_wall]: 2, [O.standing_stone]: 1 },
    objectDensity: 0.10, decor: { lichen: 6, rubble: 4 }, decorDensity: 0.08,
    monsters: { crag_goat: 6, stone_walker: 5, bandit: 3 }, forage: ['bell-cap'],
    ambient: [30, 0.10, 0.55], nameStyle: 'stone',
    flavour: ['Goats have been here. Goats get everywhere.'],
  }),
  cloudforest: b('cloudforest', 'cloud forest', {
    ground: { [T.moss_stone]: 6, [T.leaf_litter]: 4 }, objects: { [O.oak]: 6, [O.pine]: 3, [O.bush]: 4, [O.rock]: 2 },
    objectDensity: 0.22, decor: { moss: 9, mushroom: 4 }, decorDensity: 0.14,
    monsters: { root_thing: 6, fen_lurcher: 3, wisp: 3 }, forage: ['bell-cap', 'heart-root'],
    ambient: [140, 0.18, 0.40], nameStyle: 'soft',
    flavour: ['Everything drips. Nothing is raining.'],
  }),
  upland: b('upland', 'upland', {
    ground: { [T.tussock]: 7, [T.heather]: 3 }, objects: { [O.rock]: 4, [O.old_wall]: 3, [O.standing_stone]: 1, [O.bush]: 2 },
    objectDensity: 0.07, decor: { heather_flower: 6, sheep_bone: 2 }, decorDensity: 0.10,
    monsters: { crag_goat: 5, pale_hound: 4, bandit: 3 }, forage: ['nettle'],
    ambient: [70, 0.16, 0.48], nameStyle: 'stone',
    flavour: ['Sheep-walls going over the hill, not keeping anything in.'],
  }),
  fen: b('fen', 'fen', {
    ground: { [T.mud]: 5, [T.reed_bed]: 4, [T.shallow_water]: 3 }, objects: { [O.reeds_tall]: 8, [O.dead_tree]: 2, [O.fallen_log]: 2 },
    objectDensity: 0.18, decor: { lantern_fly: 4, reed: 8 }, decorDensity: 0.14,
    monsters: { fen_lurcher: 8, drowned_thing: 4, midge_swarm: 5 }, forage: ['nettle', 'river clay'],
    ambient: [110, 0.16, 0.38], nameStyle: 'fen',
    flavour: ['Lantern-flies, and the water making up its mind.'],
  }),
  deepwood: b('deepwood', 'deep wood', {
    ground: { [T.leaf_litter]: 8, [T.moss_stone]: 2 }, objects: { [O.oak]: 8, [O.birch]: 3, [O.bush]: 4, [O.fallen_log]: 2, [O.berry_bush]: 2 },
    objectDensity: 0.30, decor: { moss: 6, mushroom: 5, fern: 6 }, decorDensity: 0.16,
    monsters: { root_thing: 6, wolf: 5, wisp: 3, bandit: 2 }, forage: ['heart-root', 'bell-cap'],
    ambient: [120, 0.24, 0.26], nameStyle: 'soft',
    flavour: ['Old wood. It was here before the road.'],
  }),
  orchardland: b('orchardland', 'orchard country', {
    ground: { [T.grass]: 5, [T.tilled]: 3, [T.meadow_grass]: 2 }, objects: { [O.oak]: 3, [O.berry_bush]: 4, [O.old_wall]: 4, [O.bush]: 3 },
    objectDensity: 0.12, decor: { flower: 7, windfall: 4 }, decorDensity: 0.14,
    monsters: { hare: 6, bandit: 3, crow_swarm: 4 }, forage: ['berries', 'nettle'],
    ambient: [95, 0.30, 0.42], nameStyle: 'soft',
    flavour: ['Hedgerows, and apples nobody picked.'],
  }),
  wood: b('wood', 'wood', {
    ground: { [T.grass]: 5, [T.leaf_litter]: 5 }, objects: { [O.birch]: 6, [O.oak]: 4, [O.bush]: 4, [O.berry_bush]: 2, [O.stump]: 1 },
    objectDensity: 0.20, decor: { fern: 6, flower: 4 }, decorDensity: 0.12,
    monsters: { hare: 5, wolf: 4, root_thing: 3 }, forage: ['berries', 'bell-cap'],
    ambient: [105, 0.28, 0.36], nameStyle: 'soft',
    flavour: ['Birch and hazel. Somebody coppices this.'],
  }),
  dryland: b('dryland', 'dry country', {
    ground: { [T.sand]: 4, [T.scree]: 3, [T.bare_stone]: 3 }, objects: { [O.bush]: 5, [O.rock]: 5, [O.old_wall]: 3, [O.dead_tree]: 2 },
    objectDensity: 0.09, decor: { thorn: 6, dust_devil: 1 }, decorDensity: 0.07,
    monsters: { bandit: 5, stone_walker: 3, crow_swarm: 3 }, forage: ['salt'],
    ambient: [40, 0.22, 0.52], nameStyle: 'ash',
    flavour: ['Terraces, cut for water that stopped coming.'],
  }),
  heath: b('heath', 'heath', {
    ground: { [T.heather]: 7, [T.tussock]: 3 }, objects: { [O.bush]: 4, [O.rock]: 3, [O.cairn]: 1, [O.standing_stone]: 1 },
    objectDensity: 0.06, decor: { heather_flower: 8 }, decorDensity: 0.14,
    monsters: { hare: 5, pale_hound: 4, bandit: 2 }, forage: ['nettle', 'bell-cap'],
    ambient: [300, 0.16, 0.44], nameStyle: 'soft',
    flavour: ['Heath, all the way to the edge of seeing. It is beautiful and it is empty.'],
  }),
  meadow: b('meadow', 'meadow', {
    ground: { [T.grass]: 6, [T.meadow_grass]: 4 }, objects: { [O.bush]: 3, [O.oak]: 2, [O.rock]: 2, [O.berry_bush]: 1 },
    objectDensity: 0.07, decor: { flower: 9, grass_tuft: 6 }, decorDensity: 0.16,
    monsters: { hare: 6, crow_swarm: 3, bandit: 2 }, forage: ['nettle', 'berries'],
    ambient: [88, 0.32, 0.46], nameStyle: 'soft',
    flavour: ['Grass, bees, and the particular green of a field nobody is using.'],
  }),
};

for (const k of Object.keys(BIOMES)) Object.freeze(BIOMES[k]);
Object.freeze(BIOMES);

/** Decor keys are sprites only; this maps them to display names for `examine`. */
export const DECOR_NAMES = Object.freeze({
  wrack: 'wrack', shell: 'shells', lichen: 'lichen', tracks_old: 'old tracks',
  rubble: 'rubble', moss: 'moss', mushroom: 'mushrooms', heather_flower: 'heather in flower',
  sheep_bone: 'a sheep\'s bone', lantern_fly: 'lantern-flies', reed: 'reeds', fern: 'ferns',
  flower: 'flowers', windfall: 'windfalls', thorn: 'thorn', dust_devil: 'blown dust',
  grass_tuft: 'a tuft of grass', tracks: 'tracks', blood: 'blood',
});

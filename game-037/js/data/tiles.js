// ============================================================
// data/tiles.js - the tile table (GDD §8.4, §33.4). APPEND ONLY.
// `cost` is an additive energy surcharge, never a multiplier.
// ============================================================

const def = (id, key, name, o = {}) => ({
  id, key, name,
  solid: !!o.solid, opaque: !!o.opaque, liquid: !!o.liquid,
  cost: o.cost ?? 0, swim: !!o.swim, deep: !!o.deep, burn: o.burn ?? 0,
  sprite: o.sprite ?? key, tracks: !!o.tracks, slides: !!o.slides,
  road: !!o.road, indoor: !!o.indoor, fragile: !!o.fragile,
  desc: o.desc ?? '',
});

export const TILES = [
  def(0, 'void', 'nothing', { solid: true, opaque: true, desc: 'The world ends here.' }),
  def(1, 'grass', 'grass', { desc: 'Short grass, cropped by something.' }),
  def(2, 'meadow_grass', 'meadow', { desc: 'Long grass with flowers gone over.' }),
  def(3, 'tussock', 'tussock', { cost: 20, desc: 'Tough upland grass in clumps.' }),
  def(4, 'heather', 'heather', { cost: 20, burn: 2, desc: 'Heather, purple and going brown.' }),
  def(5, 'leaf_litter', 'leaf litter', { cost: 10, burn: 1, desc: 'Years of leaves, deep and quiet.' }),
  def(6, 'moss_stone', 'mossy stone', { cost: 10, desc: 'Stone with moss on the north side.' }),
  def(7, 'mud', 'mud', { cost: 40, tracks: true, desc: 'Mud that holds a print.' }),
  def(8, 'reed_bed', 'reeds', { cost: 50, burn: 3, desc: 'Reeds, taller than you.' }),
  def(9, 'tilled', 'tilled earth', { cost: 10, desc: 'Turned earth in straight rows.' }),
  def(10, 'sand', 'sand', { cost: 20, tracks: true, desc: 'Sand, damp under the crust.' }),
  def(11, 'shingle', 'shingle', { cost: 30, desc: 'Shingle that shifts underfoot.' }),
  def(12, 'shallow_water', 'shallow water', { liquid: true, cost: 60, swim: true, desc: 'Water to the knee, moving.' }),
  def(13, 'deep_water', 'deep water', { liquid: true, deep: true, cost: 200, swim: true, desc: 'Deep water. You would need a boat.' }),
  def(14, 'scree', 'scree', { cost: 40, desc: 'Loose stone on a slope.' }),
  def(15, 'bare_stone', 'bare stone', { desc: 'Bare rock, wind-scoured.' }),
  def(16, 'snow', 'snow', { cost: 60, tracks: true, desc: 'Snow, unbroken except by you.' }),
  def(17, 'ice', 'ice', { slides: true, desc: 'Ice with something dark under it.' }),
  def(18, 'road_dirt', 'track', { cost: -20, road: true, desc: 'A cart track. Someone comes this way.' }),
  def(19, 'road_stone', 'paved road', { cost: -20, road: true, desc: 'Laid stone, worn in two lines.' }),
  def(20, 'floor_wood', 'floorboards', { indoor: true, burn: 2, desc: 'Swept boards.' }),
  def(21, 'floor_flag', 'flagstones', { indoor: true, desc: 'Flagstones, cold through your boots.' }),
  def(22, 'hearth_stone', 'hearth', { indoor: true, desc: 'A fire-ring. You could rest here.' }),
  def(23, 'salt_crust', 'salt crust', { cost: 20, fragile: true, desc: 'Salt crust. It gives a little.' }),
  def(24, 'dust', 'dust', { desc: 'Dust, and a smell of cold stone.' }),
  def(25, 'grave_earth', 'grave earth', { cost: 20, desc: 'Earth turned and turned again.' }),
  def(26, 'cliff_face', 'cliff', { solid: true, opaque: true, desc: 'A cliff. Not without a rope.' }),
  def(27, 'wall_stone', 'stone wall', { solid: true, opaque: true, desc: 'Dry stone, well laid.' }),
  def(28, 'wall_timber', 'timber wall', { solid: true, opaque: true, burn: 2, desc: 'Timber and wattle.' }),
  def(29, 'wall_cracked', 'cracked wall', { solid: true, opaque: true, desc: 'A wall with a crack you could widen.' }),
  def(30, 'hedge', 'hedge', { opaque: true, cost: 60, burn: 2, desc: 'Hedge, laid the old way.' }),
  def(31, 'floor_cave', 'cave floor', { desc: 'Damp rock underfoot.' }),
  def(32, 'wall_cave', 'cave wall', { solid: true, opaque: true, desc: 'Rock, and the marks of water.' }),
  def(33, 'floor_salt', 'salt pan', { cost: 20, fragile: true, desc: 'A salt pan, dry and cracked.' }),
  def(34, 'water_hollow', 'standing water', { liquid: true, cost: 60, swim: true, desc: 'Water that has been here a long time.' }),
  def(35, 'root_floor', 'root floor', { cost: 10, burn: 2, desc: 'Roots woven into a floor.' }),
  def(36, 'root_wall', 'root wall', { solid: true, opaque: true, burn: 3, desc: 'A wall of roots, still growing.' }),
  def(37, 'rubble', 'rubble', { cost: 40, desc: 'Fallen stone. High ground, of a sort.' }),
  def(38, 'pit', 'pit', { cost: 100, desc: 'A hole. It goes down.' }),
  def(39, 'tilled_crop', 'crop rows', { cost: 10, desc: 'Rows with something growing in them.' }),
  def(40, 'thatch_floor', 'rush floor', { indoor: true, burn: 3, desc: 'Rushes on the floor, changed recently.' }),
];

export const T = {};
for (const t of TILES) T[t.key] = t.id;
Object.freeze(T);
for (const t of TILES) Object.freeze(t);
Object.freeze(TILES);

export const tileDef = id => TILES[id] || TILES[0];

/** Flags bitfield (GDD §8.3). */
export const F = Object.freeze({
  EXPLORED: 1, VISIBLE: 2, LIT: 4, QUIET: 8, EDITED: 16, SECRET: 32, NO_SPAWN: 64, ROAD: 128,
});

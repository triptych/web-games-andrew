// ============================================================
// data/sprites.js - procedural sprite recipes (GDD §26.2)
// Ops are data, not functions, so recipes are testable and serializable.
// Op set: rect blob ellipse line poly noise dither shade outline mask mirror overlay jitterAll
// ============================================================

const G = 16; // the art grid

// ---- ground tiles -------------------------------------------------------
// A compact descriptor expands into a full op list at load. Still data.
const ground = (palette, style = 'speckle', extra = []) => {
  const ops = [{ op: 'rect', at: [0, 0], w: G, h: G, color: 'main' }];
  if (style === 'speckle') {
    ops.push({ op: 'noise', region: 'main', color: 'alt', density: 0.20 });
    ops.push({ op: 'noise', region: 'main', color: 'dark', density: 0.08 });
  } else if (style === 'blades') {
    ops.push({ op: 'noise', region: 'main', color: 'light', density: 0.16 });
    ops.push({ op: 'strokes', color: 'alt', count: 7, len: 3, dir: 'up' });
  } else if (style === 'rows') {
    ops.push({ op: 'stripes', color: 'dark', every: 4, thickness: 1, dir: 'h' });
    ops.push({ op: 'noise', region: 'main', color: 'alt', density: 0.10 });
  } else if (style === 'ripple') {
    ops.push({ op: 'stripes', color: 'light', every: 5, thickness: 1, dir: 'h', wave: 2 });
    ops.push({ op: 'noise', region: 'main', color: 'dark', density: 0.06 });
  } else if (style === 'cobble') {
    ops.push({ op: 'cells', color: 'alt', color2: 'dark', size: 5 });
  } else if (style === 'plank') {
    ops.push({ op: 'stripes', color: 'dark', every: 5, thickness: 1, dir: 'h' });
    ops.push({ op: 'noise', region: 'main', color: 'light', density: 0.06 });
  } else if (style === 'flat') {
    ops.push({ op: 'noise', region: 'main', color: 'light', density: 0.05 });
  } else if (style === 'crack') {
    ops.push({ op: 'cells', color: 'light', color2: 'main', size: 7 });
    ops.push({ op: 'noise', region: 'main', color: 'dark', density: 0.05 });
  }
  return { size: [G, G], palette, tileable: true, ops: ops.concat(extra) };
};

export const GROUND_RECIPES = {
  void: ground('dark', 'flat'),
  grass: ground('grass', 'blades'),
  meadow_grass: ground('meadow', 'blades'),
  tussock: ground('tussock', 'blades'),
  heather: ground('heather', 'speckle'),
  leaf_litter: ground('leaf', 'speckle'),
  moss_stone: ground('moss', 'cobble'),
  mud: ground('mud', 'speckle'),
  reed_bed: ground('reed', 'blades'),
  tilled: ground('tilled', 'rows'),
  tilled_crop: ground('tilled', 'rows', [{ op: 'strokes', color: 'main', count: 6, len: 4, dir: 'up', palette: 'grass' }]),
  sand: ground('sand', 'speckle'),
  shingle: ground('shingle', 'speckle'),
  shallow_water: ground('water_shallow', 'ripple'),
  deep_water: ground('water_deep', 'ripple'),
  water_hollow: ground('water_deep', 'ripple'),
  scree: ground('scree', 'speckle'),
  bare_stone: ground('stone', 'cobble'),
  snow: ground('snow', 'flat'),
  ice: ground('ice', 'crack'),
  road_dirt: ground('road', 'speckle'),
  road_stone: ground('road', 'cobble'),
  floor_wood: ground('wood_floor', 'plank'),
  floor_flag: ground('flag', 'cobble'),
  hearth_stone: ground('hearth', 'cobble', [{ op: 'blob', at: [8, 8], r: 3.2, jitter: 0.4, color: 'ember' }]),
  salt_crust: ground('salt', 'crack'),
  floor_salt: ground('salt', 'crack'),
  dust: ground('dust', 'speckle'),
  grave_earth: ground('grave', 'speckle'),
  cliff_face: ground('stone', 'cobble', [{ op: 'shade', from: 'main', dir: 'down', amount: 0.30 }]),
  wall_stone: ground('wall_stone', 'cobble'),
  wall_timber: ground('wall_timber', 'plank'),
  wall_cracked: ground('wall_stone', 'cobble', [{ op: 'line', from: [4, 0], to: [10, 15], color: 'outline', thickness: 1 }]),
  hedge: ground('bush', 'speckle'),
  floor_cave: ground('cave', 'speckle'),
  wall_cave: ground('cave', 'cobble'),
  root_floor: ground('root', 'speckle'),
  root_wall: ground('root', 'speckle', [{ op: 'strokes', color: 'dark', count: 6, len: 8, dir: 'up' }]),
  rubble: ground('rubble', 'speckle'),
  pit: ground('dark', 'flat', [{ op: 'ellipse', at: [8, 8], rx: 6, ry: 5, color: 'outline' }]),
  thatch_floor: ground('thatch', 'blades'),
};

// ---- objects ------------------------------------------------------------
const tree = (palette, canopyR, trunkH) => ({
  size: [G, 24], anchor: [8, 23], palette, symmetry: 'x',
  ops: [
    { op: 'rect', at: [7, 24 - trunkH], w: 2, h: trunkH, color: 'trunk' },
    { op: 'blob', at: [8, 24 - trunkH - canopyR + 1], r: canopyR, jitter: 0.35, color: 'canopy' },
    { op: 'blob', at: [5, 24 - trunkH - canopyR + 3], r: canopyR * 0.62, jitter: 0.4, color: 'canopyDark' },
    { op: 'noise', region: 'canopy', color: 'canopyLight', density: 0.18 },
    { op: 'shade', from: 'canopy', dir: 'auto', amount: 0.22 },
    { op: 'outline', color: 'outline' },
  ],
});

const conifer = (palette) => ({
  size: [G, 24], anchor: [8, 23], palette, symmetry: 'x',
  ops: [
    { op: 'rect', at: [7, 18], w: 2, h: 6, color: 'trunk' },
    { op: 'poly', points: [[8, 1], [14, 10], [2, 10]], color: 'canopy' },
    { op: 'poly', points: [[8, 6], [15, 18], [1, 18]], color: 'canopy' },
    { op: 'noise', region: 'canopy', color: 'canopyDark', density: 0.20 },
    { op: 'shade', from: 'canopy', dir: 'auto', amount: 0.20 },
    { op: 'outline', color: 'outline' },
  ],
});

const rock = (palette, r) => ({
  size: [G, G], anchor: [8, 15], palette,
  ops: [
    { op: 'blob', at: [8, 10], r, jitter: 0.3, color: 'main' },
    { op: 'noise', region: 'main', color: 'light', density: 0.15 },
    { op: 'shade', from: 'main', dir: 'auto', amount: 0.25 },
    { op: 'outline', color: 'outline' },
  ],
});

const box = (palette, w, h, y, extra = []) => ({
  size: [G, G], anchor: [8, 15], palette,
  ops: [
    { op: 'rect', at: [(G - w) >> 1, y], w, h, color: 'main' },
    { op: 'noise', region: 'main', color: 'light', density: 0.12 },
    { op: 'shade', from: 'main', dir: 'auto', amount: 0.24 },
    ...extra,
    { op: 'outline', color: 'outline' },
  ],
});

export const SPRITE_RECIPES = {
  oak: tree('tree_broadleaf', 6.5, 8),
  birch: tree('tree_birch', 5.2, 10),
  pine: conifer('tree_pine'),
  dead_tree: {
    size: [G, 24], anchor: [8, 23], palette: 'tree_dead',
    ops: [
      { op: 'rect', at: [7, 8], w: 2, h: 16, color: 'trunk' },
      { op: 'line', from: [8, 12], to: [13, 6], color: 'trunk', thickness: 1 },
      { op: 'line', from: [8, 15], to: [3, 9], color: 'trunk', thickness: 1 },
      { op: 'outline', color: 'outline' },
    ],
  },
  bush: { size: [G, G], anchor: [8, 15], palette: 'bush', ops: [
    { op: 'blob', at: [8, 10], r: 5, jitter: 0.4, color: 'main' },
    { op: 'noise', region: 'main', color: 'light', density: 0.22 },
    { op: 'outline', color: 'outline' }] },
  berry_bush: { size: [G, G], anchor: [8, 15], palette: 'berry', ops: [
    { op: 'blob', at: [8, 10], r: 5, jitter: 0.4, color: 'main' },
    { op: 'noise', region: 'main', color: 'light', density: 0.18 },
    { op: 'noise', region: 'main', color: 'berry', density: 0.14 },
    { op: 'outline', color: 'outline' }] },
  rock: rock('stone', 4),
  boulder: rock('stone', 6.4),
  reeds_tall: { size: [G, 20], anchor: [8, 19], palette: 'reed', ops: [
    { op: 'strokes', color: 'main', count: 9, len: 14, dir: 'up' },
    { op: 'strokes', color: 'dark', count: 4, len: 10, dir: 'up' }] },
  fallen_log: { size: [G, G], anchor: [8, 15], palette: 'tree_broadleaf', ops: [
    { op: 'rect', at: [1, 9], w: 14, h: 4, color: 'trunk' },
    { op: 'noise', region: 'trunk', color: 'canopyDark', density: 0.18 },
    { op: 'outline', color: 'outline' }] },
  stump: box('tree_broadleaf', 8, 5, 10),
  cairn: { size: [G, G], anchor: [8, 15], palette: 'stone', ops: [
    { op: 'blob', at: [8, 13], r: 4, jitter: 0.25, color: 'main' },
    { op: 'blob', at: [8, 8], r: 3, jitter: 0.25, color: 'light' },
    { op: 'blob', at: [8, 4], r: 2, jitter: 0.25, color: 'main' },
    { op: 'outline', color: 'outline' }] },
  standing_stone: { size: [G, 22], anchor: [8, 21], palette: 'stone', ops: [
    { op: 'poly', points: [[5, 21], [4, 4], [8, 1], [12, 5], [11, 21]], color: 'main' },
    { op: 'noise', region: 'main', color: 'dark', density: 0.16 },
    { op: 'shade', from: 'main', dir: 'auto', amount: 0.25 },
    { op: 'outline', color: 'outline' }] },
  shrine: { size: [G, 20], anchor: [8, 19], palette: 'stone', ops: [
    { op: 'rect', at: [4, 10], w: 8, h: 9, color: 'main' },
    { op: 'poly', points: [[3, 10], [8, 4], [13, 10]], color: 'light' },
    { op: 'rect', at: [7, 13], w: 2, h: 3, color: 'outline' },
    { op: 'outline', color: 'outline' }] },
  grave: { size: [G, G], anchor: [8, 15], palette: 'stone', ops: [
    { op: 'rect', at: [5, 6], w: 6, h: 9, color: 'main' },
    { op: 'ellipse', at: [8, 6], rx: 3, ry: 2, color: 'main' },
    { op: 'line', from: [6, 10], to: [10, 10], color: 'dark', thickness: 1 },
    { op: 'outline', color: 'outline' }] },
  old_wall: box('wall_stone', 16, 7, 8),
  wall_stone: { size: [G, G], palette: 'wall_stone', tileable: true, ops: [
    { op: 'rect', at: [0, 0], w: G, h: G, color: 'main' },
    { op: 'cells', color: 'light', color2: 'dark', size: 5 },
    { op: 'shade', from: 'main', dir: 'down', amount: 0.22 }] },
  wall_timber: { size: [G, G], palette: 'wall_timber', tileable: true, ops: [
    { op: 'rect', at: [0, 0], w: G, h: G, color: 'main' },
    { op: 'stripes', color: 'dark', every: 6, thickness: 1, dir: 'v' },
    { op: 'stripes', color: 'light', every: 8, thickness: 1, dir: 'h' }] },
  wall_cob: { size: [G, G], palette: 'wall_cob', tileable: true, ops: [
    { op: 'rect', at: [0, 0], w: G, h: G, color: 'main' },
    { op: 'noise', region: 'main', color: 'light', density: 0.10 },
    { op: 'shade', from: 'main', dir: 'down', amount: 0.18 }] },
  beehive: { size: [G, G], anchor: [8, 15], palette: 'thatch', ops: [
    { op: 'ellipse', at: [8, 11], rx: 5, ry: 5, color: 'main' },
    { op: 'stripes', color: 'dark', every: 3, thickness: 1, dir: 'h' },
    { op: 'outline', color: 'outline' }] },
  boat_wreck: { size: [G, G], anchor: [8, 15], palette: 'wall_timber', ops: [
    { op: 'poly', points: [[1, 9], [15, 9], [12, 14], [4, 14]], color: 'main' },
    { op: 'noise', region: 'main', color: 'dark', density: 0.2 },
    { op: 'outline', color: 'outline' }] },
  abandoned_camp: { size: [G, G], anchor: [8, 15], palette: 'stone', ops: [
    { op: 'ellipse', at: [8, 11], rx: 5, ry: 3, color: 'main' },
    { op: 'ellipse', at: [8, 11], rx: 3, ry: 2, color: 'dark' },
    { op: 'outline', color: 'outline' }] },
  door: { size: [G, G], anchor: [8, 15], palette: 'door', ops: [
    { op: 'rect', at: [3, 2], w: 10, h: 14, color: 'main' },
    { op: 'stripes', color: 'dark', every: 4, thickness: 1, dir: 'v' },
    { op: 'rect', at: [10, 8], w: 2, h: 2, color: 'iron' },
    { op: 'outline', color: 'outline' }] },
  door_open: { size: [G, G], anchor: [8, 15], palette: 'door', ops: [
    { op: 'rect', at: [3, 2], w: 3, h: 14, color: 'main' },
    { op: 'outline', color: 'outline' }] },
  door_locked: { size: [G, G], anchor: [8, 15], palette: 'door', ops: [
    { op: 'rect', at: [3, 2], w: 10, h: 14, color: 'main' },
    { op: 'stripes', color: 'dark', every: 4, thickness: 1, dir: 'v' },
    { op: 'rect', at: [7, 7], w: 3, h: 4, color: 'iron' },
    { op: 'outline', color: 'outline' }] },
  door_warded: { size: [G, G], anchor: [8, 15], palette: 'door', ops: [
    { op: 'rect', at: [3, 2], w: 10, h: 14, color: 'main' },
    { op: 'ellipse', at: [8, 8], rx: 3, ry: 3, color: 'iron' },
    { op: 'line', from: [8, 4], to: [8, 12], color: 'iron', thickness: 1 },
    { op: 'outline', color: 'outline' }] },
  door_sealed: { size: [G, G], anchor: [8, 15], palette: 'door', ops: [
    { op: 'rect', at: [3, 2], w: 10, h: 14, color: 'main' },
    { op: 'line', from: [3, 4], to: [13, 12], color: 'dark', thickness: 2 },
    { op: 'line', from: [3, 12], to: [13, 4], color: 'dark', thickness: 2 },
    { op: 'outline', color: 'outline' }] },
  window: { size: [G, G], palette: 'wall_timber', ops: [
    { op: 'rect', at: [0, 0], w: G, h: G, color: 'main' },
    { op: 'rect', at: [4, 4], w: 8, h: 8, color: 'dark' },
    { op: 'rect', at: [5, 5], w: 6, h: 6, color: 'light' }] },
  chest: box('door', 12, 8, 7, [{ op: 'rect', at: [2, 9], w: 12, h: 1, color: 'iron' }]),
  barrel: box('door', 9, 10, 5, [{ op: 'rect', at: [3, 8], w: 9, h: 1, color: 'iron' }]),
  crate: box('wall_timber', 11, 10, 5),
  sack: { size: [G, G], anchor: [8, 15], palette: 'thatch', ops: [
    { op: 'ellipse', at: [8, 11], rx: 4, ry: 4, color: 'main' },
    { op: 'rect', at: [6, 5], w: 4, h: 3, color: 'dark' },
    { op: 'outline', color: 'outline' }] },
  bed: { size: [G, G], anchor: [8, 15], palette: 'cloth', ops: [
    { op: 'rect', at: [2, 6], w: 12, h: 9, color: 'main' },
    { op: 'rect', at: [3, 4], w: 10, h: 3, color: 'light' },
    { op: 'outline', color: 'outline' }] },
  table: box('door', 14, 5, 6, [{ op: 'rect', at: [3, 11], w: 2, h: 4, color: 'dark' }, { op: 'rect', at: [11, 11], w: 2, h: 4, color: 'dark' }]),
  stool: box('door', 6, 3, 9, [{ op: 'rect', at: [6, 12], w: 1, h: 3, color: 'dark' }, { op: 'rect', at: [9, 12], w: 1, h: 3, color: 'dark' }]),
  hearth: { size: [G, G], anchor: [8, 15], palette: 'hearth', ops: [
    { op: 'ellipse', at: [8, 12], rx: 6, ry: 3, color: 'dark' },
    { op: 'blob', at: [8, 9], r: 3.4, jitter: 0.5, color: 'ember' },
    { op: 'blob', at: [8, 7], r: 2, jitter: 0.6, color: 'light' }] },
  anvil: { size: [G, G], anchor: [8, 15], palette: 'metal', ops: [
    { op: 'rect', at: [3, 6], w: 10, h: 3, color: 'main' },
    { op: 'rect', at: [6, 9], w: 4, h: 3, color: 'dark' },
    { op: 'rect', at: [4, 12], w: 8, h: 3, color: 'main' },
    { op: 'outline', color: 'outline' }] },
  mortar: box('stone', 8, 7, 8),
  loom: { size: [G, 20], anchor: [8, 19], palette: 'door', ops: [
    { op: 'rect', at: [2, 2], w: 2, h: 17, color: 'main' },
    { op: 'rect', at: [12, 2], w: 2, h: 17, color: 'main' },
    { op: 'stripes', color: 'light', every: 3, thickness: 1, dir: 'h' },
    { op: 'outline', color: 'outline' }] },
  notice_board: { size: [G, 20], anchor: [8, 19], palette: 'door', ops: [
    { op: 'rect', at: [2, 3], w: 12, h: 9, color: 'main' },
    { op: 'noise', region: 'main', color: 'light', density: 0.3 },
    { op: 'rect', at: [7, 12], w: 2, h: 7, color: 'dark' },
    { op: 'outline', color: 'outline' }] },
  well: { size: [G, 20], anchor: [8, 19], palette: 'stone', ops: [
    { op: 'ellipse', at: [8, 14], rx: 6, ry: 4, color: 'main' },
    { op: 'ellipse', at: [8, 14], rx: 4, ry: 2.5, color: 'outline' },
    { op: 'rect', at: [3, 3], w: 1, h: 9, color: 'dark' },
    { op: 'rect', at: [12, 3], w: 1, h: 9, color: 'dark' },
    { op: 'rect', at: [3, 2], w: 10, h: 2, color: 'light' }] },
  bell_frame: { size: [G, 22], anchor: [8, 21], palette: 'metal', ops: [
    { op: 'rect', at: [2, 4], w: 1, h: 17, color: 'dark' },
    { op: 'rect', at: [13, 4], w: 1, h: 17, color: 'dark' },
    { op: 'rect', at: [2, 3], w: 12, h: 2, color: 'dark' },
    { op: 'poly', points: [[8, 6], [12, 13], [4, 13]], color: 'main' },
    { op: 'outline', color: 'outline' }] },
  wash_line: { size: [G, G], palette: 'cloth', ops: [
    { op: 'line', from: [0, 4], to: [15, 5], color: 'dark', thickness: 1 },
    { op: 'rect', at: [3, 5], w: 3, h: 5, color: 'main' },
    { op: 'rect', at: [9, 5], w: 4, h: 6, color: 'light' }] },
  wood_stack: box('door', 13, 7, 8, [{ op: 'stripes', color: 'dark', every: 3, thickness: 1, dir: 'h' }]),
  sign: { size: [G, G], anchor: [8, 15], palette: 'door', ops: [
    { op: 'rect', at: [7, 8], w: 2, h: 7, color: 'dark' },
    { op: 'rect', at: [3, 3], w: 10, h: 6, color: 'main' },
    { op: 'outline', color: 'outline' }] },
  hollow_mouth: { size: [G, 22], anchor: [8, 21], palette: 'stone', ops: [
    { op: 'poly', points: [[1, 21], [2, 8], [8, 2], [14, 8], [15, 21]], color: 'main' },
    { op: 'ellipse', at: [8, 15], rx: 5, ry: 7, color: 'outline' },
    { op: 'noise', region: 'main', color: 'dark', density: 0.18 },
    { op: 'outline', color: 'outline' }] },
  stair_down: { size: [G, G], palette: 'stone', ops: [
    { op: 'rect', at: [0, 0], w: G, h: G, color: 'outline' },
    { op: 'rect', at: [2, 2], w: 12, h: 3, color: 'main' },
    { op: 'rect', at: [4, 6], w: 10, h: 3, color: 'dark' },
    { op: 'rect', at: [6, 10], w: 8, h: 3, color: 'outline' }] },
  stair_up: { size: [G, G], palette: 'stone', ops: [
    { op: 'rect', at: [0, 0], w: G, h: G, color: 'dark' },
    { op: 'rect', at: [2, 11], w: 12, h: 3, color: 'light' },
    { op: 'rect', at: [4, 7], w: 10, h: 3, color: 'main' },
    { op: 'rect', at: [6, 3], w: 8, h: 3, color: 'light' }] },
  sconce: { size: [G, G], anchor: [8, 15], palette: 'metal', ops: [
    { op: 'rect', at: [7, 6], w: 2, h: 8, color: 'main' },
    { op: 'ellipse', at: [8, 5], rx: 3, ry: 2, color: 'dark' },
    { op: 'outline', color: 'outline' }] },
  sconce_lit: { size: [G, G], anchor: [8, 15], palette: 'lantern_lit', ops: [
    { op: 'rect', at: [7, 6], w: 2, h: 8, color: 'dark' },
    { op: 'blob', at: [8, 4], r: 3, jitter: 0.5, color: 'flame' },
    { op: 'blob', at: [8, 3], r: 1.6, jitter: 0.4, color: 'light' }] },
  standing_lantern: { size: [G, 22], anchor: [8, 21], palette: 'metal', ops: [
    { op: 'rect', at: [7, 8], w: 2, h: 13, color: 'main' },
    { op: 'rect', at: [4, 2], w: 8, h: 7, color: 'dark' },
    { op: 'outline', color: 'outline' }] },
  standing_lantern_lit: { size: [G, 22], anchor: [8, 21], palette: 'lantern_lit', ops: [
    { op: 'rect', at: [7, 8], w: 2, h: 13, color: 'dark' },
    { op: 'rect', at: [4, 2], w: 8, h: 7, color: 'main' },
    { op: 'blob', at: [8, 5], r: 2.4, jitter: 0.4, color: 'flame' }] },
  pillar: { size: [G, 22], anchor: [8, 21], palette: 'stone', ops: [
    { op: 'rect', at: [4, 1], w: 8, h: 20, color: 'main' },
    { op: 'rect', at: [3, 1], w: 10, h: 2, color: 'light' },
    { op: 'rect', at: [3, 19], w: 10, h: 2, color: 'light' },
    { op: 'shade', from: 'main', dir: 'auto', amount: 0.3 },
    { op: 'outline', color: 'outline' }] },
  rubble_pile: { size: [G, G], anchor: [8, 15], palette: 'rubble', ops: [
    { op: 'blob', at: [6, 12], r: 3, jitter: 0.4, color: 'main' },
    { op: 'blob', at: [10, 11], r: 2.6, jitter: 0.4, color: 'light' },
    { op: 'blob', at: [8, 9], r: 2, jitter: 0.4, color: 'dark' },
    { op: 'outline', color: 'outline' }] },
  cracked_wall: { size: [G, G], palette: 'wall_stone', ops: [
    { op: 'rect', at: [0, 0], w: G, h: G, color: 'main' },
    { op: 'cells', color: 'light', color2: 'dark', size: 5 },
    { op: 'line', from: [3, 0], to: [9, 15], color: 'outline', thickness: 2 },
    { op: 'line', from: [9, 7], to: [14, 3], color: 'outline', thickness: 1 }] },
  buried_cache: { size: [G, G], palette: 'mud', ops: [
    { op: 'ellipse', at: [8, 9], rx: 5, ry: 4, color: 'dark' },
    { op: 'noise', region: 'dark', color: 'light', density: 0.3 }] },
  quiet_veil: { size: [G, G], palette: 'quiet', ops: [
    { op: 'rect', at: [0, 0], w: G, h: G, color: 'main', alpha: 0.5 },
    { op: 'noise', region: 'main', color: 'light', density: 0.25 },
    { op: 'stripes', color: 'dark', every: 3, thickness: 1, dir: 'v' }] },
  ledge_anchor: { size: [G, G], anchor: [8, 15], palette: 'stone', ops: [
    { op: 'blob', at: [8, 11], r: 4, jitter: 0.3, color: 'main' },
    { op: 'ellipse', at: [8, 10], rx: 2, ry: 1, color: 'outline' },
    { op: 'outline', color: 'outline' }] },
  bridge: { size: [G, G], palette: 'wall_timber', tileable: true, ops: [
    { op: 'rect', at: [0, 2], w: G, h: 12, color: 'main' },
    { op: 'stripes', color: 'dark', every: 4, thickness: 1, dir: 'v' }] },
  pack: { size: [G, G], anchor: [8, 15], palette: 'thatch', ops: [
    { op: 'ellipse', at: [8, 11], rx: 5, ry: 4, color: 'main' },
    { op: 'rect', at: [5, 5], w: 6, h: 4, color: 'dark' },
    { op: 'outline', color: 'outline' }] },
  boat: { size: [G, G], anchor: [8, 15], palette: 'wall_timber', ops: [
    { op: 'poly', points: [[1, 7], [15, 7], [12, 13], [4, 13]], color: 'main' },
    { op: 'rect', at: [3, 8], w: 10, h: 1, color: 'dark' },
    { op: 'outline', color: 'outline' }] },
  drying_rack: { size: [G, 20], anchor: [8, 19], palette: 'door', ops: [
    { op: 'rect', at: [2, 3], w: 12, h: 1, color: 'main' },
    { op: 'strokes', color: 'dark', count: 5, len: 8, dir: 'down', from: 4 },
    { op: 'rect', at: [2, 3], w: 1, h: 16, color: 'main' },
    { op: 'rect', at: [13, 3], w: 1, h: 16, color: 'main' }] },
  forge: { size: [G, G], anchor: [8, 15], palette: 'hearth', ops: [
    { op: 'rect', at: [2, 6], w: 12, h: 9, color: 'dark' },
    { op: 'blob', at: [8, 10], r: 3, jitter: 0.5, color: 'ember' },
    { op: 'outline', color: 'outline' }] },
  market_stall: { size: [G, 20], anchor: [8, 19], palette: 'cloth', ops: [
    { op: 'rect', at: [1, 3], w: 14, h: 4, color: 'main' },
    { op: 'stripes', color: 'light', every: 4, thickness: 2, dir: 'v' },
    { op: 'rect', at: [2, 7], w: 1, h: 12, color: 'dark' },
    { op: 'rect', at: [13, 7], w: 1, h: 12, color: 'dark' }] },
  kitchen_garden: { size: [G, G], palette: 'grass', ops: [
    { op: 'rect', at: [0, 0], w: G, h: G, color: 'dark' },
    { op: 'strokes', color: 'main', count: 8, len: 5, dir: 'up' },
    { op: 'noise', region: 'main', color: 'light', density: 0.2 }] },
  scarecrow: { size: [G, 20], anchor: [8, 19], palette: 'thatch', ops: [
    { op: 'rect', at: [7, 6], w: 2, h: 13, color: 'dark' },
    { op: 'rect', at: [2, 8], w: 12, h: 1, color: 'dark' },
    { op: 'ellipse', at: [8, 4], rx: 3, ry: 3, color: 'main' },
    { op: 'outline', color: 'outline' }] },
  goat_pen: { size: [G, G], palette: 'door', ops: [
    { op: 'stripes', color: 'main', every: 5, thickness: 2, dir: 'v' },
    { op: 'rect', at: [0, 7], w: G, h: 1, color: 'dark' }] },
  mill_wheel: { size: [G, 22], anchor: [8, 21], palette: 'wall_timber', ops: [
    { op: 'ellipse', at: [8, 11], rx: 7, ry: 9, color: 'main' },
    { op: 'ellipse', at: [8, 11], rx: 4, ry: 5, color: 'dark' },
    { op: 'line', from: [8, 2], to: [8, 20], color: 'dark', thickness: 1 },
    { op: 'line', from: [1, 11], to: [15, 11], color: 'dark', thickness: 1 },
    { op: 'outline', color: 'outline' }] },
  offering_bowl: { size: [G, G], anchor: [8, 15], palette: 'stone', ops: [
    { op: 'ellipse', at: [8, 11], rx: 5, ry: 3, color: 'main' },
    { op: 'ellipse', at: [8, 10], rx: 3, ry: 1.6, color: 'gold' },
    { op: 'outline', color: 'outline' }] },
  trap_pit: { size: [G, G], palette: 'dust', ops: [
    { op: 'ellipse', at: [8, 8], rx: 5, ry: 4, color: 'dark' },
    { op: 'strokes', color: 'main', count: 4, len: 8, dir: 'right' }] },
  sluice: { size: [G, G], anchor: [8, 15], palette: 'wall_timber', ops: [
    { op: 'rect', at: [3, 3], w: 10, h: 10, color: 'main' },
    { op: 'rect', at: [6, 1], w: 4, h: 4, color: 'metal' },
    { op: 'outline', color: 'outline' }] },
  crank: { size: [G, G], anchor: [8, 15], palette: 'metal', ops: [
    { op: 'ellipse', at: [8, 9], rx: 4, ry: 4, color: 'main' },
    { op: 'line', from: [8, 9], to: [13, 5], color: 'dark', thickness: 2 },
    { op: 'outline', color: 'outline' }] },
  nameplate: { size: [G, G], anchor: [8, 15], palette: 'metal', ops: [
    { op: 'rect', at: [2, 6], w: 12, h: 6, color: 'main' },
    { op: 'line', from: [4, 9], to: [12, 9], color: 'outline', thickness: 1 },
    { op: 'outline', color: 'outline' }] },
  prize_stand: { size: [G, 20], anchor: [8, 19], palette: 'stone', ops: [
    { op: 'rect', at: [5, 8], w: 6, h: 11, color: 'main' },
    { op: 'rect', at: [3, 6], w: 10, h: 3, color: 'light' },
    { op: 'blob', at: [8, 3], r: 2.6, jitter: 0.3, color: 'gold', palette: 'gold' },
    { op: 'outline', color: 'outline' }] },
  stash: box('door', 12, 8, 7, [{ op: 'rect', at: [2, 9], w: 12, h: 1, color: 'iron' }, { op: 'rect', at: [7, 8], w: 2, h: 3, color: 'iron' }]),
  whetstone: rock('stone', 3.4),
};

// ---- actors -------------------------------------------------------------
// Silhouettes; palette and detail come from the instance.
export const ACTOR_RECIPES = {
  biped: { size: [G, 20], anchor: [8, 19], ops: [
    { op: 'rect', at: [5, 9], w: 6, h: 8, color: 'main' },
    { op: 'ellipse', at: [8, 6], rx: 3, ry: 3, color: 'light' },
    { op: 'rect', at: [5, 17], w: 2, h: 3, color: 'dark' },
    { op: 'rect', at: [9, 17], w: 2, h: 3, color: 'dark' },
    { op: 'outline', color: 'outline' }] },
  biped_tall: { size: [G, 22], anchor: [8, 21], ops: [
    { op: 'rect', at: [5, 8], w: 6, h: 11, color: 'main' },
    { op: 'ellipse', at: [8, 5], rx: 3, ry: 3, color: 'light' },
    { op: 'rect', at: [5, 19], w: 2, h: 3, color: 'dark' },
    { op: 'rect', at: [9, 19], w: 2, h: 3, color: 'dark' },
    { op: 'outline', color: 'outline' }] },
  biped_hunched: { size: [G, 18], anchor: [8, 17], ops: [
    { op: 'blob', at: [8, 10], r: 4.6, jitter: 0.3, color: 'main' },
    { op: 'ellipse', at: [6, 6], rx: 2.6, ry: 2.4, color: 'light' },
    { op: 'rect', at: [6, 15], w: 2, h: 3, color: 'dark' },
    { op: 'rect', at: [10, 15], w: 2, h: 3, color: 'dark' },
    { op: 'outline', color: 'outline' }] },
  quadruped: { size: [G, G], anchor: [8, 15], ops: [
    { op: 'ellipse', at: [8, 8], rx: 6, ry: 3.4, color: 'main' },
    { op: 'ellipse', at: [13, 6], rx: 2.6, ry: 2.4, color: 'light' },
    { op: 'rect', at: [4, 11], w: 2, h: 4, color: 'dark' },
    { op: 'rect', at: [11, 11], w: 2, h: 4, color: 'dark' },
    { op: 'outline', color: 'outline' }] },
  quadruped_low: { size: [G, G], anchor: [8, 15], ops: [
    { op: 'ellipse', at: [8, 11], rx: 6.4, ry: 2.6, color: 'main' },
    { op: 'ellipse', at: [13, 10], rx: 2.2, ry: 2, color: 'light' },
    { op: 'rect', at: [5, 13], w: 2, h: 2, color: 'dark' },
    { op: 'rect', at: [10, 13], w: 2, h: 2, color: 'dark' },
    { op: 'outline', color: 'outline' }] },
  low_wide: { size: [G, G], anchor: [8, 15], ops: [
    { op: 'ellipse', at: [8, 10], rx: 7, ry: 4, color: 'main' },
    { op: 'line', from: [2, 10], to: [0, 6], color: 'dark', thickness: 2 },
    { op: 'line', from: [14, 10], to: [15, 6], color: 'dark', thickness: 2 },
    { op: 'outline', color: 'outline' }] },
  bulk: { size: [G, 20], anchor: [8, 19], ops: [
    { op: 'blob', at: [8, 11], r: 6.4, jitter: 0.25, color: 'main' },
    { op: 'ellipse', at: [8, 5], rx: 3.4, ry: 3, color: 'dark' },
    { op: 'noise', region: 'main', color: 'light', density: 0.14 },
    { op: 'outline', color: 'outline' }] },
  bulk_tall: { size: [G, 24], anchor: [8, 23], ops: [
    { op: 'blob', at: [8, 14], r: 7, jitter: 0.25, color: 'main' },
    { op: 'ellipse', at: [8, 5], rx: 4, ry: 4, color: 'dark' },
    { op: 'noise', region: 'main', color: 'light', density: 0.16 },
    { op: 'outline', color: 'outline' }] },
  tangle: { size: [G, 18], anchor: [8, 17], ops: [
    { op: 'blob', at: [8, 11], r: 5.4, jitter: 0.6, color: 'main' },
    { op: 'strokes', color: 'dark', count: 6, len: 7, dir: 'up' },
    { op: 'outline', color: 'outline' }] },
  tangle_tall: { size: [G, 22], anchor: [8, 21], ops: [
    { op: 'blob', at: [8, 14], r: 6.4, jitter: 0.6, color: 'main' },
    { op: 'strokes', color: 'dark', count: 8, len: 11, dir: 'up' },
    { op: 'outline', color: 'outline' }] },
  wisp: { size: [G, G], anchor: [8, 12], ops: [
    { op: 'blob', at: [8, 7], r: 4, jitter: 0.7, color: 'main', alpha: 0.85 },
    { op: 'blob', at: [8, 6], r: 2, jitter: 0.5, color: 'light' }] },
  tall_thin: { size: [G, 22], anchor: [8, 21], ops: [
    { op: 'rect', at: [6, 6], w: 4, h: 14, color: 'main' },
    { op: 'ellipse', at: [8, 4], rx: 2.6, ry: 3.4, color: 'dark' },
    { op: 'outline', color: 'outline' }] },
  swarm_low: { size: [G, G], anchor: [8, 15], ops: [
    { op: 'blob', at: [5, 11], r: 2, jitter: 0.5, color: 'main' },
    { op: 'blob', at: [10, 12], r: 1.8, jitter: 0.5, color: 'dark' },
    { op: 'blob', at: [8, 8], r: 1.6, jitter: 0.5, color: 'main' }] },
  swarm_air: { size: [G, G], anchor: [8, 12], ops: [
    { op: 'noise', region: 'all', color: 'main', density: 0.10, circle: 6 },
    { op: 'noise', region: 'all', color: 'dark', density: 0.06, circle: 6 }] },
};

// ---- player composition parts ------------------------------------------
export const PLAYER_RECIPES = {
  player_body: { size: [G, 20], anchor: [8, 19], palette: 'coat_a', ops: [
    { op: 'rect', at: [5, 9], w: 6, h: 8, color: 'main' },
    { op: 'rect', at: [5, 17], w: 2, h: 3, color: 'dark' },
    { op: 'rect', at: [9, 17], w: 2, h: 3, color: 'dark' },
    { op: 'outline', color: 'outline' }] },
  player_head: { size: [G, 20], anchor: [8, 19], palette: 'skin_a', ops: [
    { op: 'ellipse', at: [8, 6], rx: 3, ry: 3, color: 'main' },
    { op: 'outline', color: 'outline' }] },
  player_hair: { size: [G, 20], anchor: [8, 19], palette: 'hair_a', ops: [
    { op: 'ellipse', at: [8, 4], rx: 3.2, ry: 2, color: 'main' },
    { op: 'rect', at: [5, 4], w: 6, h: 2, color: 'dark' }] },
  player_lantern: { size: [G, 20], anchor: [8, 19], palette: 'lantern_lit', ops: [
    { op: 'rect', at: [11, 10], w: 3, h: 4, color: 'dark' },
    { op: 'blob', at: [12, 12], r: 1.6, jitter: 0.3, color: 'flame' }] },
  player_weapon: { size: [G, 20], anchor: [8, 19], palette: 'metal', ops: [
    { op: 'line', from: [3, 14], to: [2, 8], color: 'main', thickness: 1 }] },
};

// ---- decor --------------------------------------------------------------
const speck = (palette, color, n, r) => ({ size: [G, G], palette, ops: [
  { op: 'scatter', color, count: n, r }] });

export const DECOR_RECIPES = {
  flower: speck('flower', 'main', 5, 1.2),
  grass_tuft: { size: [G, G], palette: 'grass', ops: [{ op: 'strokes', color: 'light', count: 4, len: 4, dir: 'up' }] },
  moss: speck('moss', 'light', 10, 1),
  mushroom: speck('fungus', 'main', 4, 1.4),
  fern: { size: [G, G], palette: 'moss', ops: [{ op: 'strokes', color: 'light', count: 5, len: 6, dir: 'up' }] },
  heather_flower: speck('heather', 'light', 8, 1),
  lichen: speck('moss', 'light', 12, 1),
  wrack: speck('leaf', 'dark', 7, 1.4),
  shell: speck('sand', 'light', 4, 1.2),
  reed: { size: [G, G], palette: 'reed', ops: [{ op: 'strokes', color: 'light', count: 5, len: 7, dir: 'up' }] },
  rubble: speck('rubble', 'dark', 8, 1.4),
  tracks: speck('mud', 'dark', 4, 1.2),
  tracks_old: speck('snow', 'dark', 4, 1.2),
  blood: speck('blood', 'main', 6, 1.4),
  windfall: speck('berry', 'berry', 4, 1.2),
  thorn: { size: [G, G], palette: 'tree_dead', ops: [{ op: 'strokes', color: 'trunk', count: 5, len: 5, dir: 'up' }] },
  dust_devil: speck('sand', 'light', 6, 1),
  sheep_bone: speck('bone', 'main', 3, 1.4),
  lantern_fly: speck('lantern_lit', 'flame', 4, 1),
  crop: { size: [G, G], palette: 'meadow', ops: [{ op: 'strokes', color: 'light', count: 6, len: 6, dir: 'up' }] },
  remembered: { size: [G, G], palette: 'green_flame', ops: [{ op: 'blob', at: [8, 8], r: 2.4, jitter: 0.5, color: 'flame' }] },
};

// ---- items --------------------------------------------------------------
export const ITEM_RECIPES = {
  weapon: { size: [G, G], palette: 'metal', ops: [
    { op: 'line', from: [3, 13], to: [12, 3], color: 'main', thickness: 2 },
    { op: 'line', from: [2, 14], to: [5, 11], color: 'dark', thickness: 2 },
    { op: 'outline', color: 'outline' }] },
  armour: { size: [G, G], palette: 'metal', ops: [
    { op: 'poly', points: [[4, 3], [12, 3], [12, 10], [8, 14], [4, 10]], color: 'main' },
    { op: 'noise', region: 'main', color: 'light', density: 0.14 },
    { op: 'outline', color: 'outline' }] },
  lantern: { size: [G, G], palette: 'lantern_lit', ops: [
    { op: 'rect', at: [4, 4], w: 8, h: 9, color: 'dark' },
    { op: 'blob', at: [8, 8], r: 2.4, jitter: 0.3, color: 'flame' },
    { op: 'outline', color: 'outline' }] },
  tonic: { size: [G, G], palette: 'flower', ops: [
    { op: 'rect', at: [6, 2], w: 4, h: 3, color: 'dark' },
    { op: 'ellipse', at: [8, 10], rx: 4, ry: 4.4, color: 'main' },
    { op: 'outline', color: 'outline' }] },
  food: { size: [G, G], palette: 'thatch', ops: [
    { op: 'ellipse', at: [8, 9], rx: 5, ry: 3.6, color: 'main' },
    { op: 'noise', region: 'main', color: 'dark', density: 0.18 },
    { op: 'outline', color: 'outline' }] },
  reagent: { size: [G, G], palette: 'moss', ops: [
    { op: 'strokes', color: 'main', count: 5, len: 8, dir: 'up' },
    { op: 'blob', at: [8, 5], r: 2, jitter: 0.5, color: 'light' }] },
  oil: { size: [G, G], palette: 'lantern_lit', ops: [
    { op: 'ellipse', at: [8, 10], rx: 4, ry: 5, color: 'dark' },
    { op: 'rect', at: [7, 3], w: 2, h: 3, color: 'main' },
    { op: 'outline', color: 'outline' }] },
  trinket: { size: [G, G], palette: 'gold', ops: [
    { op: 'ellipse', at: [8, 8], rx: 4, ry: 4, color: 'main' },
    { op: 'ellipse', at: [8, 8], rx: 2, ry: 2, color: 'outline' }] },
  key: { size: [G, G], palette: 'metal', ops: [
    { op: 'ellipse', at: [5, 6], rx: 2.6, ry: 2.6, color: 'main' },
    { op: 'rect', at: [6, 7], w: 2, h: 7, color: 'main' },
    { op: 'rect', at: [8, 11], w: 3, h: 1, color: 'main' },
    { op: 'outline', color: 'outline' }] },
  shard: { size: [G, G], palette: 'lantern_lit', ops: [
    { op: 'poly', points: [[8, 2], [13, 9], [8, 14], [3, 9]], color: 'flame' },
    { op: 'outline', color: 'outline' }] },
  lore: { size: [G, G], palette: 'ui', ops: [
    { op: 'rect', at: [3, 3], w: 10, h: 11, color: 'main' },
    { op: 'stripes', color: 'dark', every: 3, thickness: 1, dir: 'h' },
    { op: 'outline', color: 'outline' }] },
  coin: { size: [G, G], palette: 'gold', ops: [
    { op: 'ellipse', at: [8, 9], rx: 3.4, ry: 3.4, color: 'main' },
    { op: 'ellipse', at: [8, 9], rx: 2, ry: 2, color: 'light' },
    { op: 'outline', color: 'outline' }] },
  ammo: { size: [G, G], palette: 'metal', ops: [
    { op: 'line', from: [3, 13], to: [12, 4], color: 'main', thickness: 1 },
    { op: 'poly', points: [[12, 4], [10, 5], [11, 7]], color: 'light' }] },
  tool: { size: [G, G], palette: 'gold', ops: [
    { op: 'rect', at: [6, 4], w: 4, h: 8, color: 'main' },
    { op: 'ellipse', at: [8, 12], rx: 3, ry: 2.4, color: 'light' },
    { op: 'outline', color: 'outline' }] },
};

// Every table is frozen at load: a generator must never be able to edit one.
for (const table of [GROUND_RECIPES, SPRITE_RECIPES, ACTOR_RECIPES, PLAYER_RECIPES, DECOR_RECIPES, ITEM_RECIPES]) {
  for (const k of Object.keys(table)) Object.freeze(table[k]);
  Object.freeze(table);
}

// ============================================================
// Maps — tile grids + NPC/warp/object placement.
// Tile legend:
//   . grass/floor   # wall/building   T tree   ~ water
//   , path          f flowers         r rock   = counter/bench
// Each map: name, tiles (array of strings), npcs, warps, objects.
// npc: {x,y,id}  warp: {x,y,to,tx,ty}  object: {x,y,type,...}
// ============================================================

export const MAPS = {
  lane: {
    name: 'Coppergate Lane',
    tiles: [
      "TTTTTTTTTTTTTTTTTTTT",
      "T,,,,,,,,,,,,,,,,,,T",
      "T,####,,,,,,,,####,T",
      "T,#..#,,ff,,ff,#..#,T",
      "T,#..#,,,,,,,,,#..#,T",
      "T,,,,,,,,,,,,,,,,,,T",
      "T,,,,,,,,==,,,,,,,,T",
      "T,,,,,,,,,,,,,,,,,,T",
      "T,####,,,,,,,,####,T",
      "T,#..#,,,ff,,,,#..#,T",
      "T,#..#,,,,,,,,,#..#,T",
      "T,,,,,,,,,,,,,,,,,,T",
      "T,,,,,,,,,,,,,,,,,,T",
      "TTTTTTTTTT,,TTTTTTTT",
    ],
    npcs: [
      { x: 3,  y: 3,  id: 'trina' },     // in NW building (workshop)
      { x: 16, y: 3,  id: 'mabel' },     // NE building (bakery)
      { x: 3,  y: 9,  id: 'pilcrow' },   // SW building (town hall)
      { x: 9,  y: 6,  id: 'shopkeep' },  // at the counter
    ],
    warps: [
      { x: 10, y: 13, to: 'wilds', tx: 10, ty: 1 },
      { x: 11, y: 13, to: 'wilds', tx: 10, ty: 1 },
    ],
    labels: [
      { x: 3, y: 2, text: '⚙ Workshop' },
      { x: 16, y: 2, text: '🥐 Bakery' },
      { x: 3, y: 8, text: '🏛 Hall' },
    ],
  },

  wilds: {
    name: 'Whistling Wilds',
    tiles: [
      "TTTTTT,,,,,,TTTTTTTT",
      "TT,,,,,,,,,,,,,,,,TT",
      "T,,,TT,,,,,,,,TT,,,T",
      "T,,,,,,,ff,,,,,,,,,T",
      "T,,rr,,,,,,,,,,rr,,T",
      "T,,,,,,,,,,,,,,,,,,T",
      "TT,,,,,ff,,,,ff,,,TT",
      "T,,,TT,,,,,,,,TT,,,T",
      "T,,,,,,,,~~,,,,,,,,T",
      "T,,ff,,,,~~~~,,,,,,T",
      "T,,,,,,,,,~~,,,,,,,T",
      "TT,,,,,,,,,,,,,,,,TT",
      "T,,,,,,,,,,,,,,,,,,T",
      "TTTTTTTT,,,,TTTTTTTT",
    ],
    npcs: [],
    warps: [
      { x: 10, y: 0, to: 'lane', tx: 10, ty: 12 },
      { x: 8,  y: 13, to: 'gully', tx: 9, ty: 1 },
      { x: 9,  y: 13, to: 'gully', tx: 9, ty: 1 },
    ],
    objects: [
      { x: 15, y: 5, type: 'chest', item: 'oilcan', qty: 1 },
    ],
    labels: [ { x: 1, y: 1, text: 'Whistling Wilds' } ],
  },

  gully: {
    name: 'Gutter Gully',
    tiles: [
      "TTTTTTTT,,,,TTTTTTTT",
      "T,,,,,,,,,,,,,,,,,,T",
      "T,#rr#,,,,,,,,,rr,,T",
      "T,,,,,,,,,,,,,,,,,,T",
      "T,,~~~~~~~~~~~~~~,,T",
      "T,,,,,,,,,,,,,,,,,,T",
      "T,,rr,,,,,,,,,,,,,,T",
      "T,,,,,,,,ff,,,,rr,,T",
      "T,,,,,,,,,,,,,,,,,,T",
      "T,,,,,,,,,,,,,,,,,,T",
      "T,,rr,,,,,,,,,,,,,,T",
      "T,,,,,,,,,,,,,,####,",
      "T,,,,,,,,,,,,,,#BB#,",
      "TTTTTTTT,,,,TTTT##TT",
    ],
    npcs: [],
    warps: [
      { x: 9, y: 0, to: 'wilds', tx: 8, ty: 12 },
    ],
    objects: [
      { x: 4,  y: 6, type: 'kettle' },                    // Mabel's kettle
      { x: 16, y: 12, type: 'boss' },                     // Big Bertha lair
      { x: 12, y: 8, type: 'chest', item: 'scone', qty: 2 },
    ],
    labels: [ { x: 1, y: 1, text: 'Gutter Gully' } ],
  },
};

// Which tile chars block movement
export const SOLID = new Set(['#', 'T', '~', 'r', '=', 'B']);

// ============================================================
// core/coords.js - every conversion between coordinate spaces (GDD §8.2)
// These live here and nowhere else.
// ============================================================
import { WORLD_W, WORLD_H, REGION_GRID, REGION_CELL } from '../data/constants.js';

export const toChunk = t => t >> 5;              // CHUNK = 32
export const toLocal = t => t & 31;
export const chunkKey = (cx, cy) => (cy << 6) | cx;   // 48 < 64, fits
export const unChunkKey = k => [k & 63, k >> 6];
export const tileIndex = (lx, ly) => (ly << 5) | lx;
export const inWorld = (tx, ty) => tx >= 0 && ty >= 0 && tx < WORLD_W && ty < WORLD_H;

export const regionCellOf = (tx, ty) => [
  Math.min(REGION_GRID - 1, Math.floor(tx / REGION_CELL)),
  Math.min(REGION_GRID - 1, Math.floor(ty / REGION_CELL)),
];

/** The eight neighbour offsets, in a fixed order. Order is a contract. */
export const DIRS8 = Object.freeze([
  [0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1],
]);
export const DIRS4 = Object.freeze([[0, -1], [1, 0], [0, 1], [-1, 0]]);

export const DIR_NAMES = Object.freeze(['north', 'north-east', 'east', 'south-east', 'south', 'south-west', 'west', 'north-west']);
export const DIR_ARROWS = Object.freeze(['↑', '↗', '→', '↘', '↓', '↙', '←', '↖']);

/** Index into DIRS8 for a delta, or -1. */
export function dirIndex(dx, dy) {
  for (let i = 0; i < 8; i++) if (DIRS8[i][0] === dx && DIRS8[i][1] === dy) return i;
  return -1;
}

/** Nearest compass index for an arbitrary vector. */
export function bearing(dx, dy) {
  const a = Math.atan2(dy, dx);
  const oct = Math.round((a + Math.PI) / (Math.PI / 4)) % 8;
  // atan2 octants -> DIRS8 order (which starts at north and goes clockwise)
  return [6, 7, 0, 1, 2, 3, 4, 5][oct];
}

// ============================================================
// gen/fields.js - world-scale field functions (GDD §8.6, §9.2-9.6)
// PURE. Every one is O(1) and safe to call 50,000 times a frame.
// `W` is the world context: { master, rivers } - never mutable state.
// ============================================================
import { fbm2D, ridged2D, warpedFbm2D } from '../core/noise.js';
import { deriveRNG, hashInts } from '../core/rand.js';
import { clamp01 } from '../core/util.js';
import { regionId } from '../core/ids.js';
import {
  NOISE_SALTS as S, DOMAINS, WORLD_W, WORLD_H, REGION_GRID, REGION_CELL,
  SEA, SHORE, HILL,
} from '../data/constants.js';

/**
 * @pure The raw elevation field, exactly as specified.
 * Value-noise fbm clusters near its mean, so the raw range varies a lot by
 * seed (one fixture seed tops out at 0.70). `calibrateElevation` stretches it
 * so the SEA/HILL/PEAK thresholds mean the same thing in every world.
 * See DECISIONS.md, §9.2.
 */
export function rawElevationAt(W, tx, ty) {
  const m = W.master;
  const nx = tx / 420, ny = ty / 420;
  const base = fbm2D(m, S.elevation, nx, ny, { octaves: 6, gain: 0.5 });
  const spine = ridged2D(m, S.mountains, nx * 0.6, ny * 0.6, { octaves: 4 });
  const detail = fbm2D(m, S.elevDetail, nx * 4, ny * 4, { octaves: 3 }) * 0.08;

  let e = base * 0.62 + spine * 0.30 + detail;

  const dx = (tx / WORLD_W) * 2 - 1, dy = (ty / WORLD_H) * 2 - 1;
  const d = Math.min(1, Math.sqrt(dx * dx + dy * dy) / 1.05);
  const falloff = 1 - Math.pow(d, 3.2);
  e = e * 0.25 + e * 0.75 * falloff;

  return clamp01(e);
}

/**
 * @pure Sample the raw field on a fixed lattice and record the 2nd/99.6th
 * percentiles. Deterministic (fixed order, fixed stride) and cheap enough to
 * run once at world creation; the result lives in the world header.
 */
export function calibrateElevation(W) {
  const vals = [];
  for (let y = 0; y < WORLD_H; y += 16) {
    for (let x = 0; x < WORLD_W; x += 16) vals.push(rawElevationAt(W, x, y));
  }
  vals.sort((a, b) => a - b);
  const at = q => vals[Math.min(vals.length - 1, Math.max(0, Math.round(q * (vals.length - 1))))];
  const lo = at(0.02), hi = at(0.996);
  return { lo, hi: Math.max(hi, lo + 0.05) };
}

/** @pure Calibrated elevation, 0..1. The one every other system reads. */
export function elevationAt(W, tx, ty) {
  const raw = rawElevationAt(W, tx, ty);
  const c = W.elev;
  if (!c) return raw;
  return clamp01((raw - c.lo) / (c.hi - c.lo));
}

/** @pure Temperature, 0..1. Latitude band minus altitude. */
export function temperatureAt(W, tx, ty) {
  const lat = ty / WORLD_H;
  const band = 0.15 + lat * 0.8;
  const wobble = fbm2D(W.master, S.tempWobble, tx / 700, ty / 700, { octaves: 2 }) * 0.18 - 0.09;
  const alt = Math.max(0, elevationAt(W, tx, ty) - 0.5) * 0.9;
  return clamp01(band + wobble - alt);
}

/** @pure River strength at a tile, 0..1. Needs W.rivers (§9.3). */
export function riverAt(W, tx, ty) {
  const r = W.rivers;
  if (!r) return 0;
  return r.strengthAt(tx, ty);
}

/** @pure Moisture, 0..1. */
export function moistureAt(W, tx, ty) {
  const base = warpedFbm2D(W.master, S.moisture, tx / 300, ty / 300, { octaves: 5 }, 10);
  const river = riverAt(W, tx, ty) > 0 ? 0.25 : 0;
  const coast = elevationAt(W, tx, ty) < 0.38 ? 0.15 : 0;
  return clamp01(base + river + coast);
}

/** @pure Biome key. A decision list, first match wins. APPEND ONLY. */
export function biomeAt(W, tx, ty) {
  const e = elevationAt(W, tx, ty);
  if (e < 0.30) return 'sea';
  if (e < 0.34) return 'shore';
  const t = temperatureAt(W, tx, ty);
  if (e > 0.90) return 'peak';
  if (e > 0.80 && t < 0.35) return 'snowfield';
  if (e > 0.80) return 'crag';
  const m = moistureAt(W, tx, ty);
  if (e > 0.66 && m > 0.6) return 'cloudforest';
  if (e > 0.66) return 'upland';
  if (m > 0.78 && e < 0.44) return 'fen';
  if (m > 0.70) return 'deepwood';
  if (m > 0.52 && t > 0.55) return 'orchardland';
  if (m > 0.52) return 'wood';
  if (m < 0.25 && t > 0.62) return 'dryland';
  if (m < 0.30) return 'heath';
  return 'meadow';
}

/** @pure Quiet before any region modifier. */
export function quietBaseAt(W, tx, ty) {
  return clamp01(fbm2D(W.master, S.quiet, tx / 180, ty / 180, { octaves: 3 }));
}

const siteCache = new Map();
/** @pure Region Voronoi site for a cell. Cache is keyed by seed + cell. */
export function siteFor(W, rx, ry) {
  const key = W.master.string + '|' + rx + ',' + ry + '|' + (W.attempt || 0);
  let s = siteCache.get(key);
  if (s) return s;
  const rng = deriveRNG(W.master, DOMAINS.REGIONS, rx, ry, W.attempt || 0);
  s = {
    id: regionId(rx, ry), rx, ry,
    x: (rx + 0.5) * REGION_CELL + rng.float(-0.34, 0.34) * REGION_CELL,
    y: (ry + 0.5) * REGION_CELL + rng.float(-0.34, 0.34) * REGION_CELL,
  };
  if (siteCache.size > 512) siteCache.clear();
  siteCache.set(key, s);
  return s;
}

/** @pure The 36 sites, always in this order. */
export function regionSites(W) {
  const sites = [];
  for (let ry = 0; ry < REGION_GRID; ry++) {
    for (let rx = 0; rx < REGION_GRID; rx++) sites.push(siteFor(W, rx, ry));
  }
  return sites;
}

/** @pure Which region owns a tile. Warped so edges are organic. */
export function regionAt(W, tx, ty) {
  const cx = Math.floor(tx / REGION_CELL), cy = Math.floor(ty / REGION_CELL);
  const wx = tx + (fbm2D(W.master, S.regionWarp, tx / 120, ty / 120, { octaves: 2 }) - 0.5) * 34;
  const wy = ty + (fbm2D(W.master, S.regionWarp + 91, tx / 120, ty / 120, { octaves: 2 }) - 0.5) * 34;
  let best = null, bestD = Infinity;
  for (let j = -1; j <= 1; j++) for (let i = -1; i <= 1; i++) {
    const rx = cx + i, ry = cy + j;
    if (rx < 0 || ry < 0 || rx >= REGION_GRID || ry >= REGION_GRID) continue;
    const s = siteFor(W, rx, ry);
    const d = (wx - s.x) ** 2 + (wy - s.y) ** 2;
    if (d < bestD) { bestD = d; best = s; }
  }
  if (!best) best = siteFor(W, Math.min(REGION_GRID - 1, Math.max(0, cx)), Math.min(REGION_GRID - 1, Math.max(0, cy)));
  return best.id;
}

/** @pure Max |elevation delta| over the 8 neighbours - used for buildability. */
export function slopeAt(W, tx, ty) {
  const e = elevationAt(W, tx, ty);
  let max = 0;
  for (const [dx, dy] of [[1, 0], [-1, 0], [0, 1], [0, -1]]) {
    max = Math.max(max, Math.abs(elevationAt(W, tx + dx, ty + dy) - e));
  }
  return max;
}

/** @pure Is this tile land the player could stand on at all? */
export function isLand(W, tx, ty) {
  return elevationAt(W, tx, ty) >= SEA;
}

/** @pure Rough walkability at world scale, ignoring objects. For validation. */
export function coarsePassable(W, tx, ty) {
  const e = elevationAt(W, tx, ty);
  if (e < SHORE) return false;                       // sea, and the wet edge
  if (e > 0.93) return false;                        // bare peak
  if (riverAt(W, tx, ty) >= 0.9) return false;       // wide river
  return true;
}

export { SEA, SHORE, HILL };

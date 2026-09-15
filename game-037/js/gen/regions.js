// ============================================================
// gen/regions.js - region profiles, adjacency, tiers (GDD §9.6-9.7, §10)
// PURE.
// ============================================================
import { deriveRNG } from '../core/rand.js';
import { regionId } from '../core/ids.js';
import { clamp01 } from '../core/util.js';
import { DOMAINS, REGION_GRID, REGION_CELL, WORLD_W, WORLD_H } from '../data/constants.js';
import { CULTURE_KEYS } from '../data/names.js';
import { elevationAt, biomeAt, regionAt, quietBaseAt, siteFor } from './fields.js';
import { expandPlace } from './name.js';

const SAMPLE_STRIDE = 16;   // the lattice profiles are sampled on

/**
 * @pure Build all 36 region profiles by sampling each cell's neighbourhood.
 * Profiles are cheap and stable; they live in the world header.
 */
export function generateRegions(W) {
  const regions = new Map();

  for (let ry = 0; ry < REGION_GRID; ry++) {
    for (let rx = 0; rx < REGION_GRID; rx++) {
      const id = regionId(rx, ry);
      const rng = deriveRNG(W.master, DOMAINS.REGION_PROFILE, rx, ry, W.attempt || 0);

      // Sample the cell plus a margin, counting only tiles this region owns.
      const x0 = Math.max(0, rx * REGION_CELL - 48), x1 = Math.min(WORLD_W, (rx + 1) * REGION_CELL + 48);
      const y0 = Math.max(0, ry * REGION_CELL - 48), y1 = Math.min(WORLD_H, (ry + 1) * REGION_CELL + 48);
      const mix = {};
      let owned = 0, land = 0, elevSum = 0, quietSum = 0;
      for (let y = y0; y < y1; y += SAMPLE_STRIDE) {
        for (let x = x0; x < x1; x += SAMPLE_STRIDE) {
          if (regionAt(W, x, y) !== id) continue;
          owned++;
          const b = biomeAt(W, x, y);
          mix[b] = (mix[b] || 0) + 1;
          const e = elevationAt(W, x, y);
          elevSum += e;
          quietSum += quietBaseAt(W, x, y);
          if (b !== 'sea') land++;
        }
      }
      const cell = SAMPLE_STRIDE * SAMPLE_STRIDE;
      const landTiles = land * cell;
      const meanElev = owned ? elevSum / owned : 0;
      const meanQuiet = owned ? quietSum / owned : 0.3;

      let dominant = 'meadow', dn = -1;
      for (const k of Object.keys(mix)) if (k !== 'sea' && mix[k] > dn) { dn = mix[k]; dominant = k; }
      const biomeMix = {};
      if (owned) for (const k of Object.keys(mix)) biomeMix[k] = +(mix[k] / owned).toFixed(3);

      // kind (GDD §10.2)
      let kind;
      if (landTiles < 1800) kind = 'drowned';
      else if (meanElev > 0.70) kind = 'high';
      else if (meanElev >= 0.34 && meanElev <= 0.70 && landTiles >= 6000) kind = 'settled';
      else kind = 'wild';

      const culture = rng.pick(CULTURE_KEYS);
      const quietBase = clamp01(meanQuiet * 0.6 + rng.float(0, 0.22));
      const site = siteFor(W, rx, ry);

      regions.set(id, {
        id, rx, ry, x: Math.round(site.x), y: Math.round(site.y),
        landTiles, dominantBiome: dominant, biomeMix, kind, culture,
        meanElev: +meanElev.toFixed(3),
        name: '',                       // filled after, needs uniqueness across the world
        quiet: quietBase, quietBase, quietUpdatedTick: 0,
        tier: 0, settlements: [], hollows: [], threadId: null,
        neighbors: [], litHollows: 0, threadState: 'unknown',
      });
    }
  }

  nameRegions(W, regions);
  buildAdjacency(W, regions);
  return regions;
}

/** @pure Unique, place-like names for every region. */
function nameRegions(W, regions) {
  const used = new Set();
  for (const r of regions.values()) {
    const rng = deriveRNG(W.master, DOMAINS.REGION_PROFILE, r.rx, r.ry, 77);
    r.name = expandPlace(rng, used, r.culture);
    used.add(r.name.toLowerCase());
  }
}

/**
 * @pure Two regions are adjacent if any pair of their land tiles is close.
 * Tested on a 16-tile lattice along shared boundaries.
 */
function buildAdjacency(W, regions) {
  const stride = 16;
  const pairs = new Set();
  for (let y = 0; y < WORLD_H; y += stride) {
    for (let x = 0; x < WORLD_W; x += stride) {
      const a = regionAt(W, x, y);
      if (biomeAt(W, x, y) === 'sea') continue;
      for (const [dx, dy] of [[stride, 0], [0, stride]]) {
        const nx = x + dx, ny = y + dy;
        if (nx >= WORLD_W || ny >= WORLD_H) continue;
        if (biomeAt(W, nx, ny) === 'sea') continue;
        const b = regionAt(W, nx, ny);
        if (a === b) continue;
        pairs.add(a < b ? a + '|' + b : b + '|' + a);
      }
    }
  }
  for (const p of pairs) {
    const [a, b] = p.split('|');
    const ra = regions.get(a), rb = regions.get(b);
    if (!ra || !rb) continue;
    if (!ra.neighbors.includes(b)) ra.neighbors.push(b);
    if (!rb.neighbors.includes(a)) rb.neighbors.push(a);
  }
  for (const r of regions.values()) r.neighbors.sort();
}

/**
 * @pure Tier = graph distance from the start region, clamped 0-6.
 * Difficulty is a function of where you are, never of what level you are.
 */
export function assignTiers(regions, startRegionId) {
  for (const r of regions.values()) r.tier = 6;
  const start = regions.get(startRegionId);
  if (!start) return;
  start.tier = 0;
  const queue = [startRegionId];
  const seen = new Set([startRegionId]);
  while (queue.length) {
    const id = queue.shift();
    const r = regions.get(id);
    for (const n of r.neighbors) {
      if (seen.has(n)) continue;
      seen.add(n);
      const nr = regions.get(n);
      if (!nr) continue;
      nr.tier = Math.min(6, r.tier + 1);
      queue.push(n);
    }
  }
  // Unreachable regions (islands) take their distance from raw geometry.
  for (const r of regions.values()) {
    if (seen.has(r.id)) continue;
    const d = Math.abs(r.rx - start.rx) + Math.abs(r.ry - start.ry);
    r.tier = Math.min(6, Math.max(1, d));
  }
}

/** @pure The Quiet at a tile: region value, noise, and what is near (GDD §10.3). */
export function quietAt(W, regions, tx, ty) {
  const r = regions.get(regionAt(W, tx, ty));
  const base = r ? r.quiet : 0.2;
  const n = quietBaseAt(W, tx, ty);
  return clamp01(base * 0.7 + n * 0.3);
}

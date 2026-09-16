// ============================================================
// gen/settlement.js - settlement placement and layout (GDD §11)
// PURE. Produces a record the chunk stamper reads; never draws anything.
// Legible on a small screen is the governing constraint: no mazes.
// ============================================================
import { deriveRNG, hashStr } from '../core/rand.js';
import { settlementId, buildingId } from '../core/ids.js';
import { clamp } from '../core/util.js';
import {
  DOMAINS, REGION_CELL, MIN_SETTLE_DIST, SHORE, HILL, WORLD_W, WORLD_H,
} from '../data/constants.js';
import { CULTURES } from '../data/cultures.js';
import { elevationAt, moistureAt, slopeAt, riverAt, regionAt, biomeAt } from './fields.js';
import { expandPlace } from './name.js';

const SIZE_OF = { 1: 'hamlet', 2: 'village', 3: 'town' };

/** @pure Score a candidate site. Higher is better (GDD §9.8). */
function scoreSite(W, x, y, chosen, hollowHints, rng) {
  const e = elevationAt(W, x, y);
  if (e < SHORE || e > HILL) return -Infinity;
  let s = 0;
  if (e > 0.36 && e < 0.62) s += 3.0;
  s += 2.0 * (1 - Math.abs(moistureAt(W, x, y) - 0.55));
  let nearWater = false;
  for (let r = 1; r <= 6 && !nearWater; r++) {
    for (const [dx, dy] of [[r, 0], [-r, 0], [0, r], [0, -r], [r, r], [-r, -r], [r, -r], [-r, r]]) {
      if (riverAt(W, x + dx, y + dy) > 0) { nearWater = true; break; }
    }
  }
  if (nearWater) s += 2.5;
  let coastal = false;
  for (const d of [4, 8, 10]) {
    if (elevationAt(W, x + d, y) < SHORE || elevationAt(W, x - d, y) < SHORE ||
        elevationAt(W, x, y + d) < SHORE || elevationAt(W, x, y - d) < SHORE) { coastal = true; break; }
  }
  if (coastal) s += 1.5;
  for (const h of hollowHints) {
    const d = Math.hypot(h.x - x, h.y - y);
    if (d > 20 && d < 90) { s += 1.2; break; }
  }
  if (slopeAt(W, x, y) > 0.06) s -= 4.0;
  for (const c of chosen) {
    if (Math.hypot(c.x - x, c.y - y) < MIN_SETTLE_DIST) s -= 8.0;
  }
  return s + rng.float(0, 0.8) + (coastal ? 0.001 : 0);
}

/**
 * @pure Place settlements for one region. Returns records without rosters
 * or layouts; those are derived lazily from the record's id.
 */
export function placeSettlements(W, region, hollowHints, usedNames) {
  if (region.kind !== 'settled') return [];
  const rng = deriveRNG(W.master, DOMAINS.SETTLE_SITE, region.rx, region.ry, W.attempt || 0);
  const nKey = rng.weightedKey({ 1: 3, 2: 5, 3: 2 });
  const n = parseInt(nKey, 10);

  // 240 points on a jittered lattice inside the region
  const candidates = [];
  const x0 = region.rx * REGION_CELL, y0 = region.ry * REGION_CELL;
  const step = Math.floor(REGION_CELL / 16);
  for (let j = 0; j < 16; j++) for (let i = 0; i < 16; i++) {
    const x = clamp(x0 + i * step + rng.int(-step / 3 | 0, step / 3 | 0), 4, WORLD_W - 5);
    const y = clamp(y0 + j * step + rng.int(-step / 3 | 0, step / 3 | 0), 4, WORLD_H - 5);
    if (regionAt(W, x, y) !== region.id) continue;
    candidates.push([x, y]);
  }

  const chosen = [];
  for (let k = 0; k < n; k++) {
    let best = null, bestScore = -Infinity;
    for (const [x, y] of candidates) {
      const s = scoreSite(W, x, y, chosen, hollowHints, rng);
      if (s > bestScore) { bestScore = s; best = [x, y]; }
    }
    if (!best || bestScore < 0) break;
    const sizeKey = rng.weightedKey({ hamlet: 4, village: 5, town: 1 });
    const [lo, hi] = { hamlet: [4, 7], village: [8, 16], town: [17, 30] }[sizeKey];
    const id = settlementId(region.rx, region.ry, chosen.length);
    chosen.push({
      id, regionId: region.id, x: best[0], y: best[1],
      size: sizeKey, buildings: rng.int(lo, hi),
      culture: region.culture, score: bestScore,
      name: expandPlace(rng, usedNames, region.culture),
      litHearth: false, discovered: false,
    });
    usedNames.add(chosen[chosen.length - 1].name.toLowerCase());
  }
  return chosen;
}

// ---------------------------------------------------------------------------
// Layout
// ---------------------------------------------------------------------------

const BUILDING_FUNCTIONS = ['home', 'inn', 'smith', 'market', 'herbalist', 'craft', 'chapel', 'granary', 'boathouse'];

/**
 * @pure The full layout: plaza, hearth, streets, lots, buildings, yards, fields.
 * Everything a chunk stamper or an NPC schedule needs.
 */
export function generateLayout(W, settle) {
  const rng = deriveRNG(W.master, DOMAINS.SETTLE_LAYOUT, hashStr(settle.id));
  const culture = CULTURES[settle.culture] || CULTURES.hedgewright;

  // 1. PLAZA, snapped to the flattest ground near the site.
  let px = settle.x, py = settle.y, bestSlope = Infinity;
  for (let dy = -3; dy <= 3; dy++) for (let dx = -3; dx <= 3; dx++) {
    const s = slopeAt(W, settle.x + dx, settle.y + dy);
    if (s < bestSlope) { bestSlope = s; px = settle.x + dx; py = settle.y + dy; }
  }
  const pw = rng.int(5, 9), ph = rng.int(4, 7);
  const plaza = { x: px - (pw >> 1), y: py - (ph >> 1), w: pw, h: ph };
  const hearth = { x: plaza.x + (pw >> 1), y: plaza.y + (ph >> 1) };

  // 2. SPINES. Streets biased straight, so the place reads at a glance.
  const streets = [];
  const spineCount = settle.size === 'hamlet' ? 3 : settle.size === 'village' ? 5 : 7;
  const startDirs = rng.shuffle([[0, -1], [1, 0], [0, 1], [-1, 0], [1, 1], [-1, -1], [1, -1], [-1, 1]]).slice(0, spineCount);
  for (const [sdx, sdy] of startDirs) {
    let cx = hearth.x + sdx * ((pw >> 1) + 1), cy = hearth.y + sdy * ((ph >> 1) + 1);
    let dx = sdx, dy = sdy;
    const len = rng.int(10, 24);
    const tiles = [];
    const steps = [];
    for (let i = 0; i < len; i++) {
      tiles.push([cx, cy], [cx + (dy !== 0 ? 1 : 0), cy + (dx !== 0 ? 1 : 0)]);
      steps.push({ x: cx, y: cy, dx, dy });
      if (rng.chance(0.20)) {
        const turn = rng.chance(0.5) ? 1 : -1;
        const idx = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]]
          .findIndex(d => d[0] === dx && d[1] === dy);
        const nd = [[0, -1], [1, -1], [1, 0], [1, 1], [0, 1], [-1, 1], [-1, 0], [-1, -1]][(idx + turn + 8) % 8];
        dx = nd[0]; dy = nd[1];
      }
      cx += dx; cy += dy;
      if (elevationAt(W, cx, cy) < SHORE || elevationAt(W, cx, cy) > HILL) break;
    }
    streets.push({ tiles, steps, dir: [sdx, sdy] });
  }

  // 3-4. LOTS and BUILDINGS.
  const lots = [];
  const taken = (x, y, w, h) => {
    if (x < plaza.x + plaza.w + 1 && x + w > plaza.x - 1 && y < plaza.y + plaza.h + 1 && y + h > plaza.y - 1) return true;
    for (const l of lots) {
      if (x < l.x + l.w + 1 && x + w > l.x - 1 && y < l.y + l.h + 1 && y + h > l.y - 1) return true;
    }
    return false;
  };
  const wanted = settle.buildings;
  // Walk each street; every 3-5 tiles, on alternating sides, attempt a lot one
  // tile clear of the street. Relax the spacing once if we come up short.
  for (let relax = 0; relax < 3 && lots.length < wanted; relax++) {
    for (const st of streets) {
      let side = 1;
      let next = 2;
      for (let i = 2; i < st.steps.length && lots.length < wanted; i++) {
        if (i < next) continue;
        next = i + rng.int(3, 5);
        side = -side;
        const step = st.steps[i];
        // perpendicular to the street's local direction
        const px2 = -step.dy || 0, py2 = step.dx || 0;
        const w = rng.int(4, 7), h = rng.int(4, 6);
        const ax = step.x + px2 * side * 2, ay = step.y + py2 * side * 2;
        let ox, oy;
        if (Math.abs(px2) >= Math.abs(py2)) {
          ox = px2 * side > 0 ? ax : ax - w + 1;
          oy = ay - (h >> 1);
        } else {
          oy = py2 * side > 0 ? ay : ay - h + 1;
          ox = ax - (w >> 1);
        }
        if (taken(ox, oy, w, h)) continue;
        let bad = false;
        for (let yy = oy; yy < oy + h && !bad; yy++) for (let xx = ox; xx < ox + w; xx++) {
          const e = elevationAt(W, xx, yy);
          if (e < SHORE || e > HILL || riverAt(W, xx, yy) > 0.3) { bad = true; break; }
          if (relax === 0 && slopeAt(W, xx, yy) > 0.05) { bad = true; break; }
        }
        if (bad) continue;
        lots.push({ x: ox, y: oy, w, h, street: [step.x, step.y], side });
      }
    }
  }

  // Assign functions in priority order, then homes.
  const coastal = biomeAt(W, settle.x, settle.y) === 'shore' ||
    elevationAt(W, settle.x + 10, settle.y) < SHORE || elevationAt(W, settle.x, settle.y + 10) < SHORE;
  const priority = ['home', 'inn', 'smith', 'market', 'herbalist', 'craft', 'chapel', 'granary'];
  if (coastal) priority.push('boathouse');
  const buildings = [];
  for (let i = 0; i < lots.length; i++) {
    const l = lots[i];
    const fn = i < priority.length ? priority[i] : 'home';
    // Door faces the street.
    const door = doorFor(l);
    buildings.push({
      id: buildingId(settle.id, i), index: i, fn,
      x: l.x, y: l.y, w: l.w, h: l.h, door,
      wallObj: culture.build, roof: culture.roof, floor: culture.floor,
      residents: [],
    });
  }

  // 5. Service guarantees (GDD §11.5): convert the lowest-index home if missing.
  ensureService(buildings, 'inn');
  if (settle.size !== 'hamlet') { ensureService(buildings, 'smith'); ensureService(buildings, 'market'); }

  // 6. EDGE: a wall with gaps at the street exits. Hedges are slow, not solid.
  const wallKind = settle.size === 'hamlet' ? 'none' : culture.wall;

  // 7. FIELDS, on the flattest side, outside the wall.
  const fields = [];
  if (settle.size !== 'hamlet') {
    const nf = rng.int(2, 6);
    for (let i = 0; i < nf; i++) {
      const ang = (i / nf) * Math.PI * 2 + rng.float(0, 0.6);
      const d = rng.int(16, 26);
      const fx = Math.round(settle.x + Math.cos(ang) * d), fy = Math.round(settle.y + Math.sin(ang) * d);
      if (elevationAt(W, fx, fy) < SHORE || elevationAt(W, fx, fy) > HILL) continue;
      if (slopeAt(W, fx, fy) > 0.05) continue;
      fields.push({ x: fx - 4, y: fy - 3, w: rng.int(6, 10), h: rng.int(4, 7) });
    }
  }

  const bounds = computeBounds(plaza, lots, fields);
  return { settleId: settle.id, plaza, hearth, streets, buildings, fields, wallKind, culture: settle.culture, bounds };
}

function doorFor(l) {
  const [sx, sy] = l.street;
  // put the door on the wall nearest the street tile
  const cx = l.x + l.w / 2, cy = l.y + l.h / 2;
  const dx = sx - cx, dy = sy - cy;
  if (Math.abs(dx) > Math.abs(dy)) {
    return { x: dx > 0 ? l.x + l.w - 1 : l.x, y: Math.floor(cy) };
  }
  return { x: Math.floor(cx), y: dy > 0 ? l.y + l.h - 1 : l.y };
}

function ensureService(buildings, fn) {
  if (buildings.some(b => b.fn === fn)) return;
  const home = buildings.find(b => b.fn === 'home');
  if (home) home.fn = fn;
}

function computeBounds(plaza, lots, fields) {
  let x0 = plaza.x, y0 = plaza.y, x1 = plaza.x + plaza.w, y1 = plaza.y + plaza.h;
  for (const l of lots.concat(fields)) {
    x0 = Math.min(x0, l.x); y0 = Math.min(y0, l.y);
    x1 = Math.max(x1, l.x + l.w); y1 = Math.max(y1, l.y + l.h);
  }
  return { x0: x0 - 3, y0: y0 - 3, x1: x1 + 3, y1: y1 + 3 };
}

export { SIZE_OF, BUILDING_FUNCTIONS };

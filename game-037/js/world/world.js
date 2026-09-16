// ============================================================
// world/world.js - world creation (GDD §9.1, §9.10, §9.11, §14.7)
// Steps 1-9 run once and produce a small, re-derivable header.
// ============================================================
import { deriveRNG } from '../core/rand.js';
import { floodFill } from '../core/grid.js';
import { WORLD_W, WORLD_H, DOMAINS, VIGOR_SHARDS_IN_WORLD } from '../data/constants.js';
import { calibrateElevation, elevationAt, coarsePassable, regionAt, biomeAt, slopeAt } from '../gen/fields.js';
import { generateRivers } from '../gen/rivers.js';
import { generateRegions, assignTiers } from '../gen/regions.js';
import { placeSettlements, generateLayout } from '../gen/settlement.js';
import { generateHollows, CAPABILITIES } from '../gen/hollow/identity.js';
import { generateRoads } from '../gen/roads.js';
import { generateThread } from '../gen/thread.js';
import { generateLongThread } from '../gen/longthread.js';

const MAX_ATTEMPTS = 8;

/**
 * @pure Build the world header from a master seed. Retries with an internal
 * attempt counter on validation failure - never with a different seed, so the
 * world stays reproducible from the seed string alone.
 */
export function createWorld(master, opts = {}) {
  let last = null;
  for (let attempt = 0; attempt < MAX_ATTEMPTS; attempt++) {
    const w = buildAttempt(master, attempt, attempt >= MAX_ATTEMPTS - 2);
    const report = validate(w, attempt >= MAX_ATTEMPTS - 2);
    w.validation = report;
    last = w;
    if (report.ok) return w;
    if (opts.onRetry) opts.onRetry(attempt, report);
  }
  console.warn('[world] validation never passed; shipping the last attempt', last && last.validation);
  return last;
}

function buildAttempt(master, attempt, relaxed) {
  const W = { master, attempt, rivers: null, elev: null };

  // 1-2. elevation (calibrated), then rivers from it
  W.elev = calibrateElevation(W);
  W.rivers = generateRivers(master, (x, y) => elevationAt(W, x, y), attempt);

  // 3-6. regions and their profiles
  const regions = generateRegions(W);
  W.regions = regions;

  // 7-8. settlements, then Hollow mouths that know where people live
  const usedPlaceNames = new Set();
  for (const r of regions.values()) usedPlaceNames.add(r.name.toLowerCase());
  const settlements = [];
  for (const r of regions.values()) {
    const ss = placeSettlements(W, r, [], usedPlaceNames);
    r.settlements = ss.map(s => s.id);
    settlements.push(...ss);
  }
  const settleById = new Map(settlements.map(s => [s.id, s]));
  W.settlements = settleById;

  // Hollow names borrow a nearby place name; only single-word ones read well.
  const placeNames = settlements.map(s => s.name).filter(n => !n.includes(' '));
  if (!placeNames.length) placeNames.push(...settlements.map(s => s.name.split(' ')[0]));
  const usedHollowNames = new Set();
  const hollows = [];
  for (const r of regions.values()) {
    const mine = r.settlements.map(id => settleById.get(id));
    const hs = generateHollows(W, r, mine.length ? mine : settlements.slice(0, 4), usedHollowNames, placeNames);
    r.hollows = hs.map(h => h.id);
    hollows.push(...hs);
  }
  W.hollows = new Map(hollows.map(h => [h.id, h]));

  // 9. roads
  W.roads = generateRoads(W, settlements);

  // 9.11 start, then tiers from it
  const start = chooseStart(W, settlements, hollows);
  W.startSettlementId = start ? start.id : (settlements[0] && settlements[0].id) || null;
  const startSettle = settleById.get(W.startSettlementId);
  W.startRegionId = startSettle ? startSettle.regionId : regions.keys().next().value;
  assignTiers(regions, W.startRegionId);
  for (const h of hollows) h.tier = regions.get(h.regionId).tier;

  // Layouts for the start settlement now (the rest are lazy).
  W.layouts = new Map();
  if (startSettle) W.layouts.set(startSettle.id, generateLayout(W, startSettle));
  W.start = startSettle ? startPoint(W, startSettle) : { x: WORLD_W >> 1, y: WORLD_H >> 1 };

  // §4.7 is a generator guarantee, not a hope: the first Hollow-mouth has to be
  // one screen away, or the opening beat sheet does not happen.
  ensureNearbyHollow(W, hollows);

  // 14.7 the gate solver decides which Hollow holds which capability
  W.gateReport = solveGates(W, hollows, settlements);

  // Threads, generated at world creation so the world is internally consistent
  W.threads = new Map();
  for (const r of regions.values()) {
    if (r.kind !== 'settled' || !r.settlements.length) continue;
    const th = generateThread(W, r);
    if (th) { W.threads.set(th.id, th); r.threadId = th.id; }
  }
  W.longThread = generateLongThread(W);

  // Vigor shard bookkeeping (GDD §9.14): half in the world, half in Hollows.
  W.shardPlan = planShards(W, hollows);

  W.relaxed = relaxed;
  // Lazy layout accessor, so chunk stamping never has to know about caches.
  W.layoutOf = id => layoutFor(W, id);
  return W;
}

/** @pure Where in the start settlement the player wakes: always the hearth. */
function startPoint(W, settle) {
  const layout = W.layouts.get(settle.id);
  return layout ? { ...layout.hearth } : { x: settle.x, y: settle.y };
}

/**
 * If nothing is within a short walk of the start, move the region's nearest
 * Hollow-mouth to the best site inside that radius. The mouth is derived, so
 * relocating it at world creation keeps the world a pure function of the seed.
 */
function ensureNearbyHollow(W, hollows) {
  const START_HOLLOW_RADIUS = 40;
  const mine = hollows.filter(h => h.regionId === W.startRegionId);
  if (!mine.length) return;
  const dist = h => Math.hypot(h.mouth.x - W.start.x, h.mouth.y - W.start.y);
  const nearest = mine.reduce((a, b) => (dist(a) <= dist(b) ? a : b));
  if (dist(nearest) <= START_HOLLOW_RADIUS) return;

  let best = null, bestScore = -Infinity;
  for (let r = 14; r <= START_HOLLOW_RADIUS; r += 2) {
    for (let a = 0; a < 24; a++) {
      const ang = (a / 24) * Math.PI * 2;
      const x = Math.round(W.start.x + Math.cos(ang) * r);
      const y = Math.round(W.start.y + Math.sin(ang) * r);
      if (x < 4 || y < 4 || x >= WORLD_W - 4 || y >= WORLD_H - 4) continue;
      const e = elevationAt(W, x, y);
      if (e < 0.35 || e > 0.9) continue;
      if (W.rivers.isWide(x, y)) continue;
      // hillsides first, and far enough out that the village is not on top of it
      const score = slopeAt(W, x, y) * 60 + (r > 22 ? 1 : 0) - (r < 18 ? 2 : 0);
      if (score > bestScore) { bestScore = score; best = { x, y }; }
    }
  }
  if (best) { nearest.mouth = best; nearest.movedToStart = true; }
}

/** @pure Choose the start settlement (GDD §9.11). */
function chooseStart(W, settlements, hollows) {
  const rng = deriveRNG(W.master, DOMAINS.START, W.attempt || 0);
  let best = null, bestScore = -Infinity;
  for (const s of settlements) {
    const region = W.regions.get(s.regionId);
    let sc = 0;
    if (s.size === 'hamlet' || s.size === 'village') sc += 2;
    if (biomeAt(W, s.x + 8, s.y) === 'sea' || biomeAt(W, s.x, s.y + 8) === 'sea' ||
        biomeAt(W, s.x - 8, s.y) === 'sea' || biomeAt(W, s.x, s.y - 8) === 'sea') sc += 1.5;
    // A Hollow you can see from the doorstep is worth a great deal here.
    let nearest = Infinity;
    for (const h of hollows) {
      if (h.regionId !== s.regionId) continue;
      nearest = Math.min(nearest, Math.hypot(h.mouth.x - s.x, h.mouth.y - s.y));
    }
    if (nearest <= 40) sc += 4;
    else if (nearest <= 70) sc += 2;
    sc += region.neighbors.filter(n => W.regions.get(n) && W.regions.get(n).kind === 'settled').length;
    if (region.quietBase > 0.4) sc -= 3;
    sc += rng.float(0, 0.4);
    if (sc > bestScore) { bestScore = sc; best = s; }
  }
  return best;
}

// ---------------------------------------------------------------------------
// The gate solver (GDD §14.7): prove the world is completable, and fix it if not
// ---------------------------------------------------------------------------

const GATE_FOR = {
  ember_jar: 'cracked', grapple_vine: 'wide_water', bell: 'warded',
  spade: 'buried', green_flame: 'veil', boat_whistle: 'deep_water',
};

function solveGates(W, hollows, settlements) {
  // Order Hollows by tier then id: a stable, meaningful acquisition order.
  const ordered = hollows.slice().sort((a, b) => a.tier - b.tier || (a.id < b.id ? -1 : 1));

  // Provisional plan: the six capabilities go to the six lowest-tier Hollows
  // that are not the Long Thread's final one; everything else gets gear or a shard.
  const finalHollow = ordered.length ? ordered[ordered.length - 1] : null;
  const carriers = ordered.filter(h => h !== finalHollow).slice(0, CAPABILITIES.length);
  const assigned = new Map();
  carriers.forEach((h, i) => assigned.set(h.id, CAPABILITIES[i]));

  for (const h of hollows) {
    if (assigned.has(h.id)) h.prize = { kind: 'capability', value: assigned.get(h.id) };
    else if ((h.tier + h.depth) % 3 === 0) h.prize = { kind: 'vigor_shard', value: 2 };
    else h.prize = { kind: 'gear', value: h.tier * 2 + h.depth };
  }

  // Prove reachability by flooding the world at each capability set.
  let caps = new Set();
  let reach = floodAt(W, caps);
  const report = { rounds: 0, reassigned: 0, reachableSettlements: 0, allCaps: false };

  for (let round = 0; round < 8; round++) {
    report.rounds = round + 1;
    const gained = [];
    for (const h of ordered) {
      if (h.prize.kind !== 'capability' || caps.has(h.prize.value)) continue;
      if (inReach(reach, h.mouth.x, h.mouth.y)) gained.push(h);
    }
    if (!gained.length) {
      // Nothing new is reachable. Move the earliest-blocked capability to the
      // lowest-tier Hollow we can actually walk to. Better than re-rolling.
      const blocked = ordered.find(h => h.prize.kind === 'capability' && !caps.has(h.prize.value));
      if (!blocked) break;
      const host = ordered.find(h => inReach(reach, h.mouth.x, h.mouth.y) &&
        (h.prize.kind !== 'capability' || caps.has(h.prize.value)));
      if (!host) break;
      const moved = blocked.prize.value;
      blocked.prize = { kind: 'gear', value: blocked.tier * 2 + blocked.depth };
      host.prize = { kind: 'capability', value: moved };
      report.reassigned++;
      continue;
    }
    for (const h of gained) caps.add(h.prize.value);
    reach = floodAt(W, caps);
  }

  report.allCaps = CAPABILITIES.every(c => caps.has(c));
  report.reachableSettlements = settlements.filter(s => inReach(reach, s.x, s.y)).length;
  report.settlementTotal = settlements.length;
  return report;
}

/** @pure Flood the world on a 4-tile lattice given a capability set. */
function floodAt(W, caps) {
  const L = 4;
  const sx = Math.round(W.start.x / L), sy = Math.round(W.start.y / L);
  const passable = (lx, ly) => {
    const x = lx * L, y = ly * L;
    if (x < 0 || y < 0 || x >= WORLD_W || y >= WORLD_H) return false;
    const e = elevationAt(W, x, y);
    if (e < 0.30) return caps.has('boat_whistle');
    if (e < 0.34) return true;
    if (e > 0.93) return false;
    if (W.rivers.isWide(x, y)) return caps.has('grapple_vine') || caps.has('boat_whistle');
    return true;
  };
  return floodFill(sx, sy, passable, { limit: 200000 });
}

const inReach = (reach, x, y) => reach.has(Math.round(x / 4) * 4096 + Math.round(y / 4));

/** @pure Which chunks hold a shard fragment, and how many Hollows carry one. */
function planShards(W, hollows) {
  const inHollows = hollows.filter(h => h.prize.kind === 'vigor_shard')
    .reduce((n, h) => n + h.prize.value, 0);
  return { inHollows, inWorld: Math.max(0, VIGOR_SHARDS_IN_WORLD - inHollows) };
}

// ---------------------------------------------------------------------------
// Validation (GDD §9.10)
// ---------------------------------------------------------------------------

function validate(W, relaxed) {
  const fails = [];
  const regions = [...W.regions.values()];
  const settled = regions.filter(r => r.kind === 'settled');
  const settlements = [...W.settlements.values()];

  if (settled.length < 10) fails.push('V1 settled regions ' + settled.length);
  if (settlements.length < (relaxed ? 10 : 18)) fails.push('V2 settlements ' + settlements.length);
  for (const r of settled) if (!r.hollows.length) { fails.push('V3 ' + r.id + ' has no Hollow'); break; }
  if (!W.roads.edges.length && settlements.length > 1) fails.push('V4 no roads');

  // V5: at least 3 other regions reachable on foot from the start.
  const reach = floodAt(W, new Set());
  const seenRegions = new Set();
  for (const k of reach) {
    const x = Math.floor(k / 4096) * 4, y = (k % 4096) * 4;
    seenRegions.add(regionAt(W, x, y));
    if (seenRegions.size > 8) break;
  }
  if (seenRegions.size < 4) fails.push('V5 walkable regions ' + seenRegions.size);

  // V6: enough land to be a country.
  let land = 0, samples = 0;
  for (let y = 0; y < WORLD_H; y += 24) for (let x = 0; x < WORLD_W; x += 24) {
    samples++;
    if (elevationAt(W, x, y) >= 0.30) land++;
  }
  const landTiles = Math.round((land / samples) * WORLD_W * WORLD_H);
  if (landTiles < (relaxed ? 200000 : 380000)) fails.push('V6 land ' + landTiles);

  // V7: the gate solver proved the capabilities can all be had.
  if (!W.gateReport.allCaps) fails.push('V7 capabilities unreachable');

  return {
    ok: fails.length === 0, fails, attempt: W.attempt,
    settledRegions: settled.length, settlements: settlements.length,
    hollows: W.hollows.size, landTiles, walkableRegions: seenRegions.size,
    roads: W.roads.edges.length, gate: W.gateReport,
  };
}

/** Lazily derive and cache a settlement layout. The cache is pure. */
export function layoutFor(W, settleId) {
  let l = W.layouts.get(settleId);
  if (!l) {
    const s = W.settlements.get(settleId);
    if (!s) return null;
    l = generateLayout(W, s);
    W.layouts.set(settleId, l);
  }
  return l;
}

/** Every settlement whose footprint could touch this chunk. */
export function settlementsNear(W, tx, ty, radius = 40) {
  const out = [];
  for (const s of W.settlements.values()) {
    if (Math.abs(s.x - tx) <= radius && Math.abs(s.y - ty) <= radius) out.push(s);
  }
  return out;
}

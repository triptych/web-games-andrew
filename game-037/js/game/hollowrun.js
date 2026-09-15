// ============================================================
// game/hollowrun.js - descending, ascending, lighting (GDD §12.9, §12.11)
// Identity persists. The body does not.
// ============================================================
import { bus } from '../core/bus.js';
import { EV } from '../data/events.js';
import { FLOOR_CACHE_CAP, QUIET_LIGHT_DROP } from '../data/constants.js';
import { clamp01 } from '../core/util.js';
import { generateFloor } from '../gen/hollow/floor.js';
import { State, logLine } from './state.js';
import { recomputePlayer, grantXP, addShard, grantCapability } from './player.js';
import { CAPABILITY_INFO } from '../gen/hollow/identity.js';
import { addItem } from './inventory.js';
import { generateItem } from '../gen/item.js';
import { streamAround } from '../world/chunks.js';
import { refreshNpcActors } from '../world/entities.js';
import { updateFOV } from './fov.js';

/** Enter from the surface: the descent counter moves, the cache is thrown away. */
export function enterHollow(state, hollowId) {
  const h = state.W.hollows.get(hollowId);
  if (!h) return false;
  h.descent++;
  h.discovered = true;
  state.knowledge.places.add(h.id);
  state.hollow = {
    id: hollowId, depth: 0, descent: h.descent,
    floors: new Map(), surfaceReturn: { x: state.player.x, y: state.player.y },
    lanternsLit: 0, pacifistTurns: 0, damageDealtTick: -1,
  };
  state.mode = 'hollow';
  logLine(h.entrancePrompt, 'plain');
  bus.emit(EV.HOLLOW_ENTERED, { hollowId, descent: h.descent });
  goToFloor(state, 1, 'down');
  return true;
}

/** Move to a floor, generating or reviving it from the in-memory cache. */
export function goToFloor(state, depth, direction) {
  const run = state.hollow;
  const h = state.W.hollows.get(run.id);
  if (!h) return;
  const region = state.W.regions.get(h.regionId);
  const quiet = region ? region.quiet : 0.2;

  let floor = run.floors.get(depth);
  let regenerated = false;
  if (!floor) {
    floor = generateFloor(state.W, h, depth, run.descent, quiet);
    regenerated = true;
    run.floors.set(depth, floor);
    bus.emit(EV.HOLLOW_FLOORGEN, { hollowId: h.id, depth, descent: run.descent, attempts: floor.validation.attempt });
  }
  floor.lastVisited = state.tick;

  // cache cap: evict the least recently visited floor that is not this one
  if (run.floors.size > FLOOR_CACHE_CAP) {
    let victim = null;
    for (const [d, f] of run.floors) {
      if (d === depth) continue;
      if (!victim || f.lastVisited < run.floors.get(victim).lastVisited) victim = d;
    }
    if (victim !== null) run.floors.delete(victim);
  }

  run.depth = depth;
  run.floor = floor;
  state.entities = floor.entities.length ? floor.entities : instantiate(state, floor);
  floor.entities = state.entities;

  const p = state.player;
  const stair = direction === 'down' ? floor.upStair : floor.downStair || floor.upStair;
  p.x = stair.x; p.y = stair.y;
  p.energy = 0;

  h.deepest = Math.max(h.deepest || 0, depth);
  if (regenerated && depth > 1) logLine('Something has moved down here.', 'plain');
  logLine(floor.lore, 'flavour');
  if (floor.problem) logLine(floor.problem.statement, 'warn');
  if (depth > (h.seenDepth || 0)) { h.seenDepth = depth; grantXP(p, 10 + depth * 6); }
  updateFOV(state);
  bus.emit(EV.UI_REFRESH, {});
}

function instantiate(state, floor) {
  const out = [];
  for (const m of floor.report.monsters) {
    out.push({ ...m, id: m.uid, energy: 0, statuses: [], facing: 4, abilityCooldown: 0, phase: 1 });
  }
  const arena = floor.rooms.find(r => r.kind === 'arena');
  for (const e of out) if (e.isBoss && arena) e.arena = arena;
  if (floor.guest) {
    out.push({
      id: 'guest:' + floor.hollowId + ':' + floor.depth, isGuest: true, name: 'someone down here',
      x: floor.guest.x, y: floor.guest.y, hp: 12, maxHp: 12, energy: 0, speed: 100,
      initiative: 9000, hostile: false, behavior: 'follower', statuses: [], awareness: 'aware', facing: 4,
    });
  }
  return out;
}

export function descend(state) {
  const run = state.hollow;
  const h = state.W.hollows.get(run.id);
  const effectiveDepth = h.lit ? Math.max(2, h.depth - 1) : h.depth;
  if (run.depth >= effectiveDepth) { logLine('There is nothing below this.', 'plain'); return false; }
  goToFloor(state, run.depth + 1, 'down');
  return true;
}

export function ascend(state) {
  const run = state.hollow;
  if (run.depth <= 1) { leaveHollow(state); return true; }
  goToFloor(state, run.depth - 1, 'up');
  return true;
}

/** Leaving discards the whole cache. The descent counter stays where it is. */
export function leaveHollow(state) {
  const run = state.hollow;
  if (!run) return;
  const id = run.id;
  const back = run.surfaceReturn;
  state.hollow = null;
  state.mode = 'overworld';
  state.player.x = back.x; state.player.y = back.y;
  state.player.energy = 0;
  state.entities = [];
  streamAround(state, back.x, back.y);
  refreshNpcActors(state);
  updateFOV(state);
  logLine('Daylight, or something like it.', 'good');
  bus.emit(EV.HOLLOW_LEFT, { hollowId: id });
  bus.emit(EV.UI_REFRESH, {});
}

/** Satisfying a litCondition. Permanent, and the region feels it. */
export function lightHollow(state, hollowId) {
  const h = state.W.hollows.get(hollowId);
  if (!h || h.lit) return false;
  h.lit = true;
  const region = state.W.regions.get(h.regionId);
  if (region) {
    region.quiet = clamp01(region.quiet - QUIET_LIGHT_DROP);
    region.litHollows = (region.litHollows || 0) + 1;
    bus.emit(EV.WORLD_QUIET, { regionId: region.id, value: region.quiet, delta: -QUIET_LIGHT_DROP });
  }
  state.stats.quiet += 3;
  grantXP(state.player, 80 + h.tier * 40);
  logLine(`${h.name} is lit. You can feel the difference in the air.`, 'good');
  state.ledger.push({ tick: state.tick, text: `Lit ${h.name}${region ? ', in ' + region.name : ''}.` });
  bus.emit(EV.HOLLOW_LIT, { hollowId, regionId: h.regionId });
  return true;
}

/** Check whether this Hollow's condition has just been met. */
export function checkLitCondition(state, event) {
  const run = state.hollow;
  if (!run) return;
  const h = state.W.hollows.get(run.id);
  if (!h || h.lit) return;
  if (h.litCondition === 'boss' && event === 'boss_killed') lightHollow(state, h.id);
  if (h.litCondition === 'lanterns') {
    const total = h.depth;
    if (run.lanternsLit >= total) lightHollow(state, h.id);
  }
  if (h.litCondition === 'silence' && event === 'turn') {
    const effectiveDepth = h.lit ? h.depth - 1 : h.depth;
    if (run.depth >= effectiveDepth) {
      run.pacifistTurns++;
      if (run.pacifistTurns === 10) logLine('The quiet down here is starting to feel like listening.', 'flavour');
      if (run.pacifistTurns >= 30) lightHollow(state, h.id);
    }
  }
}

/** Taking the identity prize. It never appears again. */
export function takePrize(state, prop) {
  const h = state.W.hollows.get(prop.hollow);
  if (!h || h.prizeTaken) return false;
  const p = state.player;
  const prize = prop.prize;
  h.prizeTaken = true;
  prop.taken = true;

  if (prize.kind === 'capability') {
    grantCapability(p, prize.value);
    const info = CAPABILITY_INFO[prize.value];
    logLine(`${info.name}. You can get past ${info.gate} now.`, 'good');
    state.ledger.push({ tick: state.tick, text: `Found the ${info.name} in ${h.name}.` });
  } else if (prize.kind === 'vigor_shard') {
    addShard(p, prize.value || 2);
    state.ledger.push({ tick: state.tick, text: `Took a shard out of ${h.name}.` });
  } else if (prize.kind === 'ending') {
    state.flags.add('long_prize');
    logLine('A ledger, open at a page somebody meant you to read.', 'flavour');
  } else {
    const item = generateItem(state.master, h.id + ':prize', 0, {
      ilvl: prize.value || (h.tier * 2 + h.depth), category: 'weapon',
    });
    addItem(p, item);
    state.ledger.push({ tick: state.tick, text: `Came out of ${h.name} with ${item.name}.` });
  }
  recomputePlayer(p);
  return true;
}

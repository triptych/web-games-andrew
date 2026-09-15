// ============================================================
// game/placeverbs.js - the verbs that belong to a place, not a fight
// Resting, sleeping, praying, ringing, lighting, naming, mending, foraging.
// ============================================================
import { bus } from '../core/bus.js';
import { EV } from '../data/events.js';
import { dist8, clamp01 } from '../core/util.js';
import { ACTION_ENERGY, TICKS_PER_HOUR } from '../data/constants.js';
import { O, objDef } from '../data/objects.js';
import { State, logLine } from './state.js';
import { objectAt, propAt, setObject } from '../world/access.js';
import { recordPropDelta } from '../world/chunks.js';
import { addItem, countOf, takeOf } from './inventory.js';
import { recomputePlayer } from './player.js';
import { removeStatus } from './status.js';
import { checkLitCondition } from './hollowrun.js';
import { advanceTime } from './time.js';
import { onPlayerAction } from './quests.js';
import { makeSimpleItem } from '../gen/item.js';
import { doExamine, regionForPlayer, placeName } from './verbs.js';

export function doRest(state, x, y) {
  const p = state.player;
  p.restingAtHearth = true;
  p.wakePoint = { x, y, kind: 'hearth', name: placeName(state, x, y) };
  for (const key of Object.keys(p.toolCharges)) p.toolCharges[key] = 3;
  if (p.mods.hearthClears) { const bad = p.statuses.find(s => s.key !== 'hungry'); if (bad) removeStatus(p, bad.key); }
  logLine('You sit by it a while. This is where you would wake.', 'good');
  const turns = 30;
  for (let i = 0; i < turns; i++) { if (p.hp < p.maxHp && i % 4 === 0) p.hp++; }
  p.restingAtHearth = false;
  advanceTime(turns * 100);
  return ACTION_ENERGY.wait;
}

export function doSleep(state, x, y) {
  const p = state.player;
  const prop = propAt(state, x, y);
  const isInn = prop && prop.fn === 'inn';
  if (isInn && p.coin < 12) { logLine('Twelve coin for the bed. You have not got it.', 'plain'); return 0; }
  if (isInn) p.coin -= 12;
  p.hp = p.maxHp;
  p.statuses = p.statuses.filter(s => s.key === 'hungry' || s.key === 'starving');
  removeStatus(p, 'wakesick');
  p.wakePoint = { x, y, kind: 'bed', name: placeName(state, x, y) };
  for (const key of Object.keys(p.toolCharges)) p.toolCharges[key] = 3;
  recomputePlayer(p);
  logLine('You sleep, and it is morning, and you are all the way back.', 'good');
  // Eight hours pass on the world clock directly. Feeding them through the
  // energy scheduler would make every actor in the world take 960 turns.
  advanceTime(TICKS_PER_HOUR * 8 * 100);
  return ACTION_ENERGY.wait;
}

export function doRead(state, x, y) {
  const prop = propAt(state, x, y);
  if (prop && prop.kind === 'notice_board') {
    bus.emit(EV.UI_PANEL, { name: 'notices', settlement: prop.settlement });
    return 0;
  }
  return doExamine(state, x, y);
}

export function doPray(state, x, y) {
  const p = state.player;
  p.wakePoint = { x, y, kind: 'shrine', name: placeName(state, x, y) };
  if (p.vigorLost) { p.vigorLost = 0; removeStatus(p, 'wakesick'); recomputePlayer(p); }
  logLine('A cup of rain, and your name said quietly. This is where you would wake.', 'good');
  state.stats.quiet++;
  return ACTION_ENERGY.useTool;
}

export function doRing(state, x, y) {
  const p = state.player;
  const day = Math.floor(state.tick / 2400);
  const prop = propAt(state, x, y);
  if (prop && prop.rungDay === day) { logLine('It has been rung today.', 'plain'); return 0; }
  if (prop) { prop.rungDay = day; if (state.mode === 'overworld') recordPropDelta(state, prop, { rungDay: day }); }
  const region = regionForPlayer(state);
  if (region) { region.quiet = clamp01(region.quiet - 0.04); bus.emit(EV.WORLD_QUIET, { regionId: region.id, value: region.quiet, delta: -0.04 }); }
  for (const e of state.entities) {
    if (e.family === 'forgotten' && dist8(e.x, e.y, x, y) <= 6) addStatus(e, 'dazed', 2);
  }
  logLine('One note, and it goes a long way. Things remember themselves a little.', 'good');
  state.stats.quiet += 2;
  return ACTION_ENERGY.useTool;
}

export function doLight(state, x, y) {
  const p = state.player;
  const prop = propAt(state, x, y);
  if (!prop) return 0;
  if (prop.lit) { logLine('Already burning.', 'plain'); return 0; }
  const hasFire = p.caps.has('ember_jar') || p.lanternLit;
  if (!hasFire) { logLine('Nothing to light it with.', 'warn'); return 0; }
  prop.lit = true;
  setObject(state, x, y, prop.kind === 'standing_lantern' ? O.standing_lantern_lit : O.sconce_lit, false);
  state.stats.tools++;
  if (prop.kind === 'standing_lantern' && state.hollow) {
    state.hollow.lanternsLit++;
    logLine('The keeper\'s lantern takes. The dark backs off a step.', 'good');
    checkLitCondition(state, 'lantern');
  } else {
    logLine('It takes, and holds.', 'good');
    const floor = state.hollow && state.hollow.floor;
    if (floor && floor.sconces) {
      const allLit = floor.sconces.every(i => { const pr = floor.props.get(i); return pr && pr.lit; });
      if (allLit) { logLine('All four. Something unlocks, further in.', 'good'); unlockAllLocks(floor); }
    }
  }
  return ACTION_ENERGY.useTool;
}

export function unlockAllLocks(floor) {
  for (const [i, kind] of [...floor.locks]) {
    floor.locks.delete(i);
    floor.object[i] = O.door_open;
    const pr = floor.props.get(i);
    if (pr) pr.locked = false;
  }
}

export function doName(state, x, y) {
  const p = state.player;
  const prop = propAt(state, x, y);
  if (!prop || prop.kind !== 'nameplate') return doExamine(state, x, y);
  if (prop.named) { logLine('You already gave this one back.', 'plain'); return 0; }
  prop.named = true;
  state.stats.quiet += 2;
  logLine('You say what it was. The letters come back, a little crooked.', 'good');
  const floor = state.hollow && state.hollow.floor;
  if (floor && floor.nameplates) {
    const all = floor.nameplates.every(i => { const pr = floor.props.get(i); return pr && pr.named; });
    if (all) { logLine('Three names back where they belong. Something gives.', 'good'); unlockAllLocks(floor); }
  }
  return ACTION_ENERGY.useTool;
}

export function doUse(state, x, y) {
  const prop = propAt(state, x, y);
  if (!prop) return doExamine(state, x, y);
  if (prop.kind === 'puzzle') {
    if (prop.used) { logLine('It has been turned already.', 'plain'); return 0; }
    prop.used = true;
    const floor = state.hollow && state.hollow.floor;
    if (floor) {
      unlockAllLocks(floor);
      if (floor.problem && floor.problem.key === 'rising_water') { floor.waterLevel = 0; floor.waterRiseEvery = 0; logLine('The sluice opens. The water starts going down.', 'good'); }
      else logLine('Something heavy moves, a long way off.', 'good');
    }
    state.stats.tools++;
    return ACTION_ENERGY.useTool;
  }
  if (prop.kind === 'mortar') { bus.emit(EV.UI_PANEL, { name: 'identify' }); return 0; }
  if (prop.kind === 'repair') { bus.emit(EV.UI_PANEL, { name: 'repair' }); return 0; }
  if (prop.kind === 'stash') { bus.emit(EV.UI_PANEL, { name: 'stash' }); return 0; }
  if (prop.kind === 'shop') { bus.emit(EV.UI_PANEL, { name: 'shop', prop }); return 0; }
  if (prop.mendable) { return doMend(state, prop); }
  return doExamine(state, x, y);
}

export function doMend(state, prop) {
  const p = state.player;
  if (prop.mended) { logLine('Mended already.', 'plain'); return 0; }
  const need = ['firewood', 'river_clay', 'wool'].find(k => countOf(p, k) >= 2);
  if (!need) { logLine('It wants materials. Two of something: wood, clay, wool.', 'warn'); return 0; }
  takeOf(p, need, 2);
  prop.mended = true;
  if (state.mode === 'overworld') recordPropDelta(state, prop, { mended: true });
  logLine(`You put the ${prop.name} right. It will hold.`, 'good');
  onPlayerAction(state, { kind: 'use', prop });
  state.stats.social++;
  return ACTION_ENERGY.useTool * 2;
}

export function doForage(state, prop, x, y) {
  const p = state.player;
  const obj = objDef(objectAt(state, x, y));
  const key = prop.forage || obj.forage || 'berries';
  const day = Math.floor(state.tick / 2400);
  if (prop.foragedDay === day) { logLine('Nothing left today.', 'plain'); return 0; }
  const rng = state.rngStreams.combat;
  const region = regionForPlayer(state);
  const quiet = region ? region.quiet : 0;
  let n = 1 + (p.mods.forage || 0);
  if (quiet > 0.35) n = Math.max(1, Math.round(n * 0.75));
  if (state.weather && state.weather.kind === 'rain') n += rng.chance(0.15) ? 1 : 0;
  prop.foragedDay = day;
  if (state.mode === 'overworld' && prop.id) recordPropDelta(state, prop, { foragedDay: day });
  addItem(p, makeSimpleItem(key, n));
  state.stats.forage += 2;
  onPlayerAction(state, { kind: 'get', item: { base: key, stack: n } });
  return ACTION_ENERGY.pickup;
}

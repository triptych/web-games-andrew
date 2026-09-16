// ============================================================
// game/actions.js - every verb the player has (GDD §16.4, §18.4)
// One input = one world turn. Each returns the energy spent, or 0.
// ============================================================
import { bus } from '../core/bus.js';
import { EV } from '../data/events.js';
import { DIRS8, dirIndex } from '../core/coords.js';
import { dist8, clamp01 } from '../core/util.js';
import { computeFOV } from '../core/grid.js';
import { ACTION_ENERGY, LANTERN_CAPACITY, TICKS_PER_HOUR, OIL_PER_FLASK } from '../data/constants.js';
import { T, F, tileDef } from '../data/tiles.js';
import { O, objDef } from '../data/objects.js';
import { OBSERVATIONS, HOLLOW_OBSERVATIONS } from '../data/text.js';
import { BASE_ITEMS } from '../data/items.js';
import { State, logLine } from './state.js';
import {
  groundAt, objectAt, decorAt, flagsAt, propAt, isSolid, isOpaque, moveCost,
  setGround, setObject, setDecor, setFlag, deleteProp, setProp, inBounds, isDeep,
} from '../world/access.js';
import { recordPropDelta, streamAround } from '../world/chunks.js';
import { actorAt, resolveAttack, inWeaponRange, weaponOf, knockback, applyDamage } from './combat.js';
import { spendPlayerEnergy, startOfTurn, runUntilPlayerInput } from './scheduler.js';
import { addItem, removeItem, useItem, displayName, identifyItem, tickAttunement, countOf, takeOf } from './inventory.js';
import { recomputePlayer, grantXP, addShard, grantCapability } from './player.js';
import { addStatus, hasStatus, removeStatus, cure } from './status.js';
import { checkLitCondition } from './hollowrun.js';
import { spawnAmbient, maybeAmbush, refreshNpcActors, rosterOf } from '../world/entities.js';
import { onPlayerAction } from './quests.js';
import { openDialogue } from './dialogue.js';
import { updateFOV, fovRadius } from './fov.js';
import {
  doVerb, doAttack, doExamine, doTalk, propVerb, propPrio, tickFloorProblem, collapseBehind,
} from './verbs.js';
import { makeSimpleItem, generateItem } from '../gen/item.js';
import { floorItemsAt, setFloorItems } from './grounditems.js';
import { CAPABILITY_INFO } from '../gen/hollow/identity.js';
import { regionAt } from '../gen/fields.js';

// ---------------------------------------------------------------------------
// the turn wrapper
// ---------------------------------------------------------------------------

/** Run one player action, then let the world catch up. */
export function act(state, fn) {
  const p = state.player;
  if (!p) return;
  if (p.hp <= 0) { bus.emit(EV.PLAYER_WOKE, { pending: true }); return; }
  startOfTurn(state, p);
  if (p.hp <= 0) { bus.emit(EV.PLAYER_WOKE, { pending: true }); return; }
  p.movedThisTurn = false;
  p.attackedThisTurn = false;
  const energy = fn() || 0;
  if (energy <= 0) { bus.emit(EV.UI_REFRESH, {}); return; }
  spendPlayerEnergy(state, energy);
  tickAttunement(p);
  afterTurn(state);
  runUntilPlayerInput(state);
  afterWorld(state);
  bus.emit(EV.UI_REFRESH, {});
}

function afterTurn(state) {
  const p = state.player;
  if (state.mode === 'overworld') {
    streamAround(state, p.x, p.y);
    spawnAmbient(state);
    refreshNpcActors(state);
    maybeAmbush(state);
  } else if (state.hollow) {
    tickFloorProblem(state);
    checkLitCondition(state, 'turn');
  }
  updateFOV(state);
  onPlayerAction(state, { kind: 'turn' });
}

function afterWorld(state) {
  const p = state.player;
  if (p.hp <= 0) bus.emit(EV.PLAYER_WOKE, { pending: true });
  state.entities = state.entities.filter(e => e.isNpc || e.hp > 0 || e.corpseTick > state.tick - 2);
}



// ---------------------------------------------------------------------------
// movement
// ---------------------------------------------------------------------------

export function tryMove(state, dx, dy) {
  const p = state.player;
  const nx = p.x + dx, ny = p.y + dy;
  p.facing = dirIndex(Math.sign(dx), Math.sign(dy));
  if (p.facing < 0) p.facing = 4;

  const target = actorAt(state, nx, ny);
  if (target && target !== p) {
    if (target.isNpc) return doTalk(state, target);
    if (target.isGuest) { logLine('They are following you.', 'plain'); return 0; }
    return doAttack(state, nx, ny);
  }

  // no corner-cutting
  if (dx !== 0 && dy !== 0) {
    if (isSolid(state, p.x + dx, p.y) && isSolid(state, p.x, p.y + dy)) {
      logLine('Not that way.', 'plain');
      return 0;
    }
  }

  const gated = gateCheck(state, nx, ny);
  if (gated !== null) return gated;

  const cost = moveCost(state, nx, ny, p);
  if (cost === null) {
    // Bumping a chest, a stand or a shrine should open it, not describe it.
    const prop = propAt(state, nx, ny);
    const objVerb = objDef(objectAt(state, nx, ny)).verb;
    const verb = prop ? propVerb(prop, objectAt(state, nx, ny)) : objVerb;
    if (verb && verb !== 'examine') return doVerb(state, verb, { x: nx, y: ny, prop });
    bumpFlavour(state, nx, ny);
    return 0;
  }

  const from = { x: p.x, y: p.y };
  p.x = nx; p.y = ny;
  p.movedThisTurn = true;
  state.stats.explore++;
  bus.emit(EV.ACTOR_MOVED, { id: 'player', from, to: { x: nx, y: ny } });

  leaveTracks(state, from.x, from.y);
  onStep(state, nx, ny);

  let energy = (dx !== 0 && dy !== 0)
    ? (p.mods.cheapDiagonal ? ACTION_ENERGY.move : ACTION_ENERGY.moveDiagonal)
    : ACTION_ENERGY.move;
  energy += cost;
  if (hasStatus(p, 'encumbered')) energy += 40;
  if (state.weather && state.weather.kind === 'snow' && !(flagsAt(state, nx, ny) & F.ROAD)) energy += 20;
  p.heavyStep = energy > 150;
  return Math.max(40, energy);
}

/** A blocked affordance says what would open it. That is the whole design. */
function gateCheck(state, x, y) {
  const p = state.player;
  const obj = objectAt(state, x, y);
  const prop = propAt(state, x, y);
  if (obj === O.door_warded && !p.caps.has('bell')) {
    logLine('A ward, cut into the frame. Something with a clear note would answer it.', 'warn');
    return 0;
  }
  if (obj === O.cracked_wall && !p.caps.has('ember_jar')) {
    logLine('The mortar has given up here. Heat would finish the job.', 'warn');
    return 0;
  }
  if (obj === O.quiet_veil && !p.caps.has('green_flame')) {
    logLine('The air refuses to be looked at. A different kind of light might see it.', 'warn');
    return 0;
  }
  if (obj === O.door_sealed && !p.caps.has('ember_jar')) {
    logLine('Sealed with pitch. Fire would open it.', 'warn');
    return 0;
  }
  if (isDeep(state, x, y) && !p.caps.has('boat_whistle')) {
    logLine('Deep water. You would need a boat.', 'warn');
    return 0;
  }
  if (state.mode === 'overworld' && state.W.rivers.isWide(x, y) && !p.caps.has('grapple_vine') && !p.caps.has('boat_whistle')) {
    logLine('Too wide and too fast. Something to hook the far bank with, maybe.', 'warn');
    return 0;
  }
  if (obj === O.door_locked) {
    const floorLock = state.hollow && state.hollow.floor && state.hollow.floor.lockAt(x, y);
    if (floorLock) {
      if (p.inventory.some(i => i.base === 'floor_key' && i.keyKind === floorLock)) {
        takeOf(p, 'floor_key', 1);
        setObject(state, x, y, O.door_open, false);
        if (state.hollow.floor) state.hollow.floor.locks.delete(y * state.hollow.floor.w + x);
        logLine(`The ${floorLock} turns.`, 'good');
        return ACTION_ENERGY.door;
      }
      logLine(`Locked. There is a ${floorLock} on this floor.`, 'warn');
      return 0;
    }
    if (prop && prop.locked) {
      if (p.attrs.hand >= 7) {
        recordPropDelta(state, prop, { locked: false });
        setObject(state, x, y, O.door_open, true);
        logLine('The lock gives. You have done this before.', 'good');
        return ACTION_ENERGY.door;
      }
      logLine('Locked. A key, or better hands.', 'warn');
      return 0;
    }
  }
  if (obj === O.door) {
    setObject(state, x, y, O.door_open, state.mode === 'overworld');
    logLine('You push the door open.', 'plain');
    return ACTION_ENERGY.door;
  }
  return null;
}

function bumpFlavour(state, x, y) {
  const obj = objDef(objectAt(state, x, y));
  const tile = tileDef(groundAt(state, x, y));
  if (obj.id) logLine(obj.desc || `${obj.name}. You cannot go through it.`, 'plain');
  else logLine(tile.desc || 'Not that way.', 'plain');
}

function leaveTracks(state, x, y) {
  const g = tileDef(groundAt(state, x, y));
  if (!g.tracks) return;
  if (decorAt(state, x, y)) return;
  setDecor(state, x, y, 12, false);      // DECOR_ID.tracks
}

function onStep(state, x, y) {
  const p = state.player;
  const prop = propAt(state, x, y);
  const tile = tileDef(groundAt(state, x, y));

  if (tile.fragile && state.rngStreams.combat.chance(0.12)) {
    setGround(state, x, y, T.pit, state.mode === 'overworld');
    applyDamage(state, p, state.rngStreams.combat.dice(1, 1, 4), 'blunt', null);
    logLine('The crust gives under you.', 'bad');
  }
  if (prop && prop.kind === 'trap' && !prop.sprung) {
    prop.sprung = true; prop.hidden = false;
    applyDamage(state, p, prop.damage || 4, 'pierce', null);
    logLine('A pit, under a rug of sticks. You go in to the knee.', 'bad');
    bus.emit(EV.UI_SHAKE, { mag: 2, ms: 140 });
  }
  const items = floorItemsAt(state, x, y);
  if (items && items.length) logLine(`${displayName(items[0])} is here.`, 'plain');
  if (prop && prop.kind === 'hollow_mouth' && !state.knowledge.places.has(prop.hollow)) {
    state.knowledge.places.add(prop.hollow);
    const h = state.W.hollows.get(prop.hollow);
    if (h) { h.discovered = true; logLine(`${h.name}. The name-plate is still legible.`, 'flavour'); grantXP(p, 15); }
  }
  if (state.hollow && state.hollow.floor && state.hollow.floor.collapsing) collapseBehind(state, x, y);
}


// ---------------------------------------------------------------------------
// the context verb (GDD §18.4): talk > open > take > use > read > pray > enter > attack
// ---------------------------------------------------------------------------

export function contextVerb(state, dx = null, dy = null) {
  const p = state.player;
  const candidates = [];
  const here = [0, 0];
  const dirs = (dx === null) ? [here, ...DIRS8.map(d => d)] : [[dx, dy], here];
  for (const [ox, oy] of dirs) {
    const x = p.x + ox, y = p.y + oy;
    if (!inBounds(state, x, y)) continue;
    const a = actorAt(state, x, y);
    if (a && a !== p && a.isNpc) return { verb: 'talk', x, y, actor: a };
    const prop = propAt(state, x, y);
    const obj = objectAt(state, x, y);
    const items = floorItemsAt(state, x, y);
    if (items && items.length) candidates.push({ verb: 'take', x, y, prio: 3 });
    if (prop) candidates.push({ verb: propVerb(prop, obj), x, y, prop, prio: propPrio(prop) });
    else if (obj && objDef(obj).verb) candidates.push({ verb: objDef(obj).verb, x, y, prio: 5 });
    if (a && a !== p && !a.isNpc && a.hostile !== false && a.hp > 0) candidates.push({ verb: 'attack', x, y, actor: a, prio: 9 });
  }
  candidates.sort((a, b) => a.prio - b.prio);
  return candidates[0] || { verb: 'wait', x: p.x, y: p.y };
}


/** Resolve whatever the context button says it will do. */
export function doContext(state, dx = null, dy = null) {
  const c = contextVerb(state, dx, dy);
  return doVerb(state, c.verb, c);
}



// The individual verbs live in verbs.js; this file keeps the turn wrapper,
// movement, and the context-verb dispatch.
export {
  doVerb, doAttack, doExamine, doDouse, doShove, doRestUntil,
  regionForPlayer, placeName, propVerb, doWait,
} from './verbs.js';
export { floorItemsAt, setFloorItems } from './grounditems.js';
export { updateFOV, fovRadius } from './fov.js';
